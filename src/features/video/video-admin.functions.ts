import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  MAX_VIDEO_DURATION_MS,
  adminVideoQueueFilterSchema,
  adminVideoSceneUpdateSchema,
  videoPaymentStatusSchema,
  videoProductionStageSchema,
} from "@/features/video/contracts";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

type AuthedContext = {
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" | "user" },
    ) => PromiseLike<{ data: boolean | null }>;
  };
  userId: string;
};

type ProjectRow = Database["public"]["Tables"]["video_projects"]["Row"];
type OrderRow = Database["public"]["Tables"]["video_orders"]["Row"];
type Stage = Database["public"]["Enums"]["video_production_stage"];

const OrderIdInput = z.object({ orderId: z.string().uuid() }).strict();
const SceneIdInput = OrderIdInput.extend({ sceneId: z.string().uuid() }).strict();
const ScriptInput = OrderIdInput.extend({
  scriptText: z.string().trim().min(1).max(20_000),
}).strict();
const PromptInput = OrderIdInput.extend({ prompt: z.string().trim().min(1).max(8_000) }).strict();
const PaymentInput = OrderIdInput.extend({
  paymentStatus: videoPaymentStatusSchema.refine((value) => value === "paid" || value === "failed"),
}).strict();
const StageInput = OrderIdInput.extend({ stage: videoProductionStageSchema }).strict();

async function assertAdmin(context: AuthedContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("غير مصرح لك بالوصول");
}

function objectValue(value: Json, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value) ? value[key] : undefined;
}

function textValue(value: Json, key: string, fallback = "—"): string {
  const candidate = objectValue(value, key);
  return typeof candidate === "string" && candidate.trim() ? candidate : fallback;
}

function safeStoragePath(path: string | null): string | null {
  if (!path || path.startsWith("/") || path.includes("..") || path.includes("//")) return null;
  return path;
}

async function signedUrl(
  bucket: "child-photos" | "video-assets" | "video-renders",
  path: string | null,
) {
  const safePath = safeStoragePath(path);
  if (!safePath) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(safePath, 60 * 30);
  return error ? null : data.signedUrl;
}

async function getOrderAndProject(
  orderId: string,
): Promise<{ order: OrderRow; project: ProjectRow }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("video_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("طلب الفيديو غير موجود");
  const { data: project } = await supabaseAdmin
    .from("video_projects")
    .select("*")
    .eq("video_order_id", orderId)
    .maybeSingle();
  if (!project) throw new Error("مشروع الفيديو غير موجود");
  return { order, project };
}

async function assertAllScenesApproved(projectId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: scenes } = await supabaseAdmin
    .from("video_scenes")
    .select("id, status, approved_at")
    .eq("project_id", projectId);
  if (
    !scenes?.length ||
    scenes.some((scene) => scene.status !== "approved" || !scene.approved_at)
  ) {
    throw new Error("يجب اعتماد كل المشاهد قبل المتابعة");
  }
}

async function assertRenderExists(projectId: string, finalOnly = false) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin.from("video_renders").select("id").eq("project_id", projectId);
  if (finalOnly) query = query.eq("render_type", "final").eq("is_current", true);
  const { data } = await query.limit(1);
  if (!data?.length)
    throw new Error(finalOnly ? "لا يوجد إصدار نهائي حالي" : "لا يوجد إصدار للمراجعة");
}

