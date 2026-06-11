/**
 * النمط الفني المعتمد لكل صور القصص (الأغلفة، صفحات القصص، الصور المخصصة).
 * Children's Cartoon Style 3D — Pixar-like, per user-approved reference.
 * أي توليد صور بالذكاء الاصطناعي يجب أن يستخدم هذا الثابت.
 */
export const STORY_STYLE_PROMPT =
  "Children's Cartoon Style 3D: premium Pixar-style 3D rendered illustration, adorable child character with big expressive glossy eyes, soft rounded facial features, smooth subsurface skin shading, fluffy detailed hair, vibrant saturated cheerful colors, soft warm cinematic lighting, gentle depth of field background, wholesome joyful mood, ultra high quality 3D render";

export const STYLE_NEGATIVE = "no text, no letters, no watermark, no logos";

/**
 * نمط الصورة حسب عمر الطفل — قاعدة إلزامية لكل الصور المولدة:
 * طفل صغير جداً = شخصية أصغر وألطف وأبسط، طفل أكبر = شخصية أكبر وأكثر نضجاً،
 * مع اختلاف الملابس والأجواء والتفاصيل حسب العمر المستهدف.
 * يقبل عمراً رقمياً أو نطاقاً نصياً مثل "4-8" (يُؤخذ أول رقم).
 */
export function ageStylePrompt(age?: string | number | null): string {
  const n =
    typeof age === "number"
      ? age
      : parseInt(String(age ?? "").match(/\d+/)?.[0] ?? "", 10);

  if (Number.isNaN(n) || n <= 0) {
    return "Age styling (child 4-8 years): a cheerful young child character with playful rounded kid proportions, simple colorful comfy outfit, bright imaginative friendly scenery";
  }
  if (n <= 3) {
    return "Age styling (toddler 1-3 years): a very small, extra-cute toddler character with chibi proportions — big round head, tiny soft body — ultra-simple gentle shapes, minimal uncluttered background, soft warm pastel-leaning colors, cozy simple outfit (soft romper or onesie), calm soothing storybook atmosphere";
  }
  if (n <= 6) {
    return "Age styling (young child 4-6 years): a small adorable preschool child with playful rounded proportions, simple cheerful outfit with fun colors, friendly bright scenery with clear simple shapes and toys, joyful playful atmosphere";
  }
  if (n <= 9) {
    return "Age styling (school-age child 7-9 years): a slightly taller school-age kid with more defined child proportions, casual stylish kids outfit (t-shirt, jeans, sneakers), richer more detailed adventurous scenery, energetic confident atmosphere";
  }
  return "Age styling (pre-teen 10+ years): a taller, visibly more mature kid with realistic child proportions and expressive detailed features, trendy age-appropriate outfit, detailed sophisticated cinematic environments, adventurous inspiring atmosphere while staying wholesome and kid-friendly";
}

/**
 * طريقة استخدام صورة الطفل المرفوعة داخل الصور المولدة:
 * - cartoon: تحويل الطفل إلى شخصية كرتونية ثلاثية الأبعاد متناسقة مع أسلوب القصة مع الحفاظ على ملامحه.
 * - real: الإبقاء على ملامح الطفل الحقيقية مع تحسين الجودة والوضوح ودمجها بصرياً داخل المشهد المرسوم.
 * تنطبق على صور القصص والكتب التعليمية معاً.
 */
export type PhotoMode = "cartoon" | "real";

export function photoModePrompt(mode: PhotoMode): string {
  if (mode === "real") {
    return "A reference photo of the real hero child is attached. KEEP THE CHILD'S REAL FACE: preserve the child's true facial features, identity, skin tone, eyes and hairstyle exactly as in the photo. First enhance the photo quality (sharpness, clarity, clean lighting, noise removal), then seamlessly composite the realistic child into the illustrated scene — match the scene's lighting direction, color palette, scale and perspective so the real child looks naturally and beautifully integrated into the storybook artwork";
  }
  return "A reference photo of the real hero child is attached. Transform this exact child into an adorable 3D cartoon character fully consistent with the story art style: keep the child clearly recognizable (same face shape, hairstyle, hair color, skin tone and eye color) but render them entirely as a Children's Cartoon Style 3D character matching all other illustrations in the book";
}
