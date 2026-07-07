import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Loader2,
  Receipt,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChildPicker, type ChildPickerProfile } from "@/features/children/ChildPicker";
import {
  CONTENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  LANGUAGE_OPTIONS,
  type Gender,
  type LanguageMode,
} from "@/features/ai/storyTypes";
import { BOOK_CATEGORIES, type BookCategoryValue } from "@/features/library/bookCategories";
import { CUSTOM_PRICES } from "@/features/cart/pricing";
import { isValidEgyptianMobile } from "@/features/orders/whatsapp";
import { submitCustomStoryRequest } from "@/features/orders/customRequest.functions";
import { optimizeImage } from "@/lib/imageOptimize";

export const Route = createFileRoute("/_authenticated/request-story")({
  head: () => ({
    meta: [
      { title: "اطلب قصة بأفكارك — كيدزي" },
      {
        name: "description",
        content:
          "أرسل فكرتك لقصة مخصصة لطفلك، ادفع، وارفع إيصال التحويل — وفريقنا يجهّزها لك خلال أيام.",
      },
    ],
  }),
  component: RequestStoryPage,
});

const STEPS = ["بيانات الطفل", "اللغة والنوع", "فكرة القصة", "الصورة والإهداء", "الدفع والإرسال"];

const MAX_FILE_MB = 8;

function RequestStoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitCustomStoryRequest);

  const [step, setStep] = useState(0);

  // بيانات الطفل
  const [childId, setChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState("");
  const [childNameEn, setChildNameEn] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");

  // اللغة والنوع
  const [language, setLanguage] = useState<LanguageMode | "">("");
  const [contentType, setContentType] = useState<"story" | "book">("story");
  const [bookCategory, setBookCategory] = useState<BookCategoryValue | "">("");
  const [pagesCount, setPagesCount] = useState<10 | 16>(10);

  // الفكرة
  const [topic, setTopic] = useState("");

  // الصورة + إهداء + واتساب
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoMode, setPhotoMode] = useState<"cartoon" | "real">("real");
  const [whatsapp, setWhatsapp] = useState("");
  const [gifterName, setGifterName] = useState("");
  const [gifterRelation, setGifterRelation] = useState("");

  // إيصال
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [publishConsent, setPublishConsent] = useState(false);

  const needsEnglish = language === "en" || language === "bilingual";
  const price = CUSTOM_PRICES[pagesCount];

  const onPickFile = (
    f: File | null,
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void,
  ) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("الرجاء اختيار صورة");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`الحجم الأقصى ${MAX_FILE_MB} ميجابايت`);
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const canNext = (): boolean => {
    switch (step) {
      case 0: {
        const n = Number(age);
        if (!childName.trim() || !gender || !age || n < 1 || n > 14) return false;
        if (needsEnglish && !childNameEn.trim()) return false;
        return true;
      }
      case 1:
        return !!language && (contentType === "story" || !!bookCategory);
      case 2:
        return topic.trim().length >= 10;
      case 3:
        return isValidEgyptianMobile(whatsapp);
      default:
        return true;
    }
  };

  const uploadToBucket = async (file: File, bucket: string): Promise<string> => {
    if (!user) throw new Error("سجّل الدخول أولاً");
    const { file: optimized } = await optimizeImage(file, { maxWidth: 1600, quality: 0.85 });
    const ext = optimized.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, optimized, { contentType: optimized.type });
    if (error) throw new Error(`تعذر رفع الملف: ${error.message}`);
    return path;
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!receipt) throw new Error("ارفع إيصال الدفع أولاً");
      if (!gender || !language) throw new Error("بيانات ناقصة");
      const receiptPath = await uploadToBucket(receipt, "payment-receipts");
      const childPhotoPath = photo ? await uploadToBucket(photo, "child-photos") : null;
      return submitFn({
        data: {
          childId,
          childName: childName.trim(),
          childNameEn: needsEnglish ? childNameEn.trim() : null,
          childAge: Number(age),
          gender,
          language,
          contentType,
          bookCategory: contentType === "book" ? bookCategory || null : null,
          pagesCount,
          topic: topic.trim(),
          whatsapp: whatsapp.trim(),
          photoMode,
          childPhotoPath,
          gifterName: gifterName.trim() || null,
          gifterRelation: gifterRelation.trim() || null,
          receiptPath,
          publishConsent,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم استلام طلبك ✨ سيراجعه فريقنا ويبدأ التنفيذ");
      void navigate({ to: "/my-orders" });
    },
    onError: (e: Error) => {
      toast.error(e?.message || "تعذر إرسال الطلب");
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-bold text-secondary-foreground">
            <Wand2 className="h-4 w-4" />
            طلب قصة بأفكارك الخاصة
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold">
            اطلب قصة مخصصة بطلها طفلك ✨
          </h1>
          <p className="mt-2 text-muted-foreground">
            أدخل بيانات الطفل وفكرة قصتك، ادفع المبلغ، وفريقنا يجهّز القصة كاملةً ويرسلها لك عبر
            واتساب.
          </p>
        </div>

        {/* Stepper */}
        <div className="mt-8">
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

        <div className="mt-8 rounded-3xl border-2 border-border bg-card p-6 shadow-sm md:p-8">
          {step === 0 && (
            <div className="space-y-5">
              <ChildPicker
                selectedId={childId}
                onSelect={(child: ChildPickerProfile | null) => {
                  if (!child) {
                    setChildId(null);
                    return;
                  }
                  setChildId(child.id);
                  setChildName(child.name);
                  setAge(child.age != null ? String(child.age) : "");
                  setGender(child.gender === "girl" ? "girl" : "boy");
                }}
              />
              <div>
                <Label htmlFor="cn" className="font-bold">
                  اسم الطفل (بالعربية)
                </Label>
                <Input
                  id="cn"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  maxLength={40}
                  className="mt-2 rounded-xl"
                  placeholder="مثال: يوسف"
                />
              </div>
              {needsEnglish && (
                <div>
                  <Label htmlFor="cne" className="font-bold">
                    اسم الطفل (بالإنجليزية)
                  </Label>
                  <Input
                    id="cne"
                    dir="ltr"
                    value={childNameEn}
                    onChange={(e) => setChildNameEn(e.target.value)}
                    maxLength={40}
                    className="mt-2 rounded-xl text-left"
                    placeholder="e.g. Youssef"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    سنستخدم هذه الكتابة في النص الإنجليزي للقصة.
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="ag" className="font-bold">
                  العمر (1–14)
                </Label>
                <Input
                  id="ag"
                  type="number"
                  min={1}
                  max={14}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="mt-2 w-32 rounded-xl"
                />
              </div>
              <div>
                <Label className="font-bold">جنس البطل</Label>
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
            <div className="space-y-5">
              <div>
                <Label className="font-bold">لغة المحتوى</Label>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {LANGUAGE_OPTIONS.map((l) => (
                    <button
                      key={l.value}
                      onClick={() => setLanguage(l.value)}
                      className={`rounded-2xl border-2 p-4 text-start transition-colors ${
                        language === l.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="font-display text-lg font-bold">{l.label}</span>
                      <p className="mt-1 text-xs text-muted-foreground">{l.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="font-bold">نوع المحتوى</Label>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {CONTENT_TYPE_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setContentType(c.value)}
                      className={`rounded-2xl border-2 p-4 text-start transition-colors ${
                        contentType === c.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="font-display text-lg font-bold">{c.label}</span>
                      <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              {contentType === "book" && (
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
              )}
              <div>
                <Label className="font-bold">عدد الصفحات والسعر</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  🪄 قصة مخصصة بأفكارك: 10 صفحات = {CUSTOM_PRICES[10]} ج، 16 صفحة ={" "}
                  {CUSTOM_PRICES[16]} ج
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {([10, 16] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPagesCount(n)}
                      className={`rounded-2xl border-2 p-4 text-center transition-colors ${
                        pagesCount === n
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-display text-2xl font-extrabold">{n}</div>
                      <div className="text-xs font-bold text-muted-foreground">
                        صفحة — {CUSTOM_PRICES[n]} ج.م
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <Label htmlFor="topic" className="font-bold">
                اكتب فكرة قصتك بتفصيل
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                اشرح الحكاية أو القيمة التي تريدها، الشخصيات الثانوية، البيئة (مدرسة/بحر/فضاء…)،
                والنهاية المطلوبة. كلما زادت التفاصيل، كانت القصة أقرب لخيالك.
              </p>
              <Textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={8}
                maxLength={800}
                placeholder="مثال: قصة عن يوسف وصديقه الأرنب يتعلمان أهمية الصدق عندما يضيعان في الغابة ويلتقيان بثعلب حكيم…"
                className="mt-3 rounded-xl"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {topic.trim().length}/800 — حد أدنى 10 أحرف
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <Label className="font-bold">صورة الطفل (اختياري)</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  صورة وجه واضحة تساعدنا على رسم البطل يشبه طفلك.
                </p>
                <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/30 p-6 transition-colors hover:bg-secondary/60">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt=""
                      className="h-40 w-40 rounded-2xl object-cover shadow-md"
                    />
                  ) : (
                    <>
                      <Camera className="h-10 w-10 text-primary" />
                      <span className="mt-2 text-sm font-semibold text-muted-foreground">
                        اضغط لاختيار صورة (يمكنك التخطي)
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      onPickFile(e.target.files?.[0] ?? null, setPhoto, setPhotoPreview)
                    }
                  />
                </label>
                {photo && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPhotoMode("real")}
                      className={`rounded-2xl border-2 p-3 text-start text-sm transition-colors ${photoMode === "real" ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      <b>وجه طفلك الحقيقي</b> داخل مشهد كرتوني (موصى به)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoMode("cartoon")}
                      className={`rounded-2xl border-2 p-3 text-start text-sm transition-colors ${photoMode === "cartoon" ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      شخصية كرتونية بالكامل
                    </button>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="wa" className="font-bold">
                  رقم الواتساب لاستلام القصة
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
              </div>
              <div className="rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50/40 p-4">
                <Label className="font-bold">بيانات الإهداء (اختياري) 💝</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  إذا كانت القصة هدية، اكتب اسم المُهدي وصلته بالطفل لتظهر داخل القصة.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="gn" className="text-xs">
                      اسم المُهدي
                    </Label>
                    <Input
                      id="gn"
                      value={gifterName}
                      onChange={(e) => setGifterName(e.target.value)}
                      maxLength={60}
                      className="mt-1 rounded-xl"
                      placeholder="مثال: جدّو أحمد"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gr" className="text-xs">
                      الصلة
                    </Label>
                    <Input
                      id="gr"
                      value={gifterRelation}
                      onChange={(e) => setGifterRelation(e.target.value)}
                      maxLength={40}
                      className="mt-1 rounded-xl"
                      placeholder="مثال: جدّ / خالة"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="rounded-2xl bg-secondary/40 p-5 text-sm">
                <h3 className="font-display text-lg font-extrabold">ملخص الطلب</h3>
                <div className="mt-3 space-y-1.5">
                  <p>
                    👦 <b>الطفل:</b> {childName.trim()}{" "}
                    {needsEnglish && childNameEn ? `(${childNameEn})` : ""} — {age} سنوات
                  </p>
                  <p>
                    🌍 <b>اللغة:</b> {LANGUAGE_OPTIONS.find((l) => l.value === language)?.label}
                  </p>
                  <p>
                    📚 <b>النوع:</b>{" "}
                    {contentType === "story"
                      ? "قصة مصورة"
                      : `كتاب تعليمي — ${BOOK_CATEGORIES.find((c) => c.value === bookCategory)?.label ?? ""}`}
                  </p>
                  <p>
                    📄 <b>الصفحات:</b> {pagesCount} صفحة
                  </p>
                  <p>
                    📸 <b>الصورة:</b>{" "}
                    {photo ? (photoMode === "real" ? "وجه حقيقي" : "كرتونية") : "بدون"}
                  </p>
                  {gifterName && (
                    <p>
                      💝 <b>إهداء من:</b> {gifterRelation} {gifterName}
                    </p>
                  )}
                </div>
                <div className="mt-4 rounded-xl bg-primary/10 p-3 text-center">
                  <p className="text-xs font-bold text-muted-foreground">المبلغ المطلوب</p>
                  <p className="font-display text-3xl font-extrabold text-primary">{price} ج.م</p>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-card p-5">
                <h4 className="font-display text-base font-extrabold">تعليمات الدفع</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  حوّل المبلغ <b>{price} ج.م</b> عبر فودافون كاش / إنستاباي على الرقم:
                </p>
                <p
                  dir="ltr"
                  className="mt-2 text-center font-display text-2xl font-extrabold tracking-wider text-primary"
                >
                  0112 001 6502
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  ثم ارفع صورة إيصال التحويل بالأسفل ليتم اعتماد طلبك.
                </p>
              </div>

              <div>
                <Label className="font-bold">إيصال الدفع</Label>
                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-grass/50 bg-secondary/30 p-6 transition-colors hover:bg-secondary/60">
                  {receiptPreview ? (
                    <img
                      src={receiptPreview}
                      alt=""
                      className="h-44 w-auto rounded-xl object-contain"
                    />
                  ) : (
                    <>
                      <Receipt className="h-10 w-10 text-grass" />
                      <span className="mt-2 text-sm font-semibold text-muted-foreground">
                        اضغط لرفع صورة إيصال التحويل
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      onPickFile(e.target.files?.[0] ?? null, setReceipt, setReceiptPreview)
                    }
                  />
                </label>
              </div>

              <label className="flex items-start gap-2 rounded-xl border border-border bg-secondary/20 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={publishConsent}
                  onChange={(e) => setPublishConsent(e.target.checked)}
                  className="mt-1"
                />
                <span>أوافق على عرض قصة طفلي في قسم «من أعمالنا» كنموذج (اختياري).</span>
              </label>

              <Button
                size="lg"
                disabled={submit.isPending || !receipt}
                onClick={() => submit.mutate()}
                className="w-full rounded-full text-base font-bold"
              >
                {submit.isPending ? (
                  <>
                    <Loader2 className="ms-2 h-5 w-5 animate-spin" />
                    جارٍ إرسال الطلب…
                  </>
                ) : (
                  <>
                    <Sparkles className="ms-2 h-5 w-5" />
                    إرسال الطلب
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Nav buttons */}
          {step < 4 && (
            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-full font-bold"
              >
                <ArrowRight className="ms-2 h-4 w-4" />
                السابق
              </Button>
              <Button
                disabled={!canNext()}
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                className="rounded-full font-bold"
              >
                التالي
                <ArrowLeft className="ms-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          هل تفضّل قصة جاهزة من المكتبة؟{" "}
          <Link to="/stories" className="font-bold text-primary hover:underline">
            تصفّح المكتبة
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
