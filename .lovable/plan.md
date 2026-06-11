# خطة: اختيار الجنس + Face Swap بصور مرجعية

## الهدف
1. إضافة حقل **الجنس (ولد/بنت)** في الطلب والـ wizard.
2. اعتماد الصورتين المرفوعتين كصورتين مرجعيتين رسميتين (ولد ↔ بنت).
3. توليد القصة بنظام Face Swap رخيص بدلاً من توليد كامل لكل صفحة → توفير ~95% من التكلفة.
4. ضبط ضمائر/أوصاف النص حسب الجنس (هو/هي، شجاع/شجاعة…).

## التغييرات

### 1) قاعدة البيانات (migration)
- `orders.gender` enum: `boy | girl` (NOT NULL، default `boy`).
- `story_templates.reference_scenes` jsonb: `{ boy: { "1": "path", ... }, girl: { ... } }` — مسارات صور مشاهد مرجعية في bucket جديد.
- bucket جديد `template-scenes` (public read) لحفظ المشاهد المرجعية بالشخصية النموذجية.

### 2) رفع الصور المرجعية الافتراضية
- رفع `image-2.png` (الولد) و `IMG_0042.jpg` (البنت) إلى bucket `reference-children`.
- استخدامهما كـ "الطفل النموذجي" داخل بروموت توليد المشاهد المرجعية الأولى لكل قصة.

### 3) Wizard `/create` و checkout
- إضافة خطوة اختيار الجنس (Step بعد الاسم، قبل العمر) مع أيقونتين.
- تمرير `gender` في `submitCheckout` و `draft.functions.ts`.

### 4) واجهة الأدمن `/admin`
- زر جديد «توليد المشاهد المرجعية للقصة» في صفحة القصة (يُولّد مرة واحدة فقط لكل قصة × جنس).
- زر «توليد صفحة الطلب» يصبح **Face Swap** على المشهد المرجعي بدل التوليد الكامل.

### 5) منطق التوليد `admin.functions.ts`
- دالة جديدة `adminGenerateTemplateScene(templateId, gender, pageNumber)`:
  - تولّد المشهد بنفس الـ pipeline الحالي + صورة الطفل النموذجي (الولد أو البنت) عبر Lovable AI.
  - تُخزّن المسار في `story_templates.reference_scenes`.
- تعديل `adminGeneratePage`:
  1. لو يوجد مشهد مرجعي للقصة وللجنس المختار → استخدم Replicate face-swap (`cdingram/face-swap` ~$0.0015):
     - input: `target_image` = المشهد المرجعي، `source_image` = صورة الطفل الحقيقية.
  2. fallback عند فشل swap → التوليد الكامل الحالي.
- إضافة `gender` لكل personalize/prompt: استبدال «هو/هي»، «بطل/بطلة»، «شجاع/شجاعة» في `personalize()`.

### 6) عرض القصة وPDF
- لا تغيير في الـ layout، فقط النص يستخدم ضمائر صحيحة عبر `personalize` المُحدّثة.

## الملفات المتأثرة
- migration جديد + bucket
- `src/features/orders/checkout.functions.ts`, `draft.functions.ts`
- `src/routes/create.tsx`, `_authenticated.checkout.tsx`
- `src/routes/_authenticated.admin.tsx`
- `src/features/admin/admin.functions.ts`
- `src/features/ai/storyTypes.ts` (personalize حسب الجنس)
- `src/features/ai/storyStyle.ts` (prompt يحترم الجنس)

## التكلفة المتوقعة بعد التطبيق
- مشهد مرجعي: يُولّد **مرة واحدة فقط** لكل (قصة × جنس) ≈ $0.04 × صفحات (تكلفة لمرة).
- لكل طلب جديد: ~$0.0015 × عدد الصفحات بدلاً من $0.04 × عدد الصفحات → **توفير ~96%**.

هل أبدأ بالتنفيذ؟
