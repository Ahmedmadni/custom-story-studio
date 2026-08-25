import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isKidzyVideoEnabled } from "@/features/video/config";
import { type CustomerVideoOrderDto, videoOrderInputSchema } from "@/features/video/contracts";
import {
  CUSTOMER_VIDEO_STATUS_LABELS,
  toCustomerVideoStatus,
} from "@/features/video/customer-status";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TemplateIdInput = z.object({ templateId: z.string().uuid() }).strict();
const VideoOrderIdInput = z.object({ orderId: z.string().uuid() }).strict();

type SafeOrderRow = {
  id: string;
  user_id: string;
  payment_status: string;
  status: string;
  delivery_status: "pending" | "delivered";
  child_input_snapshot: unknown;
  expected_delivery_at: string | null;
  created_at: string;
  source_template_id: string | null;
};

function snapshotChildName(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object" || !("name" in snapshot)) return "طفلك";
  const name = (snapshot as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name : "طفلك";
}

async function toCustomerDtos(rows: SafeOrderRow[]): Promise<CustomerVideoOrderDto[]> {
  if (rows.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const orderIds = rows.map((row) => row.id);
  const templateIds = rows.flatMap((row) =>
    row.source_template_id ? [row.source_template_id] : [],
  );

  const { data: projects } = await supabaseAdmin
    .from("video_projects")
    .select("video_order_id, status")
    .in("video_order_id", orderIds);
  let templates: { id: string; title: string }[] = [];
  if (templateIds.length) {
    const { data } = await supabaseAdmin
      .from("story_templates")
      .select("id, title")
      .in("id", templateIds);
    templates = data ?? [];
  }

  const projectStatus = new Map((projects ?? []).map((row) => [row.video_order_id, row.status]));
  const templateTitles = new Map(templates.map((row) => [row.id, row.title]));

  return rows.map((row) => {
    const status = toCustomerVideoStatus({
      paymentStatus: row.payment_status,
      orderStatus: row.status,
      deliveryStatus: row.delivery_status,
      projectStatus: projectStatus.get(row.id) ?? null,
    });
    return {
      id: row.id,
      templateTitle:
        (row.source_template_id && templateTitles.get(row.source_template_id)) || "فيديو مخصص",
      childName: snapshotChildName(row.child_input_snapshot),
      createdAt: row.created_at,
      expectedDeliveryAt: row.expected_delivery_at,
      deliveryStatus: row.delivery_status,
      status,
      statusLabel: CUSTOMER_VIDEO_STATUS_LABELS[status],
      finalDeliveryAvailable: row.delivery_status === "delivered",
    };
  });
}

/** Public, customer-safe availability lookup used only by the existing story detail page. */
export const getVideoOffering = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TemplateIdInput.parse(input))
  .handler(async ({ data }) => {
    if (!isKidzyVideoEnabled()) return { available: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: offering } = await supabaseAdmin
      .from("template_product_offerings")
      .select("price_egp, story_templates!template_id(title, is_published)")
      .eq("template_id", data.templateId)
      .eq("product_type", "personalized_video")
      .eq("is_enabled", true)
      .maybeSingle();

    if (!offering?.story_templates?.is_published || offering.price_egp == null) {
      return { available: false as const };
    }
    return {
      available: true as const,
      priceEgp: offering.price_egp,
      templateTitle: offering.story_templates.title,
    };
  });

/** Atomically creates the unpaid commercial record and its awaiting-payment project. */
export const submitVideoOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => videoOrderInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!isKidzyVideoEnabled()) throw new Error("خدمة الفيديو غير متاحة حالياً");
    if (!data.childPhotoPath.startsWith(`${context.userId}/`)) {
      throw new Error("صورة الطفل غير صالحة لهذا الحساب");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: offering } = await supabaseAdmin
      .from("template_product_offerings")
      .select("price_egp, story_templates!template_id(id, is_published)")
      .eq("template_id", data.templateId)
      .eq("product_type", "personalized_video")
      .eq("is_enabled", true)
      .maybeSingle();
    if (!offering?.story_templates?.is_published || offering.price_egp == null) {
      throw new Error("الفيديو المخصص غير متاح لهذه القصة");
    }

    if (data.childId) {
      const { data: child } = await supabaseAdmin
        .from("child_profiles")
        .select("id")
        .eq("id", data.childId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!child) throw new Error("ملف الطفل غير موجود أو لا يخص هذا الحساب");
    }

    const photoName = data.childPhotoPath.slice(context.userId.length + 1);
    const { data: photoFiles } = await supabaseAdmin.storage
      .from("child-photos")
      .list(context.userId, { limit: 10, search: photoName });
    if (!(photoFiles ?? []).some((file) => file.name === photoName)) {
      throw new Error("صورة الطفل غير موجودة أو لا تخص هذا الحساب");
    }

    const { data: created, error } = await supabaseAdmin
      .rpc("create_video_order_and_project", {
        _user_id: context.userId,
        _template_id: data.templateId,
        _child_id: data.childId ?? null,
        _child_name: data.childName,
        _child_age: data.childAge ?? null,
        _child_gender: data.childGender,
        _child_photo_path: data.childPhotoPath,
        _language: data.language,
        _aspect_ratio: data.aspectRatio,
      })
      .single();
    if (error || !created) {
      console.error("submitVideoOrder RPC error", error);
      throw new Error("تعذر إنشاء طلب الفيديو، حاول مرة أخرى");
    }

    const [dto] = await toCustomerDtos([
      {
        id: created.video_order_id,
        user_id: context.userId,
        payment_status: "unpaid",
        status: "submitted",
        delivery_status: "pending",
        child_input_snapshot: { name: data.childName },
        expected_delivery_at: null,
        created_at: created.created_at,
        source_template_id: data.templateId,
      },
    ]);
    if (!dto) throw new Error("تعذر قراءة طلب الفيديو بعد إنشائه");
    return dto;
  });

export const listMyVideoOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("video_orders")
      .select(
        "id, user_id, payment_status, status, delivery_status, child_input_snapshot, expected_delivery_at, created_at, source_template_id",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل طلبات الفيديو");
    return toCustomerDtos((rows ?? []) as SafeOrderRow[]);
  });

export const getMyVideoOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VideoOrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("video_orders")
      .select(
        "id, user_id, payment_status, status, delivery_status, child_input_snapshot, expected_delivery_at, created_at, source_template_id",
      )
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("طلب الفيديو غير موجود");
    const [dto] = await toCustomerDtos([row as SafeOrderRow]);
    if (!dto) throw new Error("طلب الفيديو غير موجود");
    return dto;
  });
