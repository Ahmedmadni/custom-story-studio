import type { VideoSceneProvider } from "./provider-boundary";
import { getVideoProviderConfig } from "./provider-config.server";
import { providerHttpFailure, providerResultFailure } from "./provider-diagnostics.server";

/** One credit-backed job per explicit admin action, with private inline image input. */
export function lovableVideoSceneProvider(): VideoSceneProvider {
  const config = getVideoProviderConfig();
  const { apiKey, model } = config.scene.lovable;
  if (!apiKey) throw new Error("إنتاج الفيديو عبر Lovable غير مفعّل حالياً");
  const base = "https://ai.gateway.lovable.dev/v1/videos";
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  const context = (operation: "scene_generation" | "scene_poll") => ({ provider: "lovable" as const, operation, model });
  return {
    async submit(input) {
      if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 3 || input.durationSeconds > 10)
        throw new Error("مدة المشهد عبر Lovable يجب أن تكون من 3 إلى 10 ثوانٍ");
      if (!["16:9", "9:16"].includes(input.aspectRatio))
        throw new Error("اختر فيديو أفقياً 16:9 أو رأسياً 9:16");
      const imageResponse = await fetch(input.referenceImageUrl);
      if (!imageResponse.ok) throw new Error("تعذر قراءة الصورة المرجعية الخاصة");
      const mimeType = imageResponse.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) throw new Error("صيغة الصورة المرجعية غير مدعومة");
      const image = new Uint8Array(await imageResponse.arrayBuffer());
      if (image.byteLength > 10 * 1024 * 1024) throw new Error("الصورة المرجعية أكبر من الحجم المسموح");
      const response = await fetch(base, {
        method: "POST", headers,
        body: JSON.stringify({
          model,
          input: [
            { type: "text", text: `${input.prompt}\nUse the image as the exact child identity reference. In a single continuous shot, no scene cuts. No music, no dialogue; only gentle natural environmental sounds. Wholesome child-safe cinematic 3D animation.` },
            { type: "image", data: Buffer.from(image).toString("base64"), mime_type: mimeType },
          ],
          response_format: { type: "video", resolution: "720p", duration: `${input.durationSeconds}s`, aspect_ratio: input.aspectRatio },
        }),
      });
      if (!response.ok) throw await providerHttpFailure(response, context("scene_generation"));
      const job = await response.json() as { id?: string; status?: string; error?: { code?: string; message?: string } };
      if (job.status === "failed" || !job.id) throw providerResultFailure(context("scene_generation"), { httpStatus: 200, code: job.error?.code, message: job.error?.message ?? "Lovable لم يُرجع مهمة فيديو صالحة" });
      return { providerJobId: job.id, metadata: { provider: "lovable", model, requestedDurationSeconds: input.durationSeconds, sourceAspectRatio: input.aspectRatio, resolution: "720p" } };
    },
    async poll(id) {
      const response = await fetch(`${base}/${encodeURIComponent(id)}`, { headers });
      if (!response.ok) throw await providerHttpFailure(response, context("scene_poll"));
      const job = await response.json() as { status?: string; error?: { code?: string; message?: string } };
      if (job.status === "failed") throw providerResultFailure(context("scene_poll"), { code: job.error?.code, message: job.error?.message ?? "فشل إنتاج الفيديو عبر Lovable" });
      if (job.status !== "completed") return { status: "running" };
      const download = await fetch(`${base}/${encodeURIComponent(id)}/content`, { headers });
      if (!download.ok) throw await providerHttpFailure(download, context("scene_poll"));
      if (Number(download.headers.get("content-length") ?? 0) > config.maxAssetBytes) throw new Error("حجم مقطع الفيديو يتجاوز الحد المسموح");
      const bytes = new Uint8Array(await download.arrayBuffer());
      if (bytes.byteLength > config.maxAssetBytes) throw new Error("حجم مقطع الفيديو يتجاوز الحد المسموح");
      return { status: "succeeded", asset: { bytes, contentType: "video/mp4", metadata: { provider: "lovable", model } }, metadata: { provider: "lovable", model } };
    },
  };
}