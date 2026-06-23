## الهدف

1. تحسين كفاءة موجهات توليد الصور (prompts).
2. تحويل تصميم القصص من مربع إلى **مستطيل أفقي (Landscape 16:9)**.
3. إضافة شعار الموقع ورابط **kidzy.life** على الصفحة الأولى والأخيرة من كل قصة/كتاب.
4. إضافة **صفحة أخيرة ثابتة** تحتوي بيانات الموقع والشعار والرابط على كل ملف PDF.

---

## التغييرات بالتفصيل

### 1) موجهات الذكاء الاصطناعي للصور — تحسين الكفاءة

ملف: `src/features/ai/ai.functions.ts` (دالة `generatePageImage`)

- تغيير الـ prompt الحالي من `Square composition` إلى `**Wide cinematic landscape 16:9 composition**` ليطابق التصميم الجديد.
- إضافة سطر إخراج صريح للنموذج لإجبار نسبة أبعاد عريضة:
  - `"Output a single high-resolution wide landscape image (1920×1080, 16:9 aspect ratio). Do not output square."`
- تقليم الـ prompt المركّب: دمج `STORY_STYLE_PROMPT` + `ageStylePrompt` + `photoModePrompt` + `bakedTitlePrompt` بترتيب أوضح وبدون تكرار، مع فاصل واضح بين القواعد البصرية والمشهد.
- إضافة قاعدة جودة عالية: `"masterpiece, sharp focus, no compression artifacts, no blur, perfect anatomy"` في نهاية الموجه.
- اريد ان يكون تباعد الشخصية كبير بحيث لا تظهر شخصية الطفل عن قرب وتستحوذ على جزء كبير من الصفحة مما يعطي مساحة لظور الشخصييات او الخلفية الموجود فيها الطفل.
- محاولة التاكد من صورة الطلفل وعدم تغيير في ملامحة الاصلية في كل الصفحات وهكذا الزي الذي يرتديه 

ملف: `src/features/ai/storyStyle.ts`

- إضافة ثابت جديد `LANDSCAPE_COMPOSITION_RULE` يستخدمه `generatePageImage` و`PdfActions` معاً.
- تعديل `bakedTitlePrompt` ليطلب وضع العنوان بأعلى يسار البوستر بدل الأعلى (يتناسب مع الإطار العريض).

### 2) تحويل PDF إلى مستطيل أفقي (Landscape)

ملف: `src/features/pdf/storyPdf.ts`

- تغيير ثوابت الصفحة:
  - `PAGE_W = 1920`, `PAGE_H = 1080` (16:9) بدل `PAGE = 1024` مربع.
  - `PAGE_MM_W = 297`, `PAGE_MM_H = 167` (A4 landscape تقريبية بنسبة 16:9).
- تغيير `pdf = new jsPDF({ orientation: "landscape", format: [PAGE_MM_W, PAGE_MM_H] })`.
- تحديث `pageShell` لاستخدام العرض/الارتفاع الجديدين.
- إعادة ضبط مواضع نص العنوان والشريط السفلي ودائرة رقم الصفحة لتتوزع جيداً في الإطار العريض (مثلاً النص في النصف السفلي بعرض كامل مع padding 80px).

### 3) شعار الموقع + رابط kidzy.life على الغلاف والصفحة الأخيرة

ملف: `src/features/pdf/storyPdf.ts`

- تحميل شعار الموقع (`src/assets/kidzy-logo.png.asset.json`) كـ `dataURL` مرة واحدة في بداية `generateStoryPdf` عبر `toDataUrl(kidzyLogo.url)`.
- في `buildCover`:
  - شعار صغير أعلى يمين الغلاف (96px) + رابط `kidzy.life` تحته بخط ذهبي صغير.
- في كل صفحة محتوى عبر `buildContentPage`:
  - شعار صغير شفاف (40px) أسفل الصفحة بجوار رقم الصفحة + نص `kidzy.life` بحجم 14px.

### 4) صفحة أخيرة ثابتة (Back Cover) — جديدة

ملف: `src/features/pdf/storyPdf.ts` — إضافة دالة `buildBackCover(input, logoData)`:

- خلفية متدرّجة بألوان الهوية (بنفسجي → ذهبي).
- شعار كبير في المنتصف (300px).
- نص شكر بالعربية: *"شكراً لاختياركم منصة كيدزي — قصص تزرع القيم في قلوب الأطفال"*.
- رابط بارز: **kidzy.life**
- زر/شارة واتساب: `01120016502`.
- شارات معلومات: «قصص مخصصة • كتب تعليمية • محتوى آمن للأطفال».
- سنة + حقوق: `© ${year} Kidzy — جميع الحقوق محفوظة`.
- (اختياري لاحقاً) QR Code للرابط.

ثم في `generateStoryPdf`، بعد آخر صفحة محتوى:

```ts
await snap(buildBackCover(input, logoData), false);
```

### 5) لمسات سريعة

- تحديث `total` في عدّاد التقدّم ليشمل صفحة الغلاف + المحتوى + الغلاف الخلفي.
- التأكد أن `saveStoryPdf` (server side، لو موجود pdf مستضاف) يستخدم نفس الأبعاد الجديدة.

---

## الملفات المتأثرة

- `src/features/ai/ai.functions.ts` — تعديل prompt + نسبة الأبعاد.
- `src/features/ai/storyStyle.ts` — إضافة `LANDSCAPE_COMPOSITION_RULE` + ضبط `bakedTitlePrompt`.
- `src/features/pdf/storyPdf.ts` — تحويل لمستطيل + إضافة الشعار والرابط + صفحة Back Cover.

## نقاط تحقق بعد التنفيذ

1. توليد قصة تجريبية والتأكد أن كل الصور تخرج 16:9 وليست مربعة.
2. تحميل PDF والتأكد أن الورق landscape بدون هوامش بيضاء.
3. ظهور شعار kidzy + رابط kidzy.life على الغلاف الأمامي وكل الصفحات والغلاف الخلفي.
4. صفحة Back Cover الثابتة تظهر في نهاية كل ملف.