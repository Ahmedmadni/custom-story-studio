import { createFileRoute } from "@tanstack/react-router";
import { AdminVideoWorkspace } from "@/features/video/AdminVideoWorkspace";

export const Route = createFileRoute("/_authenticated/admin/videos_/$videoOrderId")({
  component: WorkspacePage,
});
function WorkspacePage() {
  const { videoOrderId } = Route.useParams();
  return <AdminVideoWorkspace videoOrderId={videoOrderId} />;
}
