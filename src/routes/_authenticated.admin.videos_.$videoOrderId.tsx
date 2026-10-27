import { createFileRoute } from "@tanstack/react-router";
import { AdminVideoWorkspace } from "@/features/video/AdminVideoWorkspace";

export const Route = createFileRoute("/_authenticated/admin/videos_/$videoOrderId")({
  head: () => ({ meta: [
    { title: "مساحة إنتاج الفيديو المخصص — كيدزي" },
    { name: "description", content: "إنتاج ومراجعة مشاهد فيديو الطفل المخصص واعتماد الإصدار النهائي في كيدزي." },
    { property: "og:title", content: "مساحة إنتاج الفيديو المخصص — كيدزي" },
    { property: "og:description", content: "إنتاج ومراجعة مشاهد فيديو الطفل المخصص واعتماد الإصدار النهائي في كيدزي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: WorkspacePage,
});
function WorkspacePage() {
  const { videoOrderId } = Route.useParams();
  return <AdminVideoWorkspace videoOrderId={videoOrderId} />;
}
