import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BOOK_CATEGORIES,
  pagesForLength,
  type BookMeta,
} from "@/features/library/bookCategories";
import {
  STORY_STYLE_PROMPT,
  STYLE_NEGATIVE,
  LANDSCAPE_COMPOSITION_RULE,
  WIDE_FRAMING_RULE,
  CONSISTENCY_RULE,
  QUALITY_RULE,
  ageStylePrompt,
  bakedTitlePrompt,
  photoModePrompt,
} from "@/features/ai/storyStyle";
import { parsePages, type StoryPage } from "@/features/ai/storyTypes";

const BookMetaInput = z.object({
  category: z.enum([
    "mathematics",
    "science",
    "programming",
    "arabic_letters",
    "english_letters",
    "animals",
    "fruits",
    "colors",
  ]),
  reading_level: z.enum(["beginner", "intermediate", "advanced"]),
  length: z.enum(["short", "medium", "long"]),
});

const GenerateInput = z.object({
  childName: z.string().trim().min(1, "اسم الطفل مطلوب").max(40),
  theme: z.string().trim().max(300).optional(),
  age: z.string().trim().max(10).optional(),
  gender: z.enum(["boy", "girl"]).default("boy"),
  language: z.enum(["ar", "en", "bilingual"]).default("ar"),
  contentType: z.enum(["story", "book"]).default("story"),
  pagesCount: z.union([z.literal(10), z.literal(16)]).optional(),
  bookMeta: BookMetaInput.optional(),
});

interface AiPage {
  n: number;
  title?: string;
  text?: string;
  title_ar?: string;
  title_en?: string;
  text_ar?: string;
  text_en?: string;
  scene: string;
}

interface AiResult {
  title: string;
  title_ar?: string;
  title_en?: string;
  summary: string;
  moral: string;
  category: string;
  character: string;
  learning_goals?: string[];
  pages: AiPage[];
}

function extractJson(raw: string): AiResult {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1)
    throw new Error("لم نتمكن من قراءة المحتوى المولد، حاول مرة أخرى");
  return JSON.parse(cleaned.slice(start, end + 1)) as AiResult;
}

function langRule(language: "ar" | "en" | "bilingual"): string {
  if (language === "ar")
    return "اكتب كل النصوص (العناوين، النص، الملخص) بلغة عربية فصحى بسيطة ومشوقة تناسب الأطفال. استخدم حقول title و text فقط.";
  if (language === "en")
    return "Write all texts (titles, body, summary) in simple engaging English for young children. Use only the title and text fields. Keep the category in Arabic.";
  return "BILINGUAL MODE — for EACH page provide BOTH Arabic and English: title_ar, title_en, text_ar, text_en. Also provide top-level title_ar AND title_en. The Arabic and English versions of each page must convey the EXACT same meaning (educational translation, not literal), tuned for kids. Keep the category in Arabic.";
}

function jsonShape(language: "ar" | "en" | "bilingual"): string {
  const titles =
    language === "bilingual"
      ? `"title":"<arabic title>","title_ar":"...","title_en":"..."`
      : `"title":"..."`;
  const pageShape =
    language === "bilingual"
      ? `{"n":1,"title_ar":"...","title_en":"...","text_ar":"...","text_en":"...","image_title_en":"1-3 word english poster title for this page","scene":"english scene description featuring the hero child, directly matching this page"}`
      : `{"n":1,"title":"short page title","text":"...","image_title_en":"1-3 word english poster title for this page","scene":"english scene description featuring the hero child, directly matching this page"}`;
  return `{${titles},"summary":"...","moral":"...","category":"...","character":"consistent english visual description of the hero child","learning_goals":["short goal","..."],"pages":[${pageShape}]}`;
}

