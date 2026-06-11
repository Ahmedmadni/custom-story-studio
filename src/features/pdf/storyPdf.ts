/**
 * توليد PDF بلا هوامش بيضاء — كل صفحة = صورة مربعة تملأ كامل الورقة،
 * مع نص الصفحة كـ overlay شفاف فوق الصورة (شريط سفلي مدمج مع المشهد).
 * يدعم العربي فقط / الإنجليزي فقط / الوضع الثنائي.
 */

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

// صفحة مربعة 1024px — تتطابق مع حجم صور الذكاء الاصطناعي
const PAGE = 1024;
const PAGE_MM = 250; // 25cm × 25cm — حجم كتاب أطفال فاخر بلا هوامش

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
  e.style.cssText = `width:${PAGE}px;height:${PAGE}px;font-family:${FONT};color:#fff;position:relative;overflow:hidden;background:${FALLBACK_BG};box-sizing:border-box;`;
  e.dir = dir;
  return e;
}

function personalize(text: string | null | undefined, child?: string | null): string {
  if (!text) return "";
  return child ? text.replaceAll("{child}", child) : text;
}

/** خلفية الصورة تملأ كامل الصفحة بدون أي إطار */
function backgroundImage(el: HTMLDivElement, imgData: string | null) {
  if (imgData) {
    el.style.backgroundImage = `url('${imgData}')`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  } else {
    el.style.background = "linear-gradient(135deg,#FFE8C7,#FDEAE5)";
  }
}

/** شريط متدرّج من شفاف لأسود قرب الأسفل لإبراز النص */
function gradientOverlay(heightPct: number): HTMLDivElement {
  const g = document.createElement("div");
  g.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${heightPct}%;background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.65) 45%,rgba(0,0,0,0.25) 80%,rgba(0,0,0,0) 100%);pointer-events:none;`;
  return g;
}

function buildCover(input: StoryPdfInput, coverImg: string | null): HTMLDivElement {
  const ar = input.language !== "en";
  const el = pageShell(ar ? "rtl" : "ltr");
  backgroundImage(el, coverImg);
  el.appendChild(gradientOverlay(55));

  const box = document.createElement("div");
  box.style.cssText = `position:absolute;left:40px;right:40px;bottom:48px;text-align:center;color:#fff;`;

  const brand = document.createElement("div");
  brand.style.cssText = `font-size:22px;font-weight:800;letter-spacing:2px;color:#FFD86B;text-shadow:0 2px 10px rgba(0,0,0,0.6);margin-bottom:18px;`;
  brand.textContent = "✨ منصة حكايتي ✨";
  box.appendChild(brand);

  const h1 = document.createElement("h1");
  h1.style.cssText = `margin:0;font-size:68px;line-height:1.15;font-weight:900;text-shadow:0 4px 18px rgba(0,0,0,0.75);`;
  h1.textContent = input.title;
  box.appendChild(h1);

  if (input.childName) {
    const hero = document.createElement("div");
    hero.style.cssText = `margin-top:24px;display:inline-block;background:rgba(255,216,107,0.95);color:#2A1F1A;border-radius:999px;padding:14px 36px;font-size:30px;font-weight:900;box-shadow:0 6px 24px rgba(0,0,0,0.45);`;
    hero.textContent = `⭐ بطل الحكاية: ${input.childName} ⭐`;
    box.appendChild(hero);
  }

  if (input.language === "bilingual") {
    const tag = document.createElement("div");
    tag.style.cssText = `margin-top:14px;font-size:14px;font-weight:700;color:#fff;opacity:.9;`;
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
): HTMLDivElement {
  const ar = language !== "en";
  const el = pageShell(ar ? "rtl" : "ltr");
  backgroundImage(el, imgData);
  el.appendChild(gradientOverlay(language === "bilingual" ? 55 : 45));

  // رقم الصفحة دائرة في الأعلى
  const pageNum = document.createElement("div");
  pageNum.style.cssText = `position:absolute;top:28px;${ar ? "left:28px" : "right:28px"};width:64px;height:64px;border-radius:999px;background:rgba(232,96,76,0.95);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;box-shadow:0 4px 16px rgba(0,0,0,0.4);`;
  pageNum.textContent = String(p.n);
  el.appendChild(pageNum);

  const box = document.createElement("div");
  box.style.cssText = `position:absolute;left:32px;right:32px;bottom:36px;color:#fff;text-align:center;text-shadow:0 2px 12px rgba(0,0,0,0.85);`;

  if (language === "bilingual") {
    const arTitle = p.title_ar ?? p.title ?? null;
    const enTitle = p.title_en ?? null;
    const arText = personalize(p.text_ar ?? p.text, childName);
    const enText = personalize(p.text_en ?? "", childName);

    const arBlock = document.createElement("div");
    arBlock.dir = "rtl";
    if (arTitle) {
      const h = document.createElement("div");
      h.style.cssText = `font-size:34px;font-weight:900;color:#FFD86B;margin-bottom:6px;`;
      h.textContent = arTitle;
      arBlock.appendChild(h);
    }
    const pAr = document.createElement("div");
    pAr.style.cssText = `font-size:26px;line-height:1.55;font-weight:700;`;
    pAr.textContent = arText;
    arBlock.appendChild(pAr);
    box.appendChild(arBlock);

    const divider = document.createElement("div");
    divider.style.cssText = `width:50%;height:2px;background:rgba(255,216,107,0.65);margin:14px auto;border-radius:2px;`;
    box.appendChild(divider);

    const enBlock = document.createElement("div");
    enBlock.dir = "ltr";
    if (enTitle) {
      const h = document.createElement("div");
      h.style.cssText = `font-size:28px;font-weight:900;color:#FFD86B;margin-bottom:6px;`;
      h.textContent = enTitle;
      enBlock.appendChild(h);
    }
    if (enText) {
      const pEn = document.createElement("div");
      pEn.style.cssText = `font-size:22px;line-height:1.5;font-weight:700;`;
      pEn.textContent = enText;
      enBlock.appendChild(pEn);
    }
    box.appendChild(enBlock);
  } else {
    if (p.title) {
      const h = document.createElement("div");
      h.style.cssText = `font-size:40px;font-weight:900;color:#FFD86B;margin-bottom:10px;`;
      h.textContent = p.title;
      box.appendChild(h);
    }
    const text = personalize(p.text, childName);
    const pEl = document.createElement("div");
    pEl.style.cssText = `font-size:30px;line-height:1.6;font-weight:700;max-width:920px;margin:0 auto;`;
    pEl.textContent = text;
    box.appendChild(pEl);
  }

  el.appendChild(box);
  return el;
}

