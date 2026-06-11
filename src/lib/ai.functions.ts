import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STORY_STYLE_PROMPT, STYLE_NEGATIVE, ageStylePrompt, photoModePrompt } from "@/lib/storyStyle";
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
  title: string;
  text: string;
  scene: string;
}

interface AiStoryResult {
  title: string;
  summary: string;
  moral: string;
  category: string;
  /** وصف ثابت بالإنجليزية لشكل البطل لضمان اتساق الصور بين الصفحات */
  character: string;
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

const JSON_SHAPE = `{"title":"...","summary":"...","moral":"...","category":"...","character":"consistent english visual description of the hero child (hair, eyes, skin, outfit)","pages":[{"n":1,"title":"short page title","text":"...","scene":"english scene description featuring the hero child, directly matching the page text"}]}`;

function buildSystemPrompt(contentType: "story" | "book", language: "ar" | "en"): string {
  const langRule =
    language === "ar"
      ? "اكتب نصوص الصفحات وعناوينها والعنوان والملخص بلغة عربية فصحى بسيطة ومشوقة تناسب الأطفال."
      : "Write the page texts, page titles, title and summary in simple, engaging English suitable for young children. Keep the category in Arabic.";

  const pageRules = `- لكل صفحة: عنوان قصير جذاب (title من 2 إلى 4 كلمات بلغة المحتوى) + نص (جملتان إلى ثلاث جمل) + وصف مشهد بالإنجليزية للرسام (scene).
- character: وصف بصري ثابت بالإنجليزية لشكل البطل الطفل (الشعر، العينان، البشرة، الملابس) يبقى نفسه في كل الصفحات، ويجب أن يعكس عمر الطفل المحدد بدقة: طفل صغير جداً = شخصية أصغر وألطف وأبسط بملابس ناعمة، طفل أكبر = شخصية أطول وأكثر نضجاً في الملامح والملابس.
- scene يجب أن يصور حرفياً ما يحدث في نص نفس الصفحة (نفس المكان، نفس الفعل، نفس الشخصيات) حتى يشعر القارئ أن الصورة جزء من المشهد المكتوب، ويذكر "the hero child" دائماً، وتكون الأجواء والتفاصيل والمفردات مناسبة لعمر الطفل.`;

  if (contentType === "story") {
    return `أنت كاتب قصص أطفال محترف متخصص في القصص النبيلة والإنسانية والقيم الأخلاقية.
اكتب قصة أطفال قصيرة من 6 صفحات بالضبط.
قواعد صارمة:
- ${langRule}
- استخدم {child} ككلمة بديلة لاسم بطل القصة في النص (لا تكتب الاسم الحقيقي أبداً).
${pageRules}
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
- كل صفحة تعلّم فكرة أو معلومة واحدة بسيطة ومتدرجة.
${pageRules}
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
    const rawPages = parsePages(story.pages);
    if (rawPages.length < 4) throw new Error("المحتوى المولد غير مكتمل، حاول مرة أخرى");

    // دمج وصف البطل الثابت + نمط العمر داخل كل مشهد لضمان اتساق الصور وملاءمتها لعمر الطفل
    const character = (story.character ?? "").trim();
    const ageStyle = ageStylePrompt(data.age);
    const pages = rawPages.map((p) => ({
      ...p,
      scene: `${ageStyle}. ${character ? `The hero child: ${character}. ` : ""}Scene: ${p.scene}`,
    }));

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

const PageImageInput = z.object({
  templateId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(12),
  /** مسار صورة الطفل المرفوعة (اختياري) لاستخدامها كمرجع في الرسم */
  childPhotoPath: z.string().trim().max(300).optional(),
  /** cartoon = تحويل لشخصية كرتونية، real = إبقاء الملامح الحقيقية مع تحسين الجودة والدمج */
  photoMode: z.enum(["cartoon", "real"]).optional(),
});

/**
 * توليد صورة صفحة من قصة/كتاب أنشأه المستخدم — بنفس مشهد نص الصفحة
 * وبالنمط المعتمد Children's Cartoon Style 3D، ثم حفظها وربطها بالصفحة.
 */
export const generatePageImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PageImageInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");

    // RLS: المستخدم يرى قوالبه المخصصة فقط (أو المدير)
    const { data: template, error: tplErr } = await context.supabase
      .from("story_templates")
      .select("id, pages, created_by, age_range")
      .eq("id", data.templateId)
      .single();
    if (tplErr || !template) throw new Error("المحتوى غير موجود");
    if (template.created_by !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("غير مصرح لك");
    }

    const pages = parsePages(template.pages);
    const page = pages.find((p) => p.n === data.pageNumber);
    if (!page) throw new Error("الصفحة غير موجودة");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // صورة الطفل المرجعية (اختياري) — يجب أن تخص المستخدم نفسه
    let photoDataUrl: string | null = null;
    if (data.childPhotoPath) {
      if (!data.childPhotoPath.startsWith(`${context.userId}/`)) {
        throw new Error("غير مصرح لك باستخدام هذه الصورة");
      }
      const { data: file, error: dlErr } = await supabaseAdmin.storage
        .from("child-photos")
        .download(data.childPhotoPath);
      if (dlErr || !file) {
        console.error("download child photo", dlErr);
      } else {
        const buf = Buffer.from(await file.arrayBuffer());
        photoDataUrl = `data:${file.type || "image/jpeg"};base64,${buf.toString("base64")}`;
      }
    }

    // ضمان تطبيق نمط العمر حتى للقوالب القديمة التي لا تحمله داخل المشهد
    const agePart = page.scene.includes("Age styling")
      ? ""
      : `\n${ageStylePrompt(template.age_range)}.`;
    const photoPart = photoDataUrl
      ? `\n${photoModePrompt(data.photoMode ?? "cartoon")}.`
      : "";
    const prompt = `${STORY_STYLE_PROMPT}.${agePart}${photoPart}
Children's storybook page illustration that literally depicts this exact written scene so the image feels like part of the text: ${page.scene}.
Square composition, rich storytelling details, ${STYLE_NEGATIVE}.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: photoDataUrl
              ? [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: photoDataUrl } },
                ]
              : prompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (res.status === 429) throw new Error("الخدمة مشغولة، انتظر قليلاً ثم أعد المحاولة");
    if (res.status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي");
    if (!res.ok) {
      console.error("page image error", res.status, await res.text());
      throw new Error("تعذر توليد صورة الصفحة");
    }

    const json = (await res.json()) as {
      choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
    };
    const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.includes("base64,")) throw new Error("لم يُرجع النموذج صورة، أعد المحاولة");

