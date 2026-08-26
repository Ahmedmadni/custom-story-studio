/** Provider-independent Phase 4A contracts. Adapters and secrets remain server-only. */
export type ProviderAsset = {
  bytes: Uint8Array;
  contentType: string;
  metadata: Record<string, unknown>;
};

export type AsyncProviderJob = { providerJobId: string; metadata: Record<string, unknown> };
export type AsyncProviderResult =
  | { status: "running" }
  | { status: "failed"; error: string }
  | { status: "succeeded"; assetUrl: string; metadata: Record<string, unknown> };

export interface ReferenceImageProvider {
  generate(input: { prompt: string; sourceImage: Blob }): Promise<ProviderAsset>;
}

export interface ScriptProvider {
  generate(input: { systemPrompt: string; userPrompt: string }): Promise<unknown>;
}

export interface VideoSceneProvider {
  submit(input: {
    prompt: string;
    referenceImageUrl: string;
    aspectRatio: string;
    durationSeconds: number;
  }): Promise<AsyncProviderJob>;
  poll(providerJobId: string): Promise<AsyncProviderResult>;
}

export interface FinalRenderProvider {
  submit(input: { projectId: string; sceneAssetUrls: string[] }): Promise<AsyncProviderJob>;
  poll(providerJobId: string): Promise<AsyncProviderResult>;
}
