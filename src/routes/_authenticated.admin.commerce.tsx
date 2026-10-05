import { createFileRoute } from "@tanstack/react-router";

import { CommerceManager } from "@/features/admin/CommerceManager";

export const Route = createFileRoute("/_authenticated/admin/commerce")({
  component: CommercePage,
});

function CommercePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold">العروض والمكافآت 🎁</h1>
        <p className="mt-1 text-muted-foreground">
          إدارة أكواد الخصم وأرصدة نقاط العملاء من داخل كيدزي.
        </p>
      </div>
      <CommerceManager />
    </div>
  );
}
