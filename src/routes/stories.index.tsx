import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Sparkles, Wand2, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { CardShimmer } from "@/components/CardShimmer";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBlock } from "@/components/ErrorBlock";
import { FilterChips } from "@/components/FilterChips";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StoryCard } from "@/features/library/StoryCard";
import { OCCASIONS, type OccasionKey } from "@/features/library/occasions";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/features/ai/storyTypes";

const searchSchema = z.object({
  occasion: z
    .enum([
      "birthday",
      "graduation",
      "ramadan",
      "eid",
      "back_to_school",
      "bedtime",
      "family",
      "adventure",
    ])
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/stories/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "مكتبة القصص — كيدزي" },
      {
        name: "description",
        content:
          "تصفح أكثر من 20 قصة أطفال نبيلة وإنسانية بأسلوب كرتوني ثلاثي الأبعاد، واجعل طفلك بطل الحكاية.",
      },
    ],
  }),
  component: StoriesPage,
});

function StoriesPage() {
  const navigate = Route.useNavigate();
  const { occasion } = Route.useSearch();
  const occasionKey = (occasion ?? null) as OccasionKey | null;
  const occasionMeta = OCCASIONS.find((o) => o.key === occasionKey) ?? null;

  const [category, setCategory] = useState<string | null>(null);

  const { data: stories, isLoading, isError, refetch } = useQuery({
    queryKey: ["stories", "story", occasionKey],
    queryFn: async () => {
      let q = supabase
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url, occasion")
        .eq("is_published", true)
        .eq("is_custom", false)
        .eq("content_type", "story")
        .order("created_at");
      if (occasionKey) q = q.eq("occasion", occasionKey);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // قصص منشورة من تنفيذ طلبات سابقة (من أعمالنا)
  const { data: galleryStories } = useQuery({
    queryKey: ["stories", "gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url")
        .eq("is_published", true)
        .eq("is_custom", true)
        .not("source_template_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = category
    ? (stories ?? []).filter((s) => s.category === category)
    : (stories ?? []);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold md:text-4xl">
              مكتبة الحكايات 📚
            </h1>
            <p className="mt-2 text-muted-foreground">
              اختر الحكاية التي سيكون طفلك بطلها
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="h-12 rounded-2xl bg-accent px-6 font-bold text-accent-foreground shadow-[var(--shadow-soft)] hover:opacity-95"
          >
            <Link to="/request-story">
              <Wand2 className="ms-2 h-5 w-5" />
              اطلب قصة بأفكارك الخاصة
            </Link>
          </Button>
        </div>

        {occasionMeta && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{occasionMeta.emoji}</span>
              <div>
                <Badge className="rounded-full bg-primary/15 text-primary">مناسبة</Badge>
                <h2 className="mt-1 font-display text-lg font-extrabold">{occasionMeta.label}</h2>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => navigate({ search: { occasion: undefined } })}
            >
              <X className="ms-1 h-4 w-4" />
              إزالة
            </Button>
          </div>
        )}

        <div className="mt-6">
          <FilterChips
            options={[...CATEGORIES]}
            value={category}
            onChange={setCategory}
          />
        </div>


        {isError ? (
          <ErrorBlock
            className="mt-10"
            title="تعذّر تحميل القصص"
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {isLoading ? (
              <CardShimmer count={8} />
            ) : (
              filtered.map((s) => <StoryCard key={s.id} story={s} />)
            )}
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState
            className="mt-12"
            icon={<BookOpen className="h-7 w-7" />}
            title="لا توجد قصص في هذا التصنيف بعد"
            description="جرّب تصنيفاً آخر."
          />
        )}

        {/* CTA: لم تجد ما يناسبك؟ أنشئ قصة جديدة */}
        <section className="mt-12 overflow-hidden rounded-3xl border-2 border-accent/40 bg-gradient-to-br from-accent/10 via-primary/5 to-candy/10 p-6 md:p-8">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-display text-2xl font-extrabold md:text-3xl">
                لم تجد القصة المناسبة؟ ✨
              </h3>
              <p className="mt-2 text-muted-foreground">
                ابدأ بقصة مخصصة بأفكار جديدة من اختيارك — اسم الطفل، الموضوع،
                والشخصيات — ودع الذكاء الاصطناعي يبدع لك حكاية فريدة.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="h-14 shrink-0 rounded-2xl bg-primary px-8 text-base font-bold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-95"
            >
              <Link to="/request-story">
                <Wand2 className="ms-2 h-5 w-5" />
                اطلب قصة بأفكارك الخاصة
              </Link>
            </Button>
          </div>
        </section>

        {/* قسم: من أعمالنا — قصص حقيقية لأبطال حقيقيين */}
        {galleryStories && galleryStories.length > 0 && (
          <section className="mt-16">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-pink-500" />
              <h2 className="font-display text-2xl font-extrabold md:text-3xl">
                من أعمالنا — أبطال حقيقيون ✨
              </h2>
            </div>
            <p className="mt-2 text-muted-foreground">
              قصص نُفّذت لأطفال حقيقيين على منصة كيدزي وأذِن أهلهم بمشاركتها كنموذج لأعمالنا.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {galleryStories.map((s) => <StoryCard key={s.id} story={s} />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
