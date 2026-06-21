import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb, RotateCcw, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import type { PuzzleDef } from "./types";
import {
  isSfxEnabled,
  playCorrect,
  playPair,
  playTap,
  playWin,
  playWrong,
  setSfxEnabled,
} from "./sounds";
import { generateExtraRounds, type AiRound } from "./puzzles.functions";

// ---------- Expanded content pools (more variety = less repetition) ----------
const ANIMALS = [
  { name: "أرنب", emoji: "🐰", cat: "حيوان" },
  { name: "قطة", emoji: "🐱", cat: "حيوان" },
  { name: "كلب", emoji: "🐶", cat: "حيوان" },
  { name: "دب", emoji: "🐻", cat: "حيوان" },
  { name: "أسد", emoji: "🦁", cat: "حيوان" },
  { name: "فيل", emoji: "🐘", cat: "حيوان" },
  { name: "حصان", emoji: "🐴", cat: "حيوان" },
  { name: "بقرة", emoji: "🐮", cat: "حيوان" },
  { name: "خروف", emoji: "🐑", cat: "حيوان" },
  { name: "قرد", emoji: "🐵", cat: "حيوان" },
  { name: "ضفدع", emoji: "🐸", cat: "حيوان" },
  { name: "نمر", emoji: "🐯", cat: "حيوان" },
  { name: "زرافة", emoji: "🦒", cat: "حيوان" },
  { name: "بطريق", emoji: "🐧", cat: "حيوان" },
  { name: "بومة", emoji: "🦉", cat: "حيوان" },
  { name: "فأر", emoji: "🐭", cat: "حيوان" },
];
const FRUITS = [
  { name: "تفاحة", emoji: "🍎", cat: "فاكهة" },
  { name: "موزة", emoji: "🍌", cat: "فاكهة" },
  { name: "عنب", emoji: "🍇", cat: "فاكهة" },
  { name: "فراولة", emoji: "🍓", cat: "فاكهة" },
  { name: "بطيخ", emoji: "🍉", cat: "فاكهة" },
  { name: "أناناس", emoji: "🍍", cat: "فاكهة" },
  { name: "برتقالة", emoji: "🍊", cat: "فاكهة" },
  { name: "كرز", emoji: "🍒", cat: "فاكهة" },
  { name: "خوخ", emoji: "🍑", cat: "فاكهة" },
  { name: "ليمون", emoji: "🍋", cat: "فاكهة" },
  { name: "كمثرى", emoji: "🍐", cat: "فاكهة" },
  { name: "مانجو", emoji: "🥭", cat: "فاكهة" },
];
const VEHICLES = [
  { name: "سيارة", emoji: "🚗", cat: "مركبة" },
  { name: "حافلة", emoji: "🚌", cat: "مركبة" },
  { name: "طائرة", emoji: "✈️", cat: "مركبة" },
  { name: "قطار", emoji: "🚂", cat: "مركبة" },
  { name: "دراجة", emoji: "🚲", cat: "مركبة" },
  { name: "مركب", emoji: "⛵", cat: "مركبة" },
  { name: "صاروخ", emoji: "🚀", cat: "مركبة" },
  { name: "شاحنة", emoji: "🚚", cat: "مركبة" },
];
const COLORS_LIST = [
  { name: "أحمر", hex: "#ef4444" },
  { name: "أزرق", hex: "#3b82f6" },
  { name: "أصفر", hex: "#facc15" },
  { name: "أخضر", hex: "#22c55e" },
  { name: "برتقالي", hex: "#fb923c" },
  { name: "بنفسجي", hex: "#a855f7" },
  { name: "وردي", hex: "#ec4899" },
  { name: "بني", hex: "#92400e" },
  { name: "أسود", hex: "#1f2937" },
  { name: "سماوي", hex: "#06b6d4" },
];
const SHAPES_LIST = ["⭐", "🔺", "🟦", "🟢", "❤️", "🔶", "⬛", "🟣", "🔷", "🟧"];
const ARABIC_WORDS = [
  { letter: "أ", word: "أرنب", emoji: "🐰" },
  { letter: "ب", word: "بطة", emoji: "🦆" },
  { letter: "ت", word: "تفاحة", emoji: "🍎" },
  { letter: "ث", word: "ثعلب", emoji: "🦊" },
  { letter: "ج", word: "جمل", emoji: "🐪" },
  { letter: "ح", word: "حصان", emoji: "🐴" },
  { letter: "د", word: "دب", emoji: "🐻" },
  { letter: "ذ", word: "ذرة", emoji: "🌽" },
  { letter: "ر", word: "رمان", emoji: "🍎" },
  { letter: "ز", word: "زرافة", emoji: "🦒" },
  { letter: "س", word: "سمكة", emoji: "🐟" },
  { letter: "ش", word: "شمس", emoji: "☀️" },
  { letter: "ص", word: "صقر", emoji: "🦅" },
  { letter: "ط", word: "طائر", emoji: "🐦" },
  { letter: "ع", word: "عنب", emoji: "🍇" },
  { letter: "ف", word: "فيل", emoji: "🐘" },
  { letter: "ق", word: "قطة", emoji: "🐱" },
  { letter: "ك", word: "كلب", emoji: "🐶" },
  { letter: "ل", word: "ليمون", emoji: "🍋" },
  { letter: "م", word: "موزة", emoji: "🍌" },
  { letter: "ن", word: "نملة", emoji: "🐜" },
  { letter: "ه", word: "هدهد", emoji: "🐦" },
  { letter: "و", word: "وردة", emoji: "🌹" },
  { letter: "ي", word: "يمامة", emoji: "🕊️" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickN<T>(arr: T[], n: number): T[] { return shuffle(arr).slice(0, n); }

// ---------- UI primitives ----------
function SfxToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => { setOn(isSfxEnabled()); }, []);
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full touch-manipulation"
      onClick={() => { const v = !on; setSfxEnabled(v); setOn(v); }}
      aria-label={on ? "كتم الصوت" : "تشغيل الصوت"}
      title={on ? "كتم الصوت" : "تشغيل الصوت"}
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </Button>
  );
}

