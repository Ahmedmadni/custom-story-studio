
## ١) تدقيق الوضع الحالي (Audit)

**موجود ويعمل:**
- مصادقة كاملة + RLS + أدوار (auth, _authenticated gate, has_role).
- مكتبتان منفصلتان فعلاً: `/stories` و `/books` تقرآن من `story_templates` مع فلتر `content_type`.
- معالج إنشاء بـ 8 خطوات في `create.tsx` (1022 سطر): اسم، عمر، لغة، صورة، نوع، توليد، **معاينة واعتماد**، **تصدير ومشاركة**.
- توليد نص+صور متناسق (Gemini عبر Lovable AI Gateway) مع `character` ثابت + `ageStylePrompt` + `photoModePrompt` (cartoon/real).
- تعديل نص الصفحة + إعادة توليد الصورة قبل الاعتماد (`updatePageText`, `generatePageImage`).
- PDF عالي الجودة (`storyPdf.ts` + `PdfActions`) + حفظ في bucket `story-pdfs` + مشاركة واتساب.
- صفحة auth محسّنة، نمط فني موحّد، تكيّف العمر مطبّق.

**ناقص أو غير مكتمل (الفجوات الحقيقية):**
1. **اللغة ثنائية فقط (ar/en)** — لا يوجد وضع **عربي+إنجليزي**. حقل `language` في الجدول `text` يقبل أي قيمة لكن واجهة الاختيار + الـ prompt + الـ PDF + الـ schema (`z.enum(["ar","en"])`) لا تدعم `bilingual`.
2. **الكتب التعليمية بلا فئات مهيكلة**: لا يوجد قائمة ثابتة (رياضيات/علوم/برمجة/حروف ع/حروف إن/حيوانات/فواكه/ألوان) ولا اختيار "مستوى قراءة" ولا "طول الكتاب". الموضوع نص حر فقط.
3. **بنية الكتاب التعليمي**: الـ prompt يولّد 6 صفحات عامة بدون: غلاف منفصل، أهداف تعلّم، صفحات مراجعة، نشاط، خلاصة.
4. **الاعتماد ليس "إلزامياً" بشكل صارم**: زر تصدير PDF يظهر في خطوة 7 (بعد الاعتماد) — لكن لا يوجد سجل DB لحالة "approved" يمنع التصدير لو فتح المستخدم القصة من `my-orders` أو `story.$orderId`. التنفيذ حالياً يعتمد على state محلي فقط.
5. **بدون إعادة ترتيب الصفحات** (reorder) و **بدون إعادة توليد صفحة كاملة** (نص+صورة معاً).
6. **بدون مسودات/استعادة** (draft recovery) — لو أغلق المستخدم التبويب في منتصف المعالج يفقد كل شيء.
7. **بدون retry تلقائي** لفشل توليد الصور (يعتمد على المستخدم).
8. **بدون analytics events**.
9. ملف `create.tsx` 1022 سطر يخلط UI + state + business logic.
10. مكوّن `LanguageOptions`/`STEPS` مكرّر، لا توجد بنية feature-based.

---

## ٢) خطة التنفيذ (مراحل قابلة للتحقق)

### المرحلة A — قاعدة البيانات والنماذج (migration واحد)
- توسيع `story_templates.language` ليقبل `ar | en | bilingual` (CHECK constraint) + قيمة افتراضية.
- إضافة عمود `approved_at timestamptz` على `story_templates` (يمنع التصدير قبل الاعتماد).
- إضافة عمود `book_meta jsonb` للكتب: `{ category, reading_level, length, learning_goals[] }`.
- إضافة جدول `wizard_drafts (user_id, payload jsonb, updated_at)` لاستعادة المسودات (RLS: المستخدم لمسودته فقط) + GRANTs.
- خادم تحقّق: `approveTemplate` server fn يضع `approved_at`، و`generateStoryPdf`/`saveStoryPdf` يرفضان لو `approved_at IS NULL`.

### المرحلة B — إعادة هيكلة المجلدات (feature-based، بدون كسر)
```
src/features/
  create/           ← يضم create.tsx مقسماً
    wizard/Stepper.tsx, StepName.tsx, StepAge.tsx, StepLanguage.tsx,
           StepPhoto.tsx, StepContent.tsx, StepGenerate.tsx,
           StepPreview.tsx, StepExport.tsx
    hooks/useWizardState.ts, useDraft.ts, useImageGeneration.ts
    lib/wizardSchema.ts
  library/          ← stories + books shared components (StoryCard, filters)
  pdf/              ← storyPdf.ts + PdfActions.tsx
  ai/               ← ai.functions.ts منظماً (story, book, image, translate)
```
الـ routes تبقى أغلفة رفيعة تستورد من `features/`.

