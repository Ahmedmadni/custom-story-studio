export interface StoryPage {
  n: number;
  /** عنوان الصفحة بلغة المحتوى (للوضع الأحادي ar أو en) */
  title?: string;
  /** نص الصفحة الأحادي (يحتوي {child} كاسم البطل) */
  text: string;
  /** نسخة عربية من العنوان (للوضع الثنائي) */
  title_ar?: string;
  /** نسخة إنجليزية من العنوان (للوضع الثنائي) */
  title_en?: string;
  /** نسخة عربية من النص (للوضع الثنائي) */
  text_ar?: string;
  /** نسخة إنجليزية من النص (للوضع الثنائي) */
  text_en?: string;
  /** وصف المشهد بالإنجليزية لتوليد الصورة */
  scene: string;
  /** عنوان قصير (1-3 كلمات إنجليزية) يُرسم داخل الصورة كتيتر بوستر */
  image_title_en?: string;
  /** مسار صورة الصفحة المولدة داخل مخزن story-pages (إن وجدت) */
  image_path?: string | null;
}

export function parsePages(pages: unknown): StoryPage[] {
  if (!Array.isArray(pages)) return [];
  return pages.filter(
    (p): p is StoryPage =>
      typeof p === "object" && p !== null && "n" in p,
  );
}

export type Gender = "boy" | "girl";

export const GENDER_OPTIONS: { value: Gender; label: string; emoji: string; hint: string }[] = [
  { value: "boy", label: "ولد", emoji: "👦", hint: "نصوص بصيغة المذكر — هو، شجاع، بطل…" },
  { value: "girl", label: "بنت", emoji: "👧", hint: "نصوص بصيغة المؤنث — هي، شجاعة، بطلة…" },
];

export function personalize(text: string, childName: string): string {
  return text.replaceAll("{child}", childName);
}

export const CATEGORIES = [
  "قيم وأخلاق",
  "الصداقة",
  "الأسرة والمحبة",
  "مغامرات وشجاعة",
  "عادات وحياة",
  "الطبيعة والحيوان",
  "أبطال خارقون",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "تمت الموافقة",
  generating: "جارٍ توليد الصور",
  ready: "القصة جاهزة",
  sent: "تم الإرسال",
  rejected: "مرفوض",
};

export type LanguageMode = "ar" | "en" | "bilingual";

export const LANGUAGE_OPTIONS = [
  { value: "ar", label: "العربية فقط", hint: "نص عربي فصيح بسيط مناسب للأطفال" },
  {
    value: "bilingual",
    label: "عربي + إنجليزي",
    hint: "نسختان متطابقتان في كل صفحة — مثالي للتعلم المزدوج",
  },
  { value: "en", label: "English Only", hint: "Simple, kid-friendly English" },
] as const;

export const CONTENT_TYPE_OPTIONS = [
  {
    value: "story",
    label: "قصة مصورة",
    desc: "حكاية شيقة تزرع قيمة نبيلة وطفلك هو بطلها",
  },
  {
    value: "book",
    label: "كتاب تعليمي",
    desc: "كتاب يعلّم موضوعاً مختاراً (رياضيات، علوم، حروف…) بطريقة ممتعة",
  },
] as const;

/** يعيد نص الصفحة المناسب لوضع اللغة المطلوب */
export function pageTextFor(
  p: StoryPage,
  language: LanguageMode,
  childName: string,
): { ar?: string; en?: string; primary: string } {
  const ar =
    (p.text_ar && personalize(p.text_ar, childName)) ||
    (language === "ar" ? personalize(p.text, childName) : undefined);
  const en =
    (p.text_en && personalize(p.text_en, childName)) ||
    (language === "en" ? personalize(p.text, childName) : undefined);
  const primary =
    language === "en"
      ? en ?? personalize(p.text, childName)
      : ar ?? personalize(p.text, childName);
  return { ar, en, primary };
}

export function pageTitleFor(
  p: StoryPage,
  language: LanguageMode,
): { ar?: string; en?: string; primary?: string } {
  const ar = p.title_ar || (language === "ar" ? p.title : undefined);
  const en = p.title_en || (language === "en" ? p.title : undefined);
  const primary = language === "en" ? en ?? p.title : ar ?? p.title;
  return { ar, en, primary };
}
