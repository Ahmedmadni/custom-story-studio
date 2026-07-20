import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  STORY_STYLE_PROMPT,
  STYLE_NEGATIVE,
  SHARIA_IMAGE_RULE,
  ageStylePrompt,
  bakedTitlePrompt,
} from "@/features/ai/storyStyle";

import { parsePages, personalize, type StoryPage } from "@/features/ai/storyTypes";

type AuthedContext = {
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" | "user" },
    ) => PromiseLike<{ data: boolean | null }>;
  };
  userId: string;
};

async function assertAdmin(context: AuthedContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("غير مصرح لك بالوصول");
}

function summarizeProviderFailure(provider: string, status?: number, body?: string) {
  const text = (body ?? "").toLowerCase();
  const name =
    provider === "lovable"
      ? "Lovable AI"
      : provider === "openai"
        ? "OpenAI"
        : provider === "gemini"
          ? "Gemini"
          : provider === "stability"
            ? "Stability"
            : provider === "replicate"
              ? "Replicate"
              : provider;

  if (status === 402 || text.includes("insufficient credit") || text.includes("payment_required")) {
    return `رصيد ${name} غير كافٍ`;
  }
  if (status === 401 || text.includes("invalid_api_key") || text.includes("incorrect api key")) {
    return `مفتاح ${name} غير صالح`;
  }
  if (status === 429 || text.includes("quota") || text.includes("resource_exhausted")) {
    return `حصة ${name} مستنفدة مؤقتاً`;
  }
  if (status === 404) {
    return `المسار المطلوب غير موجود لدى ${name}`;
  }
  return `تعذر الإكمال عبر ${name}${status ? ` (${status})` : ""}`;
}

