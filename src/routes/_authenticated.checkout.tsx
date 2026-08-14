import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, Copy, Loader2, Receipt, Send, ShoppingBag, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { TrustBadges } from "@/components/TrustBadges";
import { WaitingListStatus } from "@/components/WaitingListStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  pagesOptionsFor,
  packageTierFor,
  pricePerPages,
  useCart,
} from "@/features/cart/CartContext";
import { submitCheckout } from "@/features/orders/checkout.functions";

import { optimizeImage } from "@/lib/imageOptimize";
import {
  GENDER_OPTIONS,
  LANGUAGE_OPTIONS,
  type Gender,
  type LanguageMode,
} from "@/features/ai/storyTypes";
import { Checkbox } from "@/components/ui/checkbox";
import { ADMIN_WHATSAPP, isValidEgyptianMobile } from "@/features/orders/whatsapp";
import { ComingSoonPaymentDialog } from "@/features/payments/ComingSoonPaymentDialog";
import { ComingSoonPrintCard } from "@/components/ComingSoonPrintCard";
import { ChildPicker, type ChildPickerProfile } from "@/features/children/ChildPicker";
import { AspectRatioPicker } from "@/features/orders/AspectRatioPicker";
import type { AspectRatio } from "@/features/ai/storyStyle";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [{ title: "إتمام الطلب — كيدزي" }],
  }),
  component: CheckoutPage,
});

const MAX_PHOTO_MB = 8;
const VODAFONE_NUMBER = "01120016502";

type PhotoMode = "cartoon" | "real";

type ItemDraft = {
  childId: string | null;
  childName: string;
  childNameEn: string;
  childAge: string;
  gender: Gender | "";
  notes: string;
  photo: File | null;
  preview: string | null;
  language: LanguageMode;
  photoMode: PhotoMode;
  aspectRatio: AspectRatio;
  publishConsent: boolean;
  pagesCount: 10 | 16;
  gifterName: string;
  gifterRelation: string;
};

const RELATION_OPTIONS = [
  "الأم",
  "الأب",
  "الجدة",
  "الجد",
  "العمة",
  "العم",
  "الخالة",
  "الخال",
  "الأخت",
  "الأخ",
  "صديق العائلة",
];

