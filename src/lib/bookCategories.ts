/**
 * فئات الكتب التعليمية المعتمدة في معالج الإنشاء.
 * كل فئة تحمل توجيهاً موجزاً للذكاء الاصطناعي ليبني محتوى مناسباً.
 */
export const BOOK_CATEGORIES = [
  {
    value: "mathematics",
    label: "الرياضيات",
    emoji: "🔢",
    prompt:
      "Mathematics for kids: counting, simple addition/subtraction, shapes and patterns, fun number stories. Adapt complexity strictly to the child's age.",
  },
  {
    value: "science",
    label: "العلوم",
    emoji: "🔬",
    prompt:
      "Science for kids: discovery of the world — water cycle, plants, weather, body, space — with simple safe experiments to imagine. Adapt complexity to age.",
  },
  {
    value: "programming",
    label: "البرمجة",
    emoji: "💻",
    prompt:
      "Programming for kids: thinking in steps, sequences, loops, conditions, simple algorithms — explained through everyday playful examples (recipes, games). No real code for under 8; visual block-style for older.",
  },
  {
    value: "arabic_letters",
    label: "الحروف العربية",
    emoji: "أ",
    prompt:
      "Arabic alphabet: introduce letters with sound, an example word, and a friendly illustration that shows the word's meaning. Cover several letters across pages.",
  },
  {
    value: "english_letters",
    label: "English Letters",
    emoji: "A",
    prompt:
      "English alphabet: introduce letters with sound, an example word and a friendly illustration showing that word. Cover several letters across pages.",
  },
  {
    value: "animals",
    label: "الحيوانات",
    emoji: "🦁",
    prompt:
      "Animals: name, habitat, sound, one cool fact, and how to be kind to them. Keep it gentle and wonder-filled.",
  },
  {
    value: "fruits",
    label: "الفواكه",
    emoji: "🍎",
    prompt:
      "Fruits: colors, taste, where they grow, health benefits and a fun fact per fruit.",
  },
  {
    value: "colors",
    label: "الألوان",
    emoji: "🎨",
    prompt:
      "Colors: primary then secondary colors, things in nature of that color, mixing colors playfully.",
  },
] as const;

export type BookCategoryValue = (typeof BOOK_CATEGORIES)[number]["value"];

export const READING_LEVELS = [
  { value: "beginner", label: "مبتدئ", desc: "كلمات قصيرة، جُمَل بسيطة" },
  { value: "intermediate", label: "متوسط", desc: "جمل أطول وفقرات قصيرة" },
  { value: "advanced", label: "متقدم", desc: "مفردات أغنى وشرح أعمق" },
] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number]["value"];

export const BOOK_LENGTHS = [
  { value: "short", label: "قصير", pages: 6 },
  { value: "medium", label: "متوسط", pages: 10 },
  { value: "long", label: "موسّع", pages: 14 },
] as const;
export type BookLength = (typeof BOOK_LENGTHS)[number]["value"];

export function readingLevelFromAge(age: number | undefined | null): ReadingLevel {
  if (!age || age <= 5) return "beginner";
  if (age <= 9) return "intermediate";
  return "advanced";
}

export function pagesForLength(len: BookLength): number {
  return BOOK_LENGTHS.find((l) => l.value === len)?.pages ?? 6;
}

export function categoryLabel(v: string): string {
  return BOOK_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

export interface BookMeta {
  category: BookCategoryValue;
  reading_level: ReadingLevel;
  length: BookLength;
  learning_goals?: string[];
}
