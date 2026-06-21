import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Play, Star } from "lucide-react";
import { getPuzzleById, PUZZLES } from "@/features/puzzles/puzzles-data";
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL } from "@/features/puzzles/types";
import { PuzzleEngine } from "@/features/puzzles/PuzzleEngine";
import { usePuzzleProgress } from "@/features/puzzles/usePuzzleProgress";

export const Route = createFileRoute("/puzzles_/$id")({
  head: ({ params }) => {
    const p = getPuzzleById(params.id);
    return {
      meta: [
        { title: p ? `${p.title} — ألغاز كيدزي` : "لعبة — كيدزي" },
        { name: "description", content: p?.description ?? "لعبة ذكاء للأطفال" },
      ],
    };
  },
  component: PuzzleDetailPage,
  notFoundComponent: () => (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">اللغز غير موجود</h1>
        <Link to="/puzzles" className="mt-4 inline-block text-primary underline">العودة لقائمة الألغاز</Link>
      </div>
      <Footer />
    </div>
  ),
});

function PuzzleDetailPage() {
  const { id } = Route.useParams();
  const puzzle = getPuzzleById(id);
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(false);

  if (!puzzle) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-3xl font-bold">اللغز غير موجود</h1>
          <Link to="/puzzles" className="mt-4 inline-block text-primary underline">العودة لقائمة الألغاز</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { progress, recordCompletion } = usePuzzleProgress(puzzle.id);
  const related = PUZZLES.filter((p) => p.id !== puzzle.id && p.difficulty === puzzle.difficulty).slice(0, 3);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12">
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/puzzles" })} className="mb-4 rounded-full touch-manipulation">
          <ArrowRight className="me-1 h-4 w-4" /> كل الألغاز
        </Button>

        {/* Detail card */}
        <div className={`rounded-3xl border-4 border-transparent p-6 shadow-md ${puzzle.color}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-4xl shadow">
              {puzzle.emoji}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${DIFFICULTY_COLOR[puzzle.difficulty]}`}>
              {DIFFICULTY_LABEL[puzzle.difficulty]}
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-extrabold">{puzzle.title}</h1>
          <p className="mt-1 text-muted-foreground">{puzzle.description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 font-bold">
              <Clock className="h-4 w-4" /> ~{puzzle.estimatedMinutes} دقيقة
            </span>
            {puzzle.skills.map((s) => (
              <span key={s.key} className="rounded-full bg-card/80 px-3 py-1 text-xs font-bold">
                {s.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-0.5 rounded-full bg-card px-3 py-1 text-accent">
              {Array.from({ length: 3 }).map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < progress.stars ? "fill-current" : "opacity-30"}`} />
              ))}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {!playing ? (
              <Button
                size="lg"
                className="w-full min-h-12 rounded-full text-lg touch-manipulation sm:w-auto"
                onClick={() => setPlaying(true)}
              >
                <Play className="me-1 h-5 w-5" /> ابدأ اللعب
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="w-full min-h-12 rounded-full touch-manipulation sm:w-auto"
                onClick={() => setPlaying(false)}
              >
                إنهاء الجلسة
              </Button>
            )}
            {progress.attempts > 0 && (
              <span className="text-center text-xs text-muted-foreground sm:self-center sm:text-start">
                المحاولات: {progress.attempts} • أفضل نتيجة: {progress.bestScore} ⭐
              </span>
            )}
          </div>
        </div>

        {/* Game area */}
        {playing && (
          <div className="mt-6">
            <PuzzleEngine
              puzzle={puzzle}
              onComplete={(stars) => { void recordCompletion(stars); }}
            />
          </div>
        )}

        {/* Related */}
        {!playing && related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 font-display text-xl font-bold">ألغاز مشابهة</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.id}
                  to="/puzzles/$id"
                  params={{ id: p.id }}
                  className={`rounded-2xl p-4 shadow-sm transition-transform hover:-translate-y-0.5 ${p.color}`}
                >
                  <div className="text-3xl">{p.emoji}</div>
                  <div className="mt-1 font-bold">{p.title}</div>
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
