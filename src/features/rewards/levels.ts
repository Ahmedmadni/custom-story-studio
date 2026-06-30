export type RewardLevel = {
  key: "explorer" | "hero" | "legend";
  label: string;
  emoji: string;
  color: string;
  min: number;
  max: number; // exclusive
};

export const LEVELS: RewardLevel[] = [
  { key: "explorer", label: "مكتشف", emoji: "🧭", color: "from-sky-400 to-cyan-500", min: 0, max: 500 },
  { key: "hero", label: "بطل", emoji: "🦸", color: "from-violet-500 to-fuchsia-500", min: 500, max: 1500 },
  { key: "legend", label: "أسطورة", emoji: "👑", color: "from-amber-400 to-orange-500", min: 1500, max: Infinity },
];

export function levelFor(points: number): RewardLevel {
  return LEVELS.find((l) => points >= l.min && points < l.max) ?? LEVELS[0];
}

export function nextLevel(points: number): RewardLevel | null {
  const cur = levelFor(points);
  const idx = LEVELS.indexOf(cur);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export function progressToNext(points: number): { pct: number; remaining: number } {
  const next = nextLevel(points);
  if (!next) return { pct: 100, remaining: 0 };
  const cur = levelFor(points);
  const span = next.min - cur.min;
  const done = points - cur.min;
  return { pct: Math.min(100, Math.round((done / span) * 100)), remaining: next.min - points };
}
