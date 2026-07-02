import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock, DollarSign, PackageOpen, TrendingUp, Users } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { adminGetHealth } from "@/features/admin/health.functions";

function HealthTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-3xl border-2 p-5 ${
        tone === "warning" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={`h-4 w-4 ${tone === "warning" ? "text-destructive" : ""}`} />
        <span className="text-xs font-bold">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AdminHealthDashboard() {
  const fetchFn = useServerFn(adminGetHealth);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => fetchFn(),
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.stuckOrders > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-4 text-sm font-bold text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {data.stuckOrders} طلب عالق في التوليد لأكثر من 6 ساعات — راجع قسم «الطلبات»
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HealthTile
          icon={AlertTriangle}
          label="طلبات عالقة (Failed jobs)"
          value={String(data.stuckOrders)}
          hint="قيد التوليد لأكثر من 6 ساعات"
          tone={data.stuckOrders > 0 ? "warning" : "default"}
        />
        <HealthTile icon={PackageOpen} label="طلبات معلّقة" value={String(data.pendingOrders)} />
        <HealthTile icon={Clock} label="متوسط التسليم" value={`${data.avgDeliveryHours} ساعة`} />
        <HealthTile
          icon={DollarSign}
          label="إيرادات اليوم"
          value={`${data.revenueTodayEgp.toLocaleString("ar-EG")} ج`}
        />
        <HealthTile
          icon={Users}
          label="مستخدمون نشطون اليوم"
          value={String(data.activeUsersToday)}
        />
        <HealthTile icon={TrendingUp} label="معدّل التحويل" value={`${data.conversionRatePct}%`} />
        <HealthTile
          icon={AlertTriangle}
          label="سجلات الأخطاء (تقريبية)"
          value={String(data.rejectedPaymentsLast7d)}
          hint="مدفوعات مرفوضة آخر 7 أيام — لا يوجد نظام تسجيل أخطاء مركزي"
          tone={data.rejectedPaymentsLast7d > 0 ? "warning" : "default"}
        />
      </div>
    </div>
  );
}
