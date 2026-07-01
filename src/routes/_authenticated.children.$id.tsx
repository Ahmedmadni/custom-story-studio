import { Link, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Loader2, Trash2, BookOpen, Trophy, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { ChildAvatar } from "@/features/children/ChildAvatar";
import { childLevelMeta, xpProgress, levelFromXp } from "@/features/rewards/childLevels";
import { ACHIEVEMENTS, ACHIEVEMENT_ORDER, type AchievementKey } from "@/features/rewards/achievements";
import { LevelUpWatcher } from "@/features/rewards/LevelUpModal";

export const Route = createFileRoute("/_authenticated/children/$id")({
  head: () => ({ meta: [{ title: "ملف الطفل — كيدزي" }] }),
  component: ChildDetailPage,
});

function ChildDetailPage() {
  const { id } = useParams({ from: "/_authenticated/children/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: child, isLoading } = useQuery({
    queryKey: ["child", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("child_profiles")
        .select("*, child_story_universe(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["child-history", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("child_story_history")
        .select("id, completed_at, xp_awarded, category, template_id, order_id, story_templates!template_id(title, cover_url, category)")
        .eq("child_id", id)
        .order("completed_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("child_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children"] });
      toast.success("تم حذف الملف");
      navigate({ to: "/my-children" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحذف"),
  });

  if (isLoading || !child) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const uRaw = (child as { child_story_universe?: unknown }).child_story_universe;
  const universeData = (Array.isArray(uRaw) ? uRaw[0] : uRaw) as
    | { level?: number; experience_points?: number; story_count?: number; achievements?: unknown }
    | null;
  const xp = universeData?.experience_points ?? 0;
  const storyCount = universeData?.story_count ?? 0;
  const level = universeData?.level ?? levelFromXp(xp);
  const meta = childLevelMeta(level);
  const nextMeta = level < 10 ? childLevelMeta(level + 1) : null;
  const prog = xpProgress(xp);
  const unlocked = new Set(
    Array.isArray(universeData?.achievements) ? (universeData!.achievements as string[]) : [],
  );

  // Favorite categories from history
  const catCount = new Map<string, number>();
  (history ?? []).forEach((h) => {
    const cat = (h.category ?? "") as string;
    if (cat) catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
  });
  const topCategories = Array.from(catCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="min-h-screen">
      <Header />
      <LevelUpWatcher childId={id} childName={child.name} currentLevel={level} />
      <main className="container mx-auto max-w-5xl px-4 pb-12 pt-8 sm:px-6">
        {/* Hero */}
        <div
          className="overflow-hidden rounded-3xl p-6 text-white shadow-xl sm:p-10"
          style={{
            background: `linear-gradient(135deg, ${child.favorite_color ?? "#7C3AED"}, #4F46E5)`,
          }}
        >
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <ChildAvatar
              emoji={child.avatar_url}
              photoUrl={child.photo_url}
              color="rgba(255,255,255,0.15)"
              name={child.name}
              size="xl"
              className="ring-white/30"
            />
            <div className="flex-1">
              <Badge className="mb-2 bg-white/20 text-white">
                {meta.emoji} {meta.label} · مستوى {level}
              </Badge>
              <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{child.name}</h1>
              {child.nickname && <p className="mt-1 text-white/90">"{child.nickname}"</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {child.age != null && <span>🎂 {child.age} سنوات</span>}
                {child.super_power && <span>⚡ {child.super_power}</span>}
                {child.dream_job && <span>💼 {child.dream_job}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="secondary" className="rounded-full">
                <Link to="/children/$id/edit" params={{ id }}>
                  <Edit3 className="ms-2 h-4 w-4" /> تعديل
                </Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20"
                onClick={() => {
                  if (confirm("هل تريد حذف ملف هذا الطفل نهائياً؟")) del.mutate();
                }}
              >
                <Trash2 className="ms-2 h-4 w-4" /> حذف
              </Button>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-6 rounded-2xl bg-white/10 p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span>
                التقدّم نحو {nextMeta ? `${nextMeta.emoji} ${nextMeta.label}` : "أعلى مستوى 👑"}
              </span>
              <span className="font-bold">
                {xp.toLocaleString("ar-EG")}
                {prog.nextTarget != null && ` / ${prog.nextTarget.toLocaleString("ar-EG")}`} XP
              </span>
            </div>
            <Progress value={prog.pct} className="h-3 bg-white/20" />
            {prog.nextTarget != null && (
              <p className="mt-2 text-xs text-white/80">
                تبقّى {prog.toNext.toLocaleString("ar-EG")} نقطة للوصول للمستوى التالي
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <StatCard icon={<BookOpen />} label="قصص مكتملة" value={String(storyCount)} />
          <StatCard icon={<Sparkles />} label="XP إجمالي" value={xp.toLocaleString("ar-EG")} />
          <StatCard icon={<Trophy />} label="إنجازات" value={`${unlocked.size} / ${ACHIEVEMENT_ORDER.length}`} />
          <StatCard icon={<span className="text-lg">{meta.emoji}</span>} label={meta.label} value={`مستوى ${level}`} />
        </div>

        {/* Recent Stories timeline */}
        {history && history.length > 0 && (
          <section className="mt-8 rounded-3xl border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
              <Clock className="h-5 w-5 text-primary" />
              خط زمن الحكايات
            </h2>
            <ol className="relative space-y-4 border-s-2 border-primary/20 ps-6">
              {history.map((h) => {
                const tpl = (h as { story_templates?: { title?: string; cover_url?: string | null; category?: string | null } | null }).story_templates;
                return (
                  <li key={h.id} className="relative">
                    <span className="absolute -start-[33px] top-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-xs text-white shadow">📖</span>
                    <div className="flex items-center gap-3 rounded-2xl border bg-background p-3">
                      {tpl?.cover_url ? (
                        <img src={tpl.cover_url} alt="" className="h-14 w-12 rounded-lg object-cover" />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{tpl?.title ?? "قصة"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.completed_at as string).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
                          {tpl?.category ? ` · ${tpl.category}` : ""}
                        </p>
                      </div>
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/10">+{h.xp_awarded} XP</Badge>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Favorite categories */}
        {topCategories.length > 0 && (
          <section className="mt-8 rounded-3xl border bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold">الفئات المفضّلة</h2>
            <div className="flex flex-wrap gap-2">
              {topCategories.map(([cat, cnt]) => (
                <Badge key={cat} variant="secondary" className="rounded-full px-4 py-2 text-sm">
                  {cat} · {cnt}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Personality */}
        <section className="mt-8 rounded-3xl border bg-card p-6">
          <h2 className="mb-4 font-display text-xl font-bold">شخصية البطل</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Info label="الشخصية المفضّلة" value={child.favorite_character} />
            <Info label="وظيفة الأحلام" value={child.dream_job} />
            <Info label="القوة الخارقة" value={child.super_power} />
            <Info label="الهوايات" value={(child.hobbies ?? []).join("، ") || null} />
            <Info label="الصفات" value={(child.personality_traits ?? []).join("، ") || null} />
          </div>
        </section>

        {/* Achievements */}
        <section className="mt-8 rounded-3xl border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
            <Trophy className="h-5 w-5 text-amber-500" />
            الإنجازات ({unlocked.size} / {ACHIEVEMENT_ORDER.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
            {ACHIEVEMENT_ORDER.map((key) => {
              const a = ACHIEVEMENTS[key as AchievementKey];
              const got = unlocked.has(key);
              return (
                <div
                  key={key}
                  className={`rounded-2xl border-2 p-4 text-center transition-all ${
                    got
                      ? `border-transparent bg-gradient-to-br ${a.color} text-white shadow-lg`
                      : "border-dashed border-border bg-background opacity-60"
                  }`}
                >
                  <div className="text-4xl">{a.emoji}</div>
                  <div className="mt-1 text-sm font-extrabold">{a.title}</div>
                  <div className={`text-[11px] ${got ? "text-white/90" : "text-muted-foreground"}`}>
                    {a.description}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/stories">
              <Sparkles className="ms-2 h-5 w-5" />
              اطلب قصة جديدة لـ {child.name}
            </Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="font-bold">{value || "—"}</div>
    </div>
  );
}
