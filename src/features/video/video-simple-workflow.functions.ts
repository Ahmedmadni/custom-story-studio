import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  pageTextFor,
  pageTitleFor,
  parsePages,
  personalize,
  type LanguageMode,
  type StoryPage,
} from "@/features/ai/storyTypes";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { activeVideoJobStatuses, videoStoryboardSchema } from "@/features/video/video-production-core";

const orderInput = z.object({ videoOrderId: z.string().uuid() }).strict();
const projectInput = z.object({ projectId: z.string().uuid() }).strict();

type Admin = SupabaseClient<Database>;
type AdminContext = {
  userId: string;
  supabase: {
    rpc: (
      name: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: boolean | null; error: unknown }>;
  };
};

type VideoProject = Database["public"]["Tables"]["video_projects"]["Row"];

async function authorize(context: AdminContext): Promise<Admin> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("غير مصرح لك بإدارة إنتاج الفيديو");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function receiptPathFromOptions(value: unknown): string | null {
  const options = objectValue(value);
  return typeof options.payment_receipt_path === "string" ? options.payment_receipt_path : null;
}

async function projectByOrder(admin: Admin, videoOrderId: string) {
  const { data, error } = await admin
    .from("video_projects")
    .select("*")
    .eq("video_order_id", videoOrderId)
    .single();
  if (error || !data) throw new Error("مشروع الفيديو غير موجود");
  return data;
}

async function projectById(admin: Admin, projectId: string) {
  const { data, error } = await admin.from("video_projects").select("*").eq("id", projectId).single();
  if (error || !data) throw new Error("مشروع الفيديو غير موجود");
  return data;
}

function languageMode(value: string): LanguageMode {
  return value === "en" || value === "bilingual" ? value : "ar";
}

function bounded(value: string, max: number, fallback: string) {
  const clean = value.trim();
  return (clean || fallback).slice(0, max);
}

function selectPages(pages: StoryPage[], maxScenes = 6) {
  if (pages.length <= maxScenes) return pages;
  const indexes = Array.from({ length: maxScenes }, (_, i) =>
    Math.round((i * (pages.length - 1)) / (maxScenes - 1)),
  );
  return indexes.map((index) => pages[index]).filter(Boolean);
}

async function buildStoryboard(admin: Admin, project: VideoProject) {
  if (!project.source_template_id) throw new Error("قالب القصة غير مرتبط بمشروع الفيديو");
  const { data: template, error } = await admin
    .from("story_templates")
    .select("title, summary, pages, language")
    .eq("id", project.source_template_id)
    .single();
  if (error || !template) throw new Error("تعذر قراءة القصة المختارة");

  const child = objectValue(project.child_snapshot);
  const childName = String(child.name ?? "الطفل");
  const language = languageMode(project.language || template.language || "ar");
  const sourcePages = selectPages(parsePages(template.pages));
  const sceneSource = sourcePages.length
    ? sourcePages
    : ([
        {
          n: 1,
          title: template.title,
          text: template.summary || template.title,
          scene: `A warm cinematic opening scene inspired by ${template.title}`,
        },
        {
          n: 2,
          title: "النهاية",
          text: template.summary || template.title,
          scene: `A joyful cinematic ending scene inspired by ${template.title}`,
        },
      ] as StoryPage[]);
  if (sceneSource.length === 1) {
    sceneSource.push({
      ...sceneSource[0],
      n: sceneSource[0].n + 1,
      title: "النهاية",
      scene: `${sceneSource[0].scene}. A satisfying closing moment.`,
    });
  }

  const sceneCount = Math.min(8, Math.max(2, sceneSource.length));
  const targetDuration = Math.min(10, Math.max(5, Math.floor(54 / sceneCount)));
  const scenes = sceneSource.slice(0, 8).map((page, index) => {
    const text = pageTextFor(page, language, childName).primary;
    const title = pageTitleFor(page, language).primary ?? `المشهد ${index + 1}`;
    return {
      sequence: index + 1,
      title: bounded(personalize(title, childName), 120, `المشهد ${index + 1}`),
      duration_seconds: targetDuration,
      narration: bounded(text, 1_500, `يواصل ${childName} مغامرته الممتعة.`),
      visual_prompt: bounded(
        personalize(page.scene || "", childName),
        4_000,
        `Cinematic child-safe 3D animated scene featuring ${childName}, consistent character design, warm expressive lighting.`,
      ),
      motion_prompt:
        "Gentle cinematic camera movement, natural child-safe character motion, preserve the exact same child hero and visual identity.",
    };
  });

  return videoStoryboardSchema.parse({
    title: bounded(personalize(template.title, childName), 200, project.title),
    narration: bounded(scenes.map((scene) => scene.narration).join(" "), 8_000, project.title),
    scenes,
  });
}

