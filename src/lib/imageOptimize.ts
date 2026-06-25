/**
 * Client-side image optimization.
 * - Converts to WebP when supported (falls back to original type).
 * - Resizes to maxWidth while preserving aspect ratio.
 * - Skips files that aren't images (e.g. PDFs).
 *
 * Goal: shrink uploads (child photos, payment receipts) before sending to
 * storage so pages load faster and storage costs less.
 */

export interface OptimizeOptions {
  maxWidth?: number; // default 1600
  maxHeight?: number; // default 1600
  quality?: number; // 0..1, default 0.82
  format?: "image/webp" | "image/jpeg"; // default webp
  /** Skip optimization if file is already smaller than this many bytes. */
  skipUnderBytes?: number; // default 80_000
}

export interface OptimizeResult {
  file: File;
  originalSize: number;
  optimizedSize: number;
  savedPct: number; // 0..100
  converted: boolean;
}

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

export async function optimizeImage(
  input: File,
  opts: OptimizeOptions = {},
): Promise<OptimizeResult> {
  const originalSize = input.size;
  const noop: OptimizeResult = {
    file: input,
    originalSize,
    optimizedSize: originalSize,
    savedPct: 0,
    converted: false,
  };

  if (!isBrowser) return noop;
  if (!input.type.startsWith("image/")) return noop;
  if (input.type === "image/gif" || input.type === "image/svg+xml") return noop;

  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    format = "image/webp",
    skipUnderBytes = 80_000,
  } = opts;

  if (originalSize < skipUnderBytes && input.type === format) return noop;

  try {
    const bitmap = await loadBitmap(input);
    const { width: w, height: h } = fitInside(bitmap.width, bitmap.height, maxWidth, maxHeight);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return noop;
    ctx.drawImage(bitmap, 0, 0, w, h);
    if ("close" in bitmap) (bitmap as ImageBitmap).close();

    const blob = await canvasToBlob(canvas, format, quality);
    if (!blob || blob.size >= originalSize) return noop;

    const ext = format === "image/webp" ? "webp" : "jpg";
    const baseName = input.name.replace(/\.[^.]+$/, "") || "image";
    const newFile = new File([blob], `${baseName}.${ext}`, {
      type: blob.type || format,
      lastModified: Date.now(),
    });
    const savedPct = Math.round(((originalSize - blob.size) / originalSize) * 100);
    return { file: newFile, originalSize, optimizedSize: blob.size, savedPct, converted: true };
  } catch {
    return noop;
  }
}

function fitInside(w: number, h: number, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / w, maxH / h, 1);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
