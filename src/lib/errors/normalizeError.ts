import { AppError, isAppError } from "./AppError";

type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function looksLikePostgrestError(error: unknown): error is PostgrestLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    ("code" in error || "details" in error || "hint" in error)
  );
}

/** رسائل عربية جاهزة لأشهر أكواد أخطاء Postgres/PostgREST التي تظهر فعلياً في هذا التطبيق */
const POSTGRES_CODE_MESSAGES: Record<string, string> = {
  "23505": "هذا العنصر موجود بالفعل",
  "23503": "لا يمكن إتمام العملية بسبب ارتباطها ببيانات أخرى",
  "23502": "بيانات ناقصة، تحقق من الحقول المطلوبة",
  "42501": "غير مصرح لك بهذه العملية",
  PGRST116: "العنصر المطلوب غير موجود",
  PGRST301: "انتهت صلاحية الجلسة، سجّل الدخول مرة أخرى",
};

/**
 * يحوّل أي خطأ (AppError، PostgrestError من Supabase، Error عادي، أو قيمة
 * غير معروفة) إلى شكل موحّد بنص عربي آمن للعرض. استخدمها في أي `catch` أو
 * `onError` بدل تخمين شكل الخطأ يدوياً في كل مكان.
 */
export function normalizeError(error: unknown): {
  userMessage: string;
  code: string;
  original: unknown;
} {
  if (isAppError(error)) {
    return { userMessage: error.userMessage, code: error.code, original: error };
  }

  if (looksLikePostgrestError(error)) {
    const known = error.code ? POSTGRES_CODE_MESSAGES[error.code] : undefined;
    return {
      userMessage: known ?? "تعذّر إكمال العملية، حاول مرة أخرى",
      code: error.code ?? "postgrest_error",
      original: error,
    };
  }

  if (error instanceof Error) {
    // الاتفاقية المتّبعة في هذا التطبيق: server functions تُلقي بالفعل
    // Error برسالة عربية جاهزة للعرض — نُبقيها كما هي.
    return { userMessage: error.message || "حدث خطأ غير متوقع", code: "error", original: error };
  }

  return { userMessage: "حدث خطأ غير متوقع", code: "unknown", original: error };
}

/** اختصار شائع الاستخدام في UI: `toast.error(getErrorMessage(e))` */
export function getErrorMessage(error: unknown): string {
  return normalizeError(error).userMessage;
}
