import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GENDER_OPTIONS,
  LANGUAGE_OPTIONS,
  type Gender,
  type LanguageMode,
} from "@/features/ai/storyTypes";
import type { AspectRatio } from "@/features/ai/storyStyle";
import { ChildPicker, type ChildPickerProfile } from "@/features/children/ChildPicker";
import { AspectRatioPicker } from "@/features/orders/AspectRatioPicker";
import { submitVideoOrder } from "@/features/video/video-order.functions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImage } from "@/lib/imageOptimize";
import { cn } from "@/lib/utils";

const MAX_PHOTO_MB = 8;

export function VideoOrderForm({
  templateId,
  templateTitle,
}: {
  templateId: string;
  templateTitle: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitVideoOrder);
  const [selectedChild, setSelectedChild] = useState<ChildPickerProfile | null>(null);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [gender, setGender] = useState<Gender>("boy");
  const [language, setLanguage] = useState<LanguageMode>("ar");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const chooseChild = (child: ChildPickerProfile | null) => {
    setSelectedChild(child);
    if (!child) return;
    setChildName(child.name);
    setChildAge(child.age == null ? "" : String(child.age));
    if (child.gender === "boy" || child.gender === "girl") setGender(child.gender);
  };

  const choosePhoto = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختر صورة صالحة");
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      return toast.error(`حجم الصورة يجب ألا يتجاوز ${MAX_PHOTO_MB} ميجابايت`);
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("سجّل الدخول أولاً");
      if (!photo) throw new Error("ارفع صورة واضحة للطفل");
      const { file: optimized } = await optimizeImage(photo, { maxWidth: 1600, quality: 0.85 });
      const ext = optimized.name.split(".").pop()?.toLowerCase() || "jpg";
      const childPhotoPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("child-photos")
        .upload(childPhotoPath, optimized, { contentType: optimized.type });
      if (uploadError) throw new Error("تعذر رفع صورة الطفل");

      return submitFn({
        data: {
          templateId,
          childId: selectedChild?.id ?? null,
          childName: childName.trim(),
          childAge: childAge ? Number(childAge) : null,
          childGender: gender,
          childPhotoPath,
          language,
          aspectRatio,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم إنشاء طلب الفيديو — في انتظار تأكيد الدفع");
      void navigate({ to: "/my-videos" });
    },
    onError: (error: Error) => toast.error(error.message || "تعذر إرسال الطلب"),
  });

  return (
    <div className="space-y-6 rounded-3xl border-2 border-border bg-card p-6 shadow-sm md:p-8">
      <ChildPicker
        selectedId={selectedChild?.id ?? null}
        onSelect={chooseChild}
        title="اختر الطفل للفيديو"
        selectedMessage="✨ سنستخدم بيانات هذا الطفل في الطلب"
      />

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <Label htmlFor="video-child-name" className="font-bold">
            اسم الطفل
          </Label>
          <Input
            id="video-child-name"
            value={childName}
            onChange={(event) => setChildName(event.target.value)}
            maxLength={40}
            className="mt-2 rounded-xl"
            required
          />
        </div>
        <div>
          <Label htmlFor="video-child-age" className="font-bold">
            العمر (اختياري)
          </Label>
          <Input
            id="video-child-age"
            type="number"
            min={1}
            max={14}
            value={childAge}
            onChange={(event) => setChildAge(event.target.value)}
            className="mt-2 rounded-xl"
          />
        </div>
      </div>

      <div>
        <Label className="font-bold">النوع</Label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {GENDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setGender(option.value)}
              className={cn(
                "rounded-2xl border-2 p-3 font-bold",
                gender === option.value ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              {option.emoji} {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="font-bold">صورة الطفل الأصلية</Label>
        <label className="mt-2 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/30 p-6">
          {preview ? (
            <img
              src={preview}
              alt="معاينة صورة الطفل"
              className="h-40 w-40 rounded-2xl object-cover"
            />
          ) : (
            <>
              <Camera className="h-10 w-10 text-primary" />
              <span className="mt-2 text-sm font-semibold text-muted-foreground">
                اختر صورة واضحة لوجه الطفل
              </span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div>
        <Label className="font-bold">لغة الفيديو</Label>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setLanguage(option.value)}
              className={cn(
                "rounded-2xl border-2 p-3 text-start",
                language === option.value ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              <span className="font-bold">{option.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <AspectRatioPicker
        value={aspectRatio}
        onChange={setAspectRatio}
        label="أبعاد الفيديو"
        description="اختر الشكل المناسب لمشاهدة الفيديو؛ يمكن للإدارة مراجعته قبل بدء الإنتاج."
      />

      <div className="rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">
        طلبك لفيديو «{templateTitle}» سيتوقف عند حالة انتظار الدفع. لن يبدأ أي إنتاج أو توليد في هذه
        المرحلة.
      </div>
      <Button
        size="lg"
        className="w-full rounded-full font-bold"
        disabled={submit.isPending || !childName.trim() || !photo}
        onClick={() => submit.mutate()}
      >
        {submit.isPending ? (
          <Loader2 className="ms-2 h-5 w-5 animate-spin" />
        ) : (
          <Send className="ms-2 h-5 w-5" />
        )}
        إرسال طلب الفيديو
      </Button>
    </div>
  );
}
