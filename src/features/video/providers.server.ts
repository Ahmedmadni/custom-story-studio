import type {
  ReferenceImageProvider,
  ScriptProvider,
  VideoSceneProvider,
} from "@/features/video/provider-boundary";
import { getVideoProviderConfig } from "@/features/video/provider-config.server";
import {
  providerHttpFailure,
  providerResultFailure,
} from "@/features/video/provider-diagnostics.server";

const WAN_NUM_FRAMES = 81;

function wanFramesPerSecond(desiredDurationSeconds: number) {
  return Math.min(30, Math.max(5, Math.round(WAN_NUM_FRAMES / desiredDurationSeconds)));
}

/** Lovable AI Gateway is the first-choice image provider. */
function lovableReferenceImageProvider(): ReferenceImageProvider {
  const config = getVideoProviderConfig().reference;
  const apiKey = config.lovable.apiKey;
  const model = config.lovable.model;
  if (!apiKey) throw new Error("LOVABLE_API_KEY غير مهيأ لتوليد الصورة المرجعية");
  return {
    async generate({ prompt, sourceImage }) {
      const bytes = Buffer.from(await sourceImage.arrayBuffer());
      const dataUrl = `data:${sourceImage.type || "image/jpeg"};base64,${bytes.toString("base64")}`;
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      });
      if (!response.ok)
        throw await providerHttpFailure(response, {
          provider: "lovable",
          operation: "reference_image",
          model,
        });
      const body = (await response.json()) as {
        choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
      };
      const outputUrl = body.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!outputUrl?.includes("base64,"))
        throw providerResultFailure(
          { provider: "lovable", operation: "reference_image", model },
          {
            httpStatus: 200,
            type: "missing_image_output",
            message: "Lovable AI response did not include an image",
          },
        );
      const [meta, base64] = outputUrl.split("base64,");
      return {
        bytes: Buffer.from(base64, "base64"),
        contentType: meta.slice(5).replace(/[;,]$/, "") || "image/png",
        metadata: { model, provider: "lovable" },
      };
    },
  };
}

function geminiReferenceImageProvider(): ReferenceImageProvider {
  const config = getVideoProviderConfig().reference;
  const apiKey = config.gemini.apiKey;
  const model = config.gemini.model;
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
      if (!response.ok)
        throw await providerHttpFailure(response, {
          provider: "gemini",
          operation: "reference_image",
          model,
        });
      let body: {
        candidates?: {
          content?: {
            parts?: {
              inline_data?: { data?: string; mime_type?: string };
              inlineData?: { data?: string; mimeType?: string };
            }[];
          };
        }[];
      };
      try {
        body = (await response.json()) as typeof body;
      } catch {
        throw providerResultFailure(
          { provider: "gemini", operation: "reference_image", model },
          {
            httpStatus: response.status,
            type: "invalid_json_output",
            message: "Gemini response was not valid JSON",
          },
        );
      }
      const part = body.candidates?.[0]?.content?.parts?.find(
        (item) => item.inline_data?.data || item.inlineData?.data,
      );
      const data = part?.inline_data?.data ?? part?.inlineData?.data;
      if (!data)
        throw providerResultFailure(
          { provider: "gemini", operation: "reference_image", model },
          {
            httpStatus: 200,
            type: "missing_image_output",
            message: "Gemini response did not include inline image data",
          },
        );
      return {
        bytes: Buffer.from(data, "base64"),
        contentType: part?.inline_data?.mime_type ?? part?.inlineData?.mimeType ?? "image/png",
        metadata: { model, provider: "gemini" },
      };
    },
  };
}

/**
 * Select an implemented reference-image adapter.
 * Lovable is preferred when configured; Gemini is only a configuration fallback.
 * Runtime provider failures are not silently retried against a second paid provider.
 */
