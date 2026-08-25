import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_VIDEO_DURATION_MS,
  videoPaymentStatusSchema,
  videoProductionStageSchema,
} from "@/features/video/contracts";

type AdminContext = {
  userId: string;
  supabase: {
    rpc: (
      name: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: boolean | null; error: unknown }>;
  };
};

async function authorize(context: AdminContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("غير مصرح لك بإدارة الفيديو");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const idInput = z.object({ videoOrderId: z.string().uuid() }).strict();
const projectInput = z.object({ projectId: z.string().uuid() }).strict();
const textField = z.string().trim().max(20_000);
const STAGES = [
  "image_generation",
  "image_review",
  "script_generation",
  "script_review",
  "video_generation",
  "quality_review",
  "final_render",
] as const;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function signed(
  admin: Awaited<ReturnType<typeof authorize>>,
  bucket: "child-photos" | "video-assets" | "video-renders",
  path: string | null,
) {
  if (!path) return null;
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, 900);
  return data?.signedUrl ?? null;
}

async function projectByOrder(admin: Awaited<ReturnType<typeof authorize>>, videoOrderId: string) {
  const { data, error } = await admin
    .from("video_projects")
    .select("*")
    .eq("video_order_id", videoOrderId)
    .single();
  if (error || !data) throw new Error("مشروع الفيديو غير موجود");
  return data;
}

async function projectById(admin: Awaited<ReturnType<typeof authorize>>, projectId: string) {
  const { data, error } = await admin
    .from("video_projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (error || !data) throw new Error("مشروع الفيديو غير موجود");
  return data;
}

async function scenesFor(admin: Awaited<ReturnType<typeof authorize>>, projectId: string) {
  const { data, error } = await admin
    .from("video_scenes")
    .select("*")
    .eq("project_id", projectId)
    .order("scene_number");
  if (error) throw new Error("تعذر تحميل المشاهد");
  return data ?? [];
}

export const listAdminVideoOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const { data, error } = await admin
      .from("video_orders")
      .select("*, video_projects(*), story_templates!source_template_id(title)")
      .order("created_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل قائمة الفيديو");
    const userIds = [...new Set((data ?? []).map((row) => row.user_id))];
    const { data: profiles } = userIds.length
      ? await admin.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
    return (data ?? []).map((order) => {
      const project = Array.isArray(order.video_projects)
        ? order.video_projects[0]
        : order.video_projects;
      const child = objectValue(order.child_input_snapshot);
      return {
        id: order.id,
        customer: names.get(order.user_id) ?? `عميل ${order.user_id.slice(0, 8)}`,
        childName: String(child.name ?? child.childName ?? "—"),
        templateTitle: order.story_templates?.title ?? project?.title ?? "—",
        createdAt: order.created_at,
        expectedDeliveryAt: order.expected_delivery_at,
        paymentStatus: order.payment_status,
        projectStatus: project?.status ?? "awaiting_payment",
        productionStage: project?.production_stage ?? null,
        deliveryStatus: order.delivery_status,
      };
    });
  });

export const getAdminVideoProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectByOrder(admin, data.videoOrderId);
    const [{ data: order }, scenes, { data: jobs }, { data: renders }] = await Promise.all([
      admin.from("video_orders").select("*").eq("id", data.videoOrderId).single(),
      scenesFor(admin, project.id),
      admin
        .from("video_jobs")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false }),
      admin
        .from("video_renders")
        .select("*")
        .eq("project_id", project.id)
        .order("version", { ascending: false }),
    ]);
    if (!order) throw new Error("طلب الفيديو غير موجود");
    const child = objectValue(order.child_input_snapshot);
    const childPhotoPath = typeof child.photo_path === "string" ? child.photo_path : null;
    return {
      order: {
        id: order.id,
        paymentStatus: order.payment_status,
        deliveryStatus: order.delivery_status,
        expectedDeliveryAt: order.expected_delivery_at,
        deliveredAt: order.delivered_at,
        createdAt: order.created_at,
        childName: String(child.name ?? child.childName ?? "—"),
      },
      project: {
        ...project,
        reference_image_path: undefined,
        referenceImageUrl: await signed(admin, "video-assets", project.reference_image_path),
      },
      childPhotoUrl: await signed(admin, "child-photos", childPhotoPath),
      scenes: await Promise.all(
        scenes.map(async (scene) => ({
          ...scene,
          selected_image_path: undefined,
          audio_path: undefined,
          clip_path: undefined,
          imageUrl: await signed(admin, "video-assets", scene.selected_image_path),
          audioUrl: await signed(admin, "video-assets", scene.audio_path),
          clipUrl: await signed(admin, "video-assets", scene.clip_path),
        })),
      ),
      jobs: jobs ?? [],
      renders: await Promise.all(
        (renders ?? []).map(async (render) => ({
          ...render,
          storage_path: undefined,
          url: await signed(admin, "video-renders", render.storage_path),
        })),
      ),
    };
  });

