import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Film,
  ImageIcon,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  approveVideoProduction,
  approveVideoQuality,
  approveVideoReferenceImage,
  approveVideoScene,
  approveVideoScript,
  getAdminVideoProject,
  markVideoDelivered,
  markVideoProjectReady,
  saveVideoReferencePrompt,
  saveVideoScript,
  updateVideoPaymentStatus,
  updateVideoProductionStage,
  updateVideoScene,
} from "@/features/video/video-admin.functions";
import type { VideoProductionStage } from "@/features/video/contracts";

const labels: Record<string, string> = {
  unpaid: "غير مدفوع",
  pending: "معلق",
  paid: "مدفوع",
  failed: "فاشل",
  refunded: "مسترد",
  submitted: "مقدم",
  confirmed: "مؤكد",
  awaiting_payment: "بانتظار الدفع",
  approved: "معتمد",
  processing: "قيد الإنتاج",
  ready: "جاهز",
  cancelled: "ملغي",
  image_generation: "تجهيز الصورة",
  image_review: "مراجعة الصورة",
  script_generation: "تجهيز النص",
  script_review: "مراجعة النص",
  video_generation: "إنتاج المشاهد",
  quality_review: "مراجعة الجودة",
  final_render: "الإخراج النهائي",
  delivered: "تم التسليم",
  queued: "في الطابور",
  running: "يعمل",
  succeeded: "نجح",
  dead_letter: "متوقف نهائياً",
  review: "للمراجعة",
  draft: "مسودة",
  generating: "يُنتج",
  reference_image: "صورة مرجعية",
  script: "نص",
  scene_clip: "مشهد",
  narration: "تعليق صوتي",
  compose: "تركيب",
  final: "نهائي",
  preview: "معاينة",
};
const nextStage: Partial<Record<VideoProductionStage, VideoProductionStage>> = {
  image_generation: "image_review",
  image_review: "script_generation",
  script_generation: "script_review",
  script_review: "video_generation",
  video_generation: "quality_review",
  quality_review: "final_render",
};

