## الهدف

1. نقل اختيار **اللغة** و**نمط صورة الطفل** إلى صفحة إتمام الطلب (لكل قصة في السلة)، وإضافة **موافقة العميل على نشر** القصة في المعرض.
2. عند الموافقة وموافقة الإدارة، تظهر النسخة المنشورة **داخل صفحة القالب الأصلي** فقط ضمن قسم «أعمالنا السابقة» — ولا تتكرر في المكتبة الرئيسية.
3. توفير **غلاف افتراضي** للقوالب الجديدة التي ينشئها الأدمن دون رفع صورة.

## خطوات التنفيذ

### 1) قاعدة البيانات (migration واحد)
- `orders.publish_consent boolean NOT NULL DEFAULT false`.
- `story_templates.source_template_id uuid` (FK → `story_templates.id`, ON DELETE SET NULL, INDEX) لربط النسخ المنشورة بالقالب الأصلي.

### 2) صفحة إتمام الطلب `src/routes/_authenticated.checkout.tsx`
لكل عنصر في السلة، إضافة داخل بطاقة القصة:
- **نمط الصورة**: زرّان (كرتوني / وجه حقيقي على مشهد 3D) — افتراضي `cartoon`.
- **اللغة**: 3 خيارات (عربي، إنجليزي، ثنائي) — افتراضي `ar`.
- **Checkbox للنشر**: «أوافق على نشر قصتي ضمن "أعمالنا السابقة" في صفحة القصة الأصلية بعد اعتماد الإدارة». افتراضي غير مفعّل.

تمرير القيم في `submitFn({ data: { items: [...] } })`.

### 3) دالة `submitCheckout` (`src/features/orders/checkout.functions.ts`)
توسيع `ItemInput` بـ: `language` و`photoMode` و`publishConsent`، وحفظها على كل صف من `orders`.

### 4) دالة النشر `adminPublishOrderStory`
- رفض النشر إذا كان `publish_consent = false`.
- في الإدراج: تعيين `is_custom = true` و`source_template_id = <القالب الأصلي>` بدلًا من `is_custom = false`.
- النتيجة: لا تظهر هذه النسخ في المكتبات الرئيسية (`stories.index`, `books.tsx`, `index.tsx`) لأنها تفلتر بـ `is_custom = false`.

### 5) صفحة معاينة القصة `src/routes/stories.$slug.tsx`
إضافة قسم جديد أسفل المحتوى: **«أعمالنا السابقة 🌟»**.
- استعلام `story_templates` حيث `source_template_id = story.id` و`is_published = true`.
- شبكة بطاقات (غلاف + اسم/عنوان مخصّص)، كل بطاقة تفتح `/stories/<slug>` لتصفّح النسخة المنشورة.

### 6) غلاف افتراضي للقوالب الجديدة
- توليد صورة غلاف افتراضية (سحرية/كتاب أطفال) وحفظها في `src/assets/default-cover.jpg`.
- تصدير ثابت `DEFAULT_COVER_URL` يستورد الصورة عبر ES module.
- في `TemplatesManager.tsx` (إنشاء/تعديل قالب الأدمن): إن لم يرفع الأدمن صورة، يُحفظ `cover_url = DEFAULT_COVER_URL` تلقائيًا.
- في `StoryCard.tsx` وأي مكان يعرض الغلاف: الرجوع إلى نفس الصورة الافتراضية إذا كان `cover_url` فارغًا (حماية للقوالب القديمة).

## ملفات ستُعدّل أو تُنشأ

- جديد: `supabase/migrations/<timestamp>_publish_consent_and_source_template.sql`
- جديد: `src/assets/default-cover.jpg` (تُولَّد بـ imagegen)
- جديد: `src/lib/defaultCover.ts` (يصدّر `DEFAULT_COVER_URL`)
- تعديل: `src/routes/_authenticated.checkout.tsx`
- تعديل: `src/features/orders/checkout.functions.ts`
- تعديل: `src/features/admin/admin.functions.ts` (دالة `adminPublishOrderStory`)
- تعديل: `src/features/admin/TemplatesManager.tsx` (استخدام الغلاف الافتراضي)
- تعديل: `src/routes/stories.$slug.tsx` (قسم أعمالنا السابقة)
- تعديل: `src/features/library/StoryCard.tsx` (fallback للغلاف)
- تحديث تلقائي: `src/integrations/supabase/types.ts` بعد الـ migration

## ملاحظات
- الطلبات والقوالب القديمة لن تتأثر؛ الغلاف الافتراضي يُستخدم فقط عند غياب `cover_url`.
- الطلبات قبل التغيير: `publish_consent = false` افتراضيًا — لن تُنشر إلا بعد موافقة العميل لاحقًا.
