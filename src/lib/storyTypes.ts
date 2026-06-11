export interface StoryPage {
  n: number;
  /** النص العربي للصفحة، يحتوي {child} كاسم البطل */
  text: string;
  /** وصف المشهد بالإنجليزية لتوليد الصورة */
  scene: string;
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