function ToolBar({
  round, total, score, onHint, onRetry,
}: { round: number; total: number; score: number; onHint?: () => void; onRetry: () => void }) {
  return (
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl bg-secondary/40 p-3 sm:flex sm:flex-wrap sm:justify-between">
      <div className="flex min-w-0 flex-wrap gap-2 text-xs font-bold sm:text-sm">
        <span className="whitespace-nowrap rounded-full bg-primary px-3 py-1 text-primary-foreground">
          الجولة: {Math.min(round + 1, total)}/{total}
        </span>
        <span className="whitespace-nowrap rounded-full bg-accent px-3 py-1 text-accent-foreground">
          النقاط: {score}
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <SfxToggle />
        {onHint && (
          <Button variant="outline" size="sm" onClick={onHint} className="rounded-full touch-manipulation">
            <Lightbulb className="me-1 h-4 w-4" /> تلميح
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onRetry} className="rounded-full touch-manipulation">
          <RotateCcw className="me-1 h-4 w-4" /> إعادة
        </Button>
      </div>
    </div>
  );
}

function ResultScreen({
  score, total, onRetry,
}: { score: number; total: number; onRetry: () => void }) {
  const ratio = total > 0 ? score / total : 0;
  const stars = ratio >= 0.85 ? 3 : ratio >= 0.6 ? 2 : ratio > 0 ? 1 : 0;
  useEffect(() => { playWin(); }, []);
  return (
    <div className="rounded-3xl bg-card p-8 text-center shadow-lg">
      <Trophy className="mx-auto mb-3 h-14 w-14 text-accent" />
      <h3 className="font-display text-3xl font-extrabold">أحسنت! 🎉</h3>
      <p className="mt-1 text-muted-foreground">حصلت على {score} من {total}</p>
      <div className="my-5 text-5xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className={i < stars ? "" : "opacity-20"}>⭐</span>
        ))}
      </div>
      <Button size="lg" className="rounded-full touch-manipulation" onClick={onRetry}>
        <Sparkles className="me-1 h-4 w-4" /> العب مرة أخرى
      </Button>
    </div>
  );
}

// Generic multiple-choice engine — covers most puzzle types
type ChoiceRound = {
  question: React.ReactNode;
  options: { key: string; render: React.ReactNode }[];
  correct: string;
  hint?: string;
};

