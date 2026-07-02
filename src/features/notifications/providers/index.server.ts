import type { EmailProvider } from "./types";
import { mockEmailProvider } from "./mockProvider";
import { resendEmailProvider } from "./resendProvider.server";
import { smtpEmailProvider } from "./smtpProvider.server";

export type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

/**
 * مصنع مزوّد البريد — يختار المزوّد حسب `EMAIL_PROVIDER` (resend | smtp |
 * mock). الافتراضي `mock` دائماً حتى لو المتغيّر غير مضبوط، حتى لا يُرسَل
 * بريد حقيقي بالخطأ قبل تفعيل هذا النظام عمداً.
 *
 * الاستخدام المستقبلي (لم يُربَط بعد بأي حدث في التطبيق):
 * ```ts
 * const provider = getEmailProvider();
 * const { subject, html } = welcomeEmail({ displayName });
 * await provider.send({ to: userEmail, subject, html });
 * ```
 */
export function getEmailProvider(): EmailProvider {
  const choice = (process.env.EMAIL_PROVIDER || "mock").toLowerCase();
  switch (choice) {
    case "resend":
      return resendEmailProvider;
    case "smtp":
      return smtpEmailProvider;
    default:
      return mockEmailProvider;
  }
}
