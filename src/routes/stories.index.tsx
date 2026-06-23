import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Sparkles } from "lucide-react";
import { useState } from "react";

import { CardShimmer } from "@/components/CardShimmer";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBlock } from "@/components/ErrorBlock";
import { FilterChips } from "@/components/FilterChips";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StoryCard } from "@/features/library/StoryCard";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/features/ai/storyTypes";

export const Route = createFileRoute("/stories/")({
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
  const [category, setCategory] = useState<string | null>(null);

  const { data: stories, isLoading, isError, refetch } = useQuery({
    queryKey: ["stories", "story"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url")
        .eq("is_published", true)
        .eq("is_custom", false)
        .eq("content_type", "story")
        .order("created_at");
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
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">
          مكتبة الحكايات 📚
        </h1>
        <p className="mt-2 text-muted-foreground">
          اختر الحكاية التي سيكون طفلك بطلها
        </p>

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
