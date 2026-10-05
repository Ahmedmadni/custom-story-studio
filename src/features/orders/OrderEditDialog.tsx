import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { GENDER_OPTIONS, LANGUAGE_OPTIONS } from "@/features/ai/storyTypes";
import { updateMyOrder } from "@/features/admin/admin.functions";
import { isValidEgyptianMobile } from "@/features/orders/whatsapp";
import { optimizeImage } from "@/lib/imageOptimize";

const MAX_PHOTO_MB = 8;
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

export interface EditableOrder {
  id: string;
  child_name: string;
  child_name_en: string | null;
  child_age: number | null;
  gender: string;
  whatsapp: string;
  notes: string | null;
  language: string;
  photo_mode: string;
  pages_count: number;
  print_copy: boolean;
  delivery_address: string | null;
  gifted_by_name: string | null;
  gifted_by_relation: string | null;
  publish_consent: boolean;
  isCustom: boolean;
  title: string;
}

export function OrderEditDialog({
  order,
  open,
  onOpenChange,
}: {
  order: EditableOrder | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const updateFn = useServerFn(updateMyOrder);

  const [childName, setChildName] = useState("");
  const [childNameEn, setChildNameEn] = useState("");
  const [childAge, setChildAge] = useState("");
  const [gender, setGender] = useState<"boy" | "girl">("boy");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");
  const [language, setLanguage] = useState<"ar" | "en" | "bilingual">("ar");
  const [photoMode, setPhotoMode] = useState<"cartoon" | "real">("cartoon");
  const [pagesCount, setPagesCount] = useState<10 | 16>(10);
  const printCopy = Boolean(order?.print_copy);
  const deliveryAddress = order?.delivery_address ?? "";
  const [gifterName, setGifterName] = useState("");
  const [gifterRelation, setGifterRelation] = useState("");
  const [publishConsent, setPublishConsent] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);

  useEffect(() => {
    if (!order) return;
    setChildName(order.child_name ?? "");
    setChildNameEn(order.child_name_en ?? "");
    setChildAge(order.child_age != null ? String(order.child_age) : "");
    setGender((order.gender as "boy" | "girl") ?? "boy");
    setWhatsapp(order.whatsapp ?? "");
    setNotes(order.notes ?? "");
    setLanguage((order.language as "ar" | "en" | "bilingual") ?? "ar");
    setPhotoMode((order.photo_mode as "cartoon" | "real") ?? "cartoon");
    setPagesCount((order.pages_count === 16 ? 16 : 10) as 10 | 16);
    // printCopy/deliveryAddress are postponed — always sent as false/null

    setGifterName(order.gifted_by_name ?? "");
    setGifterRelation(order.gifted_by_relation ?? "");
    setPublishConsent(Boolean(order.publish_consent));
    setPhoto(null);
    setReceipt(null);
  }, [order]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!order || !user) throw new Error("غير مصرح");
      if (!childName.trim()) throw new Error("اكتب اسم الطفل");
      if (!isValidEgyptianMobile(whatsapp))
        throw new Error("اكتب رقم واتساب مصري صحيح");
      if (printCopy && deliveryAddress.trim().length < 10)
        throw new Error("اكتب عنوان التوصيل بالتفصيل");

      let newChildPhotoPath: string | null = null;
      if (photo) {
        if (photo.size > MAX_PHOTO_MB * 1024 * 1024)
          throw new Error(`الصورة أكبر من ${MAX_PHOTO_MB} ميجابايت`);
        const { file: optPhoto } = await optimizeImage(photo, { maxWidth: 1400, quality: 0.85 });
        const ext = optPhoto.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("child-photos")
          .upload(path, optPhoto, { contentType: optPhoto.type });
        if (error) throw new Error("تعذر رفع صورة الطفل");
        newChildPhotoPath = path;
      }
      let newReceiptPath: string | null = null;
      if (receipt) {
        if (receipt.size > MAX_PHOTO_MB * 1024 * 1024)
          throw new Error(`الإيصال أكبر من ${MAX_PHOTO_MB} ميجابايت`);
        const { file: optReceipt } = await optimizeImage(receipt, { maxWidth: 1800, quality: 0.85 });
        const ext = optReceipt.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("payment-receipts")
          .upload(path, optReceipt, { contentType: optReceipt.type });
        if (error) throw new Error("تعذر رفع الإيصال الجديد");
        newReceiptPath = path;
      }

      return updateFn({
        data: {
          orderId: order.id,
          childName: childName.trim(),
          childNameEn: childNameEn.trim() || null,
          childAge: childAge ? Number(childAge) : null,
          gender,
          whatsapp: whatsapp.trim(),
          notes: notes.trim() || null,
          language,
          photoMode,
          pagesCount,
          printCopy,
          deliveryAddress: printCopy ? deliveryAddress.trim() : null,
          gifterName: gifterName.trim() || null,
          gifterRelation: gifterRelation.trim() || null,
          publishConsent,
          newChildPhotoPath,
          newReceiptPath,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم تحديث الطلب بنجاح ✨");
      void qc.invalidateQueries({ queryKey: ["my-orders"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!order) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل الطلب — {order.title}</DialogTitle>
          <DialogDescription>
            {order.isCustom
              ? "🪄 قصة مخصصة — التسعير 10 صفحات 200 ج، 16 صفحة 250 ج"
              : "📚 قصة من المكتبة — التسعير 10 صفحات 150 ج، 16 صفحة 200 ج"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>اسم الطفل</Label>
              <Input value={childName} onChange={(e) => setChildName(e.target.value)} maxLength={40} className="mt-1" />
            </div>
            <div>
              <Label>العمر</Label>
              <Input
                type="number"
                min={1}
                max={14}
                value={childAge}
                onChange={(e) => setChildAge(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {(language === "en" || language === "bilingual") && (
            <div>
              <Label>Child's name in English</Label>
              <Input dir="ltr" value={childNameEn} onChange={(e) => setChildNameEn(e.target.value)} maxLength={40} className="mt-1" />
            </div>
          )}

          <div>
            <Label>جنس البطل</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGender(g.value as "boy" | "girl")}
                  className={`rounded-xl border-2 p-2 text-start ${gender === g.value ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <span className="font-bold">{g.emoji} {g.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>لغة القصة</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLanguage(opt.value as "ar" | "en" | "bilingual")}
                  className={`rounded-xl border-2 p-2 text-start text-sm font-bold ${language === opt.value ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>نمط الصورة</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["cartoon", "real"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPhotoMode(m)}
                  className={`rounded-xl border-2 p-2 text-start text-sm font-bold ${photoMode === m ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {m === "cartoon" ? "🎨 كرتوني" : "📸 وجه حقيقي"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>عدد الصفحات</Label>
            <div className="mt-2 rounded-xl border-2 border-border bg-secondary/30 p-3">
              <span className="font-bold">{pagesCount} صفحة</span>
              <p className="mt-1 text-xs text-muted-foreground">
                الباقة والسعر مقفلان بعد إنشاء الطلب. لتغيير عدد الصفحات احذف الطلب قبل الاعتماد وأنشئه من جديد.
              </p>
            </div>
          </div>

          <div>
            <Label>رقم الواتساب</Label>
            <Input dir="ltr" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={15} className="mt-1 text-left" />
          </div>

          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} className="mt-1" />
          </div>

          <div className="rounded-2xl border-2 border-pink-200 bg-pink-50/40 p-3">
            <Label className="font-bold">💝 إهداء القصة (اختياري)</Label>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <Input value={gifterName} onChange={(e) => setGifterName(e.target.value)} maxLength={60} placeholder="اسم المُهدي" />
              <select
                value={gifterRelation}
                onChange={(e) => setGifterRelation(e.target.value)}
                className="w-full rounded-xl border-2 border-border bg-background p-2 text-sm"
              >
                <option value="">— اختر العلاقة —</option>
                {RELATION_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 p-3">
            <Checkbox checked={publishConsent} onCheckedChange={(c) => setPublishConsent(Boolean(c))} className="mt-0.5" />
            <span className="text-sm">🌟 أوافق على نشر القصة ضمن «أعمالنا السابقة»</span>
          </label>

          <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="font-bold">📚 النسخة المطبوعة قريباً</p>
            <p className="mt-1 text-xs text-muted-foreground">
              ستصلك القصة كملف PDF عبر واتساب. خدمة الطباعة والشحن قيد التفعيل.
            </p>
          </div>


          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>استبدال صورة الطفل (اختياري)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
              {photo && <p className="mt-1 text-xs text-grass">✔ سيتم رفع: {photo.name}</p>}
            </div>
            <div>
              <Label>استبدال صورة إيصال التحويل (اختياري)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
              {receipt && <p className="mt-1 text-xs text-grass">✔ سيتم رفع: {receipt.name}</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            إلغاء
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="rounded-full font-bold"
          >
            {mutation.isPending ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ms-2 h-4 w-4" />
            )}
            حفظ التعديلات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
