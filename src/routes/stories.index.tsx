import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StoryCard } from "@/components/StoryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/storyTypes";

export const Route = createFileRoute("/stories/")({
  head: () => ({
    meta: [
      { title: "مكتبة القصص — حكايتي" },
      {
        name: "description",
        content: "تصفح أكثر من 20 قصة أطفال نبيلة وإنسانية بأسلوب كرتوني ثلاثي الأبعاد، واجعل طفلك بطل الحكاية.",
      },
    ],
  }),
  component: StoriesPage,
});

function StoriesPage() {
  const [category, setCategory] = useState<string | null>(null);

  const { data: stories, isLoading } = useQuery({
    queryKey: ["stories", "story"],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url")
        .eq("is_published", true)
        .eq("is_custom", false)
        .eq("content_type", "story")
        .order("created_at");
      return data ?? [];
    },
  });

  const filtered = category
    ? (stories ?? []).filter((s) => s.category === category)
    : (stories ?? []);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">
          مكتبة الحكايات 📚
        </h1>
        <p className="mt-2 text-muted-foreground">
          اختر الحكاية التي سيكون طفلك بطلها
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(null)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              category === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-primary/15"
            }`}
          >
            الكل
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                category === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-primary/15"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-3xl" />
              ))
            : filtered.map((s) => <StoryCard key={s.id} story={s} />)}
        </div>

        {!isLoading && filtered.length === 0 && (
          <p className="mt-16 text-center text-muted-foreground">
            لا توجد قصص في هذا التصنيف بعد
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
