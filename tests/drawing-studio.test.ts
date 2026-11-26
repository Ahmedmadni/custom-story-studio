import { hsvFromColor, colorFromHsv } from "../src/features/games/drawing/color-plane";
import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import {
  createDrawingBackup,
  parseDrawingBackup,
  restoreDrawingBackup,
} from "../src/features/games/drawing/backup";
import { collections, sheets } from "../src/features/games/drawing/catalog";
import {
  colorShades,
  colorToHsl,
  DEFAULT_TOOL_SETTINGS,
  hslToColor,
  ignoreTouch,
  rememberColor,
  savedColors,
  savedToolSettings,
} from "../src/features/games/drawing/controls";
import {
  fillArea,
  isMark,
  PAPER,
  PAPER_HEIGHT,
  replay,
  sealOutlineGaps,
  smoothStroke,
  type Mark,
} from "../src/features/games/drawing/paint";
import { drawingStorageKey, hasSavedArtwork } from "../src/features/games/drawing/progress";

describe("drawing studio", () => {
  it("exports and restores saved drawings without replacing existing work by default", () => {
    const old: Mark = { tool: "pencil", color: "#112233", size: 12, points: [[2, 3]] };
    const newer: Mark = { ...old, color: "#ff0000" };
    const source = new Map([["kidzy:desk:v1:blank", JSON.stringify([newer])]]);
    const storage = (data: Map<string, string>) => ({
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    });
    const backup = createDrawingBackup(storage(source), ["blank", "dinosaurs-01"]);
    backup.drawings["dinosaurs-01"] = [newer];
    const parsed = parseDrawingBackup(JSON.stringify(backup), ["blank", "dinosaurs-01"]);
    const destination = new Map([["kidzy:desk:v1:blank", JSON.stringify([old])]]);
    expect(restoreDrawingBackup(storage(destination), parsed, false)).toBe(1);
    expect(JSON.parse(destination.get("kidzy:desk:v1:blank")!)).toEqual([old]);
    expect(JSON.parse(destination.get("kidzy:desk:v1:dinosaurs-01")!)).toEqual([newer]);
    expect(restoreDrawingBackup(storage(destination), parsed, true)).toBe(2);
    expect(JSON.parse(destination.get("kidzy:desk:v1:blank")!)).toEqual([newer]);
    expect(() => parseDrawingBackup(JSON.stringify(backup), ["blank"])).toThrow();
    expect(() =>
      parseDrawingBackup(
        JSON.stringify({ ...backup, drawings: { blank: [{ ...old, points: [] }] } }),
        ["blank"],
      ),
    ).toThrow();
  });

  it("rolls back an import when saving the next drawing runs out of space", () => {
    const old: Mark = { tool: "pencil", color: "#112233", size: 12, points: [[2, 3]] };
    const newer: Mark = { ...old, color: "#ff0000" };
    const data = new Map([["kidzy:desk:v1:blank", JSON.stringify([old])]]);
    let failOnce = true;
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key.endsWith("dinosaurs-01") && failOnce) {
          failOnce = false;
          throw new Error("Quota exceeded");
        }
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    };
    const backup = parseDrawingBackup(
      JSON.stringify({
        app: "kidzy-drawing",
        version: 1,
        exportedAt: "2026-11-26T00:00:00Z",
        drawings: { blank: [newer], "dinosaurs-01": [newer] },
      }),
      ["blank", "dinosaurs-01"],
    );
    expect(() => restoreDrawingBackup(storage, backup, true)).toThrow();
    expect(JSON.parse(data.get("kidzy:desk:v1:blank")!)).toEqual([old]);
    expect(data.has("kidzy:desk:v1:dinosaurs-01")).toBe(false);
  });
  it("preserves custom colors across the spectrum and remembers the hue at neutral tones", () => {
    for (const hex of [
      "#ffffff",
      "#000000",
      "#567499",
      "#00ff00",
      "#ff00ff",
      "#ff0033",
      "#898989",
    ]) {
      expect(colorFromHsv(hsvFromColor(hex))).toBe(hex);
    }
    expect(hsvFromColor("#111111", 187).hue).toBe(187);
    expect(colorFromHsv({ hue: 360, saturation: 1, value: 1 })).toBe("#ff0000");
  });
  it("finds saved color after undo, clear, and recolor without treating a blank page as progress", () => {
    const paint: Mark = { tool: "pencil", color: "#112233", size: 24, points: [[200, 300]] };
    const clear: Mark = { tool: "clear", color: "#ffffff", size: 1, points: [[0, 0]] };
    const erase: Mark = { ...paint, tool: "eraser" };
    expect(drawingStorageKey("blank")).toBe("kidzy:desk:v1:blank");
    expect(hasSavedArtwork(null)).toBe(false);
    expect(hasSavedArtwork(JSON.stringify([paint]))).toBe(true);
    expect(hasSavedArtwork(JSON.stringify([paint, clear]))).toBe(false);
    expect(hasSavedArtwork(JSON.stringify([paint, clear, erase]))).toBe(false);
    expect(hasSavedArtwork(JSON.stringify([paint, clear, erase, paint]))).toBe(true);
    expect(hasSavedArtwork(JSON.stringify([paint, { ...paint, points: [] }]))).toBe(false);
    expect(hasSavedArtwork("not json")).toBe(false);
  });
  it("keeps individual tool presets and rejects corrupted saved settings", () => {
    const settings = savedToolSettings({
      brush: { size: 47, opacity: 60 },
      pencil: { size: -1, opacity: "100" },
      watercolor: { size: 30, opacity: 140 },
    });
    expect(settings.brush).toEqual({ size: 47, opacity: 60 });
    expect(settings.pencil).toEqual(DEFAULT_TOOL_SETTINGS.pencil);
    expect(settings.watercolor).toEqual({ size: 30, opacity: 65 });
    expect(savedToolSettings([]).oil).toEqual(DEFAULT_TOOL_SETTINGS.oil);
    expect(settings.brush).not.toBe(DEFAULT_TOOL_SETTINGS.brush);
  });
  it("converts palette colors and preserves the chosen color among ordered shades", () => {
    expect(colorToHsl("#ff0000")).toEqual({ hue: 0, saturation: 100, lightness: 50 });
    expect(hslToColor({ hue: 120, saturation: 100, lightness: 50 })).toBe("#00ff00");
    expect(hslToColor({ hue: 240, saturation: 100, lightness: 50 })).toBe("#0000ff");
    expect(hslToColor({ hue: 0, saturation: 100, lightness: 0 })).toBe("#000000");
    expect(hslToColor({ hue: 0, saturation: 100, lightness: 100 })).toBe("#ffffff");
    for (const color of ["#f8b8d3", "#583a32", "#ffffff", "#000000"]) {
      const shades = colorShades(color);
      expect(shades).toContain(color);
      expect(new Set(shades).size).toBe(shades.length);
      expect(shades.map((shade) => colorToHsl(shade).lightness)).toEqual(
        [...shades].map((shade) => colorToHsl(shade).lightness).sort((a, b) => a - b),
      );
    }
  });
  it("keeps recent colors valid, unique and ordered across sessions", () => {
    expect(rememberColor(["#AABBCC", "#112233"], "#aabbcc")).toEqual(["#aabbcc", "#112233"]);
    expect(savedColors(["#AABBCC", "invalid", 1, "#aabbcc", "#112233"])).toEqual([
      "#aabbcc",
      "#112233",
    ]);
    expect(savedColors({ colors: ["#aabbcc"] })).toEqual([]);
  });
  it("blocks palm touches near the stylus and permits deliberate finger panning", () => {
    expect(ignoreTouch("touch", false, 1000, 1600, false)).toBe(true);
    expect(ignoreTouch("touch", false, 1000, 1800, false)).toBe(false);
    expect(ignoreTouch("touch", true, 1000, 1800, false)).toBe(true);
    expect(ignoreTouch("touch", true, 1000, 1100, true)).toBe(false);
    expect(ignoreTouch("mouse", true, 1000, 1100, false)).toBe(false);
  });
  it("has a local preview and printable-resolution outline for each gallery sheet", () => {
    expect(sheets.length).toBe(376);
    expect(collections.length).toBe(20);
    expect(sheets.filter((s) => s.id.startsWith("vector-")).length).toBe(75);
    expect(sheets.filter((s) => s.id.startsWith("attachment-")).length).toBe(19);
    expect(sheets.filter((s) => s.id.startsWith("batch-")).length).toBe(69);
    expect(sheets.filter((s) => s.id.startsWith("archive-")).length).toBe(31);
    expect(new Set(sheets.map((s) => s.id)).size).toBe(sheets.length);
    for (const group of collections) {
      expect(sheets.some((s) => s.id === group.cover && s.group === group.id)).toBe(true);
    }
    for (const sheet of sheets) {
      for (const suffix of [".webp", "-cover.webp"]) {
        expect(existsSync(new URL("../public/drawing/" + sheet.id + suffix, import.meta.url))).toBe(
          true,
        );
      }
    }
  });
  it("contains bucket fills and ignores repeated fills on the same color or an outline", () => {
    const boundary = new Uint8Array(PAPER * PAPER_HEIGHT).fill(1);
    // One pocket touches the left edge. Another sits at the end of the preceding row.
    const start = 2 * PAPER;
    [start - 1, start, start + 1, start + PAPER].forEach((i) => {
      boundary[i] = 0;
    });
    const data = new Uint8ClampedArray(4 * boundary.length);
    const ctx = {
      getImageData: () => ({ data }),
      putImageData: () => {},
    } as unknown as CanvasRenderingContext2D;
    const mark: Mark = { tool: "fill", color: "#ef4444", size: 10, points: [[0, 2]] };
    expect(fillArea(ctx, boundary, mark)).toBe(true);
    for (const index of [start, start + 1, start + PAPER]) {
      expect([...data.slice(4 * index, 4 * index + 4)]).toEqual([239, 68, 68, 255]);
    }
    expect(data[(start - 1) * 4 + 3]).toBe(0);
    expect(fillArea(ctx, boundary, mark)).toBe(false);
    expect(fillArea(ctx, boundary, { ...mark, points: [[2, 2]] })).toBe(false);
  });
  it("controls bucket spread without crossing the original outline", () => {
    const boundary = new Uint8Array(PAPER * PAPER_HEIGHT).fill(1);
    const start = PAPER + 20;
    for (let index = start; index <= start + 2; index++) boundary[index] = 0;
    const mark: Mark = {
      tool: "fill",
      color: "#ef4444",
      size: 10,
      points: [[20, 1]],
      tolerance: 8,
    };
    const data = new Uint8ClampedArray(4 * boundary.length);
    data.set([235, 235, 235, 255], 4 * (start + 1));
    data.set([215, 215, 215, 255], 4 * (start + 2));
    const ctx = {
      getImageData: () => ({ data }),
      putImageData: () => {},
    } as unknown as CanvasRenderingContext2D;
    expect(fillArea(ctx, boundary, mark)).toBe(true);
    expect(data[4 * (start + 1)]).toBe(235);
    expect(fillArea(ctx, boundary, { ...mark, points: [[21, 1]], tolerance: 56 })).toBe(true);
    expect(data[4 * (start + 2)]).toBe(239);
    expect(data[4 * (start + 3) + 3]).toBe(0);
    expect(isMark(mark)).toBe(true);
    expect(isMark({ ...mark, tolerance: 81 })).toBe(false);
    expect(isMark({ ...mark, tool: "brush" })).toBe(false);
  });
  it("removes color from one enclosed area and replays erase and recolor", () => {
    const boundary = new Uint8Array(PAPER * PAPER_HEIGHT).fill(1);
    const start = PAPER + 20;
    boundary[start] = boundary[start + 1] = 0;
    const data = new Uint8ClampedArray(4 * boundary.length);
    const ctx = {
      getImageData: () => ({ data }),
      putImageData: () => {},
      clearRect: () => data.fill(0),
    } as unknown as CanvasRenderingContext2D;
    const paint: Mark = {
      tool: "fill",
      color: "#ef4444",
      size: 10,
      points: [[20, 1]],
      tolerance: 28,
    };
    const erase: Mark = { ...paint, fillMode: "erase" };
    const recolor: Mark = { ...paint, color: "#2255cc" };
    expect(fillArea(ctx, boundary, paint)).toBe(true);
    expect(fillArea(ctx, boundary, erase)).toBe(true);
    expect(data[4 * start + 3]).toBe(0);
    expect(data[4 * (start + 1) + 3]).toBe(0);
    expect(fillArea(ctx, boundary, erase)).toBe(false);
    replay(ctx, boundary, [paint, erase, recolor]);
    expect([...data.slice(4 * start, 4 * start + 4)]).toEqual([34, 85, 204, 255]);
    expect(data[4 * (start + 2) + 3]).toBe(0);
    expect(isMark(erase)).toBe(true);
    expect(isMark({ ...erase, fillMode: "other" })).toBe(false);
    expect(isMark({ ...erase, tool: "brush" })).toBe(false);
  });
  it("rejects malformed or out-of-bounds saved marks before replay", () => {
    const mark = { tool: "pencil", color: "#112233", size: 24, points: [[200, 300]] };
    expect(isMark(mark)).toBe(true);
    expect(isMark({ ...mark, points: [[PAPER, 0]] })).toBe(false);
    expect(isMark({ ...mark, points: [[0, PAPER_HEIGHT]] })).toBe(false);
    expect(isMark({ ...mark, points: [] })).toBe(false);
    expect(isMark({ ...mark, color: "unknown" })).toBe(false);
    expect(isMark({ ...mark, tool: "oil", opacity: 0.8, pressures: [0.4] })).toBe(true);
    expect(isMark({ ...mark, tool: "watercolor", opacity: 0.45 })).toBe(true);
    expect(isMark({ ...mark, opacity: 0 })).toBe(false);
    expect(isMark({ ...mark, pressures: [0.2, 0.5] })).toBe(false);
    expect(isMark({ ...mark, pressures: [2] })).toBe(false);
    expect(isMark({ ...mark, tool: "clear", points: [[0, 0]] })).toBe(true);
  });
  it("draws translucent strokes as whole paths and replays a reversible clear", () => {
    const actions: string[] = [];
    const ctx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => actions.push("point"),
      stroke: () => actions.push("stroke"),
      arc: () => {},
      fill: () => actions.push("fill"),
      clearRect: () => actions.push("clear"),
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;
    const path: Mark = {
      tool: "marker",
      color: "#ef4444",
      size: 24,
      points: [
        [10, 10],
        [20, 20],
        [30, 25],
      ],
    };
    smoothStroke(ctx, path);
    expect(actions).toEqual(["point", "point", "stroke"]);
    actions.length = 0;
    smoothStroke(ctx, { ...path, tool: "watercolor" });
    expect(actions).toEqual(["point", "point", "stroke", "point", "point", "stroke"]);
    actions.length = 0;
    const clear: Mark = { tool: "clear", color: "#ffffff", size: 1, points: [[0, 0]] };
    replay(ctx, new Uint8Array(PAPER * PAPER_HEIGHT), [path, clear, path]);
    expect(actions).toEqual([
      "clear",
      "point",
      "point",
      "stroke",
      "clear",
      "point",
      "point",
      "stroke",
    ]);
  });
  it("seals one and two pixel gaps in a bucket barrier without altering its source", () => {
    const width = 7;
    const mask = new Uint8Array(width * 7);
    for (const y of [0, 1, 4, 5, 6]) mask[y * width + 3] = 1;
    const sealed = sealOutlineGaps(mask, width, 7);
    expect(sealed[2 * width + 3]).toBe(1);
    expect(sealed[3 * width + 3]).toBe(1);
    expect(mask[2 * width + 3]).toBe(0);
    expect(sealed[2 * width + 2]).toBe(0);
  });
});
