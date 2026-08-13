import { useServerFn } from "@tanstack/react-start";
import { FileDown, Loader2, MessageCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveStoryPdf } from "@/features/pdf/pdf.functions";
import type { PdfStoryPage } from "@/features/pdf/storyPdf";
import { shareWaLink } from "@/features/orders/whatsapp";

interface PdfActionsProps {
  title: string;
  childName?: string | null;
  moral?: string | null;
  language: "ar" | "en" | "bilingual";
  contentType?: "story" | "book";
  aspectRatio?: "1:1" | "16:9" | "9:16";
  pages: PdfStoryPage[];
  /** templateId يُرسل للخادم لإثبات اعتماد المحتوى قبل الحفظ */
  templateId?: string;
  gifterName?: string | null;
  gifterRelation?: string | null;
  /** تعطيل مؤقت (مثلاً قبل الاعتماد أو أثناء توليد الصور) */
  disabled?: boolean;
  /** سبب التعطيل (يُعرض للمستخدم بدلاً من الرسالة الافتراضية) */
  disabledReason?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(blob);
  });
}

export function PdfActions({
  title,
  childName,
  moral,
  language,
  contentType = "story",
  aspectRatio,
  pages,
  templateId,
  gifterName,
  gifterRelation,
  disabled,
  disabledReason,
}: PdfActionsProps) {
  const saveFn = useServerFn(saveStoryPdf);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const cacheRef = useRef<{ sig: string; blob: Blob } | null>(null);
  const savedSigRef = useRef<string | null>(null);

  const sig = JSON.stringify([
    title,
    childName,
    language,
    aspectRatio,
    gifterName,
    gifterRelation,
    ...pages.map((p) => [p.n, p.imageUrl ?? ""]),
  ]);
  const fileName = `${title.replace(/[\\/:*?"<>|]/g, "")}.pdf`;

  const ensurePdf = async (): Promise<Blob> => {
    if (cacheRef.current?.sig === sig) return cacheRef.current.blob;
    // مُحمَّل عند الطلب فقط: jspdf + html2canvas-pro تضيف ~620 كيلوبايت خام
    // لا داعي لتحميلها إلا عند ضغط المستخدم فعلياً على تحميل/مشاركة PDF.
    const { generateStoryPdf } = await import("@/features/pdf/storyPdf");
    const blob = await generateStoryPdf({
      title,
      childName,
      moral,
      language,
      contentType,
      aspectRatio,
      pages,
      gifterName,
      gifterRelation,
      onProgress: (done, total) => setProgress({ done, total }),
    });
    cacheRef.current = { sig, blob };
    setProgress(null);
    return blob;
  };

  const saveToAccount = async (blob: Blob) => {
    if (savedSigRef.current === sig) return;
    try {
      const pdfBase64 = await blobToBase64(blob);
      await saveFn({ data: { title, pdfBase64, templateId } });
      savedSigRef.current = sig;
      toast.success("📁 تم حفظ نسخة PDF في حسابك");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر حفظ النسخة في حسابك — الملف متاح للتحميل");
    }
  };

  const handleDownload = async () => {
    setBusy("download");
    try {
      const blob = await ensurePdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      await saveToAccount(blob);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر إنشاء ملف PDF");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const handleShare = async () => {
    setBusy("share");
    try {
      const blob = await ensurePdf();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const typeLabel = contentType === "book" ? "كتاب تعليمي" : "قصة";
      const msg = `${typeLabel} «${title}»${childName ? ` لبطلنا ${childName}` : ""} من منصة كيدزي ✨\n${origin}`;

      const file = new File([blob], fileName, { type: "application/pdf" });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: msg });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        window.open(shareWaLink(msg), "_blank", "noopener");
        toast.info("حمّلنا ملف PDF — أرفقه في محادثة الواتساب 📎");
      }
      await saveToAccount(blob);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "تعذر مشاركة الملف");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  return (
    <div className="text-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          size="lg"
          disabled={disabled || busy !== null}
          onClick={handleDownload}
          className="rounded-full px-7 font-bold shadow-lg min-h-11"
        >
          {busy === "download" ? (
            <Loader2 className="ms-2 h-5 w-5 animate-spin" />
          ) : (
            <FileDown className="ms-2 h-5 w-5" />
          )}
          تحميل PDF
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={disabled || busy !== null}
          onClick={handleShare}
          className="rounded-full border-2 border-grass px-7 font-bold text-grass hover:bg-grass hover:text-grass-foreground min-h-11"
        >
          {busy === "share" ? (
            <Loader2 className="ms-2 h-5 w-5 animate-spin" />
          ) : (
            <MessageCircle className="ms-2 h-5 w-5" />
          )}
          مشاركة عبر واتساب
        </Button>
      </div>
      {progress && (
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          📄 جارٍ تجهيز PDF عالي الجودة… {progress.done}/{progress.total}
        </p>
      )}
      {disabled && (
        <p className="mt-2 text-xs text-muted-foreground">
          {disabledReason ?? "انتظر اكتمال توليد الصور للحصول على ملف كامل ✨"}
        </p>
      )}
    </div>
  );
}
