export type GameKey = "numbers" | "letters_ar" | "letters_en" | "shapes" | "colors" | "coloring";

export interface GameDef {
  key: GameKey;
  title: string;
  desc: string;
  emoji: string;
  color: string; // tailwind bg class
}

export const GAMES: GameDef[] = [
  { key: "numbers", title: "تعلّم الأرقام والعد", desc: "اختر العدد الصحيح للأشياء", emoji: "🔢", color: "bg-primary/15" },
  { key: "letters_ar", title: "الحروف العربية", desc: "اختر الحرف الصحيح للكلمة", emoji: "أ", color: "bg-candy/30" },
  { key: "letters_en", title: "English Letters", desc: "Pick the right letter", emoji: "A", color: "bg-grass/30" },
  { key: "shapes", title: "الأشكال", desc: "تعرّف على الأشكال الهندسية", emoji: "🔺", color: "bg-accent/20" },
  { key: "colors", title: "الألوان", desc: "اختر اللون المطلوب", emoji: "🎨", color: "bg-secondary/40" },
  { key: "coloring", title: "التلوين التفاعلي", desc: "لوّن الرسمة بإصبعك أو الفأرة", emoji: "🖌️", color: "bg-primary/10" },
];

export type AgeGroup = "young" | "older";
