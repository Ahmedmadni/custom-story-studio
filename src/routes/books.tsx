import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { useState } from "react";

import { CardShimmer } from "@/components/CardShimmer";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBlock } from "@/components/ErrorBlock";
import { FilterChips } from "@/components/FilterChips";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { StoryCard } from "@/features/library/StoryCard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/books")({
  head: () => ({
    meta: [
      { title: "الكتب التعليمية — كيدزي" },
      {
        name: "description",
        content:
          "كتب تعليمية ممتعة للأطفال: الحروف والأرقام والألوان والأشكال والعلوم، بأسلوب كرتوني ثلاثي الأبعاد وطفلك هو بطل التعلم.",
      },
      { property: "og:title", content: "الكتب التعليمية — كيدزي" },
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

  const {
    data: books,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["stories", "book"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url")
        .eq("is_published", true)
        .eq("is_custom", false)
        .eq("content_type", "book")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const categories = Array.from(
    new Set((books ?? []).map((b) => b.category).filter(Boolean)),
  ) as string[];

  const filtered = category ? (books ?? []).filter((b) => b.category === category) : (books ?? []);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12">
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">الكتب التعليمية 🎓</h1>
        <p className="mt-2 text-muted-foreground">
          كتب ممتعة تعلّم طفلك الحروف والأرقام والألوان والعلوم… وهو بطل كل صفحة
        </p>

        {categories.length > 0 && (
          <div className="mt-6">
            <FilterChips options={categories} value={category} onChange={setCategory} />
          </div>
        )}

        {isError ? (
          <ErrorBlock className="mt-10" title="تعذّر تحميل الكتب" onRetry={() => void refetch()} />
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {isLoading ? (
              <CardShimmer count={8} />
            ) : (
              filtered.map((b) => <StoryCard key={b.id} story={b} />)
            )}
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState
            className="mt-12"
            icon={<GraduationCap className="h-7 w-7" />}
            title="لا توجد كتب في هذا التصنيف بعد"
            description="جرّب تصنيفاً آخر، أو أنشئ كتاباً مخصصاً عن أي موضوع يحبه طفلك."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  className="rounded-full font-bold"
                  onClick={() => setCategory(null)}
                >
                  عرض كل الكتب
                </Button>
                <Button asChild className="rounded-full font-bold">
                  <Link to="/create">أنشئ كتاباً مخصصاً</Link>
                </Button>
              </div>
            }
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
