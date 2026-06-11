import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export interface StoryCardData {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  age_range: string | null;
  cover_url: string | null;
  is_custom?: boolean;
}

export function StoryCard({ story }: { story: StoryCardData }) {
  return (
    <Link
      to="/stories/$slug"
      params={{ slug: story.slug }}
      className="group block overflow-hidden rounded-3xl border-2 border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-xl"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        {story.cover_url ? (
          <img
            src={story.cover_url}
            alt={`غلاف قصة ${story.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-secondary to-accent/20">
            <Sparkles className="h-12 w-12 text-primary/50" />
          </div>
        )}
        {story.category && (
          <Badge className="absolute start-3 top-3 rounded-full bg-card/90 text-foreground shadow">
            {story.category}
          </Badge>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-lg font-bold leading-snug">
          {story.title}
        </h3>
        {story.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {story.summary}
          </p>
        )}
        {story.age_range && (
          <p className="mt-2 text-xs font-semibold text-accent">
            مناسبة للأعمار {story.age_range}
          </p>
        )}
      </div>
    </Link>
  );
}
