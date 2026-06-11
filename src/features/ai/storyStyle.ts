/**
 * النمط الفني المعتمد لكل صور القصص (الأغلفة، صفحات القصص، الصور المخصصة).
 * أسلوب بوستر سينمائي ثلاثي الأبعاد فاخر (مرجع: ملصقات أفلام الأطفال الكبيرة).
 */
export const STORY_STYLE_PROMPT =
  "TOP-TIER cinematic 3D animated movie style — the EXACT visual quality and feel of major theatrical animated features like Disney/Pixar 'Monsters University' and 'Monsters Inc', DreamWorks 'The Good Dinosaur', Pixar 'Up' and 'Toy Story 4', Warner Bros 'Tom & Jerry' 2021 3D movie, Illumination 'Despicable Me': big-budget feature-film 3D animation rendering, NOT toy/figurine/stock-3D look. Mandatory: hero-centered cinematic movie-poster composition, dramatic theatrical lighting with strong key light + warm rim light + soft bounce light, deep rich painterly background with real depth of field and atmospheric haze, vibrant saturated film-grade color grading, ultra-glossy expressive huge cartoon eyes with catchlights, soft rounded exaggerated cartoon features, polished subsurface-scattering skin, fluffy strand-level hair, detailed fabric micro-texture on clothes, subtle film grain, story-book theatrical poster energy. Reject: stiff plastic doll look, flat lighting, generic stock 3D, AI-generic kid avatar look, low-detail toy renders.";

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
    return "ABSOLUTE TOP PRIORITY — REAL FACE PRESERVATION: A reference photo of the real hero child is attached. You MUST keep the child's real photographic face 100% IDENTICAL to the reference photo — same face shape, same skin tone, same eyes (color, shape, position), same nose, same mouth, same hair (color, style, length), same eyebrows, same age. Do NOT stylize, cartoonize, age-up, age-down, smooth, redraw, or re-interpret the face in any way. Treat the face as if it was photo-composited (cut and pasted) from the reference image onto the scene, then only matched the lighting. The BODY, OUTFIT (hero costume / themed clothes), POSE, BACKGROUND, PROPS, OTHER CHARACTERS, and ALL SURROUNDINGS are fully rendered in the premium cinematic 3D movie-poster illustration style. Reference look exactly like: a live-action child actor's real face inside a Superman/superhero movie poster, a real child's face standing next to Tom & Jerry or Disney 3D characters, or a real child's face inside a Pixar-style cinematic world. The contrast between the REAL photographic face and the fully 3D illustrated world around it is intentional and desired.";
  }
  return "A reference photo of the real hero child is attached. Transform this exact child into an adorable 3D cartoon hero fully consistent with the story art style: keep the child clearly recognizable (same face shape, hairstyle, hair color, skin tone, eye color) but render entirely as a premium cinematic 3D cartoon character matching all other illustrations";
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
