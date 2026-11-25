import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { collections, sheets } from "../src/features/games/drawing/catalog";
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

describe("drawing studio", () => {
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
