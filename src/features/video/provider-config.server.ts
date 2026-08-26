export type VideoProviderConfig = ReturnType<typeof getVideoProviderConfig>;

const DEFAULT_VIDEO_SCENE_MODEL = "wan-video/wan-2.2-5b-fast";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Server-only provider/model selection. Never import this module from a component. */
export function getVideoProviderConfig() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const replicateKey =
    process.env.REPLICATE_API_KEY ?? process.env.LOVABLE_CONNECTOR_REPLICATE_API_KEY;
  const sceneModel = process.env.VIDEO_SCENE_REPLICATE_MODEL ?? DEFAULT_VIDEO_SCENE_MODEL;
  return {
    reference: {
      provider: "gemini" as const,
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.VIDEO_REFERENCE_MODEL ?? "gemini-2.5-flash-image",
    },
    script: {
      provider: "lovable" as const,
      apiKey: lovableKey,
      model: process.env.VIDEO_SCRIPT_MODEL ?? "google/gemini-3-flash-preview",
    },
    scene: {
      provider: "replicate" as const,
      lovableKey,
      apiKey: replicateKey,
      model: sceneModel,
      useWanTimingControls: sceneModel === DEFAULT_VIDEO_SCENE_MODEL,
      // These two overrides keep alternative Replicate models possible without guessing
      // unsupported duration or aspect-ratio controls for the Wan MVP default.
      imageField: process.env.VIDEO_SCENE_IMAGE_FIELD ?? "image",
      promptField: process.env.VIDEO_SCENE_PROMPT_FIELD ?? "prompt",
    },
    maxAttempts: positiveInteger(process.env.VIDEO_JOB_MAX_ATTEMPTS, 3),
    maxAssetBytes: positiveInteger(process.env.VIDEO_MAX_ASSET_BYTES, 100 * 1024 * 1024),
  };
}
