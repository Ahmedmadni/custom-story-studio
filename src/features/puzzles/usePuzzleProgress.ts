import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { recordPuzzleCompletion as recordPuzzleCompletionServer } from "@/features/games/progress.functions";

const STORAGE_KEY = "hekayati_puzzle_progress_v1";

export interface PuzzleProgress {
  puzzleId: string;
  stars: number; // 0..3 (best)
  bestScore: number;
  attempts: number;
  completed: boolean;
  lastPlayedAt: string;
}

type ProgressMap = Record<string, PuzzleProgress>;

function readLocal(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as ProgressMap;
  } catch {
    return {};
  }
}

function writeLocal(map: ProgressMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function gameKey(id: string) {
  return `puzzle_${id}`;
}

export function useAllPuzzleProgress() {
  const { user } = useAuth();
  const [map, setMap] = useState<ProgressMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const local = readLocal();
    setMap(local);
    if (!user) {
      setLoading(false);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("game_progress")
        .select("game_key, score, best_score, rounds_played, last_played_at")
        .eq("user_id", user.id)
        .like("game_key", "puzzle_%");
      if (data) {
        const merged: ProgressMap = { ...local };
        for (const row of data) {
          const id = (row.game_key as string).replace(/^puzzle_/, "");
          merged[id] = {
            puzzleId: id,
            stars: row.best_score ?? 0,
            bestScore: row.best_score ?? 0,
            attempts: row.rounds_played ?? 0,
            completed: (row.best_score ?? 0) > 0,
            lastPlayedAt: (row.last_played_at as string) ?? new Date().toISOString(),
          };
        }
        setMap(merged);
        writeLocal(merged);
      }
      setLoading(false);
    })();
  }, [user]);

  return { progress: map, loading, isSignedIn: !!user };
}

export function usePuzzleProgress(puzzleId: string) {
  const { user } = useAuth();
  const recordCompletionServer = useServerFn(recordPuzzleCompletionServer);
  const [progress, setProgress] = useState<PuzzleProgress>(() => {
    const local = readLocal();
    return (
      local[puzzleId] ?? {
        puzzleId,
        stars: 0,
        bestScore: 0,
        attempts: 0,
        completed: false,
        lastPlayedAt: new Date().toISOString(),
      }
    );
  });

  useEffect(() => {
    if (!user || !puzzleId) return;
    void (async () => {
      const { data } = await supabase
        .from("game_progress")
        .select("score, best_score, rounds_played, last_played_at")
        .eq("user_id", user.id)
        .eq("game_key", gameKey(puzzleId))
        .maybeSingle();
      if (data) {
        const next: PuzzleProgress = {
          puzzleId,
          stars: data.best_score ?? 0,
          bestScore: data.best_score ?? 0,
          attempts: data.rounds_played ?? 0,
          completed: (data.best_score ?? 0) > 0,
          lastPlayedAt: (data.last_played_at as string) ?? new Date().toISOString(),
        };
        setProgress(next);
        const local = readLocal();
        local[puzzleId] = next;
        writeLocal(local);
      }
    })();
  }, [user, puzzleId]);

  async function recordCompletion(stars: number) {
    const safeStars = Math.max(0, Math.min(3, Math.round(stars)));
    let next: PuzzleProgress;

    if (user && puzzleId) {
      const saved = await recordCompletionServer({ data: { puzzleId, stars: safeStars } });
      next = { puzzleId, ...saved };
    } else {
      next = {
        puzzleId,
        stars: Math.max(progress.stars, safeStars),
        bestScore: Math.max(progress.bestScore, safeStars),
        attempts: progress.attempts + 1,
        completed: true,
        lastPlayedAt: new Date().toISOString(),
      };
    }

    setProgress(next);
    const local = readLocal();
    local[puzzleId] = next;
    writeLocal(local);
    return next;
  }

  return { progress, recordCompletion, isSignedIn: !!user };
}
