/**
 * النمط الفني المعتمد لكل صور القصص (الأغلفة، صفحات القصص، الصور المخصصة).
 * أسلوب بوستر سينمائي ثلاثي الأبعاد فاخر (مرجع: ملصقات أفلام الأطفال الكبيرة).
 */
export const STORY_STYLE_PROMPT =
  "Cinematic premium 3D movie-poster illustration style for kids, Pixar/DreamWorks-grade rendering: hero-centered composition, dramatic but warm cinematic lighting with soft rim light, rich detailed background with depth of field, vibrant saturated colors, glossy expressive eyes, soft rounded features, polished subsurface skin shading, fluffy detailed hair, ultra-high-quality 3D render, story-book hero portrait energy";

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
    return "A reference photo of the real hero child is attached. CRITICAL: KEEP THE CHILD'S REAL FACE UNCHANGED — do NOT cartoonify the face. Preserve the child's exact real facial features, identity, skin tone, eyes, and hairstyle pixel-faithful from the photo. First enhance the photo (sharpness, clean studio lighting, noise removal, color grading), then composite the REAL photographic face onto a cinematic 3D movie-poster scene: the body, costume, background, and all surroundings are rendered in the premium cinematic 3D illustration style, but the FACE stays photographically real and seamlessly lit to match the scene. Reference look: live-action kid hero posters where a real child's face is dropped into a fully illustrated 3D world (e.g. a child wearing a hero costume on a cinematic skyline, or a real child standing beside fully 3D animated cartoon characters)";
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
