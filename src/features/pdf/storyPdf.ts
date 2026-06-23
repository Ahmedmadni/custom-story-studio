/**
 * توليد PDF مستطيل أفقي (Landscape 16:9) بلا هوامش بيضاء — كل صفحة صورة عريضة
 * تملأ كامل الورقة، مع نص الصفحة كـ overlay شفاف فوق الصورة.
 * يحتوي على شعار kidzy.life ورابط الموقع في الغلاف وكل الصفحات،
 * بالإضافة إلى صفحة غلاف خلفي ثابتة في نهاية كل ملف.
 */

import kidzyLogo from "@/assets/kidzy-logo.png.asset.json";

export interface PdfStoryPage {
  n: number;
  title?: string | null;
  text: string;
  title_ar?: string | null;
  text_ar?: string | null;
  title_en?: string | null;
  text_en?: string | null;
  imageUrl?: string | null;
}

export interface StoryPdfInput {
  title: string;
  childName?: string | null;
  moral?: string | null;
  language: "ar" | "en" | "bilingual";
  contentType?: "story" | "book";
  pages: PdfStoryPage[];
  onProgress?: (done: number, total: number) => void;
}

// صفحة عريضة 1920×1080 (16:9) — تتطابق مع نسبة الصور المولّدة
const PAGE_W = 1920;
const PAGE_H = 1080;
// أبعاد ورقية: A4 landscape ≈ 297×210، نستخدم 297×167 لتتطابق مع 16:9 تماماً
const PAGE_MM_W = 297;
const PAGE_MM_H = 167;

const SITE_URL = "kidzy.life";
const SITE_FULL = "https://kidzy.life";
const WHATSAPP = "01120016502";

const FONT = "'Cairo','Tajawal','Alexandria','Kufam',sans-serif";
const FALLBACK_BG = "#2A1F1A";

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function pageShell(dir: "rtl" | "ltr"): HTMLDivElement {
  const e = document.createElement("div");
  e.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;font-family:${FONT};color:#fff;position:relative;overflow:hidden;background:${FALLBACK_BG};box-sizing:border-box;`;
  e.dir = dir;
  return e;
}

function personalize(text: string | null | undefined, child?: string | null): string {
  if (!text) return "";
  return child ? text.replaceAll("{child}", child) : text;
}

function backgroundImage(el: HTMLDivElement, imgData: string | null) {
  if (imgData) {
    el.style.backgroundImage = `url('${imgData}')`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  } else {
    el.style.background = "linear-gradient(135deg,#6C4DFF,#FDEAE5)";
  }
}

function gradientOverlay(heightPct: number): HTMLDivElement {
  const g = document.createElement("div");
  g.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${heightPct}%;background:linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.65) 45%,rgba(0,0,0,0.2) 80%,rgba(0,0,0,0) 100%);pointer-events:none;`;
  return g;
}

/** شارة الموقع (شعار + رابط) — تُستخدم في كل الصفحات */
function brandBadge(logoData: string | null, position: "top-right" | "bottom-left" | "bottom-right", size: "sm" | "md" = "sm"): HTMLDivElement {
  const wrap = document.createElement("div");
  const pos =
    position === "top-right"
      ? "top:24px;right:24px"
      : position === "bottom-left"
        ? "bottom:24px;left:24px"
        : "bottom:24px;right:24px";
  const logoH = size === "md" ? 64 : 40;
  wrap.style.cssText = `position:absolute;${pos};display:flex;align-items:center;gap:10px;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);padding:8px 14px;border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,0.4);`;
  if (logoData) {
    const img = document.createElement("img");
    img.src = logoData;
    img.style.cssText = `height:${logoH}px;width:auto;display:block;`;
    wrap.appendChild(img);
  }
  const link = document.createElement("div");
  link.style.cssText = `color:#FFD86B;font-size:${size === "md" ? 22 : 16}px;font-weight:800;letter-spacing:1px;`;
  link.textContent = SITE_URL;
  wrap.appendChild(link);
  return wrap;
}

