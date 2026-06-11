import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Wand2 } from "lucide-react";
import { useState } from "react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StoryCard } from "@/components/StoryCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/books")({
  head: () => ({
    meta: [
      { title: "الكتب التعليمية — حكايتي" },
      {
        name: "description",
        content:
          "كتب تعليمية ممتعة للأطفال: الحروف والأرقام والألوان والأشكال والعلوم، بأسلوب كرتوني ثلاثي الأبعاد وطفلك هو بطل التعلم.",
      },
      { property: "og:title", content: "الكتب التعليمية — حكايتي" },
      {
        property: "og:description",
        content: "كتب تعليمية ممتعة للأطفال بأسلوب كرتوني ثلاثي الأبعاد.",
      },
    ],
  }),
  component: BooksPage,
});

function BooksPage() {
  const [category, setCategory] = useState<string | null>(null);

  const { data: books, isLoading } = useQuery({
    queryKey: ["stories", "book"],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url")
        .eq("is_published", true)
        .eq("is_custom", false)
        .eq("content_type", "book")
        .order("created_at");
      return data ?? [];
    },
  });

  const categories = Array.from(
    new Set((books ?? []).map((b) => b.category).filter(Boolean)),
  ) as string[];

  const filtered = category
    ? (books ?? []).filter((b) => b.category === category)
    : (books ?? []);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">
          الكتب التعليمية 🎓
        </h1>
        <p className="mt-2 text-muted-foreground">
          كتب ممتعة تعلّم طفلك الحروف والأرقام والألوان والعلوم… وهو بطل كل صفحة
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
          {categories.map((c) => (
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
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-3xl" />
              ))
            : filtered.map((b) => <StoryCard key={b.id} story={b} />)}
        </div>

        {!isLoading && filtered.length === 0 && (
          <p className="mt-16 text-center text-muted-foreground">
            لا توجد كتب في هذا التصنيف بعد
          </p>
        )}

        <div className="mt-14 rounded-3xl border-2 border-dashed border-primary/40 bg-secondary/30 p-8 text-center">
          <h2 className="font-display text-2xl font-extrabold">
            تريد كتاباً عن موضوع آخر؟
          </h2>
          <p className="mt-2 text-muted-foreground">
            أنشئ كتاباً تعليمياً مخصصاً عن أي موضوع بالذكاء الاصطناعي خلال دقيقة
          </p>
          <Button asChild size="lg" className="mt-4 rounded-full px-8 font-bold shadow-lg">
            <Link to="/create">
              <Wand2 className="ms-2 h-5 w-5" />
              أنشئ كتاباً الآن
            </Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
