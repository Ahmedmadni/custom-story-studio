import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pricePerPages } from "@/features/cart/pricing";
import { orientationFromAspectRatio } from "@/features/ai/storyStyle";

const CustomRequestInput = z.object({
  childName: z.string().trim().min(1).max(40),
  childNameEn: z.string().trim().max(40).nullable().optional(),
  childAge: z.number().int().min(1).max(14),
  gender: z.enum(["boy", "girl"]),
  language: z.enum(["ar", "en", "bilingual"]),
  contentType: z.enum(["story", "book"]).default("story"),
  pagesCount: z.union([z.literal(10), z.literal(16)]),
  topic: z.string().trim().min(10).max(800),
  bookCategory: z.string().trim().max(60).nullable().optional(),
  whatsapp: z.string().trim().min(8).max(20),
  photoMode: z.enum(["cartoon", "real"]).default("real"),
  aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("16:9"),
  childPhotoPath: z.string().min(1).nullable().optional(),
  gifterName: z.string().trim().max(60).nullable().optional(),
  gifterRelation: z.string().trim().max(40).nullable().optional(),
  receiptPath: z.string().min(1),
  publishConsent: z.boolean().default(false),
  notes: z.string().trim().max(500).nullable().optional(),
});

/**
 * ينشئ طلب قصة مخصصة بأفكار العميل بدون توليد ذكاء اصطناعي.
 * يُحفظ النص الذي كتبه العميل في custom_brief، ويُعلَّم الطلب is_custom_request=true،
 * ويبقى template_id فارغاً حتى يُولّد الأدمن القصة لاحقاً عبر /create.
 */
export const submitCustomStoryRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CustomRequestInput.parse(input))
  .handler(async ({ data, context }) => {
    const price = pricePerPages(data.pagesCount, true);

    const brief = [
      `النوع: ${data.contentType === "book" ? "كتاب تعليمي" : "قصة مصورة"}`,
      data.bookCategory ? `الفئة التعليمية: ${data.bookCategory}` : null,
      `فكرة العميل:\n${data.topic.trim()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.receiptPath.startsWith(`${context.userId}/`)) {
      throw new Error("إيصال التحويل غير صالح لهذا الحساب");
    }
    if (data.childPhotoPath && !data.childPhotoPath.startsWith(`${context.userId}/`)) {
      throw new Error("صورة الطفل غير صالحة لهذا الحساب");
    }

    const receiptName = data.receiptPath.slice(context.userId.length + 1);
    const { data: receiptFiles, error: receiptListError } = await supabaseAdmin.storage
      .from("payment-receipts")
      .list(context.userId, { limit: 20, search: receiptName });
    if (
      receiptListError ||
      !(receiptFiles ?? []).some((file) => file.name === receiptName)
    ) {
      throw new Error("إيصال التحويل غير موجود أو لا يخص هذا الحساب");
    }

    if (data.childPhotoPath) {
      const photoName = data.childPhotoPath.slice(context.userId.length + 1);
      const { data: photoFiles, error: photoListError } = await supabaseAdmin.storage
        .from("child-photos")
        .list(context.userId, { limit: 20, search: photoName });
      if (
        photoListError ||
        !(photoFiles ?? []).some((file) => file.name === photoName)
      ) {
        throw new Error("صورة الطفل غير موجودة أو لا تخص هذا الحساب");
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: context.userId,
        template_id: null,
        is_custom_request: true,
        custom_brief: brief,
        child_name: data.childName,
        child_name_en: data.childNameEn?.trim() || null,
        child_age: data.childAge,
        gender: data.gender,
        language: data.language,
        whatsapp: data.whatsapp,
        child_photo_path: data.childPhotoPath ?? null,
        photo_mode: data.photoMode,
        aspect_ratio: data.aspectRatio,
        orientation: orientationFromAspectRatio(data.aspectRatio),
        pages_count: data.pagesCount,
        price_egp: price,
        receipt_path: data.receiptPath,
        payment_status: "receipt_uploaded",
        paid_at: new Date().toISOString(),
        publish_consent: data.publishConsent,
        gifted_by_name: data.gifterName?.trim() || null,
        gifted_by_relation: data.gifterRelation?.trim() || null,
        notes: data.notes?.trim() || null,
      } as never)
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("submitCustomStoryRequest insert error", error);
      throw new Error("تعذر إرسال الطلب، حاول مرة أخرى");
    }
    return { ok: true, orderId: inserted.id as string };
  });
