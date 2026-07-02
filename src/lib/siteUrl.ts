/**
 * لا يوجد نطاق إنتاج معروف في هذا الكود (لا في .env ولا في إعدادات النشر) — القيمة
 * الافتراضية هي نطاق التوثيق المحجوز (RFC 2606)، وليست تخميناً لنطاق حقيقي.
 * عند ربط نطاق فعلي، عرّف VITE_SITE_URL في .env وسيُستخدم تلقائياً في كل روابط
 * canonical و JSON-LD والـ sitemap.
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://example.com").replace(/\/$/, "");
