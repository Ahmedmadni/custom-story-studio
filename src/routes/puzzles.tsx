import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Clock, Puzzle, Sparkles, Star, Target, TrendingUp } from "lucide-react";
import { PUZZLES } from "@/features/puzzles/puzzles-data";
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL, type PuzzleDifficulty } from "@/features/puzzles/types";
import { useAllPuzzleProgress } from "@/features/puzzles/usePuzzleProgress";

export const Route = createFileRoute("/puzzles")({
  head: () => ({
    meta: [
      { title: "ألغاز وألعاب ذكاء للأطفال — حكايتي" },
      { name: "description", content: "مجموعة ألغاز تفاعلية للأطفال 3-8 سنوات: ذاكرة، تركيز، أنماط، تصنيف وأكثر." },
      { property: "og:title", content: "ألغاز الأطفال — حكايتي" },
      { property: "og:description", content: "أكثر من 20 لعبة ذكاء قصيرة لتنمية مهارات الطفل." },
    ],
  }),
  component: PuzzlesPage,
});

const FILTERS: (PuzzleDifficulty | "all")[] = ["all", "easy", "medium", "hard"];
const FILTER_LABEL: Record<string, string> = { all: "الكل", easy: "سهل", medium: "متوسط", hard: "صعب" };

function PuzzlesPage() {
  const { progress } = useAllPuzzleProgress();
  const [filter, setFilter] = useState<PuzzleDifficulty | "all">("all");

  const list = useMemo(
    () => (filter === "all" ? PUZZLES : PUZZLES.filter((p) => p.difficulty === filter)),
    [filter],
  );

  const stats = useMemo(() => {
    const entries = Object.values(progress);
    const completed = entries.filter((e) => e.completed).length;
    const totalStars = entries.reduce((s, e) => s + e.stars, 0);
    const attempts = entries.reduce((s, e) => s + e.attempts, 0);
    const skillCount: Record<string, number> = {};
    for (const e of entries) {
      const p = PUZZLES.find((x) => x.id === e.puzzleId);
      if (!p) continue;
      for (const sk of p.skills) skillCount[sk.label] = (skillCount[sk.label] ?? 0) + e.attempts;
    }
    const topSkill = Object.entries(skillCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { completed, totalStars, attempts, topSkill };
  }, [progress]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-bold">
            <Puzzle className="h-4 w-4" /> ألغاز ذكية
          </span>
          <h1 className="mt-3 font-display text-4xl font-extrabold text-foreground md:text-5xl">
            ألغاز وألعاب ذكاء
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            أكثر من ٢٠ لعبة قصيرة لتنمية الذاكرة والتركيز والملاحظة والمنطق.
          </p>
        </div>

        {/* Parent summary */}
        <section
          aria-labelledby="parent-summary"
          className="mx-auto mb-8 max-w-5xl rounded-3xl border-2 border-primary/20 bg-gradient-to-l from-primary/10 to-accent/10 p-5"
        >
          <h2 id="parent-summary" className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <Sparkles className="h-5 w-5 text-primary" /> لوحة الوالدين — ملخص التقدم
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={<Puzzle className="h-5 w-5" />} label="ألغاز أُنجزت" value={`${stats.completed} / ${PUZZLES.length}`} />
            <StatCard icon={<Star className="h-5 w-5 text-accent" />} label="إجمالي النجوم" value={String(stats.totalStars)} />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label="عدد المحاولات" value={String(stats.attempts)} />
            <StatCard icon={<Target className="h-5 w-5" />} label="المهارة الأكثر ممارسة" value={stats.topSkill} />
          </div>
        </section>

        {/* Filters */}
        <div className="mx-auto mb-6 flex max-w-md flex-wrap items-center justify-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"
              }`}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Puzzle grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const prog = progress[p.id];
            return (
              <Link
                key={p.id}
                to="/puzzles/$id"
                params={{ id: p.id }}
                className={`group block rounded-3xl border-4 border-transparent p-5 shadow-md transition-all hover:-translate-y-1 hover:border-primary ${p.color}`}
              >
                <div className="flex items-start justify-between">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-3xl shadow">
                    {p.emoji}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${DIFFICULTY_COLOR[p.difficulty]}`}>
                    {DIFFICULTY_LABEL[p.difficulty]}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-xl font-extrabold text-foreground">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.skills.map((s) => (
                    <span key={s.key} className="rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-bold text-foreground/80">
                      {s.label}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-foreground/70">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> ~{p.estimatedMinutes} د
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-accent">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${prog && i < prog.stars ? "fill-current" : "opacity-30"}`} />
                    ))}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 font-display text-lg font-extrabold text-foreground">{value}</div>
    </div>
  );
}
