import { createFileRoute } from "@tanstack/react-router";
import { AdminVideoWorkspace } from "@/features/video/AdminVideoWorkspace";

export const Route = createFileRoute("/_authenticated/admin/videos/$videoOrderId")({
  component: AdminVideoProjectPage,
});
function AdminVideoProjectPage() {
  const { videoOrderId } = Route.useParams();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold">مساحة إنتاج الفيديو</h1>
        <p className="mt-1 text-muted-foreground">
          مراجعة تشغيلية داخلية؛ لا تظهر هذه التفاصيل للعميل.
        </p>
      </div>
      <AdminVideoWorkspace orderId={videoOrderId} />
    </div>
  );
}
