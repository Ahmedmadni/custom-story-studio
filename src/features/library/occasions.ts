export type OccasionKey =
  | "birthday"
  | "graduation"
  | "ramadan"
  | "eid"
  | "back_to_school"
  | "bedtime"
  | "family"
  | "adventure";

export interface Occasion {
  key: OccasionKey;
  label: string;
  emoji: string;
  gradient: string;
  description: string;
}

export const OCCASIONS: Occasion[] = [
  {
    key: "birthday",
    label: "قصص أعياد الميلاد",
    emoji: "🎂",
    gradient: "from-pink-400/30 to-rose-400/20",
    description: "هدية فريدة لطفل العام",
  },
  {
    key: "graduation",
    label: "قصص النجاح والتخرّج",
    emoji: "🎓",
    gradient: "from-sky-400/30 to-blue-500/20",
    description: "احتفل بإنجاز طفلك",
  },
  {
    key: "ramadan",
    label: "قصص رمضان",
    emoji: "🌙",
    gradient: "from-indigo-500/30 to-purple-500/20",
    description: "روحانية الشهر الفضيل",
  },
  {
    key: "eid",
    label: "قصص العيد",
    emoji: "🕌",
    gradient: "from-emerald-400/30 to-teal-500/20",
    description: "فرحة العيد بأبهى صورة",
  },
  {
    key: "back_to_school",
    label: "قصص العودة للمدرسة",
    emoji: "🎒",
    gradient: "from-amber-400/30 to-orange-500/20",
    description: "بداية دراسية ملهمة",
  },
  {
    key: "bedtime",
    label: "قصص قبل النوم",
    emoji: "🌜",
    gradient: "from-violet-500/30 to-indigo-500/20",
    description: "رحلة هادئة لأحلام سعيدة",
  },
  {
    key: "family",
    label: "قصص العائلة",
    emoji: "👨‍👩‍👧",
    gradient: "from-rose-400/30 to-pink-500/20",
    description: "ترابط ومحبة بين الأهل",
  },
  {
    key: "adventure",
    label: "قصص المغامرات",
    emoji: "🗺️",
    gradient: "from-fuchsia-500/30 to-violet-500/20",
    description: "مغامرات شيّقة للأبطال",
  },
];
