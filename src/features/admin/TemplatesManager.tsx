import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, EyeOff, ImageIcon, Loader2, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  adminDeleteTemplate,
  adminGetTemplate,
  adminListTemplates,
  adminRegenerateTemplatePageImage,
  adminRegenerateTemplatePageText,
  adminSetTemplatePublished,
  adminUpdateTemplatePage,
  adminUploadTemplatePageImage,
} from "@/features/admin/admin.functions";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type TemplateRow = {
  id: string;
  slug: string;
  title: string;
  contentType: string;
  language: string;
  ageRange: string | null;
  isPublished: boolean;
  isCustom: boolean;
  approvedAt: string | null;
  adminApprovedAt: string | null;
  coverUrl: string | null;
  pageCount: number;
};

export function TemplatesManager() {
  const listFn = useServerFn(adminListTemplates);
  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-templates"],
    queryFn: () => listFn(),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "story" | "book" | "custom" | "published">("all");

  const filtered = (items ?? []).filter((t) => {
    if (filter === "all") return true;
    if (filter === "story") return t.contentType === "story";
    if (filter === "book") return t.contentType === "book";
    if (filter === "custom") return t.isCustom;
    if (filter === "published") return t.isPublished;
    return true;
  });

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold">📚 إدارة القوالب</h2>
          <p className="text-sm text-muted-foreground">
            كل القصص والكتب الموجودة في الموقع — اضغط على أي قالب لإدارة صفحاته
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-full border-2 border-border bg-card p-1 text-xs font-bold">
          {[
            { v: "all", l: "الكل" },
            { v: "story", l: "قصص" },
            { v: "book", l: "كتب" },
            { v: "published", l: "منشور" },
            { v: "custom", l: "مخصص" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setFilter(o.v as typeof filter)}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                filter === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-3xl" />)
        ) : filtered.length === 0 ? (
          <p className="col-span-full rounded-3xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
            لا توجد قوالب
          </p>
        ) : (
          filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className="group overflow-hidden rounded-3xl border-2 border-border bg-card text-start shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden bg-secondary">
                {t.coverUrl ? (
                  <img src={t.coverUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute start-2 top-2 flex flex-wrap gap-1">
                  {t.isPublished && (
                    <span className="rounded-full bg-grass/90 px-2 py-0.5 text-[10px] font-bold text-grass-foreground">منشور</span>
                  )}
                  {t.isCustom && (
                    <span className="rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-primary-foreground">مخصص</span>
                  )}
                </div>
              </div>
              <div className="p-3">
                <h3 className="line-clamp-1 font-display text-sm font-bold">{t.title}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {t.contentType === "book" ? "كتاب" : "قصة"} · {t.pageCount} صفحة
                  {t.ageRange ? ` · ${t.ageRange}` : ""}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedId && <TemplateEditorDialog templateId={selectedId} onClose={() => setSelectedId(null)} />}
    </section>
  );
}

function TemplateEditorDialog({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetTemplate);
  const { data: tpl, isLoading, refetch } = useQuery({
    queryKey: ["admin-template", templateId],
    queryFn: () => getFn({ data: { templateId } }),
  });

  const refresh = () => {
    void refetch();
    void qc.invalidateQueries({ queryKey: ["admin-templates"] });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {tpl?.title ?? "جارٍ التحميل…"}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !tpl ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              {tpl.contentType === "book" ? "كتاب تعليمي" : "قصة"} · {tpl.language} ·{" "}
              {tpl.ageRange ?? "بدون عمر"} · {tpl.pages.length} صفحة
            </div>
            {tpl.pages.map((p) => (
              <PageEditor
                key={p.n}
                templateId={templateId}
                language={tpl.language}
                page={p}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type EditablePage = {
  n: number;
  title?: string;
  text?: string;
  title_ar?: string;
  title_en?: string;
  text_ar?: string;
  text_en?: string;
  image_title_en?: string;
  scene?: string;
  imageUrl?: string | null;
};

function PageEditor({
  templateId,
  language,
  page,
  onChanged,
}: {
  templateId: string;
  language: string;
  page: EditablePage;
  onChanged: () => void;
}) {
  const updateFn = useServerFn(adminUpdateTemplatePage);
  const uploadFn = useServerFn(adminUploadTemplatePageImage);
  const regenImgFn = useServerFn(adminRegenerateTemplatePageImage);
  const regenTxtFn = useServerFn(adminRegenerateTemplatePageText);
  const fileRef = useRef<HTMLInputElement>(null);

  const [edit, setEdit] = useState({
    title: page.title ?? "",
    text: page.text ?? "",
    title_ar: page.title_ar ?? "",
    title_en: page.title_en ?? "",
    text_ar: page.text_ar ?? "",
    text_en: page.text_en ?? "",
    image_title_en: page.image_title_en ?? "",
    scene: page.scene ?? "",
  });
  const [aiHint, setAiHint] = useState("");

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          templateId,
          pageNumber: page.n,
          title: edit.title || undefined,
          text: edit.text || undefined,
          title_ar: edit.title_ar || undefined,
          title_en: edit.title_en || undefined,
          text_ar: edit.text_ar || undefined,
          text_en: edit.text_en || undefined,
          image_title_en: edit.image_title_en || undefined,
          scene: edit.scene || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(`تم حفظ صفحة ${page.n} ✅`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenImg = useMutation({
    mutationFn: () => regenImgFn({ data: { templateId, pageNumber: page.n } }),
    onSuccess: () => {
      toast.success(`تم توليد صورة الصفحة ${page.n} ✨`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenTxt = useMutation({
    mutationFn: () =>
      regenTxtFn({
        data: { templateId, pageNumber: page.n, instruction: aiHint.trim() || undefined },
      }),
    onSuccess: (res) => {
      toast.success(`تم توليد نص الصفحة ${page.n} ✨`);
      const np = res?.page as EditablePage | undefined;
      if (np) {
        setEdit((prev) => ({
          ...prev,
          title: np.title ?? prev.title,
          text: np.text ?? prev.text,
          title_ar: np.title_ar ?? prev.title_ar,
          title_en: np.title_en ?? prev.title_en,
          text_ar: np.text_ar ?? prev.text_ar,
          text_en: np.text_en ?? prev.text_en,
        }));
      }
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("الصورة أكبر من 8MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await uploadFn({
          data: { templateId, pageNumber: page.n, dataUrl: String(reader.result) },
        });
        toast.success(`تم رفع صورة الصفحة ${page.n} ✅`);
        onChanged();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر الرفع");
      }
    };
    reader.readAsDataURL(file);
  };

  const isBilingual = language === "bilingual";

  return (
    <div className="rounded-3xl border-2 border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-display font-bold">صفحة {page.n}</h4>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full text-xs font-bold"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="ms-1 h-3.5 w-3.5" />
            رفع صورة
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            className="h-8 rounded-full text-xs font-bold"
            disabled={regenImg.isPending}
            onClick={() => regenImg.mutate()}
          >
            {regenImg.isPending ? (
              <Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="ms-1 h-3.5 w-3.5" />
            )}
            توليد بالذكاء الاصطناعي
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[200px,1fr]">
        <div className="aspect-square overflow-hidden rounded-2xl border-2 border-border bg-secondary">
          {page.imageUrl ? (
            <img src={page.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              لم تُولّد بعد
            </div>
          )}
        </div>

        <div className="space-y-2">
          {isBilingual ? (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  placeholder="عنوان عربي"
                  value={edit.title_ar}
                  onChange={(e) => setEdit({ ...edit, title_ar: e.target.value })}
                  className="rounded-xl"
                />
                <Input
                  dir="ltr"
                  placeholder="English title"
                  value={edit.title_en}
                  onChange={(e) => setEdit({ ...edit, title_en: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <Textarea
                placeholder="نص عربي"
                value={edit.text_ar}
                onChange={(e) => setEdit({ ...edit, text_ar: e.target.value })}
                rows={3}
                className="rounded-xl"
              />
              <Textarea
                dir="ltr"
                placeholder="English text"
                value={edit.text_en}
                onChange={(e) => setEdit({ ...edit, text_en: e.target.value })}
                rows={3}
                className="rounded-xl"
              />
            </>
          ) : (
            <>
              <Input
                dir={language === "en" ? "ltr" : "rtl"}
                placeholder="العنوان"
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                className="rounded-xl"
              />
              <Textarea
                dir={language === "en" ? "ltr" : "rtl"}
                placeholder="نص الصفحة (استخدم {child} لاسم البطل)"
                value={edit.text}
                onChange={(e) => setEdit({ ...edit, text: e.target.value })}
                rows={3}
                className="rounded-xl"
              />
            </>
          )}

          <details className="rounded-xl border border-border bg-secondary/20 p-2 text-xs">
            <summary className="cursor-pointer font-bold text-muted-foreground">
              ⚙️ خيارات متقدمة (وصف المشهد للصورة)
            </summary>
            <div className="mt-2 space-y-2">
              <Input
                dir="ltr"
                placeholder="Poster title (1-3 English words baked into image)"
                value={edit.image_title_en}
                onChange={(e) => setEdit({ ...edit, image_title_en: e.target.value })}
                className="rounded-xl"
              />
              <Textarea
                dir="ltr"
                placeholder="English scene description for image generation"
                value={edit.scene}
                onChange={(e) => setEdit({ ...edit, scene: e.target.value })}
                rows={2}
                className="rounded-xl"
              />
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Input
              placeholder="تعليمات للذكاء الاصطناعي (اختياري)"
              value={aiHint}
              onChange={(e) => setAiHint(e.target.value)}
              className="h-9 flex-1 rounded-full text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-full text-xs font-bold"
              disabled={regenTxt.isPending}
              onClick={() => regenTxt.mutate()}
            >
              {regenTxt.isPending ? (
                <Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="ms-1 h-3.5 w-3.5" />
              )}
              توليد النص
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-full bg-grass text-xs font-bold text-grass-foreground hover:bg-grass/90"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? (
                <Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="ms-1 h-3.5 w-3.5" />
              )}
              حفظ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
