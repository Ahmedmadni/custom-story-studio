import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ImageIcon,
  Loader2,
  MessageCircle,
  ShieldAlert,
  Wand2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  adminGeneratePage,
  adminGetOrderPages,
  adminListOrders,
  adminSetStatus,
} from "@/lib/admin.functions";
import { waLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "لوحة التحكم — حكايتي" }],
  }),
  component: AdminPage,
});

type AdminOrder = {
  id: string;
  status: string;
  childName: string;
  childAge: number | null;
  whatsapp: string;
  notes: string | null;
  adminNotes: string | null;
  createdAt: string;
  storyTitle: string;
  templateId: string | null;
  photoUrl: string | null;
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
          إدارة الطلبات وتوليد القصص المخصصة وإرسالها عبر الواتساب
        </p>
        <OrdersList />
      </main>
      <Footer />
    </div>
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
  const [generating, setGenerating] = useState<number | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);

  const { data: pages, refetch: refetchPages } = useQuery({
    queryKey: ["admin-order-pages", order.id],
    queryFn: () => getPagesFn({ data: { orderId: order.id } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    void refetchPages();
  };

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
            <StatusBadge status={order.status} />
          </div>
        </div>

        {/* status actions */}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {order.status === "pending" && (
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
