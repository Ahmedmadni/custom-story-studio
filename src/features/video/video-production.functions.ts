import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  activeVideoJobStatuses,
  canRetryJob,
  operationKey,
  videoStoryboardSchema,
} from "@/features/video/video-production-core";

type Admin = SupabaseClient<Database>;
type Context = {
  userId: string;
  supabase: {
    rpc: (
      name: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: boolean | null; error: unknown }>;
  };
};
type Job = Database["public"]["Tables"]["video_jobs"]["Row"];

function jsonObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

const projectInput = z.object({ projectId: z.string().uuid() }).strict();
const sceneInput = z.object({ sceneId: z.string().uuid() }).strict();
const jobInput = z.object({ jobId: z.string().uuid() }).strict();

async function authorize(context: Context): Promise<Admin> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("غير مصرح لك بإدارة إنتاج الفيديو");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadProject(admin: Admin, projectId: string) {
  const { data, error } = await admin
    .from("video_projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (error || !data) throw new Error("مشروع الفيديو غير موجود");
  return data;
}

async function acquireJob(
  admin: Admin,
  input: {
    projectId: string;
    sceneId?: string;
    jobType: "reference_image" | "script" | "scene_clip";
    provider: string;
  },
) {
  const key = operationKey(input.jobType, input.projectId, input.sceneId);
  const { data, error } = await admin
    .from("video_jobs")
    .insert({
      project_id: input.projectId,
      scene_id: input.sceneId ?? null,
      job_type: input.jobType,
      provider: input.provider,
      idempotency_key: key,
      status: "queued",
      request_meta: {},
      response_meta: {},
    })
    .select("*")
    .single();
  if (!error && data) return { job: data, acquired: true };
  if (error?.code !== "23505") throw new Error("تعذر إنشاء مهمة الإنتاج");
  const { data: existing } = await admin
    .from("video_jobs")
    .select("*")
    .eq("idempotency_key", key)
    .single();
  if (!existing) throw new Error("تعذر استعادة مهمة الإنتاج");
  return { job: existing, acquired: false };
}

/** Re-queue a previously failed job so the same action can simply run again. */
async function requeueJob(admin: Admin, job: Job): Promise<Job | null> {
  const { getVideoProviderConfig } = await import("@/features/video/provider-config.server");
  if (!canRetryJob(job.status, job.attempt_count, getVideoProviderConfig().maxAttempts))
    return null;
  const oldMeta = jsonObject(job.response_meta);
  const oldErrors = Array.isArray(oldMeta.previous_errors) ? oldMeta.previous_errors : [];
  const responseMeta = job.last_error
    ? {
        ...oldMeta,
        previous_errors: [
          ...oldErrors,
          {
            attempt: job.attempt_count,
            error: job.last_error,
            recorded_at: new Date().toISOString(),
          },
        ],
      }
    : oldMeta;
  const { data: queued } = await admin
    .from("video_jobs")
    .update({
      status: "queued",
      finished_at: null,
      next_retry_at: null,
      response_meta: responseMeta as Json,
    })
    .eq("id", job.id)
    .eq("status", job.status)
    .select("*")
    .maybeSingle();
  return queued ?? null;
}

async function beginAttempt(admin: Admin, job: Job) {
  const { getVideoProviderConfig } = await import("@/features/video/provider-config.server");
  const max = getVideoProviderConfig().maxAttempts;
  if (
    activeVideoJobStatuses.includes(job.status as (typeof activeVideoJobStatuses)[number]) &&
    job.status !== "queued"
  )
    return null;
  if (job.attempt_count >= max) {
    await admin
      .from("video_jobs")
      .update({ status: "dead_letter", finished_at: new Date().toISOString() })
      .eq("id", job.id);
    throw new Error("بلغت المهمة الحد الأقصى للمحاولات");
  }
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("video_jobs")
    .update({
      status: "running",
      attempt_count: job.attempt_count + 1,
      started_at: now,
      finished_at: null,
      next_retry_at: null,
      provider_job_id: null,
    })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (error) throw new Error("تعذر بدء مهمة الإنتاج");
  return data;
}

async function failJob(admin: Admin, job: Job, error: unknown) {
  const { getVideoProviderConfig } = await import("@/features/video/provider-config.server");
  const { getProviderFailureDiagnostic } =
    await import("@/features/video/provider-diagnostics.server");
  const message = error instanceof Error ? error.message.slice(0, 500) : "فشلت مهمة الإنتاج";
  const status =
    job.attempt_count >= getVideoProviderConfig().maxAttempts ? "dead_letter" : "failed";
  const diagnostic = getProviderFailureDiagnostic(error);
  const currentMeta =
    job.response_meta && typeof job.response_meta === "object" && !Array.isArray(job.response_meta)
      ? (job.response_meta as Record<string, Json | undefined>)
      : {};
  const previousDiagnostics = Array.isArray(currentMeta.provider_error_history)
    ? currentMeta.provider_error_history
    : [];
  const responseMeta = diagnostic
    ? {
        ...currentMeta,
        ...(currentMeta.provider_error
          ? {
              provider_error_history: [...previousDiagnostics, currentMeta.provider_error].slice(
                -10,
              ),
            }
          : {}),
        provider_error: diagnostic,
      }
    : currentMeta;
  if (diagnostic) {
    console.error(`[KidzyVideo][${diagnostic.operation}] provider failure`, diagnostic);
  }
  await admin
    .from("video_jobs")
    .update({
      status,
      last_error: message,
      response_meta: responseMeta as Json,
      finished_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  return message;
}

function referencePrompt(project: Awaited<ReturnType<typeof loadProject>>) {
  const child =
    project.child_snapshot &&
    typeof project.child_snapshot === "object" &&
    !Array.isArray(project.child_snapshot)
      ? (project.child_snapshot as Record<string, unknown>)
      : {};
  const source =
    project.source_snapshot &&
    typeof project.source_snapshot === "object" &&
    !Array.isArray(project.source_snapshot)
      ? (project.source_snapshot as Record<string, unknown>)
      : {};
  return `Create one child-safe, polished 3D animated character reference image for consistent short-video production. Preserve the real child's recognizable facial features, skin tone, hair, age and gender from the source photo. Full body, neutral readable pose, clean cinematic lighting, no text, no watermark. Child: ${String(child.name ?? "child")}, age ${String(child.age ?? "unknown")}, gender ${String(child.gender ?? "unknown")}. Story: ${String(source.title ?? project.title)}; context: ${String(source.summary ?? "")}. Aspect ratio ${project.aspect_ratio}. Admin direction: ${project.reference_image_prompt ?? "Create a faithful, warm Kidzy hero reference."}`;
}

async function runReference(admin: Admin, original: Job) {
  const job = await beginAttempt(admin, original);
  if (!job) return original;
  try {
    const project = await loadProject(admin, job.project_id);
    if (
      !["image_generation", "image_review"].includes(project.production_stage ?? "") ||
      !["approved", "processing"].includes(project.status)
    )
      throw new Error("مرحلة المشروع لا تسمح بتوليد الصورة");
    const child =
      project.child_snapshot &&
      typeof project.child_snapshot === "object" &&
      !Array.isArray(project.child_snapshot)
        ? (project.child_snapshot as Record<string, unknown>)
        : {};
    const photoPath = typeof child.photo_path === "string" ? child.photo_path : null;
    if (!photoPath) throw new Error("مسار صورة الطفل غير موجود في بيانات المشروع");
    const { data: source, error: downloadError } = await admin.storage
      .from("child-photos")
      .download(photoPath);
    if (downloadError || !source) throw new Error("تعذر قراءة صورة الطفل الخاصة");
    const { referenceImageProvider } = await import("@/features/video/providers.server");
    const asset = await referenceImageProvider().generate({
      prompt: referencePrompt(project),
      sourceImage: source,
    });
    const extension = asset.contentType.includes("jpeg") ? "jpg" : "png";
    const path = `projects/${project.id}/reference/${job.id}-${job.attempt_count}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from("video-assets")
      .upload(path, asset.bytes, { contentType: asset.contentType, upsert: false });
    if (uploadError) throw new Error("تعذر حفظ الصورة المرجعية الخاصة");
    const now = new Date().toISOString();
    const { error: projectError } = await admin
      .from("video_projects")
      .update({
        reference_image_path: path,
        reference_image_meta: asset.metadata as Json,
        production_stage: "image_review",
        status: "processing",
        image_approved_at: null,
        image_approved_by: null,
        script_approved_at: null,
        script_approved_by: null,
        quality_approved_at: null,
        quality_approved_by: null,
      })
      .eq("id", project.id);
    if (projectError) throw new Error("تعذر ربط الصورة المرجعية بالمشروع");
    await admin
      .from("video_jobs")
      .update({
        status: "succeeded",
        response_meta: { ...jsonObject(job.response_meta), ...asset.metadata } as Json,
        finished_at: now,
      })
      .eq("id", job.id);
    return { ...job, status: "succeeded" as const };
  } catch (error) {
    const { getProviderFailureDiagnostic } =
      await import("@/features/video/provider-diagnostics.server");
    const isProviderFailure = Boolean(getProviderFailureDiagnostic(error));
    const message = await failJob(admin, job, error);
    if (isProviderFailure) {
      const { getVideoProviderConfig } = await import("@/features/video/provider-config.server");
      return {
        ...job,
        status:
          job.attempt_count >= getVideoProviderConfig().maxAttempts
            ? ("dead_letter" as const)
            : ("failed" as const),
        recoverableError: message,
      };
    }
    throw new Error(message);
  }
}

function scriptPrompts(project: Awaited<ReturnType<typeof loadProject>>) {
  const snapshot =
    project.child_snapshot &&
    typeof project.child_snapshot === "object" &&
    !Array.isArray(project.child_snapshot)
      ? (project.child_snapshot as Record<string, unknown>)
      : {};
  const child = JSON.stringify({
    name: snapshot.name,
    age: snapshot.age,
    gender: snapshot.gender,
    nickname: snapshot.nickname,
    favorite_color: snapshot.favorite_color,
    favorite_character: snapshot.favorite_character,
    hobbies: snapshot.hobbies,
    personality_traits: snapshot.personality_traits,
  });
  const source = JSON.stringify(project.source_snapshot);
  return {
    systemPrompt: `You are Kidzy's senior children's animation writer. Return JSON only. Adapt the source into a clear four-beat arc: opening, development, climax, resolution. Keep one consistent child hero, outfit and visual identity. Each scene must advance the story with one readable action and must not repeat the previous scene. Total duration must be at most 60 seconds; prefer 4-8 clips of 6-10 seconds. Narration must actually fit the assigned duration: target roughly 1.7 words/second for Arabic, 2.1 for English, and keep bilingual narration especially concise. Schema: {"title":string,"narration":string,"scenes":[{"sequence":integer starting at 1,"title":string,"duration_seconds":integer,"narration":string,"visual_prompt":string,"motion_prompt":string}]}. No markdown.`,
    userPrompt: `Language: ${project.language}. Aspect ratio: ${project.aspect_ratio}. Project title: ${project.title}. Child snapshot: ${child}. Story source: ${source}. Reference image is approved and must define the same hero in every scene. Produce 4-8 concise scenes suitable for image-to-video generation.`,
  };
}

async function runScript(admin: Admin, original: Job) {
  const job = await beginAttempt(admin, original);
  if (!job) return original;
  try {
    const project = await loadProject(admin, job.project_id);
    if (
      !["script_generation", "script_review"].includes(project.production_stage ?? "") ||
      !project.image_approved_at ||
      !project.reference_image_path
    )
      throw new Error("اعتماد الصورة ومرحلة توليد النص مطلوبان");
    const { scriptProvider } = await import("@/features/video/providers.server");
    const parsed = videoStoryboardSchema.parse(
      await scriptProvider().generate(scriptPrompts(project)),
    );
    const { reconcileVideoStoryboardScenes } =
      await import("@/features/video/video-scene-reconciliation.server");
    await reconcileVideoStoryboardScenes(admin, project.id, parsed);
    const { error } = await admin
      .from("video_projects")
      .update({
        script: parsed as Json,
        production_stage: "script_review",
        script_approved_at: null,
        script_approved_by: null,
        quality_approved_at: null,
        quality_approved_by: null,
      })
      .eq("id", project.id);
    if (error) throw new Error("تعذر حفظ السيناريو المولد");
    await admin
      .from("video_jobs")
      .update({
        status: "succeeded",
        response_meta: {
          ...jsonObject(job.response_meta),
          scene_count: parsed.scenes.length,
          duration_ms: parsed.scenes.reduce(
            (sum, scene) => sum + scene.duration_seconds * 1_000,
            0,
          ),
        },
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { ...job, status: "succeeded" as const };
  } catch (error) {
    const message = await failJob(admin, job, error);
    throw new Error(message);
  }
}

async function submitScene(admin: Admin, original: Job) {
  const job = await beginAttempt(admin, original);
  if (!job) return original;
  try {
    if (!job.scene_id) throw new Error("المهمة غير مرتبطة بمشهد");
    const project = await loadProject(admin, job.project_id);
    const { data: scene } = await admin
      .from("video_scenes")
      .select("*")
      .eq("id", job.scene_id)
      .eq("project_id", project.id)
      .single();
    if (
      !scene ||
      project.production_stage !== "video_generation" ||
      !project.image_approved_at ||
      !project.script_approved_at ||
      !project.reference_image_path
    )
      throw new Error("المشروع أو المشهد غير جاهز لتوليد المقطع");
    if (!scene.visual_prompt) throw new Error("الوصف البصري للمشهد مطلوب");
    const { data: projectScenes, error: durationError } = await admin
      .from("video_scenes")
      .select("duration_ms")
      .eq("project_id", project.id);
    if (durationError) throw new Error("تعذر التحقق من مدة الفيديو");
    if ((projectScenes ?? []).reduce((sum, item) => sum + item.duration_ms, 0) > 60_000)
      throw new Error("إجمالي مدة الفيديو يتجاوز 60 ثانية");
    const { data: signed } = await admin.storage
      .from("video-assets")
      .createSignedUrl(project.reference_image_path, 900);
    if (!signed?.signedUrl) throw new Error("تعذر إنشاء رابط مؤقت للصورة المرجعية");
    const meta =
      scene.selected_asset_meta &&
      typeof scene.selected_asset_meta === "object" &&
      !Array.isArray(scene.selected_asset_meta)
        ? (scene.selected_asset_meta as Record<string, unknown>)
        : {};
    const prompt = `${scene.visual_prompt}\nMotion: ${String(meta.motion_prompt ?? "gentle cinematic movement")}. Preserve the exact approved child character and child-safe Kidzy visual style.`;
    const { videoSceneProvider } = await import("@/features/video/providers.server");
    const submitted = await videoSceneProvider().submit({
      prompt,
      referenceImageUrl: signed.signedUrl,
      aspectRatio: project.aspect_ratio,
      durationSeconds: Math.ceil(scene.duration_ms / 1_000),
    });
    await admin
      .from("video_jobs")
      .update({
        provider_job_id: submitted.providerJobId,
        request_meta: { ...submitted.metadata, duration_ms: scene.duration_ms } as Json,
      })
      .eq("id", job.id);
    await admin
      .from("video_scenes")
      .update({
        status: "generating",
        approved_at: null,
        approved_by: null,
        attempt_count: scene.attempt_count + 1,
      })
      .eq("id", scene.id);
    await admin
      .from("video_projects")
      .update({ quality_approved_at: null, quality_approved_by: null })
      .eq("id", project.id);
    return { ...job, provider_job_id: submitted.providerJobId };
  } catch (error) {
    const message = await failJob(admin, job, error);
    if (job.scene_id)
      await admin.from("video_scenes").update({ status: "failed" }).eq("id", job.scene_id);
    throw new Error(message);
  }
}

async function persistRemoteClip(
  admin: Admin,
  job: Job,
  url: string,
  metadata: Record<string, unknown>,
) {
  if (!job.scene_id || !url.startsWith("https://")) throw new Error("نتيجة مزود الفيديو غير صالحة");
  const response = await fetch(url);
  if (!response.ok) throw new Error("تعذر تنزيل نتيجة مزود الفيديو");
  const { getVideoProviderConfig } = await import("@/features/video/provider-config.server");
  const max = getVideoProviderConfig().maxAssetBytes;
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > max) throw new Error("حجم مقطع المزود يتجاوز الحد المسموح");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > max) throw new Error("حجم مقطع المزود يتجاوز الحد المسموح");
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "video/mp4";
  if (!contentType.startsWith("video/")) throw new Error("مزود الفيديو لم يُرجع ملف فيديو");
  const extension = contentType.includes("webm") ? "webm" : "mp4";
  const path = `projects/${job.project_id}/scenes/${job.scene_id}/${job.id}-${job.attempt_count}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from("video-assets")
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadError) throw new Error("تعذر حفظ مقطع الفيديو الخاص");
  const now = new Date().toISOString();
  const { error: sceneError } = await admin
    .from("video_scenes")
    .update({ clip_path: path, status: "review", approved_at: null, approved_by: null })
    .eq("id", job.scene_id);
  if (sceneError) throw new Error("تعذر ربط المقطع بالمشهد");
  await admin
    .from("video_jobs")
    .update({
      status: "succeeded",
      response_meta: { ...jsonObject(job.response_meta), ...metadata } as Json,
      finished_at: now,
    })
    .eq("id", job.id);
}

async function pollSceneJob(admin: Admin, job: Job) {
  if (!job.provider_job_id || job.status !== "running") return;
  try {
    const { videoSceneProvider } = await import("@/features/video/providers.server");
    const result = await videoSceneProvider().poll(job.provider_job_id);
    if (result.status === "running") return;
    if (result.status === "failed") throw new Error(result.error);
    await persistRemoteClip(admin, job, result.assetUrl, result.metadata);
  } catch (error) {
    await failJob(admin, job, error);
    if (job.scene_id)
      await admin.from("video_scenes").update({ status: "failed" }).eq("id", job.scene_id);
  }
}

export const generateVideoReferenceImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as Context);
    const { getVideoProviderConfig } = await import("@/features/video/provider-config.server");
    const providerConfig = getVideoProviderConfig();
    const referenceProvider = providerConfig.reference.lovable.apiKey
      ? "lovable"
      : providerConfig.reference.gemini.apiKey
        ? "gemini"
        : null;
    if (!referenceProvider) {
      throw new Error("توليد الصورة المرجعية غير مفعّل حالياً");
    }
    const acquired = await acquireJob(admin, {
      projectId: data.projectId,
      jobType: "reference_image",
      provider: referenceProvider,
    });
    let target = acquired.job;
    if (!acquired.acquired) {
      if (activeVideoJobStatuses.includes(acquired.job.status as never))
        return { ok: true as const, jobId: acquired.job.id, status: acquired.job.status };
      const requeued = await requeueJob(admin, acquired.job);
      if (!requeued)
        return {
          ok: false as const,
          jobId: acquired.job.id,
          status: "dead_letter" as const,
          error:
            "بلغت المهمة الحد الأقصى للمحاولات. استخدم الرفع اليدوي أو أعد تفعيل المزود لاحقاً.",
        };
      target = requeued;
    }
    const job = await runReference(admin, target);
    return "recoverableError" in job
      ? { ok: false as const, jobId: job.id, status: job.status, error: job.recoverableError }
      : { ok: true as const, jobId: job.id, status: job.status };
  });

