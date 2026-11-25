import { isMark } from "./paint";

export const drawingStorageKey = (id: string) => "kidzy:desk:v1:" + id;

export function hasSavedArtwork(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return false;
    let hasColor = false;
    let reachedLastClear = false;
    for (let index = value.length - 1; index >= 0; index--) {
      const mark: unknown = value[index];
      if (!isMark(mark)) return false;
      if (mark.tool === "clear") reachedLastClear = true;
      else if (!reachedLastClear && mark.tool !== "eraser" && mark.fillMode !== "erase")
        hasColor = true;
    }
    return hasColor;
  } catch {
    return false;
  }
}
