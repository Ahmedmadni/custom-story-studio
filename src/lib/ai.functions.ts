import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STORY_STYLE_PROMPT } from "@/lib/storyStyle";
import { parsePages } from "@/lib/storyTypes";

const GenerateInput = z.object({
  childName: z.string().trim().min(1, "اسم الطفل مطلوب").max(40),
  theme: z.string().trim().min(3, "اكتب فكرة المحتوى").max(300),
  age: z.string().trim().max(10).optional(),
  language: z.enum(["ar", "en"]).default("ar"),
  contentType: z.enum(["story", "book"]).default("story"),
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
  if (start === -1 || end === -1) throw new Error("لم نتمكن من قراءة المحتوى المولد، حاول مرة أخرى");
  return JSON.parse(cleaned.slice(start, end + 1)) as AiStoryResult;
}

const JSON_SHAPE = `{"title":"...","summary":"...","moral":"...","category":"...","pages":[{"n":1,"text":"...","scene":"english scene description featuring the hero child"}]}`;

function buildSystemPrompt(contentType: "story" | "book", language: "ar" | "en"): string {
  const langRule =
    language === "ar"
      ? "اكتب نصوص الصفحات والعنوان والملخص بلغة عربية فصحى بسيطة ومشوقة تناسب الأطفال."
      : "Write the page texts, title and summary in simple, engaging English suitable for young children. Keep the category in Arabic.";

  if (contentType === "story") {
    return `أنت كاتب قصص أطفال محترف متخصص في القصص النبيلة والإنسانية والقيم الأخلاقية.
اكتب قصة أطفال قصيرة من 6 صفحات بالضبط.
قواعد صارمة:
- ${langRule}
- استخدم {child} ككلمة بديلة لاسم بطل القصة في النص (لا تكتب الاسم الحقيقي أبداً).
- لكل صفحة: نص (جملتان إلى ثلاث جمل) + وصف مشهد بالإنجليزية للرسام (scene) يصف ما يفعله البطل الطفل "the hero child".
- القصة يجب أن تزرع قيمة نبيلة وتنتهي نهاية سعيدة ملهمة.
- category بالعربية من: قيم وأخلاق، الصداقة، الأسرة والمحبة، مغامرات وشجاعة، عادات وحياة، الطبيعة والحيوان.
أعد فقط JSON صالحاً بهذا الشكل دون أي نص إضافي:
${JSON_SHAPE}`;
  }

  return `أنت مؤلف كتب تعليمية للأطفال، تحول أي موضوع تعليمي إلى رحلة ممتعة وتفاعلية.
اكتب كتاباً تعليمياً للأطفال من 6 صفحات بالضبط حول الموضوع المطلوب.
قواعد صارمة:
- ${langRule}
- استخدم {child} ككلمة بديلة لاسم الطفل المتعلم في النص (لا تكتب الاسم الحقيقي أبداً)، واجعله مشاركاً في التعلم.
- كل صفحة تعلّم فكرة أو معلومة واحدة بسيطة ومتدرجة (جملتان إلى ثلاث جمل) + وصف مشهد بالإنجليزية للرسام (scene) يصف ما يفعله الطفل المتعلم "the hero child".
- الصفحة الأخيرة تلخص ما تعلمه الطفل وتشجعه.
- moral هي المهارة أو المعرفة المكتسبة.
- category بالعربية من: الحروف والأرقام، الألوان والأشكال، علوم وطبيعة، مهارات وحياة.
أعد فقط JSON صالحاً بهذا الشكل دون أي نص إضافي:
${JSON_SHAPE}`;
}

export const generateAiStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");

    const typeLabel = data.contentType === "book" ? "كتاب تعليمي" : "قصة";
    const userPrompt = `اكتب ${typeLabel} عن: ${data.theme}
اسم الطفل سيكون: ${data.childName} (لكن استخدم {child} في النص)
عمر الطفل: ${data.age ?? "4-8"} سنوات
لغة المحتوى: ${data.language === "ar" ? "العربية" : "الإنجليزية"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: buildSystemPrompt(data.contentType, data.language) },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("الخدمة مشغولة حالياً، انتظر قليلاً ثم أعد المحاولة");
    if (res.status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي، تواصل مع إدارة الموقع");
    if (!res.ok) {
      console.error("AI generate error", res.status, await res.text());
      throw new Error("تعذر التوليد، حاول مرة أخرى");
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const story = extractJson(json.choices?.[0]?.message?.content ?? "");
    const pages = parsePages(story.pages);
    if (pages.length < 4) throw new Error("المحتوى المولد غير مكتمل، حاول مرة أخرى");

    const slug = `custom-${crypto.randomUUID().slice(0, 8)}`;
    const { data: inserted, error } = await context.supabase
      .from("story_templates")
      .insert({
        slug,
        title: story.title,
        summary: story.summary,
        moral: story.moral,
        category: story.category,
        age_range: data.age ?? "4-8",
        cover_url: null,
        pages: pages as unknown as never,
        is_published: false,
        is_custom: true,
        created_by: context.userId,
        content_type: data.contentType,
        language: data.language,
      })
      .select("id, slug, title, summary, moral, category, pages")
      .single();

    if (error) {
      console.error("insert custom content", error);
      throw new Error("تعذر حفظ المحتوى");
    }

    return {
      id: inserted.id,
      slug: inserted.slug,
      title: inserted.title,
      summary: inserted.summary,
      moral: inserted.moral,
      category: inserted.category,
      pages,
      contentType: data.contentType,
      language: data.language,
      stylePrompt: STORY_STYLE_PROMPT,
    };
  });
