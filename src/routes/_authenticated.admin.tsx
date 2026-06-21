import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  CreditCard,
  ExternalLink,
  FileDown,
  ImageIcon,
  KeyRound,
  Loader2,
  MessageCircle,
  Receipt,
  ShieldAlert,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";

import { useState } from "react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PaymentBadge, StatusBadge } from "@/features/orders/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  adminGeneratePage,
  adminGetOrderPages,
  adminGetUsageStats,
  adminListOrders,
  adminRejectPayment,
  adminSetStatus,
  adminVerifyPayment,
} from "@/features/admin/admin.functions";

import {
  adminApproveTemplate,
  adminListPendingTemplates,
  adminRejectTemplate,
} from "@/features/ai/ai.functions";
import { waLink } from "@/features/orders/whatsapp";
import { generateStoryPdf, type PdfStoryPage } from "@/features/pdf/storyPdf";
import { TemplatesManager } from "@/features/admin/TemplatesManager";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "لوحة التحكم — حكايتي" }],
  }),
  component: AdminPage,
});

type AdminOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  priceEgp: number;
  paymentRejectionReason: string | null;
  childName: string;
  childAge: number | null;
  whatsapp: string;
  notes: string | null;
  adminNotes: string | null;
  createdAt: string;
  storyTitle: string;
  language: "ar" | "en" | "bilingual";
  contentType: "story" | "book";
  templateId: string | null;
  photoUrl: string | null;
  receiptUrl: string | null;
  totalPages: number;
  donePages: number;
};

function AdminPage() {
  const { isAdmin, loading } = useAuth();

  if (!loading && !isAdmin) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex flex-col items-center py-24 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <p className="mt-4 text-lg font-bold">هذه الصفحة مخصصة للإدارة فقط</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold">لوحة التحكم 🛠️</h1>
        <p className="mt-1 text-muted-foreground">
          اعتماد المحتوى المُنشَأ من المستخدمين + إدارة الطلبات
        </p>
        <UsagePanel />
        <PendingTemplatesList />
        <TemplatesManager />

        <OrdersList />
      </main>
      <Footer />
    </div>
  );
}

