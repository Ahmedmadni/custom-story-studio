const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export type HslColor = { hue: number; saturation: number; lightness: number };

export function colorToHsl(hex: string): HslColor {
  if (!HEX_COLOR.test(hex)) throw new Error("Invalid color");
  const [red, green, blue] = [1, 3, 5].map(
    (offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case red:
        hue = ((green - blue) / delta) % 6;
        break;
      case green:
        hue = (blue - red) / delta + 2;
        break;
      default:
        hue = (red - green) / delta + 4;
    }
  }
  return {
    hue: Math.round((hue * 60 + 360) % 360),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100),
  };
}

export function hslToColor({ hue, saturation, lightness }: HslColor): string {
  const h = (((hue % 360) + 360) % 360) / 60;
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const l = Math.max(0, Math.min(100, lightness)) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const second = chroma * (1 - Math.abs((h % 2) - 1));
  const channels =
    h < 1
      ? [chroma, second, 0]
      : h < 2
        ? [second, chroma, 0]
        : h < 3
          ? [0, chroma, second]
          : h < 4
            ? [0, second, chroma]
            : h < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];
  const adjustment = l - chroma / 2;
  return (
    "#" +
    channels
      .map((channel) =>
        Math.round((channel + adjustment) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function colorShades(hex: string): string[] {
  const hsl = colorToHsl(hex);
  return [
    ...new Set([
      hex.toLowerCase(),
      ...[12, 22, 32, 42, 52, 62, 72, 82, 92].map((lightness) => hslToColor({ ...hsl, lightness })),
    ]),
  ].sort((a, b) => colorToHsl(a).lightness - colorToHsl(b).lightness);
}

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
