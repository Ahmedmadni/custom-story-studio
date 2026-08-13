/**
 * النمط الفني المعتمد لكل صور القصص (الأغلفة، صفحات القصص، الصور المخصصة).
 * أسلوب بوستر سينمائي ثلاثي الأبعاد فاخر (مرجع: ملصقات أفلام الأطفال الكبيرة).
 */
export const STORY_STYLE_PROMPT =
  "TOP-TIER cinematic 3D animated movie style — the EXACT visual quality and feel of major theatrical animated features like Disney/Pixar 'Monsters University' and 'Monsters Inc', DreamWorks 'The Good Dinosaur', Pixar 'Up' and 'Toy Story 4', Warner Bros 'Tom & Jerry' 2021 3D movie, Illumination 'Despicable Me': big-budget feature-film 3D animation rendering, NOT toy/figurine/stock-3D look. Mandatory: dramatic theatrical lighting with strong key light + warm rim light + soft bounce light, deep rich painterly background with real depth of field and atmospheric haze, vibrant saturated film-grade color grading, ultra-glossy expressive huge cartoon eyes with catchlights, soft rounded exaggerated cartoon features, polished subsurface-scattering skin, fluffy strand-level hair, detailed fabric micro-texture on clothes, subtle film grain, story-book theatrical poster energy. Reject: stiff plastic doll look, flat lighting, generic stock 3D, AI-generic kid avatar look, low-detail toy renders.";

/** نسبة أبعاد إلزامية أفقية لكل الصور — مطابقة لتصميم PDF المستطيل */
export const LANDSCAPE_COMPOSITION_RULE =
  "MANDATORY OUTPUT FORMAT: a single wide cinematic LANDSCAPE image, 16:9 aspect ratio (1920×1080), like a Disney/Pixar movie still or a wide storybook spread. Do NOT output a square or portrait image. Compose horizontally with rich left-to-right scene depth.";

/**
 * نسبة أبعاد إلزامية حسب اختيار العميل عند طلب القصة (مربع/أفقي/عمودي) —
 * تُستخدم في توليد صفحات الطلب الفعلية بحيث تطابق الصورة أبعاد PDF النهائي.
 */
export function aspectRatioCompositionRule(ratio: "1:1" | "16:9" | "9:16"): string {
  if (ratio === "1:1") {
    return "MANDATORY OUTPUT FORMAT: a single SQUARE image, 1:1 aspect ratio (1080×1080), like a classic storybook page. Do NOT output a landscape or portrait image. Compose with balanced centered depth.";
  }
  if (ratio === "9:16") {
    return "MANDATORY OUTPUT FORMAT: a single tall cinematic PORTRAIT image, 9:16 aspect ratio (1080×1920), like a mobile story/reel frame. Do NOT output a landscape or square image. Compose vertically with rich top-to-bottom scene depth.";
  }
  return LANDSCAPE_COMPOSITION_RULE;
}

/** إطار واسع — الطفل لا يستحوذ على المشهد، يظهر بحجم متوسط مع خلفية وشخصيات وأجواء واضحة */
export const WIDE_FRAMING_RULE =
  "CAMERA & FRAMING (very important): use a WIDE / MEDIUM-WIDE shot, NOT a close-up. The hero child must occupy at most 25-30% of the frame height and never fill the page. Show the child from full body or knees-up, with plenty of empty space, background environment, props, and supporting characters clearly visible around them. The scene, setting, and other characters must read as the main subject just as much as the child. Absolutely no close-up portraits, no head-and-shoulders crops, no face filling the frame.";

/** ثبات هوية الطفل وملابسه عبر كل الصفحات */
export const CONSISTENCY_RULE =
  "CHARACTER CONSISTENCY (strict): the hero child MUST look 100% identical across every page of the book — exact same face shape, same eye color and shape, same skin tone, same hairstyle and hair color, same age, same height, and EXACTLY the same outfit (same clothes, same colors, same shoes, same accessories) in every single illustration. Treat the character description as a locked model sheet. Do not redesign, age up, change hairstyle, or change clothing between pages.";

/** تحسين عام للجودة */
export const QUALITY_RULE =
  "Masterpiece quality, sharp focus, crisp details, perfect anatomy, no compression artifacts, no blur, no extra limbs, no warped faces.";

export const STYLE_NEGATIVE =
  "no watermark, no logos, no signatures, no random gibberish text";

