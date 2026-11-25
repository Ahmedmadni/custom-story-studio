const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function rememberColor(recent: readonly string[], color: string): string[] {
  if (!HEX_COLOR.test(color)) return [...recent];
  const next = color.toLowerCase();
  return [next, ...recent.filter((item) => item.toLowerCase() !== next)].slice(0, 8);
}

export function savedColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const colors: string[] = [];
  for (const color of value) {
    if (typeof color !== "string" || !HEX_COLOR.test(color)) continue;
    const normalized = color.toLowerCase();
    if (!colors.includes(normalized)) colors.push(normalized);
    if (colors.length === 8) break;
  }
  return colors;
}

// The hand tool remains usable with a finger when stylus-only painting is enabled.
export function ignoreTouch(
  pointerType: string,
  penOnly: boolean,
  lastPenAt: number,
  now: number,
  handTool: boolean,
) {
  return pointerType === "touch" && !handTool && (penOnly || now - lastPenAt < 750);
}
