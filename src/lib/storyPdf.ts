/**
 * توليد ملف PDF عالي الجودة للقصة/الكتاب التعليمي في المتصفح:
 * غلاف + صفحات مرتبة (عنوان + نص + صورة + رقم الصفحة).
 * نعرض كل صفحة كعنصر DOM بخطوط الموقع ثم نحولها لصورة عالية الدقة داخل PDF
 * لضمان عرض العربية بشكل مثالي.
 */

export interface PdfStoryPage {
  n: number;
  title?: string | null;
  text: string;
  imageUrl?: string | null;
}

export interface StoryPdfInput {
  title: string;
  childName?: string | null;
  moral?: string | null;
  language: "ar" | "en";
  contentType?: "story" | "book";
  pages: PdfStoryPage[];
  onProgress?: (done: number, total: number) => void;
}

/* أبعاد A4 عند 96dpi — تُرفع الدقة ×2 عند اللقطة */
const PAGE_W = 794;
const PAGE_H = 1123;

const FONT = "'Baloo Bhaijaan 2','Rubik',sans-serif";
const BG = "#FFF9F0";
const INK = "#3B2B27";
const CORAL = "#E8604C";
const GOLD = "#F4B942";
const CREAM = "#FFE8C7";
const MUTED = "#8A7468";

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

function div(css: string): HTMLDivElement {
  const e = document.createElement("div");
  e.style.cssText = css;
  return e;
}

function textEl(tag: string, css: string, text: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  e.textContent = text;
  return e;
}

function pageShell(dir: "rtl" | "ltr"): HTMLDivElement {
  const e = div(
    `width:${PAGE_W}px;height:${PAGE_H}px;background:${BG};font-family:${FONT};color:${INK};display:flex;flex-direction:column;align-items:center;box-sizing:border-box;overflow:hidden;position:relative;`,
  );
  e.dir = dir;
  return e;
}

function buildCover(input: StoryPdfInput, coverImg: string | null): HTMLDivElement {
  const ar = input.language !== "en";
  const page = pageShell(ar ? "rtl" : "ltr");
  page.style.padding = "56px 60px";
  page.style.justifyContent = "center";
  page.style.textAlign = "center";

  page.appendChild(
    textEl(
      "div",
      `font-size:22px;font-weight:800;color:${CORAL};letter-spacing:1px;`,
      "✨ منصة حكايتي ✨",
    ),
  );
  page.appendChild(
    textEl(
      "div",
      `margin-top:10px;font-size:15px;font-weight:700;color:${MUTED};`,
      input.contentType === "book"
        ? ar
          ? "كتاب تعليمي ممتع"
          : "A fun educational book"
        : ar
          ? "قصة مصورة للأطفال"
          : "An illustrated children's story",
    ),
  );

  page.appendChild(
    textEl(
      "h1",
      `margin:26px 0 0;font-size:46px;line-height:1.35;font-weight:800;color:${INK};max-width:640px;`,
      input.title,
    ),
  );

  if (input.childName) {
    page.appendChild(
      textEl(
        "div",
        `margin-top:18px;display:inline-block;background:${CREAM};border:3px solid ${GOLD};border-radius:999px;padding:10px 28px;font-size:23px;font-weight:800;color:${INK};`,
        ar ? `⭐ بطل الحكاية: ${input.childName} ⭐` : `⭐ Our hero: ${input.childName} ⭐`,
      ),
    );
  }

  if (coverImg) {
    const img = document.createElement("img");
    img.src = coverImg;
    img.style.cssText = `margin-top:30px;width:430px;height:430px;object-fit:cover;border-radius:34px;border:6px solid ${GOLD};box-shadow:0 14px 34px rgba(59,43,39,0.18);`;
    page.appendChild(img);
  } else {
    page.appendChild(
      textEl(
        "div",
        `margin-top:30px;width:430px;height:430px;border-radius:34px;border:6px solid ${GOLD};background:${CREAM};display:flex;align-items:center;justify-content:center;font-size:120px;`,
        "📖",
      ),
    );
  }

  if (input.moral) {
    page.appendChild(
      textEl(
        "div",
        `margin-top:28px;background:#FDEAE5;border-radius:20px;padding:14px 30px;font-size:19px;font-weight:700;color:${CORAL};max-width:600px;`,
        ar ? `💝 ${input.moral}` : `💝 ${input.moral}`,
      ),
    );
  }

  page.appendChild(
    textEl(
      "div",
      `position:absolute;bottom:34px;left:0;right:0;text-align:center;font-size:14px;font-weight:700;color:${MUTED};`,
      "hekayati — حكايتي 🧡",
    ),
  );
  return page;
}

