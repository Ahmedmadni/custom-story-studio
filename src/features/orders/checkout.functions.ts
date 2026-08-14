import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { packageTierFor, pricePerPages, PRINT_COPY_PRICE_EGP } from "@/features/cart/pricing";
import { orientationFromAspectRatio } from "@/features/ai/storyStyle";

const ItemInput = z.object({
  templateId: z.string().uuid(),
  childId: z.string().uuid().nullable().optional(),
  childName: z.string().trim().min(1).max(40),
  childNameEn: z.string().trim().max(40).nullable().optional(),
  childAge: z.number().int().min(1).max(14).nullable().optional(),
  gender: z.enum(["boy", "girl"]).default("boy"),
  childPhotoPath: z.string().min(1),
  notes: z.string().max(500).nullable().optional(),
  language: z.enum(["ar", "en", "bilingual"]).default("ar"),
  photoMode: z.enum(["cartoon", "real"]).default("cartoon"),
  aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("16:9"),
  publishConsent: z.boolean().default(false),
  pagesCount: z.union([z.literal(10), z.literal(16)]).default(10),
  gifterName: z.string().trim().max(60).nullable().optional(),
  gifterRelation: z.string().trim().max(40).nullable().optional(),
});

const CheckoutInput = z.object({
  whatsapp: z.string().trim().min(8).max(20),
  receiptPath: z.string().min(1),
  items: z.array(ItemInput).min(1).max(10),
  printCopy: z.boolean().default(false),
  deliveryAddress: z.string().trim().max(500).nullable().optional(),
  couponCode: z.string().trim().max(30).nullable().optional(),
});

/**
 * ينشئ صفّ طلب لكل عنصر في السلة بنفس إيصال الدفع.
 * payment_status = receipt_uploaded حتى يؤكدها المدير.
 * السعر يُحسب حسب نوع القالب (مكتبة أم مخصص)، بعد تطبيق خصم باقة القصص
 * (F7 — حسب عدد العناصر) ثم خصم الكوبون (F6) إن وُجد، موزَّعَين على
 * الصفوف بنسبة سعر كل عنصر من الإجمالي.
 */