function buildCover(input: StoryPdfInput, coverImg: string | null, logoData: string | null): HTMLDivElement {
  const ar = input.language !== "en";
  const el = pageShell(ar ? "rtl" : "ltr");
  backgroundImage(el, coverImg);
  el.appendChild(gradientOverlay(60));

  // شارة الموقع أعلى يمين الغلاف
  el.appendChild(brandBadge(logoData, "top-right", "md"));

  const box = document.createElement("div");
  box.style.cssText = `position:absolute;left:60px;right:60px;bottom:70px;text-align:center;color:#fff;`;

  const brand = document.createElement("div");
  brand.style.cssText = `font-size:24px;font-weight:800;letter-spacing:3px;color:#FFD86B;text-shadow:0 2px 10px rgba(0,0,0,0.7);margin-bottom:18px;`;
  brand.textContent = "✨ منصة كيدزي ✨";
  box.appendChild(brand);

  const h1 = document.createElement("h1");
  h1.style.cssText = `margin:0;font-size:84px;line-height:1.1;font-weight:900;text-shadow:0 4px 20px rgba(0,0,0,0.8);`;
  h1.textContent = input.title;
  box.appendChild(h1);

  if (input.childName) {
    const hero = document.createElement("div");
    hero.style.cssText = `margin-top:22px;display:inline-block;background:rgba(255,216,107,0.95);color:#2A1F1A;border-radius:999px;padding:14px 40px;font-size:32px;font-weight:900;box-shadow:0 6px 24px rgba(0,0,0,0.45);`;
    hero.textContent = `⭐ بطل الحكاية: ${input.childName} ⭐`;
    box.appendChild(hero);
  }

  if (input.language === "bilingual") {
    const tag = document.createElement("div");
    tag.style.cssText = `margin-top:14px;font-size:16px;font-weight:700;color:#fff;opacity:.9;`;
    tag.textContent = "Bilingual edition — عربي / English";
    box.appendChild(tag);
  }

  el.appendChild(box);
  return el;
}

function buildContentPage(
  p: PdfStoryPage,
  imgData: string | null,
  childName: string | null | undefined,
  language: "ar" | "en" | "bilingual",
  logoData: string | null,
): HTMLDivElement {
  const ar = language !== "en";
  const el = pageShell(ar ? "rtl" : "ltr");
  backgroundImage(el, imgData);
  el.appendChild(gradientOverlay(language === "bilingual" ? 60 : 48));

  // رقم الصفحة دائرة في الأعلى
  const pageNum = document.createElement("div");
  pageNum.style.cssText = `position:absolute;top:28px;${ar ? "left:28px" : "right:28px"};width:68px;height:68px;border-radius:999px;background:rgba(232,96,76,0.95);color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;box-shadow:0 4px 16px rgba(0,0,0,0.45);`;
  pageNum.textContent = String(p.n);
  el.appendChild(pageNum);

  // شارة الموقع أسفل
  el.appendChild(brandBadge(logoData, ar ? "bottom-left" : "bottom-right", "sm"));

  const box = document.createElement("div");
  box.style.cssText = `position:absolute;left:80px;right:80px;bottom:90px;color:#fff;text-align:center;text-shadow:0 2px 12px rgba(0,0,0,0.88);`;

  if (language === "bilingual") {
    const arTitle = p.title_ar ?? p.title ?? null;
    const enTitle = p.title_en ?? null;
    const arText = personalize(p.text_ar ?? p.text, childName);
    const enText = personalize(p.text_en ?? "", childName);

    const arBlock = document.createElement("div");
    arBlock.dir = "rtl";
    if (arTitle) {
      const h = document.createElement("div");
      h.style.cssText = `font-size:36px;font-weight:900;color:#FFD86B;margin-bottom:6px;`;
      h.textContent = arTitle;
      arBlock.appendChild(h);
    }
    const pAr = document.createElement("div");
    pAr.style.cssText = `font-size:28px;line-height:1.55;font-weight:700;`;
    pAr.textContent = arText;
    arBlock.appendChild(pAr);
    box.appendChild(arBlock);

    const divider = document.createElement("div");
    divider.style.cssText = `width:40%;height:2px;background:rgba(255,216,107,0.7);margin:14px auto;border-radius:2px;`;
    box.appendChild(divider);

    const enBlock = document.createElement("div");
    enBlock.dir = "ltr";
    if (enTitle) {
      const h = document.createElement("div");
      h.style.cssText = `font-size:30px;font-weight:900;color:#FFD86B;margin-bottom:6px;`;
      h.textContent = enTitle;
      enBlock.appendChild(h);
    }
    if (enText) {
      const pEn = document.createElement("div");
      pEn.style.cssText = `font-size:24px;line-height:1.5;font-weight:700;`;
      pEn.textContent = enText;
      enBlock.appendChild(pEn);
    }
    box.appendChild(enBlock);
  } else {
    if (p.title) {
      const h = document.createElement("div");
      h.style.cssText = `font-size:44px;font-weight:900;color:#FFD86B;margin-bottom:12px;`;
      h.textContent = p.title;
      box.appendChild(h);
    }
    const text = personalize(p.text, childName);
    const pEl = document.createElement("div");
    pEl.style.cssText = `font-size:32px;line-height:1.6;font-weight:700;max-width:1500px;margin:0 auto;`;
    pEl.textContent = text;
    box.appendChild(pEl);
  }

  el.appendChild(box);
  return el;
}

