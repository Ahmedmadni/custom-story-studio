import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Check, Heart, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FavoriteButton } from "@/features/library/FavoriteButton";
import { RecommendedStories } from "@/features/library/RecommendedStories";
import { supabase } from "@/integrations/supabase/client";
import { STARTING_PRICE_EGP, useCart } from "@/features/cart/CartContext";
import { parsePages } from "@/features/ai/storyTypes";

export const Route = createFileRoute("/stories/$slug")({
  head: () => ({
    meta: [{ title: "معاينة القصة — كيدزي" }],
  }),
  component: StoryPreview,
});

function StoryPreview() {
  const { slug } = Route.useParams();
  const { add, has, items } = useCart();
  const navigate = useNavigate();

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

  const { data: previousWorks } = useQuery({
    queryKey: ["story-previous-works", story?.id],
    enabled: Boolean(story?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, slug, title, cover_url, created_at")
        .eq("source_template_id", story!.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(24);
      return data ?? [];
    },
  });

  const inCart = story ? has(story.id) : false;
  const addToCart = () => {
    if (!story) return;
    add({
      templateId: story.id,
      slug: story.slug,
      title: story.title,
      coverUrl: story.cover_url,
      contentType: (story.content_type ?? "story") as "story" | "book",
      isCustom: Boolean((story as { is_custom?: boolean }).is_custom),
    });
    toast.success(`أُضيف «${story.title}» للسلة — ${items.length + 1} عنصر`);
  };

  const pages = parsePages(story?.pages);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12">
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

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {inCart ? (
                  <>
                    <Button
                      size="lg"
                      variant="outline"
                      className="rounded-full px-8 text-base font-bold"
                      disabled
                    >
                      <Check className="ms-2 h-5 w-5 text-grass" />
                      في السلة
                    </Button>
                    <Button
                      size="lg"
                      className="rounded-full px-8 text-base font-bold shadow-lg"
                      onClick={() => void navigate({ to: "/cart" })}
                    >
                      <ShoppingCart className="ms-2 h-5 w-5" />
                      اذهب للسلة
                    </Button>
                  </>
                ) : (
                  <Button
                    size="lg"
                    className="rounded-full px-10 text-base font-bold shadow-lg"
                    onClick={addToCart}
                  >
                    <ShoppingCart className="ms-2 h-5 w-5" />
                    أضف للسلة — ابتداءً من {STARTING_PRICE_EGP} ج
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                ادفع عبر فودافون كاش، ارفع صورة طفلك وإيصال السداد، وستصلك القصة على واتساب كملف PDF ✨
              </p>
              <div className="mt-4 inline-flex flex-wrap gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 text-xs font-bold text-primary">
                <span>📄 10 صفحات = 150 ج</span>
                <span className="text-primary/40">•</span>
                <span>📄 16 صفحة = 200 ج</span>
                <span className="text-primary/40">•</span>
                <span className="opacity-70">🖨️ النسخة المطبوعة قريباً</span>
              </div>


              {pages.length > 0 && (
                <div className="mt-10">
                  <h2 className="font-display text-xl font-bold">
                    معاينة مجانية — أول 3 صفحات 🎁
                  </h2>
                  <div className="mt-4 space-y-3">
                    {pages.slice(0, 3).map((p) => (
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
                  </div>

                  {/* Locked preview gate */}
                  <div className="relative mt-4 overflow-hidden rounded-3xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/10 via-card to-candy/10 p-6 text-center">
                    <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 blur-sm">
                      {pages.slice(3, 5).map((p) => (
                        <p key={p.n} className="line-clamp-2 px-6 py-2 text-sm">
                          {p.text.replaceAll("{child}", "بطلنا الصغير")}
                        </p>
                      ))}
                    </div>
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-3xl">
                      🔒
                    </div>
                    <h3 className="mt-3 font-display text-xl font-extrabold">
                      أكمل قصة طفلك الآن
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      اطلب القصة كاملة باسم طفلك ورسوماته الشخصية — توصلك خلال ساعات على واتساب.
                    </p>
                    {!inCart && (
                      <Button
                        size="lg"
                        onClick={addToCart}
                        className="mt-4 rounded-full px-8 text-base font-bold shadow-lg"
                      >
                        <ShoppingCart className="ms-2 h-5 w-5" />
                        اطلب القصة
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {story && previousWorks && previousWorks.length > 0 && (
          <section className="mt-16 border-t-2 border-dashed border-border pt-10">
            <div className="text-center">
              <h2 className="font-display text-2xl font-extrabold md:text-3xl">
                أعمالنا السابقة 🌟
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                قصص أطفال حقيقيين عاشوا مغامرة «{story.title}» — بإذنهم 💛
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {previousWorks.map((w) => (
                <Link
                  key={w.id}
                  to="/stories/$slug"
                  params={{ slug: w.slug }}
                  className="group overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
                >
                  <div className="aspect-square overflow-hidden bg-secondary">
                    {w.cover_url ? (
                      <img
                        src={w.cover_url}
                        alt={w.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <BookOpen className="h-10 w-10 text-primary/40" />
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 p-3 text-center text-sm font-bold">
                    {w.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
