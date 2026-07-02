/**
 * تسلسل أخطاء موحّد للتطبيق (Phase 4 — Production Hardening Sprint).
 * آمن للاستخدام في العميل والخادم (لا أسرار هنا).
 *
 * `userMessage` نص عربي جاهز للعرض مباشرة في toast/UI. `message`
 * (الموروث من Error) يبقى للسجلات التقنية الداخلية فقط.
 */
export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly cause?: unknown;

  constructor(params: { code: string; message: string; userMessage: string; cause?: unknown }) {
    super(params.message);
    this.name = "AppError";
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.cause = params.cause;
  }
}

export class ValidationError extends AppError {
  constructor(userMessage: string, message = userMessage) {
    super({ code: "validation_error", message, userMessage });
    this.name = "ValidationError";
  }
}

export class AuthError extends AppError {
  constructor(userMessage = "غير مصرح لك بالوصول", message = userMessage) {
    super({ code: "auth_error", message, userMessage });
    this.name = "AuthError";
  }
}

export class NotFoundError extends AppError {
  constructor(userMessage = "العنصر المطلوب غير موجود", message = userMessage) {
    super({ code: "not_found", message, userMessage });
    this.name = "NotFoundError";
  }
}

export class PaymentError extends AppError {
  constructor(userMessage: string, message = userMessage) {
    super({ code: "payment_error", message, userMessage });
    this.name = "PaymentError";
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    userMessage = "تعذّر الاتصال بخدمة خارجية، حاول مرة أخرى",
    cause?: unknown,
  ) {
    super({
      code: "external_service_error",
      message: `${service} request failed`,
      userMessage,
      cause,
    });
    this.name = "ExternalServiceError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
