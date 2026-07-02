/**
 * نطاق الإنتاج الفعلي — نفس القيمة المُستخدمة أصلاً في `storyPdf.ts` (غلاف PDF)
 * و`kashier.functions.ts` (fallback للـ host). يمكن تجاوزها عبر VITE_SITE_URL
 * إن تغيّر النطاق مستقبلاً.
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://kidzy.life").replace(/\/$/, "");
