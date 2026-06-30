import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Sparkles, BookOpen } from "lucide-react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChildAvatar } from "@/features/children/ChildAvatar";
import { levelFor } from "@/features/rewards/levels";

export const Route = createFileRoute("/_authenticated/my-children")({
  head: () => ({ meta: [{ title: "أطفالي — كيدزي" }] }),
  component: MyChildrenPage,
});

function MyChildrenPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["children", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("child_profiles")
        .select("*, child_story_universe(level, experience_points, story_count)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold md:text-4xl">
              <Sparkles className="h-7 w-7 text-primary" />
              أطفالي
            </h1>
            <p className="mt-2 text-muted-foreground">
              عالَم كل طفل في مكان واحد — شخصيته، قصصه، إنجازاته.
            </p>
          </div>
          <Button asChild size="lg" className="rounded-full">
            <Link to="/children/create">
              <Plus className="ms-2 h-5 w-5" />
              أضف طفلاً
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-3xl" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            className="mt-12"
            icon={<Sparkles className="h-7 w-7" />}
            title="لم تضف أي طفل بعد"
            description="أنشئ ملف طفلك لتجعله بطل قصصه القادمة."
            action={
              <Button asChild className="rounded-full">
                <Link to="/children/create">
                  <Plus className="ms-2 h-4 w-4" />
                  ابدأ الآن
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((c) => {
              const u = (c as { child_story_universe?: { level: number; experience_points: number; story_count: number }[] }).child_story_universe?.[0];
              const xp = u?.experience_points ?? 0;
              const lvl = levelFor(xp);
              return (
                <Link
                  key={c.id}
                  to="/children/$id"
                  params={{ id: c.id }}
                  className="group rounded-3xl border-2 border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-xl"
                >
                  <div className="flex items-start gap-4">
                    <ChildAvatar
                      emoji={c.avatar_url}
                      color={c.favorite_color}
                      photoUrl={c.photo_url}
                      name={c.name}
                      size="lg"
                    />
                    <div className="flex-1">
                      <h3 className="font-display text-lg font-extrabold">{c.name}</h3>
                      {c.nickname && (
                        <p className="text-sm text-muted-foreground">"{c.nickname}"</p>
                      )}
                      {c.age != null && (
                        <p className="mt-1 text-xs font-semibold text-accent">{c.age} سنوات</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary px-3 py-2 text-xs font-bold">
                    <span className={`bg-gradient-to-r ${lvl.color} bg-clip-text text-transparent`}>
                      {lvl.emoji} {lvl.label} · مستوى {u?.level ?? 1}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5" />
                      {u?.story_count ?? 0}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
