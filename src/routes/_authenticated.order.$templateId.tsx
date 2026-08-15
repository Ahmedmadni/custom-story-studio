import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Loader2, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isValidEgyptianMobile } from "@/features/orders/whatsapp";
import { LANGUAGE_OPTIONS, type LanguageMode } from "@/features/ai/storyTypes";
import { HERO_OPTIONS, HERO_CATEGORIES, type HeroOption } from "@/features/orders/heroes";
import { cn } from "@/lib/utils";
import photoModeRealImg from "@/assets/photo-mode-real.jpg";
import photoModeCartoonImg from "@/assets/photo-mode-cartoon.jpg";
import { optimizeImage } from "@/lib/imageOptimize";
import { AspectRatioPicker } from "@/features/orders/AspectRatioPicker";
import { orientationFromAspectRatio, type AspectRatio } from "@/features/ai/storyStyle";

export const Route = createFileRoute("/_authenticated/order/$templateId")({
  head: () => ({
    meta: [{ title: "اطلب القصة — كيدزي" }],
  }),
  component: OrderPage,
});

const MAX_PHOTO_MB = 8;

type PhotoMode = "real" | "cartoon";

const PHOTO_MODE_OPTIONS: {
  value: PhotoMode;
  label: string;
  desc: string;
  image: string;
}[] = [
  {
    value: "cartoon",
    label: "شخصية كرتونية",
    desc: "نحوّل وجه طفلك إلى شخصية ثلاثية الأبعاد بأسلوب أفلام ديزني/بيكسار",
    image: photoModeCartoonImg,
  },
  {
    value: "real",
    label: "وجه حقيقي في مشهد كرتوني",
    desc: "نُبقي وجه طفلك الحقيقي تماماً ونضعه داخل عالم كرتوني سينمائي (مثل أفلام Sonic / Tom & Jerry)",
    image: photoModeRealImg,
  },
];

const RELATION_OPTIONS = ["الأب", "الأم", "الجد", "الجدة", "العم", "العمة", "الخال", "الخالة", "الأخ", "الأخت", "صديق العائلة"];