function buildSystemPrompt(
  contentType: "story" | "book",
  language: "ar" | "en" | "bilingual",
  pageCount: number,
  bookMeta?: BookMeta,
): string {
  const pageRules = `- لكل صفحة: عنوان قصير (2-4 كلمات) + نص (جملتان إلى ثلاث جمل) + image_title_en (1-3 كلمات إنجليزية واضحة كاسم بوستر تُرسم داخل الصورة) + وصف مشهد بالإنجليزية للرسام (scene).
- character: وصف بصري ثابت بالإنجليزية لشكل الطفل البطل (الشعر، العينان، البشرة، الملابس) يبقى نفسه في كل الصفحات، ويعكس عمر الطفل: طفل صغير = شخصية أصغر وأبسط، طفل أكبر = أطول وأكثر نضجاً.
- scene يجب أن يصور حرفياً ما يحدث في نص نفس الصفحة بنفس المكان والفعل والشخصيات، ويذكر "the hero child" دائماً.`;

  if (contentType === "story") {
    return `أنت كاتب قصص أطفال محترف متخصص في القصص النبيلة والقيم.
اكتب قصة أطفال من ${pageCount} صفحات بالضبط.
قواعد صارمة:
- ${langRule(language)}
- استخدم {child} ككلمة بديلة لاسم بطل القصة في كل النصوص (لا تكتب الاسم الحقيقي).
${pageRules}
- learning_goals: 2-3 أهداف قصيرة لما سيتعلمه الطفل (القيمة، السلوك).
- نهاية سعيدة ملهمة.
- category بالعربية من: قيم وأخلاق، الصداقة، الأسرة والمحبة، مغامرات وشجاعة، عادات وحياة، الطبيعة والحيوان.
أعد فقط JSON صالحاً بهذا الشكل دون أي نص إضافي:
${jsonShape(language)}`;
  }

  const cat = BOOK_CATEGORIES.find((c) => c.value === bookMeta?.category);
  const catLine = cat
    ? `موضوع الكتاب: ${cat.label}. توجيه تعليمي: ${cat.prompt}`
    : "موضوع الكتاب حسب وصف المستخدم";
  const levelLine = {
    beginner:
      "مستوى القراءة: مبتدئ — استخدم كلمات قصيرة جداً وجملة واحدة قصيرة لكل فكرة.",
    intermediate:
      "مستوى القراءة: متوسط — جملتان واضحتان لكل صفحة بمفردات مألوفة.",
    advanced:
      "مستوى القراءة: متقدم — يمكن استخدام 2-3 جمل بمفردات أغنى وأفكار أعمق.",
  }[bookMeta?.reading_level ?? "intermediate"];

  // توجيهات مشهد غنيّ لكل فئة كتاب — تجعل الصفحة الواحدة تحوي عناصر متعددة
  const richSceneByCategory: Record<string, string> = {
    animals:
      "Each scene is a dense educational POSTER showing AT LEAST 8 COMPLETELY DIFFERENT animal SPECIES on the same page — every animal must be a unique species, NO duplicates and NO multiple of the same animal (e.g. lion + elephant + giraffe + monkey + zebra + penguin + dolphin + owl). Arrange them in a clear grid or jungle scene, each animal clearly separated and labeled with its name written next to it. The hero child stands among them pointing or interacting.",
    fruits:
      "Each scene is a colorful poster showing AT LEAST 8 COMPLETELY DIFFERENT fruit TYPES on the same page — every fruit must be a unique kind, NO repeats (e.g. apple + banana + grape + orange + strawberry + watermelon + pineapple + kiwi + mango). Each fruit clearly separated and labeled. The hero child appears as a friendly guide.",
    colors:
      "Each scene shows AT LEAST 8 DIFFERENT colors on the same page, each color swatch paired with a unique everyday object of that color (red apple, blue sky, yellow sun, green leaf, orange carrot, purple grape, pink flower, brown bear...). All clearly labeled. The hero child appears as a friendly guide.",
    arabic_letters:
      "Alternate page TYPES across the book: (A) huge single-letter showcase page with the Arabic letter rendered enormously plus 4-6 DIFFERENT example objects whose names start with it; (B) practical scene where 6+ DIFFERENT objects whose names start with the letter fill the page (e.g. letter ب → باب، بطة، بيت، بطيخ، بقرة...) — every object unique; (C) tracing/coloring page rendered as pure black outline on plain white background, no fills, dotted guide lines. Vary types across pages.",
    english_letters:
      "Alternate page TYPES across the book: (A) huge single-letter showcase with 4-6 DIFFERENT example objects starting with that letter; (B) practical scene filled with 6+ DIFFERENT objects starting with that letter, every object unique; (C) tracing/coloring page (black outline on white, dotted guides). Vary types across pages.",
    mathematics:
      "For counting pages, the scene must literally contain the depicted quantity (page about number 1 → exactly 1 cute object; number 2 → exactly 2 of the same kind of object; number 5 → exactly 5; etc. — count must match exactly). Mix: counting pages, shape-recognition grids with 6+ DIFFERENT shapes labeled, simple addition visual stories, and one coloring/practice page (black outline on white).",
    science:
      "Each scene is a rich educational poster (water cycle, plant parts, solar system, body parts...) with 6+ DIFFERENT labeled elements arranged clearly. The hero child appears as an explorer/scientist.",
    programming:
      "Each scene is a friendly step-by-step visual (numbered cards or flow) showing a concept (sequence, loop, condition) with everyday objects. The hero child appears as the little coder.",
  };
  const richScene =
    richSceneByCategory[bookMeta?.category ?? ""] ??
    "Each scene must be visually rich and educational, packed with multiple clearly-labeled elements.";

  return `أنت مؤلف كتب أطفال تعليمية محترف، تحوّل أي موضوع إلى رحلة ممتعة وتدرّجية ذات قيمة تعليمية حقيقية.
اكتب كتاباً تعليمياً للأطفال من ${pageCount} صفحات بالضبط حول الموضوع المطلوب.
قواعد صارمة:
- ${catLine}
- ${levelLine}
- ${langRule(language)}
- استخدم {child} ككلمة بديلة لاسم الطفل المتعلم في كل النصوص، واجعله مشاركاً في التعلم.
- بنية الكتاب الإجبارية:
  • الصفحة 1: غلاف داخلي ترحيبي قصير يعرّف بالموضوع.
  • الصفحات الوسطى: دروس تعليمية متدرجة (فكرة واحدة لكل صفحة) مع مثال ملموس متعدد العناصر.
  • صفحة قبل الأخيرة: مراجعة سريعة أو نشاط ممتع للطفل ("هل تستطيع أن…؟").
  • الصفحة الأخيرة: خلاصة وتشجيع لما تعلّمه الطفل.
- توجيه إجباري لوصف المشهد (scene): ${richScene}
${pageRules}
- learning_goals: 3-4 أهداف تعلّم محددة وقابلة للقياس.
- moral: المهارة أو المعرفة الرئيسية المكتسبة.
- category بالعربية تصف الموضوع بإيجاز.
أعد فقط JSON صالحاً بهذا الشكل دون أي نص إضافي:
${jsonShape(language)}`;
}