function buildContentPage(
  p: PdfStoryPage,
  imgData: string | null,
  childName: string | null | undefined,
  language: "ar" | "en",
): HTMLDivElement {
  const ar = language !== "en";
  const page = pageShell(ar ? "rtl" : "ltr");
  page.style.padding = "44px 52px 70px";

  if (imgData) {
    const img = document.createElement("img");
    img.src = imgData;
    img.style.cssText = `width:100%;height:580px;object-fit:cover;border-radius:28px;border:5px solid ${GOLD};box-shadow:0 10px 26px rgba(59,43,39,0.15);`;
    page.appendChild(img);
  } else {
    page.appendChild(
      textEl(
        "div",
        `width:100%;height:580px;border-radius:28px;border:5px solid ${GOLD};background:${CREAM};display:flex;align-items:center;justify-content:center;font-size:100px;`,
        "🎨",
      ),
    );
  }

  if (p.title) {
    page.appendChild(
      textEl(
        "h2",
        `margin:30px 0 0;font-size:31px;font-weight:800;color:${CORAL};text-align:center;max-width:660px;`,
        p.title,
      ),
    );
  }

  const text = childName ? p.text.replaceAll("{child}", childName) : p.text;
  page.appendChild(
    textEl(
      "p",
      `margin:${p.title ? "16px" : "32px"} 0 0;font-size:24px;line-height:1.95;font-weight:600;color:${INK};text-align:center;max-width:660px;`,
      text,
    ),
  );

  page.appendChild(
    textEl(
      "div",
      `position:absolute;bottom:26px;left:0;right:0;margin:0 auto;width:56px;height:56px;border-radius:999px;background:${CORAL};color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:800;`,
      String(p.n),
    ),
  );
  return page;
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

  // تحميل الصور كـ data URLs لتفادي مشاكل CORS عند اللقطة
  const imgMap = new Map<number, string>();
  await Promise.all(
    input.pages.map(async (p) => {
      if (!p.imageUrl) return;
      const data = await toDataUrl(p.imageUrl);
      if (data) imgMap.set(p.n, data);
    }),
  );

  const host = div(
    `position:fixed;left:-20000px;top:0;width:${PAGE_W}px;pointer-events:none;`,
  );
  document.body.appendChild(host);

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    compress: true,
  });

  const snap = async (el: HTMLElement, first: boolean) => {
    host.appendChild(el);
    const imgs = Array.from(el.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (im) =>
          new Promise<void>((resolve) => {
            if (im.complete) return resolve();
            im.onload = () => resolve();
            im.onerror = () => resolve();
          }),
      ),
    );
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: BG,
      logging: false,
    });
    const data = canvas.toDataURL("image/jpeg", 0.92);
    if (!first) pdf.addPage();
    pdf.addImage(data, "JPEG", 0, 0, 210, 297);
    host.removeChild(el);
    tick();
  };

  try {
    const firstImg = input.pages.find((p) => imgMap.has(p.n));
    await snap(buildCover(input, firstImg ? (imgMap.get(firstImg.n) ?? null) : null), true);

    for (const p of input.pages) {
      await snap(
        buildContentPage(p, imgMap.get(p.n) ?? null, input.childName, input.language),
        false,
      );
    }
  } finally {
    document.body.removeChild(host);
  }

  return pdf.output("blob");
}
