import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, ExternalLink, KeyRound, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminGetUsageStats } from "@/features/admin/admin.functions";

export function UsagePanel() {
  const statsFn = useServerFn(adminGetUsageStats);
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-usage-stats"],
    queryFn: () => statsFn(),
    refetchInterval: 60000,
  });

  if (isLoading || !stats) {
    return <Skeleton className="h-40 rounded-3xl" />;
  }

  return (
    <section className="rounded-3xl border-2 border-primary/30 bg-gradient-to-bl from-primary/5 to-sunny/10 p-6">
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
          <a href="https://lovable.dev/projects" target="_blank" rel="noreferrer">
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
        <StatCard label="تكلفة الصورة الواحدة" value={`~$${stats.costPerImageUsd.toFixed(3)}`} hint={stats.currentImageModel} />
        <StatCard label="تكلفة آخر 30 يوماً" value={`~$${stats.estimatedCostUsd30d.toFixed(2)}`} hint="تقديري" />
        <StatCard label="إجمالي التكلفة" value={`~$${stats.estimatedCostUsdTotal.toFixed(2)}`} hint="منذ بداية المشروع" />
      </div>

      <div className="mt-5 rounded-2xl border-2 border-border bg-card/60 p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold">
          <KeyRound className="h-4 w-4 text-grass" />
          مزودات الذكاء الاصطناعي المُهيأة
        </h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <ProviderChip name="Lovable AI Gateway" active={stats.providers.lovable} primary />
          <ProviderChip name="OpenAI" active={stats.providers.openai} />
          <ProviderChip name="Google Gemini" active={stats.providers.gemini} />
          <ProviderChip name="Stability AI" active={stats.providers.stability} />
          <ProviderChip name="Replicate / FLUX" active={stats.providers.replicate} />
        </div>
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
