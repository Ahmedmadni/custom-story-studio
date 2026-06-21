import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PdfActions } from "@/features/pdf/PdfActions";
import { Button } from "@/components/ui/button";
import { getMyStory } from "@/features/orders/story.functions";

export const Route = createFileRoute("/_authenticated/story/$orderId")({
  head: () => ({
    meta: [{ title: "قصتك المخصصة — حكايتي" }],
  }),
  component: StoryViewer,
});

function StoryViewer() {
  const { orderId } = Route.useParams();
  const fetchStory = useServerFn(getMyStory);
  const [current, setCurrent] = useState(0);

  const { data: story, isLoading } = useQuery({
    queryKey: ["my-story", orderId],
    queryFn: () => fetchStory({ data: { orderId } }),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="py-24 text-center text-muted-foreground">
          القصة غير موجودة
        </div>
        <Footer />
      </div>
    );
  }

  const pages = story.pages;
  const page = pages[current];
  const isBilingual = story.language === "bilingual";
  const isUserApproved = !!story.approvedAt;
  const isAdminApproved = !!story.adminApprovedAt;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-10">
        <div className="text-center no-print">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-bold text-secondary-foreground">
            <Sparkles className="h-4 w-4" />
            حكاية {story.childName}
          </span>
          <h1 className="mt-3 font-display text-4xl font-extrabold">
            {story.title}
          </h1>
          {isBilingual && (
            <span className="mx-auto mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              عربي / English — Bilingual
            </span>
          )}
        </div>

        {!isAdminApproved && (
          <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-400/50 bg-amber-50/60 p-4 text-amber-900">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-5 w-5" />
              {isUserApproved
                ? "تم اعتمادك للمحتوى — بانتظار اعتماد الإدارة قبل تفعيل التصدير"
                : "المحتوى لم يُعتمد بعد — لا يمكن تصدير PDF قبل الاعتماد"}
            </div>
            {!isUserApproved && (
              <Button asChild size="sm" className="rounded-full font-bold">
                <Link to="/create">اذهب للاعتماد</Link>
              </Button>
            )}
          </div>
        )}

        <div className="no-print mt-8 overflow-hidden rounded-[2rem] border-4 border-secondary bg-card shadow-2xl">
          <div className="relative aspect-square w-full bg-secondary/30 md:aspect-[4/3]">
            {page?.imageUrl ? (
              <img
                src={page.imageUrl}
                alt={page.title ?? `صفحة ${page.n}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                الصورة قيد التجهيز…
              </div>
            )}
            <span className="absolute bottom-3 start-3 rounded-full bg-primary px-3.5 py-1 text-xs font-extrabold text-primary-foreground shadow-md">
              صفحة {page?.n}
            </span>
          </div>
          <div className="bg-card p-6">
            {isBilingual ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div dir="rtl" className="text-center md:border-e-2 md:border-secondary md:pe-4">
                  {page?.title_ar && (
                    <h2 className="font-display text-xl font-extrabold text-primary">
                      {page.title_ar}
                    </h2>
                  )}
                  <p className="mt-2 font-display text-lg font-semibold leading-relaxed">
                    {page?.text_ar ?? page?.text}
                  </p>
                </div>
                <div dir="ltr" className="text-center">
                  {page?.title_en && (
                    <h2 className="font-display text-xl font-extrabold text-primary">
                      {page.title_en}
                    </h2>
                  )}
                  <p className="mt-2 font-display text-lg font-semibold leading-relaxed">
                    {page?.text_en}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                {page?.title && (
                  <h2 className="font-display text-2xl font-extrabold text-primary">
                    {page.title}
                  </h2>
                )}
                <p className="mt-2 font-display text-xl font-semibold leading-relaxed md:text-2xl">
                  {page?.text}
                </p>
              </div>
            )}
            <div className="mt-5 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full min-h-11 min-w-11"
                disabled={current === 0}
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                aria-label="الصفحة السابقة"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="flex flex-wrap justify-center gap-1.5">
                {pages.map((p, i) => (
                  <button
                    key={p.n}
                    onClick={() => setCurrent(i)}
                    aria-label={`صفحة ${p.n}`}
                    className={`h-2.5 rounded-full transition-all ${
                      i === current ? "w-7 bg-primary" : "w-2.5 bg-border"
                    }`}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full min-h-11 min-w-11"
                disabled={current === pages.length - 1}
                onClick={() => setCurrent((c) => Math.min(pages.length - 1, c + 1))}
                aria-label="الصفحة التالية"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="no-print mt-6">
          <PdfActions
            title={story.title}
            childName={story.childName}
            moral={story.moral}
            language={story.language}
            contentType={story.contentType}
            templateId={story.templateId ?? undefined}
            disabled={!isApproved}
            disabledReason={!isApproved ? "اعتمد المحتوى أولاً من معالج الإنشاء" : undefined}
            pages={pages.map((p) => ({
              n: p.n,
              title: p.title,
              text: p.text,
              title_ar: p.title_ar,
              text_ar: p.text_ar,
              title_en: p.title_en,
              text_en: p.text_en,
              imageUrl: p.imageUrl,
            }))}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            ملف PDF عالي الجودة بغلاف وجميع الصفحات — وتحفظ نسخة في حسابك
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
