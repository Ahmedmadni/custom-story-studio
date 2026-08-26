import { z } from "zod";

import { MAX_VIDEO_DURATION_MS } from "@/features/video/contracts";

export const storyboardSceneSchema = z
  .object({
    sequence: z.number().int().min(1).max(20),
    title: z.string().trim().min(1).max(120),
    duration_seconds: z.number().int().min(2).max(15),
    narration: z.string().trim().min(1).max(1_500),
    visual_prompt: z.string().trim().min(1).max(4_000),
    motion_prompt: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const videoStoryboardSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    narration: z.string().trim().min(1).max(8_000),
    scenes: z.array(storyboardSceneSchema).min(2).max(12),
  })
  .strict()
  .superRefine((storyboard, context) => {
    const sequences = storyboard.scenes.map((scene) => scene.sequence);
    if (
      new Set(sequences).size !== sequences.length ||
      sequences.some((value, i) => value !== i + 1)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scene sequence must be contiguous",
      });
    }
    if (
      storyboard.scenes.reduce((sum, scene) => sum + scene.duration_seconds * 1_000, 0) >
      MAX_VIDEO_DURATION_MS
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Video duration exceeds 60 seconds",
      });
    }
  });

export type VideoStoryboard = z.infer<typeof videoStoryboardSchema>;
export const activeVideoJobStatuses = ["queued", "running"] as const;
export const operationKey = (jobType: string, projectId: string, sceneId?: string | null) =>
  `video:${jobType}:${projectId}:${sceneId ?? "project"}`;
export const canRetryJob = (status: string, attempts: number, maxAttempts: number) =>
  ["failed", "dead_letter", "succeeded"].includes(status) && attempts < maxAttempts;
