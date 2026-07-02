import { createFileRoute } from "@tanstack/react-router";

import { AdminHealthDashboard } from "@/features/admin/AdminHealthDashboard";

export const Route = createFileRoute("/_authenticated/admin/health")({
  component: HealthPage,
});

function HealthPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">صحة النظام 🩺</h1>
        <p className="mt-1 text-muted-foreground">
          مؤشرات تشغيلية سريعة قبل الإطلاق وبعده — طلبات عالقة، إيرادات، ومستخدمون نشطون
        </p>
      </div>
      <AdminHealthDashboard />
    </div>
  );
}
