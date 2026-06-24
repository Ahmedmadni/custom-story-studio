## الهدف
السماح للعملاء (والزائرين بعد تسجيل الدخول) بتقديم **طلب قصة مخصصة** بفكرتهم الخاصة، بإدخال البيانات + دفع المبلغ + رفع إيصال الدفع فقط — **بدون أي توليد صور أو نصوص من الذكاء الاصطناعي**. الطلب يصل للأدمن، وهو من ينشئ القالب ويولّد القصة ويعتمدها وينشرها — عبر `/create` الحالي بصلاحياته الكاملة.

## النطاق
- مسار جديد للعميل فقط لتقديم الطلب المخصص.
- صفحة `/create` الحالية تبقى كما هي للأدمن (إنشاء كامل + توليد + اعتماد + نشر).
- لوحة الأدمن للطلبات تعرض الطلبات المخصصة الجديدة وتسمح ببدء التوليد لها.

## التغييرات

### 1) قاعدة البيانات (هجرة واحدة)
- إضافة عمود `custom_brief` (text, nullable) على جدول `orders` — يحفظ فكرة القصة التي كتبها العميل.
- إضافة عمود `is_custom_request` (bool, default false) على `orders` للتمييز السريع.
- لا تعديل على RLS الموجودة (العميل ينشئ صفّ طلب بنفسه كما هو الآن).

### 2) دالة سيرفر جديدة
`src/features/orders/customRequest.functions.ts`:
- `submitCustomStoryRequest` (POST + `requireSupabaseAuth`):
  - مدخلات: `childName`, `childNameEn?`, `childAge`, `gender`, `language`, `contentType`, `pagesCount` (10|16), `topic` (≥10 حرف), `bookCategory?`, `whatsapp`, `photoMode?`, `childPhotoPath?`, `gifterName?`, `gifterRelation?`, `receiptPath`, `publishConsent`.
  - السعر: 200 لـ10 صفحات / 250 لـ16 صفحة (من `pricePerPages(..., true)`).
  - يُدرج صفّ في `orders` بـ `template_id = null`، `is_custom_request = true`، `custom_brief = topic`، `payment_status = receipt_uploaded`، `status = pending`.
  - يُعيد `orderId`.

ملاحظة: `orders.template_id` حالياً غير nullable — الهجرة ستجعله nullable.

### 3) صفحة طلب جديدة `/request-story`
`src/routes/_authenticated.request-story.tsx` (تتطلب تسجيل دخول — كأي طلب آخر):
معالج بـ7 خطوات بسيطة:
1. اسم الطفل (+ بالإنجليزية إن اختار en/bilingual) + الجنس
2. العمر
3. اللغة
4. نوع المحتوى + فكرة القصة (textarea، ≥10 حرف) + عدد الصفحات (10/250 — 16/200 ج.م)
5. صورة الطفل (اختيارية) + photoMode
6. بيانات الإهداء (اختياري) + رقم واتساب
7. ملخص السعر + رفع إيصال الدفع + تأكيد الموافقة على النشر (اختياري) → إرسال

عند النجاح → تحويل إلى `/my-orders` مع توست تأكيد.

### 4) الصفحة الرئيسية + صفحة المكتبة
- زر CTA كبير في `/stories` و`/` يشير إلى `/request-story` ("اطلب قصة بفكرتك الخاصة") بدل `/create` للعملاء.
- `/create` يبقى مخفياً عن العملاء (الزر داخلها يحوّلهم لـ `/request-story` بدل `/stories`).

### 5) لوحة الأدمن
في `OrdersManager`:
- شارة "طلب مخصص" على الصفوف التي `is_custom_request = true`.
- زر "إنشاء القصة" يفتح `/create?orderId=<id>` — يُملأ المعالج تلقائياً ببيانات الطلب (childName, age, language, gender, topic, photoMode, pagesCount, childPhotoPath) ويمر الأدمن خلال خطوات التوليد والاعتماد بصلاحياته الكاملة. عند الاعتماد يربط `orders.template_id` بالقالب الناتج.

تعديل بسيط في `create.tsx`:
- قراءة `?orderId=` من الـ search params.
- إن وجد + المستخدم أدمن: تحميل الطلب وتعبئة الحقول الأولية.
- بعد `approveAndContinue` للأدمن: تحديث `orders` بـ `template_id` و`status = approved`.

## الملفات
- جديد: `supabase/migrations/<ts>_custom_request.sql`
- جديد: `src/features/orders/customRequest.functions.ts`
- جديد: `src/routes/_authenticated.request-story.tsx`
- تعديل: `src/routes/create.tsx` (دعم `?orderId=`، CTA البديل للعميل)
- تعديل: `src/routes/stories.index.tsx` و`src/routes/index.tsx` (الزر يشير لـ `/request-story`)
- تعديل: `src/features/admin/OrdersManager.tsx` (شارة + زر "إنشاء القصة")

## نقطة قرار قبل التنفيذ
هل تريد أن يستطيع الزائر **غير المسجّل** ملء النموذج ثم يُطلب منه تسجيل الدخول في خطوة الدفع، أم يلزم تسجيل الدخول من البداية كباقي الطلبات (الأبسط)؟