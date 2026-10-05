import { describe, expect, it } from "bun:test";

import {
  normalizeAudioUploadMime,
  normalizeVideoUploadMime,
} from "../src/features/video/media-mime";

describe("Kidzy Video browser MIME normalization", () => {
  it("strips MediaRecorder codec parameters from WebM", () => {
    expect(
      normalizeVideoUploadMime({
        type: "video/webm;codecs=vp9,opus",
        name: "kidzy-final.webm",
      }),
    ).toBe("video/webm");
  });

  it("strips codec parameters from MP4 recorders", () => {
    expect(
      normalizeVideoUploadMime({
        type: "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        name: "kidzy-final.mp4",
      }),
    ).toBe("video/mp4");
  });

  it("falls back to safe video extensions when browsers omit MIME type", () => {
    expect(normalizeVideoUploadMime({ type: "", name: "scene.MOV" })).toBe("video/quicktime");
    expect(normalizeVideoUploadMime({ type: "", name: "scene.m4v" })).toBe("video/mp4");
  });

  it("normalizes narration audio with parameters", () => {
    expect(
      normalizeAudioUploadMime({
        type: "audio/webm;codecs=opus",
        name: "narration.webm",
      }),
    ).toBe("audio/webm");
  });

  it("rejects unsupported media", () => {
    expect(() => normalizeVideoUploadMime({ type: "video/x-msvideo", name: "scene.avi" })).toThrow();
    expect(() => normalizeAudioUploadMime({ type: "audio/flac", name: "voice.flac" })).toThrow();
  });
});
