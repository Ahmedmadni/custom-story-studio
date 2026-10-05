import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  engine: z.enum(["logic", "cause_effect", "sorting_category", "sequence_order"]),
  count: z.number().int().min(1).max(8).default(8),
});

export type AiRound = {
  question: string;
  correct: string;
  others: string[];
  hint?: string;
};

const ENGINE_BRIEFS: Record<string, string> = {
  logic:
    "أسئلة منطقية صح/خطأ مناسبة لأطفال 4-9 سنوات. الإجابة دائماً 'صح ✅' أو 'خطأ ❌' فقط. مزج بين حقائق عن الطبيعة والحيوانات والرياضيات والأشياء اليومية.",
  cause_effect:
    "أسئلة سبب ونتيجة قصيرة جداً مع 4 خيارات. الإجابة الصحيحة بديهية لطفل ومع رمز emoji واحد في نهايتها. الخيارات الأخرى منطقية لكن خاطئة.",
  sorting_category:
    "أسئلة تصنيف: اختر العنصر الذي ينتمي لمجموعة معينة (حيوانات/فواكه/مركبات/أدوات…). كل خيار اسم + emoji.",
  sequence_order:
    "أسئلة ترتيب وتسلسل: ما الذي يأتي أولاً/أخيراً في تسلسل طبيعي (بيضة→كتكوت→دجاجة، بذرة→نبتة→شجرة…). 4 خيارات مع emoji.",
};

function extractJson(raw: string): { rounds: AiRound[] } {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("bad json");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export const generateExtraRounds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    // Static puzzle banks are the default production path. AI augmentation must
    // be explicitly enabled to avoid silently consuming provider credits.
    if (process.env.PUZZLE_AI_ENABLED !== "true") {
      return { rounds: [] as AiRound[] };
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { rounds: [] as AiRound[] };

    const brief = ENGINE_BRIEFS[data.engine];
    const seed = Math.random().toString(36).slice(2, 10);
    const system = `أنت مولّد ألعاب تعليمية عربية للأطفال. أعد فقط JSON صالحاً بدون أي شرح إضافي.
المطلوب: ${data.count} أسئلة جديدة وفريدة (لا تكرر السؤال نفسه). ${brief}
بذرة عشوائية للتنويع: ${seed}.
الشكل المطلوب بالضبط:
{"rounds":[{"question":"...","correct":"...","others":["...","...","..."],"hint":"..."}]}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: system },
            { role: "user", content: `أعطني ${data.count} أسئلة جديدة الآن.` },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) return { rounds: [] as AiRound[] };
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const parsed = extractJson(json.choices?.[0]?.message?.content ?? "");
      const rounds = (parsed.rounds ?? [])
        .filter(
          (r) =>
            r &&
            typeof r.question === "string" &&
            typeof r.correct === "string" &&
            Array.isArray(r.others) &&
            r.others.length >= 2,
        )
        .slice(0, data.count);
      return { rounds };
    } catch {
      return { rounds: [] as AiRound[] };
    } finally {
      clearTimeout(timer);
    }
  });
