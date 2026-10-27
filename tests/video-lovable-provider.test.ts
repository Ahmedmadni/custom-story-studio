import { afterEach, describe, expect, it } from "bun:test";
import { lovableVideoSceneProvider } from "../src/features/video/lovable-scene-provider.server";
import { getVideoProviderConfig } from "../src/features/video/provider-config.server";

const originalFetch = globalThis.fetch;
const oldKey = process.env.LOVABLE_API_KEY;
const oldGate = process.env.VIDEO_AI_PROVIDERS_ENABLED;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (oldKey === undefined) delete process.env.LOVABLE_API_KEY; else process.env.LOVABLE_API_KEY = oldKey;
  if (oldGate === undefined) delete process.env.VIDEO_AI_PROVIDERS_ENABLED; else process.env.VIDEO_AI_PROVIDERS_ENABLED = oldGate;
});

describe("Lovable credit-backed video", () => {
  it("requires only a Lovable key, not an external video key", () => {
    process.env.LOVABLE_API_KEY = "test-managed-key";
    process.env.VIDEO_AI_PROVIDERS_ENABLED = "true";
    expect(getVideoProviderConfig().scene.provider).toBe("lovable");
    expect(getVideoProviderConfig().scene.lovable.apiKey).toBe("test-managed-key");
    expect(lovableVideoSceneProvider()).toBeDefined();
  });

  it("submits inline reference media and downloads completed bytes with authorization", async () => {
    process.env.LOVABLE_API_KEY = "test-managed-key";
    process.env.VIDEO_AI_PROVIDERS_ENABLED = "true";
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("private-reference")) return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
      if (init?.method === "POST") return Response.json({ id: "video_test", status: "queued" });
      if (String(url).endsWith("/content")) return new Response(new Uint8Array([4, 5, 6]), { headers: { "content-type": "video/mp4" } });
      return Response.json({ id: "video_test", status: "completed" });
    }) as typeof fetch;
    const provider = lovableVideoSceneProvider();
    const job = await provider.submit({ prompt: "A cheerful child in a garden", referenceImageUrl: "https://private-reference/image", durationSeconds: 6, aspectRatio: "16:9" });
    expect(job.providerJobId).toBe("video_test");
    const request = JSON.parse(String(calls[1]?.init?.body));
    expect(calls[1]?.url).toBe("https://ai.gateway.lovable.dev/v1/videos");
    expect(request.response_format).toEqual({ type: "video", resolution: "720p", duration: "6s", aspect_ratio: "16:9" });
    expect(request.input[1]).toEqual({ type: "image", data: "AQID", mime_type: "image/png" });
    const result = await provider.poll(job.providerJobId);
    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded" || !("asset" in result)) throw new Error("No video bytes");
    expect(Array.from(result.asset.bytes)).toEqual([4, 5, 6]);
    expect(new Headers(calls[3]?.init?.headers).get("Authorization")).toBe("Bearer test-managed-key");
  });

  it("surfaces credit denial without retrying or contacting another provider", async () => {
    process.env.LOVABLE_API_KEY = "test-managed-key";
    process.env.VIDEO_AI_PROVIDERS_ENABLED = "true";
    let requests = 0;
    globalThis.fetch = (async () => { requests++; return Response.json({ message: "Add Lovable AI credits", type: "insufficient_credits" }, { status: 402 }); }) as typeof fetch;
    await expect(lovableVideoSceneProvider().poll("video_test")).rejects.toThrow("Add Lovable AI credits");
    expect(requests).toBe(1);
  });
});