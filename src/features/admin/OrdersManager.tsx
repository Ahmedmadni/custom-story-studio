import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Check,
  ExternalLink,
  Eye,
  FileDown,
  Globe,
  ImageIcon,
  Loader2,
  MessageCircle,
  Pencil,
  Receipt,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentBadge, StatusBadge } from "@/features/orders/StatusBadge";
import {
  adminDeleteOrder,
  adminGeneratePage,
  adminGetOrderPages,
  adminListOrders,
  adminPublishOrderStory,
  adminRejectPayment,
  adminSetStatus,
  adminUnpublishOrderStory,
  adminUpdateOrder,
  adminUpdateOrderPreferences,
  adminVerifyPayment,
} from "@/features/admin/admin.functions";
import { adminApproveTemplate } from "@/features/ai/ai.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { waLink } from "@/features/orders/whatsapp";
import { generateStoryPdf, type PdfStoryPage } from "@/features/pdf/storyPdf";

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
  photoMode: "cartoon" | "real";
  heroCharacter: string | null;
  photoUrl: string | null;
  receiptUrl: string | null;
  totalPages: number;
  donePages: number;
  publishedToLibraryAt: string | null;
  publishedSlug: string | null;
  giftedByName: string | null;
  giftedByRelation: string | null;
  publishConsent: boolean;
};

type StatusFilter = "all" | "action" | "pending" | "approved" | "generating" | "ready" | "sent" | "rejected";

const STATUS_TABS: Array<{ v: StatusFilter; label: string }> = [
  { v: "all", label: "الكل" },
  { v: "action", label: "بحاجة لإجراء" },
  { v: "pending", label: "بانتظار الدفع" },
  { v: "approved", label: "معتمدة" },
  { v: "generating", label: "قيد التوليد" },
  { v: "ready", label: "جاهزة" },
  { v: "sent", label: "مُرسلة" },
  { v: "rejected", label: "مرفوضة" },
];

function nextStepHint(o: AdminOrder): string {
  if (o.paymentStatus === "receipt_uploaded") return "📥 إيصال دفع بحاجة لمراجعة";
  if (o.status === "pending" && o.paymentStatus === "verified") return "✅ اعتمد الطلب لبدء التوليد";
  if (o.status === "approved" || o.status === "generating")
    return `🎨 توليد الصفحات (${o.donePages}/${o.totalPages})`;
  if (o.status === "ready") return "📤 أرسل القصة للعميل على واتساب";
  if (o.status === "sent") return "🎉 مُكتمل — يمكنك النشر في المكتبة";
  if (o.status === "rejected") return "❌ مرفوض";
  if (o.paymentStatus === "pending") return "💳 ينتظر العميل رفع إيصال الدفع";
  return "—";
}

function needsAction(o: AdminOrder): boolean {
  return o.paymentStatus === "receipt_uploaded" || o.status === "ready" || (o.status === "pending" && o.paymentStatus === "verified");
}

