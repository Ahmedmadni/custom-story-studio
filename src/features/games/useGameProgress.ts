import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { GameKey, AgeGroup } from "./types";

export interface GameProgress {
  score: number;
  best_score: number;
  rounds_played: number;
}

export function useGameProgress(gameKey: GameKey, ageGroup: AgeGroup) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<GameProgress>({ score: 0, best_score: 0, rounds_played: 0 });

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
    setProgress((p) => {
      const score = correct ? p.score + 1 : p.score;
      const rounds_played = p.rounds_played + 1;
      const best_score = Math.max(p.best_score, score);
      const next = { score, best_score, rounds_played };
      if (user) {
        void supabase.from("game_progress").upsert(
          {
            user_id: user.id,
            game_key: gameKey,
            age_group: ageGroup,
            score,
            best_score,
            rounds_played,
            last_played_at: new Date().toISOString(),
          },
          { onConflict: "user_id,game_key" },
        );
      }
      return next;
    });
  }

  function resetSession() {
    setProgress((p) => ({ ...p, score: 0, rounds_played: 0 }));
  }

  return { progress, recordRound, resetSession, isSignedIn: !!user };
}
