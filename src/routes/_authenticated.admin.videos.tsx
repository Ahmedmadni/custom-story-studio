import { createFileRoute } from "@tanstack/react-router";
import { AdminVideoQueue } from "@/features/video/AdminVideoQueue";

export const Route = createFileRoute("/_authenticated/admin/videos")({
  head: () => ({ meta: [
    { title: "إدارة إنتاج الفيديو — كيدزي" },
    { name: "description", content: "متابعة طلبات الفيديو المخصصة ومراحل إنتاجها في كيدزي." },
    { property: "og:title", content: "إدارة إنتاج الفيديو — كيدزي" },
    { property: "og:description", content: "متابعة طلبات الفيديو المخصصة ومراحل إنتاجها في كيدزي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VideosPage,
});
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