async function callLlmOnce(systemPrompt: string, userPrompt: string, key: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
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
      signal: controller.signal,
    });
    if (res.status === 429)
      throw new Error("الخدمة مشغولة حالياً، انتظر قليلاً ثم أعد المحاولة");
    if (res.status === 402)
      throw new Error("نفد رصيد الذكاء الاصطناعي، تواصل مع إدارة الموقع");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("AI generate error", res.status, body.slice(0, 500));
      const e = new Error(
        `تعذر التوليد (${res.status})${body ? ` — ${body.slice(0, 120)}` : ""}`,
      ) as Error & { status?: number };
      e.status = res.status;
      throw e;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return extractJson(json.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(timer);
  }
}

async function callLlm(systemPrompt: string, userPrompt: string, key: string) {
  try {
    return await callLlmOnce(systemPrompt, userPrompt, key);
  } catch (e) {
    const err = e as Error & { status?: number; name?: string };
    const isRetryable =
      err.name === "AbortError" ||
      (typeof err.status === "number" && err.status >= 500) ||
      /fetch|network|ECONN/i.test(err.message ?? "");
    if (!isRetryable) throw err;
    console.warn("AI retry after:", err.message);
    try {
      return await callLlmOnce(systemPrompt, userPrompt, key);
    } catch (e2) {
      const e2err = e2 as Error & { name?: string };
      if (e2err.name === "AbortError") {
        throw new Error("استغرق التوليد وقتاً طويلاً، حاول مرة أخرى");
      }
      throw e2;
    }
  }
}