async function runReplicateFaceSwap(params: {
  sceneUrl: string;
  photoUrl: string;
  lovableKey: string;
  replicateKey: string;
}) {
  const GW = "https://connector-gateway.lovable.dev/replicate/v1";
  const headers = {
    Authorization: `Bearer ${params.lovableKey}`,
    "X-Connection-Api-Key": params.replicateKey,
    "Content-Type": "application/json",
  };

  const createRes = await fetch(`${GW}/models/cdingram/face-swap/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      input: {
        input_image: params.sceneUrl,
        swap_image: params.photoUrl,
      },
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text().catch(() => "");
    console.warn("Face swap create failed", createRes.status, body);
    return {
      bytes: null,
      reason: `استبدال الوجه: ${summarizeProviderFailure("replicate", createRes.status, body)}`,
    };
  }

  const created = (await createRes.json()) as { id?: string };
  if (!created.id) {
    return { bytes: null, reason: "استبدال الوجه لم يُرجع معرف عملية" };
  }

  let swappedUrl: string | null = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, i < 4 ? 1500 : 3000));
    const pollRes = await fetch(`${GW}/predictions/${created.id}`, { headers });
    if (!pollRes.ok) continue;
    const pj = (await pollRes.json()) as {
      status?: string;
      output?: string | string[];
      error?: unknown;
    };
    if (pj.status === "succeeded") {
      swappedUrl = Array.isArray(pj.output) ? pj.output[0] : (pj.output ?? null);
      break;
    }
    if (pj.status === "failed" || pj.status === "canceled") {
      console.error("Face swap failed", pj.error);
      return { bytes: null, reason: "فشلت عملية استبدال الوجه" };
    }
  }

  if (!swappedUrl) {
    return { bytes: null, reason: "انتهت مهلة استبدال الوجه قبل اكتمال النتيجة" };
  }

  const imgRes = await fetch(swappedUrl);
  if (!imgRes.ok) {
    return { bytes: null, reason: "تعذر تنزيل نتيجة استبدال الوجه" };
  }

  return { bytes: Buffer.from(await imgRes.arrayBuffer()), reason: null };
}

/** قائمة الطلبات للوحة التحكم مع روابط موقعة لصور الأطفال والإيصالات */
export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(
        "*, story_templates!template_id(id, title, slug, pages, language, content_type), published_template:story_templates!published_template_id(slug)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل الطلبات");

    const { data: pageRows } = await supabaseAdmin
      .from("generated_pages")
      .select("order_id, page_number");

    const result = await Promise.all(
      (orders ?? []).map(async (o) => {
        let photoUrl: string | null = null;
        if (o.child_photo_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("child-photos")
            .createSignedUrl(o.child_photo_path, 3600);
          photoUrl = signed?.signedUrl ?? null;
        }
        let receiptUrl: string | null = null;
        if (o.receipt_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("payment-receipts")
            .createSignedUrl(o.receipt_path, 3600);
          receiptUrl = signed?.signedUrl ?? null;
        }
        const templatePagesCount = parsePages(o.story_templates?.pages).length;
        const purchasedPagesCount = (o as { pages_count?: number | null }).pages_count ?? null;
        const totalPages = purchasedPagesCount ?? templatePagesCount;
        const donePages = (pageRows ?? []).filter((p) => p.order_id === o.id).length;
        return {
          id: o.id,
          status: o.status as string,
          paymentStatus: (o.payment_status ?? "unpaid") as string,
          priceEgp: o.price_egp ?? 100,
          paymentRejectionReason: o.payment_rejection_reason as string | null,
          childName: o.child_name,
          childAge: o.child_age,
          whatsapp: o.whatsapp,
          notes: o.notes,
          adminNotes: o.admin_notes,
          createdAt: o.created_at,
          storyTitle: o.story_templates?.title ?? "قصة محذوفة",
          language: ((o.language as string | null) ??
            (o.story_templates as { language?: string } | null)?.language ??
            "ar") as "ar" | "en" | "bilingual",
          contentType: ((o.story_templates as { content_type?: string } | null)?.content_type ===
          "book"
            ? "book"
            : "story") as "story" | "book",
          templateId: o.template_id,
          photoMode: (o.photo_mode as "cartoon" | "real" | null) ?? "cartoon",
          heroCharacter: (o.hero_character as string | null) ?? null,
          photoUrl,
          receiptUrl,
          totalPages,
          donePages,
          publishedToLibraryAt: (o.published_to_library_at as string | null) ?? null,
          publishedSlug: (o.published_template as { slug?: string } | null)?.slug ?? null,
          giftedByName: (o.gifted_by_name as string | null) ?? null,
          giftedByRelation: (o.gifted_by_relation as string | null) ?? null,
          publishConsent: !!(o.publish_consent as boolean | null),
          isCustomRequest: !!(o as { is_custom_request?: boolean }).is_custom_request,
          customBrief: ((o as { custom_brief?: string | null }).custom_brief ?? null) as
            | string
            | null,
        };
      }),
    );
    return result;
  });

const VerifyInput = z.object({ orderId: z.string().uuid() });

export const adminVerifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "verified",
        payment_verified_by: context.userId,
        payment_verified_at: new Date().toISOString(),
        // للطلبات المرسَلة بإيصال (Vodafone Cash)، paid_at كان يُضبط عند رفع
        // الإيصال لا عند التأكيد الفعلي — ما يجعل تقرير "إيرادات اليوم" في
        // /admin/health (يُصفّي على paid_at) يُفوّت طلبات أُكِّدت اليوم لكن
        // رُفع إيصالها يوماً سابقاً. نضبطها هنا لتطابق سلوك Kashier/الطلبات
        // المعتمدة مباشرة من الأدمن (paid_at = لحظة التأكيد الفعلية دائماً).
        paid_at: new Date().toISOString(),
        payment_rejection_reason: null,
        status: "approved",
      })
      .eq("id", data.orderId)
      .select("user_id")
      .single();
    if (error) throw new Error("تعذر تأكيد الدفع");

    // مكافأة الإحالة (إن وُجدت) بعد أول طلب مؤكَّد — لا تُفشل تأكيد الدفع لو حدث خطأ هنا
    try {
      const { rewardReferralAfterFirstVerifiedOrder } =
        await import("@/features/referrals/referrals.functions");
      await rewardReferralAfterFirstVerifiedOrder(order.user_id);
    } catch (e) {
      console.error("rewardReferralAfterFirstVerifiedOrder failed", e);
    }

    const { logAdminAction } = await import("@/lib/audit/logAdminAction.server");
    await logAdminAction({
      actorId: context.userId,
      action: "verify_payment",
      targetType: "order",
      targetId: data.orderId,
    });

    return { ok: true };
  });

const RejectInput = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(1).max(300),
});

export const adminRejectPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RejectInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "rejected",
        payment_rejection_reason: data.reason,
        status: "rejected",
      })
      .eq("id", data.orderId);
    if (error) throw new Error("تعذر رفض الدفع");

    const { logAdminAction } = await import("@/lib/audit/logAdminAction.server");
    await logAdminAction({
      actorId: context.userId,
      action: "reject_payment",
      targetType: "order",
      targetId: data.orderId,
      metadata: { reason: data.reason },
    });

    return { ok: true };
  });

const SetStatusInput = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pending", "approved", "generating", "ready", "sent", "rejected"]),
  adminNotes: z.string().max(500).optional(),
});

export const adminSetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetStatusInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: data.status,
        ...(data.adminNotes !== undefined ? { admin_notes: data.adminNotes } : {}),
      })
      .eq("id", data.orderId);
    if (error) throw new Error("تعذر تحديث الطلب");
    return { ok: true };
  });

const UpdatePrefsInput = z.object({
  orderId: z.string().uuid(),
  language: z.enum(["ar", "en", "bilingual"]).optional(),
  photoMode: z.enum(["cartoon", "real"]).optional(),
});

/** الأدمن: تعديل تفضيلات الطلب (لغة + نمط صورة الشخصية) في أي وقت */
export const adminUpdateOrderPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdatePrefsInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { language?: string; photo_mode?: string } = {};
    if (data.language) patch.language = data.language;
    if (data.photoMode) patch.photo_mode = data.photoMode;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.orderId);
    if (error) throw new Error("تعذر تحديث تفضيلات الطلب");
    return { ok: true };
  });

const AdminUpdateOrderInput = z.object({
  orderId: z.string().uuid(),
  childName: z.string().trim().min(1).max(40).optional(),
  childNameEn: z.string().trim().max(40).nullable().optional(),
  childAge: z.number().int().min(1).max(14).nullable().optional(),
  whatsapp: z.string().trim().min(6).max(20).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  adminNotes: z.string().trim().max(500).nullable().optional(),
  giftedByName: z.string().trim().max(60).nullable().optional(),
  giftedByRelation: z.string().trim().max(40).nullable().optional(),
  priceEgp: z.number().int().min(0).max(100000).optional(),
});

/** الأدمن: تعديل بيانات الطلب الأساسية في أي وقت */
export const adminUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AdminUpdateOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.childName !== undefined) patch.child_name = data.childName;
    if (data.childNameEn !== undefined) patch.child_name_en = data.childNameEn?.trim() || null;
    if (data.childAge !== undefined) patch.child_age = data.childAge;
    if (data.whatsapp !== undefined) patch.whatsapp = data.whatsapp;
    if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;
    if (data.adminNotes !== undefined) patch.admin_notes = data.adminNotes?.trim() || null;
    if (data.giftedByName !== undefined) patch.gifted_by_name = data.giftedByName?.trim() || null;
    if (data.giftedByRelation !== undefined)
      patch.gifted_by_relation = data.giftedByRelation?.trim() || null;
    if (data.priceEgp !== undefined) patch.price_egp = data.priceEgp;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("orders")
      .update(patch as never)
      .eq("id", data.orderId);
    if (error) throw new Error("تعذر تحديث الطلب");
    return { ok: true };
  });

const AdminDeleteOrderInput = z.object({ orderId: z.string().uuid() });

/** الأدمن: حذف طلب نهائياً مع كل صفحاته وملفاته */
export const adminDeleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AdminDeleteOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, child_photo_path, receipt_path")
      .eq("id", data.orderId)
      .single();

    // احذف صفحات القصة المولّدة وصورها من التخزين
    const { data: pages } = await supabaseAdmin
      .from("generated_pages")
      .select("image_path")
      .eq("order_id", data.orderId);
    const pageFiles = (pages ?? []).map((p) => p.image_path).filter(Boolean) as string[];
    if (pageFiles.length > 0) {
      await supabaseAdmin.storage.from("story-pages").remove(pageFiles);
    }
    await supabaseAdmin.from("generated_pages").delete().eq("order_id", data.orderId);

    const { error } = await supabaseAdmin.from("orders").delete().eq("id", data.orderId);
    if (error) throw new Error("تعذر حذف الطلب");

    const removals: Array<{ bucket: string; path: string }> = [];
    if (order?.child_photo_path)
      removals.push({ bucket: "child-photos", path: order.child_photo_path });
    if (order?.receipt_path)
      removals.push({ bucket: "payment-receipts", path: order.receipt_path });
    await Promise.all(removals.map((r) => supabaseAdmin.storage.from(r.bucket).remove([r.path])));
    return { ok: true };
  });

/** العميل: تعديل تفضيلاته قبل بدء توليد الصفحات */
export const updateMyOrderPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdatePrefsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status")
      .eq("id", data.orderId)
      .single();
    if (oErr || !order) throw new Error("الطلب غير موجود");
    if (order.user_id !== context.userId) throw new Error("غير مصرح");
    const { count } = await supabaseAdmin
      .from("generated_pages")
      .select("id", { count: "exact", head: true })
      .eq("order_id", data.orderId);
    if ((count ?? 0) > 0 || ["generating", "ready", "sent"].includes(order.status as string)) {
      throw new Error("لا يمكن تعديل التفضيلات بعد بدء توليد القصة");
    }
    const patch: { language?: string; photo_mode?: string } = {};
    if (data.language) patch.language = data.language;
    if (data.photoMode) patch.photo_mode = data.photoMode;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.orderId);
    if (error) throw new Error("تعذر تحديث تفضيلاتك");
    return { ok: true };
  });

/**
 * تحقق أن الطلب يخص المستخدم ولم يعتمده الادمن (لا تعديل/حذف بعد التأكيد).
 * نسمح بالتعديل ما دامت الحالة pending ولم يتم تأكيد الدفع.
 */
async function assertOrderEditable(
  supabaseAdmin: import("@supabase/supabase-js").SupabaseClient,
  orderId: string,
  userId: string,
) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status, payment_status, child_photo_path, receipt_path")
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error("الطلب غير موجود");
  if (order.user_id !== userId) throw new Error("غير مصرح");
  if ((order.payment_status as string) === "verified")
    throw new Error("لا يمكن التعديل بعد اعتماد الدفع من الإدارة");
  if (!["pending"].includes(order.status as string))
    throw new Error("لا يمكن التعديل بعد بدء معالجة الطلب");
  const { count } = await supabaseAdmin
    .from("generated_pages")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);
  if ((count ?? 0) > 0) throw new Error("لا يمكن التعديل بعد بدء توليد الصفحات");
  return order as {
    id: string;
    user_id: string;
    status: string;
    payment_status: string;
    child_photo_path: string | null;
    receipt_path: string | null;
  };
}

const UpdateMyOrderInput = z.object({
  orderId: z.string().uuid(),
  childName: z.string().trim().min(1).max(40),
  childNameEn: z.string().trim().max(40).nullable().optional(),
  childAge: z.number().int().min(1).max(14).nullable().optional(),
  gender: z.enum(["boy", "girl"]),
  whatsapp: z.string().trim().min(8).max(20),
  notes: z.string().trim().max(500).nullable().optional(),
  language: z.enum(["ar", "en", "bilingual"]),
  photoMode: z.enum(["cartoon", "real"]),
  pagesCount: z.union([z.literal(10), z.literal(16)]),
  printCopy: z.boolean(),
  deliveryAddress: z.string().trim().max(500).nullable().optional(),
  gifterName: z.string().trim().max(60).nullable().optional(),
  gifterRelation: z.string().trim().max(40).nullable().optional(),
  publishConsent: z.boolean().optional(),
  /** مسار صورة طفل جديدة (إن رفعها العميل) */
  newChildPhotoPath: z.string().min(1).nullable().optional(),
  /** مسار إيصال جديد (إن رفعه العميل) */
  newReceiptPath: z.string().min(1).nullable().optional(),
});

/** العميل: تعديل بياناته كاملةً قبل اعتماد الدفع */
export const updateMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateMyOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await assertOrderEditable(supabaseAdmin, data.orderId, context.userId);

    // إعادة احتساب السعر حسب نوع القالب
    const { data: orderTpl } = await supabaseAdmin
      .from("orders")
      .select("template_id, story_templates!template_id(is_custom)")
      .eq("id", data.orderId)
      .single();
    const isCustom = Boolean(
      (orderTpl as { story_templates?: { is_custom?: boolean } } | null)?.story_templates
        ?.is_custom,
    );
    const { pricePerPages, PRINT_COPY_PRICE_EGP } = await import("@/features/cart/pricing");
    const base = pricePerPages(data.pagesCount, isCustom);
    const priceEgp = base + (data.printCopy ? PRINT_COPY_PRICE_EGP : 0);

    if (data.printCopy && !(data.deliveryAddress ?? "").trim()) {
      throw new Error("اكتب عنوان التوصيل لطلب نسخة مطبوعة");
    }

    const patch: Record<string, unknown> = {
      child_name: data.childName,
      child_name_en: data.childNameEn?.trim() || null,
      child_age: data.childAge ?? null,
      gender: data.gender,
      whatsapp: data.whatsapp,
      notes: data.notes?.trim() || null,
      language: data.language,
      photo_mode: data.photoMode,
      pages_count: data.pagesCount,
      print_copy: data.printCopy,
      delivery_address: data.printCopy ? (data.deliveryAddress ?? "").trim() : null,
      gifted_by_name: data.gifterName?.trim() || null,
      gifted_by_relation: data.gifterRelation?.trim() || null,
      price_egp: priceEgp,
    };
    if (data.publishConsent !== undefined) patch.publish_consent = data.publishConsent;
    if (data.newChildPhotoPath) patch.child_photo_path = data.newChildPhotoPath;
    if (data.newReceiptPath) {
      patch.receipt_path = data.newReceiptPath;
      patch.payment_status = "receipt_uploaded";
      patch.payment_rejection_reason = null;
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update(patch as never)
      .eq("id", data.orderId);
    if (error) throw new Error("تعذر تحديث الطلب");

    // نظافة: نحذف الملفات القديمة لو تم استبدالها
    const removals: Array<{ bucket: string; path: string }> = [];
    if (
      data.newChildPhotoPath &&
      existing.child_photo_path &&
      existing.child_photo_path !== data.newChildPhotoPath
    ) {
      removals.push({ bucket: "child-photos", path: existing.child_photo_path });
    }
    if (
      data.newReceiptPath &&
      existing.receipt_path &&
      existing.receipt_path !== data.newReceiptPath
    ) {
      removals.push({ bucket: "payment-receipts", path: existing.receipt_path });
    }
    await Promise.all(removals.map((r) => supabaseAdmin.storage.from(r.bucket).remove([r.path])));

    return { ok: true };
  });

const DeleteMyOrderInput = z.object({ orderId: z.string().uuid() });

/** العميل: حذف الطلب قبل اعتماد الدفع */
export const deleteMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteMyOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await assertOrderEditable(supabaseAdmin, data.orderId, context.userId);
    const { error } = await supabaseAdmin.from("orders").delete().eq("id", data.orderId);
    if (error) throw new Error("تعذر حذف الطلب");
    // نظافة ملفات
    const removals: Array<{ bucket: string; path: string }> = [];
    if (existing.child_photo_path)
      removals.push({ bucket: "child-photos", path: existing.child_photo_path });
    if (existing.receipt_path)
      removals.push({ bucket: "payment-receipts", path: existing.receipt_path });
    await Promise.all(removals.map((r) => supabaseAdmin.storage.from(r.bucket).remove([r.path])));
    return { ok: true };
  });

const GeneratePageInput = z.object({
  orderId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(20),
});

/**
 * يضمن أن قالب القصة يحتوي على نفس عدد الصفحات الذي اشتراه العميل
 * (10 أو 16) قبل بدء توليد الصور. إن كان عدد صفحات القالب أقل من المطلوب
 * فإنه يُعيد توليد نصوص/مشاهد الصفحات عبر الذكاء الاصطناعي ويحدّث
 * `story_templates.pages` مع الحفاظ على `image_path` للصفحات السابقة.
 */
async function ensureTemplateMatchesOrderPages(
  supabaseAdmin: {
    from: (t: string) => {
      select: (q: string) => {
        eq: (k: string, v: string) => { single: () => Promise<{ data: unknown; error: unknown }> };
      };
      update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: unknown }> };
    };
  },
  templateId: string,
  required: number,
  order: {
    child_name: string;
    child_age?: number | null;
    gender: "boy" | "girl";
    language?: string | null;
    notes?: string | null;
    custom_brief?: string | null;
    gifted_by_name?: string | null;
    gifted_by_relation?: string | null;
  },
): Promise<StoryPage[]> {
  const { data: tplRow, error: tplErr } = await supabaseAdmin
    .from("story_templates")
    .select("id, pages, title, summary, content_type, language, age_range, book_meta, category")
    .eq("id", templateId)
    .single();
  if (tplErr || !tplRow) throw new Error("القالب غير موجود");

  const tpl = tplRow as {
    id: string;
    pages: unknown;
    title: string;
    summary?: string | null;
    content_type?: string | null;
    language?: string | null;
    age_range?: string | null;
    book_meta?: unknown;
    category?: string | null;
  };
  const existing = parsePages(tpl.pages);
  if (existing.length >= required) return existing;

  const allowedCount: 10 | 16 = required >= 16 ? 16 : 10;
  const contentType: "story" | "book" = tpl.content_type === "book" ? "book" : "story";
  const language: "ar" | "en" | "bilingual" =
    order.language === "en" || order.language === "bilingual"
      ? (order.language as "en" | "bilingual")
      : tpl.language === "en" || tpl.language === "bilingual"
        ? (tpl.language as "en" | "bilingual")
        : "ar";

  const { regenerateStoryPages } = await import("@/features/ai/ai.functions");
  const theme = [tpl.title, tpl.summary, order.custom_brief, order.notes]
    .filter(Boolean)
    .join(" — ");

  const result = await regenerateStoryPages({
    childName: order.child_name,
    age: order.child_age ?? tpl.age_range ?? null,
    gender: (order.gender ?? "boy") as "boy" | "girl",
    language,
    contentType,
    pagesCount: allowedCount,
    bookMeta: (tpl.book_meta ?? null) as never,
    theme,
    gifterName: order.gifted_by_name ?? null,
    gifterRelation: order.gifted_by_relation ?? null,
  });

  // الحفاظ على image_path للصفحات التي وُلّدت سابقاً (نفس رقم n)
  const existingByN = new Map(existing.map((p) => [p.n, p]));
  const merged: StoryPage[] = result.pages.map((p) => {
    const prev = existingByN.get(p.n);
    return prev?.image_path ? { ...p, image_path: prev.image_path } : p;
  });

  const { error: upErr } = await supabaseAdmin
    .from("story_templates")
    .update({ pages: merged as unknown as never })
    .eq("id", templateId);
  if (upErr) {
    console.error("ensureTemplateMatchesOrderPages update failed", upErr);
    throw new Error("تعذر تحديث صفحات القالب لمطابقة الطلب");
  }
  return merged;
}

/**
 * توليد صفحة قصة مخصصة: يحول صورة الطفل الحقيقية إلى بطل كرتوني ثلاثي الأبعاد
 * داخل مشهد الصفحة — بالنمط المعتمد Children's Cartoon Style 3D.
 */
export const adminGeneratePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GeneratePageInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("*, story_templates!template_id(id, pages, title)")
      .eq("id", data.orderId)
      .single();
    if (orderErr || !order) throw new Error("الطلب غير موجود");

    const templateId = (order.story_templates as { id?: string } | null)?.id ?? order.template_id;
    if (!templateId) throw new Error("لا يوجد قالب مرتبط بالطلب");

    const expectedTotal: number =
      ((order as { pages_count?: number | null }).pages_count ?? 0) ||
      parsePages(order.story_templates?.pages).length;
    if (data.pageNumber > expectedTotal)
      throw new Error(`هذا الطلب يحتوي على ${expectedTotal} صفحات فقط`);

    const pages = await ensureTemplateMatchesOrderPages(
      supabaseAdmin as never,
      templateId,
      expectedTotal,
      order as never,
    );
    const page = pages.find((p) => p.n === data.pageNumber);
    if (!page) throw new Error("الصفحة غير موجودة");
    if (!order.child_photo_path) throw new Error("لا توجد صورة للطفل في هذا الطلب");

    const { data: signedPhoto } = await supabaseAdmin.storage
      .from("child-photos")
      .createSignedUrl(order.child_photo_path, 600);
    if (!signedPhoto?.signedUrl) throw new Error("تعذر الوصول لصورة الطفل");

    // نمط العمر: يطبق عمر الطفل من الطلب إذا لم يكن مدمجاً في المشهد
    const agePart = page.scene.includes("Age styling")
      ? ""
      : `\n${ageStylePrompt(order.child_age)}.`;
    const gender = (order.gender as "boy" | "girl" | null) ?? "boy";
    const isGirl = gender === "girl";
    const heroLabel = isGirl ? "girl" : "boy";
    const pronoun = isGirl ? "she/her" : "he/him";
    const photoMode = ((order.photo_mode as string | null) ?? "cartoon") as "cartoon" | "real";
    const heroCharacter = (order.hero_character as string | null)?.trim() || null;

    // جلب الصورة المرجعية للجنس (ولد/بنت) — تستخدم كـ "نموذج للشخصية" يتعلم منه الذكاء الاصطناعي شكل البطل المعتمد
    const refFile = isGirl ? "girl.jpg" : "boy.png";
    const { data: signedRef } = await supabaseAdmin.storage
      .from("reference-children")
      .createSignedUrl(refFile, 600);
    const refUrl = signedRef?.signedUrl ?? null;

    const faceBlock =
      photoMode === "real"
        ? `Keep the child's REAL face from PHOTO (image #1) unchanged — same exact facial features, skin, eyes, hair — and composite it naturally onto a 3D animated cartoon body and environment (Superman / Tom & Jerry style: real face on cartoon scene). The face stays photoreal; everything else is fully 3D cartoon.`
        : `Transform the real child from the attached PHOTO (image #1) into an adorable 3D cartoon hero ${heroLabel} character. Keep the child's face clearly recognizable (same hair color and style, eye color, skin tone, facial features) but rendered as a beautiful enhanced 3D cartoon character like a Pixar movie star, with body proportions, outfit and overall maturity matching the child's real age.`;

    const heroBlock = heroCharacter
      ? `\nThe child is dressed and styled as ${heroCharacter} (costume, colors, signature accessories) — keep the child's own face; ${heroCharacter} provides only the outfit/theme inspiration.`
      : "";

    const prompt = `${STORY_STYLE_PROMPT}.${agePart}
${SHARIA_IMAGE_RULE}

The hero is a ${heroLabel} child (${pronoun}). ${isGirl ? "Render her as an adorable little girl character with feminine styling appropriate for her age." : "Render him as an adorable little boy character with masculine styling appropriate for his age."}
${refUrl ? `REFERENCE CHARACTER (image #2): use the cartoon ${heroLabel} in image #2 as the canonical visual style for the hero — same 3D cartoon aesthetic, body proportions, outfit vibe and overall mood. This is the "official" ${heroLabel} character of the platform.` : ""}
${faceBlock}${heroBlock}
Scene to illustrate: ${page.scene}.
The ${heroLabel} child is the main hero of the scene. Square children's storybook illustration, ${STYLE_NEGATIVE}.`;

    const imagePath = `${data.orderId}/page-${data.pageNumber}.png`;
    const providerErrors: string[] = [];
    const replicateKey =
      process.env.REPLICATE_API_KEY || process.env.LOVABLE_CONNECTOR_REPLICATE_API_KEY;

    if (page.image_path && replicateKey && key) {
      const { data: signedTemplateScene } = await supabaseAdmin.storage
        .from("story-pages")
        .createSignedUrl(page.image_path, 600);
      if (signedTemplateScene?.signedUrl) {
        const swapped = await runReplicateFaceSwap({
          sceneUrl: signedTemplateScene.signedUrl,
          photoUrl: signedPhoto.signedUrl,
          lovableKey: key,
          replicateKey,
        });

        if (swapped.bytes) {
          const { error: uploadErr } = await supabaseAdmin.storage
            .from("story-pages")
            .upload(imagePath, swapped.bytes, { contentType: "image/png", upsert: true });
          if (uploadErr) {
            console.error("upload swapped scene error", uploadErr);
            throw new Error("تعذر حفظ الصورة");
          }
          console.log(`[face-swap] template-scene order=${data.orderId} page=${data.pageNumber}`);

          await supabaseAdmin
            .from("generated_pages")
            .delete()
            .eq("order_id", data.orderId)
            .eq("page_number", data.pageNumber);
          const { error: insertErr } = await supabaseAdmin.from("generated_pages").insert({
            order_id: data.orderId,
            page_number: data.pageNumber,
            image_path: imagePath,
            page_text: personalize(page.text, order.child_name),
          });
          if (insertErr) throw new Error("تعذر تسجيل الصفحة");

          const { count } = await supabaseAdmin
            .from("generated_pages")
            .select("id", { count: "exact", head: true })
            .eq("order_id", data.orderId);

          const allDone = (count ?? 0) >= expectedTotal;
          await supabaseAdmin
            .from("orders")
            .update({ status: allDone ? "ready" : "generating" })
            .eq("id", data.orderId);

          const { data: signedPage } = await supabaseAdmin.storage
            .from("story-pages")
            .createSignedUrl(imagePath, 3600);

          return {
            pageNumber: data.pageNumber,
            imageUrl: signedPage?.signedUrl ?? null,
            done: count ?? 0,
            total: expectedTotal,
            allDone,
          };
        }

        if (swapped.reason) providerErrors.push(swapped.reason);
      }
    }

    // ترتيب المزودات: Gemini (مفتاحك الشخصي) → Lovable AI → OpenAI → Stability → Replicate
    let base64: string | null = null;
    let providerUsed: "lovable" | "openai" | "gemini" | "stability" | "replicate" = "gemini";

    // المزود الأساسي: Google Gemini المباشر (gemini-2.5-flash-image / nano-banana)
    if (!base64 && process.env.GEMINI_API_KEY) {
      providerUsed = "gemini";
      try {
        const photoRes = await fetch(signedPhoto.signedUrl);
        if (!photoRes.ok) throw new Error("photo fetch failed");
        const photoBuf = Buffer.from(await photoRes.arrayBuffer());
        const photoB64 = photoBuf.toString("base64");
        const mime = photoRes.headers.get("content-type") || "image/png";

        const parts: Array<
          { text: string } | { inline_data: { mime_type: string; data: string } }
        > = [{ text: prompt }, { inline_data: { mime_type: mime, data: photoB64 } }];
        if (refUrl) {
          try {
            const refRes = await fetch(refUrl);
            if (refRes.ok) {
              const refB64 = Buffer.from(await refRes.arrayBuffer()).toString("base64");
              const refMime = refRes.headers.get("content-type") || "image/png";
              parts.push({ inline_data: { mime_type: refMime, data: refB64 } });
            }
          } catch {
            // تجاهل فشل تحميل صورة المرجع
          }
        }

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts }] }),
          },
        );

        if (geminiRes.ok) {
          const gj = (await geminiRes.json()) as {
            candidates?: {
              content?: {
                parts?: { inline_data?: { data?: string }; inlineData?: { data?: string } }[];
              };
            }[];
          };
          const respParts = gj.candidates?.[0]?.content?.parts ?? [];
          for (const p of respParts) {
            const d = p.inline_data?.data ?? p.inlineData?.data;
            if (d) {
              base64 = d;
              break;
            }
          }
          if (!base64) providerErrors.push("Gemini لم يُعد صورة");
        } else {
          const body = await geminiRes.text().catch(() => "");
          console.error("Gemini primary failed", geminiRes.status, body);
          providerErrors.push(summarizeProviderFailure("gemini", geminiRes.status, body));
        }
      } catch (e) {
        console.error("Gemini primary error", e);
        providerErrors.push("تعذر الاتصال بـ Gemini");
      }
    }

    // Fallback 1: Lovable AI Gateway (gemini-3.1-flash-image-preview)
    if (!base64 && key) {
      providerUsed = "lovable";
      const lovableContent: Array<
        { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
      > = [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: signedPhoto.signedUrl } },
      ];
      if (refUrl) {
        lovableContent.push({ type: "image_url", image_url: { url: refUrl } });
      }

      const lovableRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [{ role: "user", content: lovableContent }],
          modalities: ["image", "text"],
        }),
      });

      if (lovableRes.ok) {
        const json = (await lovableRes.json()) as {
          choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
        };
        const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (dataUrl?.includes("base64,")) {
          base64 = dataUrl.split("base64,")[1];
        }
      } else {
        const body = await lovableRes.text().catch(() => "");
        console.warn("Lovable AI fallback failed", lovableRes.status, body);
        providerErrors.push(summarizeProviderFailure("lovable", lovableRes.status, body));
      }
    }

    // Fallback 2: OpenAI gpt-image-1
    if (!base64 && process.env.OPENAI_API_KEY) {
      providerUsed = "openai";
      try {
        const photoRes = await fetch(signedPhoto.signedUrl);
        if (!photoRes.ok) throw new Error("photo fetch failed");
        const photoBlob = await photoRes.blob();

        const form = new FormData();
        form.append("model", "gpt-image-1");
        form.append("prompt", prompt);
        form.append("size", "1024x1024");
        form.append("n", "1");
        form.append("image", photoBlob, "child.png");

        const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: form,
        });

        if (openaiRes.ok) {
          const oj = (await openaiRes.json()) as { data?: { b64_json?: string }[] };
          base64 = oj.data?.[0]?.b64_json ?? null;
        } else {
          const body = await openaiRes.text().catch(() => "");
          console.warn("OpenAI fallback failed", openaiRes.status, body);
          providerErrors.push(summarizeProviderFailure("openai", openaiRes.status, body));
        }
      } catch (e) {
        console.warn("OpenAI fallback error", e);
        providerErrors.push("تعذر الاتصال بـ OpenAI");
      }
    }

    // (تمت ترقية Gemini إلى المزود الأساسي في الأعلى)

    // Fallback 3: Stability AI (Stable Diffusion 3) — text-to-image

    if (!base64 && process.env.STABILITY_API_KEY) {
      providerUsed = "stability";
      try {
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("output_format", "png");
        form.append("aspect_ratio", "1:1");
        form.append("model", "sd3.5-large");

        const stabRes = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
            Accept: "image/*",
          },
          body: form,
        });

        if (stabRes.ok) {
          const buf = Buffer.from(await stabRes.arrayBuffer());
          base64 = buf.toString("base64");
        } else {
          const body = await stabRes.text().catch(() => "");
          console.error("Stability fallback failed", stabRes.status, body);
          providerErrors.push(summarizeProviderFailure("stability", stabRes.status, body));
        }
      } catch (e) {
        console.error("Stability fallback error", e);
        providerErrors.push("تعذر الاتصال بـ Stability");
      }
    }

    // Fallback 4: Replicate (FLUX schnell) عبر بوابة Lovable
    if (!base64 && process.env.LOVABLE_API_KEY && process.env.REPLICATE_API_KEY) {
      providerUsed = "replicate";
      try {
        const GW = "https://connector-gateway.lovable.dev/replicate/v1";
        const headers = {
          Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": process.env.REPLICATE_API_KEY as string,
          "Content-Type": "application/json",
        };

        const createRes = await fetch(`${GW}/models/black-forest-labs/flux-schnell/predictions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            input: { prompt, aspect_ratio: "1:1", output_format: "png", num_outputs: 1 },
          }),
        });

        if (!createRes.ok) {
          const body = await createRes.text().catch(() => "");
          console.error("Replicate create failed", createRes.status, body);
          providerErrors.push(summarizeProviderFailure("replicate", createRes.status, body));
        } else {
          const created = (await createRes.json()) as { id?: string; status?: string };
          const predId = created.id;
          if (predId) {
            let outputUrl: string | null = null;
            for (let i = 0; i < 60; i++) {
              await new Promise((r) => setTimeout(r, i < 5 ? 2000 : 4000));
              const pollRes = await fetch(`${GW}/predictions/${predId}`, {
                headers: { ...headers, "Content-Type": "application/json" },
              });
              if (!pollRes.ok) continue;
              const pj = (await pollRes.json()) as {
                status?: string;
                output?: string | string[];
                error?: unknown;
              };
              if (pj.status === "succeeded") {
                const out = Array.isArray(pj.output) ? pj.output[0] : pj.output;
                if (typeof out === "string") outputUrl = out;
                break;
              }
              if (pj.status === "failed" || pj.status === "canceled") {
                console.error("Replicate failed", pj.error);
                providerErrors.push("فشل توليد الصورة عبر Replicate");
                break;
              }
            }
            if (outputUrl) {
              const imgRes = await fetch(outputUrl);
              if (imgRes.ok) {
                base64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
              }
            }
          }
        }
      } catch (e) {
        console.error("Replicate fallback error", e);
        providerErrors.push("تعذر الاتصال بـ Replicate");
      }
    }

    if (!base64) {
      if (page.image_path && !replicateKey) {
        throw new Error("صورة القالب موجودة لكن أداة استبدال الوجه غير مرتبطة حالياً");
      }
      throw new Error(
        providerErrors.length
          ? `تعذر إنشاء الصفحة حالياً: ${Array.from(new Set(providerErrors)).join(" — ")}`
          : "فشل توليد الصورة من جميع المزودات المُهيأة، تحقق من الرصيد والمفاتيح",
      );
    }

    let bytes = Buffer.from(base64, "base64");
    console.log(
      `[generate-page] provider=${providerUsed} order=${data.orderId} page=${data.pageNumber}`,
    );

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("story-pages")
      .upload(imagePath, bytes, { contentType: "image/png", upsert: true });
    if (uploadErr) {
      console.error("upload error", uploadErr);
      throw new Error("تعذر حفظ الصورة");
    }

    // ====== مرحلة استبدال الوجه (Face Swap) عبر Replicate ======
    // تأخذ وجه الطفل الحقيقي من صورته وتحلّه محل وجه البطل في المشهد المولّد.
    if (replicateKey && process.env.LOVABLE_API_KEY) {
      try {
        const { data: signedScene } = await supabaseAdmin.storage
          .from("story-pages")
          .createSignedUrl(imagePath, 600);
        if (signedScene?.signedUrl) {
          const swapped = await runReplicateFaceSwap({
            sceneUrl: signedScene.signedUrl,
            photoUrl: signedPhoto.signedUrl,
            lovableKey: process.env.LOVABLE_API_KEY,
            replicateKey,
          });
          if (swapped.bytes) {
            bytes = swapped.bytes;
            const { error: reErr } = await supabaseAdmin.storage
              .from("story-pages")
              .upload(imagePath, bytes, { contentType: "image/png", upsert: true });
            if (reErr) console.error("face-swap re-upload error", reErr);
            else console.log(`[face-swap] applied order=${data.orderId} page=${data.pageNumber}`);
          } else if (swapped.reason) {
            console.warn("Face swap skipped", swapped.reason);
          }
        }
      } catch (e) {
        console.warn("Face swap skipped", e);
      }
    }

    await supabaseAdmin
      .from("generated_pages")
      .delete()
      .eq("order_id", data.orderId)
      .eq("page_number", data.pageNumber);
    const { error: insertErr } = await supabaseAdmin.from("generated_pages").insert({
      order_id: data.orderId,
      page_number: data.pageNumber,
      image_path: imagePath,
      page_text: personalize(page.text, order.child_name),
    });
    if (insertErr) throw new Error("تعذر تسجيل الصفحة");

    const { count } = await supabaseAdmin
      .from("generated_pages")
      .select("id", { count: "exact", head: true })
      .eq("order_id", data.orderId);

    const allDone = (count ?? 0) >= expectedTotal;
    await supabaseAdmin
      .from("orders")
      .update({ status: allDone ? "ready" : "generating" })
      .eq("id", data.orderId);

    const { data: signedPage } = await supabaseAdmin.storage
      .from("story-pages")
      .createSignedUrl(imagePath, 3600);

    return {
      pageNumber: data.pageNumber,
      imageUrl: signedPage?.signedUrl ?? null,
      done: count ?? 0,
      total: expectedTotal,
      allDone,
    };
  });

const OrderIdInput = z.object({ orderId: z.string().uuid() });

/** صفحات الطلب المولدة مع روابط موقعة (للوحة التحكم) */
export const adminGetOrderPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("generated_pages")
      .select("page_number, image_path, page_text")
      .eq("order_id", data.orderId)
      .order("page_number");

    return Promise.all(
      (rows ?? []).map(async (r) => {
        let imageUrl: string | null = null;
        if (r.image_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("story-pages")
            .createSignedUrl(r.image_path, 3600);
          imageUrl = signed?.signedUrl ?? null;
        }
        return {
          pageNumber: r.page_number,
          text: r.page_text,
          imageUrl,
        };
      }),
    );
  });

// تكلفة تقديرية بالدولار حسب موديل توليد الصور المستخدم حالياً (gemini-3.1-flash-image-preview)
// ملاحظة: التكلفة الفعلية تُخصم من رصيد Lovable AI وتُحسب بدقة في Settings → Workspace → Usage
const COST_PER_IMAGE_USD = 0.04;
const COST_PER_TEXT_GENERATION_USD = 0.005;

/** إحصائيات الاستخدام والتكلفة التقديرية + حالة المزودات المُهيأة */
export const adminGetUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: imagesAll },
      { count: images30d },
      { count: ordersAll },
      { count: templatesAll },
    ] = await Promise.all([
      supabaseAdmin.from("generated_pages").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("generated_pages")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since30d),
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("story_templates").select("id", { count: "exact", head: true }),
    ]);

    const totalImages = imagesAll ?? 0;
    const imagesLast30d = images30d ?? 0;
    const estimatedCostUsdTotal = +(totalImages * COST_PER_IMAGE_USD).toFixed(2);
    const estimatedCostUsd30d = +(imagesLast30d * COST_PER_IMAGE_USD).toFixed(2);

    return {
      totalImages,
      imagesLast30d,
      totalOrders: ordersAll ?? 0,
      totalTemplates: templatesAll ?? 0,
      costPerImageUsd: COST_PER_IMAGE_USD,
      costPerTextUsd: COST_PER_TEXT_GENERATION_USD,
      estimatedCostUsdTotal,
      estimatedCostUsd30d,
      currentImageModel: "gemini-2.5-flash-image (مفتاحك المباشر)",
      currentTextModel: "google/gemini-3-flash-preview",

      providers: {
        lovable: Boolean(process.env.LOVABLE_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        stability: Boolean(process.env.STABILITY_API_KEY),
        replicate: Boolean(process.env.REPLICATE_API_KEY),
      },
    };
  });

// ============================================================
// إدارة القوالب من لوحة التحكم — قراءة، تعديل، ورفع/توليد الصور
// ============================================================

export const adminListTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("story_templates")
      .select(
        "id, slug, title, summary, category, age_range, content_type, language, is_published, is_custom, approved_at, admin_approved_at, cover_url, pages, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل القوالب");
    return (data ?? []).map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      category: t.category,
      ageRange: t.age_range,
      contentType: t.content_type as string,
      language: t.language as string,
      isPublished: Boolean(t.is_published),
      isCustom: Boolean(t.is_custom),
      approvedAt: t.approved_at as string | null,
      adminApprovedAt: t.admin_approved_at as string | null,
      coverUrl: t.cover_url as string | null,
      pageCount: parsePages(t.pages).length,
      createdAt: t.created_at,
    }));
  });

const TplId = z.object({ templateId: z.string().uuid() });

export const adminGetTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TplId.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tpl, error } = await supabaseAdmin
      .from("story_templates")
      .select("*")
      .eq("id", data.templateId)
      .single();
    if (error || !tpl) throw new Error("القالب غير موجود");
    const pages = parsePages(tpl.pages);
    const pagesWithUrls = await Promise.all(
      pages.map(async (p) => {
        let imageUrl: string | null = null;
        if (p.image_path) {
          const { data: s } = await supabaseAdmin.storage
            .from("story-pages")
            .createSignedUrl(p.image_path, 3600);
          imageUrl = s?.signedUrl ?? null;
        }
        return { ...p, imageUrl };
      }),
    );
    return {
      id: tpl.id,
      slug: tpl.slug,
      title: tpl.title,
      summary: tpl.summary,
      category: tpl.category,
      ageRange: tpl.age_range,
      contentType: tpl.content_type as string,
      language: (tpl.language as string) ?? "ar",
      coverUrl: tpl.cover_url as string | null,
      pages: pagesWithUrls,
    };
  });

const UpdatePageInput = z.object({
  templateId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(30),
  title: z.string().trim().max(120).optional(),
  text: z.string().trim().max(2000).optional(),
  title_ar: z.string().trim().max(120).optional(),
  title_en: z.string().trim().max(120).optional(),
  text_ar: z.string().trim().max(2000).optional(),
  text_en: z.string().trim().max(2000).optional(),
  image_title_en: z.string().trim().max(60).optional(),
  scene: z.string().trim().max(1500).optional(),
});

export const adminUpdateTemplatePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdatePageInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tpl } = await supabaseAdmin
      .from("story_templates")
      .select("pages")
      .eq("id", data.templateId)
      .single();
    if (!tpl) throw new Error("القالب غير موجود");
    const pages = parsePages(tpl.pages);
    const updated = pages.map((p) =>
      p.n === data.pageNumber
        ? {
            ...p,
            ...(data.title !== undefined ? { title: data.title } : {}),
            ...(data.text !== undefined ? { text: data.text } : {}),
            ...(data.title_ar !== undefined ? { title_ar: data.title_ar } : {}),
            ...(data.title_en !== undefined ? { title_en: data.title_en } : {}),
            ...(data.text_ar !== undefined ? { text_ar: data.text_ar } : {}),
            ...(data.text_en !== undefined ? { text_en: data.text_en } : {}),
            ...(data.image_title_en !== undefined ? { image_title_en: data.image_title_en } : {}),
            ...(data.scene !== undefined ? { scene: data.scene } : {}),
          }
        : p,
    );
    const { error } = await supabaseAdmin
      .from("story_templates")
      .update({ pages: updated as unknown as never })
      .eq("id", data.templateId);
    if (error) throw new Error("تعذر حفظ التعديل");
    return { ok: true };
  });

const UploadImgInput = z.object({
  templateId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(30),
  dataUrl: z.string().min(20),
});

export const adminUploadTemplatePageImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UploadImgInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const m = data.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) throw new Error("صيغة الصورة غير صحيحة");
    const contentType = m[1];
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 8 * 1024 * 1024) throw new Error("الصورة أكبر من 8MB");

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const imagePath = `templates/${data.templateId}/page-${data.pageNumber}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("story-pages")
      .upload(imagePath, bytes, { contentType, upsert: true });
    if (upErr) throw new Error("تعذر رفع الصورة");

    const { data: tpl } = await supabaseAdmin
      .from("story_templates")
      .select("pages")
      .eq("id", data.templateId)
      .single();
    if (!tpl) throw new Error("القالب غير موجود");
    const pages = parsePages(tpl.pages);
    const updated = pages.map((p) =>
      p.n === data.pageNumber ? { ...p, image_path: imagePath } : p,
    );
    await supabaseAdmin
      .from("story_templates")
      .update({ pages: updated as unknown as never })
      .eq("id", data.templateId);

    const { data: signed } = await supabaseAdmin.storage
      .from("story-pages")
      .createSignedUrl(imagePath, 3600);
    return { imageUrl: signed?.signedUrl ?? null };
  });

const RegenImgInput = z.object({
  templateId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(30),
});

export const adminRegenerateTemplatePageImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RegenImgInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const key = process.env.LOVABLE_API_KEY;
    if (!key && !process.env.GEMINI_API_KEY) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tpl } = await supabaseAdmin
      .from("story_templates")
      .select("pages, age_range")
      .eq("id", data.templateId)
      .single();
    if (!tpl) throw new Error("القالب غير موجود");
    const pages = parsePages(tpl.pages);
    const page = pages.find((p) => p.n === data.pageNumber);
    if (!page) throw new Error("الصفحة غير موجودة");

    const titleP = page.image_title_en ? `\n${bakedTitlePrompt(page.image_title_en)}` : "";
    const ageP = page.scene.includes("Age styling") ? "" : `\n${ageStylePrompt(tpl.age_range)}.`;
    const prompt = `${STORY_STYLE_PROMPT}.${ageP}${titleP}
Children's storybook page illustration that literally depicts this exact scene: ${page.scene}.
Square composition, rich storytelling details, ${STYLE_NEGATIVE}.`;

    let base64: string | null = null;

    // المزود الأساسي: Gemini المباشر
    if (process.env.GEMINI_API_KEY) {
      try {
        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
            }),
          },
        );
        if (gRes.ok) {
          const gj = (await gRes.json()) as {
            candidates?: {
              content?: {
                parts?: { inline_data?: { data?: string }; inlineData?: { data?: string } }[];
              };
            }[];
          };
          for (const p of gj.candidates?.[0]?.content?.parts ?? []) {
            const d = p.inline_data?.data ?? p.inlineData?.data;
            if (d) {
              base64 = d;
              break;
            }
          }
        } else {
          console.warn("Gemini regen tpl failed", gRes.status, await gRes.text().catch(() => ""));
        }
      } catch (e) {
        console.warn("Gemini regen tpl error", e);
      }
    }

    // Fallback: Lovable AI Gateway
    if (!base64 && key) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
        };
        const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (dataUrl?.includes("base64,")) base64 = dataUrl.split("base64,")[1];
      } else {
        console.warn("Lovable regen tpl failed", res.status, await res.text().catch(() => ""));
      }
    }

    if (!base64)
      throw new Error("تعذر توليد الصورة من Gemini ولا Lovable AI — تحقق من المفاتيح/الرصيد");
    const bytes = Buffer.from(base64, "base64");

    const imagePath = `templates/${data.templateId}/page-${data.pageNumber}.png`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("story-pages")
      .upload(imagePath, bytes, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error("تعذر حفظ الصورة");

    const updated: StoryPage[] = pages.map((p) =>
      p.n === data.pageNumber ? { ...p, image_path: imagePath } : p,
    );
    await supabaseAdmin
      .from("story_templates")
      .update({ pages: updated as unknown as never })
      .eq("id", data.templateId);

    const { data: signed } = await supabaseAdmin.storage
      .from("story-pages")
      .createSignedUrl(imagePath, 3600);
    return { imageUrl: signed?.signedUrl ?? null };
  });

