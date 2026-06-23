# خطة التحديث

## 1) صلاحيات الادمن في إنشاء القصص
- في `/create` (و`/order/:templateId`): إذا كان المستخدم `isAdmin`:
  - تخطّي تماماً مرحلة الدفع (الطلب يُنشأ بحالة `paid` تلقائياً).
  - تخطّي مرحلة "نقل الطلب لاعتماد الإدارة" — يتم اعتماد المحتوى تلقائياً بعد التوليد (`admin_approved_at = now()`).
  - إظهار زر **"نشر في المكتبة"** مباشرة بعد التوليد (بدون الحاجة لموافقة العميل).
- إخفاء تبويب/زر **"قالب جديد"** من `TemplatesManager` وتوحيده مع `/create` — يصبح `/create` متاحاً فقط للأدمن أو للمستخدمين العاديين بنفس الواجهة لكن مع منطق مختلف عند الإرسال.

## 2) نمط "وجه حقيقي" - إلزام الحفاظ على الملامح
- في `src/features/ai/storyStyle.ts`: تقوية `realFacePrompt`:
  - "MUST preserve the EXACT real photograph face of the child — same eyes color, eyebrows, nose, lips, skin tone, hair, freckles. Do NOT cartoonize, stylize, smooth, or modify facial features in any way. The face must look IDENTICAL across all pages — same identity, same features, same proportions. Only the body, outfit, and scene are 3D cartoon; the face remains a real photograph composited seamlessly into the 3D scene (Sonic movie / Tom & Jerry real-actor style)."
  - إضافة `FACE_CONSISTENCY_LOCK` يُحقن في كل صفحة عند `photo_mode = 'real'`.
- في `ai.functions.ts`: عند توليد كل صفحة، تمرير الصورة المرجعية للطفل (`child-photos`) كمدخل صورة (image-to-image) لـ Gemini للحفاظ على الهوية، وليس فقط في الصفحة الأولى.

## 3) ميزة "إهداء القصة" (اسم مقدم الطلب)
- **قاعدة البيانات**: ميجريشن لإضافة عمودين على `orders`:
  - `gifted_by_name TEXT` — اسم الأب/الأم/المُهدي.
  - `gifted_by_relation TEXT` — العلاقة (أب، أم، جد، خالة...).
- **واجهة الطلب** (`order/:templateId` و`/create`): حقلان جديدان اختياريان:
  - "اسم مقدم/مهدي القصة" + اختيار العلاقة من قائمة.
- **في توليد القصة** (`ai.functions.ts`):
  - حقن `{gifter_name}` في system prompt: "هذه القصة مهداة من {relation} {gifter_name} للطفل {child_name}. أدرج اسم المُهدي في الصفحة الأولى ضمن الإهداء، ويمكن ذكره مرة أو مرتين بطريقة طبيعية في القصة."
- **في PDF** (`storyPdf.ts`):
  - في صفحة الغلاف: تحت العنوان نص "إهداء من {relation} {gifter_name} 💝".

## 4) زر النشر بعد التسليم
- **في `/story/:orderId`** (صفحة العميل بعد التسليم):
  - زر جديد: "وافق على نشر قصتي في معرض أعمالنا" (checkbox + زر).
  - عند الموافقة: تحديث `orders.publish_consent = true`.
- **عمود جديد على `orders`**:
  - `publish_consent BOOLEAN DEFAULT false` — موافقة العميل.
  - `published_at TIMESTAMPTZ` — تاريخ النشر الفعلي.
  - `published_template_id UUID REFERENCES story_templates(id)` — رابط القالب المنشور.
- **في `OrdersManager` للأدمن**:
  - عند `publish_consent = true` ولم تُنشر بعد: زر "نشر في المكتبة" → يُنشئ سجلاً في `story_templates` (نوع `gallery` / `published_work`) ويربطه بـ `published_template_id`.
- **في `/stories`** (مكتبة القصص):
  - تبويب فرعي/قسم: **"من أعمالنا"** يعرض القصص المنشورة من طلبات العملاء.
  - في صفحة القصة الرئيسية (`stories/:slug`): قسم "نماذج من تنفيذنا" يعرض القصص المرتبطة بنفس القالب الأصلي.
- **سلوك الأدمن في `/create`**: زر "نشر مباشر في المكتبة" بدون انتظار موافقة، يُنشئ template مباشرة.

## 5) ميجريشن قاعدة البيانات
```sql
ALTER TABLE public.orders
  ADD COLUMN gifted_by_name TEXT,
  ADD COLUMN gifted_by_relation TEXT,
  ADD COLUMN publish_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN published_template_id UUID REFERENCES public.story_templates(id);

ALTER TABLE public.story_templates
  ADD COLUMN source_template_id UUID REFERENCES public.story_templates(id),
  ADD COLUMN source_order_id UUID REFERENCES public.orders(id),
  ADD COLUMN is_gallery BOOLEAN NOT NULL DEFAULT false;
```

## الملفات المتأثرة
- ميجريشن SQL واحدة.
- `src/features/ai/storyStyle.ts` — تقوية وجه حقيقي + إهداء.
- `src/features/ai/ai.functions.ts` — حقن الإهداء + صورة مرجعية لكل صفحة.
- `src/features/pdf/storyPdf.ts` — إدراج الإهداء على الغلاف.
- `src/routes/_authenticated.order.$templateId.tsx` — حقول الإهداء + منطق الأدمن (تخطّي الدفع).
- `src/routes/create.tsx` — نفس الشيء + زر "نشر مباشر".
- `src/routes/_authenticated.story.$orderId.tsx` — checkbox موافقة النشر.
- `src/features/admin/OrdersManager.tsx` — زر "نشر في المكتبة".
- `src/features/admin/TemplatesManager.tsx` — إخفاء "قالب جديد" (موحَّد مع create).
- `src/routes/stories.index.tsx` + `stories.$slug.tsx` — قسم "من أعمالنا".
- `src/features/orders/checkout.functions.ts` / `story.functions.ts` — تخطّي الدفع للأدمن + endpoint نشر.

## نقاط التحقق
1. أدمن ينشئ قصة → لا دفع، اعتماد فوري، زر نشر مباشر.
2. عميل يختار "وجه حقيقي" → كل الصفحات تحافظ على ملامح الطفل الحقيقية.
3. عميل يدخل اسم الأم/الأب كمُهدي → يظهر على غلاف PDF وداخل النص.
4. عميل يوافق على نشر قصته → الأدمن يرى زر النشر → القصة تظهر في "من أعمالنا".
