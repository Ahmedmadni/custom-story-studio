import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Sparkles, Star } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { coverUrlOrDefault } from "@/lib/defaultCover";

/**
 * "قصص أنشأناها" (F2) — كاروسيل Netflix-style من قصص حقيقية نُشرت من طلبات
 * فعلية بموافقة الأهل (publish_consent → source_order_id على story_templates).
 * التقييم (إن وُجد) يأتي من تقييم الأهل المنشور لنفس الطلب.
 */
export function PortfolioGallery() {
  const { data: items } = useQuery({
    queryKey: ["portfolio-gallery"],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, slug, title, cover_url, category, age_range, created_at, source_order_id")
        .not("source_order_id", "is", null)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  const orderIds = (items ?? [])
    .map((i) => i.source_order_id)
    .filter((v): v is string => Boolean(v));

  const { data: reviews } = useQuery({
    queryKey: ["portfolio-reviews", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("order_id, rating")
        .eq("is_published", true)
        .in("order_id", orderIds);
      return data ?? [];
    },
  });

  if (!items || items.length === 0) return null;

  const ratingFor = (orderId: string | null) =>
    (reviews ?? []).find((r) => r.order_id === orderId)?.rating ?? null;

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold md:text-3xl">
            <Sparkles className="h-6 w-6 text-primary" />
            قصص أنشأناها
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            أعمال حقيقية لأطفال حقيقيين — بإذن أهاليهم 💛
          </p>
        </div>
      </div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((s) => {
          const rating = ratingFor(s.source_order_id);
          return (
            <Link
              key={s.id}
              to="/stories/$slug"
              params={{ slug: s.slug }}
              className="group relative w-[210px] shrink-0 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-all hover:-translate-y-1.5 hover:shadow-[var(--shadow-card)] md:w-[240px]"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                <img
                  src={coverUrlOrDefault(s.cover_url)}
                  alt={s.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 text-white">
                  <h3 className="line-clamp-2 font-display text-sm font-extrabold leading-tight drop-shadow">
                    {s.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold opacity-90">
                    {s.age_range && <span>👶 {s.age_range}</span>}
                    {s.category && <span>· {s.category}</span>}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-bold opacity-90">
                    {rating ? (
                      <span className="inline-flex items-center gap-1 text-accent">
                        <Star className="h-3 w-3 fill-accent" /> {rating}/5
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 opacity-70">
                        <BookOpen className="h-3 w-3" /> قصة مخصّصة
                      </span>
                    )}
                    <span>
                      {new Date(s.created_at).toLocaleDateString("ar-EG", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
