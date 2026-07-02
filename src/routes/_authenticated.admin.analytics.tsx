import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsDashboard } from "@/features/admin/AnalyticsDashboard";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">تحليلات المبيعات 📊</h1>
        <p className="mt-1 text-muted-foreground">
          معدّل التحويل، الإيرادات، وأهم مصادر الربح
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
