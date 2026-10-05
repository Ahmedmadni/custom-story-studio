import { describe, expect, it } from "bun:test";

import {
  canRetryJob,
  operationKey,
  videoStoryboardSchema,
} from "../src/features/video/video-production-core";

const scene = (sequence: number, durationSeconds: number) => ({
  sequence,
  title: `Scene ${sequence}`,
  duration_seconds: durationSeconds,
  narration: "Short child-safe narration.",
  visual_prompt: "A warm cinematic Kidzy scene.",
  motion_prompt: "Gentle camera movement.",
});

describe("Kidzy Video storyboard validation", () => {
  it("accepts a contiguous storyboard within 60 seconds", () => {
    const result = videoStoryboardSchema.safeParse({
      title: "Test story",
      narration: "Full narration",
      scenes: [scene(1, 10), scene(2, 10), scene(3, 10), scene(4, 10)],
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-contiguous scene numbering", () => {
    const result = videoStoryboardSchema.safeParse({
      title: "Broken order",
      narration: "Full narration",
      scenes: [scene(1, 10), scene(3, 10)],
    });

    expect(result.success).toBe(false);
  });

  it("rejects total video duration above 60 seconds", () => {
    const result = videoStoryboardSchema.safeParse({
      title: "Too long",
      narration: "Full narration",
      scenes: [scene(1, 15), scene(2, 15), scene(3, 15), scene(4, 15), scene(5, 2)],
    });

    expect(result.success).toBe(false);
  });
});

describe("Kidzy Video job safety helpers", () => {
  it("uses deterministic operation keys", () => {
    expect(operationKey("scene_clip", "project-1", "scene-2")).toBe(
      "video:scene_clip:project-1:scene-2",
    );
  });

  it("allows retry only for terminal jobs below the attempt cap", () => {
    expect(canRetryJob("failed", 1, 3)).toBe(true);
    expect(canRetryJob("succeeded", 1, 3)).toBe(true);
    expect(canRetryJob("running", 1, 3)).toBe(false);
    expect(canRetryJob("failed", 3, 3)).toBe(false);
  });
});