export const submitCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.printCopy && !data.deliveryAddress?.trim()) {
      throw new Error("اكتب عنوان التوصيل لطلب نسخة مطبوعة");
    }

    // نجلب is_custom + التصنيف لكل قالب لتحديد التسعير وشرط تصنيف الكوبون
    const templateIds = Array.from(new Set(data.items.map((i) => i.templateId)));
    const { data: tplRows } = await context.supabase
      .from("story_templates")
      .select("id, is_custom, category")
      .in("id", templateIds);
    const tplById = new Map<string, { isCustom: boolean; category: string | null }>(
      (tplRows ?? []).map((r) => [
        r.id as string,
        {
          isCustom: Boolean((r as { is_custom?: boolean }).is_custom),
          category: (r as { category?: string | null }).category ?? null,
        },
      ]),
    );

    const baseAmounts = data.items.map((it) =>
      pricePerPages(it.pagesCount, tplById.get(it.templateId)?.isCustom ?? false),
    );
    const subtotal = baseAmounts.reduce((sum, n) => sum + n, 0);

    const packageTier = packageTierFor(data.items.length);
    const packageDiscount = Math.round((subtotal * packageTier.discountPct) / 100);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let couponDiscount = 0;
    let couponId: string | null = null;
    let normalizedCode: string | null = null;
    if (data.couponCode?.trim()) {
      normalizedCode = data.couponCode.trim().toUpperCase();
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("*")
        .eq("code", normalizedCode)
        .maybeSingle();
      if (!coupon || !coupon.is_active) throw new Error("كود الخصم غير صالح");
      const now = new Date();
      if (coupon.starts_at && now < new Date(coupon.starts_at))
        throw new Error("كود الخصم لم يبدأ بعد");
      if (coupon.expires_at && now > new Date(coupon.expires_at))
        throw new Error("انتهت صلاحية كود الخصم");
      if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses)
        throw new Error("تم استنفاد عدد مرات استخدام هذا الكود");

      const remainingAfterPackage = subtotal - packageDiscount;
      if (coupon.min_order_egp != null && remainingAfterPackage < coupon.min_order_egp)
        throw new Error(`الحد الأدنى لهذا الكود ${coupon.min_order_egp} ج`);
      if (coupon.category) {
        const categories = data.items
          .map((it) => tplById.get(it.templateId)?.category)
          .filter(Boolean);
        if (!categories.includes(coupon.category))
          throw new Error("هذا الكود غير صالح لهذا التصنيف من القصص");
      }

      const { count: userUses } = await supabaseAdmin
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id)
        .eq("user_id", context.userId);
      if ((userUses ?? 0) >= coupon.max_uses_per_user) {
        throw new Error("لقد استخدمت هذا الكود من قبل");
      }

      couponDiscount =
        coupon.discount_type === "percent"
          ? Math.round((remainingAfterPackage * coupon.discount_value) / 100)
          : Math.min(remainingAfterPackage, Math.round(coupon.discount_value));
      couponId = coupon.id;
    }

    const totalDiscount = packageDiscount + couponDiscount;

    // نوزّع الخصم على الصفوف بنسبة سعر كل عنصر، ونضيف رسوم الطباعة للعنصر الأول فقط
    let distributed = 0;
    const rows = data.items.map((it, idx) => {
      const base = baseAmounts[idx];
      const isLast = idx === data.items.length - 1;
      const share = isLast
        ? totalDiscount - distributed
        : subtotal > 0
          ? Math.round((base / subtotal) * totalDiscount)
          : 0;
      distributed += share;
      const printExtra = data.printCopy && idx === 0 ? PRINT_COPY_PRICE_EGP : 0;
      return {
        user_id: context.userId,
        template_id: it.templateId,
        child_id: it.childId ?? null,
        child_name: it.childName,

        child_name_en: it.childNameEn?.trim() || null,
        child_age: it.childAge ?? null,
        gender: it.gender,
        whatsapp: data.whatsapp,
        child_photo_path: it.childPhotoPath,
        notes: it.notes ?? null,
        receipt_path: data.receiptPath,
        payment_status: "receipt_uploaded" as const,
        price_egp: Math.max(0, base - share) + printExtra,
        discount_egp: share,
        coupon_code: normalizedCode,
        paid_at: new Date().toISOString(),
        language: it.language,
        photo_mode: it.photoMode,
        aspect_ratio: it.aspectRatio,
        orientation: orientationFromAspectRatio(it.aspectRatio),
        publish_consent: it.publishConsent,
        pages_count: it.pagesCount,
        print_copy: data.printCopy,
        delivery_address: data.printCopy ? (data.deliveryAddress?.trim() ?? null) : null,
        gifted_by_name: it.gifterName?.trim() || null,
        gifted_by_relation: it.gifterRelation?.trim() || null,
      };
    });

    const { data: inserted, error } = await context.supabase
      .from("orders")
      .insert(rows)
      .select("id");
    if (error) throw new Error("تعذر إرسال الطلب، حاول مرة أخرى");

    if (couponId && couponDiscount > 0) {
      await supabaseAdmin.from("coupon_redemptions").insert({
        coupon_id: couponId,
        user_id: context.userId,
        order_id: inserted?.[0]?.id ?? null,
        discount_egp: couponDiscount,
      });
      const { data: current } = await supabaseAdmin
        .from("coupons")
        .select("used_count")
        .eq("id", couponId)
        .single();
      await supabaseAdmin
        .from("coupons")
        .update({ used_count: (current?.used_count ?? 0) + 1 })
        .eq("id", couponId);
    }

    return {
      ok: true,
      orderIds: (inserted ?? []).map((r) => r.id),
      packageDiscountEgp: packageDiscount,
      couponDiscountEgp: couponDiscount,
    };
  });
