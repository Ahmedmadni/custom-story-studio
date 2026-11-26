export type Hsv = { hue: number; saturation: number; value: number };

export function colorFromHsv({ hue, saturation, value }: Hsv): string {
  const h = (((hue % 360) + 360) % 360) / 60;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  const channels = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ][Math.floor(h)];
  return (
    "#" +
    channels
      .map((c) =>
        Math.round(255 * (c + value - chroma))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function hsvFromColor(hex: string, previousHue = 0): Hsv {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let hue = previousHue;
  if (delta > 0) {
    const sector =
      max === r ? (g - b) / delta : max === g ? 2 + (b - r) / delta : 4 + (r - g) / delta;
    hue = (sector * 60 + 360) % 360;
  }
  return { hue, saturation: max === 0 ? 0 : delta / max, value: max };
}