function CheckoutPage() {
  const { user } = useAuth();
  const { items, clear } = useCart();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitCheckout);
  const [paymentMethod, setPaymentMethod] = useState<"vodafone_cash">("vodafone_cash");
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.templateId,
        {
          childId: null,
          childName: "",

          childNameEn: "",
          childAge: "",
          gender: "" as const,
          notes: "",
          photo: null,
          preview: null,
          language: "ar" as LanguageMode,
          photoMode: "cartoon" as PhotoMode,
          aspectRatio: "16:9" as AspectRatio,
          publishConsent: false,
          pagesCount: 10 as 10 | 16,
          gifterName: "",
          gifterRelation: "",
        },
      ]),
    ),
  );
  const [whatsapp, setWhatsapp] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState("");

  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-16 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-bold">سلتك فارغة</h1>
          <Button asChild className="mt-6 rounded-full font-bold">
            <Link to="/stories">تصفح القصص</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const updateDraft = (id: string, patch: Partial<ItemDraft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const onPhotoChange = (id: string, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("الرجاء اختيار صورة");
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast.error(`الصورة أكبر من ${MAX_PHOTO_MB} ميجابايت`);
      return;
    }
    updateDraft(id, { photo: file, preview: URL.createObjectURL(file) });
  };

  const onReceiptChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("الرجاء اختيار صورة للإيصال");
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast.error(`الإيصال أكبر من ${MAX_PHOTO_MB} ميجابايت`);
      return;
    }
    setReceipt(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const copyNumber = () => {
    navigator.clipboard.writeText(VODAFONE_NUMBER);
    toast.success("تم نسخ الرقم");
  };

  const submit = async () => {
    if (!user) return;
    if (!isValidEgyptianMobile(whatsapp))
      return toast.error("اكتب رقم واتساب مصري صحيح مثل 01012345678");
    if (!receipt) return toast.error("ارفع صورة إيصال التحويل");

    for (const item of items) {
      const d = drafts[item.templateId];
      if (!d?.childName.trim()) return toast.error(`اكتب اسم الطفل لـ «${item.title}»`);
      if (!d?.gender) return toast.error(`اختر جنس البطل لـ «${item.title}»`);
      if (!d?.photo) return toast.error(`ارفع صورة الطفل لـ «${item.title}»`);
    }

    setSubmitting(true);
    try {
      // 1) receipt upload (vodafone only)
      let receiptPath = "";
      if (paymentMethod === "vodafone_cash" && receipt) {
        const receiptOpt = await optimizeImage(receipt, { maxWidth: 1800, quality: 0.85 });
        const rExt = receiptOpt.file.name.split(".").pop()?.toLowerCase() || "jpg";
        receiptPath = `${user.id}/${crypto.randomUUID()}.${rExt}`;
        const { error: rErr } = await supabase.storage
          .from("payment-receipts")
          .upload(receiptPath, receiptOpt.file, { contentType: receiptOpt.file.type });
        if (rErr) throw new Error("تعذر رفع الإيصال");
      }

      // 2) upload each child photo (optimized)
      const uploadedItems = await Promise.all(
        items.map(async (item) => {
          const d = drafts[item.templateId];
          const opt = await optimizeImage(d.photo!, { maxWidth: 1400, quality: 0.85 });
          const ext = opt.file.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage
            .from("child-photos")
            .upload(path, opt.file, { contentType: opt.file.type });
          if (error) throw new Error(`تعذر رفع صورة «${item.title}»`);
          return {
            templateId: item.templateId,
            childName: d.childName.trim(),
            childAge: d.childAge ? Number(d.childAge) : null,
            gender: d.gender as Gender,
            childPhotoPath: path,
            notes: d.notes.trim() || null,
          };
        }),
      );

      const itemsPayload = uploadedItems.map((it) => {
        const d = drafts[it.templateId];
        return {
          ...it,
          childId: d.childId,
          childNameEn: d.childNameEn.trim() || null,
          language: d.language,
          photoMode: d.photoMode,
          aspectRatio: d.aspectRatio,
          publishConsent: d.publishConsent,
          pagesCount: d.pagesCount,
          gifterName: d.gifterName.trim() || null,
          gifterRelation: d.gifterRelation.trim() || null,
        };
      });

      // 3) create orders (Vodafone Cash only — Kashier postponed)
      const result = await submitFn({
        data: {
          whatsapp: whatsapp.trim(),
          receiptPath,
          printCopy: false,
          deliveryAddress: null,
          items: itemsPayload,
          couponCode: couponCode.trim() || null,
        },
      });

      clear();
      toast.success(
        result.couponDiscountEgp || result.packageDiscountEgp
          ? `تم استلام طلبك! وفّرت ${result.couponDiscountEgp + result.packageDiscountEgp} ج 🎉`
          : "تم استلام طلبك! سنراجع الإيصال ونرسل القصة على واتساب 🎉",
      );
      void navigate({ to: "/my-orders" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  const itemsSubtotal = items.reduce((sum, it) => {
    const d = drafts[it.templateId];
    const isCustom = Boolean(it.isCustom);
    return sum + pricePerPages((d?.pagesCount ?? 10) as 10 | 16, isCustom);
  }, 0);
  const packageTier = packageTierFor(items.length);
  const packageDiscount = Math.round((itemsSubtotal * packageTier.discountPct) / 100);
  const grandTotal = itemsSubtotal - packageDiscount;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold">إتمام الطلب</h1>
        <p className="mt-2 text-muted-foreground">
          أكمل بيانات كل قصة + ادفع على فودافون كاش ثم ارفع صورة الإيصال
        </p>

        {/* per-item child info */}
        <section className="mt-8 space-y-5">
          {items.map((item, idx) => {
            const d = drafts[item.templateId];
            return (
              <div
                key={item.templateId}
                className="rounded-3xl border-2 border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt=""
                      loading="lazy"
                      className="h-14 w-12 rounded-lg object-cover"
                    />
                  ) : null}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">القصة {idx + 1}</p>
                    <h2 className="font-display text-lg font-bold">{item.title}</h2>
                  </div>
                </div>

                <div className="mt-4">
                  <ChildPicker
                    selectedId={d.childId}
                    onSelect={(child: ChildPickerProfile | null) => {
                      if (!child) {
                        updateDraft(item.templateId, { childId: null });
                        return;
                      }
                      const traitParts = [
                        child.personality_traits?.length
                          ? `صفاته: ${child.personality_traits.join("، ")}`
                          : null,
                        child.hobbies?.length ? `هواياته: ${child.hobbies.join("، ")}` : null,
                        child.favorite_character
                          ? `شخصيته المفضلة: ${child.favorite_character}`
                          : null,
                        child.favorite_color ? `لونه المفضل: ${child.favorite_color}` : null,
                        child.dream_job ? `يحلم بأن يصبح: ${child.dream_job}` : null,
                        child.super_power ? `قوته الخارقة: ${child.super_power}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      updateDraft(item.templateId, {
                        childId: child.id,
                        childName: child.name,
                        childAge: child.age != null ? String(child.age) : "",
                        gender: child.gender === "girl" ? "girl" : "boy",
                        notes: traitParts || drafts[item.templateId].notes,
                      });
                    }}
                  />
                </div>

                <div className="mt-4">
                  <Label className="font-bold">صورة الطفل</Label>
                  <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/30 p-5 transition-colors hover:bg-secondary/60">
                    {d.preview ? (
                      <img
                        src={d.preview}
                        alt=""
                        className="h-36 w-36 rounded-2xl object-cover shadow-md"
                      />
                    ) : (
                      <>
                        <Camera className="h-8 w-8 text-primary" />
                        <span className="mt-2 text-sm font-semibold text-muted-foreground">
                          اختر صورة واضحة لوجه الطفل
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPhotoChange(item.templateId, e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="font-bold">اسم الطفل</Label>
                    <Input
                      value={d.childName}
                      onChange={(e) => updateDraft(item.templateId, { childName: e.target.value })}
                      placeholder="مثال: يوسف"
                      maxLength={40}
                      className="mt-2 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="font-bold">العمر (اختياري)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={14}
                      value={d.childAge}
                      onChange={(e) => updateDraft(item.templateId, { childAge: e.target.value })}
                      className="mt-2 rounded-xl"
                    />
                  </div>
                </div>

                {(d.language === "en" || d.language === "bilingual") && (
                  <div className="mt-4">
                    <Label className="font-bold">
                      Child's name in English {d.language === "bilingual" ? "(اختياري)" : ""}
                    </Label>
                    <Input
                      dir="ltr"
                      value={d.childNameEn}
                      onChange={(e) =>
                        updateDraft(item.templateId, { childNameEn: e.target.value })
                      }
                      placeholder="e.g. Youssef"
                      maxLength={40}
                      className="mt-2 rounded-xl"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      سيُستخدم هذا الاسم في النص الإنجليزي داخل القصة بدلاً من الاسم العربي.
                    </p>
                  </div>
                )}

                <div className="mt-4">
                  <Label className="font-bold">جنس البطل</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {GENDER_OPTIONS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => updateDraft(item.templateId, { gender: g.value })}
                        className={`rounded-xl border-2 p-3 text-start transition-colors ${
                          d.gender === g.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="flex items-center gap-2 font-bold">
                          <span className="text-xl">{g.emoji}</span>
                          {g.label}
                        </span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{g.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <Label className="font-bold">ملاحظات (اختياري)</Label>
                  <Textarea
                    value={d.notes}
                    onChange={(e) => updateDraft(item.templateId, { notes: e.target.value })}
                    maxLength={500}
                    rows={2}
                    className="mt-2 rounded-xl"
                    placeholder="أي تفاصيل تحب إضافتها…"
                  />
                </div>

                <div className="mt-4">
                  <Label className="font-bold">لغة القصة</Label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          updateDraft(item.templateId, {
                            language: opt.value as LanguageMode,
                          })
                        }
                        className={`rounded-xl border-2 p-3 text-start transition-colors ${
                          d.language === opt.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="block text-sm font-bold">{opt.label}</span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <Label className="font-bold">نمط صورة الطفل في القصة</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      {
                        v: "cartoon" as const,
                        emoji: "🎨",
                        label: "كرتوني",
                        hint: "يتحول الطفل لشخصية كرتونية لطيفة",
                      },
                      {
                        v: "real" as const,
                        emoji: "📸",
                        label: "وجه حقيقي",
                        hint: "وجه الطفل الحقيقي داخل مشهد 3D سينمائي",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => updateDraft(item.templateId, { photoMode: opt.v })}
                        className={`rounded-xl border-2 p-3 text-start transition-colors ${
                          d.photoMode === opt.v
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="flex items-center gap-2 font-bold">
                          <span className="text-xl">{opt.emoji}</span>
                          {opt.label}
                        </span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <AspectRatioPicker
                    value={d.aspectRatio}
                    onChange={(v) => updateDraft(item.templateId, { aspectRatio: v })}
                  />
                </div>

                {/* إهداء القصة — اسم الأب/الأم/مقدم الطلب */}
                <div className="mt-4 rounded-2xl border-2 border-pink-200 bg-pink-50/40 p-4">
                  <Label className="flex items-center gap-2 font-bold">
                    💝 إهداء القصة (اختياري)
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    اكتب اسم مهدي القصة (الأم/الأب/الجد…) — سيظهر في غلاف القصة وفي صفحة الإهداء
                    داخل النص.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor={`gifter-name-${item.templateId}`} className="text-sm">
                        اسم المُهدي
                      </Label>
                      <Input
                        id={`gifter-name-${item.templateId}`}
                        value={d.gifterName}
                        onChange={(e) =>
                          updateDraft(item.templateId, { gifterName: e.target.value })
                        }
                        placeholder="مثال: أحمد"
                        maxLength={60}
                        className="mt-1 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`gifter-rel-${item.templateId}`} className="text-sm">
                        العلاقة
                      </Label>
                      <select
                        id={`gifter-rel-${item.templateId}`}
                        value={d.gifterRelation}
                        onChange={(e) =>
                          updateDraft(item.templateId, { gifterRelation: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border-2 border-border bg-background p-2 text-sm"
                      >
                        <option value="">— اختر —</option>
                        {RELATION_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 p-3 transition-colors hover:bg-accent/10">
                  <Checkbox
                    checked={d.publishConsent}
                    onCheckedChange={(c) =>
                      updateDraft(item.templateId, { publishConsent: Boolean(c) })
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-relaxed">
                    <span className="block font-bold">
                      🌟 أوافق على نشر قصة طفلي ضمن «أعمالنا السابقة»
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ستظهر فقط أسفل صفحة هذه القصة الأصلية بعد اعتماد الإدارة — ولن تتكرر في معرض
                      القصص الرئيسي.
                    </span>
                  </span>
                </label>

                <div className="mt-4">
                  <Label className="font-bold">عدد صفحات القصة</Label>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.isCustom
                      ? "🪄 قصة مخصصة بأفكارك — التسعير: 10 صفحات 200 ج، 16 صفحة 250 ج"
                      : "📚 قصة من المكتبة — التسعير: 10 صفحات 150 ج، 16 صفحة 200 ج"}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {pagesOptionsFor(Boolean(item.isCustom)).map((opt) => (
                      <button
                        key={opt.pages}
                        type="button"
                        onClick={() =>
                          updateDraft(item.templateId, {
                            pagesCount: opt.pages as 10 | 16,
                          })
                        }
                        className={`rounded-xl border-2 p-3 text-start transition-colors ${
                          d.pagesCount === opt.pages
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="block font-bold">{opt.pages} صفحة</span>
                        <p className="mt-0.5 text-xs font-extrabold text-primary">
                          {opt.price} جنيه
                        </p>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    📄 ستصلك القصة كملف PDF عبر واتساب
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {/* whatsapp */}
        <section className="mt-6 rounded-3xl border-2 border-border bg-card p-5 shadow-sm">
          <Label className="font-bold">رقم الواتساب لاستلام القصة</Label>
          <Input
            dir="ltr"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="01012345678"
            maxLength={15}
            className="mt-2 rounded-xl text-left"
          />
        </section>

        {/* print — coming soon */}
        <section className="mt-6">
          <ComingSoonPrintCard />
        </section>

        {/* payment method selector */}
        <section className="mt-6 rounded-3xl border-2 border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-xl font-extrabold">طريقة الدفع</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            ادفع عبر فودافون كاش — الدفع بالبطاقة قريباً.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setComingSoonOpen(true)}
              className="relative rounded-2xl border-2 border-border p-4 text-start opacity-80 transition-colors hover:border-primary/50"
            >
              <span className="absolute end-3 top-3 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                🚀 قريباً
              </span>
              <span className="block font-bold">💳 بطاقة بنكية (Visa / Mastercard)</span>
              <p className="mt-1 text-xs text-muted-foreground">
                دفع فوري وآمن بالبطاقة — قيد التفعيل.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  VISA
                </span>
                <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  Mastercard
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("vodafone_cash")}
              className="rounded-2xl border-2 border-primary bg-primary/10 p-4 text-start"
            >
              <span className="block font-bold">📲 فودافون كاش (تحويل يدوي)</span>
              <p className="mt-1 text-xs text-muted-foreground">
                حوّل المبلغ ثم ارفع صورة الإيصال — تأكيد خلال ساعات.
              </p>
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border-2 border-border bg-card p-5 shadow-sm">
          {packageTier.discountPct > 0 && (
            <p className="mb-3 rounded-2xl bg-grass/10 px-3 py-2 text-xs font-bold text-grass">
              🎁 باقة {packageTier.label} مُفعّلة — خصم {packageTier.discountPct}% على{" "}
              {items.length} قصص
            </p>
          )}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground shrink-0">كود الخصم</span>
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="WELCOME20"
                className="h-9 rounded-full text-center font-bold tracking-wider"
              />
            </label>
            <div className="my-2 h-px bg-border" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">قصص ({items.length})</span>
              <span className="font-bold">{itemsSubtotal} ج</span>
            </div>
            {packageDiscount > 0 && (
              <div className="flex items-center justify-between text-sm text-grass">
                <span>خصم الباقة</span>
                <span className="font-bold">−{packageDiscount} ج</span>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              يُطبَّق كود الخصم عند تأكيد الطلب — القيمة النهائية تظهر في رسالة التأكيد
            </p>
            <div className="my-2 h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="font-bold">الإجمالي التقديري</span>
              <span className="font-display text-3xl font-extrabold text-primary">
                {grandTotal} ج
              </span>
            </div>
          </div>
        </section>

        <ComingSoonPaymentDialog
          open={comingSoonOpen}
          onOpenChange={setComingSoonOpen}
          onChooseVodafone={() => setPaymentMethod("vodafone_cash")}
        />

        {paymentMethod === "vodafone_cash" && (
          <section className="mt-4 rounded-3xl border-2 border-grass/40 bg-grass/5 p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-grass-foreground">
              <Smartphone className="h-5 w-5 text-grass" />
              الدفع عبر فودافون كاش
            </h2>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4">
              <div>
                <p className="text-xs text-muted-foreground">حوّل المبلغ على الرقم</p>
                <p dir="ltr" className="font-display text-2xl font-extrabold">
                  {VODAFONE_NUMBER}
                </p>
              </div>
              <Button onClick={copyNumber} variant="outline" className="rounded-full font-bold">
                <Copy className="ms-1 h-4 w-4" /> نسخ الرقم
              </Button>
            </div>

            <div className="mt-5">
              <Label className="flex items-center gap-2 font-bold">
                <Receipt className="h-4 w-4" /> صورة الإيصال
              </Label>
              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-grass/50 bg-card p-5 transition-colors hover:bg-grass/10">
                {receiptPreview ? (
                  <>
                    <img
                      src={receiptPreview}
                      alt="إيصال"
                      className="h-44 rounded-xl object-contain shadow"
                    />
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-grass">
                      <Check className="h-3.5 w-3.5" /> تم اختيار الإيصال
                    </span>
                  </>
                ) : (
                  <>
                    <Receipt className="h-8 w-8 text-grass" />
                    <span className="mt-2 text-sm font-semibold text-muted-foreground">
                      ارفع لقطة شاشة من رسالة فودافون كاش
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onReceiptChange(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                🔒 لن يطلع على الإيصال أحد سوى إدارة الموقع للتحقق من السداد
              </p>
            </div>
          </section>
        )}

        <Button
          size="lg"
          disabled={submitting}
          onClick={() => void submit()}
          className="mt-8 w-full rounded-full text-base font-bold shadow-lg"
        >
          <>
            {submitting ? (
              <>
                <Loader2 className="ms-2 h-5 w-5 animate-spin" />
                جارٍ إرسال الطلب…
              </>
            ) : (
              <>
                <Send className="ms-2 h-5 w-5" />
                تأكيد الطلب وإرسال للمراجعة
              </>
            )}
          </>
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          سنراجع الإيصال خلال ساعات قليلة ونرسل القصة كملف PDF على واتساب الرقم{" "}
          {ADMIN_WHATSAPP.replace(/^20/, "0")}
        </p>
        <WaitingListStatus className="mt-4" />
        <TrustBadges className="mt-6" />
      </main>
      <Footer />
    </div>
  );
}
