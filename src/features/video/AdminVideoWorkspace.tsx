import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as api from "@/features/video/video-admin.functions";
import * as production from "@/features/video/video-production.functions";

export function AdminVideoWorkspace({ videoOrderId }: { videoOrderId: string }) {
  const qc = useQueryClient();
  const getProject = useServerFn(api.getAdminVideoProject);
  const payment = useServerFn(api.updateVideoPaymentStatus);
  const approveProduction = useServerFn(api.approveVideoProduction);
  const changeStage = useServerFn(api.updateVideoProductionStage);
  const savePrompt = useServerFn(api.saveVideoReferencePrompt);
  const saveScript = useServerFn(api.saveVideoScript);
  const approveImage = useServerFn(api.approveVideoReferenceImage);
  const approveScript = useServerFn(api.approveVideoScript);
  const approveQuality = useServerFn(api.approveVideoQuality);
  const updateScene = useServerFn(api.updateVideoScene);
  const approveScene = useServerFn(api.approveVideoScene);
  const ready = useServerFn(api.markVideoProjectReady);
  const delivered = useServerFn(api.markVideoDelivered);
  const generateReference = useServerFn(production.generateVideoReferenceImage);
  const generateScript = useServerFn(production.generateVideoScript);
  const generateScene = useServerFn(production.generateVideoScene);
  const refreshJobs = useServerFn(production.refreshVideoProductionJobs);
  const retryJob = useServerFn(production.retryVideoProductionJob);
  const query = useQuery({
    queryKey: ["admin-video-project", videoOrderId],
    queryFn: () => getProject({ data: { videoOrderId } }),
    refetchInterval: 5_000,
  });
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  useEffect(() => {
    if (query.data) {
      setPrompt(query.data.project.reference_image_prompt ?? "");
      setScript(
        query.data.project.script ? JSON.stringify(query.data.project.script, null, 2) : "{}",
      );
    }
  }, [query.data]);
  useEffect(() => {
    const projectId = query.data?.project.id;
    const hasRunningScene = query.data?.jobs.some(
      (job) => job.job_type === "scene_clip" && job.status === "running",
    );
    if (!projectId || !hasRunningScene) return;
    const timer = window.setInterval(() => {
      void refreshJobs({ data: { projectId } }).then(() =>
        qc.invalidateQueries({ queryKey: ["admin-video-project", videoOrderId] }),
      );
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [query.data?.project.id, query.data?.jobs, qc, refreshJobs, videoOrderId]);
  const mutation = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      toast.success("تم الحفظ");
      void qc.invalidateQueries({ queryKey: ["admin-video-project", videoOrderId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (query.isLoading) return <p>جارٍ تحميل مساحة العمل…</p>;
  if (!query.data) return <p>تعذر تحميل المشروع</p>;
  const { order, project, scenes, jobs, renders } = query.data;
  const stageIndex = [
    "image_generation",
    "image_review",
    "script_generation",
    "script_review",
    "video_generation",
    "quality_review",
    "final_render",
  ].indexOf(project.production_stage ?? "");
  const nextStage = [
    "image_review",
    "script_generation",
    "script_review",
    "video_generation",
    "quality_review",
    "final_render",
  ][stageIndex];
  const allScenesReady =
    scenes.length > 0 && scenes.every((s) => s.status === "approved" && s.clipUrl);
  const nextStageBlockedReason =
    nextStage === "image_review" && !project.referenceImageUrl
      ? "لا توجد صورة مرجعية مولدة للمراجعة"
      : nextStage === "script_generation" && !project.image_approved_at
        ? "يجب اعتماد الصورة أولاً"
        : nextStage === "script_review" && !project.script
          ? "لا يوجد نص مولد للمراجعة"
          : nextStage === "video_generation" && !project.script_approved_at
            ? "يجب اعتماد النص أولاً"
            : nextStage === "quality_review" && !allScenesReady
              ? "يجب اعتماد كل المشاهد ذات المقاطع الفعلية"
              : nextStage === "final_render" && !project.quality_approved_at
                ? "يجب اعتماد الجودة أولاً"
                : null;
  const run = (fn: () => Promise<unknown>) => mutation.mutate(fn);
  return (
    <div className="space-y-5" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle>1. ملخص الطلب</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <span>
            الطلب: <b dir="ltr">{order.id}</b>
          </span>
          <span>
            الدفع: <Badge>{order.paymentStatus}</Badge>
          </span>
          <span>
            المشروع: <Badge>{project.status}</Badge>
          </span>
          <span>
            الإنتاج: <Badge>{project.production_stage ?? "—"}</Badge>
          </span>
          <span>
            التسليم: <Badge>{order.deliveryStatus}</Badge>
          </span>
          <span>الطفل: {order.childName}</span>
          <span>المدة: {scenes.reduce((n, s) => n + s.duration_ms, 0) / 1000} ثانية</span>
          <span>
            المتوقع:{" "}
            {order.expectedDeliveryAt
              ? new Date(order.expectedDeliveryAt).toLocaleString("ar-EG")
              : "—"}
          </span>
          <div className="md:col-span-4 flex flex-wrap gap-2">
            <Button
              disabled={mutation.isPending || !["unpaid", "pending"].includes(order.paymentStatus)}
              onClick={() => run(() => payment({ data: { videoOrderId, paymentStatus: "paid" } }))}
            >
              تأكيد الدفع
            </Button>
            <Button
              disabled={mutation.isPending || project.status !== "paid"}
              onClick={() => run(() => approveProduction({ data: { projectId: project.id } }))}
            >
              اعتماد الإنتاج
            </Button>
            {nextStage && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  title={nextStageBlockedReason ?? undefined}
                  disabled={mutation.isPending || Boolean(nextStageBlockedReason)}
                  onClick={() =>
                    run(() =>
                      changeStage({ data: { projectId: project.id, stage: nextStage as never } }),
                    )
                  }
                >
                  المرحلة التالية: {nextStage}
                </Button>
                {nextStageBlockedReason && (
                  <span className="text-xs font-bold text-amber-700">
                    {nextStageBlockedReason}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>2. مصدر الطفل / الصورة الأصلية</CardTitle>
        </CardHeader>
        <CardContent>
          {query.data.childPhotoUrl ? (
            <img
              src={query.data.childPhotoUrl}
              alt="صورة الطفل الأصلية الخاصة"
              className="max-h-72 rounded-xl object-contain"
            />
          ) : (
            <p className="text-muted-foreground">لا تتوفر معاينة موقعة</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>3. سير الصورة المرجعية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="وصف الصورة المرجعية"
          />
          <Button
            onClick={() => run(() => savePrompt({ data: { projectId: project.id, prompt } }))}
          >
            حفظ الوصف
          </Button>
          <Button
            disabled={
              mutation.isPending ||
              !["image_generation", "image_review"].includes(project.production_stage ?? "")
            }
            onClick={() => run(() => generateReference({ data: { projectId: project.id } }))}
          >
            توليد الصورة المرجعية
          </Button>
          {project.referenceImageUrl && (
            <img
              src={project.referenceImageUrl}
              alt="الصورة المرجعية"
              className="max-h-72 rounded-xl"
            />
          )}
          <Button
            disabled={!project.referenceImageUrl}
            onClick={() => run(() => approveImage({ data: { projectId: project.id } }))}
          >
            اعتماد الصورة
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>4. تحرير واعتماد النص / لوحة المشاهد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            dir="ltr"
            className="min-h-52 font-mono"
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
          <Button
            onClick={() => run(() => saveScript({ data: { projectId: project.id, script } }))}
          >
            حفظ النص
          </Button>
          <Button
            disabled={
              mutation.isPending ||
              !["script_generation", "script_review"].includes(project.production_stage ?? "") ||
              !project.image_approved_at
            }
            onClick={() => run(() => generateScript({ data: { projectId: project.id } }))}
          >
            توليد / إعادة توليد السيناريو
          </Button>
          {scenes.some((scene) => scene.clipUrl) && (
            <p className="text-xs font-bold text-amber-700">
              توجد مقاطع مولدة؛ حمايةً للأصول لن يُستبدل السيناريو أو بناء المشاهد دون إجراء إعادة
              بناء صريح في مرحلة لاحقة.
            </p>
          )}
          <Button onClick={() => run(() => approveScript({ data: { projectId: project.id } }))}>
            اعتماد النص
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>5. إدارة المشاهد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scenes.length ? (
            scenes.map((scene) => (
              <Scene
                key={scene.id}
                scene={scene}
                busy={mutation.isPending}
                save={(values) =>
                  run(() => updateScene({ data: { sceneId: scene.id, ...values } }))
                }
                approve={() => run(() => approveScene({ data: { sceneId: scene.id } }))}
                generate={() => run(() => generateScene({ data: { sceneId: scene.id } }))}
              />
            ))
          ) : (
            <p className="text-muted-foreground">لا توجد مشاهد. لن تنشئ Phase 3 مخرجات وهمية.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>6. تشخيص الوظائف (للإدارة فقط)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobs.length ? (
            jobs.map((job) => (
              <div key={job.id} className="rounded-lg border p-3 text-xs" dir="ltr">
                {job.job_type} · {job.provider} · {job.status} · attempts {job.attempt_count}
                <br />
                provider id: {job.provider_job_id ?? "—"}
                <br />
                {job.last_error ?? ""}
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending || !["failed", "succeeded"].includes(job.status)}
                    onClick={() => run(() => retryJob({ data: { jobId: job.id } }))}
                  >
                    {job.status === "succeeded" ? "إعادة التوليد" : "إعادة المحاولة"}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p>لا توجد وظائف</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>7. الرندرات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {renders.length ? (
            renders.map((render) => (
              <div key={render.id} className="rounded-lg border p-3">
                نسخة {render.version} · {render.render_type} · {render.duration_ms / 1000} ث
                {render.url && <video controls src={render.url} className="mt-2 max-h-80 w-full" />}
              </div>
            ))
          ) : (
            <p>لا توجد رندرات فعلية</p>
          )}
          <Button disabled>إنشاء الرندر — بانتظار ربط المزود</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>8. الجودة والإنهاء</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => run(() => approveQuality({ data: { projectId: project.id } }))}>
            اعتماد الجودة
          </Button>
          <Button onClick={() => run(() => ready({ data: { projectId: project.id } }))}>
            تحديد المشروع جاهزاً
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>9. التسليم</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            disabled={order.deliveryStatus === "delivered"}
            onClick={() => run(() => delivered({ data: { videoOrderId } }))}
          >
            تسجيل التسليم
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Scene({
  scene,
  busy,
  save,
  approve,
  generate,
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
  save: (value: {
    narrationText: string | null;
    visualPrompt: string | null;
    durationMs: number;
  }) => void;
  approve: () => void;
  generate: () => void;
}) {
  const [narrationText, setNarration] = useState(scene.narration_text ?? "");
  const [visualPrompt, setVisual] = useState(scene.visual_prompt ?? "");
  const [durationMs, setDuration] = useState(scene.duration_ms);
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <b>
        المشهد {scene.scene_number} · {scene.status}
      </b>
      <Textarea
        value={narrationText}
        onChange={(e) => setNarration(e.target.value)}
        placeholder="السرد"
      />
      <Textarea
        value={visualPrompt}
        onChange={(e) => setVisual(e.target.value)}
        placeholder="الوصف البصري"
      />
      <Input
        type="number"
        min={1}
        max={60000}
        value={durationMs}
        onChange={(e) => setDuration(Number(e.target.value))}
      />
      {scene.clipUrl && <video controls src={scene.clipUrl} className="max-h-60 w-full" />}
      <div className="flex gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            save({
              narrationText: narrationText || null,
              visualPrompt: visualPrompt || null,
              durationMs,
            })
          }
        >
          حفظ وإبطال الاعتماد عند التغيير
        </Button>
        <Button disabled={busy || !scene.clipUrl || scene.status !== "review"} onClick={approve}>
          اعتماد المقطع
        </Button>
        <Button
          disabled={busy || ["queued", "generating"].includes(scene.status)}
          onClick={generate}
        >
          {scene.clipUrl ? "إعادة توليد هذا المشهد" : "توليد هذا المشهد"}
        </Button>
      </div>
    </div>
  );
}
