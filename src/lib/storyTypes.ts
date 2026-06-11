export interface StoryPage {
  n: number;
  /** عنوان قصير للصفحة بلغة المحتوى */
  title?: string;
  /** النص العربي للصفحة، يحتوي {child} كاسم البطل */
  text: string;
  /** وصف المشهد بالإنجليزية لتوليد الصورة */
  scene: string;
  /** مسار صورة الصفحة المولدة داخل مخزن story-pages (إن وجدت) */
  image_path?: string | null;
}

export function parsePages(pages: unknown): StoryPage[] {
  if (!Array.isArray(pages)) return [];
  return pages.filter(
    (p): p is StoryPage =>
      typeof p === "object" && p !== null && "text" in p && "n" in p,
  );
}

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
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "تمت الموافقة",
  generating: "جارٍ توليد الصور",
  ready: "القصة جاهزة",
  sent: "تم الإرسال",
  rejected: "مرفوض",
};

export const LANGUAGE_OPTIONS = [
  { value: "ar", label: "العربية", hint: "نص عربي فصيح بسيط" },
  { value: "en", label: "English", hint: "Simple English for kids" },
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
    desc: "كتاب يعلّم الحروف أو الأرقام أو أي موضوع تختاره بطريقة ممتعة",
  },
] as const;