export const updateVideoPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    idInput.extend({ paymentStatus: videoPaymentStatusSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.paymentStatus !== "paid")
      throw new Error("الانتقال الإداري المسموح للدفع هو إلى مدفوع فقط");
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectByOrder(admin, data.videoOrderId);
    const { data: order } = await admin
      .from("video_orders")
      .select("payment_status")
      .eq("id", data.videoOrderId)
      .single();
    if (
      !order ||
      !["unpaid", "pending"].includes(order.payment_status) ||
      project.status !== "awaiting_payment"
    )
      throw new Error("انتقال حالة الدفع غير صالح");
    const now = new Date().toISOString();
    const { error } = await admin
      .from("video_orders")
      .update({ payment_status: "paid", status: "confirmed", paid_at: now })
      .eq("id", data.videoOrderId)
      .eq("payment_status", order.payment_status);
    if (error) throw new Error("تعذر تحديث الدفع");
    const { error: projectError } = await admin
      .from("video_projects")
      .update({ status: "paid" })
      .eq("id", project.id)
      .eq("status", "awaiting_payment");
    if (projectError) throw new Error("تعذر تحديث المشروع بعد الدفع");
    return { ok: true };
  });

export const approveVideoProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectById(admin, data.projectId);
    if (project.status !== "paid" || project.production_stage !== null)
      throw new Error("لا يمكن اعتماد هذا المشروع الآن");
    const { data: order } = await admin
      .from("video_orders")
      .select("payment_status")
      .eq("id", project.video_order_id)
      .single();
    if (order?.payment_status !== "paid") throw new Error("يجب تأكيد دفع الطلب أولاً");
    const { error } = await admin
      .from("video_projects")
      .update({ status: "approved", production_stage: "image_generation" })
      .eq("id", project.id)
      .eq("status", "paid");
    if (error) throw new Error("تعذر اعتماد الإنتاج");
    return { ok: true };
  });

export const updateVideoProductionStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    projectInput.extend({ stage: videoProductionStageSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectById(admin, data.projectId);
    const currentIndex = project.production_stage ? STAGES.indexOf(project.production_stage) : -1;
    if (
      currentIndex < 0 ||
      STAGES[currentIndex + 1] !== data.stage ||
      !["approved", "processing"].includes(project.status)
    )
      throw new Error("يجب اتباع ترتيب مراحل الإنتاج");
    if (data.stage === "image_review" && !project.reference_image_path)
      throw new Error("لا توجد صورة مرجعية مولدة للمراجعة");
    if (data.stage === "script_generation" && !project.image_approved_at)
      throw new Error("يجب اعتماد الصورة أولاً");
    if (data.stage === "script_review" && !project.script)
      throw new Error("لا يوجد نص مولد للمراجعة");
    if (data.stage === "video_generation" && !project.script_approved_at)
      throw new Error("يجب اعتماد النص أولاً");
    if (data.stage === "quality_review") {
      const scenes = await scenesFor(admin, project.id);
      if (!scenes.length || scenes.some((s) => s.status !== "approved" || !s.clip_path))
        throw new Error("يجب اعتماد كل المشاهد ذات المقاطع الفعلية");
    }
    if (data.stage === "final_render" && !project.quality_approved_at)
      throw new Error("يجب اعتماد الجودة أولاً");
    const updates = {
      production_stage: data.stage,
      status: "processing" as const,
      production_started_at: project.production_started_at ?? new Date().toISOString(),
    };
    const { error } = await admin
      .from("video_projects")
      .update(updates)
      .eq("id", project.id)
      .eq("production_stage", project.production_stage!);
    if (error) throw new Error("تعذر نقل مرحلة الإنتاج");
    return { ok: true };
  });

