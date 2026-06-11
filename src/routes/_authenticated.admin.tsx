import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  CreditCard,
  ExternalLink,
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