export const generateAiStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");

    const pageCount =
      data.contentType === "book" && data.bookMeta
        ? pagesForLength(data.bookMeta.length)
        : (data.pagesCount ?? 10);

    const typeLabel = data.contentType === "book" ? "كتاب تعليمي" : "قصة";
    const themeLine =
      data.contentType === "book" && data.bookMeta
        ? `موضوع الكتاب: ${BOOK_CATEGORIES.find((c) => c.value === data.bookMeta!.category)?.label}${data.theme ? ` — تخصيص: ${data.theme}` : ""}`
        : `اكتب ${typeLabel} عن: ${data.theme ?? ""}`;

    const isGirl = data.gender === "girl";
    const arabicGenderRule = isGirl
      ? "البطل أنثى (بنت): استخدم صيغة المؤنث في كل النصوص العربية (هي، شجاعة، بطلة، ذكية، قالت، ذهبت…) — لا تستخدم صيغة المذكر مطلقاً."
      : "البطل ذكر (ولد): استخدم صيغة المذكر في كل النصوص العربية (هو، شجاع، بطل، ذكي، قال، ذهب…) — لا تستخدم صيغة المؤنث مطلقاً.";
    const englishGenderRule = isGirl
      ? "The hero is a GIRL. Use she/her pronouns everywhere in English. Describe her as a girl child."
      : "The hero is a BOY. Use he/him pronouns everywhere in English. Describe him as a boy child.";

    const userPrompt = `${themeLine}
اسم الطفل سيكون: ${data.childName} (استخدم {child} في النص)
عمر الطفل: ${data.age ?? "4-8"} سنوات
جنس البطل: ${isGirl ? "بنت / Girl" : "ولد / Boy"}
${arabicGenderRule}
${englishGenderRule}
في حقل character اذكر أن البطل ${isGirl ? "girl" : "boy"} child.
لغة المحتوى: ${data.language === "ar" ? "العربية فقط" : data.language === "en" ? "English only" : "Bilingual Arabic + English"}`;

    const story = await callLlm(
      buildSystemPrompt(data.contentType, data.language, pageCount, data.bookMeta),
      userPrompt,
      key,
    );

    const rawPages = parsePages(story.pages);
    if (rawPages.length < 4)
      throw new Error("المحتوى المولد غير مكتمل، حاول مرة أخرى");

    const character = (story.character ?? "").trim();
    const ageStyle = ageStylePrompt(data.age);
    const pages: StoryPage[] = rawPages.map((p) => ({
      ...p,
      scene: `${ageStyle}. ${character ? `The hero child: ${character}. ` : ""}Scene: ${p.scene}`,
    }));

    const bookMetaRow = data.bookMeta
      ? { ...data.bookMeta, learning_goals: story.learning_goals ?? [] }
      : null;

    const slug = `custom-${crypto.randomUUID().slice(0, 8)}`;
    const { DEFAULT_COVER_URL } = await import("@/lib/defaultCover");
    const { data: inserted, error } = await context.supabase
      .from("story_templates")
      .insert({
        slug,
        title: story.title,
        summary: story.summary,
        moral: story.moral,
        category: story.category,
        age_range: data.age ?? "4-8",
        cover_url: DEFAULT_COVER_URL,
        pages: pages as unknown as never,
        is_published: false,
        is_custom: true,
        created_by: context.userId,
        content_type: data.contentType,
        language: data.language,
        book_meta: bookMetaRow as unknown as never,
      } as never)
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
      learningGoals: story.learning_goals ?? [],
      stylePrompt: STORY_STYLE_PROMPT,
    };
  });

const PageImageInput = z.object({
  templateId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(20),
  childPhotoPath: z.string().trim().max(300).optional(),
  photoMode: z.enum(["cartoon", "real"]).optional(),
});

async function ensureOwnerOrAdmin(
  context: { supabase: any; userId: string },
  templateId: string,
): Promise<{ pages: StoryPage[]; created_by: string; age_range: string | null }> {
  const { data: template, error } = await context.supabase
    .from("story_templates")
    .select("id, pages, created_by, age_range")
    .eq("id", templateId)
    .single();
  if (error || !template) throw new Error("المحتوى غير موجود");
  if (template.created_by !== context.userId) {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("غير مصرح لك");
  }
  return {
    pages: parsePages(template.pages),
    created_by: template.created_by,
    age_range: template.age_range,
  };
}

