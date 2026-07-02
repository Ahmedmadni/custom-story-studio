/**
 * مكتبة قوالب البريد الإلكتروني (F5) — محتوى فقط، بلا إرسال فعلي.
 *
 * لا يوجد أي تكامل بريد إلكتروني (Resend/SMTP) في هذا المشروع حالياً، وربطه
 * يُعتبر بنية تحتية جديدة تتجاوز نطاق "لا ميزات جوهرية جديدة" لهذه الميلستون.
 * هذه القوالب جاهزة للاستخدام بمجرد إضافة مزوّد بريد (راجع
 * docs/DEVELOPMENT-PLAN.md) — مرّر بيانات كل حدث لدالته وستحصل على
 * { subject, html } جاهزين للإرسال.
 */

import { SITE_URL } from "@/lib/siteUrl";

const BRAND_PURPLE = "#6C4DFF";

function renderEmail({
  title,
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: {
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#F5F3FF;font-family:Tajawal,Cairo,Arial,sans-serif;">
    <table role="presentation" width="100%" style="background:#F5F3FF;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" style="background:#ffffff;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="background:${BRAND_PURPLE};padding:24px;text-align:center;">
                <span style="font-size:22px;font-weight:800;color:#ffffff;">كيدزي · Kidzy</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;text-align:right;color:#1F1B2E;">
                <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;">${title}</h1>
                <div style="font-size:15px;line-height:1.8;color:#4B4560;">${bodyHtml}</div>
                ${
                  ctaLabel && ctaUrl
                    ? `<div style="margin-top:24px;text-align:center;">
                        <a href="${ctaUrl}" style="display:inline-block;background:${BRAND_PURPLE};color:#ffffff;font-weight:800;padding:12px 28px;border-radius:999px;text-decoration:none;">${ctaLabel}</a>
                      </div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;text-align:center;background:#F5F3FF;color:#8A84A0;font-size:12px;">
                كيدزي — قصص تزرع القيم في قلوب الأطفال · ${SITE_URL.replace(/^https?:\/\//, "")}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type EmailTemplate = { subject: string; html: string };

export function welcomeEmail(params: { displayName?: string | null }): EmailTemplate {
  const name = params.displayName?.trim() || "صديق كيدزي";
  return {
    subject: "أهلاً بك في كيدزي! 🎉",
    html: renderEmail({
      title: `أهلاً ${name}!`,
      bodyHtml:
        "يسعدنا انضمامك إلى كيدزي. أنشئ ملف طفلك الأول وابدأ رحلة القصص المصوّرة التي بطلها طفلك.",
      ctaLabel: "أنشئ ملف طفلك",
      ctaUrl: `${SITE_URL}/children/create`,
    }),
  };
}

export function orderReceivedEmail(params: {
  childName: string;
  storyTitle: string;
}): EmailTemplate {
  return {
    subject: "استلمنا طلبك 📦",
    html: renderEmail({
      title: "استلمنا طلبك!",
      bodyHtml: `طلب قصة «${params.storyTitle}» لِـ${params.childName} قيد المراجعة الآن. سنبدأ فور تأكيد الدفع.`,
      ctaLabel: "تابع حالة طلبك",
      ctaUrl: `${SITE_URL}/my-orders`,
    }),
  };
}

export function paymentConfirmedEmail(params: {
  childName: string;
  storyTitle: string;
}): EmailTemplate {
  return {
    subject: "تم تأكيد الدفع ✅",
    html: renderEmail({
      title: "تم تأكيد دفعتك!",
      bodyHtml: `أكّدنا دفعتك لقصة «${params.storyTitle}» لِـ${params.childName}. سيبدأ فريقنا في توليد الصفحات الآن.`,
      ctaLabel: "تابع حالة طلبك",
      ctaUrl: `${SITE_URL}/my-orders`,
    }),
  };
}

export function storyStartedEmail(params: {
  childName: string;
  storyTitle: string;
}): EmailTemplate {
  return {
    subject: "بدأنا في صنع قصتك ✨",
    html: renderEmail({
      title: "القصة قيد التوليد الآن",
      bodyHtml: `بدأ فريقنا في تحويل صورة ${params.childName} إلى بطل قصة «${params.storyTitle}». سنُعلمك فور الانتهاء.`,
    }),
  };
}

export function storyCompletedEmail(params: {
  childName: string;
  storyTitle: string;
  pdfUrl?: string;
}): EmailTemplate {
  return {
    subject: "قصة طفلك جاهزة! 🎉",
    html: renderEmail({
      title: "قصتك جاهزة!",
      bodyHtml: `اكتملت قصة «${params.storyTitle}» بطولة ${params.childName}. حمّلها الآن أو راجعها على واتساب.`,
      ctaLabel: params.pdfUrl ? "تحميل القصة" : "عرض القصة",
      ctaUrl: params.pdfUrl ?? `${SITE_URL}/my-orders`,
    }),
  };
}

export function achievementUnlockedEmail(params: {
  childName: string;
  achievementTitle: string;
  achievementEmoji: string;
}): EmailTemplate {
  return {
    subject: `إنجاز جديد لـ${params.childName}! ${params.achievementEmoji}`,
    html: renderEmail({
      title: "إنجاز جديد مفتوح!",
      bodyHtml: `${params.achievementEmoji} فتح ${params.childName} إنجاز «${params.achievementTitle}» — استمر في القراءة لفتح المزيد!`,
      ctaLabel: "شاهد إنجازات طفلك",
      ctaUrl: `${SITE_URL}/my-children`,
    }),
  };
}

export function levelUpEmail(params: {
  childName: string;
  level: number;
  levelLabel: string;
  levelEmoji: string;
}): EmailTemplate {
  return {
    subject: `${params.childName} ترقّى إلى مستوى جديد! ${params.levelEmoji}`,
    html: renderEmail({
      title: "ترقية مستوى!",
      bodyHtml: `${params.levelEmoji} وصل ${params.childName} إلى المستوى ${params.level} — «${params.levelLabel}»! تهانينا.`,
      ctaLabel: "شاهد التقدّم",
      ctaUrl: `${SITE_URL}/my-children`,
    }),
  };
}

export function referralBonusEmail(params: { points: number }): EmailTemplate {
  return {
    subject: `دعوتك نجحت! +${params.points} نقطة 🎁`,
    html: renderEmail({
      title: "مكافأة إحالة!",
      bodyHtml: `صديقك انضم عبر رابطك — حصلت على ${params.points} نقطة في حساب مكافآت كيدزي.`,
      ctaLabel: "شاهد رصيدك",
      ctaUrl: `${SITE_URL}/rewards`,
    }),
  };
}

export function rewardEarnedEmail(params: { points: number; reason: string }): EmailTemplate {
  return {
    subject: `+${params.points} نقطة جديدة! ⭐`,
    html: renderEmail({
      title: "نقاط جديدة في حسابك!",
      bodyHtml: `كسبت ${params.points} نقطة (${params.reason}). تصفّح المكافآت المتاحة للاستبدال.`,
      ctaLabel: "استبدل نقاطك",
      ctaUrl: `${SITE_URL}/rewards`,
    }),
  };
}
