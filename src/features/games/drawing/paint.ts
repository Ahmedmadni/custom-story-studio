export const PAPER = 900;
export const PAPER_HEIGHT = 1200;
export type Tool =
  | "pencil"
  | "colored-pencil"
  | "ink"
  | "calligraphy"
  | "crayon"
  | "brush"
  | "oil"
  | "watercolor"
  | "marker"
  | "fill"
  | "eraser"
  | "clear";
export type Point = [number, number];
export interface Mark {
  tool: Tool;
  color: string;
  size: number;
  points: Point[];
  opacity?: number;
  pressures?: number[];
  tolerance?: number;
  fillMode?: "paint" | "erase";
}

const TOOLS: Tool[] = [
  "pencil",
  "colored-pencil",
  "ink",
  "calligraphy",
  "crayon",
  "brush",
  "oil",
  "watercolor",
  "marker",
  "fill",
  "eraser",
  "clear",
];

// Small breaks in antialiased outlines otherwise let the paint bucket flood
// the whole page. This mask is only used for filling; the source art stays intact.
export function sealOutlineGaps(mask: Uint8Array, width: number, height: number) {
  const sealed = mask.slice();
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      if (mask[i - 1] && !mask[i] && mask[i + 1]) sealed[i] = 1;
      if (x < width - 2 && mask[i - 1] && !mask[i] && !mask[i + 1] && mask[i + 2]) {
        sealed[i] = sealed[i + 1] = 1;
      }
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i - width] && !mask[i] && mask[i + width]) sealed[i] = 1;
      if (
        y < height - 2 &&
        mask[i - width] &&
        !mask[i] &&
        !mask[i + width] &&
        mask[i + 2 * width]
      ) {
        sealed[i] = sealed[i + width] = 1;
      }
    }
  }
  return sealed;
}