const RegenTextInput = z.object({
  templateId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(30),
  instruction: z.string().trim().max(500).optional(),
});

export const adminRegenerateTemplatePageText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RegenTextInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tpl } = await supabaseAdmin
      .from("story_templates")
      .select("pages, title, summary, language")
      .eq("id", data.templateId)
      .single();
    if (!tpl) throw new Error("القالب غير موجود");
    const pages = parsePages(tpl.pages);
    const page = pages.find((p) => p.n === data.pageNumber);
    if (!page) throw new Error("الصفحة غير موجودة");
    const language = (tpl.language as string) ?? "ar";

    const shape =
      language === "bilingual"
        ? `{"title_ar":"...","title_en":"...","text_ar":"...","text_en":"..."}`
        : language === "en"
          ? `{"title":"...","text":"..."}`
          : `{"title":"...","text":"..."}`;
    const langRule =
      language === "ar"
        ? "اكتب بالعربية الفصحى البسيطة المناسبة للأطفال."
        : language === "en"
          ? "Write in simple kid-friendly English."
          : "Provide BOTH Arabic and English with matching meaning.";

    const sys = `أنت كاتب محتوى أطفال محترف. أعد كتابة نص صفحة واحدة فقط من قصة/كتاب أطفال.
- ${langRule}
- استخدم {child} ككلمة بديلة لاسم الطفل البطل.
- جملتان إلى ثلاث جمل، عنوان قصير 2-4 كلمات.
- حافظ على نفس فكرة المشهد الأصلي.
أعد JSON صالح فقط بهذا الشكل: ${shape}`;
    const usr = `عنوان القالب: ${tpl.title}
ملخص: ${tpl.summary ?? ""}
رقم الصفحة: ${page.n} من ${pages.length}
المشهد البصري: ${page.scene}
النص الحالي: ${page.text ?? page.text_ar ?? ""}
${data.instruction ? `تعليمات إضافية: ${data.instruction}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: usr },
        ],
      }),
    });
    if (res.status === 429) throw new Error("الخدمة مشغولة، حاول لاحقاً");
    if (res.status === 402) throw new Error("نفد رصيد Lovable AI");
    if (!res.ok) throw new Error("تعذر توليد النص");
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = j.choices?.[0]?.message?.content ?? "";
    const cleaned = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const s = cleaned.indexOf("{"),
      e = cleaned.lastIndexOf("}");
    if (s < 0 || e < 0) throw new Error("الرد غير صالح");
    const parsed = JSON.parse(cleaned.slice(s, e + 1)) as Record<string, string>;

    const updated = pages.map((p) =>
      p.n === data.pageNumber
        ? {
            ...p,
            ...(parsed.title !== undefined ? { title: parsed.title } : {}),
            ...(parsed.text !== undefined ? { text: parsed.text } : {}),
            ...(parsed.title_ar !== undefined ? { title_ar: parsed.title_ar } : {}),
            ...(parsed.title_en !== undefined ? { title_en: parsed.title_en } : {}),
            ...(parsed.text_ar !== undefined ? { text_ar: parsed.text_ar } : {}),
            ...(parsed.text_en !== undefined ? { text_en: parsed.text_en } : {}),
          }
        : p,
    );
    await supabaseAdmin
      .from("story_templates")
      .update({ pages: updated as unknown as never })
      .eq("id", data.templateId);

    return { page: updated.find((p) => p.n === data.pageNumber) };
  });