export const listAdminVideoOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminVideoQueueFilterSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let orderQuery = supabaseAdmin
      .from("video_orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.paymentStatus) orderQuery = orderQuery.eq("payment_status", data.paymentStatus);
    if (data.deliveryStatus) orderQuery = orderQuery.eq("delivery_status", data.deliveryStatus);
    const { data: orders, error } = await orderQuery;
    if (error) throw new Error("تعذر تحميل طابور الفيديو");
    if (!orders?.length) return [];

    const orderIds = orders.map((order) => order.id);
    let projectQuery = supabaseAdmin
      .from("video_projects")
      .select("*")
      .in("video_order_id", orderIds);
    if (data.projectStatus) projectQuery = projectQuery.eq("status", data.projectStatus);
    if (data.productionStage)
      projectQuery = projectQuery.eq("production_stage", data.productionStage);
    const { data: projects } = await projectQuery;
    const projectByOrder = new Map(
      (projects ?? []).map((project) => [project.video_order_id, project]),
    );
    const visibleOrders = orders.filter((order) => projectByOrder.has(order.id));
    const userIds = [...new Set(visibleOrders.map((order) => order.user_id))];
    const templateIds = [
      ...new Set(
        visibleOrders.flatMap((order) =>
          order.source_template_id ? [order.source_template_id] : [],
        ),
      ),
    ];
    const [{ data: profiles }, { data: templates }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, whatsapp").in("id", userIds),
      templateIds.length
        ? supabaseAdmin.from("story_templates").select("id, title").in("id", templateIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const templateById = new Map(
      (templates ?? []).map((template) => [template.id, template.title]),
    );

    return visibleOrders.map((order) => {
      const project = projectByOrder.get(order.id)!;
      const profile = profileById.get(order.user_id);
      return {
        orderId: order.id,
        customerName: profile?.display_name || "عميل كيدزي",
        customerWhatsapp: profile?.whatsapp ?? null,
        childName: textValue(order.child_input_snapshot, "name", "طفل"),
        templateTitle:
          (order.source_template_id && templateById.get(order.source_template_id)) || project.title,
        createdAt: order.created_at,
        expectedDeliveryAt: order.expected_delivery_at,
        paymentStatus: order.payment_status,
        projectStatus: project.status,
        productionStage: project.production_stage,
        deliveryStatus: order.delivery_status,
      };
    });
  });

export const getAdminVideoProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { order, project } = await getOrderAndProject(data.orderId);
    const [
      { data: scenes },
      { data: jobs },
      { data: renders },
      { data: profile },
      { data: template },
    ] = await Promise.all([
      supabaseAdmin
        .from("video_scenes")
        .select("*")
        .eq("project_id", project.id)
        .order("scene_number"),
      supabaseAdmin
        .from("video_jobs")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("video_renders")
        .select("*")
        .eq("project_id", project.id)
        .order("version", { ascending: false }),
      supabaseAdmin
        .from("profiles")
        .select("display_name, whatsapp")
        .eq("id", order.user_id)
        .maybeSingle(),
      order.source_template_id
        ? supabaseAdmin
            .from("story_templates")
            .select("title")
            .eq("id", order.source_template_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const photoPath = textValue(project.child_snapshot, "photo_path", "");
    const sceneDtos = await Promise.all(
      (scenes ?? []).map(async (scene) => ({
        id: scene.id,
        sceneNumber: scene.scene_number,
        sourcePageNumber: scene.source_page_number,
        narrationText: scene.narration_text,
        visualPrompt: scene.visual_prompt,
        durationMs: scene.duration_ms,
        status: scene.status,
        attemptCount: scene.attempt_count,
        approvedAt: scene.approved_at,
        approvedBy: scene.approved_by,
        imagePreviewUrl: await signedUrl("video-assets", scene.selected_image_path),
        audioPreviewUrl: await signedUrl("video-assets", scene.audio_path),
        clipPreviewUrl: await signedUrl("video-assets", scene.clip_path),
      })),
    );
    const renderDtos = await Promise.all(
      (renders ?? []).map(async (render) => ({
        id: render.id,
        version: render.version,
        renderType: render.render_type,
        mimeType: render.mime_type,
        durationMs: render.duration_ms,
        width: render.width,
        height: render.height,
        sizeBytes: render.size_bytes,
        isCurrent: render.is_current,
        createdAt: render.created_at,
        previewUrl: await signedUrl("video-renders", render.storage_path),
      })),
    );
    return {
      order: {
        id: order.id,
        customerName: profile?.display_name || "عميل كيدزي",
        customerWhatsapp: profile?.whatsapp ?? null,
        childName: textValue(order.child_input_snapshot, "name", "طفل"),
        childAge: objectValue(order.child_input_snapshot, "age") as number | null,
        childGender: textValue(order.child_input_snapshot, "gender"),
        childPhotoUrl: await signedUrl("child-photos", photoPath),
        templateTitle: template?.title || project.title,
        language: project.language,
        aspectRatio: project.aspect_ratio,
        priceEgp: order.price_egp,
        discountEgp: order.discount_egp,
        paymentStatus: order.payment_status,
        orderStatus: order.status,
        deliveryStatus: order.delivery_status,
        expectedDeliveryAt: order.expected_delivery_at,
        paidAt: order.paid_at,
        deliveredAt: order.delivered_at,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        productionStage: project.production_stage,
        style: project.style,
        referenceImagePrompt: project.reference_image_prompt,
        referenceImageUrl: await signedUrl("video-assets", project.reference_image_path),
        scriptText: textValue(project.script, "text", ""),
        imageApprovedAt: project.image_approved_at,
        imageApprovedBy: project.image_approved_by,
        scriptApprovedAt: project.script_approved_at,
        scriptApprovedBy: project.script_approved_by,
        qualityApprovedAt: project.quality_approved_at,
        qualityApprovedBy: project.quality_approved_by,
        productionStartedAt: project.production_started_at,
        productionCompletedAt: project.production_completed_at,
        failureCode: project.failure_code,
        failureMessage: project.failure_message,
      },
      scenes: sceneDtos,
      jobs: (jobs ?? []).map((job) => ({
        id: job.id,
        sceneId: job.scene_id,
        jobType: job.job_type,
        provider: job.provider,
        providerJobId: job.provider_job_id,
        status: job.status,
        attemptCount: job.attempt_count,
        nextRetryAt: job.next_retry_at,
        lastError: job.last_error,
        startedAt: job.started_at,
        finishedAt: job.finished_at,
        createdAt: job.created_at,
      })),
      renders: renderDtos,
    };
  });

export const updateVideoPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PaymentInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { order, project } = await getOrderAndProject(data.orderId);
    const isPaidRecovery = data.paymentStatus === "paid" && order.payment_status === "paid";
    if (!isPaidRecovery && !["unpaid", "pending", "failed"].includes(order.payment_status))
      throw new Error("لا يمكن تغيير حالة الدفع الحالية");
    if (project.status !== "awaiting_payment")
      throw new Error("بدأ المشروع بالفعل ولا يمكن تعديل الدفع من هنا");
    const now = new Date().toISOString();
    if (!isPaidRecovery) {
      const { error } = await supabaseAdmin
        .from("video_orders")
        .update({
          payment_status: data.paymentStatus,
          paid_at: data.paymentStatus === "paid" ? now : null,
        })
        .eq("id", order.id)
        .eq("payment_status", order.payment_status);
      if (error) throw new Error("تعذر تحديث حالة الدفع");
    }
    if (data.paymentStatus === "paid") {
      const { error: projectError } = await supabaseAdmin
        .from("video_projects")
        .update({ status: "paid" })
        .eq("id", project.id)
        .eq("status", "awaiting_payment");
      if (projectError) throw new Error("تم حفظ الدفع، وتعذر مزامنة المشروع؛ أعد المحاولة بأمان");
    }
    return { ok: true };
  });

