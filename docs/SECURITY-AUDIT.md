# تقرير التدقيق الأمني — كيدزي (Production Hardening Sprint / Phase 1)

تاريخ التدقيق: 2026-07-03 · النطاق: RLS، الوصول المجهول، SECURITY DEFINER، RPC، تخزين
الملفات، وضوابط الأدمن، عبر كل الجداول المطلوبة.

**منهجية**: هذا تدقيق ثابت (static) على كود المشروع (`supabase/migrations/*.sql` +
`src/`) — لا يوجد اتصال مباشر بقاعدة بيانات Supabase الحية من هذه البيئة. حيثما تعذّر
التحقق من حالة فعلية (سياسة أو صلاحية أُنشئت خارج نطاق ملفات الهجرة)، ذلك موضّح صراحةً
تحت "⚠️ يتطلب تحقق مباشر من القاعدة الحية" بدل افتراض أنه آمن.

**نتيجة مهمة قبل التفاصيل**: جداول `orders`, `profiles`, `story_templates`,
`user_roles`, `generated_pages`, `favorites` (جزئياً) — وكذلك دالة `has_role` نفسها —
أُنشئت **قبل** بداية سجل ملفات الهجرة الحالي (أول ملف مؤرَّخ 2026-06-11 يحتوي تعديلات
على `story_templates` الموجود مسبقاً، لا إنشاءه). هذا يعني إعداد RLS الأصلي لهذه الجداول
غير مرئي في الكود على الإطلاق — فقط التعديلات اللاحقة عليه. عولجت هذه الفجوة حيثما أمكن
بأمان (`profiles`)، ووُثّقت كخطر يتطلب تحققاً مباشراً حيثما تعذّر ذلك بأمان (البقية).

---

## 1) ملخّص تنفيذي

| الخطورة | العدد | الحالة |
|---|---|---|
| 🔴 حرج | 1 | يتطلب تحقق مباشر (لا يمكن إصلاحه من الكود بأمان) |
| 🟠 عالٍ | 2 | 1 أُصلح في هذه الجولة، 1 يتطلب تحقق مباشر |
| 🟡 متوسط | 3 | 1 أُصلح، 2 توثيق/تحسين مستقبلي |
| 🔵 منخفض/معلوماتي | 3 | توثيق فقط |

---

## 2) الجداول — حالة RLS جدولاً بجدول

| الجدول | RLS مفعّل | السياسات مرئية بالكامل في الكود؟ | ملاحظات |
|---|---|---|---|
| `profiles` | ❌ ثم ✅ (أُصلح الآن) | لا (كان معدوماً) | **🟠 عالٍ — أُصلح.** انظر §3.1 |
| `child_profiles` | ✅ | نعم | جيد — مالك فقط + أدمن قراءة |
| `child_story_universe` | ✅ | نعم | جيد — عبر ربط `child_id` بمالك الطفل |
| `child_story_history` | ✅ | نعم | جيد — قراءة فقط للمالك، لا INSERT/UPDATE من العميل (يتم عبر RPC) |
| `reward_accounts` | ✅ | نعم | جيد |
| `reward_transactions` | ✅ | نعم | قراءة فقط للمالك؛ الكتابة حصراً عبر `award_points` (service_role) |
| `referrals` | ✅ | نعم | قراءة للمُحيل فقط؛ لا سياسة للمدعو نفسه (انظر §3.4) |
| `reviews` | ✅ | نعم | جيد — منشور للجميع، خاص للمالك، كامل للأدمن |
| `favorites` | ✅ | نعم | جيد |
| `orders` | ⚠️ افتراضياً مفعّل | **جزئياً** — فقط سياسة INSERT مرئية ومُحكَمة جيداً عبر 3 تكرارات | ⚠️ انظر §3.2 |
| `coupons` | ✅ | نعم | 🟡 كانت السياسة فضفاضة — **أُصلحت الآن**. انظر §3.3 |
| `coupon_redemptions` | ✅ | نعم | جيد — قراءة فقط للمالك، الكتابة عبر service_role حصراً |