/** صفحة الغلاف الخلفي الثابتة — بيانات الموقع والشعار */
function buildBackCover(logoData: string | null): HTMLDivElement {
  const el = pageShell("rtl");
  el.style.background =
    "linear-gradient(135deg,#6C4DFF 0%,#9B7CFF 45%,#FFD86B 100%)";

  const center = document.createElement("div");
  center.style.cssText = `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px;`;

  if (logoData) {
    const img = document.createElement("img");
    img.src = logoData;
    img.style.cssText = `height:240px;width:auto;margin-bottom:30px;filter:drop-shadow(0 10px 30px rgba(0,0,0,0.35));`;
    center.appendChild(img);
  }

  const thanks = document.createElement("div");
  thanks.style.cssText = `font-size:42px;font-weight:900;color:#fff;text-shadow:0 4px 18px rgba(0,0,0,0.4);margin-bottom:14px;max-width:1500px;line-height:1.4;`;
  thanks.textContent = "شكراً لاختياركم منصة كيدزي";
  center.appendChild(thanks);

  const tag = document.createElement("div");
  tag.style.cssText = `font-size:26px;font-weight:700;color:#fff;opacity:.95;margin-bottom:36px;max-width:1300px;line-height:1.5;`;
  tag.textContent = "قصص وكتب تعليمية تزرع القيم النبيلة في قلوب أطفالنا";
  center.appendChild(tag);

  const link = document.createElement("div");
  link.style.cssText = `display:inline-block;background:rgba(255,255,255,0.95);color:#6C4DFF;font-size:38px;font-weight:900;padding:18px 56px;border-radius:999px;letter-spacing:1px;box-shadow:0 10px 30px rgba(0,0,0,0.3);margin-bottom:24px;`;
  link.textContent = SITE_FULL;
  center.appendChild(link);

  const wa = document.createElement("div");
  wa.style.cssText = `font-size:24px;font-weight:800;color:#fff;background:rgba(37,211,102,0.95);padding:12px 32px;border-radius:999px;margin-bottom:30px;box-shadow:0 6px 20px rgba(0,0,0,0.25);`;
  wa.textContent = `📱 واتساب: ${WHATSAPP}`;
  center.appendChild(wa);

  const features = document.createElement("div");
  features.style.cssText = `display:flex;gap:22px;flex-wrap:wrap;justify-content:center;margin-bottom:30px;`;
  ["✨ قصص مخصصة باسم طفلك", "📚 كتب تعليمية تفاعلية", "🛡️ محتوى آمن للأطفال"].forEach((t) => {
    const chip = document.createElement("div");
    chip.style.cssText = `background:rgba(255,255,255,0.25);backdrop-filter:blur(8px);color:#fff;padding:10px 22px;border-radius:999px;font-size:18px;font-weight:700;border:1px solid rgba(255,255,255,0.4);`;
    chip.textContent = t;
    features.appendChild(chip);
  });
  center.appendChild(features);

  const copy = document.createElement("div");
  copy.style.cssText = `font-size:16px;color:rgba(255,255,255,0.85);font-weight:600;`;
  copy.textContent = `© ${new Date().getFullYear()} Kidzy — جميع الحقوق محفوظة`;
  center.appendChild(copy);

  el.appendChild(center);
  return el;
}

export async function generateStoryPdf(input: StoryPdfInput): Promise<Blob> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  // غلاف أمامي + صفحات المحتوى + غلاف خلفي
  const total = input.pages.length + 2;
  let done = 0;
  const tick = () => {
    done += 1;
    input.onProgress?.(done, total);
  };

  const [logoData, ...pageImageEntries] = await Promise.all([
    toDataUrl(kidzyLogo.url),
    ...input.pages.map(async (p) =>
      p.imageUrl ? ([p.n, await toDataUrl(p.imageUrl)] as const) : ([p.n, null] as const),
    ),
  ]);
  const imgMap = new Map<number, string>();
  for (const [n, data] of pageImageEntries) if (data) imgMap.set(n, data);

  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE_W}px;pointer-events:none;`;
  document.body.appendChild(host);

  const pdf = new jsPDF({
    unit: "mm",
    format: [PAGE_MM_W, PAGE_MM_H],
    orientation: "landscape",
    compress: true,
  });

  const snap = async (el: HTMLElement, first: boolean) => {
    host.appendChild(el);
    await new Promise<void>((r) => setTimeout(r, 80));
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: FALLBACK_BG,
      logging: false,
      useCORS: true,
    });
    const data = canvas.toDataURL("image/jpeg", 0.92);
    if (!first) pdf.addPage([PAGE_MM_W, PAGE_MM_H], "landscape");
    pdf.addImage(data, "JPEG", 0, 0, PAGE_MM_W, PAGE_MM_H);
    host.removeChild(el);
    tick();
  };

  try {
    const firstImg = input.pages.find((p) => imgMap.has(p.n));
    await snap(
      buildCover(input, firstImg ? (imgMap.get(firstImg.n) ?? null) : null, logoData),
      true,
    );

    for (const p of input.pages) {
      await snap(
        buildContentPage(
          p,
          imgMap.get(p.n) ?? null,
          input.childName,
          input.language,
          logoData,
        ),
        false,
      );
    }

    await snap(buildBackCover(logoData), false);
  } finally {
    document.body.removeChild(host);
  }

  return pdf.output("blob");
}
