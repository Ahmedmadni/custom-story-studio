import { createFileRoute } from "@tanstack/react-router";
import { AdminVideoQueue } from "@/features/video/AdminVideoQueue";

export const Route = createFileRoute("/_authenticated/admin/videos")({
  component: AdminVideosPage,
});
function AdminVideosPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold">إنتاج فيديو كيدزي 🎬</h1>
        <p className="mt-1 text-muted-foreground">
          طابور مستقل لمتابعة طلبات وإنتاج الفيديو المخصص.
        </p>
      </div>
      <AdminVideoQueue />
    </div>
  );
}