// ============================================================
// نشر / إلغاء نشر / حذف القوالب من لوحة الأدمن
// ============================================================

const SetPublishedInput = z.object({
  templateId: z.string().uuid(),
  published: z.boolean(),
});

export const adminSetTemplatePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SetPublishedInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { is_published: data.published };
    if (data.published) {
      // اعتماد إداري ضمني عند النشر اليدوي
      patch.admin_approved_at = new Date().toISOString();
      patch.admin_approved_by = context.userId;
    }
    const { error } = await supabaseAdmin
      .from("story_templates")
      .update(patch as never)
      .eq("id", data.templateId);
    if (error) throw new Error("تعذر تحديث حالة النشر");
    return { ok: true, published: data.published };
  });

export const adminDeleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TplId.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // امنع حذف قالب مرتبط بطلبات قائمة
    const { count } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("template_id", data.templateId);
    if ((count ?? 0) > 0) {
      throw new Error("هذا القالب مرتبط بطلبات حالية — ألغِ نشره بدل حذفه");
    }

    const { error } = await supabaseAdmin
      .from("story_templates")
      .delete()
      .eq("id", data.templateId);
    if (error) throw new Error("تعذر حذف القالب");
    return { ok: true };
  });

const PublishOrderInput = z.object({ orderId: z.string().uuid() });

