import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Check,
  Copy,
  Loader2,
  Receipt,
  Send,
  ShoppingBag,
  Smartphone,
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
import { PRICE_PER_ITEM_EGP, useCart } from "@/features/cart/CartContext";
import { submitCheckout } from "@/features/orders/checkout.functions";
import {
  GENDER_OPTIONS,
  LANGUAGE_OPTIONS,
  type Gender,
  type LanguageMode,
} from "@/features/ai/storyTypes";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ADMIN_WHATSAPP,
  isValidEgyptianMobile,
} from "@/features/orders/whatsapp";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [{ title: "إتمام الطلب — حكايتي" }],
  }),
  component: CheckoutPage,
});

const MAX_PHOTO_MB = 8;
const VODAFONE_NUMBER = "01120016502";

type PhotoMode = "cartoon" | "real";

type ItemDraft = {
  childName: string;
  childAge: string;
  gender: Gender | "";
  notes: string;
  photo: File | null;
  preview: string | null;
  language: LanguageMode;
  photoMode: PhotoMode;
  publishConsent: boolean;
};

function CheckoutPage() {
  const { user } = useAuth();
  const { items, totalEgp, clear } = useCart();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitCheckout);

  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.templateId,
        {
          childName: "",
          childAge: "",
          gender: "" as const,
          notes: "",
          photo: null,
          preview: null,
          language: "ar" as LanguageMode,
          photoMode: "cartoon" as PhotoMode,
          publishConsent: false,
        },
      ]),
    ),
  );
  const [whatsapp, setWhatsapp] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-16 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-bold">
            سلتك فارغة
          </h1>
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
      if (!d?.childName.trim())
        return toast.error(`اكتب اسم الطفل لـ «${item.title}»`);
      if (!d?.gender)
        return toast.error(`اختر جنس البطل لـ «${item.title}»`);
      if (!d?.photo)
        return toast.error(`ارفع صورة الطفل لـ «${item.title}»`);
    }

    setSubmitting(true);
    try {
      // 1) upload receipt
      const rExt = receipt.name.split(".").pop()?.toLowerCase() || "jpg";
      const receiptPath = `${user.id}/${crypto.randomUUID()}.${rExt}`;
      const { error: rErr } = await supabase.storage
        .from("payment-receipts")
        .upload(receiptPath, receipt, { contentType: receipt.type });
      if (rErr) throw new Error("تعذر رفع الإيصال");

      // 2) upload each child photo
      const uploadedItems = await Promise.all(
        items.map(async (item) => {
          const d = drafts[item.templateId];
          const ext = d.photo!.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage
            .from("child-photos")
            .upload(path, d.photo!, { contentType: d.photo!.type });
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

      // 3) create orders
      await submitFn({
        data: {
          whatsapp: whatsapp.trim(),
          receiptPath,
          items: uploadedItems,
        },
      });

      clear();
      toast.success("تم استلام طلبك! سنراجع الإيصال ونرسل القصة على واتساب 🎉");
      void navigate({ to: "/my-orders" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

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
                      className="h-14 w-12 rounded-lg object-cover"
                    />
                  ) : null}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">
                      القصة {idx + 1}
                    </p>
                    <h2 className="font-display text-lg font-bold">{item.title}</h2>
                  </div>
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
                      onChange={(e) =>
                        onPhotoChange(item.templateId, e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="font-bold">اسم الطفل</Label>
                    <Input
                      value={d.childName}
                      onChange={(e) =>
                        updateDraft(item.templateId, { childName: e.target.value })
                      }
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
                      onChange={(e) =>
                        updateDraft(item.templateId, { childAge: e.target.value })
                      }
                      className="mt-2 rounded-xl"
                    />
                  </div>
                </div>

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
                    onChange={(e) =>
                      updateDraft(item.templateId, { notes: e.target.value })
                    }
                    maxLength={500}
                    rows={2}
                    className="mt-2 rounded-xl"
                    placeholder="أي تفاصيل تحب إضافتها…"
                  />
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

        {/* payment */}
        <section className="mt-6 rounded-3xl border-2 border-grass/40 bg-grass/5 p-5 shadow-sm">
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
          <div className="mt-3 rounded-2xl bg-card p-4">
            <p className="text-xs text-muted-foreground">المبلغ المطلوب تحويله</p>
            <p className="font-display text-3xl font-extrabold text-primary">
              {totalEgp} جنيه
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ({items.length} عنصر × {PRICE_PER_ITEM_EGP} ج)
            </p>
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

        <Button
          size="lg"
          disabled={submitting}
          onClick={() => void submit()}
          className="mt-8 w-full rounded-full text-base font-bold shadow-lg"
        >
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
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          سنراجع الإيصال خلال ساعات قليلة ونرسل القصة كملف PDF على واتساب
          الرقم {ADMIN_WHATSAPP.replace(/^20/, "0")}
        </p>
      </main>
      <Footer />
    </div>
  );
}
