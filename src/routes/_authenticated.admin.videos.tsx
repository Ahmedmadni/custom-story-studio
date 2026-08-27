import { createFileRoute } from "@tanstack/react-router";
import { AdminVideoQueue } from "@/features/video/AdminVideoQueue";

export const Route = createFileRoute("/_authenticated/admin/videos")({ component: VideosPage });
function VideosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">طابور إنتاج الفيديو 🎬</h1>
        <p className="text-muted-foreground">إدارة مستقلة لطلبات Kidzy Video</p>
      </div>
      <AdminVideoQueue />
    </div>
  );
}
