export type AchievementKey =
  | "first_story"
  | "reader"
  | "explorer"
  | "adventure_master"
  | "space_hero"
  | "animal_friend"
  | "bedtime_champion"
  | "family_hero"
  | "legend";

export const ACHIEVEMENTS: Record<
  AchievementKey,
  { title: string; emoji: string; description: string; color: string }
> = {
  first_story: { title: "أولى الحكايات", emoji: "🏆", description: "أكمل قصته الأولى", color: "from-emerald-400 to-teal-500" },
  reader: { title: "قارئ نشيط", emoji: "📚", description: "أكمل 5 قصص", color: "from-sky-400 to-blue-500" },
  explorer: { title: "مستكشف", emoji: "🧭", description: "أكمل 10 قصص", color: "from-indigo-400 to-purple-500" },
  adventure_master: { title: "سيد المغامرات", emoji: "🗺️", description: "5 قصص مغامرات", color: "from-orange-400 to-red-500" },
  space_hero: { title: "بطل الفضاء", emoji: "🚀", description: "3 قصص فضاء", color: "from-violet-500 to-indigo-600" },
  animal_friend: { title: "صديق الحيوانات", emoji: "🐾", description: "3 قصص حيوانات", color: "from-lime-400 to-green-500" },
  bedtime_champion: { title: "بطل ما قبل النوم", emoji: "🌙", description: "10 قصص قبل النوم", color: "from-slate-500 to-slate-700" },
  family_hero: { title: "بطل العائلة", emoji: "👨‍👩‍👧", description: "5 قصص عائلية", color: "from-pink-400 to-rose-500" },
  legend: { title: "أسطورة كيدزي", emoji: "👑", description: "50 قصة مكتملة!", color: "from-amber-400 via-orange-500 to-pink-500" },
};

export const ACHIEVEMENT_ORDER: AchievementKey[] = [
  "first_story", "reader", "explorer", "adventure_master",
  "space_hero", "animal_friend", "bedtime_champion", "family_hero", "legend",
];
