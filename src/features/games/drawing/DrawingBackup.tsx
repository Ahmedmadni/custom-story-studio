import { useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { sheets } from "./catalog";
import {
  createDrawingBackup,
  parseDrawingBackup,
  restoreDrawingBackup,
  type DrawingBackup as BackupFile,
} from "./backup";
import { drawingStorageKey } from "./progress";

const ids = ["blank", ...sheets.map((sheet) => sheet.id)];
const maximumFileSize = 20 * 1024 * 1024;

export function DrawingBackup() {
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [overlap, setOverlap] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function exportDrawings() {
    try {
      const backup = createDrawingBackup(localStorage, ids);
      const count = Object.keys(backup.drawings).length;
      if (!count) {
        setMessage("ابدأ تلوين رسمة أولًا، ثم نزّل نسخة منها.");
        return;
      }
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `kidzy-drawings-${backup.exportedAt.slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setError("");
      setMessage(`نُزّلت نسخة تضم ${count.toLocaleString("ar-EG")} رسمة.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر تنزيل النسخة الاحتياطية.");
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setPending(null);
    setMessage("");
    setError("");
    if (!file) return;
    try {
      if (file.size > maximumFileSize) throw new Error("الملف كبير جدًا. الحد الأقصى ٢٠ ميجابايت.");
      const backup = parseDrawingBackup(await file.text(), ids);
      const conflicts = Object.keys(backup.drawings).filter(
        (id) => localStorage.getItem(drawingStorageKey(id)) !== null,
      ).length;
      setOverlap(conflicts);
      setPending(backup);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر قراءة الملف.");
    }
  }

  function restore(replace: boolean) {
    if (!pending) return;
    try {
      const count = restoreDrawingBackup(localStorage, pending, replace);
      setPending(null);
      setError("");
      setMessage(
        count
          ? `استُعيدت ${count.toLocaleString("ar-EG")} رسمة على هذا الجهاز.`
          : "كل رسومات النسخة موجودة بالفعل على هذا الجهاز.",
      );
      window.dispatchEvent(new Event("kidzy:drawing-storage-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّرت استعادة الرسومات.");
    }
  }

  return (
    <section className="studio-backup" aria-label="نسخة احتياطية للرسومات">
      <div className="studio-backup-actions">
        <span>احتفظ برسوماتك إذا غيّرت الجهاز أو مُسحت بيانات المتصفح.</span>
        <button type="button" onClick={exportDrawings}>
          <Download size={17} /> تنزيل نسخة
        </button>
        <label>
          <Upload size={17} /> استعادة نسخة
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => void chooseFile(event)}
          />
        </label>
      </div>
      {pending && (
        <div className="studio-backup-confirm" role="group" aria-label="تأكيد استعادة الرسومات">
          <p>
            النسخة تضم {Object.keys(pending.drawings).length.toLocaleString("ar-EG")} رسمة.
            {overlap > 0 && ` منها ${overlap.toLocaleString("ar-EG")} موجودة هنا.`}
          </p>
          <button type="button" onClick={() => restore(false)}>
            إضافة الرسومات الجديدة
          </button>
          {overlap > 0 && (
            <button type="button" onClick={() => restore(true)}>
              استبدال الرسومات المتطابقة
            </button>
          )}
          <button type="button" onClick={() => setPending(null)}>
            إلغاء
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
