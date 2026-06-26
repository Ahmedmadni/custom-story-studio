import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CreditCard, DollarSign, ShoppingBag, TrendingUp } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({ meta: [{ title: "المدفوعات — كيدزي" }] }),
  component: AdminPaymentsPage,
});

type OrderRow = {
  id: string;
  price_egp: number;
  payment_provider: string | null;
  payment_status: string;
  template_id: string;
  created_at: string;
};

type TemplateRow = { id: string; title: string };

type LogRow = {
  id: string;
  kashier_order_id: string | null;
  status: string | null;
  amount: number | null;
  signature_ok: boolean;
  created_at: string;
};

function AdminPaymentsPage() {
  const ordersQ = useQuery({
    queryKey: ["admin-payments-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, price_egp, payment_provider, payment_status, template_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const templatesQ = useQuery({
    queryKey: ["admin-payments-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_templates")
        .select("id, title");
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const logsQ = useQuery({
    queryKey: ["admin-payments-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_logs")
        .select("id, kashier_order_id, status, amount, signature_ok, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const orders = ordersQ.data ?? [];
  const templates = templatesQ.data ?? [];
  const logs = logsQ.data ?? [];

  const verified = orders.filter((o) => o.payment_status === "verified");
  const failed = orders.filter((o) => o.payment_status === "rejected");
  const revenue = verified.reduce((s, o) => s + (o.price_egp ?? 0), 0);
  const kashierVerified = verified.filter((o) => o.payment_provider === "kashier");
  const vodafoneVerified = verified.filter((o) => o.payment_provider !== "kashier");

  const titleById = new Map(templates.map((t) => [t.id, t.title]));
  const salesByTemplate = new Map<string, { count: number; revenue: number }>();
  verified.forEach((o) => {
    const prev = salesByTemplate.get(o.template_id) ?? { count: 0, revenue: 0 };
    prev.count += 1;
    prev.revenue += o.price_egp ?? 0;
    salesByTemplate.set(o.template_id, prev);
  });
  const topStories = [...salesByTemplate.entries()]
    .map(([id, v]) => ({ id, title: titleById.get(id) ?? "—", ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-extrabold">المدفوعات والإيرادات</h1>
        <p className="text-sm text-muted-foreground">نظرة شاملة على المبيعات وعمليات الدفع.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="إجمالي الإيرادات" value={`${revenue.toLocaleString()} ج`} tone="emerald" />
        <StatCard icon={ShoppingBag} label="قصص مدفوعة" value={verified.length} tone="primary" />
        <StatCard icon={CreditCard} label="مدفوعات Kashier" value={kashierVerified.length} sub={`${kashierVerified.reduce((s,o)=>s+(o.price_egp??0),0)} ج`} tone="blue" />
        <StatCard icon={AlertCircle} label="مدفوعات فاشلة" value={failed.length} tone="red" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <TrendingUp className="h-4 w-4 text-primary" />
            القصص الأكثر مبيعًا
          </h2>
          {topStories.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">لا توجد مبيعات بعد.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topStories.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-xs font-extrabold text-primary">
                      {i + 1}
                    </span>
                    <span className="line-clamp-1 text-sm font-bold">{s.title}</span>
                  </div>
                  <div className="text-end text-xs">
                    <div className="font-bold">{s.count} عملية</div>
                    <div className="text-muted-foreground">{s.revenue} ج</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <CreditCard className="h-4 w-4 text-primary" />
            سجل تأكيدات Kashier
          </h2>
          {logs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">لم تستلم بعد أي تأكيدات.</p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">الطلب</th>
                    <th className="p-2">الحالة</th>
                    <th className="p-2">المبلغ</th>
                    <th className="p-2">التوقيع</th>
                    <th className="p-2">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="p-2 font-mono">{(l.kashier_order_id ?? "").slice(0, 18)}</td>
                      <td className="p-2 text-center">{l.status ?? "—"}</td>
                      <td className="p-2 text-center">{l.amount ?? 0} ج</td>
                      <td className="p-2 text-center">
                        {l.signature_ok ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">صحيح</span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">مرفوض</span>
                        )}
                      </td>
                      <td className="p-2 text-center text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("ar-EG")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        تحويلات فودافون كاش المؤكدة: {vodafoneVerified.length} ·
        إيرادات Kashier: {kashierVerified.reduce((s, o) => s + (o.price_egp ?? 0), 0)} ج ·
        إيرادات فودافون: {vodafoneVerified.reduce((s, o) => s + (o.price_egp ?? 0), 0)} ج
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  tone: "emerald" | "primary" | "blue" | "red";
}) {
  const toneClass: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-sm">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${toneClass[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-xs font-bold text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
