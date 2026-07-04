import { logError } from "./errorLogger";
import { normalizeError } from "./normalizeError";

/**
 * غلاف اختياري لمعالِجات `createServerFn().handler(...)` — يلتقط أي خطأ،
 * يسجّله عبر `logError`، ثم يُعيد إلقاءه كـ `Error` عادي برسالة عربية آمنة
 * (نفس نمط `throw new Error("...")` المُتَّبع أصلاً في كل ملفات
 * `*.functions.ts` بهذا المشروع — لا يغيّر شكل الخطأ الذي يصل للعميل).
 *
 * لا يُطبَّق تلقائياً على أي دالة قائمة حالياً (لتفادي تغيير سلوك كود يعمل
 * دون بيئة حقيقية للاختبار) — استخدمه في دوال جديدة، أو أضِفه تدريجياً.
 *
 * @example
 * export const myFn = createServerFn({ method: "POST" })
 *   .middleware([requireSupabaseAuth])
 *   .handler(withErrorHandling(async ({ context }) => {
 *     // ... منطق قد يُلقي أخطاء Supabase خام
 *   }, "myFn"));
 */
export function withErrorHandling<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  operationName: string,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, { operation: operationName });
      const { userMessage } = normalizeError(error);
      throw new Error(userMessage);
    }
  };
}