### 2.1 جداول أساسية أخرى ذات صلة (خارج القائمة المطلوبة لكن ضرورية للسياق)
- `story_templates`: GRANT SELECT لـ`anon, authenticated` موجود (مقصود — تصفّح عام
  للمكتبة)، لكن **لا توجد أي سياسة RLS مرئية في الكود** — فقط `DROP POLICY` لسياسات
  أُنشئت خارج نطاق الهجرات. ⚠️ يتطلب تحقق مباشر أن سياسة القراءة العامة تقتصر على
  `is_published = true` وأن الكتابة مقيّدة بالمالك/الأدمن.
- `user_roles`: لا توجد أي سياسة RLS مرئية في الكود إطلاقاً. هذا الجدول يحدّد من هو
  أدمن — **الأخطر منطقياً لو كانت RLS معطّلة أو فضفاضة** (ترقية ذاتية لأدمن). ⚠️ حرج —
  تحقق مباشر إلزامي قبل الإطلاق (انظر §3.2).
- `generated_pages`: لا سياسة مرئية؛ الوصول الفعلي في التطبيق دائماً عبر `supabaseAdmin`
  (صفحات القصص المولَّدة تُدار حصراً من السيرفر). أقل خطورة لكن يستحق تحققاً.

---

## 3) النتائج التفصيلية

