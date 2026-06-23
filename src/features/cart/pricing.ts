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
