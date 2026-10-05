export type StoryArcRole = "opening" | "development" | "climax" | "resolution";

export function storyArcRole(index: number, total: number): StoryArcRole {
  if (total <= 1 || index <= 0) return "opening";
  if (index >= total - 1) return "resolution";
  if (index >= Math.max(1, total - 2)) return "climax";
  return "development";
}

export function narrationWordBudget(durationSeconds: number, language: string) {
  const seconds = Math.max(2, Math.min(15, Math.round(durationSeconds)));
  const wordsPerSecond = language === "en" ? 2.1 : language === "bilingual" ? 1.55 : 1.75;
  return Math.max(5, Math.floor(seconds * wordsPerSecond));
}

export function fitNarrationToDuration(
  text: string,
  durationSeconds: number,
  language: string,
  fallback: string,
) {
  const normalized = text.trim().replace(/\s+/g, " ");
  const source = normalized || fallback.trim();
  const words = source.split(" ").filter(Boolean);
  const budget = narrationWordBudget(durationSeconds, language);
  if (words.length <= budget) return source;

  const sliced = words.slice(0, budget).join(" ");
  const lastBreak = Math.max(
    sliced.lastIndexOf("،"),
    sliced.lastIndexOf(","),
    sliced.lastIndexOf("؛"),
    sliced.lastIndexOf(";"),
    sliced.lastIndexOf("."),
    sliced.lastIndexOf("!"),
    sliced.lastIndexOf("؟"),
    sliced.lastIndexOf("?"),
  );
  const candidate = lastBreak >= Math.floor(sliced.length * 0.55)
    ? sliced.slice(0, lastBreak + 1)
    : sliced;
  return candidate.replace(/[،,؛;:\-–—]+$/u, "").trim() + "…";
}

export function sceneDirection(role: StoryArcRole) {
  if (role === "opening") {
    return "Opening beat: clearly establish the child hero, location and immediate goal.";
  }
  if (role === "climax") {
    return "Climax beat: show the clearest challenge, decision or emotionally strongest action.";
  }
  if (role === "resolution") {
    return "Resolution beat: land the story warmly with a visually clear, satisfying closing moment.";
  }
  return "Development beat: advance the story with one clear action and avoid repeating the previous scene.";
}
