import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminApproveTemplate,
  adminListPendingTemplates,
  adminRejectTemplate,
} from "@/features/ai/ai.functions";

export function PendingTemplatesList() {
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
      toast.success("تم اعتماد المحتوى ✅");
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
    <section>
      <h2 className="font-display text-xl font-extrabold">محتوى ينتظر اعتمادك ✋</h2>
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
                  {t.language === "ar" ? "عربي" : t.language === "en" ? "English" : "ثنائي"}
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
