import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, RotateCcw } from "lucide-react";
import { COUNTABLES, ARABIC_LETTERS, ENGLISH_LETTERS, SHAPES, COLORS, pickRandom, shuffle } from "./games-data";
import { useGameProgress } from "./useGameProgress";
import type { AgeGroup, GameKey } from "./types";
import { toast } from "sonner";

interface Props {
  ageGroup: AgeGroup;
}

function Header({ score, best, rounds, onReset }: { score: number; best: number; rounds: number; onReset: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-secondary/40 p-3">
      <div className="flex gap-2 text-sm font-bold">
        <span className="rounded-full bg-primary px-3 py-1 text-primary-foreground">النقاط: {score}</span>
        <span className="rounded-full bg-accent px-3 py-1 text-accent-foreground">أفضل: {best}</span>
        <span className="rounded-full bg-card px-3 py-1">جولات: {rounds}</span>
      </div>
      <Button variant="outline" size="sm" onClick={onReset} className="rounded-full">
        <RotateCcw className="ms-1 h-4 w-4" /> إعادة
      </Button>
    </div>
  );
}

function Choices({ options, correct, onPick, render }: {
  options: string[];
  correct: string;
  onPick: (ok: boolean) => void;
  render?: (opt: string) => React.ReactNode;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { setPicked(null); }, [correct]);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {options.map((opt) => {
        const isPicked = picked === opt;
        const isCorrect = opt === correct;
        const state = picked ? (isPicked ? (isCorrect ? "ok" : "bad") : isCorrect ? "ok" : "idle") : "idle";
        return (
          <button
            key={opt}
            disabled={!!picked}
            onClick={() => {
              setPicked(opt);
              const ok = opt === correct;
              if (ok) toast.success("أحسنت! 🎉"); else toast.error(`الإجابة: ${correct}`);
              setTimeout(() => onPick(ok), 700);
            }}
            className={`min-h-24 rounded-2xl border-4 p-4 text-3xl font-extrabold transition-transform hover:scale-105 disabled:hover:scale-100 ${
              state === "ok" ? "border-grass bg-grass/20" : state === "bad" ? "border-destructive bg-destructive/10" : "border-secondary bg-card"
            }`}
          >
            {render ? render(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

function NumbersGame({ ageGroup }: Props) {
  const { progress, recordRound, resetSession } = useGameProgress("numbers", ageGroup);
  const max = ageGroup === "young" ? 5 : 10;
  const [round, setRound] = useState(0);
  const data = useMemo(() => {
    const item = pickRandom(COUNTABLES, 1)[0];
    const count = 1 + Math.floor(Math.random() * max);
    const opts = shuffle(
      Array.from(new Set([
        count,
        Math.max(1, count - 1),
        Math.min(max, count + 1),
        1 + Math.floor(Math.random() * max),
      ])).slice(0, 4).map(String)
    );
    if (!opts.includes(String(count))) opts[0] = String(count);
    return { item, count, opts };
  }, [round, max]);

  return (
    <div>
      <Header score={progress.score} best={progress.best_score} rounds={progress.rounds_played} onReset={resetSession} />
      <div className="rounded-3xl bg-card p-6 text-center shadow-lg">
        <p className="mb-3 font-display text-2xl font-bold">كم عدد {data.item.name}؟</p>
        <div className="my-6 flex flex-wrap items-center justify-center gap-2 text-5xl">
          {Array.from({ length: data.count }).map((_, i) => <span key={i}>{data.item.emoji}</span>)}
        </div>
        <Choices
          options={data.opts}
          correct={String(data.count)}
          onPick={(ok) => { void recordRound(ok); setRound((r) => r + 1); }}
        />
      </div>
    </div>
  );
}

function LettersGame({ ageGroup, lang }: Props & { lang: "ar" | "en" }) {
  const gameKey: GameKey = lang === "ar" ? "letters_ar" : "letters_en";
  const { progress, recordRound, resetSession } = useGameProgress(gameKey, ageGroup);
  const source = lang === "ar" ? ARABIC_LETTERS : ENGLISH_LETTERS;
  const [round, setRound] = useState(0);
  const data = useMemo(() => {
    const picks = pickRandom(source, 4);
    const correct = picks[0];
    return { correct, opts: shuffle(picks.map((p) => p.letter)) };
  }, [round, source]);
  return (
    <div>
      <Header score={progress.score} best={progress.best_score} rounds={progress.rounds_played} onReset={resetSession} />
      <div className="rounded-3xl bg-card p-6 text-center shadow-lg">
        <p className="mb-3 font-display text-2xl font-bold">
          {lang === "ar" ? `بأي حرف تبدأ كلمة "${data.correct.word}"؟` : `Which letter does "${data.correct.word}" start with?`}
        </p>
        <div className="my-4 text-7xl">{data.correct.emoji}</div>
        <Choices
          options={data.opts}
          correct={data.correct.letter}
          onPick={(ok) => { void recordRound(ok); setRound((r) => r + 1); }}
        />
      </div>
    </div>
  );
}

function ShapeIcon({ name, fill = "currentColor" }: { name: typeof SHAPES[number]["svg"]; fill?: string }) {
  const common = { width: 64, height: 64, viewBox: "0 0 64 64", fill };
  switch (name) {
    case "circle": return <svg {...common}><circle cx="32" cy="32" r="28" /></svg>;
    case "square": return <svg {...common}><rect x="6" y="6" width="52" height="52" rx="4" /></svg>;
    case "rect": return <svg {...common}><rect x="2" y="14" width="60" height="36" rx="4" /></svg>;
    case "triangle": return <svg {...common}><polygon points="32,4 60,58 4,58" /></svg>;
    case "star": return <svg {...common}><polygon points="32,4 39,24 60,24 43,37 50,58 32,46 14,58 21,37 4,24 25,24" /></svg>;
    case "heart": return <svg {...common}><path d="M32 56 C 8 40, 6 18, 22 14 C 28 13, 32 20, 32 22 C 32 20, 36 13, 42 14 C 58 18, 56 40, 32 56 Z" /></svg>;
  }
}

function ShapesGame({ ageGroup }: Props) {
  const { progress, recordRound, resetSession } = useGameProgress("shapes", ageGroup);
  const [round, setRound] = useState(0);
  const data = useMemo(() => {
    const picks = pickRandom(SHAPES, 4);
    const correct = picks[0];
    return { correct, opts: shuffle(picks) };
  }, [round]);
  return (
    <div>
      <Header score={progress.score} best={progress.best_score} rounds={progress.rounds_played} onReset={resetSession} />
      <div className="rounded-3xl bg-card p-6 text-center shadow-lg">
        <p className="mb-4 font-display text-2xl font-bold">أين شكل {data.correct.name}؟</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.opts.map((s) => (
            <button
              key={s.svg}
              onClick={() => {
                const ok = s.svg === data.correct.svg;
                if (ok) toast.success("ممتاز! 🌟"); else toast.error(`الصحيح: ${data.correct.name}`);
                setTimeout(() => { void recordRound(ok); setRound((r) => r + 1); }, 600);
              }}
              className="flex min-h-28 items-center justify-center rounded-2xl border-4 border-secondary bg-card p-4 text-primary transition-transform hover:scale-105"
            >
              <ShapeIcon name={s.svg} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorsGame({ ageGroup }: Props) {
  const { progress, recordRound, resetSession } = useGameProgress("colors", ageGroup);
  const [round, setRound] = useState(0);
  const data = useMemo(() => {
    const picks = pickRandom(COLORS, 4);
    return { correct: picks[0], opts: shuffle(picks) };
  }, [round]);
  return (
    <div>
      <Header score={progress.score} best={progress.best_score} rounds={progress.rounds_played} onReset={resetSession} />
      <div className="rounded-3xl bg-card p-6 text-center shadow-lg">
        <p className="mb-4 font-display text-2xl font-bold">اختر اللون {data.correct.name}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.opts.map((c) => (
            <button
              key={c.hex}
              onClick={() => {
                const ok = c.hex === data.correct.hex;
                if (ok) toast.success("رائع! 🎨"); else toast.error(`الصحيح: ${data.correct.name}`);
                setTimeout(() => { void recordRound(ok); setRound((r) => r + 1); }, 600);
              }}
              className="h-28 rounded-2xl border-4 border-secondary transition-transform hover:scale-105"
              style={{ backgroundColor: c.hex }}
              aria-label={c.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ColoringGame({ ageGroup }: Props) {
  const { progress, recordRound, resetSession } = useGameProgress("coloring", ageGroup);
  const [color, setColor] = useState(COLORS[0].hex);
  const [fills, setFills] = useState<Record<string, string>>({});
  const parts = ["body", "ear", "eye", "nose", "ground"] as const;

  function fill(part: string) {
    setFills((f) => ({ ...f, [part]: color }));
  }

  function finish() {
    const filled = Object.keys(fills).length;
    const ok = filled >= 3;
    toast.success(ok ? "لوحة رائعة! 🌈" : "حاول تلوين أجزاء أكثر");
    void recordRound(ok);
    setFills({});
  }

  return (
    <div>
      <Header score={progress.score} best={progress.best_score} rounds={progress.rounds_played} onReset={() => { resetSession(); setFills({}); }} />
      <div className="rounded-3xl bg-card p-4 shadow-lg">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">اختر لوناً:</span>
          {COLORS.map((c) => (
            <button
              key={c.hex}
              onClick={() => setColor(c.hex)}
              className={`h-8 w-8 rounded-full border-4 transition-transform hover:scale-110 ${color === c.hex ? "border-foreground" : "border-card"}`}
              style={{ backgroundColor: c.hex }}
              aria-label={c.name}
            />
          ))}
          <Button size="sm" className="ms-auto rounded-full" onClick={finish}>
            <Sparkles className="ms-1 h-4 w-4" /> إنهاء اللوحة
          </Button>
        </div>
        <div className="rounded-2xl bg-secondary/30 p-2">
          <svg viewBox="0 0 400 300" className="mx-auto w-full max-w-md cursor-pointer">
            {/* ground */}
            <rect onClick={() => fill("ground")} x="0" y="240" width="400" height="60" fill={fills.ground ?? "#fff"} stroke="#000" strokeWidth="3" />
            {/* body (bear-like) */}
            <circle onClick={() => fill("body")} cx="200" cy="180" r="70" fill={fills.body ?? "#fff"} stroke="#000" strokeWidth="3" />
            {/* head */}
            <circle onClick={() => fill("body")} cx="200" cy="110" r="55" fill={fills.body ?? "#fff"} stroke="#000" strokeWidth="3" />
            {/* ears */}
            <circle onClick={() => fill("ear")} cx="155" cy="70" r="18" fill={fills.ear ?? "#fff"} stroke="#000" strokeWidth="3" />
            <circle onClick={() => fill("ear")} cx="245" cy="70" r="18" fill={fills.ear ?? "#fff"} stroke="#000" strokeWidth="3" />
            {/* eyes */}
            <circle onClick={() => fill("eye")} cx="180" cy="105" r="7" fill={fills.eye ?? "#fff"} stroke="#000" strokeWidth="2" />
            <circle onClick={() => fill("eye")} cx="220" cy="105" r="7" fill={fills.eye ?? "#fff"} stroke="#000" strokeWidth="2" />
            {/* nose */}
            <ellipse onClick={() => fill("nose")} cx="200" cy="130" rx="12" ry="8" fill={fills.nose ?? "#fff"} stroke="#000" strokeWidth="2" />
          </svg>
          <p className="mt-2 text-center text-xs text-muted-foreground">اضغط على أي جزء من الرسمة ليأخذ اللون المختار</p>
        </div>
      </div>
    </div>
  );
}

export function GamePlayer({ gameKey, ageGroup }: { gameKey: GameKey; ageGroup: AgeGroup }) {
  switch (gameKey) {
    case "numbers": return <NumbersGame ageGroup={ageGroup} />;
    case "letters_ar": return <LettersGame ageGroup={ageGroup} lang="ar" />;
    case "letters_en": return <LettersGame ageGroup={ageGroup} lang="en" />;
    case "shapes": return <ShapesGame ageGroup={ageGroup} />;
    case "colors": return <ColorsGame ageGroup={ageGroup} />;
    case "coloring": return <ColoringGame ageGroup={ageGroup} />;
  }
}
