import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Film, Loader2, Receipt, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as api from "@/features/video/video-admin.functions";
import { composeKidzyFinalVideo } from "@/features/video/browser-final-composer";
import * as production from "@/features/video/video-production.functions";
import * as simple from "@/features/video/video-simple-workflow.functions";
import { supabase } from "@/integrations/supabase/client";

const VIDEO_RECEIPT_ROLLOUT_AT = Date.parse("2026-09-07T04:54:57Z");

export function AdminVideoWorkspace({ videoOrderId }: { videoOrderId: string }) {
  const qc = useQueryClient();
  const getProject = useServerFn(api.getAdminVideoProject);
  const updatePayment = useServerFn(api.updateVideoPaymentStatus);
  const requestSceneClipUpload = useServerFn(api.requestVideoSceneClipUpload);
  const finalizeSceneClipUpload = useServerFn(api.finalizeVideoSceneClipUpload);
  const requestSceneAudioUpload = useServerFn(api.requestVideoSceneAudioUpload);
  const finalizeSceneAudioUpload = useServerFn(api.finalizeVideoSceneAudioUpload);
  const approveScene = useServerFn(api.approveVideoScene);
  const updateScene = useServerFn(api.updateVideoScene);
  const resetStoryboard = useServerFn(api.resetVideoStoryboard);
  const delivered = useServerFn(api.markVideoDelivered);
  const requestFinalRenderUpload = useServerFn(api.requestVideoFinalRenderUpload);
  const finalizeFinalRenderUpload = useServerFn(api.finalizeVideoFinalRenderUpload);
  const generateScene = useServerFn(production.generateVideoScene);
  const refreshJobs = useServerFn(production.refreshVideoProductionJobs);
  const retryJob = useServerFn(production.retryVideoProductionJob);
  const getReceipt = useServerFn(simple.getVideoPaymentReceipt);
  const approvePaymentAndPrepare = useServerFn(simple.approveVideoPaymentAndPrepareScenes);
  const prepareScenes = useServerFn(simple.prepareVideoScenesAutomatically);
  const beginFinalization = useServerFn(simple.beginVideoFinalization);
  const approveFinal = useServerFn(simple.approveFinalVideoAndMarkReady);

  const query = useQuery({
    queryKey: ["admin-video-project", videoOrderId],
    queryFn: () => getProject({ data: { videoOrderId } }),
    refetchInterval: 5_000,
  });
  const receiptQuery = useQuery({
    queryKey: ["admin-video-receipt", videoOrderId],
    queryFn: () => getReceipt({ data: { videoOrderId } }),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      toast.success("تم تحديث طلب الفيديو");
      void qc.invalidateQueries({ queryKey: ["admin-video-project", videoOrderId] });
      void qc.invalidateQueries({ queryKey: ["admin-video-receipt", videoOrderId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const run = (fn: () => Promise<unknown>) => mutation.mutate(fn);
  const runAsync = (fn: () => Promise<unknown>) => mutation.mutateAsync(fn);
  const runRecoverable = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    run(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "تعذر تنفيذ المهمة");
        return result;
      }
      return result;
    });

  const runningJobIds =
    query.data?.jobs
      .filter((job) => job.status === "running")
      .map((job) => job.id)
      .sort()
      .join(",") ?? "";

  useEffect(() => {
    if (!runningJobIds || !query.data?.project.id) return;
    const projectId = query.data.project.id;
    const timer = window.setInterval(() => {
      void refreshJobs({ data: { projectId } })
        .then(() =>
          qc.invalidateQueries({ queryKey: ["admin-video-project", videoOrderId] }),
        )
        .catch(() => undefined);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [qc, query.data?.project.id, refreshJobs, runningJobIds, videoOrderId]);

  if (query.isLoading) return <p>جارٍ تحميل مساحة الإنتاج…</p>;
  if (!query.data) return <p>تعذر تحميل مشروع الفيديو</p>;

  const { order, project, scenes, jobs, renders } = query.data;
  const allScenesApproved =
    scenes.length > 0 && scenes.every((scene) => scene.status === "approved" && scene.clipUrl);
  const hasAnyClip = scenes.some((scene) => Boolean(scene.clipUrl));
  const currentFinalRender = renders.find(
    (render) => render.render_type === "final" && render.is_current,
  );
  const paymentReviewed = order.paymentStatus === "paid";
  const paymentRejected = order.paymentStatus === "failed";
  const scenesPrepared = scenes.length > 0 && Boolean(project.script_approved_at);
  const receiptUrl = receiptQuery.data?.receiptUrl ?? null;
  const createdAt = Date.parse(order.createdAt);
  const legacyWithoutReceipt =
    !receiptUrl && Number.isFinite(createdAt) && createdAt < VIDEO_RECEIPT_ROLLOUT_AT;

  const approvePayment = () =>
    run(async () => {
      if (legacyWithoutReceipt) {
        await updatePayment({ data: { videoOrderId, paymentStatus: "paid" } });
        return prepareScenes({ data: { projectId: project.id } });
      }
      return approvePaymentAndPrepare({ data: { videoOrderId } });
    });

  type VideoMime = "video/mp4" | "video/webm" | "video/quicktime";

  const videoMimeFor = (file: File): VideoMime => {
    if (file.type === "video/mp4" || file.type === "video/webm" || file.type === "video/quicktime") {
      return file.type;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "webm") return "video/webm";
    if (extension === "mov") return "video/quicktime";
    if (extension === "mp4") return "video/mp4";
    throw new Error("صيغة الفيديو غير مدعومة. استخدم MP4 أو WebM أو MOV");
  };

  type AudioMime =
    | "audio/mpeg"
    | "audio/wav"
    | "audio/x-wav"
    | "audio/ogg"
    | "audio/webm"
    | "audio/mp4";

  const audioMimeFor = (file: File): AudioMime => {
    const supported: AudioMime[] = [
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
    ];
    if (supported.includes(file.type as AudioMime)) return file.type as AudioMime;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "mp3") return "audio/mpeg";
    if (extension === "wav") return "audio/wav";
    if (extension === "ogg") return "audio/ogg";
    if (extension === "webm") return "audio/webm";
    if (extension === "m4a" || extension === "mp4") return "audio/mp4";
    throw new Error("صيغة التعليق الصوتي غير مدعومة");
  };

  const uploadSceneDirect = async (sceneId: string, file: File) => {
    const mimeType = videoMimeFor(file);
    const ticket = await requestSceneClipUpload({
      data: { sceneId, mimeType, sizeBytes: file.size },
    });
    const { error } = await supabase.storage
      .from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: mimeType });
    if (error) throw new Error("تعذر رفع مقطع المشهد مباشرة إلى التخزين");
    return finalizeSceneClipUpload({
      data: {
        sceneId,
        path: ticket.path,
        mimeType,
        sizeBytes: file.size,
      },
    });
  };

  const uploadSceneAudioDirect = async (sceneId: string, file: File) => {
    const mimeType = audioMimeFor(file);
    const ticket = await requestSceneAudioUpload({
      data: { sceneId, mimeType, sizeBytes: file.size },
    });
    const { error } = await supabase.storage
      .from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: mimeType });
    if (error) throw new Error("تعذر رفع التعليق الصوتي مباشرة إلى التخزين");
    return finalizeSceneAudioUpload({
      data: {
        sceneId,
        path: ticket.path,
        mimeType,
        sizeBytes: file.size,
      },
    });
  };

  const uploadFinalDirect = async (
    file: File,
    metadata: { durationMs: number; width: number; height: number },
  ) => {
    const mimeType = videoMimeFor(file);
    const ticket = await requestFinalRenderUpload({
      data: {
        projectId: project.id,
        mimeType,
        sizeBytes: file.size,
      },
    });
    const { error } = await supabase.storage
      .from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: mimeType });
    if (error) throw new Error("تعذر رفع الفيديو النهائي مباشرة إلى التخزين");
    return finalizeFinalRenderUpload({
      data: {
        projectId: project.id,
        path: ticket.path,
        mimeType,
        sizeBytes: file.size,
        ...metadata,
      },
    });
  };

  const readVideoMetadata = (file: File) =>
    new Promise<{ durationMs: number; width: number; height: number }>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      const cleanup = () => URL.revokeObjectURL(objectUrl);
      video.preload = "metadata";
      video.onerror = () => {
        cleanup();
        reject(new Error("تعذر قراءة بيانات الفيديو"));
      };
      video.onloadedmetadata = () => {
        const metadata = {
          durationMs: Math.max(1, Math.round(video.duration * 1_000)),
          width: video.videoWidth,
          height: video.videoHeight,
        };
        cleanup();
        resolve(metadata);
      };
      video.src = objectUrl;
    });

  const uploadFinal = (file: File | undefined) => {
    if (!file) return;
    run(async () => uploadFinalDirect(file, await readVideoMetadata(file)));
  };

  const composeFinal = () =>
    run(async () => {
      const aspectRatio = project.aspect_ratio;
      if (aspectRatio !== "16:9" && aspectRatio !== "9:16") {
        throw new Error("الدمج المحلي يدعم 16:9 و9:16 فقط");
      }
      const orderedScenes = [...scenes].sort((a, b) => a.scene_number - b.scene_number);
      if (orderedScenes.some((scene) => !scene.clipUrl)) {
        throw new Error("كل المشاهد يجب أن تحتوي على مقطع فعلي قبل الدمج");
      }
      const file = await composeKidzyFinalVideo({
        scenes: orderedScenes.map((scene) => ({
          videoUrl: scene.clipUrl!,
          audioUrl: scene.audioUrl,
        })),
        aspectRatio,
      });
      const metadata = await readVideoMetadata(file);
      return uploadFinalDirect(file, metadata);
    });

  const refreshRunning = () =>
    run(async () => {
      const result = await refreshJobs({ data: { projectId: project.id } });
      return result;
    });

  return (
    <div className="space-y-5" dir="rtl">
      <div className="rounded-3xl bg-gradient-to-l from-primary/15 via-secondary/20 to-background p-5">
        <h1 className="text-2xl font-black">إنتاج فيديو «{project.title}»</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          دورة مبسطة: مراجعة التحويل ← تجهيز المشاهد تلقائياً ← إنتاج واعتماد كل مشهد ← إصدار الفيديو.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> 1. مراجعة التحويل وبدء الإنتاج
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <span>
              الطفل: <b>{order.childName}</b>
            </span>
            <span>
              الدفع: <Badge>{order.paymentStatus}</Badge>
            </span>
            <span>
              الحالة: <Badge>{project.status}</Badge>
            </span>
            <span>
              التسليم: <Badge>{order.deliveryStatus}</Badge>
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border p-3">
              <p className="mb-2 font-bold">صورة الطفل</p>
              {query.data.childPhotoUrl ? (
                <img
                  src={query.data.childPhotoUrl}
                  alt="صورة الطفل"
                  className="max-h-64 rounded-xl object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground">لا تتوفر معاينة</p>
              )}
            </div>
            <div className="rounded-2xl border p-3">
              <p className="mb-2 font-bold">إيصال التحويل</p>
              {receiptUrl ? (
                <img
                  src={receiptUrl}
                  alt="إيصال التحويل"
                  className="max-h-64 rounded-xl object-contain"
                />
              ) : legacyWithoutReceipt ? (
                <p className="text-sm font-bold text-amber-700">
                  طلب قديم قبل تفعيل رفع الإيصال. راجع السداد خارج النظام ثم اعتمده يدوياً.
                </p>
              ) : (
                <p className="text-sm font-bold text-amber-700">لا يوجد إيصال مرتبط بهذا الطلب</p>
              )}
            </div>
          </div>
          {!paymentReviewed ? (
            paymentRejected ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                تم رفض الإيصال الحالي. بانتظار أن يرفع العميل إيصالاً جديداً من صفحة «طلباتي».
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="lg"
                  disabled={mutation.isPending || (!receiptUrl && !legacyWithoutReceipt)}
                  onClick={approvePayment}
                >
                  {mutation.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                  {legacyWithoutReceipt
                    ? "اعتماد الطلب القديم وتجهيز المشاهد"
                    : "اعتماد التحويل وتجهيز المشاهد تلقائياً"}
                </Button>
                {receiptUrl && !legacyWithoutReceipt && (
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() =>
                      run(() =>
                        updatePayment({
                          data: {
                            videoOrderId,
                            paymentStatus: "failed",
                            reason: "تعذر اعتماد إيصال التحويل. يرجى رفع إيصال جديد واضح.",
                          },
                        }),
                      )
                    }
                  >
                    رفض الإيصال وطلب إيصال جديد
                  </Button>
                )}
              </div>
            )
          ) : (
            <p className="flex items-center gap-2 font-bold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> تم اعتماد التحويل وبدء الإنتاج
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> 2. النصوص والبرومبتات — تلقائياً
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!scenesPrepared ? (
            <div className="rounded-2xl bg-secondary/50 p-4 text-sm">
              بعد اعتماد التحويل تُستخرج نصوص المشاهد والوصف البصري تلقائياً من القصة المختارة؛ لا يوجد إدخال JSON أو اعتماد نص منفصل.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {scenes.map((scene) => (
                <div key={scene.id} className="rounded-2xl border p-4">
                  <b>المشهد {scene.scene_number}</b>
                  <p className="mt-2 text-sm leading-7">{scene.narration_text}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{scene.visual_prompt}</p>
                  <span className="mt-2 block text-xs font-bold">
                    {scene.duration_ms / 1000} ثوانٍ
                  </span>
                </div>
              ))}
            </div>
          )}
          {paymentReviewed && !hasAnyClip && (
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => run(() => prepareScenes({ data: { projectId: project.id } }))}
            >
              {scenesPrepared
                ? "إعادة إعداد النصوص والمشاهد تلقائياً"
                : "إعداد النصوص والمشاهد تلقائياً"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" /> 3. إنتاج واعتماد المشاهد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scenesPrepared ? (
            scenes.map((scene) => (
              <SimpleScene
                key={scene.id}
                scene={scene}
                busy={mutation.isPending}
                providerAvailable={query.data.providerAvailability.scene}
                generate={() =>
                  runRecoverable(() => generateScene({ data: { sceneId: scene.id } }))
                }
                approve={() => run(() => approveScene({ data: { sceneId: scene.id } }))}
                saveEdits={(input) =>
                  runAsync(() =>
                    updateScene({
                      data: {
                        sceneId: scene.id,
                        narrationText: input.narrationText,
                        visualPrompt: input.visualPrompt,
                        durationMs: input.durationMs,
                      },
                    }),
                  )
                }
                uploadClip={(file) => {
                  if (!file) return;
                  run(() => uploadSceneDirect(scene.id, file));
                }}
                uploadAudio={(file) => {
                  if (!file) return;
                  run(() => uploadSceneAudioDirect(scene.id, file));
                }}
              />
            ))
          ) : (
            <p className="text-muted-foreground">
              سيظهر كل مشهد هنا بعد تجهيز النصوص تلقائياً.
            </p>
          )}
          {jobs.some((job) => job.status === "running") && (
            <Button variant="outline" disabled={mutation.isPending} onClick={refreshRunning}>
              تحديث حالة التوليد
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. دمج المشاهد وإصدار الفيديو</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!allScenesApproved && (
            <p className="text-sm font-bold text-amber-700">
              اعتمد كل مشهد أولاً؛ بعدها ستفتح مرحلة الدمج النهائية.
            </p>
          )}
          {allScenesApproved && project.production_stage === "video_generation" && (
            <Button
              disabled={mutation.isPending}
              onClick={() => run(() => beginFinalization({ data: { projectId: project.id } }))}
            >
              الانتقال إلى دمج المشاهد
            </Button>
          )}

          {["quality_review", "final_render"].includes(project.production_stage ?? "") && (
            <div className="space-y-3 rounded-2xl border p-4">
              <Button
                className="w-full"
                disabled={
                  mutation.isPending ||
                  !allScenesApproved ||
                  !["16:9", "9:16"].includes(project.aspect_ratio)
                }
                onClick={composeFinal}
              >
                {mutation.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                دمج المشاهد ووضع شعار Kidzy
              </Button>
              <p className="text-sm text-muted-foreground">
                يتم الدمج محلياً داخل متصفح المشرف بدون استهلاك API، وبترتيب المشاهد المعتمدة فقط.
                شعار Kidzy يُحرق داخل بكسلات الفيديو أعلى المنتصف، ثم يُرفع الناتج مباشرة إلى التخزين الخاص.
              </p>
              {!["16:9", "9:16"].includes(project.aspect_ratio) && (
                <p className="text-sm font-bold text-amber-700">
                  هذا طلب قديم بنسبة أبعاد غير مدعومة للدمج المحلي. استخدم الرفع اليدوي النهائي لهذا الطلب فقط.
                </p>
              )}
              <details className="rounded-xl bg-secondary/40 p-3">
                <summary className="cursor-pointer font-bold">
                  بديل يدوي — رفع فيديو نهائي جاهز مباشرة
                </summary>
                <div className="mt-3 space-y-2">
                  <Input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    disabled={mutation.isPending || !allScenesApproved}
                    onChange={(event) => {
                      uploadFinal(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    استخدم هذا المسار فقط إذا أردت رفع نسخة مركبة خارج كيدزي.
                  </p>
                </div>
              </details>
            </div>
          )}

          {renders.length > 0 && (
            <div className="space-y-3">
              {renders.map((render) => (
                <div key={render.id} className="rounded-2xl border p-3">
                  <p className="font-bold">
                    النسخة {render.version} · {render.render_type}
                  </p>
                  {render.url && (
                    <video controls src={render.url} className="mt-2 max-h-96 w-full rounded-xl" />
                  )}
                </div>
              ))}
            </div>
          )}

          {project.production_stage === "quality_review" && currentFinalRender && (
            <Button
              size="lg"
              disabled={mutation.isPending}
              onClick={() => run(() => approveFinal({ data: { projectId: project.id } }))}
            >
              اعتماد وإصدار الفيديو
            </Button>
          )}
          {project.status === "ready" && (
            <div className="space-y-3">
              <p className="font-bold text-emerald-700">الفيديو جاهز للتسليم للعميل.</p>
              <Button
                size="lg"
                disabled={mutation.isPending || order.deliveryStatus === "delivered"}
                onClick={() => run(() => delivered({ data: { videoOrderId } }))}
              >
                {order.deliveryStatus === "delivered"
                  ? "تم التسليم"
                  : "تسليم الفيديو للعميل"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {paymentReviewed && scenes.length > 0 && (
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-bold text-muted-foreground">
            خيارات متقدمة للمشاهد
          </summary>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              استخدم إعادة البناء فقط إذا أردت حذف مراجع المقاطع الحالية والعودة إلى
              نصوص القصة الأصلية. لن تُحذف الملفات الخاصة من التخزين تلقائياً.
            </p>
            <Button
              variant="destructive"
              disabled={mutation.isPending || jobs.some((job) => ["queued", "running"].includes(job.status))}
              onClick={() => {
                if (
                  !window.confirm(
                    "سيتم إلغاء اعتمادات ومراجع المقاطع الحالية وإعادة بناء المشاهد. هل تريد المتابعة؟",
                  )
                )
                  return;
                run(async () => {
                  await resetStoryboard({
                    data: { projectId: project.id, confirmation: "RESET" },
                  });
                  return prepareScenes({ data: { projectId: project.id } });
                });
              }}
            >
              إعادة بناء المشاهد من القصة
            </Button>
          </div>
        </details>
      )}

      <details className="rounded-2xl border bg-card p-4">
        <summary className="cursor-pointer font-bold text-muted-foreground">
          تفاصيل تقنية ومهام التوليد
        </summary>
        <div className="mt-4 space-y-2">
          {jobs.length ? (
            jobs.map((job) => (
              <div key={job.id} className="rounded-xl border p-3 text-xs" dir="ltr">
                {job.job_type} · {job.provider} · {job.status} · attempts {job.attempt_count}
                {job.last_error ? (
                  <>
                    <br />
                    {job.last_error}
                  </>
                ) : null}
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      mutation.isPending || !["failed", "succeeded"].includes(job.status)
                    }
                    onClick={() =>
                      runRecoverable(() => retryJob({ data: { jobId: job.id } }))
                    }
                  >
                    {job.status === "succeeded" ? "إعادة التوليد" : "إعادة المحاولة"}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد مهام تقنية.</p>
          )}
        </div>
      </details>
    </div>
  );
}

function SimpleScene({
  scene,
  busy,
  providerAvailable,
  generate,
  approve,
  saveEdits,
  uploadClip,
  uploadAudio,
}: {
  scene: {
    id: string;
    scene_number: number;
    narration_text: string | null;
    visual_prompt: string | null;
    duration_ms: number;
    status: string;
    clipUrl: string | null;
    audioUrl: string | null;
  };
  busy: boolean;
  providerAvailable: boolean;
  generate: () => void;
  approve: () => void;
  saveEdits: (input: {
    narrationText: string | null;
    visualPrompt: string | null;
    durationMs: number;
  }) => Promise<unknown>;
  uploadClip: (file: File | undefined) => void;
  uploadAudio: (file: File | undefined) => void;
}) {
  const complete = scene.status === "approved" && Boolean(scene.clipUrl);
  const [narrationDraft, setNarrationDraft] = useState(scene.narration_text ?? "");
  const [promptDraft, setPromptDraft] = useState(scene.visual_prompt ?? "");
  const [durationSeconds, setDurationSeconds] = useState(
    Math.max(1, Math.round(scene.duration_ms / 1_000)),
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setNarrationDraft(scene.narration_text ?? "");
    setPromptDraft(scene.visual_prompt ?? "");
    setDurationSeconds(Math.max(1, Math.round(scene.duration_ms / 1_000)));
  }, [dirty, scene.duration_ms, scene.narration_text, scene.visual_prompt]);

  const save = () => {
    const durationMs = Math.max(1_000, Math.round(durationSeconds * 1_000));
    void saveEdits({
      narrationText: narrationDraft.trim() || null,
      visualPrompt: promptDraft.trim() || null,
      durationMs,
    })
      .then(() => setDirty(false))
      .catch(() => undefined);
  };

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <b className="text-lg">المشهد {scene.scene_number}</b>
          <Badge className="me-2">{scene.status}</Badge>
        </div>
        {complete && <span className="font-bold text-emerald-700">✓ معتمد</span>}
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <p className="mb-1 text-xs font-bold text-muted-foreground">النص السردي</p>
          <Textarea
            value={narrationDraft}
            disabled={busy}
            onChange={(event) => {
              setNarrationDraft(event.target.value);
              setDirty(true);
            }}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-bold text-muted-foreground">وصف المشهد / البرومبت</p>
          <Textarea
            value={promptDraft}
            disabled={busy}
            onChange={(event) => {
              setPromptDraft(event.target.value);
              setDirty(true);
            }}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-muted-foreground">
            المدة المستهدفة بالثواني
            <Input
              className="mt-1 w-28"
              type="number"
              min={1}
              max={60}
              value={durationSeconds}
              disabled={busy}
              onChange={(event) => {
                setDurationSeconds(Number(event.target.value) || 1);
                setDirty(true);
              }}
            />
          </label>
          <Button type="button" variant="outline" disabled={busy || !dirty} onClick={save}>
            حفظ تعديلات المشهد
          </Button>
        </div>
        {dirty && scene.clipUrl && (
          <p className="text-xs font-bold text-amber-700">
            تم تعديل وصف المشهد؛ يلزم إعادة توليد/رفع المقطع ثم اعتماده من جديد.
          </p>
        )}
      </div>
      {scene.clipUrl && (
        <video controls src={scene.clipUrl} className="mt-3 max-h-80 w-full rounded-xl" />
      )}
      <div className="mt-3 rounded-xl border border-dashed p-3">
        <p className="text-sm font-bold">التعليق الصوتي للمشهد — اختياري</p>
        <p className="mt-1 text-xs text-muted-foreground">
          إذا رفعت تعليقاً صوتياً فسيُدمج تلقائياً مع هذا المشهد في الفيديو النهائي.
        </p>
        {scene.audioUrl && (
          <audio controls src={scene.audioUrl} className="mt-2 w-full" />
        )}
        <Input
          className="mt-2"
          type="file"
          accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,.mp3,.wav,.ogg,.m4a"
          disabled={busy}
          onChange={(event) => {
            uploadAudio(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={
            busy || !providerAvailable || ["queued", "generating"].includes(scene.status)
          }
          onClick={generate}
        >
          {scene.clipUrl ? "إعادة توليد المشهد" : "توليد المشهد"}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !scene.clipUrl || scene.status !== "review"}
          onClick={approve}
        >
          اعتماد المشهد
        </Button>
      </div>
      {!providerAvailable && (
        <p className="mt-2 text-sm font-bold text-amber-700">
          توليد الفيديو التلقائي سيُفعّل عند ربط الـAPI قبل الإطلاق.
        </p>
      )}
      <details className="mt-3 rounded-xl bg-secondary/30 p-3">
        <summary className="cursor-pointer text-sm font-bold">
          اختبار بدون API — رفع مقطع جاهز مباشرة
        </summary>
        <div className="mt-3">
          <Input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            disabled={busy}
            onChange={(event) => {
              uploadClip(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </details>
    </div>
  );
}
