export type PuzzleDifficulty = "easy" | "medium" | "hard";

export type PuzzleEngineKind =
  | "counting"
  | "odd_one_out"
  | "shape_match"
  | "color_match"
  | "shadow_match"
  | "letter_picture"
  | "memory_pairs"
  | "pattern_complete"
  | "sequence_order"
  | "missing_piece"
  | "sorting_category"
  | "cause_effect"
  | "attention"
  | "logic"
  | "spot_difference"
  | "drag_match"
  | "story_order"
  | "maze"
  | "audio_recognition"
  | "jigsaw_rotate"
  | "daily_mini";

export interface PuzzleSkill {
  key: string;
  label: string;
}

export interface PuzzleDef {
  id: string;
  title: string;
  description: string;
  emoji: string;
  engine: PuzzleEngineKind;
  difficulty: PuzzleDifficulty;
  estimatedMinutes: number;
  skills: PuzzleSkill[];
  color: string; // tailwind bg utility
  rounds?: number; // default 5
  config?: Record<string, unknown>;
}

export const DIFFICULTY_LABEL: Record<PuzzleDifficulty, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

export const DIFFICULTY_COLOR: Record<PuzzleDifficulty, string> = {
  easy: "bg-grass/25 text-foreground",
  medium: "bg-accent/30 text-foreground",
  hard: "bg-destructive/20 text-foreground",
};