async function ensureNotApproved(templateId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("story_templates")
    .select("approved_at")
    .eq("id", templateId)
    .single();
  if ((row as { approved_at?: string | null } | null)?.approved_at) {
    throw new Error("المحتوى معتمد بالفعل — لا يمكن التعديل عليه");
  }
}

export const generatePageImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PageImageInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");

    const tpl = await ensureOwnerOrAdmin(context, data.templateId);
    const page = tpl.pages.find((p) => p.n === data.pageNumber);
    if (!page) throw new Error("الصفحة غير موجودة");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let photoDataUrl: string | null = null;
    if (data.childPhotoPath) {
      if (!data.childPhotoPath.startsWith(`${context.userId}/`)) {
        throw new Error("غير مصرح لك باستخدام هذه الصورة");
      }
      const { data: file } = await supabaseAdmin.storage
        .from("child-photos")
        .download(data.childPhotoPath);
      if (file) {
        const buf = Buffer.from(await file.arrayBuffer());
        photoDataUrl = `data:${file.type || "image/jpeg"};base64,${buf.toString("base64")}`;
      }
    }

    const agePart = page.scene.includes("Age styling")
      ? ""
      : `\n${ageStylePrompt(tpl.age_range)}.`;
    const photoPart = photoDataUrl
      ? `\n${photoModePrompt(data.photoMode ?? "real")}.`
      : "";
    const titlePart = page.image_title_en ? `\n${bakedTitlePrompt(page.image_title_en)}` : "";
    const prompt = `${STORY_STYLE_PROMPT}
${LANDSCAPE_COMPOSITION_RULE}
${WIDE_FRAMING_RULE}
${CONSISTENCY_RULE}${agePart}${photoPart}${titlePart}
Children's storybook page illustration that literally depicts this exact written scene so the image feels like part of the text: ${page.scene}.
${QUALITY_RULE}
${STYLE_NEGATIVE}.`;

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
      },
    );

    if (res.status === 429)
      throw new Error("الخدمة مشغولة، انتظر قليلاً ثم أعد المحاولة");
    if (res.status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي");
    if (!res.ok) {
      console.error("page image error", res.status, await res.text());
      throw new Error("تعذر توليد صورة الصفحة");
    }

    const json = (await res.json()) as {
      choices?: {
        message?: { images?: { image_url?: { url?: string } }[] };
      }[];
    };
    const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.includes("base64,"))
      throw new Error("لم يُرجع النموذج صورة، أعد المحاولة");

    const bytes = Buffer.from(dataUrl.split("base64,")[1], "base64");
    const imagePath = `templates/${data.templateId}/page-${data.pageNumber}.png`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("story-pages")
      .upload(imagePath, bytes, { contentType: "image/png", upsert: true });
    if (upErr) {
      console.error("upload page image", upErr);
      throw new Error("تعذر حفظ الصورة");
    }

    const updatedPages = tpl.pages.map((p) =>
      p.n === data.pageNumber ? { ...p, image_path: imagePath } : p,
    );
    await supabaseAdmin
      .from("story_templates")
      .update({ pages: updatedPages as unknown as never })
      .eq("id", data.templateId);

    const { data: signed } = await supabaseAdmin.storage
      .from("story-pages")
      .createSignedUrl(imagePath, 60 * 60 * 24);

    return {
      pageNumber: data.pageNumber,
      imageUrl: signed?.signedUrl ?? null,
    };
  });

const UpdatePageTextInput = z.object({
  templateId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(20),
  title: z.string().trim().max(80).optional(),
  text: z.string().trim().min(1).max(1000).optional(),
  title_ar: z.string().trim().max(80).optional(),
  title_en: z.string().trim().max(80).optional(),
  text_ar: z.string().trim().max(1000).optional(),
  text_en: z.string().trim().max(1000).optional(),
});