export const approveVideoProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { order, project } = await getOrderAndProject(data.orderId);
    if (order.payment_status !== "paid" || project.status !== "paid")
      throw new Error("يجب تأكيد الدفع أولاً");
    const { error } = await supabaseAdmin
      .from("video_projects")
      .update({
        status: "approved",
        production_stage: "image_generation",
        production_started_at: new Date().toISOString(),
      })
      .eq("id", project.id)
      .eq("status", "paid");
    if (error) throw new Error("تعذر اعتماد بدء الإنتاج");
    return { ok: true };
  });

const NEXT_STAGE: Partial<Record<Stage, Stage>> = {
  image_generation: "image_review",
  image_review: "script_generation",
  script_generation: "script_review",
  script_review: "video_generation",
  video_generation: "quality_review",
  quality_review: "final_render",
};

export const updateVideoProductionStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StageInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { project } = await getOrderAndProject(data.orderId);
    if (!project.production_stage || NEXT_STAGE[project.production_stage] !== data.stage)
      throw new Error("انتقال مرحلة غير مسموح");
    if (project.production_stage === "image_generation" && !project.reference_image_path)
      throw new Error("يجب توفر صورة مرجعية أولاً");
    if (project.production_stage === "image_review" && !project.image_approved_at)
      throw new Error("يجب اعتماد الصورة المرجعية أولاً");
    if (project.production_stage === "script_generation" && !project.script)
      throw new Error("يجب حفظ النص أولاً");
    if (project.production_stage === "script_review" && !project.script_approved_at)
      throw new Error("يجب اعتماد النص أولاً");
    if (project.production_stage === "video_generation") {
      await assertAllScenesApproved(project.id);
      await assertRenderExists(project.id);
    }
    if (project.production_stage === "quality_review" && !project.quality_approved_at)
      throw new Error("يجب اعتماد الجودة أولاً");
    const { error } = await supabaseAdmin
      .from("video_projects")
      .update({
        production_stage: data.stage,
        status: project.status === "approved" ? "processing" : project.status,
      })
      .eq("id", project.id)
      .eq("production_stage", project.production_stage);
    if (error) throw new Error("تعذر نقل مرحلة الإنتاج");
    return { ok: true };
  });

