# خطة التطوير — الوضع الحالي والخطوات القادمة

مرجع عملي لمتابعة خطة النمو الموجودة في `.lovable/plan.md` من داخل جلسات Claude Code.
حدّث هذا الملف كلما اكتملت خطوة أو تغيّر النطاق.

## الحالة الحالية (بناءً على فحص الكود بتاريخ 2026-07-02)

### ✅ Milestone 1 — Conversion Boosters — منجز
- عدادات الثقة (`TrustCounters`) + `getTrustStats`.
- شريط المناسبات (`OccasionStrip`) + عمود `occasion` على `story_templates`.
- المفضلة (`favorites` + `FavoriteButton` + `/favorites`).
- التوصيات الذكية (`RecommendedStories` + `recommendations.functions.ts`).

### 🟡 Milestone 2 — Loyalty & Profiles — شبه منجز
- ملفات الأطفال (`child_profiles`) و"عالم القصة" (`child_story_universe` — نظام مستويات
  ونقاط خبرة أوسع من الوصف الأصلي في الخطة).
- صفحات `/my-children` + إنشاء/تعديل.
- نظام النقاط (`reward_accounts`, `reward_transactions`, `award_points`) + صفحة `/rewards`.
- **مطلوب تحقق**: هل يُطبَّق خصم النقاط فعلياً في الـ checkout؟ لم يُعثر على حقول
  `points_used` / `points_discount_egp` على جدول `orders` ولا على منطق خصم في
  `checkout.functions.ts`. إن لم يكن موجوداً، هذا أول عنصر يُستكمل في M2.

### ⬜ Milestone 3 — SEO & Content — لم يبدأ
لا توجد صفحات هبوط SEO، لا `blog_posts`، لا `/sitemap.xml`.

## الخطوات القادمة المقترحة (بالترتيب)

1. **تأكيد/استكمال خصم النقاط في الـ checkout** (بقية M2) — إضافة الأعمدة على `orders` إن
   لم تكن موجودة + toggle "استخدم نقاطك" + خصم فعلي في `checkout.functions.ts`.
2. **صفحات هبوط SEO (M3)** — 8 مسارات ثابتة بمحتوى عربي/إنجليزي مخصص، meta، H1، شبكة قصص
   مُنتقاة (بفلتر occasion/category)، FAQ بصيغة JSON-LD، CTA.
3. **`/sitemap.xml` ديناميكي** — مسار خادم يُعدّد: الصفحة الرئيسية + صفحات الهبوط + كل قصة
   منشورة + كل مقال مدونة.
4. **جدول `blog_posts` + CRUD أدمن** (`/admin/blog`) + `/blog` و `/blog/$slug` + 5 مقالات
   بداية.
5. **Meta لكل مسار** (canonical, OG, Twitter) + JSON-LD للمقالات.

> قبل البدء بأي بند من M3، اسأل المستخدم عن نفس الأسئلة المفتوحة الواردة في نهاية
> `.lovable/plan.md` (تسلسل الأولوية، من يكتب المقالات الخمسة، إلخ) إن لم تُحسم بعد.

## ملاحظات تنفيذية

- اتّبع نمط الهجرات الحالي في `supabase/migrations/` (RLS + GRANTs صريحة لكل جدول جديد).
- التزم بنظام الألوان/التوكِنز الحالي في `src/styles.css` — لا نظام ألوان جديد.
- أي صفحة جديدة عامة (SEO/blog) يجب أن تكون RTL سليمة وتراعي checklist في
  `docs/QA-CHECKLIST.md` قبل الدمج.