export async function generateStoryPdf(input: StoryPdfInput): Promise<Blob> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  const total = input.pages.length + 1;
  let done = 0;
  const tick = () => {
    done += 1;
    input.onProgress?.(done, total);
  };

  const imgMap = new Map<number, string>();
  await Promise.all(
    input.pages.map(async (p) => {
      if (!p.imageUrl) return;
      const data = await toDataUrl(p.imageUrl);
      if (data) imgMap.set(p.n, data);
    }),
  );

  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE}px;pointer-events:none;`;
  document.body.appendChild(host);

  // صفحة PDF مربعة — تتطابق مع حجم الصور بلا أي هوامش
  const pdf = new jsPDF({
    unit: "mm",
    format: [PAGE_MM, PAGE_MM],
    orientation: "portrait",
    compress: true,
  });

  const snap = async (el: HTMLElement, first: boolean) => {
    host.appendChild(el);
    // انتظار تحميل background images
    await new Promise<void>((r) => setTimeout(r, 60));
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: FALLBACK_BG,
      logging: false,
      useCORS: true,
    });
    const data = canvas.toDataURL("image/jpeg", 0.92);
    if (!first) pdf.addPage([PAGE_MM, PAGE_MM]);
    // يملأ كامل الصفحة من 0,0 — لا هوامش
    pdf.addImage(data, "JPEG", 0, 0, PAGE_MM, PAGE_MM);
    host.removeChild(el);
    tick();
  };

  try {
    const firstImg = input.pages.find((p) => imgMap.has(p.n));
    await snap(
      buildCover(input, firstImg ? (imgMap.get(firstImg.n) ?? null) : null),
      true,
    );

    for (const p of input.pages) {
      await snap(
        buildContentPage(
          p,
          imgMap.get(p.n) ?? null,
          input.childName,
          input.language,
        ),
        false,
      );
    }
  } finally {
    document.body.removeChild(host);
  }

  return pdf.output("blob");
}