export const saveVideoReferencePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PromptInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { project } = await getOrderAndProject(data.orderId);
    if (!["image_generation", "image_review"].includes(project.production_stage ?? ""))
      throw new Error("لا يمكن تعديل وصف الصورة في هذه المرحلة");
    const { error } = await supabaseAdmin
      .from("video_projects")
      .update({
        reference_image_prompt: data.prompt,
        image_approved_at: null,
        image_approved_by: null,
      })
      .eq("id", project.id);
    if (error) throw new Error("تعذر حفظ وصف الصورة");
    return { ok: true };
  });

export const saveVideoScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScriptInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { project } = await getOrderAndProject(data.orderId);
    if (!["script_generation", "script_review"].includes(project.production_stage ?? ""))
      throw new Error("لا يمكن تعديل النص في هذه المرحلة");
    const { error } = await supabaseAdmin
      .from("video_projects")
      .update({
        script:
          project.script && typeof project.script === "object" && !Array.isArray(project.script)
            ? { ...project.script, text: data.scriptText }
            : { text: data.scriptText },
        script_approved_at: null,
        script_approved_by: null,
      })
      .eq("id", project.id);
    if (error) throw new Error("تعذر حفظ النص");
    return { ok: true };
  });

export const approveVideoReferenceImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { project } = await getOrderAndProject(data.orderId);
    if (project.production_stage !== "image_review" || !project.reference_image_path)
      throw new Error("الصورة المرجعية غير جاهزة للاعتماد");
    const { error } = await supabaseAdmin
      .from("video_projects")
      .update({
        image_approved_at: new Date().toISOString(),
        image_approved_by: context.userId,
      })
      .eq("id", project.id)
      .eq("production_stage", "image_review");
    if (error) throw new Error("تعذر اعتماد الصورة");
    return { ok: true };
  });

export const approveVideoScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { project } = await getOrderAndProject(data.orderId);
    if (project.production_stage !== "script_review" || !project.script)
      throw new Error("النص غير جاهز للاعتماد");
    const { error } = await supabaseAdmin
      .from("video_projects")
      .update({
        script_approved_at: new Date().toISOString(),
        script_approved_by: context.userId,
      })
      .eq("id", project.id)
      .eq("production_stage", "script_review");
    if (error) throw new Error("تعذر اعتماد النص");
    return { ok: true };
  });

