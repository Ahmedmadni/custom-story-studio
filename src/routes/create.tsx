import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Hourglass,
  Loader2,
  MessageCircle,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PdfActions } from "@/features/pdf/PdfActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  approveTemplate,
  generateAiStory,
  generatePageImage,
  getTemplateApproval,
  reorderPages,
  updatePageText,
} from "@/features/ai/ai.functions";
import {
  BOOK_CATEGORIES,
  BOOK_LENGTHS,
  READING_LEVELS,
  readingLevelFromAge,
  type BookCategoryValue,
  type BookLength,
  type ReadingLevel,
} from "@/features/library/bookCategories";
import type { PdfStoryPage } from "@/features/pdf/storyPdf";
import {
  clearWizardDraft,
  loadWizardDraft,
  saveWizardDraft,
} from "@/features/orders/draft.functions";
import {
  CONTENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  LANGUAGE_OPTIONS,
  type Gender,
  type LanguageMode,
} from "@/features/ai/storyTypes";
import { isValidEgyptianMobile } from "@/features/orders/whatsapp";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "أنشئ قصة أو كتاباً تعليمياً — حكايتي" },
      {
        name: "description",
        content:
          "معالج إنشاء بخطوات واضحة: اسم الطفل، العمر، اللغة (عربي/إنجليزي/ثنائي)، صورة اختيارية، نوع المحتوى، توليد، معاينة، اعتماد، تصدير PDF ومشاركة واتساب.",
      },
    ],
  }),
  component: CreateWizard,
});

const STEPS = [
  "اسم الطفل",
  "العمر",
  "اللغة",
  "صورة الطفل",
  "نوع المحتوى",
  "التوليد",
  "المعاينة والاعتماد",
  "التصدير والمشاركة",
];

const MAX_PHOTO_MB = 8;

interface DraftPayload {
  step?: number;
  childName?: string;
  gender?: Gender;
  age?: string;
  language?: LanguageMode;
  whatsapp?: string;
  photoMode?: "cartoon" | "real";
  contentType?: "story" | "book";
  topic?: string;
  bookCategory?: BookCategoryValue;
  readingLevel?: ReadingLevel;
  bookLength?: BookLength;
}

