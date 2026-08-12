/**
 * مترجم نصوص الصفحة أثناء التشغيل:
 * يستبدل النصوص العربية بالإنجليزية اعتمادًا على القاموس المُولَّد،
 * ويعيدها كما كانت عند التبديل للعربية.
 */

type Cleanup = () => void;

const AR_RE = /[\u0600-\u06FF]/;
const AR_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);
const INLINE_TAGS = new Set(["SPAN", "B", "STRONG", "EM", "I", "U", "SMALL", "BR", "MARK"]);

const ATTRS = ["placeholder", "title", "aria-label", "alt", "value"] as const;

/** إزالة التشكيل والتطويل وتوحيد الألف/الياء/التاء المربوطة وتقليص المسافات */
function normalize(value: string): string {
  return value
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u200f\u200e\u00a0]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** تحويل الأرقام العربية-الهندية إلى أرقام لاتينية */
function latinDigits(value: string): string {
  return value.replace(AR_DIGITS, (d) =>
    String(
      d.charCodeAt(0) >= 0x06f0 ? d.charCodeAt(0) - 0x06f0 : d.charCodeAt(0) - 0x0660,
    ),
  );
}

export async function startDomTranslation(): Promise<Cleanup> {
  const { AR_EN } = await import("./i18nDict");

  const NORM: Record<string, string> = {};
  for (const [ar, en] of Object.entries(AR_EN)) {
    const key = normalize(ar);
    if (key && !(key in NORM)) NORM[key] = en;
  }

  // النصوص الأصلية للاستعادة لاحقًا
  const originalText = new Map<Text, string>();
  const originalAttr = new Map<Element, Map<string, string>>();
  const originalHtml = new Map<Element, string>();

  const translate = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (!AR_RE.test(trimmed)) {
      const digits = latinDigits(trimmed);
      return digits === trimmed ? null : raw.replace(trimmed, digits);
    }
    const hit = AR_EN[trimmed] ?? NORM[normalize(trimmed)];
    if (!hit) {
      const digits = latinDigits(trimmed);
      return digits === trimmed ? null : raw.replace(trimmed, digits);
    }
    return raw.replace(trimmed, hit);
  };

  const translateAttrs = (el: Element) => {
    for (const attr of ATTRS) {
      const current = el.getAttribute(attr);
      if (!current) continue;
      const next = translate(current);
      if (!next || next === current) continue;
      let store = originalAttr.get(el);
      if (!store) {
        store = new Map();
        originalAttr.set(el, store);
      }
      if (!store.has(attr)) store.set(attr, current);
      el.setAttribute(attr, next);
    }
  };

  const translateTextNode = (text: Text) => {
    const parent = text.parentElement;
    if (parent && SKIP_TAGS.has(parent.tagName)) return;
    const next = translate(text.nodeValue ?? "");
    if (next && next !== text.nodeValue) {
      if (!originalText.has(text)) originalText.set(text, text.nodeValue ?? "");
      text.nodeValue = next;
    }
  };

  /** عنصر نصّه موزّع على عناصر داخلية (مثل العناوين المتدرجة الألوان) */
  const tryWholeElement = (el: Element): boolean => {
    if (el.children.length === 0) return false;
    if (originalHtml.has(el)) return false;
    for (const child of Array.from(el.children)) {
      if (!INLINE_TAGS.has(child.tagName) || child.children.length > 0) return false;
    }
    const raw = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!raw || !AR_RE.test(raw)) return false;
    const hit = AR_EN[raw] ?? NORM[normalize(raw)];
    if (!hit) return false;
    originalHtml.set(el, el.innerHTML);
    el.textContent = hit;
    return true;
  };

  const translateNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (SKIP_TAGS.has(el.tagName)) return;

    translateAttrs(el);
    el.querySelectorAll("*").forEach(translateAttrs);

    // محاولة ترجمة العناصر المركّبة أولًا ثم العُقد النصية المتبقية
    if (!tryWholeElement(el)) {
      el.querySelectorAll("*").forEach((child) => {
        if (!SKIP_TAGS.has(child.tagName)) tryWholeElement(child);
      });
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const pending: Text[] = [];
      while (walker.nextNode()) pending.push(walker.currentNode as Text);
      pending.forEach(translateTextNode);
    }
  };

  const run = () => translateNode(document.body);

  run();

  const config: MutationObserverInit = {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  };

  let sweepTimer: ReturnType<typeof setTimeout> | undefined;

  const observer = new MutationObserver((records) => {
    observer.disconnect();
    for (const record of records) {
      record.addedNodes.forEach(translateNode);
      if (record.type === "characterData") translateNode(record.target);
      if (record.type === "attributes" && record.target.nodeType === Node.ELEMENT_NODE) {
        translateAttrs(record.target as Element);
      }
    }
    observer.observe(document.body, config);

    // كنس شامل مؤجَّل يلتقط أي تغييرات حدثت أثناء فصل المراقب
    if (sweepTimer) clearTimeout(sweepTimer);
    sweepTimer = setTimeout(() => {
      observer.disconnect();
      run();
      observer.observe(document.body, config);
    }, 250);
  });

  observer.observe(document.body, config);

  return () => {
    if (sweepTimer) clearTimeout(sweepTimer);

    observer.disconnect();
    originalHtml.forEach((html, el) => {
      if (el.isConnected) el.innerHTML = html;
    });
    originalText.forEach((value, node) => {
      if (node.isConnected) node.nodeValue = value;
    });
    originalAttr.forEach((store, el) => {
      if (!el.isConnected) return;
      store.forEach((value, attr) => el.setAttribute(attr, value));
    });
    originalHtml.clear();
    originalText.clear();
    originalAttr.clear();
  };
}
