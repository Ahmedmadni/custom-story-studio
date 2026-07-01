// Child leveling system — 10 tiers based on story XP
export const CHILD_LEVEL_XP = [0, 100, 250, 500, 1000, 2000, 4000, 7000, 10000, 15000] as const;

export const CHILD_LEVEL_META: Record<number, { label: string; emoji: string; color: string }> = {
  1: { label: "مكتشف مبتدئ", emoji: "🌱", color: "from-emerald-400 to-teal-500" },
  2: { label: "مغامر صغير", emoji: "🌟", color: "from-sky-400 to-cyan-500" },
  3: { label: "قارئ نشيط", emoji: "📖", color: "from-blue-400 to-indigo-500" },
  4: { label: "بطل الحكايات", emoji: "🦸", color: "from-violet-400 to-purple-500" },
  5: { label: "نجم كيدزي", emoji: "⭐", color: "from-fuchsia-400 to-pink-500" },
  6: { label: "مغامر خارق", emoji: "🚀", color: "from-orange-400 to-rose-500" },
  7: { label: "أمير الحكايات", emoji: "👑", color: "from-amber-400 to-orange-500" },
  8: { label: "قائد الأبطال", emoji: "🏆", color: "from-yellow-400 to-amber-500" },
  9: { label: "أسطورة", emoji: "🎖️", color: "from-lime-400 to-green-500" },
  10: { label: "أسطورة كيدزي", emoji: "💎", color: "from-pink-500 via-purple-500 to-indigo-500" },
};

export function levelFromXp(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < CHILD_LEVEL_XP.length; i++) {
    if (xp >= CHILD_LEVEL_XP[i]) lvl = i + 1;
  }
  return lvl;
}

export function nextLevelTarget(xp: number): number | null {
  const lvl = levelFromXp(xp);
  if (lvl >= 10) return null;
  return CHILD_LEVEL_XP[lvl]; // next threshold
}

export function xpProgress(xp: number): { pct: number; toNext: number; nextTarget: number | null } {
  const nt = nextLevelTarget(xp);
  if (nt == null) return { pct: 100, toNext: 0, nextTarget: null };
  const lvl = levelFromXp(xp);
  const base = CHILD_LEVEL_XP[lvl - 1];
  const pct = Math.min(100, Math.round(((xp - base) / (nt - base)) * 100));
  return { pct, toNext: nt - xp, nextTarget: nt };
}

export function childLevelMeta(level: number) {
  return CHILD_LEVEL_META[Math.max(1, Math.min(10, level))];
}