function CreateWizard() {
  const { user, loading } = useAuth();
  const generateFn = useServerFn(generateAiStory);
  const imageFn = useServerFn(generatePageImage);
  const updateFn = useServerFn(updatePageText);
  const approveFn = useServerFn(approveTemplate);
  const reorderFn = useServerFn(reorderPages);
  const saveDraftFn = useServerFn(saveWizardDraft);
  const loadDraftFn = useServerFn(loadWizardDraft);
  const clearDraftFn = useServerFn(clearWizardDraft);

  const [step, setStep] = useState(0);
  const [childName, setChildName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [age, setAge] = useState("");
  const [language, setLanguage] = useState<LanguageMode | "">("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoMode, setPhotoMode] = useState<"cartoon" | "real">("real");
  const [whatsapp, setWhatsapp] = useState("");
  const [contentType, setContentType] = useState<"story" | "book">("story");
  const [topic, setTopic] = useState("");
  // Book-specific
  const [bookCategory, setBookCategory] = useState<BookCategoryValue | "">("");
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>("intermediate");
  const [bookLength, setBookLength] = useState<BookLength>("short");
  // Preview state
  const [pageIndex, setPageIndex] = useState(0);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [imgGenActive, setImgGenActive] = useState(false);
  const [imgGenCount, setImgGenCount] = useState(0);
  const [imgGenTotal, setImgGenTotal] = useState(0);
  const [pageEdits, setPageEdits] = useState<
    Record<
      number,
      { title?: string; text?: string; title_ar?: string; title_en?: string; text_ar?: string; text_en?: string }
    >
  >({});
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editTitleEn, setEditTitleEn] = useState("");
  const [editTextEn, setEditTextEn] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [regenPage, setRegenPage] = useState<number | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);

  // ===== Draft restoration =====
  const { data: existingDraft } = useQuery({
    queryKey: ["wizard-draft", user?.id],
    queryFn: () => loadDraftFn(),
    enabled: !!user,
    staleTime: Infinity,
  });

  const [draftPrompted, setDraftPrompted] = useState(false);
  useEffect(() => {
    if (!user || draftPrompted || !existingDraft) return;
    const p = (existingDraft as { payload?: DraftPayload } | null)?.payload;
    if (!p || !p.childName) {
      setDraftPrompted(true);
      return;
    }
    setDraftPrompted(true);
    toast(
      `لديك مسودة محفوظة لـ ${p.childName} — هل ترغب باستئنافها؟`,
      {
        duration: 12000,
        action: {
          label: "استئناف",
          onClick: () => {
            setChildName(p.childName ?? "");
            setGender(p.gender ?? "");
            setAge(p.age ?? "");
            setLanguage(p.language ?? "");
            setWhatsapp(p.whatsapp ?? "");
            setPhotoMode(p.photoMode ?? "real");
            setContentType(p.contentType ?? "story");
            setTopic(p.topic ?? "");
            setBookCategory(p.bookCategory ?? "");
            setReadingLevel(p.readingLevel ?? "intermediate");
            setBookLength(p.bookLength ?? "short");
            setStep(Math.min(4, p.step ?? 0));
            toast.success("تم استئناف المسودة ✏️");
          },
        },
        cancel: {
          label: "تجاهل",
          onClick: () => void clearDraftFn(),
        },
      },
    );
  }, [user, existingDraft, draftPrompted, clearDraftFn]);

  // ===== Draft autosave (debounced) =====
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (!user || step > 5 || childName.trim().length === 0) return;
    const payload: DraftPayload = {
      step,
      childName,
      gender: gender || undefined,
      age,
      language: language || undefined,
      whatsapp,
      photoMode,
      contentType,
      topic,
      bookCategory: bookCategory || undefined,
      readingLevel,
      bookLength,
    };
    const sig = JSON.stringify(payload);
    if (sig === lastSavedRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      lastSavedRef.current = sig;
      void saveDraftFn({ data: payload as Record<string, unknown> });
    }, 1200);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [user, step, childName, gender, age, language, whatsapp, photoMode, contentType, topic, bookCategory, readingLevel, bookLength, saveDraftFn]);

  // Auto-derive reading level from age when book selected
  useEffect(() => {
    if (contentType === "book" && age) {
      setReadingLevel(readingLevelFromAge(Number(age)));
    }
  }, [age, contentType]);

  const generateImages = async (
    res: { id: string; pages: { n: number }[]; photoPath?: string | null },
    existing: Record<number, string>,
  ) => {
    const todo = res.pages.filter((p) => !existing[p.n]);
    if (todo.length === 0) return;
    setImgGenActive(true);
    setImgGenTotal(todo.length);
    setImgGenCount(0);
    let failed = 0;
    for (const p of todo) {
      let attempt = 0;
      let success = false;
      while (attempt < 2 && !success) {
        try {
          const r = await imageFn({
            data: {
              templateId: res.id,
              pageNumber: p.n,
              childPhotoPath: res.photoPath ?? undefined,
              photoMode: res.photoPath ? photoMode : undefined,
            },
          });
          if (r.imageUrl) {
            const url = r.imageUrl;
            setPageImages((m) => ({ ...m, [p.n]: url }));
            success = true;
          } else {
            attempt++;
          }
        } catch {
          attempt++;
        }
      }
      if (!success) failed++;
      setImgGenCount((c) => c + 1);
    }
    setImgGenActive(false);
    if (failed > 0)
      toast.error("تعذر رسم بعض الصور — اضغط «إعادة توليد الصور الناقصة»");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!gender) throw new Error("الرجاء اختيار جنس البطل");
      if (!language) throw new Error("الرجاء اختيار اللغة");
      if (contentType === "book" && !bookCategory)
        throw new Error("الرجاء اختيار فئة الكتاب التعليمي");

      const res = await generateFn({
        data: {
          childName: childName.trim(),
          theme: topic.trim() || undefined,
          age: age.trim() || undefined,
          gender: gender as Gender,
          language: language as LanguageMode,
          contentType,
          bookMeta:
            contentType === "book" && bookCategory
              ? {
                  category: bookCategory,
                  reading_level: readingLevel,
                  length: bookLength,
                }
              : undefined,
        },
      });

      let orderCreated = false;
      let photoPath: string | null = null;
      if (photo && user) {
        try {
          const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("child-photos")
            .upload(path, photo, { contentType: photo.type });
          if (upErr) throw upErr;
          photoPath = path;
          const { error: insErr } = await supabase.from("orders").insert({
            user_id: user.id,
            template_id: res.id,
            child_name: childName.trim(),
            child_age: age ? Number(age) : null,
            gender: gender as Gender,
            whatsapp: whatsapp.trim(),
            child_photo_path: path,
            notes:
              photoMode === "cartoon"
                ? "طلب من معالج الإنشاء — تحويل صورة الطفل إلى شخصية كرتونية"
                : "طلب من معالج الإنشاء — استخدام صورة الطفل الحقيقية مع التحسين والدمج",
          });
          if (insErr) throw insErr;
          orderCreated = true;
        } catch {
          toast.error("تم توليد المحتوى لكن تعذر إرسال طلب الصور");
        }
      }
      return { ...res, orderCreated, photoPath };
    },
    onSuccess: (data) => {
      setPageIndex(0);
      setPageImages({});
      setApproved(false);
      setStep(6);
      void generateImages(data, {});
    },
    onError: (e: Error) => toast.error(e.message || "تعذر التوليد"),
  });

  const result = mutation.data;
  const pages = result?.pages ?? [];
  const currentPage = pages[pageIndex];

  const onPhotoChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("الرجاء اختيار صورة");
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast.error(`حجم الصورة يجب ألا يتجاوز ${MAX_PHOTO_MB} ميجابايت`);
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const canNext = (): boolean => {
    switch (step) {
      case 0:
        return childName.trim().length > 0 && gender !== "";
      case 1: {
        const n = Number(age);
        return age.trim().length > 0 && n >= 1 && n <= 14;
      }
      case 2:
        return language !== "";
      case 3:
        return !photo || isValidEgyptianMobile(whatsapp);
      case 4:
        if (contentType === "book")
          return bookCategory !== "";
        return topic.trim().length >= 3;
      default:
        return true;
    }
  };

  const personalize = (t: string) =>
    t.replaceAll("{child}", childName.trim() || "بطلنا");

  const withEdits = <T extends { n: number; title?: string; text?: string; title_ar?: string; title_en?: string; text_ar?: string; text_en?: string }>(
    p: T,
  ): T => {
    const e = pageEdits[p.n];
    return e ? { ...p, ...e } : p;
  };

  const shownPage = currentPage ? withEdits(currentPage) : undefined;
  const isBilingual = result?.language === "bilingual";

  const goToPage = (i: number) => {
    setEditingPage(null);
    setPageIndex(i);
  };

  const startEdit = () => {
    if (!shownPage) return;
    if (isBilingual) {
      setEditTitle(shownPage.title_ar ?? "");
      setEditText(shownPage.text_ar ?? shownPage.text ?? "");
      setEditTitleEn(shownPage.title_en ?? "");
      setEditTextEn(shownPage.text_en ?? "");
    } else {
      setEditTitle(shownPage.title ?? "");
      setEditText(shownPage.text ?? "");
    }
    setEditingPage(shownPage.n);
  };

  const saveEdit = async () => {
    if (!result || editingPage === null) return;
    const pn = editingPage;
    setSavingEdit(true);
    try {
      const payload = isBilingual
        ? {
            templateId: result.id,
            pageNumber: pn,
            title_ar: editTitle.trim() || undefined,
            text_ar: editText.trim(),
            title_en: editTitleEn.trim() || undefined,
            text_en: editTextEn.trim() || undefined,
          }
        : {
            templateId: result.id,
            pageNumber: pn,
            title: editTitle.trim() || undefined,
            text: editText.trim(),
          };
      await updateFn({ data: payload });
      setPageEdits((m) => ({
        ...m,
        [pn]: isBilingual
          ? {
              title_ar: editTitle.trim(),
              text_ar: editText.trim(),
              title_en: editTitleEn.trim(),
              text_en: editTextEn.trim(),
            }
          : { title: editTitle.trim(), text: editText.trim() },
      }));
      setEditingPage(null);
      toast.success("تم حفظ التعديل ✏️");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر حفظ التعديل");
    } finally {
      setSavingEdit(false);
    }
  };

  const regenerateImage = async (n: number) => {
    if (!result) return;
    setRegenPage(n);
    try {
      const r = await imageFn({
        data: {
          templateId: result.id,
          pageNumber: n,
          childPhotoPath: result.photoPath ?? undefined,
          photoMode: result.photoPath ? photoMode : undefined,
        },
      });
      if (r.imageUrl) {
        const url = r.imageUrl;
        setPageImages((m) => ({ ...m, [n]: url }));
        toast.success("تم رسم صورة جديدة 🎨");
      } else {
        toast.error("لم نحصل على صورة، حاول مرة أخرى");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر إعادة رسم الصورة");
    } finally {
      setRegenPage(null);
    }
  };

  const movePage = async (n: number, dir: -1 | 1) => {
    if (!result) return;
    const order = pages.map((p) => p.n);
    const idx = order.indexOf(n);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= order.length) return;
    [order[idx], order[swap]] = [order[swap], order[idx]];
    try {
      await reorderFn({ data: { templateId: result.id, order } });
      // Reorder local result pages + page images
      const map = new Map(pages.map((p) => [p.n, p]));
      const imgMap = { ...pageImages };
      mutation.data!.pages = order.map((oldN, i) => ({
        ...(map.get(oldN) as (typeof pages)[number]),
        n: i + 1,
      }));
      const newImages: Record<number, string> = {};
      order.forEach((oldN, i) => {
        if (imgMap[oldN]) newImages[i + 1] = imgMap[oldN];
      });
      setPageImages(newImages);
      setPageEdits({}); // edits keyed by old n
      setPageIndex(0);
      toast.success("تم تحديث الترتيب");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تغيير الترتيب");
    }
  };

  const approveAndContinue = async () => {
    if (!result) return;
    setApproving(true);
    try {
      await approveFn({ data: { templateId: result.id } });
      setApproved(true);
      setStep(7);
      void clearDraftFn();
      toast.success("تم اعتماد المحتوى ✅");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر اعتماد المحتوى");
    } finally {
      setApproving(false);
    }
  };

  const reset = () => {
    mutation.reset();
    setStep(0);
    setChildName("");
    setGender("");
    setAge("");
    setLanguage("");
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoMode("cartoon");
    setWhatsapp("");
    setContentType("story");
    setTopic("");
    setBookCategory("");
    setReadingLevel("intermediate");
    setBookLength("short");
    setPageIndex(0);
    setPageImages({});
    setImgGenActive(false);
    setImgGenCount(0);
    setImgGenTotal(0);
    setPageEdits({});
    setEditingPage(null);
    setEditTitle("");
    setEditText("");
    setEditTitleEn("");
    setEditTextEn("");
    setRegenPage(null);
    setApproved(false);
    setReorderMode(false);
    void clearDraftFn();
  };

  const pdfPages = useMemo(
    () =>
      pages.map((p) => {
        const v = withEdits(p);
        return {
          n: v.n,
          title: v.title || v.title_ar || null,
          text: v.text_ar || v.text || "",
          title_ar: v.title_ar || (isBilingual ? v.title : undefined) || null,
          text_ar: v.text_ar || (isBilingual ? v.text : undefined) || null,
          title_en: v.title_en || null,
          text_en: v.text_en || null,
          imageUrl: pageImages[v.n] ?? null,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, pageEdits, pageImages, isBilingual],
  );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <div className="no-print text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-bold text-secondary-foreground">
            <Wand2 className="h-4 w-4" />
            معالج الإنشاء — خطوة بخطوة
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold">
            أنشئ قصة أو كتاباً تعليمياً لطفلك
          </h1>
        </div>

        {!loading && !user ? (
          <div className="mt-10 rounded-3xl border-2 border-border bg-card p-8 text-center">
            <p className="text-lg font-semibold">سجل الدخول أولاً لبدء الإنشاء</p>
            <Button asChild className="mt-4 rounded-full px-8 font-bold">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Stepper */}
            <div className="no-print mt-8">
              <div className="flex items-center justify-between overflow-x-auto">
                {STEPS.map((label, i) => (
                  <div key={label} className="flex flex-1 min-w-[44px] flex-col items-center">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                        i < step
                          ? "border-grass bg-grass text-grass-foreground"
                          : i === step
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {i < step ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span
                      className={`mt-1.5 hidden text-center text-[11px] font-semibold md:block ${
                        i === step ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-sm font-semibold text-muted-foreground md:hidden">
                الخطوة {step + 1} من {STEPS.length}: {STEPS[step]}
              </p>
            </div>

            <div className="no-print mt-8 rounded-3xl border-2 border-border bg-card p-6 shadow-sm md:p-8">
              {step === 0 && (
                <div>
                  <Label htmlFor="childName" className="font-bold">
                    ما اسم طفلك؟
                  </Label>
                  <Input
                    id="childName"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="مثال: يوسف"
                    maxLength={40}
                    className="mt-2 rounded-xl"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    سيكون طفلك هو بطل القصة أو رفيق التعلم في الكتاب
                  </p>

                  <div className="mt-6">
                    <Label className="font-bold">جنس البطل</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      نستخدم هذا لكتابة النصوص بالصيغة الصحيحة (مذكر/مؤنث) ولاختيار شكل الشخصية المرجعية.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {GENDER_OPTIONS.map((g) => (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => setGender(g.value)}
                          className={`rounded-2xl border-2 p-4 text-start transition-colors ${
                            gender === g.value
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="flex items-center gap-2 font-display text-xl font-bold">
                            <span className="text-2xl">{g.emoji}</span>
                            {g.label}
                          </span>
                          <p className="mt-1 text-xs text-muted-foreground">{g.hint}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <Label htmlFor="age" className="font-bold">
                    كم عمر {childName.trim() || "طفلك"}؟
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    min={1}
                    max={14}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="مثال: 5"
                    className="mt-2 w-36 rounded-xl"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    نكيّف اللغة والصور والمستوى حسب عمر الطفل (من 1 إلى 14 سنة)
                  </p>
                </div>
              )}

              {step === 2 && (
                <div>
                  <Label className="font-bold">اختر لغة المحتوى</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    اللغة تُحفظ مع المحتوى وتظهر في المعاينة وملف PDF والمشاركة.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {LANGUAGE_OPTIONS.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setLanguage(l.value)}
                        className={`rounded-2xl border-2 p-5 text-start transition-colors ${
                          language === l.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="font-display text-xl font-bold">
                          {l.label}
                        </span>
                        <p className="mt-1 text-sm text-muted-foreground">{l.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <Label className="font-bold">صورة الطفل (اختياري)</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ارفع صورة واضحة لوجه طفلك، ثم اختر شكل ظهوره في الصور
                  </p>
                  <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/30 p-6 transition-colors hover:bg-secondary/60">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="معاينة صورة الطفل"
                        className="h-40 w-40 rounded-2xl object-cover shadow-md"
                      />
                    ) : (
                      <>
                        <Camera className="h-10 w-10 text-primary" />
                        <span className="mt-2 text-sm font-semibold text-muted-foreground">
                          اضغط لاختيار صورة (يمكنك تخطي هذه الخطوة)
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {photo && (
                    <div className="mt-5">
                      <Label className="font-bold">كيف يظهر طفلك داخل الصور؟</Label>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setPhotoMode("cartoon")}
                          className={`rounded-2xl border-2 p-4 text-start transition-colors ${
                            photoMode === "cartoon"
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="flex items-center gap-2 font-display text-lg font-bold">
                            <Wand2 className="h-5 w-5 text-candy" />
                            شخصية كرتونية
                          </span>
                          <p className="mt-1 text-sm text-muted-foreground">
                            نحوّل صورة طفلك إلى شخصية كرتونية ثلاثية الأبعاد متناسقة مع أسلوب القصة، مع الحفاظ على ملامحه
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoMode("real")}
                          className={`rounded-2xl border-2 p-4 text-start transition-colors ${
                            photoMode === "real"
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="flex items-center gap-2 font-display text-lg font-bold">
                            <Camera className="h-5 w-5 text-grass" />
                            الصورة الحقيقية
                          </span>
                          <p className="mt-1 text-sm text-muted-foreground">
                            نُبقي ملامح طفلك الأصلية مع تحسين الجودة والوضوح ودمجها داخل مشاهد الكتاب
                          </p>
                        </button>
                      </div>
                      <div className="mt-4">
                        <Label htmlFor="wa" className="font-bold">
                          رقم الواتساب لاستلام النسخة المصورة
                        </Label>
                        <Input
                          id="wa"
                          dir="ltr"
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          placeholder="01012345678"
                          maxLength={15}
                          className="mt-2 rounded-xl text-left"
                        />
                        <button
                          onClick={() => {
                            setPhoto(null);
                            setPhotoPreview(null);
                          }}
                          className="mt-3 text-xs font-semibold text-destructive hover:underline"
                        >
                          إزالة الصورة والمتابعة بدونها
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    🔒 الصورة محفوظة بشكل خاص وآمن
                  </p>
                </div>
              )}

              {step === 4 && (
                <div>
                  <Label className="font-bold">اختر نوع المحتوى</Label>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {CONTENT_TYPE_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setContentType(c.value)}
                        className={`rounded-2xl border-2 p-5 text-start transition-colors ${
                          contentType === c.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="flex items-center gap-2 font-display text-xl font-bold">
                          {c.value === "story" ? (
                            <BookOpen className="h-5 w-5 text-candy" />
                          ) : (
                            <GraduationCap className="h-5 w-5 text-grass" />
                          )}
                          {c.label}
                        </span>
                        <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
                      </button>
                    ))}
                  </div>

                  {contentType === "story" ? (
                    <div className="mt-5">
                      <Label htmlFor="topic" className="font-bold">
                        فكرة القصة أو القيمة المطلوبة
                      </Label>
                      <Textarea
                        id="topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="مثال: قصة عن الصدق ومساعدة الجيران…"
                        maxLength={300}
                        rows={3}
                        className="mt-2 rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="mt-5 space-y-5">
                      <div>
                        <Label className="font-bold">فئة الكتاب التعليمي</Label>
                        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                          {BOOK_CATEGORIES.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setBookCategory(c.value)}
                              className={`rounded-2xl border-2 p-3 text-center transition-colors min-h-16 ${
                                bookCategory === c.value
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <div className="text-2xl">{c.emoji}</div>
                              <div className="mt-1 text-xs font-bold">{c.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="font-bold">مستوى القراءة</Label>
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
                          {READING_LEVELS.map((l) => (
                            <button
                              key={l.value}
                              type="button"
                              onClick={() => setReadingLevel(l.value)}
                              className={`rounded-xl border-2 p-3 text-start transition-colors ${
                                readingLevel === l.value
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <div className="font-bold">{l.label}</div>
                              <div className="text-xs text-muted-foreground">{l.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="font-bold">طول الكتاب</Label>
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
                          {BOOK_LENGTHS.map((l) => (
                            <button
                              key={l.value}
                              type="button"
                              onClick={() => setBookLength(l.value)}
                              className={`rounded-xl border-2 p-3 text-center transition-colors ${
                                bookLength === l.value
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <div className="font-bold">{l.label}</div>
                              <div className="text-xs text-muted-foreground">{l.pages} صفحات</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="topicBook" className="font-bold">
                          تخصيص إضافي (اختياري)
                        </Label>
                        <Input
                          id="topicBook"
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          placeholder="مثال: ركّز على الأرقام من 1 إلى 10"
                          maxLength={200}
                          className="mt-2 rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="text-center">
                  <h2 className="font-display text-2xl font-extrabold">
                    كل شيء جاهز! راجع اختياراتك
                  </h2>
                  <div className="mx-auto mt-5 max-w-md space-y-2 rounded-2xl bg-secondary/40 p-5 text-start text-sm">
                    <p>👦 <b>الطفل:</b> {childName.trim()} — {age} سنوات</p>
                    <p>🌍 <b>اللغة:</b> {LANGUAGE_OPTIONS.find((l) => l.value === language)?.label}</p>
                    <p>
                      📚 <b>النوع:</b>{" "}
                      {contentType === "story" ? "قصة مصورة" : "كتاب تعليمي"}
                    </p>
                    {contentType === "book" ? (
                      <>
                        <p>🎓 <b>الفئة:</b> {BOOK_CATEGORIES.find((c) => c.value === bookCategory)?.label}</p>
                        <p>📖 <b>المستوى:</b> {READING_LEVELS.find((l) => l.value === readingLevel)?.label} • {BOOK_LENGTHS.find((l) => l.value === bookLength)?.label}</p>
                      </>
                    ) : (
                      <p>💡 <b>الموضوع:</b> {topic.trim()}</p>
                    )}
                    <p>
                      📸 <b>صورة الطفل:</b>{" "}
                      {photo
                        ? photoMode === "cartoon"
                          ? "كرتونية بأسلوب القصة"
                          : "حقيقية مع تحسين الجودة"
                        : "بدون صورة"}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate()}
                    className="mt-6 rounded-full px-10 text-base font-bold shadow-lg min-h-11"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="ms-2 h-5 w-5 animate-spin" />
                        جارٍ التوليد… لحظات قليلة
                      </>
                    ) : (
                      <>
                        <Sparkles className="ms-2 h-5 w-5" />
                        ولّد المحتوى الآن
                      </>
                    )}
                  </Button>
                </div>
              )}

              {step === 6 && result && (
                <div>
                  <div className="text-center">
                    <span className="text-xs font-bold text-accent">
                      {result.contentType === "book" ? "كتابك التعليمي ✨" : "قصتك الجديدة ✨"}
                    </span>
                    <h2 className="mt-1 font-display text-3xl font-extrabold">
                      {personalize(result.title)}
                    </h2>
                    <p className="mt-2 text-muted-foreground">{personalize(result.summary)}</p>
                    {result.moral && (
                      <p className="mt-2 text-sm font-semibold text-candy">
                        💝 {result.contentType === "book" ? "المهارة المكتسبة" : "القيمة"}:{" "}
                        {personalize(result.moral)}
                      </p>
                    )}
                    {result.learningGoals && result.learningGoals.length > 0 && (
                      <div className="mx-auto mt-3 max-w-md rounded-2xl bg-secondary/30 p-3 text-start text-xs">
                        <b>🎯 أهداف التعلّم:</b>
                        <ul className="mt-1 list-disc ps-5">
                          {result.learningGoals.map((g: string, i: number) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Reorder toolbar */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant={reorderMode ? "default" : "outline"}
                      size="sm"
                      className="rounded-full font-bold"
                      onClick={() => setReorderMode((v) => !v)}
                    >
                      <ArrowUpDown className="ms-2 h-4 w-4" />
                      {reorderMode ? "إنهاء إعادة الترتيب" : "إعادة ترتيب الصفحات"}
                    </Button>
                  </div>

                  {/* Page viewer */}
                  <div
                    dir={result.language === "en" ? "ltr" : "rtl"}
                    className="mt-4 overflow-hidden rounded-2xl border-2 border-secondary bg-card shadow-sm"
                  >
                    <div className="relative aspect-square w-full bg-secondary/30 md:aspect-[4/3]">
                      {shownPage && pageImages[shownPage.n] ? (
                        <img
                          src={pageImages[shownPage.n]}
                          alt={shownPage.title ?? `صفحة ${shownPage.n}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                          {imgGenActive ? (
                            <>
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <span className="text-sm font-semibold">🎨 جارٍ رسم صورة هذا المشهد…</span>
                            </>
                          ) : (
                            <span className="text-sm font-semibold">الصورة غير متوفرة</span>
                          )}
                        </div>
                      )}
                      {shownPage && regenPage === shownPage.n && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <span className="text-sm font-bold">🎨 جارٍ رسم صورة جديدة…</span>
                        </div>
                      )}
                      <span className="absolute bottom-3 start-3 rounded-full bg-primary px-3.5 py-1 text-xs font-extrabold text-primary-foreground shadow-md">
                        صفحة {shownPage?.n}
                      </span>
                    </div>
                    <div className="p-6">
                      {shownPage && editingPage === shownPage.n ? (
                        <div dir="rtl" className="text-start">
                          <Label htmlFor="editTitle" className="font-bold">
                            {isBilingual ? "العنوان (عربي)" : "عنوان الصفحة"}
                          </Label>
                          <Input
                            id="editTitle"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            maxLength={80}
                            className="mt-1 rounded-xl"
                          />
                          <Label htmlFor="editText" className="mt-4 block font-bold">
                            {isBilingual ? "النص (عربي)" : "نص الصفحة"}
                          </Label>
                          <Textarea
                            id="editText"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            className="mt-1 rounded-xl"
                          />
                          {isBilingual && (
                            <>
                              <Label htmlFor="editTitleEn" className="mt-4 block font-bold">
                                Title (English)
                              </Label>
                              <Input
                                id="editTitleEn"
                                dir="ltr"
                                value={editTitleEn}
                                onChange={(e) => setEditTitleEn(e.target.value)}
                                maxLength={80}
                                className="mt-1 rounded-xl text-left"
                              />
                              <Label htmlFor="editTextEn" className="mt-4 block font-bold">
                                Text (English)
                              </Label>
                              <Textarea
                                id="editTextEn"
                                dir="ltr"
                                value={editTextEn}
                                onChange={(e) => setEditTextEn(e.target.value)}
                                rows={3}
                                maxLength={1000}
                                className="mt-1 rounded-xl text-left"
                              />
                            </>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            💡 اكتب {"{child}"} ليظهر اسم الطفل تلقائياً
                          </p>
                          <div className="mt-4 flex flex-wrap justify-center gap-2">
                            <Button
                              size="sm"
                              disabled={savingEdit || editText.trim().length === 0}
                              onClick={() => void saveEdit()}
                              className="rounded-full px-6 font-bold"
                            >
                              {savingEdit ? (
                                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="ms-2 h-4 w-4" />
                              )}
                              حفظ التعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={savingEdit}
                              onClick={() => setEditingPage(null)}
                              className="rounded-full px-6 font-bold"
                            >
                              <X className="ms-2 h-4 w-4" />
                              إلغاء
                            </Button>
                          </div>
                        </div>
                      ) : isBilingual ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div dir="rtl" className="text-center md:border-e-2 md:border-secondary md:pe-4">
                            {shownPage?.title_ar && (
                              <h3 className="font-display text-xl font-extrabold text-primary">
                                {shownPage.title_ar}
                              </h3>
                            )}
                            <p className="mt-2 font-display text-lg font-semibold leading-relaxed">
                              {personalize(shownPage?.text_ar ?? shownPage?.text ?? "")}
                            </p>
                          </div>
                          <div dir="ltr" className="text-center">
                            {shownPage?.title_en && (
                              <h3 className="font-display text-xl font-extrabold text-primary">
                                {shownPage.title_en}
                              </h3>
                            )}
                            <p className="mt-2 font-display text-lg font-semibold leading-relaxed">
                              {personalize(shownPage?.text_en ?? "")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          {shownPage?.title && (
                            <h3 className="font-display text-2xl font-extrabold text-primary">
                              {shownPage.title}
                            </h3>
                          )}
                          <p className="mt-2 min-h-16 font-display text-xl font-semibold leading-relaxed">
                            {personalize(shownPage?.text ?? "")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Page tools */}
                  {shownPage && editingPage === null && (
                    <div dir="rtl" className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full font-bold"
                        onClick={startEdit}
                      >
                        <Pencil className="ms-2 h-4 w-4" />
                        تعديل النص
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full font-bold"
                        disabled={regenPage !== null || imgGenActive}
                        onClick={() => void regenerateImage(shownPage.n)}
                      >
                        <RotateCcw className="ms-2 h-4 w-4" />
                        إعادة رسم الصورة
                      </Button>
                      {reorderMode && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full font-bold"
                            disabled={pageIndex === 0}
                            onClick={() => void movePage(shownPage.n, -1)}
                          >
                            ↑ تقديم
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full font-bold"
                            disabled={pageIndex === pages.length - 1}
                            onClick={() => void movePage(shownPage.n, 1)}
                          >
                            ↓ تأخير
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  <div dir="rtl" className="mt-4 flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full min-h-11 min-w-11"
                      disabled={pageIndex === 0}
                      onClick={() => goToPage(Math.max(0, pageIndex - 1))}
                      aria-label="الصفحة السابقة"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {pages.map((p, i) => (
                        <button
                          key={p.n}
                          onClick={() => goToPage(i)}
                          aria-label={`صفحة ${p.n}`}
                          className={`h-2.5 rounded-full transition-all ${
                            i === pageIndex ? "w-7 bg-primary" : "w-2.5 bg-border"
                          }`}
                        />
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full min-h-11 min-w-11"
                      disabled={pageIndex === pages.length - 1}
                      onClick={() => goToPage(Math.min(pages.length - 1, pageIndex + 1))}
                      aria-label="الصفحة التالية"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </div>

                  {imgGenActive && (
                    <p className="mt-4 text-center text-sm font-semibold text-muted-foreground">
                      🎨 جارٍ توليد الصور… {imgGenCount}/{imgGenTotal}
                    </p>
                  )}
                  {!imgGenActive && pages.some((p) => !pageImages[p.n]) && (
                    <div className="mt-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full font-bold"
                        onClick={() => void generateImages(result, pageImages)}
                      >
                        <RotateCcw className="ms-2 h-4 w-4" />
                        إعادة توليد الصور الناقصة
                      </Button>
                    </div>
                  )}

                  {/* Approval gate */}
                  <div className="mt-8 rounded-2xl border-2 border-grass/40 bg-grass/10 p-5 text-center">
                    <p className="text-sm font-semibold">
                      راضٍ عن كل الصفحات؟ اعتمد المحتوى لفتح تصدير PDF والمشاركة عبر واتساب
                    </p>
                    <Button
                      size="lg"
                      disabled={
                        approving ||
                        imgGenActive ||
                        regenPage !== null ||
                        editingPage !== null
                      }
                      onClick={() => void approveAndContinue()}
                      className="mt-4 rounded-full bg-grass px-10 text-base font-bold text-grass-foreground shadow-lg hover:bg-grass/90 min-h-11"
                    >
                      {approving ? (
                        <Loader2 className="ms-2 h-5 w-5 animate-spin" />
                      ) : (
                        <BadgeCheck className="ms-2 h-5 w-5" />
                      )}
                      اعتماد المحتوى نهائياً
                    </Button>
                    {pages.some((p) => !pageImages[p.n]) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        ⚠️ بعض الصور ناقصة — الأفضل إكمالها قبل الاعتماد
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      بعد الاعتماد لن تتمكن من تعديل النصوص أو الصور لهذا المحتوى
                    </p>
                  </div>

                  <div className="mt-3 text-center">
                    <Button variant="ghost" className="rounded-full font-bold" onClick={reset}>
                      <RotateCcw className="ms-2 h-4 w-4" />
                      إنشاء جديد
                    </Button>
                  </div>
                </div>
              )}

              {step === 7 && result && (
                <Step7Approval
                  result={result}
                  childName={childName.trim()}
                  pdfPages={pdfPages}
                  personalize={personalize}
                  reset={reset}
                />
              )}

              {/* Navigation */}
              {step < 5 && (
                <div className="mt-8 flex items-center justify-between">
                  <Button
                    variant="outline"
                    className="rounded-full px-6 font-bold min-h-11"
                    disabled={step === 0}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    <ArrowRight className="ms-1 h-4 w-4" />
                    السابق
                  </Button>
                  <Button
                    className="rounded-full px-8 font-bold shadow-md min-h-11"
                    disabled={!canNext()}
                    onClick={() => setStep((s) => s + 1)}
                  >
                    التالي
                    <ArrowLeft className="me-1 h-4 w-4" />
                  </Button>
                </div>
              )}
              {step === 5 && !mutation.isPending && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setStep(4)}
                    className="text-sm font-semibold text-muted-foreground hover:underline"
                  >
                    ← العودة لتعديل الاختيارات
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

// ============================================================
// الخطوة 7: اعتماد المسؤول + تحميل PDF
// لا يُسمح بالتحميل قبل أن يضغط المسؤول "اعتماد" من لوحة التحكم.
// ============================================================
interface Step7Props {
  result: {
    id: string;
    title: string;
    moral?: string | null;
    language: string;
    contentType: string;
    orderCreated?: boolean;
  };
  childName: string;
  pdfPages: PdfStoryPage[];
  personalize: (t: string) => string;
  reset: () => void;
}

function Step7Approval({ result, childName, pdfPages, personalize, reset }: Step7Props) {
  const approvalFn = useServerFn(getTemplateApproval);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["template-approval", result.id],
    queryFn: () => approvalFn({ data: { templateId: result.id } }),
    refetchInterval: 15000, // فحص كل 15 ثانية
  });

  const adminApproved = Boolean(data?.adminApprovedAt);

  const remindAdmin = () => {
    const msg = `مرحباً 👋\nأنشأت محتوى «${personalize(result.title)}» على منصة حكايتي وأنتظر اعتماده لتحميله 🌟\nمعرّف المحتوى: ${result.id}`;
    const url = `https://wa.me/201120016502?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="text-center">
      {adminApproved ? (
        <>
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-grass/15">
            <BadgeCheck className="h-9 w-9 text-grass" />
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold">
            تم اعتماد محتواك من الإدارة 🎉
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            «{personalize(result.title)}» جاهز — حمّل PDF عالي الجودة ثم شاركه عبر واتساب
          </p>
          <div className="mt-6">
            <PdfActions
              title={personalize(result.title)}
              childName={childName || null}
              moral={result.moral ? personalize(result.moral) : null}
              language={result.language as LanguageMode}
              contentType={result.contentType as "story" | "book"}
              templateId={result.id}
              pages={pdfPages}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            يحتوي الملف على غلاف وكل الصفحات وتحفظ نسخة في حسابك
          </p>
        </>
      ) : (
        <>
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sunny/30">
            <Hourglass className="h-9 w-9 text-sunny-foreground" />
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold">
            محتواك قيد المراجعة من الإدارة ⏳
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            «{personalize(result.title)}» وصلنا بنجاح — سنعتمده خلال وقت قصير وسيُفعَّل
            تحميل PDF تلقائياً هنا فور الموافقة.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="rounded-full bg-grass px-7 font-bold text-grass-foreground hover:bg-grass/90"
              onClick={remindAdmin}
            >
              <MessageCircle className="ms-2 h-5 w-5" />
              تذكير الإدارة عبر واتساب
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-7 font-bold"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? (
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="ms-2 h-4 w-4" />
              )}
              تحديث الحالة
            </Button>
          </div>
        </>
      )}

      {result.orderCreated && (
        <p className="mt-5 rounded-2xl bg-grass/15 p-4 text-sm font-semibold text-grass">
          🎉 طلب النسخة المصورة بصورة طفلك مستلم — سنرسلها عبر الواتساب
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="ghost" className="rounded-full font-bold" onClick={reset}>
          <RotateCcw className="ms-2 h-4 w-4" />
          إنشاء جديد
        </Button>
      </div>
    </div>
  );
}