### 3.1 🟠 عالٍ — `profiles` بلا RLS إطلاقاً (**أُصلح**)
**الوصف**: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;`
موجود منذ أول هجرة، لكن لا `ENABLE ROW LEVEL SECURITY` ولا `CREATE POLICY` لهذا الجدول
في كامل تاريخ الهجرات (31 ملفاً). بدون RLS، أي مستخدم موثّق يملك JWT صالحاً يستطيع قراءة
أو تعديل أو حذف **أي** صفّ في `profiles` (بما فيها `whatsapp`, `referral_code`,
`onboarding_completed_at` لأي مستخدم آخر) عبر استدعاء PostgREST مباشر بمعزل عن واجهة
التطبيق.

**الإصلاح**: `supabase/migrations/20260703090000_security_hardening.sql` يُفعّل RLS
ويضيف: سياسة "المستخدم يدير صفّه فقط" (`auth.uid() = id`) وسياسة قراءة للأدمن — بنفس
نمط بقية الجداول في المشروع.

**التحقق بعد التطبيق** (شغّله يدوياً على القاعدة الحية):
```sql
select count(*) from pg_policies where schemaname='public' and tablename='profiles';
-- يجب أن يُرجع 2
```

### 3.2 🔴 حرج / ⚠️ يتطلب تحقق مباشر — `user_roles` و`orders` غير مرئيين بالكامل
لم يُعثر على أي `CREATE POLICY` لـ`user_roles` في أي هجرة. هذا الجدول يحدّد صلاحية
الأدمن عبر `has_role()` المُستخدمة في **كل** نقطة تحقق أدمن في التطبيق (`assertAdmin` في
كل ملف `*.functions.ts` إداري). لو كانت RLS معطّلة أو تسمح لمستخدم عادي بـ
`INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'admin')`، فهذا تصعيد صلاحيات
كامل (privilege escalation) للتطبيق بأكمله.

كذلك لم يُعثر على سياسات SELECT/UPDATE/DELETE لـ`orders` (فقط INSERT مُحكَمة جيداً عبر 3
تكرارات — آخرها في `20260626113204` مع تعليق "security finding" يُظهر أن الفريق (أو
جلسة Claude Code سابقة) عالج هذا فعلاً مرة). عدم وجود سياسة UPDATE/DELETE مرئية يعني
افتراضياً (لو RLS مفعّلة بلا سياسة لهذا الأمر) أن التحديث/الحذف المباشر من العميل
**مرفوض بالكامل** — وهذا **آمن** فعلياً (كل تعديلات `orders` في التطبيق تمر عبر
`supabaseAdmin` في `admin.functions.ts`)، لكن يجب تأكيده وليس افتراضه.

**لا يمكن إصلاح أي منهما من هذه الجلسة** لأن أي سياسة حالية غير مرئية في الكود —
إضافة سياسة تقييدية جديدة لا تُلغي سياسة فضفاضة موجودة مسبقاً (سياسات RLS من نوع
PERMISSIVE تُجمَع بـ OR)، فقد تُعطي شعوراً زائفاً بالأمان دون حلّ المشكلة الفعلية إن
كانت موجودة.

**إجراء مطلوب قبل الإطلاق** (شغّل هذا مباشرة في Supabase SQL editor):
```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('user_roles','orders','story_templates','generated_pages')
order by tablename, cmd;
```
راجع كل نتيجة يدوياً. لو `user_roles` لا تحتوي على الأقل سياسة تمنع INSERT/UPDATE من
`authenticated` (أو تسمح بها بشرط `has_role(auth.uid(),'admin')` فقط)، **أوقف الإطلاق**
وأصلحها فوراً.

### 3.3 🟡 متوسط — تعداد أكواد الكوبونات (**أُصلح**)
سياسة `"Authenticated read active coupons"` (من `20260702121500`) كانت تسمح لأي مستخدم
موثّق بـ `SELECT *` من `coupons` مباشرة، بما فيها الأكواد الشخصية أحادية الاستخدام
`REF-XXXXXX` المولَّدة لمستخدم مُحال بعينه (نظام الإحالة). كل تحقّق فعلي من الكوبونات في
التطبيق (`checkout.functions.ts`, `referrals.functions.ts`) يمرّ عبر `supabaseAdmin` —
فلا حاجة وظيفية إطلاقاً لقراءة العميل المباشرة لهذا الجدول.

**الإصلاح**: أُزيلت السياسة والـ GRANT لـ`authenticated` في نفس هجرة §3.1. التحقق
والتطبيق الفعلي لا يزالان يعملان بلا أي تغيير (لأنهما عبر service_role).

### 3.4 🟡 متوسط — `referrals`: لا سياسة صريحة للمدعو
السياسة الوحيدة على `referrals` هي `"Inviters view their referrals"`
(`inviter_id = auth.uid()`). المستخدم المُحال (`invited_user_id`) لا يملك سياسة SELECT
خاصة به — لا يستطيع رؤية صفّ إحالته الخاص عبر RLS المباشر (لكن لا ضرر وظيفي حالياً لأن
لا واجهة في التطبيق تعرض هذا للمدعو). يُوصى بإضافة سياسة SELECT للمدعو أيضاً عند تنفيذ
Phase 2 (حماية الإحالة من إساءة الاستخدام) لأن الحالة `pending` الجديدة قد تحتاج عرضها له.

### 3.5 🔴 حرج / ⚠️ يتطلب تحقق مباشر — bucket التخزين `child-photos`
**لم يُعثر على أي سياسة تخزين لـ `child-photos` في أي ملف هجرة على الإطلاق** — لا
`CREATE POLICY ... ON storage.objects ... bucket_id = 'child-photos'` ولا حتى إشارة
واحدة لاسم الـ bucket. هذا أخطر ما وُجد في هذا التدقيق: هذا الـ bucket يحوي **صور أطفال
حقيقيين**، وهو المذكور صراحةً في `CLAUDE.md` نفسه: *"Storage bucket `child-photos` must
stay owner-scoped via RLS"* — لكن لا دليل في الكود يثبت أن هذا صحيح فعلياً اليوم.

تأكّدنا من نمط المسارات المستخدم في **كل** نقاط الرفع الأربع (`checkout.tsx`,
`create.tsx`, `OrderEditDialog.tsx`, `request-story.tsx` عبر `uploadToBucket`) — جميعها
تتّبع `${user.id}/<uuid>.<ext>` بشكل متّسق تماماً، وهذا يطابق تماماً النمط المستخدم فعلياً
مع bucket `reference-children` (الذي **له** سياسة مرئية في الكود). لذا لو كانت هناك
سياسة owner-scoped مُعرَّفة خارج الهجرات، فبنية المسارات ستدعمها بشكل صحيح.

**لماذا لم أُصلح هذا من الكود**: لا يمكنني معرفة ما إذا كانت هناك سياسة موجودة بالفعل
(ربما مُعدّة من لوحة Supabase مباشرة) واسمها، لذا لا أستطيع كتابة `DROP POLICY` آمن، وأي
`CREATE POLICY` إضافية لن تُلغي سياسة فضفاضة موجودة مسبقاً (تُجمَع بـ OR في RLS
PERMISSIVE). إصلاح أعمى هنا قد يعطي ثقة زائفة.

**إجراء مطلوب فوراً قبل أي إطلاق عام** (SQL editor في Supabase):
```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and qual::text ilike '%child-photos%' or with_check::text ilike '%child-photos%';
```
لو لم تُرجع أي صف → **الـ bucket غير محمي بأي سياسة RLS إطلاقاً** (قد يكون معتمداً فقط
على كون الـ bucket "private" افتراضياً بلا Signed URL عام — تحقّق أيضاً من إعداد
`public` للـ bucket نفسه في Storage settings). في هذه الحالة نفّذ فوراً (بعد التأكد من
التسمية لا تتعارض مع أي شيء موجود):
```sql
create policy "Users manage own child photos"
on storage.objects for all to authenticated
using (bucket_id = 'child-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'child-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Admins manage all child photos"
on storage.objects for all to authenticated
using (bucket_id = 'child-photos' and public.has_role(auth.uid(), 'admin'));
```

### 3.6 🔵 معلوماتي — أدوات أخرى تحققنا منها وهي سليمة
- **buckets الأخرى موثّقة بالكامل في الكود** وتتبع نمطاً صحيحاً: `payment-receipts`
  (مالك + أدمن)، `story-pdfs` (مالك الطلب + أدمن، شُدِّدت مرتين — `tighten_pdf_storage_policy.sql`)،
  `reference-children` (قراءة عامة مُصادَق عليها + كتابة أدمن فقط — مناسب لأنها صور
  مرجعية عامة وليست بيانات شخصية).
- **حماية من ادّعاء دفع مزوَّر**: سياسة INSERT على `orders` تفرض
  `status='pending' AND payment_status IN ('unpaid','receipt_uploaded') AND payment_verified_at IS NULL AND payment_verified_by IS NULL`
  — يمنع مستخدماً من إنشاء طلب يّدّعي أنه مدفوع ومُعتمَد من الأدمن مسبقاً. جيد جداً.

---

## 4) الوصول المجهول (Anonymous)
`GRANT ... TO anon` ظهر لمرة واحدة فقط في كل قاعدة الكود:
```
GRANT SELECT ON public.story_templates TO anon, authenticated;
```
هذا **مقصود** (تصفّح مكتبة القصص بلا تسجيل دخول — يدعمه أيضاً `robots.txt`/`sitemap.xml`
من الميلستون السابقة). لا وصول مجهول آخر مكتشف لأي جدول من الـ 12 المطلوب مراجعتها. توصية:
تحقق من سياسة RLS الفعلية لـ`story_templates` (§2.1) لتأكيد أنها تقيّد الأعمدة/الصفوف
المعروضة للمجهول بـ `is_published = true` فقط ولا تكشف عن قوالب غير منشورة أو حقول
إدارية (`admin_notes`-like — لا يوجد عمود كهذا في `story_templates` حالياً، لكن تحقق).

## 5) سلوك تجاوز `service_role`
كل عمليات الكتابة الحساسة (نقاط، كوبونات، ترقية أدوار، توليد صفحات، تأكيد دفع) تمر حصراً
عبر `supabaseAdmin` (`src/integrations/supabase/client.server.ts`) الذي يستخدم
`SUPABASE_SERVICE_ROLE_KEY` ويتجاوز RLS بالكامل — هذا **متوقّع وصحيح** لأن هذا العميل
لا يُحمَّل إلا داخل دوال خادم (`*.functions.ts`) خلف `requireSupabaseAuth` +
`assertAdmin()` عند الحاجة، ولا يُصدَّر أبداً لحزمة العميل (تحقّقنا: كل استيراد له عبر
`await import(...)` ديناميكي داخل معالِج الدالة، ولا يوجد أي استيراد ثابت على مستوى
الملف في أي مسار يصل لحزمة المتصفح). المفتاح نفسه محمي بـ `.server.ts` suffix حسب قواعد
هذا المشروع في `CLAUDE.md`.

## 6) دوال `SECURITY DEFINER`
| الدالة | REVOKE من PUBLIC/anon/authenticated؟ | ملاحظة |
|---|---|---|
| `award_points` | ✅ | تُستدعى فقط عبر `supabaseAdmin.rpc(...)` — صحيح |
| `complete_story_for_child` | ✅ | تُستدعى فقط عبر trigger داخلي |
| `trg_orders_on_sent` | ✅ (REVOKE ALL) | trigger فقط، لا تُستدعى مباشرة |
| `calc_child_level` | ✅ (REVOKE ALL) ثم GRANT لـ service_role فقط | جيد |
| `gen_referral_code` / `set_referral_code` | ✅ | trigger فقط |
| `handle_new_user` | ✅ | trigger على `auth.users`، منطقه غير مرئي في الهجرات (⚠️ خارج نطاقها) |
| `update_updated_at` | ✅ | trigger عام |
| `grant_welcome_bonus` | ✅ | trigger على `auth.users` |
| `has_role` | ⚠️ **لا يوجد REVOKE مرئي** | تُستدعى عبر `context.supabase.rpc()` (عميل المستخدم) في 9 مواضع — هذا **مقصود** (فحص صلاحيات ذاتي)، لكن لأنها تقبل `_user_id` كباراميتر حر، أي مستخدم موثّق يستطيع استدعاءها بـ `_user_id` تابع لشخص آخر ليعرف هل هو أدمن (تسريب معلومة بسيط، خطورة منخفضة). لا يُعرف تعريفها الكامل من الكود (خارج نطاق الهجرات) فلا يمكن تأكيد إن كانت `SECURITY DEFINER` أصلاً. |

**توصية منخفضة الأولوية**: إن رغبتم بإغلاق تسريب المعلومة البسيط في `has_role`، أضيفوا
دالة غلاف `public.am_i_admin()` بلا باراميترات تستدعي `has_role(auth.uid(),'admin')`
داخلياً، واستبدلوا استخدامات العميل التسع بها بدل تمرير `_user_id` من الخادم (الذي هو
`context.userId` أصلاً في كل الحالات المفحوصة — أي أنه **دائماً** يتحقق من نفسه لا من
غيره في هذا الكود تحديداً، فالمخاطرة نظرية أكثر منها مستغَلة فعلياً حالياً).

## 7) حدود صلاحيات RPC
كل استدعاءات `.rpc()` من العميل في الكود (`grep` شامل):
- `has_role` — راجع §6، خطورة منخفضة/معلوماتية.
- `award_points` — حصراً عبر `supabaseAdmin`، لا استدعاء عميل مباشر. جيد.

لا استدعاءات RPC أخرى مكشوفة للعميل. جيد — سطح الهجوم عبر RPC ضيّق جداً.

## 8) ضوابط وصول الأدمن فقط
- **جبهة (Frontend)**: `_authenticated.admin.tsx` يتحقق من `isAdmin` (من `useAuth()`) قبل
  عرض المحتوى — هذا **UX فقط وليس حداً أمنياً حقيقياً** (يمكن تجاوزه بأدوات المطوّر)، وهو
  مقبول **بشرط** أن كل نقطة بيانات فعلية محمية على الخادم — وقد تحقّقنا من ذلك:
- **الخادم**: كل دالة إدارية في `src/features/admin/*.functions.ts`,
  `src/features/reviews/reviews.functions.ts` (moderation)، إلخ، تبدأ بـ
  `await assertAdmin(context)` التي تستدعي `has_role(context.userId, 'admin')` وتُلقي
  خطأ فوراً إن فشل التحقق. تم فحص هذا النمط في: `admin.functions.ts`, `users.functions.ts`,
  `analytics.functions.ts`, `health.functions.ts`, `ai.functions.ts` (اعتماد قوالب),
  `reviews.functions.ts` (moderation). **متّسق في كل مكان، لا استثناءات وُجدت.**

---

## 9) قائمة الإجراءات المتبقية قبل الإطلاق العام (بالأولوية)

1. 🔴 **فوري**: شغّل استعلام `pg_policies` من §3.5 للتحقق من `child-photos` — طبّق
   السياسة المقترحة إن كانت غائبة.
2. 🔴 **فوري**: شغّل استعلام `pg_policies` من §3.2 للتحقق من `user_roles` (تصعيد صلاحيات
   محتمل) و`orders` (SELECT/UPDATE/DELETE).
3. 🟠 تحقق من سياسة `story_templates` تقصر القراءة العامة على `is_published = true`.
4. 🟡 (اختياري) أضف سياسة SELECT للمدعو في `referrals` عند تنفيذ Phase 2.
5. 🔵 (اختياري) عالج تسريب المعلومة البسيط في `has_role` بدالة غلاف.

## 10) ما تم إصلاحه في هذه الجولة
- ✅ `profiles`: RLS مُفعَّلة الآن + سياستان (مالك، أدمن).
- ✅ `coupons`: أُزيلت إمكانية تعداد الأكواد من طرف العميل بلا أي أثر وظيفي.

راجع: `supabase/migrations/20260703090000_security_hardening.sql`.
