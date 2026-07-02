import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, DollarSign, Repeat, ShoppingCart, TrendingUp, Users } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { adminGetAnalytics } from "@/features/admin/analytics.functions";

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border-2 border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-bold">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AnalyticsDashboard() {
  const fetchFn = useServerFn(adminGetAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => fetchFn(),
    refetchInterval: 60000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          icon={TrendingUp}
          label="معدّل إتمام الدفع"
          value={`${data.conversionRatePct}%`}
          hint={`${data.verifiedOrders} من ${data.totalOrders} طلب`}
        />
        <StatTile
          icon={DollarSign}
          label="الإيرادات المؤكدة"
          value={`${data.revenueEgp.toLocaleString("ar-EG")} ج`}
        />
        <StatTile
          icon={ShoppingCart}
          label="متوسط قيمة الطلب"
          value={`${data.averageOrderValueEgp} ج`}
        />
        <StatTile
          icon={Repeat}
          label="معدّل الشراء المتكرر"
          value={`${data.repeatPurchaseRatePct}%`}
          hint="من العملاء الذين اشتروا أكثر من مرة"
        />
        <StatTile
          icon={Users}
          label="معدّل الاحتفاظ الشهري"
          value={`${data.retentionRatePct}%`}
          hint="عادوا خلال 30 يوماً من نشاطهم السابق"
        />
        <StatTile
          icon={BarChart3}
          label="عدد الطلبات المؤكدة"
          value={String(data.verifiedOrders)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-3xl border-2 border-border bg-card p-5">
          <h2 className="font-display text-lg font-extrabold">أهم التصنيفات</h2>
          <div className="mt-4 space-y-2">
            {data.topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد بيانات كافية بعد</p>
            ) : (
              data.topCategories.map((c) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{c.category}</span>
                  <span className="text-muted-foreground">
                    {c.count} طلب · <span className="font-bold text-primary">{c.revenue} ج</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border-2 border-border bg-card p-5">
          <h2 className="font-display text-lg font-extrabold">أكثر القوالب ربحية</h2>
          <div className="mt-4 space-y-2">
            {data.topTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد بيانات كافية بعد</p>
            ) : (
              data.topTemplates.map((t) => (
                <div key={t.title} className="flex items-center justify-between text-sm">
                  <span className="truncate font-semibold">{t.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {t.count} طلب · <span className="font-bold text-primary">{t.revenue} ج</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
