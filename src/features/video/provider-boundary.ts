/**
 * Phase 3 provider seam. Implementations belong to a later provider-integration phase.
 * These contracts deliberately return provider-owned storage paths, never public URLs.
 */
export type ProviderAsset = { storagePath: string; metadata: Record<string, unknown> };

export interface ReferenceImageProvider {
  generate(input: { projectId: string; prompt: string }): Promise<ProviderAsset>;
}

export interface VideoScriptProvider {
  generate(input: { projectId: string; source: Record<string, unknown> }): Promise<unknown>;
}

export interface VideoSceneProvider {
  generate(input: { projectId: string; sceneId: string }): Promise<ProviderAsset>;
}

export interface FinalVideoProvider {
  compose(input: { projectId: string; sceneIds: string[] }): Promise<ProviderAsset>;
}

export const VIDEO_PROVIDERS_CONNECTED = false;
