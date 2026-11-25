export const PAPER = 900;
export type Tool = "pencil" | "brush" | "crayon" | "fill" | "eraser";
export type Point = [number, number];
export interface Mark {
  tool: Tool;
  color: string;
  size: number;
  points: Point[];
}

export function isMark(value: unknown): value is Mark {
  if (!value || typeof value !== "object") return false;
  const mark = value as Partial<Mark>;
  return (
    ["pencil", "brush", "crayon", "fill", "eraser"].includes(String(mark.tool)) &&
    typeof mark.color === "string" &&
    /^#[0-9a-f]{6}$/i.test(mark.color) &&
    typeof mark.size === "number" &&
    mark.size >= 1 &&
    mark.size <= 80 &&
    Array.isArray(mark.points) &&
    mark.points.length > 0 &&
    mark.points.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((v) => Number.isInteger(v) && v >= 0 && v < PAPER),
    )
  );
}

const patterns = new Map<string, CanvasPattern>();
function crayon(ctx: CanvasRenderingContext2D, color: string) {
  const existing = patterns.get(color);
  if (existing) return existing;
  const tile = document.createElement("canvas");
  tile.width = tile.height = 32;
  const grain = tile.getContext("2d")!;
  grain.fillStyle = color;
  let seed = 137;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      grain.globalAlpha = seed / 4294967296 > 0.24 ? 0.9 : 0.12;
      grain.fillRect(x, y, 1, 1);
    }
  }
  const pattern = ctx.createPattern(tile, "repeat")!;
  if (patterns.size >= 24) patterns.clear();
  patterns.set(color, pattern);
  return pattern;
}

// Live strokes and history replay use the same segments, including single taps.
export function segment(ctx: CanvasRenderingContext2D, mark: Mark, a: Point, b: Point) {
  ctx.save();
  ctx.globalCompositeOperation = mark.tool === "eraser" ? "destination-out" : "source-over";
  const ink = mark.tool === "crayon" ? crayon(ctx, mark.color) : mark.color;
  ctx.fillStyle = ctx.strokeStyle = ink;
  ctx.lineWidth = mark.size * (mark.tool === "pencil" ? 0.45 : 1);
  ctx.lineCap = "round";
  ctx.beginPath();
  if (a[0] === b[0] && a[1] === b[1]) {
    ctx.arc(a[0], a[1], ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
  }
  ctx.restore();
}

// Compare the visible paint on white paper. The outline is an independent barrier,
// so an eraser or a bucket can never destroy the original drawing.
export function fillArea(ctx: CanvasRenderingContext2D, outline: Uint8Array, mark: Mark) {
  const [x, y] = mark.points[0];
  const start = y * PAPER + x;
  if (outline[start]) return false;
  const pixels = ctx.getImageData(0, 0, PAPER, PAPER);
  const rgba = pixels.data;
  const rgb = [1, 3, 5].map((i) => parseInt(mark.color.slice(i, i + 2), 16));
  const visible = (i: number, channel: number) =>
    255 - ((255 - rgba[4 * i + channel]) * rgba[4 * i + 3]) / 255;
  const target = rgb.map((_, channel) => visible(start, channel));
  if (target.every((v, c) => Math.abs(v - rgb[c]) < 1)) return false;
  const seen = new Uint8Array(outline.length);
  const queue = new Int32Array(outline.length);
  let end = 1;
  queue[0] = start;
  seen[start] = 1;
  function visit(i: number) {
    if (seen[i] || outline[i]) return;
    seen[i] = 1;
    for (let c = 0; c < 3; c++) if (Math.abs(visible(i, c) - target[c]) > 28) return;
    queue[end++] = i;
  }
  for (let next = 0; next < end; next++) {
    const i = queue[next];
    rgba[4 * i] = rgb[0];
    rgba[4 * i + 1] = rgb[1];
    rgba[4 * i + 2] = rgb[2];
    rgba[4 * i + 3] = 255;
    if (i % PAPER > 0) visit(i - 1);
    if (i % PAPER < PAPER - 1) visit(i + 1);
    if (i >= PAPER) visit(i - PAPER);
    if (i < outline.length - PAPER) visit(i + PAPER);
  }
  ctx.putImageData(pixels, 0, 0);
  return true;
}

export function replay(ctx: CanvasRenderingContext2D, outline: Uint8Array, marks: Mark[]) {
  ctx.clearRect(0, 0, PAPER, PAPER);
  for (const mark of marks) {
    if (mark.tool === "fill") fillArea(ctx, outline, mark);
    else mark.points.forEach((p, i) => segment(ctx, mark, mark.points[Math.max(0, i - 1)], p));
  }
}
