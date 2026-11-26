import { isMark, type Mark } from "./paint";
import { drawingStorageKey } from "./progress";

export interface DrawingBackup {
  app: "kidzy-drawing";
  version: 1;
  exportedAt: string;
  drawings: Record<string, Mark[]>;
}

export function createDrawingBackup(
  storage: Pick<Storage, "getItem">,
  ids: readonly string[],
): DrawingBackup {
  const drawings: Record<string, Mark[]> = {};
  for (const id of ids) {
    const raw = storage.getItem(drawingStorageKey(id));
    if (raw === null) continue;
    let marks: unknown;
    try {
      marks = JSON.parse(raw);
    } catch {
      throw new Error(`تعذّر قراءة الرسمة المحفوظة ${id}.`);
    }
    if (!Array.isArray(marks) || !marks.every(isMark)) {
      throw new Error(`بيانات الرسمة ${id} غير صالحة للنسخ.`);
    }
    if (marks.length) drawings[id] = marks;
  }
  return { app: "kidzy-drawing", version: 1, exportedAt: new Date().toISOString(), drawings };
}

export function parseDrawingBackup(text: string, ids: readonly string[]): DrawingBackup {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("الملف ليس نسخة احتياطية صالحة.");
  }
  if (!value || typeof value !== "object") throw new Error("الملف ليس نسخة احتياطية صالحة.");
  const backup = value as Partial<DrawingBackup>;
  if (
    backup.app !== "kidzy-drawing" ||
    backup.version !== 1 ||
    typeof backup.exportedAt !== "string" ||
    !backup.drawings ||
    typeof backup.drawings !== "object" ||
    Array.isArray(backup.drawings)
  ) {
    throw new Error("صيغة النسخة الاحتياطية غير مدعومة.");
  }
  const allowed = new Set(ids);
  const entries = Object.entries(backup.drawings);
  if (!entries.length) throw new Error("النسخة الاحتياطية خالية من الرسومات.");
  for (const [id, marks] of entries) {
    if (!allowed.has(id) || !Array.isArray(marks) || !marks.length || !marks.every(isMark)) {
      throw new Error(`تعذّر استعادة الرسمة ${id}. تحقق من ملف النسخة.`);
    }
  }
  return backup as DrawingBackup;
}

export function restoreDrawingBackup(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  backup: DrawingBackup,
  replace: boolean,
): number {
  const changes: { key: string; previous: string | null; next: string }[] = [];
  for (const [id, marks] of Object.entries(backup.drawings)) {
    const key = drawingStorageKey(id);
    const previous = storage.getItem(key);
    if (previous === null || replace) changes.push({ key, previous, next: JSON.stringify(marks) });
  }
  try {
    for (const { key, next } of changes) storage.setItem(key, next);
  } catch {
    try {
      // Free space first, so restoring larger originals works after a quota error.
      for (const { key } of changes) storage.removeItem(key);
      for (const { key, previous } of changes) {
        if (previous !== null) storage.setItem(key, previous);
      }
    } catch {
      throw new Error("تعذّر إكمال الاستعادة. راجع رسوماتي قبل إعادة المحاولة.");
    }
    throw new Error("تعذّر الحفظ على هذا الجهاز. لم تتغير الرسومات الموجودة.");
  }
  return changes.length;
}
