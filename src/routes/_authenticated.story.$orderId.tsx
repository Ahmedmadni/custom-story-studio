import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PdfActions } from "@/components/PdfActions";
import { Button } from "@/components/ui/button";
import { getMyStory } from "@/lib/story.functions";

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
        </div>

        {/* Interactive flipbook */}
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
          <div className="bg-card p-6 text-center">
            {page?.title && (
              <h2 className="font-display text-2xl font-extrabold text-primary">
                {page.title}
              </h2>
            )}
            <p className="mt-2 font-display text-xl font-semibold leading-relaxed md:text-2xl">
              {page?.text}
            </p>
            <div className="mt-5 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                disabled={current === 0}
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                aria-label="الصفحة السابقة"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="flex gap-1.5">
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
                className="rounded-full"
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
            pages={pages.map((p) => ({
              n: p.n,
              title: p.title,
              text: p.text,
              imageUrl: p.imageUrl,
            }))}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            ملف PDF عالي الجودة بغلاف وجميع الصفحات — وتحفظ نسخة في حسابك تلقائياً
          </p>
        </div>

        {/* Print version: every page on its own sheet */}
        <div className="hidden print:block">
          <div className="print-page hidden min-h-screen flex-col items-center justify-center p-8 text-center">
            <h1 className="font-display text-5xl font-extrabold">{story.title}</h1>
            <p className="mt-6 text-2xl">بطل الحكاية: {story.childName} ⭐</p>
            {story.moral && <p className="mt-4 text-lg">القيمة: {story.moral}</p>}
          </div>
          {pages.map((p) => (
            <div
              key={p.n}
              className="print-page hidden min-h-screen flex-col items-center justify-center gap-5 p-8"
            >
              {p.title && (
                <h2 className="font-display text-3xl font-extrabold">{p.title}</h2>
              )}
              {p.imageUrl && (
                <img
                  src={p.imageUrl}
                  alt={p.title ?? `صفحة ${p.n}`}
                  className="max-h-[60vh] rounded-2xl object-contain"
                />
              )}
              <p className="max-w-2xl text-center font-display text-2xl leading-relaxed">
                {p.text}
              </p>
              <span className="text-sm text-muted-foreground">— {p.n} —</span>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
