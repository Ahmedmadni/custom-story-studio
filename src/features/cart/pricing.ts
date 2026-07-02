/**
 * تسعير القصص:
 * - مكتبة جاهزة (is_custom=false): 10 صفحات 150 ج، 16 صفحة 200 ج
 * - قصة مخصصة بأفكار العميل (is_custom=true): 10 صفحات 200 ج، 16 صفحة 250 ج
 */
export const LIBRARY_PRICES: Record<10 | 16, number> = { 10: 150, 16: 200 };
export const CUSTOM_PRICES: Record<10 | 16, number> = { 10: 200, 16: 250 };

export function pricePerPages(pages: 10 | 16, isCustom: boolean): number {
  return (isCustom ? CUSTOM_PRICES : LIBRARY_PRICES)[pages];
}

export function pagesOptionsFor(isCustom: boolean): Array<{ pages: 10 | 16; price: number }> {
  return [
    { pages: 10, price: pricePerPages(10, isCustom) },
    { pages: 16, price: pricePerPages(16, isCustom) },
  ];
}

/** تكلفة إضافة نسخة مطبوعة وشحنها */
export const PRINT_COPY_PRICE_EGP = 200;

/**
 * باقات القصص (F7) — خصم تلقائي حسب عدد القصص في نفس الطلب. أعلى فئة
 * تتحقق شرطها (minItems) هي التي تُطبَّق.
 */
export type StoryPackageTier = {
  key: "starter" | "family" | "premium" | "ultimate";
  label: string;
  minItems: number;
  discountPct: number;
};

export const STORY_PACKAGES: StoryPackageTier[] = [
  { key: "starter", label: "Starter", minItems: 1, discountPct: 0 },
  { key: "family", label: "Family", minItems: 3, discountPct: 10 },
  { key: "premium", label: "Premium", minItems: 5, discountPct: 15 },
  { key: "ultimate", label: "Ultimate", minItems: 10, discountPct: 20 },
];

export function packageTierFor(itemCount: number): StoryPackageTier {
  let best = STORY_PACKAGES[0];
  for (const tier of STORY_PACKAGES) {
    if (itemCount >= tier.minItems) best = tier;
  }
  return best;
}

/** أقرب فئة أعلى لم تُحقَّق بعد — تُستخدم لعرض "أضف قصة أخرى ووفّر X%". */
export function nextPackageTier(itemCount: number): StoryPackageTier | null {
  return STORY_PACKAGES.find((tier) => itemCount < tier.minItems) ?? null;
}
