import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { childLevelMeta } from "@/features/rewards/childLevels";

/** Displays a celebratory modal when the current level exceeds the last seen level (stored in localStorage). */
export function LevelUpWatcher({
  childId,
  childName,
  currentLevel,
}: {
  childId: string;
  childName: string;
  currentLevel: number;
}) {
  const [showLevel, setShowLevel] = useState<number | null>(null);
  const storageKey = `kidzy:lastLevel:${childId}`;

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    const prev = raw ? Number(raw) : currentLevel;
    if (currentLevel > prev) {
      setShowLevel(currentLevel);
    }
    localStorage.setItem(storageKey, String(currentLevel));
  }, [childId, currentLevel, storageKey]);

  const close = () => setShowLevel(null);
  const meta = showLevel ? childLevelMeta(showLevel) : null;

  return (
    <Dialog open={showLevel !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm overflow-hidden border-0 bg-gradient-to-br from-primary via-fuchsia-500 to-orange-400 p-0 text-white">
        <Confetti />
        <div className="relative z-10 space-y-4 p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-widest">Level Up!</p>
          <div className="text-7xl">{meta?.emoji}</div>
          <h2 className="font-display text-3xl font-extrabold">🎉 مبروك يا {childName}!</h2>
          <p className="text-lg font-bold">
            وصلت إلى المستوى {showLevel}
            <br />
            <span className="text-white/90">{meta?.label}</span>
          </p>
          <Button
            onClick={close}
            size="lg"
            className="mt-4 w-full rounded-full bg-white text-primary hover:bg-white/90"
          >
            متابعة المغامرة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 40 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 1.5;
        const dur = 2 + Math.random() * 2;
        const size = 6 + Math.random() * 8;
        const colors = ["#fde047", "#f472b6", "#a5f3fc", "#c4b5fd", "#fca5a5"];
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className="absolute top-[-20px] animate-[fall_linear_infinite] rounded-sm"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              background: color,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
              animationName: "kidzy-fall",
            }}
          />
        );
      })}
      <style>{`@keyframes kidzy-fall { to { transform: translateY(120vh) rotate(720deg); } }`}</style>
    </div>
  );
}
