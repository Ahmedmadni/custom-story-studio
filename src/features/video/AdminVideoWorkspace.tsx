import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Film, Loader2, Receipt, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import * as api from "@/features/video/video-admin.functions";
import * as production from "@/features/video/video-production.functions";
import * as simple from "@/features/video/video-simple-workflow.functions";

const VIDEO_RECEIPT_ROLLOUT_AT = Date.parse("2026-09-07T04:54:57Z");

export function AdminVideoWorkspace({ videoOrderId }: { videoOrderId: string }) {
  const qc = useQueryClient();
  const getProject = useServerFn(api.getAdminVideoProject);
  const updatePayment = useServerFn(api.updateVideoPaymentStatus);
  const uploadSceneClip = useServerFn(api.uploadVideoSceneClip);
  const approveScene = useServerFn(api.approveVideoScene);
  const delivered = useServerFn(api.markVideoDelivered);
  const uploadFinalRender = useServerFn(api.uploadVideoFinalRender);
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
  const runRecoverable = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    run(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "تعذر تنفيذ المهمة");
        return result;
      }
      return result;
    });

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

  const upload = (
    file: File | undefined,
    action: (asset: { dataBase64: string; mimeType: string }) => Promise<unknown>,
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => toast.error("تعذر قراءة الملف");
    reader.onload = () => {
      const encoded = typeof reader.result === "string" ? reader.result.split(",")[1] : null;
      if (!encoded) return toast.error("بيانات الملف غير صالحة");
      run(() => action({ dataBase64: encoded, mimeType: file.type }));
    };
    reader.readAsDataURL(file);
  };

  const uploadFinal = (file: File | undefined) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast.error("تعذر قراءة بيانات الفيديو");
    };
    video.onloadedmetadata = () => {
      const metadata = {
        durationMs: Math.max(1, Math.round(video.duration * 1_000)),
        width: video.videoWidth,
        height: video.videoHeight,
      };
      URL.revokeObjectURL(objectUrl);
      upload(file, (asset) =>
        uploadFinalRender({ data: { projectId: project.id, ...asset, ...metadata } }),
      );
    };
    video.src = objectUrl;
  };

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
                uploadClip={(file) =>
                  upload(file, (asset) =>
                    uploadSceneClip({ data: { sceneId: scene.id, ...asset } }),
                  )
                }
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
              <Button disabled className="w-full">
                دمج المشاهد وإصدار الفيديو تلقائياً — سيتم تفعيله قبل الإطلاق
              </Button>
              <p className="text-sm text-muted-foreground">
                عند ربط مزود الدمج سيُدمج ترتيب المشاهد المعتمدة فقط، وسيُطبع شعار كيدزي فعلياً أعلى الفيديو النهائي.
              </p>
              <details className="rounded-xl bg-secondary/40 p-3">
                <summary className="cursor-pointer font-bold">
                  اختبار بدون API — رفع فيديو نهائي جاهز
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
                    هذا المسار للاختبار فقط. الملف النهائي التجاري سيحصل على شعار كيدزي أثناء عملية الدمج نفسها.
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
  uploadClip,
}: {
  scene: {
    id: string;
    scene_number: number;
    narration_text: string | null;
    visual_prompt: string | null;
    duration_ms: number;
    status: string;
    clipUrl: string | null;
  };
  busy: boolean;
  providerAvailable: boolean;
  generate: () => void;
  approve: () => void;
  uploadClip: (file: File | undefined) => void;
}) {
  const complete = scene.status === "approved" && Boolean(scene.clipUrl);
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <b className="text-lg">المشهد {scene.scene_number}</b>
          <Badge className="me-2">{scene.status}</Badge>
        </div>
        {complete && <span className="font-bold text-emerald-700">✓ معتمد</span>}
      </div>
      <p className="mt-3 leading-7">{scene.narration_text}</p>
      <p className="mt-2 rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
        {scene.visual_prompt}
      </p>
      <p className="mt-2 text-xs font-bold">المدة المستهدفة: {scene.duration_ms / 1000} ث</p>
      {scene.clipUrl && (
        <video controls src={scene.clipUrl} className="mt-3 max-h-80 w-full rounded-xl" />
      )}
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
          اختبار بدون API — رفع مقطع جاهز
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
