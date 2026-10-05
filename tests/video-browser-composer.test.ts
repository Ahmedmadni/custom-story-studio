import { describe, expect, it } from "bun:test";

import {
  coverRect,
  finalCanvasSize,
} from "../src/features/video/browser-final-composer";

describe("Kidzy browser final composer geometry", () => {
  it("uses deterministic HD canvases for launch aspect ratios", () => {
    expect(finalCanvasSize("16:9")).toEqual({ width: 1280, height: 720 });
    expect(finalCanvasSize("9:16")).toEqual({ width: 720, height: 1280 });
  });

  it("rejects unsupported final ratios", () => {
    expect(() => finalCanvasSize("1:1")).toThrow();
  });

  it("covers the target canvas without stretching the source", () => {
    expect(coverRect(1920, 1080, 1280, 720)).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });

    const portraitOnLandscape = coverRect(1080, 1920, 1280, 720);
    expect(portraitOnLandscape.width).toBeCloseTo(1280);
    expect(portraitOnLandscape.height).toBeGreaterThan(720);
    expect(portraitOnLandscape.x).toBeCloseTo(0);
    expect(portraitOnLandscape.y).toBeLessThan(0);
  });
});