export const saveVideoReferencePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    projectInput.extend({ prompt: textField.min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectById(admin, data.projectId);
    if (!["image_generation", "image_review"].includes(project.production_stage ?? ""))
      throw new Error("لا يمكن تعديل الوصف في هذه المرحلة");
    const { error } = await admin
      .from("video_projects")
      .update({
        reference_image_prompt: data.prompt,
        image_approved_at: null,
        image_approved_by: null,
        script_approved_at: null,
        script_approved_by: null,
        quality_approved_at: null,
        quality_approved_by: null,
      })
      .eq("id", project.id);
    if (error) throw new Error("تعذر حفظ الوصف");
    const { error: sceneError } = await admin
      .from("video_scenes")
      .update({ status: "draft", approved_at: null, approved_by: null })
      .eq("project_id", project.id);
    if (sceneError) throw new Error("تعذر إبطال اعتمادات المشاهد");
    return { ok: true };
  });

export const saveVideoScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    projectInput.extend({ script: textField.min(2) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectById(admin, data.projectId);
    if (
      !["script_generation", "script_review"].includes(project.production_stage ?? "") ||
      !project.image_approved_at
    )
      throw new Error("يجب اعتماد الصورة والوصول لمرحلة النص");
    let script: unknown;
    try {
      script = JSON.parse(data.script);
    } catch {
      throw new Error("النص يجب أن يكون JSON صالحاً");
    }
    if (!script || typeof script !== "object" || Array.isArray(script))
      throw new Error("النص يجب أن يكون كائن JSON");
    const { error } = await admin
      .from("video_projects")
      .update({
        script: script as never,
        script_approved_at: null,
        script_approved_by: null,
        quality_approved_at: null,
        quality_approved_by: null,
      })
      .eq("id", project.id);
    if (error) throw new Error("تعذر حفظ النص");
    const { error: sceneError } = await admin
      .from("video_scenes")
      .update({ status: "draft", approved_at: null, approved_by: null })
      .eq("project_id", project.id);
    if (sceneError) throw new Error("تعذر إبطال اعتمادات المشاهد");
    return { ok: true };
  });

function approval(name: "image" | "script" | "quality") {
  return createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input: unknown) => projectInput.parse(input))
    .handler(async ({ data, context }) => {
      const admin = await authorize(context as unknown as AdminContext);
      const project = await projectById(admin, data.projectId);
      const now = new Date().toISOString();
      if (
        name === "image" &&
        (project.production_stage !== "image_review" || !project.reference_image_path)
      )
        throw new Error("الصورة المرجعية الفعلية مطلوبة");
      if (
        name === "script" &&
        (project.production_stage !== "script_review" ||
          !project.image_approved_at ||
          !project.script)
      )
        throw new Error("النص واعتماد الصورة مطلوبان");
      if (name === "quality") {
        if (project.production_stage !== "quality_review")
          throw new Error("المشروع ليس في مراجعة الجودة");
        const scenes = await scenesFor(admin, project.id);
        if (!scenes.length || scenes.some((s) => s.status !== "approved" || !s.clip_path))
          throw new Error("كل المقاطع يجب أن تكون مولدة ومعتمدة");
      }
      const update =
        name === "image"
          ? { image_approved_at: now, image_approved_by: context.userId }
          : name === "script"
            ? { script_approved_at: now, script_approved_by: context.userId }
            : { quality_approved_at: now, quality_approved_by: context.userId };
      const { error } = await admin.from("video_projects").update(update).eq("id", project.id);
      if (error) throw new Error("تعذر حفظ الاعتماد");
      return { ok: true };
    });
}
export const approveVideoReferenceImage = approval("image");
export const approveVideoScript = approval("script");
export const approveVideoQuality = approval("quality");