async function ensureInternalChildReference(
  admin: Admin,
  project: VideoProject,
  adminUserId: string,
) {
  if (project.reference_image_path && project.image_approved_at) return project.reference_image_path;
  const child = objectValue(project.child_snapshot);
  const photoPath = typeof child.photo_path === "string" ? child.photo_path : null;
  if (!photoPath) throw new Error("صورة الطفل الأصلية غير موجودة في الطلب");
  const { data: source, error: downloadError } = await admin.storage
    .from("child-photos")
    .download(photoPath);
  if (downloadError || !source) throw new Error("تعذر قراءة صورة الطفل الأصلية");
  const contentType = source.type || "image/jpeg";
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `projects/${project.id}/reference/customer-source-${crypto.randomUUID()}.${extension}`;
  const bytes = Buffer.from(await source.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("video-assets")
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadError) throw new Error("تعذر تجهيز صورة الطفل للإنتاج");
  const now = new Date().toISOString();
  const { error } = await admin
    .from("video_projects")
    .update({
      reference_image_path: path,
      reference_image_meta: {
        source: "customer_photo",
        copied_for_production: true,
        mime_type: contentType,
        size_bytes: bytes.byteLength,
      } as Json,
      image_approved_at: now,
      image_approved_by: adminUserId,
    })
    .eq("id", project.id);
  if (error) throw new Error("تعذر اعتماد صورة الطفل للإنتاج");
  return path;
}

async function prepareScenes(admin: Admin, project: VideoProject, adminUserId: string) {
  const { data: activeJobs } = await admin
    .from("video_jobs")
    .select("id")
    .eq("project_id", project.id)
    .in("status", [...activeVideoJobStatuses]);
  if (activeJobs?.length) throw new Error("انتظر انتهاء مهام الإنتاج النشطة أولاً");
  const { data: existingClips } = await admin
    .from("video_scenes")
    .select("id")
    .eq("project_id", project.id)
    .not("clip_path", "is", null)
    .limit(1);
  if (existingClips?.length) throw new Error("لا يمكن إعادة إعداد المشاهد بعد بدء إنتاج المقاطع");

  await ensureInternalChildReference(admin, project, adminUserId);
  const storyboard = await buildStoryboard(admin, project);
  const { reconcileVideoStoryboardScenes } =
    await import("@/features/video/video-scene-reconciliation.server");
  await reconcileVideoStoryboardScenes(admin, project.id, storyboard);
  const now = new Date().toISOString();
  const { error } = await admin
    .from("video_projects")
    .update({
      status: "processing",
      production_stage: "video_generation",
      production_started_at: project.production_started_at ?? now,
      script: storyboard as Json,
      script_approved_at: now,
      script_approved_by: adminUserId,
      quality_approved_at: null,
      quality_approved_by: null,
    })
    .eq("id", project.id);
  if (error) throw new Error("تعذر تجهيز نصوص ومشاهد الفيديو");
  return storyboard;
}

export const getVideoPaymentReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const { data: order } = await admin
      .from("video_orders")
      .select("user_id, order_options_snapshot")
      .eq("id", data.videoOrderId)
      .single();
    if (!order) throw new Error("طلب الفيديو غير موجود");
    const receiptPath = receiptPathFromOptions(order.order_options_snapshot);
    if (!receiptPath || !receiptPath.startsWith(`${order.user_id}/`)) return { receiptUrl: null };
    const { data: signed } = await admin.storage.from("payment-receipts").createSignedUrl(receiptPath, 900);
    return { receiptUrl: signed?.signedUrl ?? null };
  });

