import { SITE_URL } from "@/lib/siteUrl";

const BRAND_PURPLE = "#6C4DFF";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] ?? character;
  });
}

function renderVideoEmail(params: {
  title: string;
  body: string;
  ctaLabel?: string;
}) {
  const ctaUrl = `${SITE_URL}/my-videos`;
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#F5F3FF;font-family:Tajawal,Cairo,Arial,sans-serif;">
    <table role="presentation" width="100%" style="background:#F5F3FF;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" style="background:#ffffff;border-radius:24px;overflow:hidden;">
          <tr><td style="background:${BRAND_PURPLE};padding:24px;text-align:center;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;">كيدزي فيديو · Kidzy Video</span>
          </td></tr>
          <tr><td style="padding:32px 28px;text-align:right;color:#1F1B2E;">
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;">${params.title}</h1>
            <div style="font-size:15px;line-height:1.8;color:#4B4560;">${params.body}</div>
            <div style="margin-top:24px;text-align:center;">
              <a href="${ctaUrl}" style="display:inline-block;background:${BRAND_PURPLE};color:#ffffff;font-weight:800;padding:12px 28px;border-radius:999px;text-decoration:none;">${params.ctaLabel ?? "متابعة طلب الفيديو"}</a>
            </div>
          </td></tr>
          <tr><td style="padding:16px 28px;text-align:center;background:#F5F3FF;color:#8A84A0;font-size:12px;">
            كيدزي — فيديو مخصص لطفلك · ${SITE_URL.replace(/^https?:\/\//, "")}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export type VideoEmailTemplate = { subject: string; html: string };

export function videoOrderReceivedEmail(params: {
  childName: string;
  storyTitle: string;
  priceEgp?: number | null;
}): VideoEmailTemplate {
  const child = escapeHtml(params.childName);
  const story = escapeHtml(params.storyTitle);
  const price =
    typeof params.priceEgp === "number"
      ? ` بقيمة <b>${params.priceEgp.toLocaleString("ar-EG")} جنيه</b>`
      : "";
  return {
    subject: "استلمنا طلب فيديو كيدزي 🎬",
    html: renderVideoEmail({
      title: "تم استلام طلب الفيديو",
      body: `استلمنا طلب فيديو «<b>${story}</b>» لطفلك <b>${child}</b>${price}. إيصال التحويل الآن بانتظار مراجعة فريق كيدزي.`,
    }),
  };
}

export function videoPaymentConfirmedEmail(params: {
  childName: string;
  storyTitle: string;
  expectedDeliveryAt?: string | null;
}): VideoEmailTemplate {
  const child = escapeHtml(params.childName);
  const story = escapeHtml(params.storyTitle);
  const eta = params.expectedDeliveryAt
    ? ` الموعد المتوقع الحالي للتسليم: <b>${escapeHtml(
        new Date(params.expectedDeliveryAt).toLocaleString("ar-EG"),
      )}</b>.`
    : "";
  return {
    subject: "تم اعتماد تحويل فيديو كيدزي ✅",
    html: renderVideoEmail({
      title: "تم اعتماد التحويل وبدأ الإنتاج",
      body: `تم اعتماد سداد فيديو «<b>${story}</b>» لطفلك <b>${child}</b>. بدأ تجهيز المشاهد والإنتاج الآن.${eta}`,
    }),
  };
}

export function videoPaymentIssueEmail(params: {
  childName: string;
  storyTitle: string;
  reason: string;
}): VideoEmailTemplate {
  const child = escapeHtml(params.childName);
  const story = escapeHtml(params.storyTitle);
  const reason = escapeHtml(params.reason);
  return {
    subject: "مطلوب إيصال جديد لطلب فيديو كيدزي",
    html: renderVideoEmail({
      title: "نحتاج إيصال تحويل جديد",
      body: `تعذر اعتماد إيصال فيديو «<b>${story}</b>» لطفلك <b>${child}</b>.<br/><br/><b>السبب:</b> ${reason}<br/><br/>ارفع إيصالاً جديداً من صفحة «فيديوهاتي» وسيعود الطلب للمراجعة فوراً.`,
      ctaLabel: "رفع إيصال جديد",
    }),
  };
}

export function videoDeliveredEmail(params: {
  childName: string;
  storyTitle: string;
}): VideoEmailTemplate {
  const child = escapeHtml(params.childName);
  const story = escapeHtml(params.storyTitle);
  return {
    subject: "فيديو طفلك جاهز في كيدزي 🎉",
    html: renderVideoEmail({
      title: "الفيديو جاهز للمشاهدة",
      body: `اكتمل فيديو «<b>${story}</b>» لطفلك <b>${child}</b> وتم تسليمه داخل حسابك. افتح صفحة «فيديوهاتي» لمشاهدته.`,
      ctaLabel: "مشاهدة الفيديو",
    }),
  };
}