    const bytes = Buffer.from(dataUrl.split("base64,")[1], "base64");
    const imagePath = `templates/${data.templateId}/page-${data.pageNumber}.png`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("story-pages")
      .upload(imagePath, bytes, { contentType: "image/png", upsert: true });
    if (uploadErr) {
      console.error("upload page image", uploadErr);
      throw new Error("تعذر حفظ الصورة");
    }

    // ربط الصورة بالصفحة داخل القالب
    const updatedPages = pages.map((p) =>
      p.n === data.pageNumber ? { ...p, image_path: imagePath } : p,
    );
    await supabaseAdmin
      .from("story_templates")
      .update({ pages: updatedPages as unknown as never })
      .eq("id", data.templateId);

    const { data: signed } = await supabaseAdmin.storage
      .from("story-pages")
      .createSignedUrl(imagePath, 60 * 60 * 24);

    return { pageNumber: data.pageNumber, imageUrl: signed?.signedUrl ?? null };
  });

const UpdatePageTextInput = z.object({
  templateId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(12),
  title: z.string().trim().max(80).optional(),
  text: z.string().trim().min(1, "نص الصفحة مطلوب").max(1000),
});

/**
 * تعديل عنوان/نص صفحة في قصة أو كتاب أنشأه المستخدم — قبل اعتماد المحتوى وتصدير PDF.
 */
export const updatePageText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdatePageTextInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: template, error: tplErr } = await context.supabase
      .from("story_templates")
      .select("id, pages, created_by")
      .eq("id", data.templateId)
      .single();
    if (tplErr || !template) throw new Error("المحتوى غير موجود");
    if (template.created_by !== context.userId) throw new Error("غير مصرح لك");

    const pages = parsePages(template.pages);
    if (!pages.some((p) => p.n === data.pageNumber)) throw new Error("الصفحة غير موجودة");

    const updatedPages = pages.map((p) =>
      p.n === data.pageNumber
        ? { ...p, title: data.title ?? p.title, text: data.text }
        : p,
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("story_templates")
      .update({ pages: updatedPages as unknown as never })
      .eq("id", data.templateId);
    if (upErr) {
      console.error("update page text", upErr);
      throw new Error("تعذر حفظ التعديل");
    }

    return { ok: true, pageNumber: data.pageNumber };
  });