function PendingTemplatesList() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListPendingTemplates);
  const approveFn = useServerFn(adminApproveTemplate);
  const rejectFn = useServerFn(adminRejectTemplate);

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-pending-templates"],
    queryFn: () => listFn(),
    refetchInterval: 30000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { templateId: id } }),
    onSuccess: () => {
      toast.success("تم اعتماد المحتوى ✅ — يمكن للمستخدم تحميله الآن");
      void queryClient.invalidateQueries({ queryKey: ["admin-pending-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (id: string) => rejectFn({ data: { templateId: id } }),
    onSuccess: () => {
      toast.success("تمت إعادة المحتوى للمستخدم للتعديل");
      void queryClient.invalidateQueries({ queryKey: ["admin-pending-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-extrabold">
        محتوى ينتظر اعتمادك ✋
      </h2>
      <p className="text-sm text-muted-foreground">
        المستخدم لا يستطيع تحميل PDF حتى تعتمد محتواه هنا
      </p>
      <div className="mt-4 space-y-3">
        {isLoading ? (
          <Skeleton className="h-24 rounded-3xl" />
        ) : (items ?? []).length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
            لا يوجد محتوى منتظر — كل شيء معتمد ✨
          </p>
        ) : (
          (items ?? []).map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-sunny/40 bg-sunny/10 p-4"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold">{t.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {t.content_type === "book" ? "كتاب تعليمي" : "قصة"} ·{" "}
                  {t.language === "ar"
                    ? "عربي"
                    : t.language === "en"
                      ? "English"
                      : "ثنائي"}
                  {t.age_range ? ` · ${t.age_range} سنوات` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  اعتمدها المستخدم: {new Date(t.approved_at!).toLocaleString("ar-EG")}
                </p>
                <a
                  href={`/story/${t.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs font-bold text-primary hover:underline"
                >
                  معاينة المحتوى ↗
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-full bg-grass font-bold text-grass-foreground hover:bg-grass/90"
                  disabled={approve.isPending || reject.isPending}
                  onClick={() => approve.mutate(t.id)}
                >
                  <Check className="ms-1 h-4 w-4" />
                  اعتماد ونشر
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full font-bold text-destructive"
                  disabled={approve.isPending || reject.isPending}
                  onClick={() => reject.mutate(t.id)}
                >
                  <X className="ms-1 h-4 w-4" />
                  إعادة للتعديل
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function OrdersList() {
  const listFn = useServerFn(adminListOrders);
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listFn(),
    refetchInterval: 30000,
  });

  return (
    <>
      <div className="mt-8 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))
        ) : (orders ?? []).length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed p-10 text-center text-muted-foreground">
            لا توجد طلبات بعد
          </p>
        ) : (
          (orders ?? []).map((o) => (
            <button
              key={o.id}
              onClick={() => setSelected(o)}
              className="flex w-full flex-wrap items-center gap-4 rounded-3xl border-2 border-border bg-card p-4 text-start shadow-sm transition-colors hover:border-primary"
            >
              {o.photoUrl ? (
                <img
                  src={o.photoUrl}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-bold">{o.storyTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  البطل: {o.childName}
                  {o.childAge ? ` (${o.childAge} سنوات)` : ""} · واتساب:{" "}
                  <span dir="ltr">{o.whatsapp}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleString("ar-EG")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <PaymentBadge status={o.paymentStatus} />
                <StatusBadge status={o.status} />
                <span className="text-xs font-bold text-muted-foreground">
                  الصور: {o.donePages}/{o.totalPages}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {selected && (
        <OrderDialog order={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function OrderDialog({
  order,
  onClose,
}: {
  order: AdminOrder;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const setStatusFn = useServerFn(adminSetStatus);
  const generateFn = useServerFn(adminGeneratePage);
  const getPagesFn = useServerFn(adminGetOrderPages);
  const verifyFn = useServerFn(adminVerifyPayment);
  const rejectPayFn = useServerFn(adminRejectPayment);
  const [generating, setGenerating] = useState<number | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

  const { data: pages, refetch: refetchPages } = useQuery({
    queryKey: ["admin-order-pages", order.id],
    queryFn: () => getPagesFn({ data: { orderId: order.id } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    void refetchPages();
  };

  const verifyMutation = useMutation({
    mutationFn: () => verifyFn({ data: { orderId: order.id } }),
    onSuccess: () => {
      toast.success("تم تأكيد الدفع — يمكن البدء بتوليد الصفحات ✅");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectPayMutation = useMutation({
    mutationFn: () =>
      rejectPayFn({ data: { orderId: order.id, reason: rejectReason.trim() } }),
    onSuccess: () => {
      toast.success("تم رفض الدفع وإبلاغ العميل");
      refresh();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "approved" | "rejected" | "sent") =>
      setStatusFn({ data: { orderId: order.id, status } }),
    onSuccess: (_, status) => {
      toast.success(
        status === "approved"
          ? "تمت الموافقة على الطلب"
          : status === "sent"
            ? "تم تحديد الطلب كمُرسَل"
            : "تم رفض الطلب",
      );
      refresh();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateOne = async (n: number) => {
    setGenerating(n);
    try {
      await generateFn({ data: { orderId: order.id, pageNumber: n } });
      toast.success(`تم توليد الصفحة ${n} ✨`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التوليد");
    } finally {
      setGenerating(null);
    }
  };

  const generateAll = async () => {
    setBatchRunning(true);
    const doneNumbers = new Set((pages ?? []).map((p) => p.pageNumber));
    for (let n = 1; n <= order.totalPages; n++) {
      if (doneNumbers.has(n)) continue;
      setGenerating(n);
      try {
        await generateFn({ data: { orderId: order.id, pageNumber: n } });
        toast.success(`الصفحة ${n} جاهزة`);
        void refetchPages();
      } catch (e) {
        toast.error(
          `توقف عند الصفحة ${n}: ${e instanceof Error ? e.message : "خطأ"}`,
        );
        break;
      }
    }
    setGenerating(null);
    setBatchRunning(false);
    refresh();
  };

  const storyLink = `${window.location.origin}/story/${order.id}`;
  const waMessage = `مرحباً! 🌟\nقصة «${order.storyTitle}» بطلها ${order.childName} أصبحت جاهزة! 🎉\nشاهدها وحمّلها من هنا:\n${storyLink}\n\nمع تحيات فريق حكايتي 📖`;

  const pageNumbers = Array.from({ length: order.totalPages }, (_, i) => i + 1);
  const pageMap = new Map((pages ?? []).map((p) => [p.pageNumber, p]));
  const readyCount = (pages ?? []).filter((p) => !!p.imageUrl).length;

  const handleAdminExport = async () => {
    const pdfPages: PdfStoryPage[] = (pages ?? [])
      .filter((p) => !!p.imageUrl)
      .map((p) => ({
        n: p.pageNumber,
        text: p.text ?? "",
        imageUrl: p.imageUrl,
      }))
      .sort((a, b) => a.n - b.n);

    if (pdfPages.length === 0) {
      toast.error("لا توجد صفحات مولدة للتصدير");
      return;
    }
    if (pdfPages.length < order.totalPages) {
      toast.info(`تنبيه: سيُصدَّر ${pdfPages.length}/${order.totalPages} صفحة فقط`);
    }

    setExportingPdf(true);
    setPdfProgress({ done: 0, total: pdfPages.length });
    try {
      const blob = await generateStoryPdf({
        title: order.storyTitle,
        childName: order.childName,
        language: order.language,
        contentType: order.contentType,
        pages: pdfPages,
        onProgress: (done, total) => setPdfProgress({ done, total }),
      });
      const safeTitle = order.storyTitle.replace(/[\\/:*?"<>|]/g, "");
      const safeChild = (order.childName ?? "").replace(/[\\/:*?"<>|]/g, "");
      const fileName = `${safeTitle}${safeChild ? ` - ${safeChild}` : ""}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل PDF — أرفقه في محادثة الواتساب 📎");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تصدير PDF");
    } finally {
      setExportingPdf(false);
      setPdfProgress(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {order.storyTitle} — {order.childName}
          </DialogTitle>
        </DialogHeader>


        <div className="flex flex-wrap items-center gap-4">
          {order.photoUrl && (
            <img
              src={order.photoUrl}
              alt={`صورة ${order.childName}`}
              className="h-28 w-28 rounded-2xl object-cover shadow-md"
            />
          )}
          <div className="space-y-1 text-sm">
            <p>
              <b>واتساب العميل:</b> <span dir="ltr">{order.whatsapp}</span>
            </p>
            {order.notes && (
              <p>
                <b>ملاحظات:</b> {order.notes}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <PaymentBadge status={order.paymentStatus} />
              <StatusBadge status={order.status} />
            </div>
          </div>
        </div>

        {/* payment verification */}
        <div className="rounded-2xl border-2 border-grass/30 bg-grass/5 p-4">
          <h3 className="flex items-center gap-2 font-display font-bold">
            <Receipt className="h-4 w-4 text-grass" />
            مراجعة الدفع — {order.priceEgp} جنيه فودافون كاش
          </h3>
          {order.receiptUrl ? (
            <a
              href={order.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block"
            >
              <img
                src={order.receiptUrl}
                alt="إيصال الدفع"
                className="h-40 rounded-xl border bg-card object-contain p-1 shadow hover:shadow-lg"
              />
            </a>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              لم يُرفع إيصال بعد
            </p>
          )}
          {order.paymentStatus === "rejected" && order.paymentRejectionReason && (
            <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-xs text-destructive">
              سبب الرفض: {order.paymentRejectionReason}
            </p>
          )}
          {order.paymentStatus === "receipt_uploaded" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                className="rounded-full bg-grass font-bold text-grass-foreground hover:bg-grass/90"
                disabled={verifyMutation.isPending}
                onClick={() => verifyMutation.mutate()}
              >
                <Check className="ms-1 h-4 w-4" />
                تأكيد الدفع وبدء التنفيذ
              </Button>
              <Input
                placeholder="سبب الرفض (مطلوب للرفض)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={300}
                className="h-9 max-w-xs rounded-full"
              />
              <Button
                variant="outline"
                className="rounded-full font-bold text-destructive"
                disabled={
                  rejectPayMutation.isPending || rejectReason.trim().length === 0
                }
                onClick={() => rejectPayMutation.mutate()}
              >
                <X className="ms-1 h-4 w-4" />
                رفض الدفع
              </Button>
            </div>
          )}
        </div>

        {/* status actions */}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {order.status === "pending" && order.paymentStatus === "verified" && (
            <>
              <Button
                className="rounded-full bg-grass font-bold text-grass-foreground hover:bg-grass/90"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("approved")}
              >
                <Check className="ms-1 h-4 w-4" />
                موافقة على الطلب
              </Button>
              <Button
                variant="outline"
                className="rounded-full font-bold text-destructive"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("rejected")}
              >
                <X className="ms-1 h-4 w-4" />
                رفض
              </Button>
            </>
          )}
          {(order.status === "approved" ||
            order.status === "generating" ||
            order.status === "ready") && (
            <Button
              className="rounded-full font-bold"
              disabled={batchRunning || generating !== null}
              onClick={() => void generateAll()}
            >
              {batchRunning ? (
                <Loader2 className="ms-1 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="ms-1 h-4 w-4" />
              )}
              توليد كل الصفحات المتبقية
            </Button>
          )}
          {(order.status === "ready" || order.status === "sent") && (
            <Button
              asChild
              className="rounded-full bg-grass font-bold text-grass-foreground hover:bg-grass/90"
              onClick={() => {
                if (order.status === "ready") statusMutation.mutate("sent");
              }}
            >
              <a href={waLink(order.whatsapp, waMessage)} target="_blank" rel="noreferrer">
                <MessageCircle className="ms-1 h-4 w-4" />
                إرسال عبر الواتساب
              </a>
            </Button>
          )}
        </div>

        {/* pages grid */}
        {order.status !== "pending" && order.status !== "rejected" && (
          <div className="border-t pt-4">
            <h3 className="font-display font-bold">
              صفحات القصة (النمط الكرتوني ثلاثي الأبعاد)
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              {pageNumbers.map((n) => {
                const p = pageMap.get(n);
                return (
                  <div
                    key={n}
                    className="overflow-hidden rounded-2xl border-2 border-border bg-secondary/30"
                  >
                    <div className="relative aspect-square">
                      {p?.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={`صفحة ${n}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          {generating === n ? (
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          ) : (
                            "لم تولد بعد"
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-xs font-bold">صفحة {n}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-full text-xs font-bold"
                        disabled={generating !== null || batchRunning}
                        onClick={() => void generateOne(n)}
                      >
                        {p ? "إعادة توليد" : "توليد"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UsagePanel() {
  const statsFn = useServerFn(adminGetUsageStats);
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-usage-stats"],
    queryFn: () => statsFn(),
    refetchInterval: 60000,
  });

  if (isLoading || !stats) {
    return <Skeleton className="mt-6 h-40 rounded-3xl" />;
  }

  return (
    <section className="mt-8 rounded-3xl border-2 border-primary/30 bg-gradient-to-bl from-primary/5 to-sunny/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
            <Sparkles className="h-5 w-5 text-primary" />
            رصيد الاستخدام والتكلفة
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            التكلفة تقديرية — الرصيد الفعلي يُدار من إعدادات Lovable
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full font-bold">
          <a
            href="https://lovable.dev/projects"
            target="_blank"
            rel="noreferrer"
          >
            <CreditCard className="ms-1 h-4 w-4" />
            شحن رصيد Lovable AI
            <ExternalLink className="me-1 h-3 w-3" />
          </a>
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="إجمالي الصور المولّدة" value={stats.totalImages.toLocaleString("ar-EG")} />
        <StatCard label="آخر 30 يوماً" value={stats.imagesLast30d.toLocaleString("ar-EG")} />
        <StatCard label="إجمالي الطلبات" value={stats.totalOrders.toLocaleString("ar-EG")} />
        <StatCard label="عدد القوالب" value={stats.totalTemplates.toLocaleString("ar-EG")} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="تكلفة الصورة الواحدة"
          value={`~$${stats.costPerImageUsd.toFixed(3)}`}
          hint={stats.currentImageModel}
        />
        <StatCard
          label="تكلفة آخر 30 يوماً"
          value={`~$${stats.estimatedCostUsd30d.toFixed(2)}`}
          hint="تقديري"
        />
        <StatCard
          label="إجمالي التكلفة"
          value={`~$${stats.estimatedCostUsdTotal.toFixed(2)}`}
          hint="منذ بداية المشروع"
        />
      </div>

      <div className="mt-5 rounded-2xl border-2 border-border bg-card/60 p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold">
          <KeyRound className="h-4 w-4 text-grass" />
          مزودات الذكاء الاصطناعي المُهيأة
        </h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <ProviderChip name="Lovable AI Gateway" active={stats.providers.lovable} primary />
          <ProviderChip name="OpenAI (مزود بديل)" active={stats.providers.openai} />
          <ProviderChip name="Google Gemini (مزود بديل)" active={stats.providers.gemini} />
          <ProviderChip name="Stability AI (مزود بديل)" active={stats.providers.stability} />
          <ProviderChip name="Replicate / FLUX (مزود بديل)" active={stats.providers.replicate} />
        </div>
        {!stats.providers.openai && !stats.providers.gemini && !stats.providers.stability && !stats.providers.replicate && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer font-bold text-primary hover:underline">
              كيف أُفعّل مزوّداً بديلاً عند نفاد رصيد Lovable؟
            </summary>
            <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted-foreground">
              <li>
                احصل على مفتاح API من{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-primary hover:underline"
                >
                  OpenAI
                </a>{" "}
                أو{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-primary hover:underline"
                >
                  Google AI Studio
                </a>
                .
              </li>
              <li>
                أضف المفتاح كسرّ (Secret) باسم <code className="rounded bg-secondary px-1">OPENAI_API_KEY</code>{" "}
                أو <code className="rounded bg-secondary px-1">GEMINI_API_KEY</code> من خلال طلب ذلك في المحادثة.
              </li>
              <li>
                بعد التفعيل سيتم استخدام المزوّد البديل تلقائياً عند فشل بوابة Lovable (يتطلب تعديلاً برمجياً صغيراً — اطلبه من المساعد).
              </li>
            </ol>
          </details>
        )}
      </div>
    </section>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-3 text-center shadow-sm">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-extrabold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground" dir="ltr">{hint}</p>}
    </div>
  );
}

function ProviderChip({ name, active, primary }: { name: string; active: boolean; primary?: boolean }) {
  return (
    <span
      className={`rounded-full border-2 px-3 py-1 ${
        active
          ? primary
            ? "border-primary bg-primary/15 text-primary"
            : "border-grass bg-grass/15 text-grass"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {active ? "✓" : "○"} {name}
    </span>
  );
}

