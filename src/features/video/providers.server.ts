import type {
  ReferenceImageProvider,
  ScriptProvider,
  VideoSceneProvider,
} from "@/features/video/provider-boundary";
import { getVideoProviderConfig } from "@/features/video/provider-config.server";

function safeProviderError(status: number) {
  if (status === 401 || status === 403) return "بيانات اعتماد مزود الإنتاج غير صالحة";
  if (status === 402) return "رصيد مزود الإنتاج غير كافٍ";
  if (status === 429) return "مزود الإنتاج مشغول، حاول لاحقاً";
  return `فشل مزود الإنتاج (${status})`;
}

const WAN_NUM_FRAMES = 81;

function wanFramesPerSecond(desiredDurationSeconds: number) {
  return Math.min(30, Math.max(5, Math.round(WAN_NUM_FRAMES / desiredDurationSeconds)));
}

export function referenceImageProvider(): ReferenceImageProvider {
  const config = getVideoProviderConfig().reference;
  const apiKey = config.apiKey;
  const model = config.model;
  if (!apiKey) throw new Error("GEMINI_API_KEY غير مهيأ لتوليد الصورة المرجعية");
  return {
    async generate({ prompt, sourceImage }) {
      const bytes = Buffer.from(await sourceImage.arrayBuffer());
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: sourceImage.type || "image/jpeg",
                      data: bytes.toString("base64"),
                    },
                  },
                ],
              },
            ],
          }),
        },
      );
      if (!response.ok) throw new Error(safeProviderError(response.status));
      const body = (await response.json()) as {
        candidates?: {
          content?: {
            parts?: {
              inline_data?: { data?: string; mime_type?: string };
              inlineData?: { data?: string; mimeType?: string };
            }[];
          };
        }[];
      };
      const part = body.candidates?.[0]?.content?.parts?.find(
        (item) => item.inline_data?.data || item.inlineData?.data,
      );
      const data = part?.inline_data?.data ?? part?.inlineData?.data;
      if (!data) throw new Error("لم يُرجع مزود الصورة أصلاً قابلاً للحفظ");
      return {
        bytes: Buffer.from(data, "base64"),
        contentType: part?.inline_data?.mime_type ?? part?.inlineData?.mimeType ?? "image/png",
        metadata: { model },
      };
    },
  };
}

export function scriptProvider(): ScriptProvider {
  const config = getVideoProviderConfig().script;
  const apiKey = config.apiKey;
  const model = config.model;
  if (!apiKey) throw new Error("LOVABLE_API_KEY غير مهيأ لتوليد السيناريو");
  return {
    async generate({ systemPrompt, userPrompt }) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!response.ok) throw new Error(safeProviderError(response.status));
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = body.choices?.[0]?.message?.content?.replace(/```json|```/gi, "").trim();
      if (!raw) throw new Error("لم يُرجع مزود النص سيناريو");
      return JSON.parse(raw) as unknown;
    },
  };
}

export function videoSceneProvider(): VideoSceneProvider {
  const config = getVideoProviderConfig().scene;
  const model = config.model;
  if (!config.lovableKey || !config.apiKey)
    throw new Error("يلزم LOVABLE_API_KEY وREPLICATE_API_KEY لتوليد المشاهد");
  const headers = {
    Authorization: `Bearer ${config.lovableKey}`,
    "X-Connection-Api-Key": config.apiKey,
    "Content-Type": "application/json",
  };
  const gateway = "https://connector-gateway.lovable.dev/replicate/v1";
  return {
    async submit(input) {
      const providerInput: Record<string, unknown> = {
        [config.promptField]: input.prompt,
        [config.imageField]: input.referenceImageUrl,
      };
      const supportedAspectRatio = ["16:9", "9:16"].includes(input.aspectRatio)
        ? input.aspectRatio
        : null;
      const framesPerSecond = config.useWanTimingControls
        ? wanFramesPerSecond(input.durationSeconds)
        : null;
      if (config.useWanTimingControls) {
        providerInput.num_frames = WAN_NUM_FRAMES;
        providerInput.frames_per_second = framesPerSecond;
        if (supportedAspectRatio) providerInput.aspect_ratio = supportedAspectRatio;
      }
      const response = await fetch(`${gateway}/models/${model}/predictions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ input: providerInput }),
      });
      if (!response.ok) throw new Error(safeProviderError(response.status));
      const body = (await response.json()) as { id?: string };
      if (!body.id) throw new Error("لم يُرجع مزود الفيديو رقم عملية");
      return {
        providerJobId: body.id,
        metadata: {
          model,
          requestedDurationSeconds: input.durationSeconds,
          sourceAspectRatio: input.aspectRatio,
          numFrames: config.useWanTimingControls ? WAN_NUM_FRAMES : null,
          framesPerSecond,
          approximateOutputDurationSeconds:
            framesPerSecond === null ? null : WAN_NUM_FRAMES / framesPerSecond,
          durationControl: config.useWanTimingControls ? "wan_frames_per_second" : "not_mapped",
          aspectRatioControl: config.useWanTimingControls
            ? supportedAspectRatio
              ? "explicit"
              : "provider_default_for_unsupported_1_1"
            : "not_mapped",
        },
      };
    },
    async poll(providerJobId) {
      const response = await fetch(`${gateway}/predictions/${encodeURIComponent(providerJobId)}`, {
        headers,
      });
      if (!response.ok) throw new Error(safeProviderError(response.status));
      const body = (await response.json()) as {
        status?: string;
        output?: string | string[];
      };
      if (["starting", "processing"].includes(body.status ?? "")) return { status: "running" };
      if (["failed", "canceled"].includes(body.status ?? ""))
        return {
          status: "failed",
          error: `فشل توليد المقطع لدى المزود (${body.status})`,
        };
      const url = Array.isArray(body.output) ? body.output[0] : body.output;
      if (body.status === "succeeded" && typeof url === "string")
        return { status: "succeeded", assetUrl: url, metadata: {} };
      return { status: "running" };
    },
  };
}
