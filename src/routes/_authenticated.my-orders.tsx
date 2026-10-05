import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Eye, FileDown, Pencil, ShoppingCart, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PaymentBadge } from "@/features/orders/StatusBadge";
import { OrderStepper } from "@/features/orders/OrderStepper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { listMyPdfs } from "@/features/pdf/pdf.functions";
import { updateMyOrderPreferences, deleteMyOrder } from "@/features/admin/admin.functions";
import { OrderEditDialog, type EditableOrder } from "@/features/orders/OrderEditDialog";
import { ReviewDialog } from "@/features/reviews/ReviewDialog";
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

export const Route = createFileRoute("/_authenticated/my-orders")({
  head: () => ({
    meta: [{ title: "طلباتي — كيدزي" }],
  }),
  component: MyOrders,
});

function MyOrders() {
  const { user } = useAuth();
  const fetchPdfs = useServerFn(listMyPdfs);
  const updatePrefsFn = useServerFn(updateMyOrderPreferences);
  const queryClient = useQueryClient();

  const deleteFn = useServerFn(deleteMyOrder);
  const [editing, setEditing] = useState<EditableOrder | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{ orderId: string; title: string } | null>(null);

  const { data: reviewedOrderIds } = useQuery({
    queryKey: ["my-reviewed-orders", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("order_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((r) => r.order_id as string));
    },
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, status, payment_status, payment_rejection_reason, child_name, child_name_en, child_age, gender, whatsapp, notes, language, photo_mode, pages_count, print_copy, delivery_address, gifted_by_name, gifted_by_relation, publish_consent, discount_egp, coupon_code, created_at, story_templates!template_id(title, cover_url, slug, is_custom)",
        )
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const updatePrefs = useMutation({
    mutationFn: (vars: {
      orderId: string;
      language?: "ar" | "en" | "bilingual";
      photoMode?: "cartoon" | "real";
    }) => updatePrefsFn({ data: vars }),
    onSuccess: () => {
      toast.success("تم تحديث تفضيلاتك");
      void queryClient.invalidateQueries({ queryKey: ["my-orders", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (orderId: string) => deleteFn({ data: { orderId } }),
    onSuccess: () => {
      toast.success("تم حذف الطلب");
      setDeletingId(null);
      void queryClient.invalidateQueries({ queryKey: ["my-orders", user?.id] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setDeletingId(null);
    },
  });

  const { data: myPdfs } = useQuery({
    queryKey: ["my-pdfs", user?.id],
    enabled: Boolean(user),
    queryFn: () => fetchPdfs(),
  });

  const canEdit = (o: { status: string; payment_status: string | null }) =>
    ["pending", "rejected"].includes(o.status) &&
    (o.payment_status ?? "unpaid") !== "verified";

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold">طلباتي 📦</h1>

        <div className="mt-8 space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))
          ) : (orders ?? []).length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-7 w-7" />}
              title="لا توجد طلبات بعد"
              description="تصفّح المكتبة واختر القصة التي تحبّها لطفلك."
              action={
                <Button asChild className="rounded-full font-bold">
                  <Link to="/stories">
                    <ShoppingCart className="ms-1 h-4 w-4" />
                    تصفح القصص
                  </Link>
                </Button>
              }
            />
          ) : (
            (orders ?? []).map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-border bg-card p-5 shadow-sm"
              >
                {o.story_templates?.cover_url ? (
                  <img
                    src={o.story_templates.cover_url}
                    alt=""
                    loading="lazy"
                    className="h-20 w-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-16 items-center justify-center rounded-xl bg-secondary">
                    <BookOpen className="h-6 w-6 text-primary/50" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-bold">
                    {o.story_templates?.title ?? "قصة"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    البطل: {o.child_name} · {new Date(o.created_at).toLocaleDateString("ar-EG")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <PaymentBadge status={(o.payment_status ?? "unpaid") as string} />
                  </div>
                  <div className="mt-3">
                    <OrderStepper
                      order={{
                        status: o.status as string,
                        payment_status: (o.payment_status as string | null) ?? null,
                        created_at: o.created_at,
                      }}
                    />
                  </div>
                  {o.payment_status === "rejected" && o.payment_rejection_reason && (
                    <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-xs text-destructive">
                      سبب رفض الدفع: {o.payment_rejection_reason}
                    </p>
                  )}
                  {["pending", "approved"].includes(o.status as string) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-muted-foreground">
                        تفضيلاتك (قابلة للتعديل قبل بدء التوليد):
                      </span>
                      <label className="flex items-center gap-1">
                        🌐
                        <select
                          className="rounded-full border-2 border-border bg-secondary px-2 py-1 font-semibold"
                          value={(o.language as string | null) ?? "ar"}
                          disabled={updatePrefs.isPending}
                          onChange={(e) =>
                            updatePrefs.mutate({
                              orderId: o.id,
                              language: e.target.value as "ar" | "en" | "bilingual",
                            })
                          }
                        >
                          <option value="ar">عربي</option>
                          <option value="en">English</option>
                          <option value="bilingual">عربي + إنجليزي</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-1">
                        🎭
                        <select
                          className="rounded-full border-2 border-border bg-secondary px-2 py-1 font-semibold"
                          value={(o.photo_mode as string | null) ?? "cartoon"}
                          disabled={updatePrefs.isPending}
                          onChange={(e) =>
                            updatePrefs.mutate({
                              orderId: o.id,
                              photoMode: e.target.value as "cartoon" | "real",
                            })
                          }
                        >
                          <option value="cartoon">🎨 كرتوني</option>
                          <option value="real">📷 وجه حقيقي</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(o.status === "ready" || o.status === "sent") && (
                    <Button asChild className="rounded-full font-bold">
                      <Link to="/story/$orderId" params={{ orderId: o.id }}>
                        <Eye className="ms-1 h-4 w-4" />
                        شاهد القصة
                      </Link>
                    </Button>
                  )}
                  {o.status === "sent" && !reviewedOrderIds?.has(o.id) && (
                    <Button
                      variant="outline"
                      className="rounded-full font-bold text-accent-foreground"
                      onClick={() =>
                        setReviewing({ orderId: o.id, title: o.story_templates?.title ?? "قصة" })
                      }
                    >
                      <Star className="ms-1 h-4 w-4" />
                      قيّم تجربتك
                    </Button>
                  )}
                  {canEdit({
                    status: o.status as string,
                    payment_status: (o.payment_status as string | null) ?? null,
                  }) && (
                    <>
                      <Button
                        variant="outline"
                        className="rounded-full font-bold"
                        onClick={() => {
                          setEditing({
                            id: o.id,
                            child_name: o.child_name,
                            child_name_en:
                              (o as { child_name_en?: string | null }).child_name_en ?? null,
                            child_age: (o as { child_age?: number | null }).child_age ?? null,
                            gender: (o as { gender?: string }).gender ?? "boy",
                            whatsapp: (o as { whatsapp?: string }).whatsapp ?? "",
                            notes: (o as { notes?: string | null }).notes ?? null,
                            language: (o.language as string) ?? "ar",
                            photo_mode: (o.photo_mode as string) ?? "cartoon",
                            pages_count: (o as { pages_count?: number }).pages_count ?? 10,
                            print_copy: Boolean((o as { print_copy?: boolean }).print_copy),
                            delivery_address:
                              (o as { delivery_address?: string | null }).delivery_address ?? null,
                            gifted_by_name:
                              (o as { gifted_by_name?: string | null }).gifted_by_name ?? null,
                            gifted_by_relation:
                              (o as { gifted_by_relation?: string | null }).gifted_by_relation ??
                              null,
                            publish_consent: Boolean(
                              (o as { publish_consent?: boolean }).publish_consent,
                            ),
                            isCustom: Boolean(o.story_templates?.is_custom),
                            title: o.story_templates?.title ?? "قصة",
                          });
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="ms-1 h-4 w-4" />
                        تعديل
                      </Button>
                      {(Number((o as { discount_egp?: number | null }).discount_egp ?? 0) === 0 &&
                        !(o as { coupon_code?: string | null }).coupon_code) ? (
                        <Button
                          variant="outline"
                          className="rounded-full font-bold text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingId(o.id)}
                        >
                          <Trash2 className="ms-1 h-4 w-4" />
                          حذف
                        </Button>
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">
                          مرتبط بخصم — لا يُحذف منفرداً
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <OrderEditDialog order={editing} open={editOpen} onOpenChange={setEditOpen} />
        <ReviewDialog
          orderId={reviewing?.orderId ?? null}
          storyTitle={reviewing?.title}
          open={Boolean(reviewing)}
          onOpenChange={(v) => !v && setReviewing(null)}
        />

        <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف الطلب؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف الطلب نهائياً مع صورة الطفل وإيصال التحويل. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
                onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              >
                نعم، احذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {(myPdfs ?? []).length > 0 && (
          <div className="mt-12">
            <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <FileDown className="h-5 w-5 text-grass" />
              ملفاتي PDF المحفوظة 📄
            </h2>
            <div className="mt-4 space-y-3">
              {(myPdfs ?? []).map((f) => (
                <div
                  key={f.name}
                  className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-border bg-card p-5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-xl">
                    📕
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-lg font-bold">{f.title}</h3>
                    {f.createdAt && (
                      <p className="text-sm text-muted-foreground">
                        {new Date(f.createdAt).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  {f.url && (
                    <Button asChild className="rounded-full font-bold">
                      <a href={f.url} target="_blank" rel="noopener noreferrer">
                        <FileDown className="ms-1 h-4 w-4" />
                        تحميل
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
