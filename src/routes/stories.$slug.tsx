import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Check, Heart, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { PRICE_PER_ITEM_EGP, useCart } from "@/features/cart/CartContext";
import { parsePages } from "@/features/ai/storyTypes";

export const Route = createFileRoute("/stories/$slug")({
  head: () => ({
    meta: [{ title: "معاينة القصة — حكايتي" }],
  }),
  component: StoryPreview,
});

function StoryPreview() {
  const { slug } = Route.useParams();

  const { data: story, isLoading } = useQuery({
    queryKey: ["story", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });

  const pages = parsePages(story?.pages);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-10">
        {isLoading ? (
          <div className="grid gap-8 md:grid-cols-2">
            <Skeleton className="aspect-[3/4] rounded-3xl" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : !story ? (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">القصة غير موجودة</p>
            <Button asChild className="mt-4 rounded-full">
              <Link to="/stories">العودة للمكتبة</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-10 md:grid-cols-2">
            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute -inset-3 rounded-[2.5rem] bg-gradient-to-tr from-primary/25 via-secondary to-accent/25 blur-xl" />
              {story.cover_url ? (
                <img
                  src={story.cover_url}
                  alt={`غلاف قصة ${story.title}`}
                  className="relative aspect-[3/4] w-full rounded-3xl border-4 border-card object-cover shadow-2xl"
                />
              ) : (
                <div className="relative flex aspect-[3/4] w-full items-center justify-center rounded-3xl border-4 border-card bg-gradient-to-br from-primary/20 via-secondary to-accent/20 shadow-2xl">
                  <BookOpen className="h-16 w-16 text-primary/50" />
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap gap-2">
                {story.category && (
                  <Badge className="rounded-full bg-secondary text-secondary-foreground">
                    {story.category}
                  </Badge>
                )}
                {story.age_range && (
                  <Badge className="rounded-full bg-primary/15 text-primary">
                    الأعمار {story.age_range}
                  </Badge>
                )}
              </div>
              <h1 className="mt-4 font-display text-4xl font-extrabold">
                {story.title}
              </h1>
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                {story.summary}
              </p>
              {story.moral && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl bg-secondary/60 p-4">
                  <Heart className="mt-0.5 h-5 w-5 shrink-0 text-candy" />
                  <p className="text-sm font-semibold">
                    القيمة المستفادة: {story.moral}
                  </p>
                </div>
              )}

              <div className="mt-8">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full px-10 text-base font-bold shadow-lg"
                >
                  <Link to="/order/$templateId" params={{ templateId: story.id }}>
                    <Camera className="ms-2 h-5 w-5" />
                    اطلبها بصورة طفلك
                  </Link>
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  سيتحول طفلك إلى بطل كرتوني ثلاثي الأبعاد في كل صفحات القصة ✨
                </p>
              </div>

              {pages.length > 0 && (
                <div className="mt-10">
                  <h2 className="font-display text-xl font-bold">
                    لمحة من الحكاية
                  </h2>
                  <div className="mt-4 space-y-3">
                    {pages.slice(0, 2).map((p) => (
                      <div
                        key={p.n}
                        className="rounded-2xl border-2 border-border bg-card p-4"
                      >
                        <span className="text-xs font-bold text-accent">
                          الصفحة {p.n}
                        </span>
                        <p className="mt-1 leading-relaxed">
                          {p.text.replaceAll("{child}", "بطلنا الصغير")}
                        </p>
                      </div>
                    ))}
                    <p className="text-center text-sm text-muted-foreground">
                      … وتتوالى المفاجآت في باقي الصفحات 🎈
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
