/** رقم واتساب صاحب الموقع (مصر) */
export const ADMIN_WHATSAPP = "201120016502";

/** تحويل رقم مصري مثل 01120016502 إلى صيغة دولية 201120016502 */
export function normalizeEgyptianNumber(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return `2${digits}`;
  return `20${digits}`;
}

export function isValidEgyptianMobile(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  return /^(01|201)(0|1|2|5)\d{8}$/.test(digits);
}

export function waLink(number: string, message: string): string {
  return `https://wa.me/${normalizeEgyptianNumber(number)}?text=${encodeURIComponent(message)}`;
}

export function adminWaLink(message: string): string {
  return waLink(ADMIN_WHATSAPP, message);
}

/** مشاركة رسالة عبر واتساب دون تحديد رقم (يختار المستخدم جهة الإرسال) */
export function shareWaLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