export function OrdersManager() {
  const listFn = useServerFn(adminListOrders);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listFn(),
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    const list = (orders ?? []) as AdminOrder[];
    const q = search.trim().toLowerCase();
    return list.filter((o) => {
      if (filter === "action" && !needsAction(o)) return false;
      else if (filter !== "all" && filter !== "action" && o.status !== filter) return false;
      if (!q) return true;
      return (
        o.childName.toLowerCase().includes(q) ||
        o.whatsapp.includes(q) ||
        o.storyTitle.toLowerCase().includes(q)
      );
    });
  }, [orders, filter, search]);

  const counts = useMemo(() => {
    const list = (orders ?? []) as AdminOrder[];
    return {
      all: list.length,
      action: list.filter(needsAction).length,
    };
  }, [orders]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border-2 border-border bg-card p-1 text-xs font-bold">
          {STATUS_TABS.map((t) => (
            <button
              key={t.v}
              onClick={() => setFilter(t.v)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                filter === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
              {t.v === "all" && counts.all > 0 && (
                <span className="rounded-full bg-background/30 px-1.5 text-[10px]">{counts.all}</span>
              )}
              {t.v === "action" && counts.action > 0 && (
                <span className="rounded-full bg-sunny px-1.5 text-[10px] text-sunny-foreground">{counts.action}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم الطفل أو الواتساب…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-full pe-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border-2 border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">لا توجد طلبات مطابقة</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="text-start">الطفل / القصة</TableHead>
                <TableHead className="text-start">الحالة</TableHead>
                <TableHead className="text-start">الدفع</TableHead>
                <TableHead className="text-start">التقدّم</TableHead>
                <TableHead className="text-start">الواتساب</TableHead>
                <TableHead className="text-start">تاريخ</TableHead>
                <TableHead className="text-start">الخطوة التالية</TableHead>
                <TableHead className="text-start"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {o.photoUrl ? (
                        <img src={o.photoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold">
                          {o.childName}{o.childAge ? ` · ${o.childAge}س` : ""}
                          {o.giftedByName && (
                            <span
                              className="ms-2 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-700"
                              title={`إهداء من ${o.giftedByRelation ?? ""} ${o.giftedByName}`}
                            >
                              💝 إهداء
                            </span>
                          )}
                          {o.publishConsent && (
                            <span
                              className="ms-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary"
                              title="وافق العميل على نشر القصة في «من أعمالنا»"
                            >
                              🌟 نشر
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{o.storyTitle}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell><PaymentBadge status={o.paymentStatus} /></TableCell>
                  <TableCell className="font-bold text-xs">
                    {o.donePages}/{o.totalPages}
                  </TableCell>
                  <TableCell className="text-xs" dir="ltr">{o.whatsapp}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("ar-EG")}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className={needsAction(o) ? "font-bold text-primary" : "text-muted-foreground"}>
                      {nextStepHint(o)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-8 rounded-full" onClick={(e) => { e.stopPropagation(); setSelected(o); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selected && <OrderDialog order={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function OrderDialog({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  const queryClient = useQueryClient();
  const setStatusFn = useServerFn(adminSetStatus);
  const generateFn = useServerFn(adminGeneratePage);
  const getPagesFn = useServerFn(adminGetOrderPages);
  const verifyFn = useServerFn(adminVerifyPayment);
  const rejectPayFn = useServerFn(adminRejectPayment);
  const approveContentFn = useServerFn(adminApproveTemplate);
  const publishFn = useServerFn(adminPublishOrderStory);
  const unpublishFn = useServerFn(adminUnpublishOrderStory);
  const updatePrefsFn = useServerFn(adminUpdateOrderPreferences);

  const [consent, setConsent] = useState(false);
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

  const updatePrefsMutation = useMutation({
    mutationFn: (patch: { language?: AdminOrder["language"]; photoMode?: AdminOrder["photoMode"] }) =>
      updatePrefsFn({ data: { orderId: order.id, ...patch } }),
    onSuccess: () => { toast.success("تم تحديث تفضيلات الطلب"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyFn({ data: { orderId: order.id } }),
    onSuccess: () => { toast.success("تم تأكيد الدفع ✅"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectPayMutation = useMutation({
    mutationFn: () => rejectPayFn({ data: { orderId: order.id, reason: rejectReason.trim() } }),
    onSuccess: () => { toast.success("تم رفض الدفع وإبلاغ العميل"); refresh(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "approved" | "rejected" | "sent") => setStatusFn({ data: { orderId: order.id, status } }),
    onSuccess: (_, status) => {
      toast.success(status === "approved" ? "تمت الموافقة" : status === "sent" ? "تم تحديده كمُرسَل" : "تم الرفض");
      refresh();
      if (status !== "sent") onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveContentMutation = useMutation({
    mutationFn: () => {
      if (!order.templateId) throw new Error("لا يوجد قالب مرتبط بالطلب");
      return approveContentFn({ data: { templateId: order.templateId } });
    },
    onSuccess: () => { toast.success("تم اعتماد المحتوى ✅"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishFn({ data: { orderId: order.id } }),
    onSuccess: (res) => {
      toast.success("تم نشر القصة في المكتبة 🎉");
      if (res?.slug) window.open(`/stories/${res.slug}`, "_blank", "noreferrer");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishFn({ data: { orderId: order.id } }),
    onSuccess: () => { toast.success("تم إلغاء النشر"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pageNumbers = Array.from({ length: order.totalPages }, (_, i) => i + 1);
  const pageMap = new Map((pages ?? []).map((p) => [p.pageNumber, p]));
  const readyCount = (pages ?? []).filter((p) => !!p.imageUrl).length;

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
        void refetchPages();
      } catch (e) {
        toast.error(`توقف عند الصفحة ${n}: ${e instanceof Error ? e.message : "خطأ"}`);
        break;
      }
    }
    setGenerating(null);
    setBatchRunning(false);
    refresh();
  };

  const storyLink = `${typeof window !== "undefined" ? window.location.origin : ""}/story/${order.id}`;
  const waMessage = `مرحباً! 🌟\nقصة «${order.storyTitle}» بطلها ${order.childName} أصبحت جاهزة! 🎉\nشاهدها وحمّلها من هنا:\n${storyLink}\n\nمع تحيات فريق كيدزي 📖`;

  const handleAdminExport = async () => {
    const pdfPages: PdfStoryPage[] = (pages ?? [])
      .filter((p) => !!p.imageUrl)
      .map((p) => ({ n: p.pageNumber, text: p.text ?? "", imageUrl: p.imageUrl }))
      .sort((a, b) => a.n - b.n);
    if (pdfPages.length === 0) { toast.error("لا توجد صفحات مولدة للتصدير"); return; }
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeTitle}${safeChild ? ` - ${safeChild}` : ""}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل PDF 📎");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تصدير PDF");
    } finally {
      setExportingPdf(false);
      setPdfProgress(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {order.storyTitle} — {order.childName}
          </DialogTitle>
        </DialogHeader>

        {/* Status banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
            <span className="text-xs font-bold text-muted-foreground">
              {order.donePages}/{order.totalPages} صفحة
            </span>
          </div>
          <p className="text-sm font-bold text-primary">{nextStepHint(order)}</p>
        </div>

        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="info">معلومات</TabsTrigger>
            <TabsTrigger value="payment">الدفع</TabsTrigger>
            <TabsTrigger value="pages">الصفحات</TabsTrigger>
            <TabsTrigger value="delivery">التسليم</TabsTrigger>
          </TabsList>

          {/* INFO */}
          <TabsContent value="info" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-start gap-4">
              {order.photoUrl && (
                <img src={order.photoUrl} alt="" className="h-28 w-28 rounded-2xl object-cover shadow-md" />
              )}
              <div className="flex-1 space-y-2 text-sm">
                <p><b>الواتساب:</b> <span dir="ltr">{order.whatsapp}</span></p>
                {order.childAge && <p><b>العمر:</b> {order.childAge} سنوات</p>}
                {order.heroCharacter && <p><b>الشخصية:</b> 🦸 {order.heroCharacter}</p>}
                {order.notes && <p><b>ملاحظات العميل:</b> {order.notes}</p>}
                <p className="text-xs text-muted-foreground">
                  تم الإنشاء: {new Date(order.createdAt).toLocaleString("ar-EG")}
                </p>
              </div>
            </div>

            {/* بيانات الإهداء (الأهل / مُهدي القصة) */}
            {(order.giftedByName || order.publishConsent) && (
              <div className="rounded-2xl border-2 border-pink-200 bg-pink-50/40 p-4 text-sm">
                <h4 className="mb-2 font-bold">💝 بيانات الإهداء</h4>
                {order.giftedByName ? (
                  <p>
                    <b>مُهدي القصة:</b>{" "}
                    {order.giftedByRelation ? `${order.giftedByRelation} ` : ""}
                    {order.giftedByName}
                  </p>
                ) : (
                  <p className="text-muted-foreground">لا يوجد اسم مُهدي</p>
                )}
                <p className="mt-1">
                  <b>موافقة النشر في «من أعمالنا»:</b>{" "}
                  {order.publishConsent ? "✅ نعم" : "— لا"}
                </p>
              </div>
            )}

            <div className="rounded-2xl border-2 border-border bg-secondary/30 p-4">
              <h4 className="mb-3 font-bold">تفضيلات الطلب</h4>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <span className="font-bold">🌐 اللغة:</span>
                  <select
                    className="rounded-full border-2 border-border bg-card px-3 py-1.5 font-semibold"
                    value={order.language}
                    disabled={updatePrefsMutation.isPending}
                    onChange={(e) => updatePrefsMutation.mutate({ language: e.target.value as AdminOrder["language"] })}
                  >
                    <option value="ar">عربي</option>
                    <option value="en">English</option>
                    <option value="bilingual">عربي + إنجليزي</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="font-bold">🎭 نمط الصورة:</span>
                  <select
                    className="rounded-full border-2 border-border bg-card px-3 py-1.5 font-semibold"
                    value={order.photoMode}
                    disabled={updatePrefsMutation.isPending}
                    onChange={(e) => updatePrefsMutation.mutate({ photoMode: e.target.value as AdminOrder["photoMode"] })}
                  >
                    <option value="cartoon">🎨 كرتوني</option>
                    <option value="real">📷 وجه حقيقي</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="rounded-full font-bold">
                <a href={`/story/${order.id}`} target="_blank" rel="noreferrer">
                  <BookOpen className="ms-1 h-4 w-4" /> مراجعة القصة
                </a>
              </Button>
              {order.templateId && (
                <Button
                  size="sm"
                  className="rounded-full bg-grass font-bold text-grass-foreground hover:bg-grass/90"
                  disabled={approveContentMutation.isPending}
                  onClick={() => approveContentMutation.mutate()}
                >
                  <ShieldCheck className="ms-1 h-4 w-4" /> اعتماد محتوى القصة
                </Button>
              )}
            </div>
          </TabsContent>

          {/* PAYMENT */}
          <TabsContent value="payment" className="mt-4">
            <div className="rounded-2xl border-2 border-grass/30 bg-grass/5 p-4">
              <h3 className="flex items-center gap-2 font-display font-bold">
                <Receipt className="h-4 w-4 text-grass" />
                مراجعة الدفع — {order.priceEgp} جنيه فودافون كاش
              </h3>
              {order.receiptUrl ? (
                <a href={order.receiptUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block">
                  <img src={order.receiptUrl} alt="إيصال الدفع" className="h-48 rounded-xl border bg-card object-contain p-1 shadow hover:shadow-lg" />
                </a>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">لم يُرفع إيصال بعد</p>
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
                    <Check className="ms-1 h-4 w-4" /> تأكيد الدفع
                  </Button>
                  <Input
                    placeholder="سبب الرفض"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    maxLength={300}
                    className="h-9 max-w-xs rounded-full"
                  />
                  <Button
                    variant="outline"
                    className="rounded-full font-bold text-destructive"
                    disabled={rejectPayMutation.isPending || rejectReason.trim().length === 0}
                    onClick={() => rejectPayMutation.mutate()}
                  >
                    <X className="ms-1 h-4 w-4" /> رفض الدفع
                  </Button>
                </div>
              )}
              {(order.paymentStatus === "unpaid" || order.paymentStatus === "rejected") && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                  <Button
                    className="rounded-full bg-primary font-bold text-primary-foreground hover:bg-primary/90"
                    disabled={verifyMutation.isPending}
                    onClick={() => {
                      if (confirm("هل تريد اعتماد الدفع يدوياً بدون إيصال؟")) {
                        verifyMutation.mutate();
                      }
                    }}
                  >
                    <Check className="ms-1 h-4 w-4" /> اعتماد الدفع يدوياً
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    استخدم هذا الزر إذا تم استلام الدفع خارج النظام (تحويل مباشر، نقدي، ...)
                  </span>
                </div>
              )}
              {order.status === "pending" && order.paymentStatus === "verified" && (
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <Button
                    className="rounded-full bg-grass font-bold text-grass-foreground hover:bg-grass/90"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("approved")}
                  >
                    <Check className="ms-1 h-4 w-4" /> اعتماد الطلب وبدء التنفيذ
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full font-bold text-destructive"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("rejected")}
                  >
                    <X className="ms-1 h-4 w-4" /> رفض الطلب
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* PAGES */}
          <TabsContent value="pages" className="mt-4 space-y-4">
            {order.status === "pending" || order.status === "rejected" ? (
              <p className="rounded-2xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
                اعتمد الطلب أولاً من تبويب الدفع لبدء توليد الصفحات
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">
                    اكتمل {readyCount}/{order.totalPages} صفحة
                  </p>
                  <Button
                    className="rounded-full font-bold"
                    disabled={batchRunning || generating !== null}
                    onClick={() => void generateAll()}
                  >
                    {batchRunning ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Wand2 className="ms-1 h-4 w-4" />}
                    توليد كل المتبقي
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {pageNumbers.map((n) => {
                    const p = pageMap.get(n);
                    return (
                      <div key={n} className="overflow-hidden rounded-2xl border-2 border-border bg-secondary/30">
                        <div className="relative aspect-square">
                          {p?.imageUrl ? (
                            <img src={p.imageUrl} alt={`صفحة ${n}`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              {generating === n ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : "لم تولد بعد"}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between p-2">
                          <span className="text-xs font-bold">صفحة {n}</span>
                          <Button
                            size="sm" variant="outline"
                            className="h-7 rounded-full text-xs font-bold"
                            disabled={generating !== null || batchRunning}
                            onClick={() => void generateOne(n)}
                          >
                            {p ? "إعادة" : "توليد"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* DELIVERY */}
          <TabsContent value="delivery" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-full border-2 border-primary px-5 font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                disabled={exportingPdf || batchRunning || generating !== null || readyCount === 0}
                onClick={() => void handleAdminExport()}
              >
                {exportingPdf ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <FileDown className="ms-1 h-4 w-4" />}
                تصدير PDF
              </Button>
              {(order.status === "ready" || order.status === "sent") && (
                <Button asChild className="rounded-full bg-grass font-bold text-grass-foreground hover:bg-grass/90"
                  onClick={() => { if (order.status === "ready") statusMutation.mutate("sent"); }}>
                  <a href={waLink(order.whatsapp, waMessage)} target="_blank" rel="noreferrer">
                    <MessageCircle className="ms-1 h-4 w-4" /> إرسال عبر الواتساب
                  </a>
                </Button>
              )}
            </div>
            {pdfProgress && (
              <p className="text-xs font-semibold text-muted-foreground">
                📄 جارٍ التجهيز… {pdfProgress.done}/{pdfProgress.total}
              </p>
            )}

            {(order.status === "ready" || order.status === "sent") && (
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
                <h3 className="flex items-center gap-2 font-display font-bold text-primary">
                  <Globe className="h-4 w-4" /> نشر القصة في مكتبة الحكايات
                </h3>
                {order.publishedToLibraryAt ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-semibold text-grass">
                      ✅ منشورة منذ {new Date(order.publishedToLibraryAt).toLocaleString("ar-EG")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {order.publishedSlug && (
                        <Button asChild size="sm" variant="outline" className="rounded-full font-bold">
                          <a href={`/stories/${order.publishedSlug}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="ms-1 h-4 w-4" /> فتح في المكتبة
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm" variant="outline"
                        className="rounded-full font-bold text-destructive"
                        disabled={unpublishMutation.isPending}
                        onClick={() => unpublishMutation.mutate()}
                      >
                        <Undo2 className="ms-1 h-4 w-4" /> إلغاء النشر
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      ستُنشر النسخة الكاملة لـ{order.childName} (الاسم + الصور المولّدة) في تصنيف القالب الأصلي.
                    </p>
                    <label className="flex items-start gap-2 text-sm font-semibold">
                      <input
                        type="checkbox" checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-1 h-4 w-4 accent-primary"
                      />
                      <span>أؤكد أن العميل وافق على نشر قصة طفله علنًا في الموقع.</span>
                    </label>
                    <Button
                      className="rounded-full bg-primary font-bold text-primary-foreground hover:bg-primary/90"
                      disabled={!consent || publishMutation.isPending || order.donePages < order.totalPages}
                      onClick={() => publishMutation.mutate()}
                    >
                      {publishMutation.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Globe className="ms-1 h-4 w-4" />}
                      نشر في المكتبة
                    </Button>
                    {order.donePages < order.totalPages && (
                      <p className="text-xs text-amber-700">
                        اكتمل {order.donePages}/{order.totalPages} صفحة فقط — أكمل التوليد قبل النشر.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
