import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

/**
 * مزوّد SMTP — هيكل جاهز، **غير مكتمل التنفيذ عمداً**.
 *
 * إرسال SMTP فعلي يتطلب مكتبة (مثل `nodemailer`) لأن بروتوكول SMTP الخام
 * ثقيل التنفيذ يدوياً وغير مناسب لكتابته هنا بلا اعتماديات جديدة —
 * وإضافة حزمة جديدة قرار يستحق موافقة صريحة (راجع `bunfig.toml`:
 * حارس منع تثبيت حزم عمرها أقل من 24 ساعة، وقاعدة المشروع بعدم إضافة
 * اعتماديات جديدة بصمت). القيم أدناه (`SMTP_HOST` إلخ) موثّقة وجاهزة —
 * أكمل `send()` بعد تثبيت `nodemailer` (أو مكافئ) عند الحاجة الفعلية.
 */
class SMTPEmailProvider implements EmailProvider {
  readonly name = "smtp";

  async send(_message: EmailMessage): Promise<EmailSendResult> {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    if (!host || !port || !user) {
      return {
        ok: false,
        error: "SMTP غير مُهيَّأ (SMTP_HOST/SMTP_PORT/SMTP_USER) — والتنفيذ نفسه غير مكتمل بعد",
        provider: this.name,
      };
    }
    return {
      ok: false,
      error: "SMTPProvider هيكل فقط — يحتاج مكتبة إرسال (مثل nodemailer) قبل أي استخدام فعلي",
      provider: this.name,
    };
  }
}

export const smtpEmailProvider = new SMTPEmailProvider();