/** عمر الطفل → أسلوب بصري متناسب (قاعدة إلزامية). */
export function ageStylePrompt(age?: string | number | null): string {
  const n =
    typeof age === "number"
      ? age
      : parseInt(String(age ?? "").match(/\d+/)?.[0] ?? "", 10);

  if (Number.isNaN(n) || n <= 0) {
    return "Age styling (child 4-8 years): a cheerful young child hero with playful rounded kid proportions, simple comfy colorful outfit, bright imaginative scene";
  }
  if (n <= 3) {
    return "Age styling (toddler 1-3 years): a very small extra-cute toddler hero with chibi proportions — big round head, tiny soft body — ultra-simple gentle shapes, minimal uncluttered background, soft warm pastel colors, cozy onesie/romper, calm soothing atmosphere";
  }
  if (n <= 6) {
    return "Age styling (young child 4-6 years): a small adorable preschool hero with rounded playful proportions, simple cheerful outfit, friendly bright scene with clear simple shapes, joyful playful atmosphere";
  }
  if (n <= 9) {
    return "Age styling (school-age child 7-9 years): a slightly taller school-age hero with more defined child proportions, stylish casual kids outfit (t-shirt, jeans, sneakers), richer adventurous scenery, energetic confident atmosphere";
  }
  return "Age styling (pre-teen 10+ years): a taller, visibly more mature hero with realistic child proportions and expressive detailed features, trendy age-appropriate outfit, detailed cinematic environment, adventurous inspiring atmosphere while staying wholesome";
}

/**
 * طريقة استخدام صورة الطفل المرفوعة:
 * - cartoon: تحويل الطفل إلى شخصية كرتونية 3D متّسقة مع أسلوب القصة.
 * - real: الإبقاء التام على وجه الطفل الحقيقي ودمجه داخل مشهد سينمائي 3D
 *   (كما في صور Superman / Tom & Jerry / Disney المرجعية المعتمدة من المالك).
 */
export type PhotoMode = "cartoon" | "real";

export function photoModePrompt(mode: PhotoMode): string {
  if (mode === "real") {
    return "ABSOLUTE TOP PRIORITY — REAL FACE PRESERVATION (live-action photo head on a fully 3D cartoon world). A reference photo of the real hero child is attached. You MUST keep the child's real photographic face 100% IDENTICAL to the reference photo on EVERY SINGLE PAGE of the book without ANY exception — same face shape, same skin tone, same eyes (color, shape, position), same nose, same mouth, same hair (color, style, length), same eyebrows, same age, same freckles/marks, same ears, same jawline. The face must look like an actual photograph, NOT illustrated, NOT cartoonized, NOT smoothed, NOT redrawn, NOT aged up/down, NOT re-lit beyond color-matching, NOT stylized. Treat the face as if it was photo-composited (cut and pasted) from the reference image onto the scene, then ONLY color-matched to the scene's lighting. Do NOT illustrate the face. Do NOT make it look painted. Do NOT alter facial proportions between pages. The face must read as the SAME real human across all pages — same exact identity from page 1 to last page. The BODY, OUTFIT (hero costume / themed clothes), POSE, BACKGROUND, PROPS, OTHER CHARACTERS, SKY, GROUND, ANIMALS, OBJECTS, and ALL SURROUNDINGS are fully rendered as premium cinematic 3D cartoon movie illustration. Direct references to copy this exact contrast: Superman (2025) live-action movie posters where a real human face stands inside a stylized comic world, Sonic the Hedgehog (2020) movie posters, Tom & Jerry (2021) movie posters, Detective Pikachu posters, Peter Rabbit posters. The contrast between the REAL photographic face and the fully 3D illustrated cartoon world around it is the entire point and must be preserved on every page.";
  }
  return "A reference photo of the real hero child is attached. Transform this exact child into an adorable 3D cartoon hero fully consistent with the story art style: keep the child clearly recognizable (same face shape, hairstyle, hair color, skin tone, eye color) but render entirely as a premium cinematic 3D cartoon character matching all other illustrations. The cartoon face must look IDENTICAL across every page of the book.";
}

/** نص إهداء يُحقن في system prompt عند توفر اسم مُهدي القصة */
export function gifterDedicationPrompt(
  gifterName?: string | null,
  gifterRelation?: string | null,
): string {
  const name = (gifterName ?? "").trim();
  if (!name) return "";
  const relation = (gifterRelation ?? "").trim();
  const who = relation ? `${relation} ${name}` : name;
  return `إهداء خاص: هذه القصة مُهداة من ${who} إلى الطفل البطل. اجعل الصفحة الأولى من القصة تبدأ بسطر إهداء قصير يقول مثلاً: "إهداء حبيب من ${who} 💝". واذكر ${who} مرة واحدة بطريقة طبيعية ودافئة داخل أحد مشاهد القصة (مثلاً يحضنه/يحكي له/يهديه شيئاً)، دون مبالغة.`;
}

/**
 * توجيه لكتابة عنوان الصفحة داخل الصورة المولّدة (مثل ملصقات الأفلام).
 * نلتزم بالإنجليزية فقط لأن النماذج تكتب الإنجليزية بدقة عالية والعربية مشوّهة.
 * النصوص العربية تُضاف لاحقاً كـoverlay فوق الصورة.
 */
export function bakedTitlePrompt(title?: string | null): string {
  const clean = (title ?? "").trim().replace(/[^a-zA-Z0-9 &!?'-]/g, "").slice(0, 28);
  if (!clean) return "";
  return `Bake this exact short English title text into the top of the image as a polished movie-poster style logotype (clear, perfectly readable, no spelling errors, no extra letters): "${clean}". The title text must be inside the image, integrated into the artwork like a children's movie poster.`;
}