export const approveVideoPaymentAndPrepareScenes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectByOrder(admin, data.videoOrderId);
    const { data: order } = await admin
      .from("video_orders")
      .select("payment_status, status, user_id, order_options_snapshot, expected_delivery_at")
      .eq("id", data.videoOrderId)
      .single();
    if (!order) throw new Error("طلب الفيديو غير موجود");
    const receiptPath = receiptPathFromOptions(order.order_options_snapshot);
    if (!receiptPath || !receiptPath.startsWith(`${order.user_id}/`))
      throw new Error("يجب أن يحتوي الطلب على إيصال تحويل قبل اعتماده");

    const receiptName = receiptPath.slice(order.user_id.length + 1);
    const { data: receipts } = await admin.storage
      .from("payment-receipts")
      .list(order.user_id, { limit: 20, search: receiptName });
    if (!(receipts ?? []).some((file) => file.name === receiptName))
      throw new Error("إيصال التحويل غير موجود");

    const now = new Date().toISOString();
    if (order.payment_status !== "paid") {
      if (!["unpaid", "pending"].includes(order.payment_status))
        throw new Error("حالة الدفع الحالية لا تسمح بالاعتماد");
      const expectedDeliveryAt =
        order.expected_delivery_at ??
        new Date(Date.now() + 48 * 60 * 60 * 1_000).toISOString();
      const options = objectValue(order.order_options_snapshot);
      const { error } = await admin
        .from("video_orders")
        .update({
          payment_status: "paid",
          status: "confirmed",
          paid_at: now,
          expected_delivery_at: expectedDeliveryAt,
          order_options_snapshot: {
            ...options,
            payment_rejected_at: null,
            payment_rejection_reason: null,
          } as Json,
        })
        .eq("id", data.videoOrderId);
      if (error) throw new Error("تعذر اعتماد التحويل");
    }

    if (!["awaiting_payment", "paid", "approved", "processing"].includes(project.status))
      throw new Error("حالة مشروع الفيديو لا تسمح ببدء الإنتاج");

    const storyboard = await prepareScenes(admin, project, context.userId);
    return { ok: true as const, sceneCount: storyboard.scenes.length };
  });

export const prepareVideoScenesAutomatically = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectById(admin, data.projectId);
    const { data: order } = await admin
      .from("video_orders")
      .select("payment_status")
      .eq("id", project.video_order_id)
      .single();
    if (order?.payment_status !== "paid") throw new Error("يجب اعتماد السداد أولاً");
    const storyboard = await prepareScenes(admin, project, context.userId);
    return { ok: true as const, sceneCount: storyboard.scenes.length };
  });

export const beginVideoFinalization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectById(admin, data.projectId);
    if (project.status !== "processing" || project.production_stage !== "video_generation")
      throw new Error("المشروع ليس جاهزاً للمرحلة النهائية");
    const { data: scenes } = await admin
      .from("video_scenes")
      .select("status, clip_path")
      .eq("project_id", project.id);
    if (!scenes?.length || scenes.some((scene) => scene.status !== "approved" || !scene.clip_path))
      throw new Error("يجب اعتماد كل مشهد قبل الانتقال للدمج");
    const { error } = await admin
      .from("video_projects")
      .update({ production_stage: "quality_review", quality_approved_at: null, quality_approved_by: null })
      .eq("id", project.id);
    if (error) throw new Error("تعذر بدء المرحلة النهائية");
    return { ok: true as const };
  });

export const approveFinalVideoAndMarkReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as AdminContext);
    const project = await projectById(admin, data.projectId);
    if (project.status !== "processing" || project.production_stage !== "quality_review")
      throw new Error("المشروع ليس في مرحلة مراجعة الإصدار النهائي");
    const { data: scenes } = await admin
      .from("video_scenes")
      .select("status, clip_path")
      .eq("project_id", project.id);
    if (!scenes?.length || scenes.some((scene) => scene.status !== "approved" || !scene.clip_path))
      throw new Error("كل المشاهد يجب أن تكون معتمدة");
    const { data: render } = await admin
      .from("video_renders")
      .select("id")
      .eq("project_id", project.id)
      .eq("render_type", "final")
      .eq("is_current", true)
      .maybeSingle();
    if (!render) throw new Error("يلزم فيديو نهائي حالي قبل الإصدار");
    const now = new Date().toISOString();
    const { error } = await admin
      .from("video_projects")
      .update({
        production_stage: "final_render",
        status: "ready",
        quality_approved_at: now,
        quality_approved_by: context.userId,
        production_completed_at: now,
      })
      .eq("id", project.id);
    if (error) throw new Error("تعذر اعتماد وإصدار الفيديو");
    return { ok: true as const };
  });
