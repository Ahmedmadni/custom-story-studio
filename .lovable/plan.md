# خطة التنفيذ

## 1) إصلاح "تعذر إرسال طلب إنشاء القصة"
**ملف**: `src/lib/ai.functions.ts` + `src/routes/create.tsx`
- إضافة `AbortController` بمهلة 55 ثانية في `callLlm`
- إعادة محاولة تلقائية مرة واحدة عند أخطاء 5xx/الشبكة
- رسائل خطأ واضحة تتضمن الحالة (status) وجزء من نص الرد بدل "تعذر التوليد"
- عرض `e.message` الكامل في صفحة `/create` بدل النص العام
- فحص لوجات serverFn عبر `stack_modern--server-function-logs` لتحديد السبب الجذري (timeout, JSON parse, env)

## 2) اعتماد نمط الصور المرجعي (Tom & Jerry / Superman / حقيقي + كرتوني)
**ملف**: `src/lib/storyStyle.ts`
- تقوية `photoModePrompt('real')` بإضافة إشارة صريحة لـ:
  - وجه الطفل يبقى **حقيقياً 100% بملامح فوتوغرافية** (لا كرتنة، لا تنعيم مفرط)
  - شخصيات/خلفية كرتونية ثلاثية الأبعاد بأسلوب أفلام Pixar/DreamWorks
  - إضاءة سينمائية، عنوان بارز فوق الصورة كأفلام السينما (مثل SUPERMAN / TOM & JERRY)
  - أمثلة مرجعية: Superman poster, Tom & Jerry movie poster, Sonic live-action style
- جعل `real` هو الافتراضي عند رفع صورة طفل في wizard (`/create`)

## 3) بنك أسئلة ديناميكي بالـAI
**ملفات جديدة**: `src/lib/puzzles.functions.ts` + migration
- `generatePuzzleRounds` كـ `createServerFn` يستخدم `google/gemini-3-flash-preview`
- يولّد 8 جولات جديدة لكل جلسة حسب نوع اللغز (رياضيات/كلمات/منطق/ذاكرة)
- جدول `puzzle_session_history (user_id, puzzle_id, question_hash, created_at)` لمنع التكرار
- `PuzzleEngine.tsx`: عند البدء يستدعي السيرفر للحصول على جولات؛ fallback للأسئلة الثابتة عند الفشل
- RLS + GRANT على الجدول الجديد

## 4) مؤثرات صوتية Web Audio خفيفة
**ملف جديد**: `src/lib/sounds.ts`
- `playCorrect()` نغمة صاعدة مرحة (C-E-G)
- `playWrong()` نغمة منخفضة لطيفة
- `playTap()` نقرة قصيرة
- `playWin()` تتابع احتفالي
- `playStar()` رنين نجمة
- مفتاح `sfx_enabled` في localStorage + زر كتم في `PuzzleEngine`
- يستخدم AudioContext فقط، بدون ملفات

## 5) تنسيق الهوامش وبداية المحتوى
**ملفات**: `src/routes/index.tsx`, `stories.tsx`, `books.tsx`, `create.tsx`, `puzzles.tsx`, `puzzles.$id.tsx`
- موحّد: `container mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12 max-w-6xl`
- spacer `h-2 sm:h-4` أسفل Header مباشرة
- توحيد المسافات بين الأقسام `space-y-6 sm:space-y-10`

## تفاصيل تقنية
- لا تغييرات على: الدفع، WhatsApp، PDF export، منطق اعتماد الإدارة
- migration واحدة: `puzzle_session_history` + GRANT + RLS (`auth.uid() = user_id`)
- لا أسرار جديدة، يستخدم `LOVABLE_API_KEY` الموجود

## الملفات المتأثرة
- تعديل: `ai.functions.ts`, `storyStyle.ts`, `create.tsx`, `PuzzleEngine.tsx`, 6 صفحات للهوامش
- جديد: `puzzles.functions.ts`, `sounds.ts`, migration واحدة
