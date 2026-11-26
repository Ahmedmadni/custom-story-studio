import { collections, type Sheet } from "./catalog";

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase()
    .trim();
}

const groupNames = new Map<string, string>(collections.map((item) => [item.id, item.title]));

export function matchesDrawingText(text: string, query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const normalized = normalize(text);
  return words.every((word) => normalized.includes(word));
}

export function matchesDrawingSearch(sheet: Sheet, query: string) {
  return matchesDrawingText(`${sheet.title} ${groupNames.get(sheet.group) ?? ""}`, query);
}
