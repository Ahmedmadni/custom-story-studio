import { createFileRoute } from "@tanstack/react-router";

import { TemplatesManager } from "@/features/admin/TemplatesManager";

export const Route = createFileRoute("/_authenticated/admin/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">إدارة القوالب 📚</h1>
        <p className="mt-1 text-muted-foreground">قصص وكتب الموقع</p>
      </div>
      <TemplatesManager />
    </div>
  );
}