export function isMark(value: unknown): value is Mark {
  if (!value || typeof value !== "object") return false;
  const mark = value as Partial<Mark>;
  return (
    TOOLS.includes(mark.tool as Tool) &&
    typeof mark.color === "string" &&
    /^#[0-9a-f]{6}$/i.test(mark.color) &&
    typeof mark.size === "number" &&
    mark.size >= 1 &&
    mark.size <= 80 &&
    Array.isArray(mark.points) &&
    mark.points.length > 0 &&
    mark.points.length <= 20000 &&
    (mark.opacity === undefined ||
      (typeof mark.opacity === "number" &&
        Number.isFinite(mark.opacity) &&
        mark.opacity >= 0.1 &&
        mark.opacity <= 1)) &&
    (mark.tolerance === undefined ||
      (mark.tool === "fill" &&
        Number.isInteger(mark.tolerance) &&
        mark.tolerance >= 0 &&
        mark.tolerance <= 80)) &&
    (mark.fillMode === undefined ||
      (mark.tool === "fill" && (mark.fillMode === "paint" || mark.fillMode === "erase"))) &&
    (mark.pressures === undefined ||
      (Array.isArray(mark.pressures) &&
        mark.pressures.length === mark.points.length &&
        mark.pressures.every(
          (p) => typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1,
        ))) &&
    mark.points.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every(
          (v, index) => Number.isInteger(v) && v >= 0 && v < (index === 0 ? PAPER : PAPER_HEIGHT),
        ),
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
function stroke(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number) {
  ctx.lineWidth = width;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.beginPath();
  if (a[0] === b[0] && a[1] === b[1]) {
    ctx.arc(a[0], a[1], width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
  }
}

function tint(color: string, white: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((offset) =>
        Math.round(parseInt(color.slice(offset, offset + 2), 16) * (1 - white) + 255 * white)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

// Each segment uses the same deterministic marks for live drawing and undo/redo replay.
export function segment(
  ctx: CanvasRenderingContext2D,
  mark: Mark,
  a: Point,
  b: Point,
  pressure = 1,
) {
  ctx.save();
  ctx.globalCompositeOperation = mark.tool === "eraser" ? "destination-out" : "source-over";
  ctx.globalAlpha = mark.tool === "eraser" ? 1 : (mark.opacity ?? 1);
  const ink =
    mark.tool === "crayon" || mark.tool === "colored-pencil" ? crayon(ctx, mark.color) : mark.color;
  ctx.fillStyle = ctx.strokeStyle = ink;
  const width = Math.max(1, mark.size * (0.5 + 0.5 * pressure));
  switch (mark.tool) {
    case "pencil":
      ctx.globalAlpha *= 0.72;
      stroke(ctx, a, b, Math.max(1, width * 0.32));
      break;
    case "colored-pencil":
      ctx.globalAlpha *= 0.78;
      stroke(ctx, a, b, Math.max(1, width * 0.48));
      break;
    case "ink":
      stroke(ctx, a, b, Math.max(1, width * 0.42));
      break;
    case "calligraphy": {
      // Sweep a flat, angled nib along the segment. Undo and playback use this same path.
      const angle = -Math.PI / 5;
      const aspect = 0.24;
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      ctx.translate(...a);
      ctx.rotate(angle);
      ctx.scale(1, aspect);
      const end: Point = [
        dx * Math.cos(angle) + dy * Math.sin(angle),
        (dy * Math.cos(angle) - dx * Math.sin(angle)) / aspect,
      ];
      stroke(ctx, [0, 0], end, width);
      break;
    }
    case "marker":
      ctx.globalAlpha *= 0.56;
      stroke(ctx, a, b, width * 1.15);
      break;
    case "watercolor":
      ctx.globalAlpha *= 0.13;
      stroke(ctx, a, b, width * 1.45);
      ctx.globalAlpha = (mark.opacity ?? 1) * 0.24;
      stroke(ctx, a, b, width);
      break;
    case "oil": {
      stroke(ctx, a, b, width * 1.16);
      // Several short bristle tracks and a highlight make the opaque stroke textured.
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy) || 1;
      const normalX = -dy / length;
      const normalY = dx / length;
      ctx.fillStyle = ctx.strokeStyle = tint(mark.color, 0.28);
      ctx.globalAlpha *= 0.4;
      for (const offset of [-0.3, 0.05, 0.29]) {
        const shift = offset * width;
        const from: Point = [a[0] + normalX * shift, a[1] + normalY * shift];
        const to: Point = [b[0] + normalX * shift, b[1] + normalY * shift];
        stroke(ctx, from, to, Math.max(1, width * 0.055));
      }
      break;
    }
    default:
      stroke(ctx, a, b, width);
  }
  ctx.restore();
}

// Transparent paints are drawn as a single path. Segment-by-segment alpha
// creates dark joints, especially when a child moves slowly with a stylus.
function pressureStroke(points: Point[], pressures: number[], width: number) {
  const path = new Path2D();
  const radius = (index: number) => Math.max(0.5, (width * (0.5 + 0.5 * pressures[index])) / 2);
  for (let index = 0; index < points.length; index++) {
    const [x, y] = points[index];
    const r = radius(index);
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, Math.PI * 2);
    if (index === 0) continue;
    const [ax, ay] = points[index - 1];
    const dx = x - ax;
    const dy = y - ay;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    const nx = -dy / length;
    const ny = dx / length;
    const previousRadius = radius(index - 1);
    path.moveTo(ax - nx * previousRadius, ay - ny * previousRadius);
    path.lineTo(x - nx * r, y - ny * r);
    path.lineTo(x + nx * r, y + ny * r);
    path.lineTo(ax + nx * previousRadius, ay + ny * previousRadius);
    path.closePath();
  }
  return path;
}

export function smoothStroke(ctx: CanvasRenderingContext2D, mark: Mark) {
  if (mark.tool !== "marker" && mark.tool !== "watercolor") return;
  const points = mark.points;
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = mark.color;
  ctx.lineCap = ctx.lineJoin = "round";
  const path = (width: number, alpha: number) => {
    ctx.globalAlpha = (mark.opacity ?? 1) * alpha;
    if (mark.pressures) {
      ctx.fill(pressureStroke(points, mark.pressures, width));
      return;
    }
    ctx.lineWidth = width;
    ctx.beginPath();
    if (points.length === 1) {
      ctx.arc(points[0][0], points[0][1], width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(...points[0]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
      ctx.stroke();
    }
  };
  if (mark.tool === "watercolor") {
    path(mark.size * 1.45, 0.13);
    path(mark.size, 0.24);
  } else path(mark.size * 1.15, 0.56);
  ctx.restore();
}

// Compare the visible paint on white paper. The outline is an independent barrier,
// so an eraser or a bucket can never destroy the original drawing.
export function fillArea(ctx: CanvasRenderingContext2D, outline: Uint8Array, mark: Mark) {
  const [x, y] = mark.points[0];
  const start = y * PAPER + x;
  if (outline[start]) return false;
  const pixels = ctx.getImageData(0, 0, PAPER, PAPER_HEIGHT);
  const rgba = pixels.data;
  const rgb = [1, 3, 5].map((i) => parseInt(mark.color.slice(i, i + 2), 16));
  const visible = (i: number, channel: number) =>
    255 - ((255 - rgba[4 * i + channel]) * rgba[4 * i + 3]) / 255;
  const target = rgb.map((_, channel) => visible(start, channel));
  const tolerance = mark.tolerance ?? 28;
  const erase = mark.fillMode === "erase";
  if (erase ? rgba[4 * start + 3] === 0 : target.every((v, c) => Math.abs(v - rgb[c]) < 1))
    return false;
  const seen = new Uint8Array(outline.length);
  const queue = new Int32Array(outline.length);
  let end = 1;
  queue[0] = start;
  seen[start] = 1;
  function visit(i: number) {
    if (seen[i] || outline[i]) return;
    seen[i] = 1;
    for (let c = 0; c < 3; c++) if (Math.abs(visible(i, c) - target[c]) > tolerance) return;
    queue[end++] = i;
  }
  for (let next = 0; next < end; next++) {
    const i = queue[next];
    rgba[4 * i] = erase ? 0 : rgb[0];
    rgba[4 * i + 1] = erase ? 0 : rgb[1];
    rgba[4 * i + 2] = erase ? 0 : rgb[2];
    rgba[4 * i + 3] = erase ? 0 : 255;
    if (i % PAPER > 0) visit(i - 1);
    if (i % PAPER < PAPER - 1) visit(i + 1);
    if (i >= PAPER) visit(i - PAPER);
    if (i < outline.length - PAPER) visit(i + PAPER);
  }
  ctx.putImageData(pixels, 0, 0);
  return true;
}

export function replay(ctx: CanvasRenderingContext2D, outline: Uint8Array, marks: Mark[]) {
  ctx.clearRect(0, 0, PAPER, PAPER_HEIGHT);
  for (const mark of marks) {
    if (mark.tool === "clear") ctx.clearRect(0, 0, PAPER, PAPER_HEIGHT);
    else if (mark.tool === "fill") fillArea(ctx, outline, mark);
    else if (mark.tool === "marker" || mark.tool === "watercolor") smoothStroke(ctx, mark);
    else
      mark.points.forEach((p, i) =>
        segment(
          ctx,
          mark,
          mark.points[Math.max(0, i - 1)],
          p,
          mark.pressures ? (mark.pressures[Math.max(0, i - 1)] + mark.pressures[i]) / 2 : 1,
        ),
      );
  }
}
