import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Heart, ShoppingCart } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StoryCard } from "@/features/library/StoryCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [{ title: "المفضلة — كيدزي" }],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useAuth();
  const { data: items, isLoading } = useQuery({
    queryKey: ["favorites", "list", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("favorites")
        .select(
          "template_id, created_at, story_templates!favorites_template_id_fkey(id, slug, title, summary, category, age_range, cover_url)",
        )
        .order("created_at", { ascending: false });
      return (data ?? [])
        .map((r) => (r as { story_templates: unknown }).story_templates)
        .filter(Boolean) as Array<{
        id: string;
        slug: string;
        title: string;
        summary: string | null;
        category: string | null;
        age_range: string | null;
        cover_url: string | null;
      }>;
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold md:text-4xl">
              <Heart className="h-7 w-7 fill-pink-500 text-pink-500" />
              قصصي المفضّلة
            </h1>
            <p className="mt-2 text-muted-foreground">كل القصص اللي حفظتها لطفلك في مكان واحد</p>
          </div>
          <Button asChild className="rounded-full" variant="outline">
            <Link to="/stories">
              <ShoppingCart className="ms-2 h-4 w-4" />
              تصفّح المزيد
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-3xl" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <EmptyState
            className="mt-12"
            icon={<Heart className="h-7 w-7" />}
            title="لا توجد قصص في المفضلة بعد"
            description="اضغط على القلب ❤️ بجانب أي قصة لإضافتها هنا."
            action={
              <Button asChild className="rounded-full font-bold">
                <Link to="/stories">تصفّح القصص</Link>
              </Button>
            }
          />
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {items.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
