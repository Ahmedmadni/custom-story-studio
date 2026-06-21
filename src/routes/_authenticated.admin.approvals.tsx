import { createFileRoute } from "@tanstack/react-router";

import { PendingTemplatesList } from "@/features/admin/PendingTemplatesList";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">اعتماد المحتوى ✅</h1>
        <p className="mt-1 text-muted-foreground">مراجعة واعتماد قصص المستخدمين قبل التحميل</p>
      </div>
      <PendingTemplatesList />
    </div>
  );
}