### المرحلة C — وضع اللغة الموحّد (Stories + Books)
- `LANGUAGE_OPTIONS` يصبح: `ar` (عربي فقط)، `bilingual` (عربي+إنجليزي)، `en` (إنجليزي فقط).
- اختيار اللغة **مطلوب** (لا قيمة افتراضية صامتة) — الزر "التالي" معطّل بدون اختيار صريح.
- في `bilingual`: الـ prompt يطلب لكل صفحة `text_ar` + `text_en` + `title_ar` + `title_en`. `StoryPage` يصبح `{ n, title_ar?, title_en?, text_ar?, text_en?, text?, scene, image_path? }` مع توافق رجعي.
- العرض في المعاينة والـ PDF: عربي ثم إنجليزي عمودياً (موبايل) / side-by-side (شاشة كبيرة، responsive).
- يُحفظ `language` في DB ويُمرَّر لكل: مكتبة (badge)، معاينة، PDF، رسالة واتساب.

### المرحلة D — الكتب التعليمية المهيكلة
- ثوابت في `features/library/bookCategories.ts`: `mathematics, science, programming, arabic_letters, english_letters, animals, fruits, colors` (مع label عربي + أيقونة).
- في معالج الإنشاء عند `contentType=book`: يحلّ محل حقل "topic" الحر:
  - اختيار **فئة** (شبكة بطاقات).
  - **مستوى القراءة**: مبتدئ/متوسط/متقدم (مشتق من العمر تلقائياً ويمكن تعديله).
  - **طول الكتاب**: قصير 6 / متوسط 10 / موسّع 14 صفحة.
- prompt جديد للكتب يولّد بنية: `cover` + `learning_goals[]` + `lessons[]` + `review[]` + `activity` + `summary`. تُرسم كصفحات بنفس نظام الصور.
- صعوبة المفردات تتكيّف عبر `ageStylePrompt` + قاعدة "أبسط الكلمات للأصغر سناً" في system prompt.

### المرحلة E — Preview & Approval إلزامي
- خطوة المعاينة تكتسب:
  - **إعادة توليد صفحة كاملة** (نص+صورة) — server fn جديدة `regeneratePage`.
  - **إعادة ترتيب الصفحات** (drag-handle بسيط ↑/↓) — server fn `reorderPages` تحدّث `pages[].n`.
  - زر "اعتماد المحتوى" يستدعي `approveTemplate` ويثبّت `approved_at`.
- `PdfActions` + `saveStoryPdf` يتحققان من `approved_at` server-side (يرفعان خطأ واضح بالعربية).
- في `_authenticated.story.$orderId.tsx` و `my-orders`: يظهر badge "بانتظار الاعتماد" مع زر "اذهب للاعتماد".

### المرحلة F — استعادة المسودات + الموثوقية
- `useDraft`: debounce 1s، يحفظ `wizard_drafts` (childName, age, language, contentType, bookMeta, topic, photoPath, photoMode, step).
- عند فتح `/create` ووجود مسودة: شريط علوي "لديك مسودة محفوظة — استئناف؟ / تجاهل".
- Retry تلقائي مع backoff لفشل صورة (×2)، ثم زر يدوي.
- Zod validators موحّدة في `wizardSchema.ts`.
- Analytics: `track(event, payload)` خفيف (console + جدول `analytics_events` اختياري لاحقاً) للأحداث: `wizard_step`, `generate_started/success/failed`, `approved`, `pdf_exported`, `wa_shared`.

### المرحلة G — UI/UX (الحفاظ على الهوية، تحسين فقط)
- Stepper متجاوب أفقي على الموبايل (scroll-snap بدل الإخفاء).
- بطاقات أكبر، حالات empty/loading/error موحّدة (`<EmptyState/>`, `<ErrorBlock/>`, شِيمر بدل `Skeleton` المكرر).
- Onboarding بسيط: tooltip "ابدأ من هنا" أول زيارة.
- مكوّن `<PageReader/>` موحّد للمعاينة، يُستخدم في `story.$orderId` أيضاً (مصدر واحد).
- تحسين tap targets ≥ 44px، تباين tokens، animations مدروسة (framer-motion للنقل بين الخطوات فقط).

### المرحلة H — QA يدوي + سكربت اختبار
- سيناريوهات: قصة ع/إن/ثنائي × كتاب 8 فئات × مع/بدون صورة × cartoon/real × اعتماد ثم PDF ثم WhatsApp ثم استعادة من `my-orders`.
- فحص: الـ PDF يطابق المعاينة، الـ bilingual يعرض اللغتين في كل مكان، الاعتماد مطلوب server-side، المسودات تستعاد بعد إغلاق التبويب.

---

## ٣) ما لن أفعله (لتجنب الإفراط)
- لن أغيّر تكامل المصادقة الحالي.
- لن أستبدل Lovable AI Gateway أو نموذج Gemini.
- لن أحذف `admin`, `my-orders`, أو سير الإدارة اليدوي عبر واتساب (admin number).
- لن أحوّل المشروع إلى Edge Functions — يبقى TanStack `createServerFn`.

---

## ٤) ترتيب الشحن المقترح
A (migration) → C (لغة موحّدة) → D (كتب مهيكلة) → E (اعتماد إلزامي + reorder/regenerate page) → F (drafts + retry) → B (إعادة الهيكلة feature-based — أتركها للأخير لأنها reorg خطر) → G (تلميع UI) → H (QA).

سأنفّذ هذا على دفعات وأبلغك بعد كل مرحلة لمراجعتك. هل أبدأ بالمرحلة A (migration قاعدة البيانات) الآن؟
