import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Loader2, Send } from "lucide-react";
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
import { isValidEgyptianMobile } from "@/features/orders/whatsapp";

export const Route = createFileRoute("/_authenticated/order/$templateId")({
  head: () => ({
    meta: [{ title: "اطلب القصة — حكايتي" }],
  }),
  component: OrderPage,
});

const MAX_PHOTO_MB = 8;

function OrderPage() {
  const { templateId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: template } = useQuery({
    queryKey: ["template", templateId],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, title, summary, cover_url")
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
      const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("child-photos")
        .upload(path, photo, { contentType: photo.type });
      if (uploadErr) throw new Error("تعذر رفع الصورة، حاول مرة أخرى");

      const { error: insertErr } = await supabase.from("orders").insert({
        user_id: user.id,
        template_id: templateId,
        child_name: childName.trim(),
        child_age: childAge ? Number(childAge) : null,
        whatsapp: whatsapp.trim(),
        child_photo_path: path,
        notes: notes.trim() || null,
      });
      if (insertErr) throw new Error("تعذر إرسال الطلب");

      toast.success("تم استلام طلبك! سنراجعه ونتواصل معك قريباً 🎉");
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
      <main className="container mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold">
          اطلب قصة «{template?.title ?? "…"}»
        </h1>
        <p className="mt-2 text-muted-foreground">
          ارفع صورة واضحة لوجه طفلك وسنحوله إلى بطل كرتوني ثلاثي الأبعاد في كل
          صفحات القصة
        </p>

        <div className="mt-8 space-y-5 rounded-3xl border-2 border-border bg-card p-6 shadow-sm md:p-8">
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
