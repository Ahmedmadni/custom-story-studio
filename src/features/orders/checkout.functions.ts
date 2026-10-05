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
  childAge: z.preprocess(
    (v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1) return null;
      return Math.min(14, Math.trunc(n));
    },
    z.number().int().min(1).max(14).nullable(),
  ).optional(),
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

type RpcErrorLike = { code?: string | null; message?: string | null };

type UntypedRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcErrorLike | null }>;
};

function missingAtomicCouponRpc(error: RpcErrorLike | null) {
  return Boolean(
    error &&
      (error.code === "PGRST202" ||
        (error.message ?? "").includes("consume_coupon_redemption")),
  );
}

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

    // نجلب is_custom + التصنيف لكل قالب لتحديد التسعير وشرط تصنيف الكوبون.
    // نستخدم جلسة المستخدم هنا عمداً: أي قالب لا يستطيع المستخدم رؤيته لا يجوز
    // تمريره يدوياً إلى checkout ثم إنشاؤه لاحقاً عبر service_role.
    const templateIds = Array.from(new Set(data.items.map((i) => i.templateId)));
    const { data: tplRows, error: templateError } = await context.supabase
      .from("story_templates")
      .select("id, is_custom, category")
      .in("id", templateIds);
    if (templateError || (tplRows ?? []).length !== templateIds.length) {
      throw new Error("إحدى القصص غير متاحة للطلب");
    }
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

    if (!data.receiptPath.startsWith(`${context.userId}/`)) {
      throw new Error("إيصال التحويل غير صالح لهذا الحساب");
    }

    for (const item of data.items) {
      if (!item.childPhotoPath.startsWith(`${context.userId}/`)) {
        throw new Error("إحدى صور الأطفال لا تخص هذا الحساب");
      }
    }

    const childIds = Array.from(
      new Set(data.items.flatMap((item) => (item.childId ? [item.childId] : []))),
    );
    if (childIds.length) {
      const { data: ownedChildren, error: childrenError } = await supabaseAdmin
        .from("child_profiles")
        .select("id")
        .eq("user_id", context.userId)
        .in("id", childIds);
      if (childrenError || (ownedChildren ?? []).length !== childIds.length) {
        throw new Error("أحد ملفات الأطفال غير موجود أو لا يخص هذا الحساب");
      }
    }

    const receiptName = data.receiptPath.slice(context.userId.length + 1);
    const photoNames = data.items.map((item) =>
      item.childPhotoPath.slice(context.userId.length + 1),
    );
    const [{ data: receiptFiles, error: receiptListError }, ...photoResults] = await Promise.all([
      supabaseAdmin.storage
        .from("payment-receipts")
        .list(context.userId, { limit: 20, search: receiptName }),
      ...photoNames.map((photoName) =>
        supabaseAdmin.storage
          .from("child-photos")
          .list(context.userId, { limit: 20, search: photoName }),
      ),
    ]);

    if (
      receiptListError ||
      !(receiptFiles ?? []).some((file) => file.name === receiptName)
    ) {
      throw new Error("إيصال التحويل غير موجود أو لا يخص هذا الحساب");
    }

    photoResults.forEach((result, index) => {
      const photoName = photoNames[index];
      if (
        result.error ||
        !(result.data ?? []).some((file) => file.name === photoName)
      ) {
        throw new Error("إحدى صور الأطفال غير موجودة أو لا تخص هذا الحساب");
      }
    });

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
      if (coupon.discount_type === "percent") {
        const pct = Number(coupon.discount_value);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          throw new Error("إعداد نسبة الخصم غير صالح");
        }
      } else {
        const fixed = Number(coupon.discount_value);
        if (!Number.isFinite(fixed) || fixed <= 0) {
          throw new Error("إعداد قيمة الخصم غير صالح");
        }
      }

      if (coupon.category) {
        const categories = data.items.map(
          (it) => tplById.get(it.templateId)?.category ?? null,
        );
        if (
          categories.some(
            (category) => category === null || category !== coupon.category,
          )
        ) {
          throw new Error("هذا الكود صالح فقط عندما تكون كل قصص السلة من التصنيف المحدد");
        }
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

    // Order creation is a trusted server operation. Browser roles do not get INSERT on orders.
    const { data: inserted, error } = await supabaseAdmin.from("orders").insert(rows).select("id");
    if (error) throw new Error("تعذر إرسال الطلب، حاول مرة أخرى");

    if (couponId && couponDiscount > 0) {
      const firstOrderId = inserted?.[0]?.id;
      if (!firstOrderId) {
        throw new Error("تعذر تسجيل استخدام كود الخصم");
      }

      const rpcClient = supabaseAdmin as unknown as UntypedRpcClient;
      const redemption = await rpcClient.rpc("consume_coupon_redemption", {
        _coupon_id: couponId,
        _user_id: context.userId,
        _order_id: firstOrderId,
        _discount_egp: couponDiscount,
      });

      if (redemption.error && missingAtomicCouponRpc(redemption.error)) {
        // Compatibility only until the production migration is applied.
        const { error: redemptionError } = await supabaseAdmin.from("coupon_redemptions").insert({
          coupon_id: couponId,
          user_id: context.userId,
          order_id: firstOrderId,
          discount_egp: couponDiscount,
        });
        if (redemptionError) {
          await supabaseAdmin
            .from("orders")
            .delete()
            .in(
              "id",
              (inserted ?? []).map((row) => row.id),
            );
          throw new Error("تعذر تطبيق كود الخصم، حاول مرة أخرى");
        }

        const { data: current } = await supabaseAdmin
          .from("coupons")
          .select("used_count")
          .eq("id", couponId)
          .single();
        const { error: counterError } = await supabaseAdmin
          .from("coupons")
          .update({ used_count: (current?.used_count ?? 0) + 1 })
          .eq("id", couponId);
        if (counterError) {
          console.error("legacy coupon counter update failed", counterError);
        }
      } else if (redemption.error) {
        await supabaseAdmin
          .from("orders")
          .delete()
          .in(
            "id",
            (inserted ?? []).map((row) => row.id),
          );
        throw new Error("تعذر تطبيق كود الخصم أو تم استنفاد الحد المسموح");
      }
    }

    return {
      ok: true,
      orderIds: (inserted ?? []).map((r) => r.id),
      packageDiscountEgp: packageDiscount,
      couponDiscountEgp: couponDiscount,
    };
  });