export function referenceImageProvider(): ReferenceImageProvider {
  const config = getVideoProviderConfig().reference;
  if (config.lovable.apiKey) return lovableReferenceImageProvider();
  if (config.gemini.apiKey) return geminiReferenceImageProvider();
  throw new Error("لا يوجد مزود صور مرجعية مهيأ حالياً");
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
      if (!response.ok)
        throw await providerHttpFailure(response, {
          provider: "lovable",
          operation: "script_generation",
          model,
        });
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = body.choices?.[0]?.message?.content?.replace(/```json|```/gi, "").trim();
      if (!raw) throw new Error("لم يُرجع مزود النص سيناريو");
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        throw providerResultFailure(
          { provider: "lovable", operation: "script_generation", model },
          {
            httpStatus: 200,
            type: "invalid_json_output",
            message: "Script provider returned invalid JSON",
          },
        );
      }
    },
  };
}

export function videoSceneProvider(): VideoSceneProvider {
  const config = getVideoProviderConfig().scene;
  const replicate = config.replicate;
  const model = replicate.model;
  if (!replicate.lovableKey || !replicate.apiKey)
    throw new Error("يلزم LOVABLE_API_KEY وREPLICATE_API_KEY لتوليد المشاهد");
  const headers = {
    Authorization: `Bearer ${replicate.lovableKey}`,
    "X-Connection-Api-Key": replicate.apiKey,
    "Content-Type": "application/json",
  };
  const gateway = "https://connector-gateway.lovable.dev/replicate/v1";
  return {
    async submit(input) {
      const providerInput: Record<string, unknown> = {
        [replicate.promptField]: input.prompt,
        [replicate.imageField]: input.referenceImageUrl,
      };
      const supportedAspectRatio = ["16:9", "9:16"].includes(input.aspectRatio)
        ? input.aspectRatio
        : null;
      const framesPerSecond = replicate.useWanTimingControls
        ? wanFramesPerSecond(input.durationSeconds)
        : null;
      if (replicate.useWanTimingControls) {
        providerInput.num_frames = WAN_NUM_FRAMES;
        providerInput.frames_per_second = framesPerSecond;
        if (supportedAspectRatio) providerInput.aspect_ratio = supportedAspectRatio;
      }
      const response = await fetch(`${gateway}/models/${model}/predictions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ input: providerInput }),
      });
      if (!response.ok)
        throw await providerHttpFailure(response, {
          provider: "replicate",
          operation: "scene_generation",
          model,
        });
      const body = (await response.json()) as { id?: string };
      if (!body.id)
        throw providerResultFailure(
          { provider: "replicate", operation: "scene_generation", model },
          {
            httpStatus: 200,
            type: "missing_prediction_id",
            message: "Replicate response did not include a prediction id",
          },
        );
      return {
        providerJobId: body.id,
        metadata: {
          model,
          requestedDurationSeconds: input.durationSeconds,
          sourceAspectRatio: input.aspectRatio,
          numFrames: replicate.useWanTimingControls ? WAN_NUM_FRAMES : null,
          framesPerSecond,
          approximateOutputDurationSeconds:
            framesPerSecond === null ? null : WAN_NUM_FRAMES / framesPerSecond,
          durationControl: replicate.useWanTimingControls ? "wan_frames_per_second" : "not_mapped",
          aspectRatioControl: replicate.useWanTimingControls
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
      if (!response.ok)
        throw await providerHttpFailure(response, {
          provider: "replicate",
          operation: "scene_poll",
          model,
        });
      const body = (await response.json()) as {
        status?: string;
        output?: string | string[];
        error?: unknown;
      };
      if (["starting", "processing"].includes(body.status ?? "")) return { status: "running" };
      if (["failed", "canceled"].includes(body.status ?? ""))
        throw providerResultFailure(
          { provider: "replicate", operation: "scene_poll", model },
          {
            type: body.status ?? "failed",
            message:
              typeof body.error === "string"
                ? body.error
                : `Replicate prediction ended with status ${body.status}`,
          },
        );
      const url = Array.isArray(body.output) ? body.output[0] : body.output;
      if (body.status === "succeeded" && typeof url === "string")
        return { status: "succeeded", assetUrl: url, metadata: {} };
      return { status: "running" };
    },
  };
}
