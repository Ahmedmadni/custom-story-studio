import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminListReviews, adminModerateReview } from "@/features/reviews/reviews.functions";

export function ReviewsModerationList() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListReviews);
  const moderateFn = useServerFn(adminModerateReview);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => listFn(),
    refetchInterval: 30000,
  });

  const moderate = useMutation({
    mutationFn: (vars: { reviewId: string; action: "approve" | "reject" | "delete" }) =>
      moderateFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(
        vars.action === "approve"
          ? "تم نشر التقييم ✅"
          : vars.action === "delete"
            ? "تم حذف التقييم"
            : "تم إخفاء التقييم",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (reviews ?? []).filter((r) => !r.isPublished);
  const published = (reviews ?? []).filter((r) => r.isPublished);

  return (
    <section>
      <h2 className="font-display text-xl font-extrabold">تقييمات الأهالي ⭐</h2>
      <p className="text-sm text-muted-foreground">
        التقييمات لا تظهر في الصفحة الرئيسية إلا بعد اعتمادك هنا
      </p>
      <div className="mt-4 space-y-3">
        {isLoading ? (
          <Skeleton className="h-24 rounded-3xl" />
        ) : pending.length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
            لا توجد تقييمات بانتظار الاعتماد ✨
          </p>
        ) : (
          pending.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-sunny/40 bg-sunny/10 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-accent">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={i < r.rating ? "h-4 w-4 fill-accent" : "h-4 w-4"} />
                  ))}
                </div>
                {r.body && <p className="mt-1 text-sm">{r.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.storyTitle ?? "قصة"} · طفل: {r.childName ?? "—"}
                  {r.childAge ? ` (${r.childAge} سنوات)` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-full bg-grass font-bold text-grass-foreground hover:bg-grass/90"
                  disabled={moderate.isPending}
                  onClick={() => moderate.mutate({ reviewId: r.id, action: "approve" })}
                >
                  <Check className="ms-1 h-4 w-4" />
                  نشر
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full font-bold text-destructive"
                  disabled={moderate.isPending}
                  onClick={() => moderate.mutate({ reviewId: r.id, action: "delete" })}
                >
                  <Trash2 className="ms-1 h-4 w-4" />
                  حذف
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {published.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-muted-foreground">
            منشورة حالياً ({published.length})
          </h3>
          <div className="mt-2 space-y-2">
            {published.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3 text-sm"
              >
                <span className="truncate">
                  {"★".repeat(r.rating)} — {r.body ?? "بدون نص"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-full text-xs text-destructive"
                  disabled={moderate.isPending}
                  onClick={() => moderate.mutate({ reviewId: r.id, action: "reject" })}
                >
                  <X className="ms-1 h-3 w-3" />
                  إخفاء
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