export const updatePageText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdatePageTextInput.parse(input))
  .handler(async ({ data, context }) => {
    await ensureNotApproved(data.templateId);
    const tpl = await ensureOwnerOrAdmin(context, data.templateId);
    if (!tpl.pages.some((p) => p.n === data.pageNumber))
      throw new Error("الصفحة غير موجودة");

    const updatedPages = tpl.pages.map((p) =>
      p.n === data.pageNumber
        ? {
            ...p,
            title: data.title ?? p.title,
            text: data.text ?? p.text,
            title_ar: data.title_ar ?? p.title_ar,
            title_en: data.title_en ?? p.title_en,
            text_ar: data.text_ar ?? p.text_ar,
            text_en: data.text_en ?? p.text_en,
          }
        : p,
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("story_templates")
      .update({ pages: updatedPages as unknown as never })
      .eq("id", data.templateId);
    if (error) throw new Error("تعذر حفظ التعديل");

    return { ok: true, pageNumber: data.pageNumber };
  });

const ReorderInput = z.object({
  templateId: z.string().uuid(),
  order: z.array(z.number().int().min(1).max(20)).min(2).max(20),
});

/** إعادة ترتيب صفحات المحتوى — يحدّث n لكل صفحة وفق الترتيب الجديد */
export const reorderPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReorderInput.parse(input))
  .handler(async ({ data, context }) => {
    await ensureNotApproved(data.templateId);
    const tpl = await ensureOwnerOrAdmin(context, data.templateId);
    if (data.order.length !== tpl.pages.length)
      throw new Error("ترتيب غير مكتمل");

    const map = new Map(tpl.pages.map((p) => [p.n, p]));
    const reordered: StoryPage[] = data.order.map((oldN, i) => {
      const p = map.get(oldN);
      if (!p) throw new Error("رقم صفحة غير صحيح");
      return { ...p, n: i + 1 };
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("story_templates")
      .update({ pages: reordered as unknown as never })
      .eq("id", data.templateId);
    if (error) throw new Error("تعذر حفظ الترتيب");
    return { ok: true };
  });

const ApproveInput = z.object({ templateId: z.string().uuid() });

/** اعتماد المحتوى نهائياً — شرط مسبق لتصدير PDF ومشاركته */
export const approveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApproveInput.parse(input))
  .handler(async ({ data, context }) => {
    await ensureOwnerOrAdmin(context, data.templateId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("story_templates")
      .update({ approved_at: new Date().toISOString() } as never)
      .eq("id", data.templateId);
    if (error) throw new Error("تعذر اعتماد المحتوى");
    return { ok: true, approvedAt: new Date().toISOString() };
  });

const TemplateIdInput = z.object({ templateId: z.string().uuid() });

/** قراءة حالة الاعتماد (المستخدم + المسؤول) لاستخدامها في الواجهات */
export const getTemplateApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TemplateIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await ensureOwnerOrAdmin(context, data.templateId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("story_templates")
      .select("approved_at, admin_approved_at")
      .eq("id", data.templateId)
      .single();
    const r = row as {
      approved_at?: string | null;
      admin_approved_at?: string | null;
    } | null;
    return {
      approvedAt: r?.approved_at ?? null,
      adminApprovedAt: r?.admin_approved_at ?? null,
    };
  });

/** [مسؤول] قائمة المحتوى المعتمد من المستخدم والمنتظر اعتماد المسؤول */
export const adminListPendingTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("غير مصرح لك");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("story_templates")
      .select("id, title, content_type, language, approved_at, admin_approved_at, created_by, created_at, age_range")
      .eq("is_custom", true)
      .not("approved_at", "is", null)
      .is("admin_approved_at", null)
      .order("approved_at", { ascending: false })
      .limit(60);
    if (error) throw new Error("تعذر تحميل المحتوى المنتظر");
    return data ?? [];
  });

/** [مسؤول] اعتماد نهائي للمحتوى — يفعّل تحميل PDF للمستخدم */
export const adminApproveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TemplateIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("غير مصرح لك");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("story_templates")
      .update({
        admin_approved_at: new Date().toISOString(),
        admin_approved_by: context.userId,
        is_published: true,
      } as never)
      .eq("id", data.templateId);
    if (error) throw new Error("تعذر اعتماد المحتوى");
    return { ok: true };
  });

/** [مسؤول] رفض / إعادة محتوى للمستخدم للتعديل (يلغي approved_at ويُلغي النشر) */
export const adminRejectTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TemplateIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("غير مصرح لك");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("story_templates")
      .update({ approved_at: null, admin_approved_at: null, is_published: false } as never)
      .eq("id", data.templateId);
    if (error) throw new Error("تعذر إعادة المحتوى");
    return { ok: true };
  });