function ChoiceGame({
  rounds, total, onDone,
}: { rounds: ChoiceRound[]; total: number; onDone: (score: number) => void }) {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealHint, setRevealHint] = useState(false);
  const current = rounds[i];

  useEffect(() => { setPicked(null); setRevealHint(false); }, [i]);

  if (i >= total) {
    return <ResultScreen score={score} total={total} onRetry={() => onDone(score)} />;
  }

  function pick(key: string) {
    if (picked) return;
    setPicked(key);
    const ok = key === current.correct;
    if (ok) {
      playCorrect();
      setScore((s) => s + 1);
      toast.success("أحسنت! 🌟");
    } else {
      playWrong();
      toast.error("حاول مرة أخرى");
    }
    setTimeout(() => setI((x) => x + 1), 800);
  }

  return (
    <>
      <ToolBar
        round={i} total={total} score={score}
        onHint={current.hint ? () => { setRevealHint(true); toast(current.hint!); } : undefined}
        onRetry={() => onDone(score)}
      />
      <div className="rounded-3xl bg-card p-6 shadow-lg">
        <div className="mb-4 text-center font-display text-2xl font-bold">
          {current.question}
        </div>
        {revealHint && current.hint && (
          <p className="mb-3 text-center text-sm text-muted-foreground">💡 {current.hint}</p>
        )}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
          {current.options.map((opt) => {
            const isPicked = picked === opt.key;
            const isCorrect = opt.key === current.correct;
            const state = picked ? (isCorrect ? "ok" : isPicked ? "bad" : "idle") : "idle";
            return (
              <button
                key={opt.key}
                disabled={!!picked}
                onClick={() => { playTap(); pick(opt.key); }}
                className={`flex min-h-24 select-none touch-manipulation items-center justify-center rounded-2xl border-4 p-3 text-center text-4xl font-extrabold transition-transform active:scale-95 sm:min-h-28 sm:p-4 sm:hover:scale-105 disabled:active:scale-100 disabled:sm:hover:scale-100 ${
                  state === "ok" ? "border-grass bg-grass/20"
                    : state === "bad" ? "border-destructive bg-destructive/10"
                      : "border-secondary bg-card"
                }`}
              >
                {opt.render}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---------- Round builders per engine ----------
function buildCounting(): ChoiceRound {
  const item = pickN([...ANIMALS, ...FRUITS], 1)[0];
  const count = 2 + Math.floor(Math.random() * 8);
  const opts = Array.from(new Set([count, count - 1, count + 1, Math.max(1, count - 2)]))
    .filter((n) => n > 0).slice(0, 4);
  return {
    question: <div>كم عدد {item.name}؟ <div className="my-4 text-5xl">{item.emoji.repeat(count)}</div></div>,
    options: shuffle(opts).map((n) => ({ key: String(n), render: <span>{n}</span> })),
    correct: String(count),
    hint: "عُدّ ببطء واحداً واحداً",
  };
}

function buildOddOneOut(): ChoiceRound {
  const pools = [
    { group: ANIMALS, odd: FRUITS },
    { group: FRUITS, odd: ANIMALS },
    { group: VEHICLES, odd: ANIMALS },
    { group: ANIMALS, odd: VEHICLES },
    { group: FRUITS, odd: VEHICLES },
  ];
  const p = pickN(pools, 1)[0];
  const group = pickN(p.group, 3);
  const odd = pickN(p.odd, 1)[0];
  const all = shuffle([...group, odd]);
  return {
    question: "أيها مختلف عن الباقي؟",
    options: all.map((it) => ({ key: it.name, render: <span className="text-5xl">{it.emoji}</span> })),
    correct: odd.name,
    hint: "لاحظ النوع: حيوان، فاكهة، أم مركبة؟",
  };
}

function buildShapeMatch(): ChoiceRound {
  const target = pickN(SHAPES_LIST, 1)[0];
  const others = shuffle(SHAPES_LIST.filter((s) => s !== target)).slice(0, 3);
  return {
    question: <div>اختر الشكل المطابق: <div className="my-3 text-6xl">{target}</div></div>,
    options: shuffle([target, ...others]).map((s) => ({ key: s, render: <span className="text-5xl">{s}</span> })),
    correct: target,
  };
}

function buildColorMatch(): ChoiceRound {
  const target = pickN(COLORS_LIST, 1)[0];
  const others = shuffle(COLORS_LIST.filter((c) => c.hex !== target.hex)).slice(0, 3);
  return {
    question: <span>اختر اللون {target.name}</span>,
    options: shuffle([target, ...others]).map((c) => ({
      key: c.hex,
      render: <span className="block h-16 w-full rounded-xl" style={{ backgroundColor: c.hex }} />,
    })),
    correct: target.hex,
  };
}

function buildShadow(): ChoiceRound {
  const target = pickN([...ANIMALS, ...FRUITS, ...VEHICLES], 1)[0];
  const others = pickN([...ANIMALS, ...FRUITS, ...VEHICLES].filter((a) => a.name !== target.name), 3);
  return {
    question: (
      <div>
        ما الكائن صاحب هذا الظل؟
        <div className="my-3 text-7xl" style={{ filter: "brightness(0)" }}>{target.emoji}</div>
      </div>
    ),
    options: shuffle([target, ...others]).map((o) => ({ key: o.name, render: <span className="text-5xl">{o.emoji}</span> })),
    correct: target.name,
  };
}

function buildLetterPicture(): ChoiceRound {
  const target = pickN(ARABIC_WORDS, 1)[0];
  const others = pickN(ARABIC_WORDS.filter((w) => w.letter !== target.letter), 3);
  return {
    question: <div>بأي حرف تبدأ كلمة "{target.word}"؟ <div className="my-3 text-6xl">{target.emoji}</div></div>,
    options: shuffle([target, ...others]).map((w) => ({ key: w.letter, render: <span>{w.letter}</span> })),
    correct: target.letter,
    hint: `تبدأ بحرف ${target.letter}`,
  };
}

function buildPattern(): ChoiceRound {
  const [a, b] = pickN(SHAPES_LIST, 2);
  const variants = [
    { seq: [a, b, a, b, a], correct: b },
    { seq: [a, a, b, a, a], correct: b },
    { seq: [a, b, b, a, b], correct: b },
  ];
  const v = pickN(variants, 1)[0];
  const others = shuffle(SHAPES_LIST.filter((s) => s !== v.correct)).slice(0, 3);
  return {
    question: (
      <div>
        أكمل النمط:
        <div className="my-3 text-4xl tracking-widest">{v.seq.join(" ")} ❓</div>
      </div>
    ),
    options: shuffle([v.correct, ...others]).map((s) => ({ key: s, render: <span className="text-5xl">{s}</span> })),
    correct: v.correct,
    hint: "لاحظ الترتيب المتكرر",
  };
}

function buildMissingPiece(): ChoiceRound {
  const target = pickN([...ANIMALS, ...FRUITS], 1)[0];
  const others = pickN([...ANIMALS, ...FRUITS].filter((a) => a.name !== target.name), 3);
  return {
    question: (
      <div>
        ما القطعة الناقصة من الصورة؟
        <div className="my-3 grid grid-cols-2 gap-1 mx-auto w-fit">
          <div className="flex h-16 w-16 items-center justify-center rounded bg-secondary text-3xl">{target.emoji}</div>
          <div className="flex h-16 w-16 items-center justify-center rounded bg-secondary text-3xl">{target.emoji}</div>
          <div className="flex h-16 w-16 items-center justify-center rounded bg-secondary text-3xl">{target.emoji}</div>
          <div className="flex h-16 w-16 items-center justify-center rounded border-4 border-dashed border-primary text-2xl">؟</div>
        </div>
      </div>
    ),
    options: shuffle([target, ...others]).map((a) => ({ key: a.name, render: <span className="text-5xl">{a.emoji}</span> })),
    correct: target.name,
  };
}

function buildSorting(): ChoiceRound {
  const cat = pickN([
    { label: "حيوانات", source: ANIMALS, other: [...FRUITS, ...VEHICLES] },
    { label: "فواكه", source: FRUITS, other: [...ANIMALS, ...VEHICLES] },
    { label: "مركبات", source: VEHICLES, other: [...ANIMALS, ...FRUITS] },
  ], 1)[0];
  const correct = pickN(cat.source, 1)[0];
  const others = pickN(cat.other, 3);
  return {
    question: <span>أي عنصر ينتمي إلى مجموعة "{cat.label}"؟</span>,
    options: shuffle([correct, ...others]).map((o) => ({ key: o.name, render: <span className="text-5xl">{o.emoji}</span> })),
    correct: correct.name,
  };
}

function buildCauseEffect(): ChoiceRound {
  const scenarios = [
    { q: "إذا أمطرت السماء، ماذا نحتاج؟", correct: "مظلة ☂️", others: ["نظارة شمس 🕶️", "مروحة 🌬️", "كرة ⚽"] },
    { q: "إذا شعرت بالعطش، ماذا تفعل؟", correct: "أشرب ماء 💧", others: ["أنام 😴", "ألعب 🎮", "أقرأ 📚"] },
    { q: "ما الذي يكبر إذا سقيناه؟", correct: "نبتة 🌱", others: ["حجر 🪨", "كرسي 🪑", "قلم ✏️"] },
    { q: "إذا أظلمت الغرفة، ماذا نشغّل؟", correct: "المصباح 💡", others: ["الراديو 📻", "الثلاجة 🧊", "الساعة ⏰"] },
    { q: "ما الذي يطفو على الماء؟", correct: "قارب ⛵", others: ["حجر 🪨", "حديد ⚙️", "ذهب 🏆"] },
    { q: "إذا جعت، ماذا تأكل؟", correct: "طعام 🍽️", others: ["ثلج 🧊", "ورق 📄", "صابون 🧼"] },
    { q: "إذا كنت تعباً، ماذا تفعل؟", correct: "أنام 😴", others: ["أركض 🏃", "أغني 🎤", "أقفز 🤸"] },
    { q: "ما الذي يضيء في الليل؟", correct: "القمر 🌙", others: ["الزهرة 🌸", "الحجر 🪨", "الكتاب 📖"] },
    { q: "إذا أصبح الجو حاراً، ماذا نلبس؟", correct: "ملابس خفيفة 👕", others: ["معطف ثقيل 🧥", "قبعة شتاء 🧣", "أحذية جلد 🥾"] },
    { q: "ماذا يأكل الأرنب؟", correct: "جزر 🥕", others: ["لحم 🥩", "حلوى 🍬", "صابون 🧼"] },
  ];
  const s = pickN(scenarios, 1)[0];
  return {
    question: s.q,
    options: shuffle([s.correct, ...s.others]).map((o) => ({ key: o, render: <span className="text-lg">{o}</span> })),
    correct: s.correct,
  };
}

function buildAttention(): ChoiceRound {
  const target = pickN(SHAPES_LIST, 1)[0];
  const noise = SHAPES_LIST.filter((s) => s !== target);
  const grid = shuffle([target, ...Array.from({ length: 15 }, () => noise[Math.floor(Math.random() * noise.length)])]);
  return {
    question: (
      <div>
        اعثر على الرمز {target}
        <div className="my-3 mx-auto grid w-fit grid-cols-4 gap-1 rounded-xl bg-secondary/30 p-3">
          {grid.map((s, i) => <span key={i} className="text-2xl">{s}</span>)}
        </div>
        ثم اختره من الأسفل:
      </div>
    ),
    options: shuffle([target, ...pickN(noise, 3)]).map((s) => ({ key: s, render: <span className="text-4xl">{s}</span> })),
    correct: target,
  };
}

function buildLogic(): ChoiceRound {
  const qs = [
    { q: "الفيل أكبر من النملة. صحيح؟", correct: "صح ✅", others: ["خطأ ❌"] },
    { q: "الشمس تشرق في الليل. صحيح؟", correct: "خطأ ❌", others: ["صح ✅"] },
    { q: "الأسماك تعيش في الماء. صحيح؟", correct: "صح ✅", others: ["خطأ ❌"] },
    { q: "الطيور تسبح تحت الماء طوال الوقت.", correct: "خطأ ❌", others: ["صح ✅"] },
    { q: "2 + 2 = 4. صحيح؟", correct: "صح ✅", others: ["خطأ ❌"] },
    { q: "الثلج ساخن. صحيح؟", correct: "خطأ ❌", others: ["صح ✅"] },
    { q: "النحلة تصنع العسل. صحيح؟", correct: "صح ✅", others: ["خطأ ❌"] },
    { q: "السيارة تطير في السماء. صحيح؟", correct: "خطأ ❌", others: ["صح ✅"] },
    { q: "الدجاجة تبيض. صحيح؟", correct: "صح ✅", others: ["خطأ ❌"] },
    { q: "الجبال أكبر من البيت. صحيح؟", correct: "صح ✅", others: ["خطأ ❌"] },
    { q: "3 + 1 = 5. صحيح؟", correct: "خطأ ❌", others: ["صح ✅"] },
    { q: "النار باردة. صحيح؟", correct: "خطأ ❌", others: ["صح ✅"] },
  ];
  const s = pickN(qs, 1)[0];
  return {
    question: s.q,
    options: shuffle([s.correct, ...s.others]).map((o) => ({ key: o, render: <span className="text-2xl">{o}</span> })),
    correct: s.correct,
  };
}

function buildSequenceOrder(): ChoiceRound {
  const nums = pickN([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 4).sort((a, b) => a - b);
  const askSmallest = Math.random() < 0.5;
  const correct = askSmallest ? nums[0] : nums[nums.length - 1];
  return {
    question: (
      <div>
        ما {askSmallest ? "أصغر" : "أكبر"} رقم؟
        <div className="my-3 text-3xl tracking-widest">{shuffle(nums).join("  ")}</div>
      </div>
    ),
    options: shuffle(nums).map((n) => ({ key: String(n), render: <span>{n}</span> })),
    correct: String(correct),
  };
}

function buildSpotDifference(): ChoiceRound {
  const base = pickN(ANIMALS, 3);
  const extra = pickN(ANIMALS.filter((a) => !base.find((b) => b.name === a.name)), 1)[0];
  const sceneAhasExtra = Math.random() < 0.5;
  const sceneA = sceneAhasExtra ? [...base, extra] : base;
  const sceneB = sceneAhasExtra ? base : [...base, extra];
  return {
    question: (
      <div>
        أي صورة تحتوي على عنصر إضافي؟
        <div className="my-3 grid grid-cols-2 gap-3">
          {[sceneA, sceneB].map((scene, idx) => (
            <div key={idx} className="rounded-xl bg-secondary/30 p-3 text-3xl">
              <div className="mb-1 text-xs font-bold">صورة {idx === 0 ? "أ" : "ب"}</div>
              {scene.map((s, i) => <span key={i}>{s.emoji}</span>)}
            </div>
          ))}
        </div>
      </div>
    ),
    options: [
      { key: "A", render: <span>صورة أ</span> },
      { key: "B", render: <span>صورة ب</span> },
    ],
    correct: sceneAhasExtra ? "A" : "B",
  };
}

function buildStoryOrder(): ChoiceRound {
  const stories = [
    { steps: ["🥚 بيضة", "🐣 كتكوت", "🐔 دجاجة"], q: "ما الذي يأتي أولاً؟", correct: "🥚 بيضة" },
    { steps: ["🌱 بذرة", "🌿 نبتة", "🌳 شجرة"], q: "ما الذي يأتي أولاً؟", correct: "🌱 بذرة" },
    { steps: ["☀️ صباح", "🌇 مساء", "🌙 ليل"], q: "ما الذي يأتي أولاً؟", correct: "☀️ صباح" },
    { steps: ["👶 رضيع", "🧒 طفل", "🧑 شاب"], q: "ما الذي يأتي أولاً؟", correct: "👶 رضيع" },
    { steps: ["🐛 يرقة", "🦋 فراشة"], q: "ما الذي يأتي أولاً؟", correct: "🐛 يرقة" },
    { steps: ["🍎 بذرة تفاح", "🌳 شجرة تفاح", "🍎 ثمرة"], q: "ما الذي يأتي أولاً؟", correct: "🍎 بذرة تفاح" },
  ];
  const s = pickN(stories, 1)[0];
  return {
    question: <div>{s.q} <div className="my-3 text-3xl">{shuffle(s.steps).join(" • ")}</div></div>,
    options: s.steps.map((t) => ({ key: t, render: <span className="text-lg">{t}</span> })),
    correct: s.correct,
  };
}

function buildDailyMini(): ChoiceRound {
  const builders = [buildCounting, buildOddOneOut, buildShapeMatch, buildLetterPicture, buildLogic, buildSorting, buildCauseEffect];
  return builders[Math.floor(Math.random() * builders.length)]();
}

function buildMaze(): ChoiceRound {
  const directions = [
    { q: "الأرنب 🐰 يريد الوصول للجزرة 🥕. الجزرة على اليمين. أي اتجاه؟", correct: "يمين ➡️", others: ["يسار ⬅️", "أعلى ⬆️", "أسفل ⬇️"] },
    { q: "القطة 🐱 تريد الحليب 🥛 الذي في الأعلى. أي اتجاه؟", correct: "أعلى ⬆️", others: ["يمين ➡️", "يسار ⬅️", "أسفل ⬇️"] },
    { q: "السمكة 🐟 ترى طعاماً 🍤 على اليسار. أي اتجاه؟", correct: "يسار ⬅️", others: ["يمين ➡️", "أعلى ⬆️", "أسفل ⬇️"] },
    { q: "الفأر 🐭 يبحث عن جبنة 🧀 في الأسفل. أي اتجاه؟", correct: "أسفل ⬇️", others: ["يمين ➡️", "يسار ⬅️", "أعلى ⬆️"] },
    { q: "الطائر 🐦 يطير نحو عشّه في الأعلى. أي اتجاه؟", correct: "أعلى ⬆️", others: ["يمين ➡️", "يسار ⬅️", "أسفل ⬇️"] },
  ];
  const s = pickN(directions, 1)[0];
  return {
    question: s.q,
    options: shuffle([s.correct, ...s.others]).map((o) => ({ key: o, render: <span className="text-lg">{o}</span> })),
    correct: s.correct,
  };
}

function buildAudio(): ChoiceRound {
  const target = pickN(ARABIC_WORDS, 1)[0];
  const others = pickN(ARABIC_WORDS.filter((w) => w.letter !== target.letter), 3);
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      const u = new SpeechSynthesisUtterance(target.word);
      u.lang = "ar-SA"; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }
  return {
    question: <span>🔊 اضغط الصورة المطابقة للكلمة التي سمعتها</span>,
    options: shuffle([target, ...others]).map((w) => ({
      key: w.word,
      render: <span className="text-5xl">{w.emoji}</span>,
    })),
    correct: target.word,
    hint: `الكلمة هي: ${target.word}`,
  };
}

function buildJigsawRotate(): ChoiceRound {
  const target = pickN([...ANIMALS, ...FRUITS], 1)[0];
  const rotations = [0, 90, 180, 270];
  const correctRot = 0;
  return {
    question: <span>أي قطعة في الاتجاه الصحيح؟</span>,
    options: shuffle(rotations).map((r) => ({
      key: String(r),
      render: (
        <span className="block text-5xl" style={{ transform: `rotate(${r}deg)`, display: "inline-block" }}>
          {target.emoji}
        </span>
      ),
    })),
    correct: String(correctRot),
  };
}

function buildDragMatch(): ChoiceRound {
  return buildSorting();
}

// ---------- Memory Pairs (custom UI) ----------
function MemoryPairs({ onDone }: { onDone: (score: number) => void }) {
  const initial = useMemo(() => {
    const picks = pickN([...ANIMALS, ...FRUITS], 6);
    return shuffle([...picks, ...picks].map((c, i) => ({ uid: i, key: c.name, emoji: c.emoji })));
  }, []);
  const [cards] = useState(initial);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);

  function flip(uid: number) {
    if (revealed.includes(uid) || matched.includes(cards[uid].key)) return;
    if (revealed.length === 2) return;
    playTap();
    const next = [...revealed, uid];
    setRevealed(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (cards[a].key === cards[b].key) {
        setTimeout(() => {
          playPair();
          setMatched((m) => [...m, cards[a].key]);
          setRevealed([]);
          toast.success("زوج! ⭐");
        }, 600);
      } else {
        setTimeout(() => { playWrong(); setRevealed([]); }, 900);
      }
    }
  }

  useEffect(() => {
    if (matched.length === 6) {
      const score = moves <= 8 ? 3 : moves <= 12 ? 2 : 1;
      setTimeout(() => onDone(score), 700);
    }
  }, [matched.length, moves, onDone]);

  return (
    <>
      <ToolBar round={matched.length} total={6} score={matched.length} onRetry={() => onDone(matched.length >= 6 ? 3 : 0)} />
      <div className="rounded-3xl bg-card p-4 shadow-lg">
        <p className="mb-3 text-center text-sm text-muted-foreground">عدد المحاولات: {moves}</p>
        <div className="mx-auto grid max-w-[22rem] grid-cols-3 gap-2 sm:max-w-md sm:grid-cols-4">
          {cards.map((c, i) => {
            const isUp = revealed.includes(i) || matched.includes(c.key);
            return (
              <button
                key={c.uid}
                onClick={() => flip(i)}
                className={`flex aspect-square select-none touch-manipulation items-center justify-center rounded-xl border-4 text-3xl transition-transform active:scale-95 ${
                  isUp ? "border-primary bg-card" : "border-secondary bg-primary/20"
                }`}
              >
                {isUp ? c.emoji : "❓"}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---------- AI augmentation ----------
const AI_ENGINES = new Set([
  "logic",
  "cause_effect",
  "sorting_category",
  "sequence_order",
]);

function aiRoundToChoice(r: AiRound): ChoiceRound {
  return {
    question: r.question,
    options: shuffle([r.correct, ...r.others]).map((o) => ({
      key: o,
      render: <span className="text-lg">{o}</span>,
    })),
    correct: r.correct,
    hint: r.hint,
  };
}

// ---------- Main engine ----------
export function PuzzleEngine({ puzzle, onComplete }: { puzzle: PuzzleDef; onComplete: (stars: number) => void }) {
  const total = Math.max(puzzle.rounds ?? 5, 8); // ضمان حد أدنى 8 جولات لتقليل التكرار
  const [sessionId, setSessionId] = useState(0);
  const [aiRounds, setAiRounds] = useState<ChoiceRound[]>([]);

  // Top-up bank from AI for supported engines (fire-and-forget, falls back to static silently)
  useEffect(() => {
    let cancelled = false;
    if (!AI_ENGINES.has(puzzle.engine)) {
      setAiRounds([]);
      return;
    }
    generateExtraRounds({
      data: { engine: puzzle.engine as "logic", count: 8 },
    })
      .then((res) => {
        if (cancelled) return;
        setAiRounds((res?.rounds ?? []).map(aiRoundToChoice));
      })
      .catch(() => {
        if (!cancelled) setAiRounds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [puzzle.engine, sessionId]);

  function handleDone(score: number) {
    const ratio = score / Math.max(1, total);
    const stars = ratio >= 0.85 ? 3 : ratio >= 0.6 ? 2 : ratio > 0 ? 1 : 0;
    onComplete(stars);
    setSessionId((x) => x + 1);
  }

  if (puzzle.engine === "memory_pairs") {
    return <MemoryPairs key={sessionId} onDone={(stars) => { onComplete(stars); setSessionId((x) => x + 1); }} />;
  }

  const builders: Record<string, () => ChoiceRound> = {
    counting: buildCounting,
    odd_one_out: buildOddOneOut,
    shape_match: buildShapeMatch,
    color_match: buildColorMatch,
    shadow_match: buildShadow,
    letter_picture: buildLetterPicture,
    pattern_complete: buildPattern,
    sequence_order: buildSequenceOrder,
    missing_piece: buildMissingPiece,
    sorting_category: buildSorting,
    cause_effect: buildCauseEffect,
    attention: buildAttention,
    logic: buildLogic,
    spot_difference: buildSpotDifference,
    drag_match: buildDragMatch,
    story_order: buildStoryOrder,
    maze: buildMaze,
    audio_recognition: buildAudio,
    jigsaw_rotate: buildJigsawRotate,
    daily_mini: buildDailyMini,
  };

  const build = builders[puzzle.engine] ?? buildLogic;
  // توليد جولات فريدة: نخلط بين AI rounds والبنك الثابت لمنع التكرار
  const rounds = useMemo(() => {
    const out: ChoiceRound[] = [...aiRounds];
    const seenCorrect = new Set<string>(aiRounds.map((r) => r.correct));
    let attempts = 0;
    while (out.length < total && attempts < total * 6) {
      const r = build();
      if (!seenCorrect.has(r.correct) || out.length >= 10) {
        out.push(r);
        seenCorrect.add(r.correct);
      }
      attempts++;
    }
    while (out.length < total) out.push(build());
    return shuffle(out).slice(0, total);
  }, [sessionId, total, build, aiRounds]);

  return <ChoiceGame key={sessionId} rounds={rounds} total={total} onDone={handleDone} />;
}