/**
 * [مسؤول] نشر قصة طلب عميل في مكتبة الحكايات العامة.
 * يبني صفًا جديدًا في story_templates يحفظ نسخة الطفل كاملة (الاسم + الصور المولّدة)
 * ويعتمد التصنيف/الفئة العمرية/نوع المحتوى تلقائيًا من القالب الأصلي.
 */
export const adminPublishOrderStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PublishOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select(
        "id, child_name, child_name_en, language, publish_consent, published_template_id, story_templates!template_id(id, title, summary, moral, category, age_range, content_type, language, pages, cover_url)",
      )
      .eq("id", data.orderId)
      .single();
    if (orderErr || !order) throw new Error("الطلب غير موجود");
    if (order.published_template_id) {
      throw new Error("هذه القصة منشورة بالفعل في المكتبة");
    }
    if (!order.publish_consent) {
      throw new Error("العميل لم يوافق على نشر قصته في المعرض");
    }
    const tpl = order.story_templates as {
      id: string;
      title: string;
      summary: string;
      moral: string | null;
      category: string;
      age_range: string;
      content_type: string;
      language: string;
      pages: unknown;
      cover_url: string | null;
    } | null;
    if (!tpl) throw new Error("القالب الأصلي للطلب غير موجود");

    const { data: pageRows } = await supabaseAdmin
      .from("generated_pages")
      .select("page_number, image_path, page_text")
      .eq("order_id", data.orderId)
      .order("page_number");
    if (!pageRows || pageRows.length === 0) {
      throw new Error("لا توجد صفحات مولدة لهذا الطلب — أكمل التوليد أولاً");
    }

    const originalPages = parsePages(tpl.pages);
    const childName = order.child_name;
    const childNameEn =
      (order as { child_name_en?: string | null }).child_name_en?.trim() || childName;

    const mergedPages: StoryPage[] = originalPages.map((op) => {
      const gen = pageRows.find((r) => r.page_number === op.n);
      return {
        n: op.n,
        title: op.title,
        title_ar: op.title_ar,
        title_en: op.title_en,
        text: gen?.page_text ?? personalize(op.text ?? "", childName),
        text_ar: op.text_ar ? personalize(op.text_ar, childName) : undefined,
        text_en: op.text_en ? personalize(op.text_en, childNameEn) : undefined,
        scene: op.scene,
        image_title_en: op.image_title_en,
        image_path: gen?.image_path ?? op.image_path ?? null,
      };
    });

    let coverUrl: string | null = tpl.cover_url ?? null;
    const firstImagePath = pageRows.find((r) => !!r.image_path)?.image_path;
    if (firstImagePath) {
      const { data: signed } = await supabaseAdmin.storage
        .from("story-pages")
        .createSignedUrl(firstImagePath, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) coverUrl = signed.signedUrl;
    }

    const personalizedTitle = personalize(tpl.title ?? "", childName);
    const slug = `order-${data.orderId.slice(0, 8)}`;
    const now = new Date().toISOString();

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("story_templates")
      .insert({
        slug,
        title: personalizedTitle,
        summary: tpl.summary,
        category: tpl.category,
        moral: tpl.moral ?? "",
        age_range: tpl.age_range,
        content_type: tpl.content_type,
        language: (order.language as string | null) ?? tpl.language,
        pages: mergedPages as unknown as object,
        cover_url: coverUrl,
        is_published: true,
        is_custom: true,
        source_template_id: tpl.id,
        approved_at: now,
        admin_approved_at: now,
        admin_approved_by: context.userId,
      } as never)
      .select("id, slug")
      .single();
    if (insertErr || !inserted) {
      console.error("publish insert error", insertErr);
      throw new Error("تعذر نشر القصة في المكتبة");
    }

    await supabaseAdmin
      .from("orders")
      .update({
        published_to_library_at: now,
        published_template_id: (inserted as { id: string }).id,
      } as never)
      .eq("id", data.orderId);

    return { ok: true, slug: (inserted as { slug: string }).slug };
  });

/** [مسؤول] إلغاء نشر قصة طلب من المكتبة (يحذف صف القالب المنشور) */
export const adminUnpublishOrderStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PublishOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("published_template_id")
      .eq("id", data.orderId)
      .single();
    const publishedId = (order as { published_template_id: string | null } | null)
      ?.published_template_id;
    if (publishedId) {
      await supabaseAdmin.from("story_templates").delete().eq("id", publishedId);
    }
    await supabaseAdmin
      .from("orders")
      .update({ published_to_library_at: null, published_template_id: null } as never)
      .eq("id", data.orderId);
    return { ok: true };
  });
