import { Link, createFileRoute } from "@tanstack/react-router";
import { Library, Package, ShieldCheck, Users } from "lucide-react";

import { UsagePanel } from "@/features/admin/UsagePanel";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">نظرة عامة 🛠️</h1>
        <p className="mt-1 text-muted-foreground">إحصاءات سريعة واختصارات لإدارة المنصة</p>
      </div>

      <UsagePanel />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Shortcut to="/admin/orders" icon={Package} label="الطلبات" desc="إدارة طلبات العملاء" />
        <Shortcut to="/admin/approvals" icon={ShieldCheck} label="اعتماد المحتوى" desc="مراجعة قصص المستخدمين" />
        <Shortcut to="/admin/templates" icon={Library} label="القوالب" desc="قصص وكتب الموقع" />
        <Shortcut to="/admin/users" icon={Users} label="المستخدمون" desc="إدارة الحسابات" />
      </div>
    </div>
  );
}

function Shortcut({ to, icon: Icon, label, desc }: {
  to: string;
  icon: typeof Package;
  label: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-3xl border-2 border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
    >
      <Icon className="h-6 w-6 text-primary" />
      <p className="mt-2 font-display font-bold">{label}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}
