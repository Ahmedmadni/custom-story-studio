export const AVATAR_EMOJIS = [
  "🦁","🦄","🐯","🐼","🐰","🐶","🐱","🦊","🐸","🐵",
  "🦸","🧚","🧞","🧜","🧙","👦","👧","🐲","🦖","🐳",
];

export const FAVORITE_COLORS = [
  { key: "purple", label: "بنفسجي", hex: "#7C3AED" },
  { key: "blue", label: "أزرق", hex: "#2563EB" },
  { key: "pink", label: "وردي", hex: "#EC4899" },
  { key: "yellow", label: "أصفر", hex: "#EAB308" },
  { key: "green", label: "أخضر", hex: "#16A34A" },
  { key: "red", label: "أحمر", hex: "#DC2626" },
  { key: "orange", label: "برتقالي", hex: "#EA580C" },
  { key: "turquoise", label: "تركوازي", hex: "#06B6D4" },
];

export function computeAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}
