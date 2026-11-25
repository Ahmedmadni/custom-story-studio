import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { collections, sheets } from "../src/features/games/drawing/catalog";
import {
  fillArea,
  isMark,
  PAPER,
  PAPER_HEIGHT,
  type Mark,
} from "../src/features/games/drawing/paint";

describe("drawing studio", () => {
  it("has a local preview and printable-resolution outline for each gallery sheet", () => {
    expect(sheets.length).toBe(345);
    expect(collections.length).toBe(19);
    expect(sheets.filter((s) => s.id.startsWith("vector-")).length).toBe(75);
    expect(sheets.filter((s) => s.id.startsWith("attachment-")).length).toBe(19);
    expect(sheets.filter((s) => s.id.startsWith("batch-")).length).toBe(69);
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
  });
});