function OrderPage() {
  const { templateId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [childName, setChildName] = useState("");
  const [childNameEn, setChildNameEn] = useState("");
  const [childAge, setChildAge] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [language, setLanguage] = useState<LanguageMode>("ar");
  const [photoMode, setPhotoMode] = useState<PhotoMode>("cartoon");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [heroCharacter, setHeroCharacter] = useState("");
  const [heroQuery, setHeroQuery] = useState("");
  const [heroCat, setHeroCat] = useState<"الكل" | HeroOption["category"]>("الكل");
  const [gifterName, setGifterName] = useState("");
  const [gifterRelation, setGifterRelation] = useState("");
  const [publishConsent, setPublishConsent] = useState(false);

  const filteredHeroes = useMemo(() => {
    const q = heroQuery.trim().toLowerCase();
    return HERO_OPTIONS.filter((h) => {
      if (heroCat !== "الكل" && h.category !== heroCat) return false;
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        h.enName.toLowerCase().includes(q) ||
        h.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [heroQuery, heroCat]);


  const { data: template } = useQuery({
    queryKey: ["template", templateId],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, title, summary, cover_url, language")
        .eq("id", templateId)
        .maybeSingle();
      return data;
    },
  });

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
    setPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!user) return;
    if (!childName.trim()) return toast.error("اكتب اسم الطفل");
    if (!isValidEgyptianMobile(whatsapp))
      return toast.error("اكتب رقم واتساب مصري صحيح مثل 01012345678");
    if (!photo) return toast.error("ارفع صورة الطفل");

    setSubmitting(true);
    try {
      const { file: optimized } = await optimizeImage(photo, { maxWidth: 1400, quality: 0.85 });
      const ext = optimized.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("child-photos")
        .upload(path, optimized, { contentType: optimized.type });
      if (uploadErr) throw new Error("تعذر رفع الصورة، حاول مرة أخرى");

      const heroNote = heroCharacter.trim()
        ? `البطل المفضل: ${heroCharacter.trim()}`
        : "";
      const userNote = notes.trim();
      const combinedNotes = [heroNote, userNote].filter(Boolean).join(" — ") || null;

      const { error: insertErr } = await supabase.from("orders").insert({
        user_id: user.id,
        template_id: templateId,
        child_name: childName.trim(),
        child_name_en: childNameEn.trim() || null,
        child_age: childAge ? Number(childAge) : null,
        whatsapp: whatsapp.trim(),
        child_photo_path: path,
        language,
        photo_mode: photoMode,
        aspect_ratio: aspectRatio,
        orientation: orientationFromAspectRatio(aspectRatio),
        hero_character: heroCharacter.trim() || null,
        notes: combinedNotes,
        gifted_by_name: gifterName.trim() || null,
        gifted_by_relation: gifterRelation.trim() || null,
        publish_consent: publishConsent,
        ...(isAdmin
          ? { payment_status: "verified", status: "approved", price_egp: 0, paid_at: new Date().toISOString() }
          : {}),
      });
      if (insertErr) throw new Error("تعذر إرسال الطلب");

      toast.success(
        isAdmin
          ? "تم إنشاء الطلب واعتماده — يمكنك الآن توليد القصة من لوحة التحكم 🎉"
          : "تم استلام طلبك! سنراجعه ونتواصل معك قريباً 🎉",
      );
      void navigate({ to: isAdmin ? "/admin/orders" : "/my-orders" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold">
          اطلب قصة «{template?.title ?? "…"}»
        </h1>
        <p className="mt-2 text-muted-foreground">
          خصّص القصة كما تحب: اللغة، شكل بطل القصة، وحتى البطل الخارق المفضل لطفلك
        </p>

        <div className="mt-8 space-y-6 rounded-3xl border-2 border-border bg-card p-6 shadow-sm md:p-8">
          {/* صورة الطفل */}
          <div>
            <Label className="font-bold">صورة الطفل</Label>
            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/30 p-6 transition-colors hover:bg-secondary/60">
              {preview ? (
                <img
                  src={preview}
                  alt="معاينة صورة الطفل"
                  className="h-44 w-44 rounded-2xl object-cover shadow-md"
                />
              ) : (
                <>
                  <Camera className="h-10 w-10 text-primary" />
                  <span className="mt-2 text-sm font-semibold text-muted-foreground">
                    اضغط لاختيار صورة واضحة لوجه الطفل
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
            <p className="mt-2 text-xs text-muted-foreground">
              🔒 الصورة محفوظة بشكل خاص وآمن ولا يطلع عليها أحد سوى إدارة الموقع
            </p>
          </div>

          {/* الاسم والعمر */}
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="cname" className="font-bold">اسم الطفل</Label>
              <Input
                id="cname"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="مثال: يوسف"
                maxLength={40}
                className="mt-2 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="cage" className="font-bold">العمر (اختياري)</Label>
              <Input
                id="cage"
                type="number"
                min={1}
                max={14}
                value={childAge}
                onChange={(e) => setChildAge(e.target.value)}
                className="mt-2 rounded-xl"
              />
            </div>
          </div>

          {(language === "en" || language === "bilingual") && (
            <div>
              <Label htmlFor="cname-en" className="font-bold">
                Child's name in English {language === "bilingual" ? "(اختياري)" : ""}
              </Label>
              <Input
                id="cname-en"
                dir="ltr"
                value={childNameEn}
                onChange={(e) => setChildNameEn(e.target.value)}
                placeholder="e.g. Youssef"
                maxLength={40}
                className="mt-2 rounded-xl"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                سيُستخدم هذا الاسم في النص الإنجليزي من القصة.
              </p>
            </div>
          )}

          {/* اللغة */}
          <div>
            <Label className="font-bold">لغة القصة</Label>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLanguage(opt.value as LanguageMode)}
                  className={cn(
                    "rounded-2xl border-2 p-3 text-right transition-all",
                    language === opt.value
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  <div className="font-bold">{opt.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <AspectRatioPicker value={aspectRatio} onChange={setAspectRatio} />

          {/* نمط وجه الطفل */}
          <div>
            <Label className="font-bold">نمط بطل القصة (وجه طفلك)</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              اختر الأسلوب الذي تحب أن نُظهر به طفلك في القصة
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {PHOTO_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPhotoMode(opt.value)}
                  className={cn(
                    "group overflow-hidden rounded-2xl border-2 text-right transition-all",
                    photoMode === opt.value
                      ? "border-primary shadow-lg ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-secondary/40">
                    <img
                      src={opt.image}
                      alt={opt.label}
                      loading="lazy"
                      width={768}
                      height={768}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    {photoMode === opt.value && (
                      <div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground shadow">
                        ✓ مختار
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-bold">{opt.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* البطل المفضل */}
          <div>
            <Label htmlFor="hero" className="flex items-center gap-2 font-bold">
              <Sparkles className="h-4 w-4 text-primary" />
              بطل مفضل لطفلك (اختياري)
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              اختر من القائمة أو اكتب اسماً آخر — سنحاول إدماجه أو روح شخصيته في القصة
            </p>

            <Input
              dir="rtl"
              value={heroQuery}
              onChange={(e) => setHeroQuery(e.target.value)}
              placeholder="🔍 ابحث عن بطل (مثال: باتمان، سوبر، spider)…"
              className="mt-3 rounded-xl"
            />

            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["الكل", ...HERO_CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setHeroCat(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                    heroCat === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-border bg-secondary/20 p-2 sm:grid-cols-3 md:grid-cols-4">
              {filteredHeroes.length === 0 ? (
                <div className="col-span-full p-4 text-center text-xs text-muted-foreground">
                  لا توجد نتائج — اكتب اسم البطل في الحقل بالأسفل
                </div>
              ) : (
                filteredHeroes.map((h) => {
                  const selected = heroCharacter === h.name;
                  return (
                    <button
                      key={h.enName}
                      type="button"
                      onClick={() => {
                        setHeroCharacter(selected ? "" : h.name);
                        setHeroQuery("");
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-center transition-all",
                        selected
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-transparent bg-card hover:border-primary/40",
                      )}
                    >
                      <span className="text-2xl">{h.emoji}</span>
                      <span className="text-[11px] font-bold leading-tight">{h.name}</span>
                    </button>
                  );
                })
              )}
            </div>

            <Input
              id="hero"
              value={heroCharacter}
              onChange={(e) => setHeroCharacter(e.target.value)}
              placeholder="أو اكتب اسماً آخر هنا…"
              maxLength={60}
              className="mt-3 rounded-xl"
            />
            {heroCharacter.trim() && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                البطل المختار: {heroCharacter}
                <button
                  type="button"
                  onClick={() => setHeroCharacter("")}
                  className="text-primary/70 hover:text-primary"
                  aria-label="إلغاء"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* إهداء القصة */}
          <div className="rounded-2xl border-2 border-pink-200 bg-pink-50/40 p-4">
            <Label className="flex items-center gap-2 font-bold">
              💝 إهداء القصة (اختياري)
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              اكتب اسم مهدي القصة (الأب/الأم/الجد…) — سيظهر في غلاف القصة وفي صفحة الإهداء داخل النص.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="gifter-name" className="text-sm">اسم المُهدي</Label>
                <Input
                  id="gifter-name"
                  value={gifterName}
                  onChange={(e) => setGifterName(e.target.value)}
                  placeholder="مثال: أحمد"
                  maxLength={60}
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="gifter-rel" className="text-sm">العلاقة</Label>
                <select
                  id="gifter-rel"
                  value={gifterRelation}
                  onChange={(e) => setGifterRelation(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-border bg-background p-2 text-sm"
                >
                  <option value="">— اختر —</option>
                  {RELATION_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* موافقة النشر */}
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-secondary/20 p-4">
            <input
              type="checkbox"
              checked={publishConsent}
              onChange={(e) => setPublishConsent(e.target.checked)}
              className="mt-1 h-5 w-5 accent-primary"
            />
            <div className="text-sm">
              <div className="font-bold">أوافق على نشر قصتي ضمن «من أعمالنا» في المكتبة 🌟</div>
              <div className="mt-1 text-xs text-muted-foreground">
                هذا اختياري تماماً — يمكنك تغيير الموافقة لاحقاً من صفحة القصة بعد التسليم.
              </div>
            </div>
          </label>



          {/* واتساب */}
          <div>
            <Label htmlFor="wa" className="font-bold">رقم الواتساب لاستلام القصة</Label>
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

          {/* ملاحظات */}
          <div>
            <Label htmlFor="notes" className="font-bold">ملاحظات (اختياري)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="أي تفاصيل تحب إضافتها…"
              className="mt-2 rounded-xl"
            />
          </div>

          <Button
            size="lg"
            disabled={submitting}
            onClick={() => void submit()}
            className="w-full rounded-full text-base font-bold shadow-lg"
          >
            {submitting ? (
              <>
                <Loader2 className="ms-2 h-5 w-5 animate-spin" />
                جارٍ إرسال الطلب…
              </>
            ) : (
              <>
                <Send className="ms-2 h-5 w-5" />
                إرسال الطلب
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            بعد الموافقة على طلبك سيتم توليد القصة وإرسالها لك عبر الواتساب
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
