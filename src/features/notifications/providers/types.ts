/**
 * واجهة مزوّد البريد الإلكتروني (Phase 3 — Production Hardening Sprint).
 *
 * بنية تحتية فقط — لا يوجد أي استدعاء فعلي لـ `.send()` من أي مكان في
 * التطبيق بعد. راجع docs/EMAIL-ARCHITECTURE.md لخطة الربط الفعلي لاحقاً.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  /** نسخة نصية اختيارية لعملاء البريد التي لا تعرض HTML */
  text?: string;
  replyTo?: string;
};

export type EmailSendResult =
  | { ok: true; id?: string; provider: string }
  | { ok: false; error: string; provider: string };

export interface EmailProvider {
  /** اسم المزوّد — يُستخدم في السجلات ونتيجة الإرسال */
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
