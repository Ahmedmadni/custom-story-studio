import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

/**
 * مزوّد Resend — يستخدم REST API مباشرة عبر fetch (لا حزمة SDK إضافية، لا
 * اعتماديات جديدة). يقرأ `RESEND_API_KEY` و`EMAIL_FROM` من env داخل الدالة
 * (وليس على مستوى الملف) بنفس نمط `src/lib/config.server.ts` في هذا
 * المشروع — Cloudflare Workers تربط env عند الطلب لا عند تحميل الوحدة.
 *
 * جاهز للعمل بمجرد ضبط المفتاح، لكن لا شيء في التطبيق يستدعيه بعد.
 */
class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "Kidzy <no-reply@kidzy.life>";
    if (!apiKey) {
      return { ok: false, error: "RESEND_API_KEY غير مُعرَّف", provider: this.name };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `Resend ${res.status}: ${body}`, provider: this.name };
      }

      const json = (await res.json()) as { id?: string };
      return { ok: true, id: json.id, provider: this.name };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "تعذر الاتصال بـ Resend",
        provider: this.name,
      };
    }
  }
}

export const resendEmailProvider = new ResendEmailProvider();
