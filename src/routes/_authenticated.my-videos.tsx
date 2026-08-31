import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Film, ShoppingCart } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isKidzyVideoEnabled } from "@/features/video/config";
import { VideoUnavailable } from "@/features/video/VideoUnavailable";
import { listMyVideoOrders } from "@/features/video/video-order.functions";

export const Route = createFileRoute("/_authenticated/my-videos")({
  head: () => ({ meta: [{ title: "طلبات الفيديو — كيدزي" }] }),
  component: MyVideosPage,
});

function MyVideosPage() {
  const enabled = isKidzyVideoEnabled();
  const listFn = useServerFn(listMyVideoOrders);
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