export const updateVideoScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sceneId: z.string().uuid(),
        narrationText: textField.nullable(),
        visualPrompt: textField.nullable(),
        durationMs: z.number().int().min(1).max(MAX_VIDEO_DURATION_MS),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const { data: scene } = await admin
      .from("video_scenes")
      .select("*")
      .eq("id", data.sceneId)
      .single();
    if (!scene) throw new Error("المشهد غير موجود");
    const project = await projectById(admin, scene.project_id);
    if (project.production_stage !== "video_generation")
      throw new Error("تعديل المشاهد متاح في مرحلة توليد الفيديو فقط");
    const scenes = await scenesFor(admin, project.id);
    const total = scenes.reduce(
      (sum, row) => sum + (row.id === scene.id ? data.durationMs : row.duration_ms),
      0,
    );
    if (total > MAX_VIDEO_DURATION_MS)
      throw new Error("إجمالي مدة الفيديو يجب ألا يتجاوز 60 ثانية");
    const changed =
      scene.narration_text !== data.narrationText ||
      scene.visual_prompt !== data.visualPrompt ||
      scene.duration_ms !== data.durationMs;
    const updates = {
      narration_text: data.narrationText,
      visual_prompt: data.visualPrompt,
      duration_ms: data.durationMs,
      ...(changed ? { status: "draft" as const, approved_at: null, approved_by: null } : {}),
    };
    const { error } = await admin.from("video_scenes").update(updates).eq("id", scene.id);
    if (error) throw new Error("تعذر حفظ المشهد");
    if (changed)
      await admin
        .from("video_projects")
        .update({ quality_approved_at: null, quality_approved_by: null })
        .eq("id", project.id);
    return { ok: true };
  });

export const approveVideoScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sceneId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const { data: scene } = await admin
      .from("video_scenes")
      .select("*")
      .eq("id", data.sceneId)
      .single();
    if (!scene?.clip_path || scene.status !== "review")
      throw new Error("يلزم مقطع مولد فعلي في حالة المراجعة");
    const project = await projectById(admin, scene.project_id);
    if (project.production_stage !== "video_generation")
      throw new Error("المشروع ليس في مرحلة الفيديو");
    const { error } = await admin
      .from("video_scenes")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: context.userId,
      })
      .eq("id", scene.id)
      .eq("status", "review");
    if (error) throw new Error("تعذر اعتماد المشهد");
    return { ok: true };
  });

export const markVideoProjectReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectById(admin, data.projectId);
    if (
      project.status !== "processing" ||
      project.production_stage !== "final_render" ||
      !project.quality_approved_at
    )
      throw new Error("المشروع غير جاهز للإكمال");
    const { data: render } = await admin
      .from("video_renders")
      .select("id")
      .eq("project_id", project.id)
      .eq("render_type", "final")
      .eq("is_current", true)
      .maybeSingle();
    if (!render) throw new Error("يلزم رندر نهائي فعلي وحالي");
    const { error } = await admin
      .from("video_projects")
      .update({ status: "ready", production_completed_at: new Date().toISOString() })
      .eq("id", project.id)
      .eq("status", "processing");
    if (error) throw new Error("تعذر إكمال المشروع");
    return { ok: true };
  });

export const markVideoDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectByOrder(admin, data.videoOrderId);
    if (project.status !== "ready") throw new Error("لا يمكن التسليم قبل جاهزية المشروع");
    const { data: order } = await admin
      .from("video_orders")
      .select("delivery_status")
      .eq("id", data.videoOrderId)
      .single();
    if (!order || order.delivery_status !== "pending")
      throw new Error("الطلب مسلم بالفعل أو غير صالح");
    const { error } = await admin
      .from("video_orders")
      .update({ delivery_status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", data.videoOrderId)
      .eq("delivery_status", "pending");
    if (error) throw new Error("تعذر تسجيل التسليم");
    return { ok: true };
  });
