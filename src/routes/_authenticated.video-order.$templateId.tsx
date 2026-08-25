import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { isKidzyVideoEnabled } from "@/features/video/config";
import { VideoOrderForm } from "@/features/video/VideoOrderForm";
import { VideoUnavailable } from "@/features/video/VideoUnavailable";
import { getVideoOffering } from "@/features/video/video-order.functions";

export const Route = createFileRoute("/_authenticated/video-order/$templateId")({
  head: () => ({ meta: [{ title: "طلب فيديو مخصص — كيدزي" }] }),
  component: VideoOrderPage,
});

function VideoOrderPage() {
  const { templateId } = Route.useParams();
  const offeringFn = useServerFn(getVideoOffering);
  const enabled = isKidzyVideoEnabled();
  const { data: offering, isLoading } = useQuery({
    queryKey: ["video-offering", templateId],
    queryFn: () => offeringFn({ data: { templateId } }),
    enabled,
  });

  if (!enabled) {
    return (
      <div className="min-h-screen">
        <Header />
        <VideoUnavailable />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-10">
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !offering?.available ? (
          <VideoUnavailable />
        ) : (
          <>
            <div className="mb-8 text-center">
              <h1 className="font-display text-4xl font-extrabold">اطلب فيديو مخصص لطفلك</h1>
              <p className="mt-2 text-muted-foreground">
                اختر بيانات الطفل وخيارات الطلب، وسيتولى فريق كيدزي الإنتاج لاحقاً.
              </p>
            </div>
            <VideoOrderForm templateId={templateId} templateTitle={offering.templateTitle} />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