export const generateVideoScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as Context);
    const { getVideoProviderConfig } = await import("@/features/video/provider-config.server");
    if (!getVideoProviderConfig().script.apiKey) {
      throw new Error("توليد السيناريو بالذكاء الاصطناعي غير مفعّل حالياً");
    }
    const acquired = await acquireJob(admin, {
      projectId: data.projectId,
      jobType: "script",
      provider: "lovable",
    });
    let target = acquired.job;
    if (!acquired.acquired) {
      if (activeVideoJobStatuses.includes(acquired.job.status as never))
        return { ok: true as const, jobId: acquired.job.id, status: acquired.job.status };
      const requeued = await requeueJob(admin, acquired.job);
      if (!requeued)
        return {
          ok: false as const,
          jobId: acquired.job.id,
          status: "dead_letter" as const,
          error:
            "بلغت المهمة الحد الأقصى للمحاولات. استخدم الإدخال اليدوي أو أعد تفعيل المزود لاحقاً.",
        };
      target = requeued;
    }
    const job = await runScript(admin, target);
    return { ok: true as const, jobId: job.id, status: job.status };
  });

export const generateVideoScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sceneInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as Context);
    const { getVideoProviderConfig } = await import("@/features/video/provider-config.server");
    const providerConfig = getVideoProviderConfig();
    if (!providerConfig.scene.replicate.apiKey || !providerConfig.scene.replicate.lovableKey) {
      throw new Error("توليد مشاهد الفيديو التلقائي غير مفعّل حالياً");
    }
    const { data: scene } = await admin
      .from("video_scenes")
      .select("project_id")
      .eq("id", data.sceneId)
      .single();
    if (!scene) throw new Error("المشهد غير موجود");
    const project = await loadProject(admin, scene.project_id);
    if (project.aspect_ratio === "1:1") {
      throw new Error("التوليد التلقائي لا يدعم الفيديو المربع؛ استخدم 16:9 أو 9:16");
    }
    const acquired = await acquireJob(admin, {
      projectId: scene.project_id,
      sceneId: data.sceneId,
      jobType: "scene_clip",
      provider: "replicate",
    });
    let target = acquired.job;
    if (!acquired.acquired) {
      if (activeVideoJobStatuses.includes(acquired.job.status as never))
        return { ok: true as const, jobId: acquired.job.id, status: acquired.job.status };
      const requeued = await requeueJob(admin, acquired.job);
      if (!requeued)
        return {
          ok: false as const,
          jobId: acquired.job.id,
          status: "dead_letter" as const,
          error:
            "بلغت المهمة الحد الأقصى للمحاولات. استخدم الرفع اليدوي أو أعد تفعيل المزود لاحقاً.",
        };
      target = requeued;
    }
    const job = await submitScene(admin, target);
    return { ok: true as const, jobId: job.id, status: job.status };
  });

