import { createFileRoute } from "@tanstack/react-router";

import { OrdersManager } from "@/features/admin/OrdersManager";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">إدارة الطلبات 📦</h1>
        <p className="mt-1 text-muted-foreground">متابعة وإدارة كل طلبات العملاء</p>
      </div>
      <OrdersManager />
    </div>
  );
}
