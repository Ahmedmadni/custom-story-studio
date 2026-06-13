// Pure data for mini-games (no AI calls)

export const COUNTABLES = [
  { emoji: "🍎", name: "تفاحة" },
  { emoji: "🐝", name: "نحلة" },
  { emoji: "🌟", name: "نجمة" },
  { emoji: "🐠", name: "سمكة" },
  { emoji: "🎈", name: "بالون" },
  { emoji: "🍓", name: "فراولة" },
  { emoji: "🦋", name: "فراشة" },
  { emoji: "🌻", name: "زهرة" },
];

export const ARABIC_LETTERS = [
  { letter: "أ", word: "أرنب", emoji: "🐰" },
  { letter: "ب", word: "بطة", emoji: "🦆" },
  { letter: "ت", word: "تفاحة", emoji: "🍎" },
  { letter: "ث", word: "ثعلب", emoji: "🦊" },
  { letter: "ج", word: "جمل", emoji: "🐪" },
  { letter: "د", word: "دب", emoji: "🐻" },
  { letter: "ر", word: "رمانة", emoji: "🍎" },
  { letter: "س", word: "سمكة", emoji: "🐟" },
  { letter: "ش", word: "شمس", emoji: "☀️" },
  { letter: "ف", word: "فيل", emoji: "🐘" },
  { letter: "ق", word: "قمر", emoji: "🌙" },
  { letter: "ن", word: "نحلة", emoji: "🐝" },
];

export const ENGLISH_LETTERS = [
  { letter: "A", word: "Apple", emoji: "🍎" },
  { letter: "B", word: "Bear", emoji: "🐻" },
  { letter: "C", word: "Cat", emoji: "🐈" },
  { letter: "D", word: "Dog", emoji: "🐕" },
  { letter: "E", word: "Elephant", emoji: "🐘" },
  { letter: "F", word: "Fish", emoji: "🐟" },
  { letter: "G", word: "Giraffe", emoji: "🦒" },
  { letter: "H", word: "Horse", emoji: "🐴" },
  { letter: "L", word: "Lion", emoji: "🦁" },
  { letter: "M", word: "Monkey", emoji: "🐒" },
  { letter: "S", word: "Sun", emoji: "☀️" },
  { letter: "T", word: "Tiger", emoji: "🐯" },
];

export const SHAPES = [
  { name: "دائرة", svg: <const>"circle" },
  { name: "مربع", svg: <const>"square" },
  { name: "مثلث", svg: <const>"triangle" },
  { name: "نجمة", svg: <const>"star" },
  { name: "قلب", svg: <const>"heart" },
  { name: "مستطيل", svg: <const>"rect" },
];

export const COLORS = [
  { name: "أحمر", hex: "#ef4444" },
  { name: "أزرق", hex: "#3b82f6" },
  { name: "أخضر", hex: "#22c55e" },
  { name: "أصفر", hex: "#eab308" },
  { name: "برتقالي", hex: "#f97316" },
  { name: "بنفسجي", hex: "#a855f7" },
  { name: "وردي", hex: "#ec4899" },
  { name: "بني", hex: "#92400e" },
];

export function pickRandom<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
