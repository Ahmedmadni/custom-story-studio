import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PdfActions } from "@/components/PdfActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateAiStory, generatePageImage, updatePageText } from "@/lib/ai.functions";
import { CONTENT_TYPE_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/storyTypes";
import { isValidEgyptianMobile } from "@/lib/whatsapp";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "أنشئ قصة أو كتاباً تعليمياً — حكايتي" },
      {
        name: "description",
        content:
          "معالج إنشاء بخطوات واضحة: اسم الطفل، العمر، اللغة، صورة اختيارية، نوع المحتوى، توليد بالذكاء الاصطناعي، معاينة، تصدير PDF ومشاركة واتساب.",
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

function CreateWizard() {
  const { user, loading } = useAuth();
  const generateFn = useServerFn(generateAiStory);
  const imageFn = useServerFn(generatePageImage);
  const updateFn = useServerFn(updatePageText);

  const [step, setStep] = useState(0);
  const [childName, setChildName] = useState("");
  const [age, setAge] = useState("");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [contentType, setContentType] = useState<"story" | "book">("story");
  const [topic, setTopic] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [imgGenActive, setImgGenActive] = useState(false);
  const [imgGenCount, setImgGenCount] = useState(0);
  const [imgGenTotal, setImgGenTotal] = useState(0);
  // تعديلات المستخدم على نصوص الصفحات قبل الاعتماد
  const [pageEdits, setPageEdits] = useState<Record<number, { title: string; text: string }>>({});
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [regenPage, setRegenPage] = useState<number | null>(null);

  /** توليد صور الصفحات بالتتابع — كل صورة من مشهد نص صفحتها */
  const generateImages = async (
    res: { id: string; pages: { n: number }[] },
    existing: Record<number, string>,
  ) => {
    const todo = res.pages.filter((p) => !existing[p.n]);
    if (todo.length === 0) return;
    setImgGenActive(true);
    setImgGenTotal(todo.length);
    setImgGenCount(0);
    let failed = 0;
    for (const p of todo) {
      try {
        const r = await imageFn({ data: { templateId: res.id, pageNumber: p.n } });
        if (r.imageUrl) {
          const url = r.imageUrl;
          setPageImages((m) => ({ ...m, [p.n]: url }));
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      setImgGenCount((c) => c + 1);
    }
    setImgGenActive(false);
    if (failed > 0)
      toast.error("تعذر رسم بعض الصور — اضغط «إعادة توليد الصور الناقصة»");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await generateFn({
        data: {
          childName: childName.trim(),
          theme: topic.trim(),
          age: age.trim() || undefined,
          language,
          contentType,
        },
      });

      let orderCreated = false;
      if (photo && user) {
        try {
          const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("child-photos")
            .upload(path, photo, { contentType: photo.type });
          if (upErr) throw upErr;
          const { error: insErr } = await supabase.from("orders").insert({
            user_id: user.id,
            template_id: res.id,
            child_name: childName.trim(),
            child_age: age ? Number(age) : null,
            whatsapp: whatsapp.trim(),
            child_photo_path: path,
            notes: "طلب من معالج الإنشاء — المطلوب توليد الصفحات بصورة الطفل",
          });
          if (insErr) throw insErr;
          orderCreated = true;
        } catch {
          toast.error("تم توليد المحتوى لكن تعذر إرسال طلب الصور — يمكنك طلبه لاحقاً من صفحة المحتوى");
        }
      }
      return { ...res, orderCreated };
    },
    onSuccess: (data) => {
      setPageIndex(0);
      setPageImages({});
      setStep(6);
      void generateImages(data, {});
    },
    onError: (e: Error) => toast.error(e.message || "تعذر التوليد"),
  });

  const result = mutation.data;
  const currentPage = result?.pages[pageIndex];

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
        return childName.trim().length > 0;
      case 1: {
        const n = Number(age);
        return age.trim().length > 0 && n >= 1 && n <= 14;
      }
      case 2:
        return true;
      case 3:
        return !photo || isValidEgyptianMobile(whatsapp);
      case 4:
        return topic.trim().length >= 3;
      default:
        return true;
    }
  };

  const personalize = (t: string) =>
    t.replaceAll("{child}", childName.trim() || "بطلنا");

  /** الصفحة بعد تطبيق تعديلات المستخدم عليها */
  const withEdits = <T extends { n: number; title?: string; text: string }>(p: T): T =>
    pageEdits[p.n]
      ? { ...p, title: pageEdits[p.n].title || p.title, text: pageEdits[p.n].text }
      : p;

  const shownPage = currentPage ? withEdits(currentPage) : undefined;

  const goToPage = (i: number) => {
    setEditingPage(null);
    setPageIndex(i);
  };

  const startEdit = () => {
    if (!shownPage) return;
    setEditTitle(shownPage.title ?? "");
    setEditText(shownPage.text);
    setEditingPage(shownPage.n);
  };

  const saveEdit = async () => {
    if (!result || editingPage === null) return;
    const pn = editingPage;
    setSavingEdit(true);
    try {
      await updateFn({
        data: {
          templateId: result.id,
          pageNumber: pn,
          title: editTitle.trim() || undefined,
          text: editText.trim(),
        },
      });
      setPageEdits((m) => ({ ...m, [pn]: { title: editTitle.trim(), text: editText.trim() } }));
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
      const r = await imageFn({ data: { templateId: result.id, pageNumber: n } });
      if (r.imageUrl) {
        const url = r.imageUrl;
        setPageImages((m) => ({ ...m, [n]: url }));
        toast.success("تم رسم صورة جديدة لهذه الصفحة 🎨");
      } else {
        toast.error("لم نحصل على صورة، حاول مرة أخرى");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر إعادة رسم الصورة");
    } finally {
      setRegenPage(null);
    }
  };

  const reset = () => {
    mutation.reset();
    setStep(0);
    setChildName("");
    setAge("");
    setLanguage("ar");
    setPhoto(null);
    setPhotoPreview(null);
    setWhatsapp("");
    setContentType("story");
    setTopic("");
    setPageIndex(0);
    setPageImages({});
    setImgGenActive(false);
    setImgGenCount(0);
    setImgGenTotal(0);
    setPageEdits({});
    setEditingPage(null);
    setEditTitle("");
    setEditText("");
    setRegenPage(null);
  };


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
              <div className="flex items-center justify-between">
                {STEPS.map((label, i) => (
                  <div key={label} className="flex flex-1 flex-col items-center">
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

            {/* Step content */}
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
                    نكيّف اللغة والأفكار حسب عمر الطفل (من 1 إلى 14 سنة)
                  </p>
                </div>
              )}

              {step === 2 && (
                <div>
                  <Label className="font-bold">اختر لغة المحتوى</Label>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                    إذا رفعت صورة واضحة لوجه طفلك، سنرسم الصفحات بصورته كبطل كرتوني
                    ثلاثي الأبعاد وترسل لك عبر الواتساب بعد الموافقة
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
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    🔒 الصورة محفوظة بشكل خاص وآمن ولا يطلع عليها أحد سوى إدارة الموقع
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
                  <div className="mt-5">
                    <Label htmlFor="topic" className="font-bold">
                      {contentType === "story"
                        ? "فكرة القصة أو القيمة المطلوبة"
                        : "موضوع الكتاب التعليمي"}
                    </Label>
                    <Textarea
                      id="topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder={
                        contentType === "story"
                          ? "مثال: قصة عن الصدق ومساعدة الجيران، تدور أحداثها في حديقة الحي…"
                          : "مثال: تعليم أيام الأسبوع، أو جدول الضرب للمبتدئين، أو آداب الطعام…"
                      }
                      maxLength={300}
                      rows={3}
                      className="mt-2 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="text-center">
                  <h2 className="font-display text-2xl font-extrabold">
                    كل شيء جاهز! راجع اختياراتك
                  </h2>
                  <div className="mx-auto mt-5 max-w-md space-y-2 rounded-2xl bg-secondary/40 p-5 text-start text-sm">
                    <p>👦 <b>الطفل:</b> {childName.trim()} — {age} سنوات</p>
                    <p>🌍 <b>اللغة:</b> {language === "ar" ? "العربية" : "English"}</p>
                    <p>
                      📚 <b>النوع:</b>{" "}
                      {contentType === "story" ? "قصة مصورة" : "كتاب تعليمي"}
                    </p>
                    <p>💡 <b>الموضوع:</b> {topic.trim()}</p>
                    <p>
                      📸 <b>صورة الطفل:</b>{" "}
                      {photo ? "مرفوعة — ستولد نسخة مصورة بعد الموافقة" : "بدون صورة"}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate()}
                    className="mt-6 rounded-full px-10 text-base font-bold shadow-lg"
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
                      {result.title}
                    </h2>
                    <p className="mt-2 text-muted-foreground">{result.summary}</p>
                    {result.moral && (
                      <p className="mt-2 text-sm font-semibold text-candy">
                        💝 {result.contentType === "book" ? "المهارة المكتسبة" : "القيمة"}:{" "}
                        {result.moral}
                      </p>
                    )}
                  </div>

                  {/* Page viewer: عنوان + صورة + نص + رقم الصفحة */}
                  <div
                    dir={result.language === "en" ? "ltr" : "rtl"}
                    className="mt-6 overflow-hidden rounded-2xl border-2 border-secondary bg-card shadow-sm"
                  >
                    <div className="relative aspect-square w-full bg-secondary/30 md:aspect-[4/3]">
                      {currentPage && pageImages[currentPage.n] ? (
                        <img
                          src={pageImages[currentPage.n]}
                          alt={currentPage.title ?? `صورة الصفحة ${currentPage.n}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                          {imgGenActive ? (
                            <>
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <span className="text-sm font-semibold">
                                🎨 جارٍ رسم صورة هذا المشهد…
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-semibold">
                              الصورة غير متوفرة لهذه الصفحة
                            </span>
                          )}
                        </div>
                      )}
                      <span className="absolute bottom-3 start-3 rounded-full bg-primary px-3.5 py-1 text-xs font-extrabold text-primary-foreground shadow-md">
                        {result.language === "en" ? "Page" : "صفحة"} {currentPage?.n}
                      </span>
                    </div>
                    <div className="p-6 text-center">
                      {currentPage?.title && (
                        <h3 className="font-display text-2xl font-extrabold text-primary">
                          {currentPage.title}
                        </h3>
                      )}
                      <p className="mt-2 min-h-16 font-display text-xl font-semibold leading-relaxed">
                        {personalize(currentPage?.text ?? "")}
                      </p>
                    </div>
                  </div>
                  <div dir="rtl" className="mt-4 flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      disabled={pageIndex === 0}
                      onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                      aria-label="الصفحة السابقة"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <div className="flex gap-1.5">
                      {result.pages.map((p, i) => (
                        <button
                          key={p.n}
                          onClick={() => setPageIndex(i)}
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
                      className="rounded-full"
                      disabled={pageIndex === result.pages.length - 1}
                      onClick={() =>
                        setPageIndex((i) => Math.min(result.pages.length - 1, i + 1))
                      }
                      aria-label="الصفحة التالية"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </div>

                  {imgGenActive && (
                    <p className="mt-4 text-center text-sm font-semibold text-muted-foreground">
                      🎨 جارٍ توليد الصور المتناسقة مع نص كل صفحة… {imgGenCount}/
                      {imgGenTotal}
                    </p>
                  )}
                  {!imgGenActive &&
                    result.pages.some((p) => !pageImages[p.n]) && (
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



                  {result.orderCreated ? (
                    <p className="mt-6 rounded-2xl bg-grass/15 p-4 text-center text-sm font-semibold text-grass">
                      🎉 تم استلام طلبك! بعد الموافقة سنولّد الصفحات المصورة بصورة
                      طفلك ونرسلها لك عبر الواتساب
                    </p>
                  ) : (
                    <p className="mt-6 text-center text-sm text-muted-foreground">
                      تريد نسخة مصورة بصورة طفلك؟{" "}
                      <Link
                        to="/order/$templateId"
                        params={{ templateId: result.id }}
                        className="font-bold text-primary hover:underline"
                      >
                        اطلبها الآن
                      </Link>
                    </p>
                  )}

                  {/* Export & share */}
                  <div className="mt-6">
                    <PdfActions
                      title={personalize(result.title)}
                      childName={childName.trim() || null}
                      moral={result.moral ? personalize(result.moral) : null}
                      language={result.language}
                      contentType={result.contentType}
                      pages={result.pages.map((p) => ({
                        n: p.n,
                        title: p.title ?? null,
                        text: p.text,
                        imageUrl: pageImages[p.n] ?? null,
                      }))}
                      disabled={imgGenActive}
                    />
                    <div className="mt-3 text-center">
                      <Button
                        size="lg"
                        variant="ghost"
                        className="rounded-full font-bold"
                        onClick={reset}
                      >
                        <RotateCcw className="ms-2 h-4 w-4" />
                        إنشاء جديد
                      </Button>
                    </div>
                    <p className="mt-1 text-center text-xs text-muted-foreground">
                      يحتوي الملف على غلاف وجميع الصفحات بالنص والصورة، وتحفظ نسخة في حسابك
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              {step < 5 && (
                <div className="mt-8 flex items-center justify-between">
                  <Button
                    variant="outline"
                    className="rounded-full px-6 font-bold"
                    disabled={step === 0}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    <ArrowRight className="ms-1 h-4 w-4" />
                    السابق
                  </Button>
                  <Button
                    className="rounded-full px-8 font-bold shadow-md"
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

        {/* Print version */}
        {result && (
          <div className="hidden print:block" dir={result.language === "en" ? "ltr" : "rtl"}>
            <div className="print-page min-h-screen flex-col items-center justify-center p-8 text-center">
              <h1 className="font-display text-5xl font-extrabold">{result.title}</h1>
              <p className="mt-6 text-2xl">
                {result.language === "en" ? "Hero:" : "بطل الحكاية:"} {childName.trim()} ⭐
              </p>
              {result.moral && <p className="mt-4 text-lg">{result.moral}</p>}
            </div>
            {result.pages.map((p) => (
              <div
                key={p.n}
                className="print-page min-h-screen flex-col items-center justify-center gap-5 p-8"
              >
                {p.title && (
                  <h2 className="font-display text-3xl font-extrabold">{p.title}</h2>
                )}
                {pageImages[p.n] && (
                  <img
                    src={pageImages[p.n]}
                    alt={p.title ?? `صفحة ${p.n}`}
                    className="max-h-[55vh] rounded-2xl object-contain"
                  />
                )}
                <p className="max-w-2xl text-center font-display text-2xl leading-relaxed">
                  {personalize(p.text)}
                </p>
                <span className="text-sm text-muted-foreground">— {p.n} —</span>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
