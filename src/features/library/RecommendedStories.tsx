import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { StoryCard } from "@/features/library/StoryCard";
import { getRecommendedStories } from "@/features/library/recommendations.functions";

export function RecommendedStories({
  excludeTemplateId,
  category,
  title = "قد يعجبك أيضاً",
  subtitle = "اخترناها بناءً على ما يفضّله طفلك",
}: {
  excludeTemplateId?: string | null;
  category?: string | null;
  title?: string;
  subtitle?: string;
}) {
  const { data: items } = useQuery({
    queryKey: ["recommendations", excludeTemplateId, category],
    queryFn: () =>
      getRecommendedStories({
        data: {
          excludeTemplateId: excludeTemplateId ?? null,
          category: category ?? null,
          limit: 8,
        },
      }),
  });

  if (!items || items.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold md:text-3xl">
            <Sparkles className="h-6 w-6 text-primary" />
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((s) => (
          <div key={s.id} className="w-[220px] shrink-0 md:w-[240px]">
            <StoryCard story={s} />
          </div>
        ))}
      </div>
    </section>
  );
}
