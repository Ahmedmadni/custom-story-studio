import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Film, Loader2, Receipt, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isKidzyVideoEnabled } from "@/features/video/config";
import { VideoUnavailable } from "@/features/video/VideoUnavailable";
import {
  listMyVideoOrders,
  replaceVideoPaymentReceipt,
} from "@/features/video/video-order.functions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImage } from "@/lib/imageOptimize";

export const Route = createFileRoute("/_authenticated/my-videos")({
  head: () => ({ meta: [{ title: "طلبات الفيديو — كيدزي" }] }),
  component: MyVideosPage,
});

function MyVideosPage() {
  const enabled = isKidzyVideoEnabled();
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyVideoOrders);
  const replaceReceiptFn = useServerFn(replaceVideoPaymentReceipt);
  const replaceReceipt = useMutation({
    mutationFn: async ({ orderId, file }: { orderId: string; file: File }) => {
      if (!user) throw new Error("سجّل الدخول أولاً");
      if (!file.type.startsWith("image/")) throw new Error("اختر صورة صالحة لإيصال التحويل");
      if (file.size > 8 * 1024 * 1024) throw new Error("حجم الإيصال يجب ألا يتجاوز 8 ميجابايت");

      const optimized = await optimizeImage(file, { maxWidth: 1800, quality: 0.85 });
      const ext = optimized.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const paymentReceiptPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("payment-receipts")
        .upload(paymentReceiptPath, optimized.file, { contentType: optimized.file.type });
      if (error) throw new Error("تعذر رفع إيصال التحويل");

      return replaceReceiptFn({ data: { orderId, paymentReceiptPath } });
    },
    onSuccess: () => {
      toast.success("تم رفع الإيصال الجديد — عاد الطلب لمراجعة الإدارة");
      void qc.invalidateQueries({ queryKey: ["my-video-orders"] });
    },
    onError: (error: Error) => toast.error(error.message || "تعذر تحديث الإيصال"),
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-video-orders"],
    queryFn: () => listFn(),
    enabled,
  });

  if (!enabled) {
    return (
      <div className="min-h-screen">
        <Header />
        <VideoUnavailable />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold">طلبات الفيديو 🎬</h1>
        <p className="mt-2 text-muted-foreground">متابعة مبسطة لطلبات الفيديو المخصص.</p>

        <div className="mt-8 space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-3xl" />
            ))
          ) : !orders?.length ? (
            <EmptyState
              icon={<Film className="h-7 w-7" />}
              title="لا توجد طلبات فيديو"
              description="اختر قصة متاحة للفيديو المخصص من مكتبة كيدزي."
              action={
                <Button asChild className="rounded-full">
                  <Link to="/stories">
                    <ShoppingCart className="ms-1 h-4 w-4" />
                    تصفح القصص
                  </Link>
                </Button>
              }
            />
          ) : (
            orders.map((order) => (
              <article
                key={order.id}
                className="rounded-3xl border-2 border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">{order.templateTitle}</h2>
                    <p className="text-sm text-muted-foreground">
                      البطل: {order.childName} ·{" "}
                      {new Date(order.createdAt).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
                    {order.statusLabel}
                  </span>
                </div>
                {order.expectedDeliveryAt && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    التسليم المتوقع:{" "}
                    {new Date(order.expectedDeliveryAt).toLocaleDateString("ar-EG")}
                  </p>
                )}
                {order.paymentNeedsAction && (
                  <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                    <p className="font-bold text-amber-800">
                      تعذر اعتماد الإيصال السابق. ارفع إيصالاً جديداً واضحاً لإعادة المراجعة.
                    </p>
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                      {replaceReceipt.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Receipt className="h-4 w-4" />
                      )}
                      رفع إيصال جديد
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={replaceReceipt.isPending}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) replaceReceipt.mutate({ orderId: order.id, file });
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                )}
                {order.finalDeliveryAvailable && order.finalVideoUrl ? (
                  <video
                    controls
                    src={order.finalVideoUrl}
                    className="mt-4 max-h-96 w-full rounded-2xl bg-black"
                  />
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    سيظهر الفيديو النهائي هنا بعد اكتمال الإنتاج والتسليم.
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