function SceneEditor({
  orderId,
  scene,
  refresh,
}: {
  orderId: string;
  scene: {
    id: string;
    sceneNumber: number;
    narrationText: string | null;
    visualPrompt: string | null;
    durationMs: number;
    status: string;
    attemptCount: number;
    approvedAt: string | null;
    imagePreviewUrl: string | null;
    audioPreviewUrl: string | null;
    clipPreviewUrl: string | null;
  };
  refresh: () => void;
}) {
  const [narration, setNarration] = useState(scene.narrationText ?? "");
  const [prompt, setPrompt] = useState(scene.visualPrompt ?? "");
  const [duration, setDuration] = useState(scene.durationMs);
  const updateFn = useServerFn(updateVideoScene);
  const approveFn = useServerFn(approveVideoScene);
  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          orderId,
          sceneId: scene.id,
          narrationText: narration || null,
          visualPrompt: prompt || null,
          durationMs: duration,
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ المشهد");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: () => approveFn({ data: { orderId, sceneId: scene.id } }),
    onSuccess: () => {
      toast.success("تم اعتماد المشهد");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>المشهد {scene.sceneNumber}</span>
          <span className="flex gap-2">
            <Badge>{labels[scene.status] ?? scene.status}</Badge>
            <Badge variant="outline">محاولات: {scene.attemptCount}</Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={narration}
          onChange={(e) => setNarration(e.target.value)}
          placeholder="نص السرد"
          rows={3}
        />
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="الوصف البصري"
          rows={3}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="w-36"
            type="number"
            min={250}
            max={60000}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
          <span className="text-xs text-muted-foreground">مللي ثانية</span>
          <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>
            <Save className="ms-2 h-4 w-4" />
            حفظ
          </Button>
          <Button
            disabled={approve.isPending || scene.status !== "review" || !scene.clipPreviewUrl}
            onClick={() => approve.mutate()}
          >
            <CheckCircle2 className="ms-2 h-4 w-4" />
            اعتماد
          </Button>
          <Button variant="secondary" disabled title="يتاح بعد ربط مزود التوليد">
            <RefreshCw className="ms-2 h-4 w-4" />
            إعادة توليد لاحقاً
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {scene.imagePreviewUrl && (
            <img
              src={scene.imagePreviewUrl}
              alt={`صورة المشهد ${scene.sceneNumber}`}
              className="max-h-52 w-full rounded-xl object-contain bg-muted"
            />
          )}
          {scene.clipPreviewUrl && (
            <video
              src={scene.clipPreviewUrl}
              controls
              className="max-h-52 w-full rounded-xl bg-black"
            />
          )}
          {scene.audioPreviewUrl && (
            <audio src={scene.audioPreviewUrl} controls className="w-full" />
          )}
        </div>
        {scene.approvedAt && (
          <p className="text-xs text-emerald-700">
            معتمد في {new Date(scene.approvedAt).toLocaleString("ar-EG")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminVideoWorkspace({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getAdminVideoProject);
  const paymentFn = useServerFn(updateVideoPaymentStatus);
  const productionFn = useServerFn(approveVideoProduction);
  const stageFn = useServerFn(updateVideoProductionStage);
  const promptFn = useServerFn(saveVideoReferencePrompt);
  const scriptFn = useServerFn(saveVideoScript);
  const imageApproveFn = useServerFn(approveVideoReferenceImage);
  const scriptApproveFn = useServerFn(approveVideoScript);
  const qualityFn = useServerFn(approveVideoQuality);
  const readyFn = useServerFn(markVideoProjectReady);
  const deliveryFn = useServerFn(markVideoDelivered);
  const query = useQuery({
    queryKey: ["admin-video-project", orderId],
    queryFn: () => getFn({ data: { orderId } }),
  });
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  useEffect(() => {
    if (query.data) {
      setPrompt(query.data.project.referenceImagePrompt ?? "");
      setScript(query.data.project.scriptText);
    }
  }, [query.data]);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-video-project", orderId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-video-orders"] });
  };
  const action = (fn: () => Promise<unknown>, success: string) => {
    fn()
      .then(() => {
        toast.success(success);
        refresh();
      })
      .catch((error: Error) => toast.error(error.message));
  };
  if (query.isLoading)
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  if (!query.data)
    return (
      <p className="rounded-xl bg-destructive/10 p-5 text-destructive">تعذر تحميل مشروع الفيديو.</p>
    );
  const { order, project, scenes, jobs, renders } = query.data;
  const next = project.productionStage ? nextStage[project.productionStage] : undefined;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost">
        <Link to="/admin/videos">
          <ArrowRight className="ms-2 h-4 w-4" />
          العودة إلى الطابور
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>ملخص الطلب</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-[160px_1fr]">
          <div>
            {order.childPhotoUrl ? (
              <img
                src={order.childPhotoUrl}
                alt={`صورة ${order.childName}`}
                className="aspect-square w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-2xl bg-muted">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <p>
              <b>العميل:</b> {order.customerName}
            </p>
            <p>
              <b>الطفل:</b> {order.childName} {order.childAge ? `(${order.childAge})` : ""}
            </p>
            <p>
              <b>القصة:</b> {order.templateTitle}
            </p>
            <p>
              <b>اللغة:</b> {order.language}
            </p>
            <p>
              <b>الأبعاد:</b> {order.aspectRatio}
            </p>
            <p>
              <b>السعر:</b> {order.priceEgp - order.discountEgp} ج.م
            </p>
            <p>
              <b>الدفع:</b> <Badge>{labels[order.paymentStatus]}</Badge>
            </p>
            <p>
              <b>المشروع:</b> <Badge>{labels[project.status]}</Badge>
            </p>
            <p>
              <b>المرحلة:</b>{" "}
              {project.productionStage ? labels[project.productionStage] : "لم يبدأ"}
            </p>
            <p>
              <b>التسليم:</b> {labels[order.deliveryStatus]}
            </p>
            <p className="sm:col-span-2">
              <b>رقم الطلب:</b> <span className="font-mono text-xs">{order.id}</span>
            </p>
          </div>
          <Separator className="md:col-span-2" />
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              disabled={
                !(
                  ["unpaid", "pending", "failed"].includes(order.paymentStatus) &&
                  project.status === "awaiting_payment"
                )
              }
              onClick={() =>
                action(
                  () => paymentFn({ data: { orderId, paymentStatus: "paid" } }),
                  "تم تأكيد الدفع",
                )
              }
            >
              تأكيد الدفع
            </Button>
            <Button
              variant="outline"
              disabled={project.status !== "paid"}
              onClick={() =>
                action(() => productionFn({ data: { orderId } }), "تم اعتماد بدء الإنتاج")
              }
            >
              اعتماد الإنتاج
            </Button>
            {next && (
              <Button
                variant="secondary"
                onClick={() =>
                  action(
                    () => stageFn({ data: { orderId, stage: next } }),
                    `تم الانتقال إلى ${labels[next]}`,
                  )
                }
              >
                المرحلة التالية: {labels[next]}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="source" dir="rtl">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="source">الصورة المرجعية</TabsTrigger>
          <TabsTrigger value="script">النص</TabsTrigger>
          <TabsTrigger value="scenes">المشاهد ({scenes.length})</TabsTrigger>
          <TabsTrigger value="jobs">المهام ({jobs.length})</TabsTrigger>
          <TabsTrigger value="renders">الإصدارات ({renders.length})</TabsTrigger>
          <TabsTrigger value="final">الجودة والتسليم</TabsTrigger>
        </TabsList>
        <TabsContent value="source">
          <Card>
            <CardHeader>
              <CardTitle>مصدر الطفل والصورة المرجعية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="وصف الصورة المرجعية"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!prompt.trim()}
                  onClick={() =>
                    action(() => promptFn({ data: { orderId, prompt } }), "تم حفظ الوصف")
                  }
                >
                  <Save className="ms-2 h-4 w-4" />
                  حفظ الوصف
                </Button>
                <Button disabled title="يتاح بعد ربط مزود الصور">
                  <RefreshCw className="ms-2 h-4 w-4" />
                  توليد/إعادة توليد لاحقاً
                </Button>
                <Button
                  disabled={
                    project.productionStage !== "image_review" ||
                    !project.referenceImageUrl ||
                    !!project.imageApprovedAt
                  }
                  onClick={() =>
                    action(() => imageApproveFn({ data: { orderId } }), "تم اعتماد الصورة")
                  }
                >
                  <ShieldCheck className="ms-2 h-4 w-4" />
                  اعتماد الصورة
                </Button>
              </div>
              {project.referenceImageUrl ? (
                <img
                  src={project.referenceImageUrl}
                  alt="الصورة المرجعية"
                  className="max-h-[520px] rounded-2xl object-contain bg-muted"
                />
              ) : (
                <p className="rounded-xl bg-muted p-6 text-muted-foreground">
                  لا توجد صورة مرجعية بعد. لن تسجل الواجهة نجاحاً وهمياً؛ يلزم مزود حقيقي في المرحلة
                  التالية.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="script">
          <Card>
            <CardHeader>
              <CardTitle>النص ولوحة المشاهد</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={14}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="نص الفيديو والسرد"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!script.trim()}
                  onClick={() =>
                    action(() => scriptFn({ data: { orderId, scriptText: script } }), "تم حفظ النص")
                  }
                >
                  <Save className="ms-2 h-4 w-4" />
                  حفظ
                </Button>
                <Button
                  disabled={
                    project.productionStage !== "script_review" ||
                    !script.trim() ||
                    !!project.scriptApprovedAt
                  }
                  onClick={() =>
                    action(() => scriptApproveFn({ data: { orderId } }), "تم اعتماد النص")
                  }
                >
                  اعتماد النص
                </Button>
                <Button disabled title="يتاح بعد ربط مزود النصوص">
                  إعادة توليد لاحقاً
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="scenes" className="space-y-4">
          {scenes.length ? (
            scenes.map((scene) => (
              <SceneEditor key={scene.id} orderId={orderId} scene={scene} refresh={refresh} />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Film className="mx-auto mb-3 h-9 w-9" />
                لم تُنشأ مشاهد بعد. إنشاء المشاهد ينتظر مزود الإنتاج الحقيقي.
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle>مهام المزوّد الداخلية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {jobs.length ? (
                jobs.map((job) => (
                  <div key={job.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{labels[job.status] ?? job.status}</Badge>
                      <Badge variant="outline">{labels[job.jobType] ?? job.jobType}</Badge>
                      <span className="font-bold">{job.provider}</span>
                    </div>
                    <p className="mt-2 text-xs">
                      Provider ID: {job.providerJobId ?? "—"} · المحاولات: {job.attemptCount}
                    </p>
                    {job.lastError && (
                      <p className="mt-2 text-sm text-destructive">{job.lastError}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString("ar-EG")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">لا توجد مهام مزود حتى الآن.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="renders">
          <Card>
            <CardHeader>
              <CardTitle>إصدارات الفيديو</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {renders.length ? (
                renders.map((render) => (
                  <div key={render.id} className="rounded-xl border p-4">
                    <div className="flex gap-2">
                      <Badge>{labels[render.renderType]}</Badge>
                      <Badge variant="outline">v{render.version}</Badge>
                      {render.isCurrent && <Badge variant="secondary">الحالي</Badge>}
                    </div>
                    {render.previewUrl ? (
                      <video
                        controls
                        src={render.previewUrl}
                        className="mt-3 w-full rounded-xl bg-black"
                      />
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">تعذرت المعاينة الموقعة.</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {render.durationMs / 1000} ثانية · {render.width}×{render.height}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">لا توجد إصدارات بعد.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="final">
          <Card>
            <CardHeader>
              <CardTitle>الجودة، الجاهزية والتسليم</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={
                    project.productionStage !== "quality_review" || !!project.qualityApprovedAt
                  }
                  onClick={() => action(() => qualityFn({ data: { orderId } }), "تم اعتماد الجودة")}
                >
                  اعتماد الجودة
                </Button>
                <Button
                  disabled={
                    project.status !== "processing" || project.productionStage !== "final_render"
                  }
                  onClick={() => action(() => readyFn({ data: { orderId } }), "المشروع جاهز")}
                >
                  تعليم كجاهز
                </Button>
                <Button
                  disabled={project.status !== "ready" || order.deliveryStatus !== "pending"}
                  onClick={() =>
                    action(() => deliveryFn({ data: { orderId } }), "تم تسجيل التسليم")
                  }
                >
                  <CheckCircle2 className="ms-2 h-4 w-4" />
                  تسليم للعميل
                </Button>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                التسليم لا يتم إلا بعد وجود إصدار نهائي حالي واعتماد الصورة والنص والجودة والمشاهد.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
