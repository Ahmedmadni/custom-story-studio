import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { recordGameRound, resetGameProgressSession } from "./progress.functions";
import type { GameKey, AgeGroup } from "./types";

export interface GameProgress {
  score: number;
  best_score: number;
  rounds_played: number;
}

export function useGameProgress(gameKey: GameKey, ageGroup: AgeGroup) {
  const { user } = useAuth();
  const recordRoundServer = useServerFn(recordGameRound);
  const resetSessionServer = useServerFn(resetGameProgressSession);
  const [progress, setProgress] = useState<GameProgress>({
    score: 0,
    best_score: 0,
    rounds_played: 0,
  });

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("game_progress")
        .select("score, best_score, rounds_played")
        .eq("user_id", user.id)
        .eq("game_key", gameKey)
        .maybeSingle();
      if (data) setProgress(data as GameProgress);
    })();
  }, [user, gameKey]);

  async function recordRound(correct: boolean) {
    if (!user) {
      setProgress((p) => {
        const score = correct ? p.score + 1 : p.score;
        return {
          score,
          best_score: Math.max(p.best_score, score),
          rounds_played: p.rounds_played + 1,
        };
      });
      return;
    }

    const saved = await recordRoundServer({ data: { gameKey, ageGroup, correct } });
    setProgress({
      score: saved.score,
      best_score: saved.best_score,
      rounds_played: saved.rounds_played,
    });
  }

  function resetSession() {
    setProgress((p) => ({ ...p, score: 0, rounds_played: 0 }));
    if (user) {
      void resetSessionServer({ data: { gameKey, ageGroup } }).then((saved) => {
        setProgress({
          score: saved.score,
          best_score: saved.best_score,
          rounds_played: saved.rounds_played,
        });
      });
    }
  }

  return { progress, recordRound, resetSession, isSignedIn: !!user };
}
