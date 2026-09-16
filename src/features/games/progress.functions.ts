import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const gameKeySchema = z.enum([
  "numbers",
  "letters_ar",
  "letters_en",
  "shapes",
  "colors",
  "coloring",
]);
const ageGroupSchema = z.enum(["young", "older"]);
const puzzleIdSchema = z.string().trim().regex(/^[a-zA-Z0-9_-]{1,100}$/);

const gameRoundInput = z
  .object({
    gameKey: gameKeySchema,
    ageGroup: ageGroupSchema,
    correct: z.boolean(),
  })
  .strict();

const resetGameInput = z
  .object({ gameKey: gameKeySchema, ageGroup: ageGroupSchema })
  .strict();

const puzzleCompletionInput = z
  .object({
    puzzleId: puzzleIdSchema,
    stars: z.number().int().min(0).max(3),
  })
  .strict();

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Record exactly one game round. The browser never supplies absolute score values. */
export const recordGameRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => gameRoundInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { data: current, error: readError } = await admin
      .from("game_progress")
      .select("score, best_score, rounds_played")
      .eq("user_id", context.userId)
      .eq("game_key", data.gameKey)
      .maybeSingle();
    if (readError) throw new Error("تعذر قراءة تقدم اللعبة");

    const score = (current?.score ?? 0) + (data.correct ? 1 : 0);
    const roundsPlayed = (current?.rounds_played ?? 0) + 1;
    const bestScore = Math.max(current?.best_score ?? 0, score);
    const lastPlayedAt = new Date().toISOString();

    const { error } = await admin.from("game_progress").upsert(
      {
        user_id: context.userId,
        game_key: data.gameKey,
        age_group: data.ageGroup,
        score,
        best_score: bestScore,
        rounds_played: roundsPlayed,
        last_played_at: lastPlayedAt,
      },
      { onConflict: "user_id,game_key" },
    );
    if (error) throw new Error("تعذر حفظ تقدم اللعبة");

    return { score, best_score: bestScore, rounds_played: roundsPlayed, last_played_at: lastPlayedAt };
  });

/** Reset the current game session counters without allowing the browser to set a score. */
export const resetGameProgressSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetGameInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { data: current, error: readError } = await admin
      .from("game_progress")
      .select("best_score")
      .eq("user_id", context.userId)
      .eq("game_key", data.gameKey)
      .maybeSingle();
    if (readError) throw new Error("تعذر قراءة تقدم اللعبة");

    const lastPlayedAt = new Date().toISOString();
    const { error } = await admin.from("game_progress").upsert(
      {
        user_id: context.userId,
        game_key: data.gameKey,
        age_group: data.ageGroup,
        score: 0,
        best_score: current?.best_score ?? 0,
        rounds_played: 0,
        last_played_at: lastPlayedAt,
      },
      { onConflict: "user_id,game_key" },
    );
    if (error) throw new Error("تعذر تصفير جلسة اللعبة");
    return { score: 0, best_score: current?.best_score ?? 0, rounds_played: 0 };
  });

/** Record one completed puzzle with a bounded 0..3 star result. */
export const recordPuzzleCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => puzzleCompletionInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const gameKey = `puzzle_${data.puzzleId}`;
    const { data: current, error: readError } = await admin
      .from("game_progress")
      .select("best_score, rounds_played")
      .eq("user_id", context.userId)
      .eq("game_key", gameKey)
      .maybeSingle();
    if (readError) throw new Error("تعذر قراءة تقدم اللغز");

    const bestScore = Math.max(current?.best_score ?? 0, data.stars);
    const roundsPlayed = (current?.rounds_played ?? 0) + 1;
    const lastPlayedAt = new Date().toISOString();
    const { error } = await admin.from("game_progress").upsert(
      {
        user_id: context.userId,
        game_key: gameKey,
        age_group: "puzzle",
        score: data.stars,
        best_score: bestScore,
        rounds_played: roundsPlayed,
        last_played_at: lastPlayedAt,
      },
      { onConflict: "user_id,game_key" },
    );
    if (error) throw new Error("تعذر حفظ تقدم اللغز");

    return {
      stars: bestScore,
      bestScore,
      attempts: roundsPlayed,
      completed: bestScore > 0,
      lastPlayedAt,
    };
  });
