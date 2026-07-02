import { reportLovableError } from "@/lib/lovable-error-reporting";
import { normalizeError } from "./normalizeError";

/**
 * نقطة تسجيل أخطاء موحّدة (Phase 4). تعمل في العميل والخادم:
 * - العميل: `console.error` + يُرسل لتتبّع أخطاء Lovable المُدمَج أصلاً
 *   (`reportLovableError` — لا شيء جديد، فقط استدعاء موحّد بدل تكراره).
 * - الخادم: `console.error` بصيغة مُهيكَلة (يلتقطها Cloudflare Workers logs).
 *   `reportLovableError` لا تفعل شيئاً على الخادم (تتحقق من `window` داخلياً).
 *
 * بديل مستقبلي (Sentry أو مشابه) يستبدل الجسم هنا فقط — كل نقاط الاستدعاء
 * تبقى كما هي. راجع docs/OBSERVABILITY.md.
 */
export function logError(error: unknown, context: Record<string, unknown> = {}): void {
  const { userMessage, code } = normalizeError(error);
  console.error(`[error:${code}]`, userMessage, context, error);
  reportLovableError(error, { code, ...context });
}
