import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

/**
 * مزوّد وهمي — لا يرسل شيئاً فعلياً، فقط يسجّل الرسالة في الكونسول ويحتفظ
 * بها في ذاكرة العملية الحالية. آمن للاستخدام في أي بيئة (تطوير، اختبار،
 * أو كافتراضي في الإنتاج طالما لم يُربَط مزوّد حقيقي بعد — لا خطر إرسال
 * بريد فعلي بالخطأ).
 */
class MockEmailProvider implements EmailProvider {
  readonly name = "mock";

  /** آخر الرسائل "المُرسَلة" — مفيد للاختبارات والتفتيش اليدوي فقط */
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(message);
    console.log(`[email:mock] → ${message.to} — ${message.subject}`);
    return { ok: true, id: `mock_${Date.now()}`, provider: this.name };
  }
}

export const mockEmailProvider = new MockEmailProvider();
