import { describe, expect, it } from "bun:test";

import {
  fitNarrationToDuration,
  narrationWordBudget,
  sceneDirection,
  storyArcRole,
} from "../src/features/video/video-storyboard-adapter";

describe("Kidzy storyboard pacing", () => {
  it("uses a slower Arabic narration budget than English", () => {
    expect(narrationWordBudget(8, "ar")).toBeLessThan(narrationWordBudget(8, "en"));
  });

  it("trims narration to the scene duration budget", () => {
    const text =
      "في صباح جميل خرج الطفل إلى الحديقة ثم قابل صديقه وبدأت مغامرة طويلة مليئة بالمفاجآت والضحك والتعلم والشجاعة";
    const fitted = fitNarrationToDuration(text, 6, "ar", "يبدأ الطفل مغامرته.");
    expect(fitted.split(/\s+/).length).toBeLessThanOrEqual(narrationWordBudget(6, "ar"));
  });

  it("keeps a complete short narration unchanged", () => {
    expect(fitNarrationToDuration("بدأت المغامرة بسعادة.", 8, "ar", "بديل")).toBe(
      "بدأت المغامرة بسعادة.",
    );
  });
});

describe("Kidzy storyboard arc", () => {
  it("always starts with an opening and ends with a resolution", () => {
    expect(storyArcRole(0, 6)).toBe("opening");
    expect(storyArcRole(5, 6)).toBe("resolution");
  });

  it("reserves the penultimate beat for the climax", () => {
    expect(storyArcRole(4, 6)).toBe("climax");
    expect(sceneDirection("climax")).toContain("Climax");
  });
});
