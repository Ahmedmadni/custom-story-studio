export type VideoProviderConfig = ReturnType<typeof getVideoProviderConfig>;

const DEFAULT_VIDEO_SCENE_REPLICATE_MODEL = "wan-video/wan-2.2-5b-fast";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Server-only provider/model selection. Never import this module from a component. */
export function getVideoProviderConfig() {
  // Paid/usage-based generation stays explicitly disabled during product development.
  // Before public launch, enable it deliberately in server secrets/configuration.
  const providersEnabled = process.env.VIDEO_AI_PROVIDERS_ENABLED === "true";
  const lovableKey = providersEnabled ? process.env.LOVABLE_API_KEY : undefined;
  const geminiKey = providersEnabled ? process.env.GEMINI_API_KEY : undefined;
  const replicateKey = providersEnabled
    ? (process.env.REPLICATE_API_KEY ?? process.env.LOVABLE_CONNECTOR_REPLICATE_API_KEY)
    : undefined;
  const sceneReplicateModel =
    process.env.VIDEO_SCENE_REPLICATE_MODEL ?? DEFAULT_VIDEO_SCENE_REPLICATE_MODEL;

  return {
    providersEnabled,
    reference: {
      provider: "lovable" as const,
      fallbackProvider: "gemini" as const,
      lovable: {
        apiKey: lovableKey,
        model: process.env.VIDEO_REFERENCE_MODEL ?? "google/gemini-3.1-flash-image",
      },
      gemini: {
        apiKey: geminiKey,
        model: process.env.VIDEO_REFERENCE_GEMINI_MODEL ?? "gemini-2.5-flash-image",
      },
    },
    script: {
      provider: "lovable" as const,
      apiKey: lovableKey,
      model: process.env.VIDEO_SCRIPT_MODEL ?? "google/gemini-3-flash-preview",
    },
    scene: {
      // A direct Lovable video adapter is not implemented yet. Keep its model reserved,
      // but do not advertise the provider as available until an adapter actually exists.
      provider: "replicate" as const,
      lovable: {
        apiKey: undefined as string | undefined,
        model: process.env.VIDEO_SCENE_MODEL ?? "google/gemini-omni-1.1-flash",
      },
      replicate: {
        apiKey: replicateKey,
        lovableKey,
        model: sceneReplicateModel,
        useWanTimingControls: sceneReplicateModel === DEFAULT_VIDEO_SCENE_REPLICATE_MODEL,
        imageField: process.env.VIDEO_SCENE_IMAGE_FIELD ?? "image",
        promptField: process.env.VIDEO_SCENE_PROMPT_FIELD ?? "prompt",
      },
    },
    maxAttempts: positiveInteger(process.env.VIDEO_JOB_MAX_ATTEMPTS, 3),
    maxAssetBytes: positiveInteger(process.env.VIDEO_MAX_ASSET_BYTES, 100 * 1024 * 1024),
  };
}