export const approveVideoQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { project } = await getOrderAndProject(data.orderId);
    if (project.production_stage !== "quality_review")
      throw new Error("المشروع ليس في مراجعة الجودة");
    await assertAllScenesApproved(project.id);
    await assertRenderExists(project.id);
    const { error } = await supabaseAdmin
      .from("video_projects")
      .update({
        quality_approved_at: new Date().toISOString(),
        quality_approved_by: context.userId,
      })
      .eq("id", project.id)
      .eq("production_stage", "quality_review");
    if (error) throw new Error("تعذر اعتماد الجودة");
    return { ok: true };
  });

export const updateVideoScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminVideoSceneUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { project } = await getOrderAndProject(data.orderId);
    if (project.production_stage !== "video_generation")
      throw new Error("لا يمكن تعديل المشهد في هذه المرحلة");
    const { data: scene } = await supabaseAdmin
      .from("video_scenes")
      .select("project_id")
      .eq("id", data.sceneId)
      .maybeSingle();
    if (!scene || scene.project_id !== project.id)
      throw new Error("المشهد غير موجود في هذا المشروع");
    const { data: otherScenes } = await supabaseAdmin
      .from("video_scenes")
      .select("duration_ms")
      .eq("project_id", project.id)
      .neq("id", data.sceneId);
    const totalDuration = (otherScenes ?? []).reduce(
      (sum, item) => sum + item.duration_ms,
      data.durationMs,
    );
    if (totalDuration > MAX_VIDEO_DURATION_MS)
      throw new Error("إجمالي مدة المشاهد لا يمكن أن يتجاوز 60 ثانية");
    const { error } = await supabaseAdmin
      .from("video_scenes")
      .update({
        narration_text: data.narrationText,
        visual_prompt: data.visualPrompt,
        duration_ms: data.durationMs,
        status: "draft",
        approved_at: null,
        approved_by: null,
      })
      .eq("id", data.sceneId)
      .eq("project_id", project.id);
    if (error) throw new Error("تعذر حفظ المشهد");
    return { ok: true };
  });

export const approveVideoScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SceneIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { project } = await getOrderAndProject(data.orderId);
    if (project.production_stage !== "video_generation")
      throw new Error("المشروع ليس في مرحلة إنتاج المشاهد");
    const { data: scene } = await supabaseAdmin
      .from("video_scenes")
      .select("status, clip_path")
      .eq("id", data.sceneId)
      .eq("project_id", project.id)
      .maybeSingle();
    if (!scene || scene.status !== "review" || !scene.clip_path)
      throw new Error("المشهد غير جاهز للاعتماد");
    const { error } = await supabaseAdmin
      .from("video_scenes")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: context.userId,
      })
      .eq("id", data.sceneId)
      .eq("project_id", project.id);
    if (error) throw new Error("تعذر اعتماد المشهد");
    return { ok: true };
  });

export const markVideoProjectReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { project } = await getOrderAndProject(data.orderId);
    if (
      project.status !== "processing" ||
      project.production_stage !== "final_render" ||
      !project.image_approved_at ||
      !project.script_approved_at ||
      !project.quality_approved_at
    )
      throw new Error("متطلبات الجاهزية غير مكتملة");
    await assertAllScenesApproved(project.id);
    await assertRenderExists(project.id, true);
    const { error } = await supabaseAdmin
      .from("video_projects")
      .update({ status: "ready", production_completed_at: new Date().toISOString() })
      .eq("id", project.id)
      .eq("status", "processing");
    if (error) throw new Error("تعذر تعليم المشروع كجاهز");
    return { ok: true };
  });

export const markVideoDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { order, project } = await getOrderAndProject(data.orderId);
    if (project.status !== "ready" || order.delivery_status !== "pending")
      throw new Error("لا يمكن تسليم هذا المشروع الآن");
    await assertRenderExists(project.id, true);
    const { error } = await supabaseAdmin
      .from("video_orders")
      .update({
        delivery_status: "delivered",
        delivered_at: new Date().toISOString(),
        status: "confirmed",
      })
      .eq("id", order.id)
      .eq("delivery_status", "pending");
    if (error) throw new Error("تعذر تسجيل التسليم");
    return { ok: true };
  });
