/**
 * Contracts only. Phase 3 deliberately provides no implementation and never
 * reports generated media as successful without a real provider job.
 */
export type VideoProviderRequest = {
  projectId: string;
  idempotencyKey: string;
};

export interface ReferenceImageProvider {
  requestReferenceImage(input: VideoProviderRequest): Promise<{ providerJobId: string }>;
}

export interface VideoScriptProvider {
  requestScript(input: VideoProviderRequest): Promise<{ providerJobId: string }>;
}

export interface VideoSceneProvider {
  requestScene(
    input: VideoProviderRequest & { sceneId: string },
  ): Promise<{ providerJobId: string }>;
}

export interface VideoRenderProvider {
  requestFinalRender(input: VideoProviderRequest): Promise<{ providerJobId: string }>;
}