export const refreshVideoProductionJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as Context);
    await loadProject(admin, data.projectId);
    const { data: jobs } = await admin
      .from("video_jobs")
      .select("*")
      .eq("project_id", data.projectId)
      .eq("job_type", "scene_clip")
      .eq("status", "running");
    await Promise.all((jobs ?? []).map((job) => pollSceneJob(admin, job)));
    return { checked: jobs?.length ?? 0 };
  });

export const retryVideoProductionJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => jobInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await authorize(context as unknown as Context);
    const { data: job } = await admin.from("video_jobs").select("*").eq("id", data.jobId).single();
    if (!job) throw new Error("مهمة الإنتاج غير موجودة");
    const { getVideoProviderConfig } = await import("@/features/video/provider-config.server");
    const maxAttempts = getVideoProviderConfig().maxAttempts;
    if (job.attempt_count >= maxAttempts)
      return {
        ok: false as const,
        error: "بلغت المهمة الحد الأقصى للمحاولات. استخدم الرفع اليدوي أو أعد تفعيل المزود لاحقاً.",
      };
    if (!canRetryJob(job.status, job.attempt_count, maxAttempts))
      throw new Error("لا يمكن إعادة محاولة هذه المهمة");
    const oldMeta =
      job.response_meta &&
      typeof job.response_meta === "object" &&
      !Array.isArray(job.response_meta)
        ? (job.response_meta as Record<string, Json | undefined>)
        : {};
    const oldErrors = Array.isArray(oldMeta.previous_errors) ? oldMeta.previous_errors : [];
    const responseMeta = job.last_error
      ? {
          ...oldMeta,
          previous_errors: [
            ...oldErrors,
            {
              attempt: job.attempt_count,
              error: job.last_error,
              recorded_at: new Date().toISOString(),
            },
          ],
        }
      : oldMeta;
    const { data: queued, error } = await admin
      .from("video_jobs")
      .update({
        status: "queued",
        finished_at: null,
        next_retry_at: null,
        response_meta: responseMeta as Json,
      })
      .eq("id", job.id)
      .eq("status", job.status)
      .select("*")
      .maybeSingle();
    if (error || !queued) throw new Error("بدأت محاولة أخرى بالفعل");
    if (queued.job_type === "reference_image") {
      const result = await runReference(admin, queued);
      if ("recoverableError" in result)
        return { ok: false as const, error: result.recoverableError };
    } else if (queued.job_type === "script") await runScript(admin, queued);
    else if (queued.job_type === "scene_clip") await submitScene(admin, queued);
    else throw new Error("نوع المهمة غير مدعوم في Phase 4A");
    return { ok: true as const };
  });
