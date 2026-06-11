import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STORY_STYLE_PROMPT } from "@/lib/storyStyle";
import { parsePages } from "@/lib/storyTypes";

const GenerateStoryInput = z.object({
  childName: z.string().trim().min(1, "اسم الطفل مطلوب").max(40),
  theme: z.string().trim().min(3, "اكتب فكرة القصة").max(300),
  ageRange: z.string().trim().max(20).optional(),
});

interface AiStoryPage {
  n: number;
  text: string;
  scene: string;
}

interface AiStoryResult {
  title: string;
  summary: string;
  moral: string;
  category: string;
  pages: AiStoryPage[];
}

function extractJson(raw: string): AiStoryResult {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("لم نتمكن من قراءة القصة المولدة، حاول مرة أخرى");
  return JSON.parse(cleaned.slice(start, end + 1)) as AiStoryResult;
}

export const generateAiStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateStoryInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");

    const systemPrompt = `أنت كاتب قصص أطفال عربي محترف متخصص في القصص النبيلة والإنسانية والقيم الأخلاقية.
اكتب قصة أطفال قصيرة من 6 صفحات بالضبط.
قواعد صارمة:
- استخدم {child} ككلمة بديلة لاسم بطل القصة في النص العربي (لا تكتب الاسم الحقيقي أبداً).
- لغة عربية فصحى بسيطة ومشوقة تناسب الأطفال.
- لكل صفحة: نص عربي (جملتان إلى ثلاث جمل) + وصف مشهد بالإنجليزية للرسام (scene) يصف ما يفعله البطل الطفل "the hero child".
- القصة يجب أن تزرع قيمة نبيلة وتنتهي نهاية سعيدة ملهمة.
أعد فقط JSON صالحاً بهذا الشكل دون أي نص إضافي:
{"title":"عنوان جذاب قصير","summary":"ملخص جملة واحدة","moral":"القيمة المستفادة","category":"قيم وأخلاق أو الصداقة أو الأسرة والمحبة أو مغامرات وشجاعة أو عادات وحياة أو الطبيعة والحيوان","pages":[{"n":1,"text":"...","scene":"english scene description featuring the hero child"}]}`;

    const userPrompt = `اكتب قصة عن: ${data.theme}\nاسم البطل سيكون: ${data.childName} (لكن استخدم {child} في النص)\nالفئة العمرية: ${data.ageRange ?? "4-8 سنوات"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("الخدمة مشغولة حالياً، انتظر قليلاً ثم أعد المحاولة");
    if (res.status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي، تواصل مع إدارة الموقع");
    if (!res.ok) {
      console.error("AI story error", res.status, await res.text());
      throw new Error("تعذر توليد القصة، حاول مرة أخرى");
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const story = extractJson(json.choices?.[0]?.message?.content ?? "");
    const pages = parsePages(story.pages);
    if (pages.length < 4) throw new Error("القصة المولدة غير مكتملة، حاول مرة أخرى");

    const slug = `custom-${crypto.randomUUID().slice(0, 8)}`;
    const { data: inserted, error } = await context.supabase
      .from("story_templates")
      .insert({
        slug,
        title: story.title,
        summary: story.summary,
        moral: story.moral,
        category: story.category,
        age_range: data.ageRange ?? "4-8",
        cover_url: null,
        pages: pages as unknown as never,
        is_published: false,
        is_custom: true,
        created_by: context.userId,
      })
      .select("id, slug, title, summary, moral, category, pages")
      .single();

    if (error) {
      console.error("insert custom story", error);
      throw new Error("تعذر حفظ القصة");
    }

    return {
      id: inserted.id,
      slug: inserted.slug,
      title: inserted.title,
      summary: inserted.summary,
      moral: inserted.moral,
      category: inserted.category,
      pages,
      stylePrompt: STORY_STYLE_PROMPT,
    };
  });
