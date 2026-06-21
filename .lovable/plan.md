## ملخص ما سأنفّذه

أربع مهام مستقلة في نفس التحديث، كل واحدة معزولة عن الأخرى:

---

### 1) إصلاح خطأ "تعذر إرسال طلب إنشاء القصة/الكتاب"

**التشخيص**: عند الضغط على «توليد» في `/create`، تستدعي الواجهة `generateAiStory` و`generateAiBook` عبر `createServerFn`. الفشل الحالي يحدث على شكل toast بنص "تعذر التوليد، حاول مرة أخرى" — وهو يأتي من `callLlm` في `src/features/ai/ai.functions.ts` عندما يفشل طلب Lovable AI Gateway (status != 2xx، أو timeout على الـedge worker، أو رد غير JSON).

**الإصلاح**:
- إضافة `AbortController` بمهلة 55 ثانية + رسالة عربية واضحة عند الـtimeout بدل سقوط الطلب صامتاً.
- تسجيل رسالة الخطأ الفعلية (status + جزء من body) ورفعها للواجهة بدل رسالة عامة، حتى يعرف المستخدم سبب الفشل (مثلاً 402 = نفاد رصيد AI، 429 = ضغط، 500 = مشكلة مؤقتة، شبكة = شبكة).
- إضافة retry تلقائي مرة واحدة عند 5xx/network قبل رفع الخطأ.
- في `src/routes/create.tsx` (سطر 352) عرض `e.message` كاملاً بدل قصّه إلى "تعذر التوليد".
- تشغيل `stack_modern--server-function-logs` بعد البناء للتأكد من عدم وجود `__dirname`/`unenv` errors تكسر الـserver function.

### 2) اعتماد نمط الوجه الحقيقي + خلفية كرتونية كنمط افتراضي معزّز

النمط مطبّق فعلياً عبر `photoMode: 'real'` في `src/features/ai/storyStyle.ts`. الصورة المرفقة (IMG_0042) هي صورة طفلة حقيقية مرجعية — تأكيد لتفعيل وضع "real face on 3D cartoon scene" كافتراضي.

**التغييرات في `storyStyle.ts`**:
- **تقوية `photoModePrompt('real')`**: إضافة تأكيد مرجعي صريح بأمثلة (Superman live-action poster, Tom & Jerry 2021 movie posters, Sonic the Hedgehog movie) حتى لا يتراجع النموذج عن الالتزام.
- **جعل `real` هو الافتراضي** في `src/routes/create.tsx` عند اختيار رفع صورة الطفل، مع إبقاء خيار `cartoon` متاحاً صراحة.
- لا تغيير في باقي نظام الصور (الأغلفة، صفحات بلا صورة طفل تبقى على نمطها).

### 3) توسيع بنك الأسئلة/الألغاز بنك ديناميكي مولّد بالـAI (لا تكرار)

**الوضع الحالي**: `PUZZLES` ثابتة في `src/features/puzzles/puzzles-data.ts` مع 5 جولات لكل لغز تتكرر سريعاً.

**التصميم الجديد**:
- إنشاء `src/features/puzzles/puzzles.functions.ts` يحتوي `generatePuzzleRounds` كـ`createServerFn` يستدعي Lovable AI (`google/gemini-3-flash-preview`) لتوليد 8 جولات جديدة لكل جلسة بناءً على:
  - `puzzleId`, `engine`, `difficulty`, و**seed عشوائي** + قائمة آخر 30 سؤالاً للمستخدم لتجنّب التكرار.
  - مخرجات `Output.object` بـZod schema حسب نوع المحرّك (counting, odd_one_out, memory_pairs...).
- جدول جديد `puzzle_session_history` (user_id, puzzle_id, prompt_hash, created_at) لتذكّر آخر الأسئلة المعروضة لكل طفل وتمريرها كـ"تجنّب هذه" للنموذج. يُحفظ آخر 50 entry لكل (user, puzzle).
- في `PuzzleEngine.tsx`: قبل بدء الجلسة، نطلب `generatePuzzleRounds`؛ إن نجح نستخدمه، وإن فشل نسقط للجولات الثابتة الحالية (graceful fallback).
- شاشة "جاري التحضير..." لطيفة (skeleton لثوانٍ معدودة).

### 4) المؤثرات الصوتية الجاهزة (Web Audio API، بدون ملفات)

إنشاء `src/features/puzzles/sounds.ts`:
- `playCorrect()`: ترنيمة قصيرة صاعدة (C5→E5→G5) ~280ms مرحة.
- `playWrong()`: نغمة هابطة خفيفة (E4→C4) ~200ms غير مزعجة.
- `playTap()`: نقرة 40ms عند الضغط.
- `playWin()`: ترنيمة انتصار 3 نغمات (C5→E5→G5→C6) ~600ms عند انتهاء اللغز.
- تخزين `AudioContext` واحد lazy + التحكّم في `localStorage` flag `sfx_enabled` (افتراضياً مفعّل) + زر صامت/مفعّل في توولبار اللغز.
- استدعاؤها داخل `PuzzleEngine.tsx` في معالجات `onChoose` (صحيح/خاطئ)، `onPair` (memory)، و`onComplete`.

### 5) تنسيق الهوامش وبداية ظهور المحتوى

**المشكلة**: على الجوال محتوى الصفحات يبدأ مباشرة تحت الـHeader (لا يوجد top padding كافٍ)، وعلى الديسكتوب الـcontainer ضيّق جداً.

**التطبيق على الصفحات الرئيسية فقط** (`puzzles.tsx`, `puzzles_.$id.tsx`, `games.tsx`, `books.tsx`, `stories.index.tsx`, `create.tsx`, `index.tsx`):
- توحيد الـcontainer: `container mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12 max-w-6xl` (بدل الخليط الحالي).
- تحت الـHeader: إضافة spacer `h-2 sm:h-4` لمنع التصاق العنوان بالشريط.
- العناوين الرئيسية: `mt-2 sm:mt-4 mb-4 sm:mb-6` كنمط موحّد.

---

## ملفات ستتأثّر

| الملف | التغيير |
|---|---|
| `src/features/ai/ai.functions.ts` | إصلاح `callLlm` (timeout, retry, رسائل خطأ واضحة) |
| `src/features/ai/storyStyle.ts` | تقوية نمط `real` بأمثلة سينمائية |
| `src/routes/create.tsx` | عرض رسالة الخطأ الكاملة، تفعيل `real` كافتراضي |
| `src/features/puzzles/puzzles.functions.ts` (جديد) | server function للجولات الديناميكية |
| `src/features/puzzles/PuzzleEngine.tsx` | استخدام البنك الديناميكي + المؤثرات الصوتية + زر صامت |
| `src/features/puzzles/sounds.ts` (جديد) | Web Audio helpers |
| `src/routes/puzzles.tsx`, `puzzles_.$id.tsx`, `games.tsx`, `books.tsx`, `stories.index.tsx`, `create.tsx`, `index.tsx` | توحيد الهوامش |
| migration: `puzzle_session_history` table | لتذكّر الأسئلة المعروضة |

## ملاحظات
- لا تغيير في منطق الدفع/الواتساب/PDF/admin approval.
- المؤثرات الصوتية تعمل فوراً بدون رفع أي ملف.
- البنك الديناميكي يحتاج Lovable AI (مفعّل بالفعل عبر `LOVABLE_API_KEY`).
- في حالة عدم توفر AI أو فشل، الألغاز ترجع للجولات الثابتة الحالية فلا انقطاع في التجربة.
