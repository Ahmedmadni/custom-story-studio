/**
 * مترجم نصوص الصفحة أثناء التشغيل:
 * يستبدل النصوص العربية بالإنجليزية اعتمادًا على القاموس المُولَّد،
 * ويعيدها كما كانت عند التبديل للعربية.
 */

type Cleanup = () => void;

const AR_RE = /[\u0600-\u06FF]/;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"]);

const ATTRS = ["placeholder", "title", "aria-label", "alt", "value"] as const;

export async function startDomTranslation(): Promise<Cleanup> {
  const { AR_EN } = await import("./i18nDict");

  // النصوص الأصلية للاستعادة لاحقًا
  const originalText = new Map<Text, string>();
  const originalAttr = new Map<Element, Map<string, string>>();

  const lookup = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || !AR_RE.test(trimmed)) return null;
    const hit = AR_EN[trimmed];
    if (!hit) return null;
    return raw.replace(trimmed, hit);
  };

  const translateNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      const parent = text.parentElement;
      if (parent && SKIP_TAGS.has(parent.tagName)) return;
      const next = lookup(text.nodeValue ?? "");
      if (next && next !== text.nodeValue) {
        if (!originalText.has(text)) originalText.set(text, text.nodeValue ?? "");
        text.nodeValue = next;
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (SKIP_TAGS.has(el.tagName)) return;

    for (const attr of ATTRS) {
      const current = el.getAttribute(attr);
      if (!current) continue;
      const next = lookup(current);
      if (!next || next === current) continue;
      let store = originalAttr.get(el);
      if (!store) {
        store = new Map();
        originalAttr.set(el, store);
      }
      if (!store.has(attr)) store.set(attr, current);
      el.setAttribute(attr, next);
    }

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const pending: Text[] = [];
    while (walker.nextNode()) pending.push(walker.currentNode as Text);
    pending.forEach(translateNode);

    el.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach((child) => {
      for (const attr of ATTRS) {
        const current = child.getAttribute(attr);
        if (!current) continue;
        const next = lookup(current);
        if (!next || next === current) continue;
        let store = originalAttr.get(child);
        if (!store) {
          store = new Map();
          originalAttr.set(child, store);
        }
        if (!store.has(attr)) store.set(attr, current);
        child.setAttribute(attr, next);
      }
    });
  };

  const run = () => translateNode(document.body);

  run();

  const observer = new MutationObserver((records) => {
    observer.disconnect();
    for (const record of records) {
      record.addedNodes.forEach(translateNode);
      if (record.type === "characterData") translateNode(record.target);
      if (record.type === "attributes" && record.target.nodeType === Node.ELEMENT_NODE) {
        translateNode(record.target);
      }
    }
    observer.observe(document.body, config);
  });

  const config: MutationObserverInit = {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  };
  observer.observe(document.body, config);

  return () => {
    observer.disconnect();
    originalText.forEach((value, node) => {
      if (node.isConnected) node.nodeValue = value;
    });
    originalAttr.forEach((store, el) => {
      if (!el.isConnected) return;
      store.forEach((value, attr) => el.setAttribute(attr, value));
    });
    originalText.clear();
    originalAttr.clear();
  };
}
