## الهدف
تحويل صفحة `/admin` الحالية (ملف واحد ضخم بطول 1000+ سطر) إلى **لوحة تحكم احترافية بقائمة جانبية**، وفصل إدارة القوالب عنها، وتحسين شاشة إدارة الطلبات لتكون أوضح وأكثر احترافية.

## البنية الجديدة للراوتس

```text
src/routes/
  _authenticated.admin.tsx              ← Layout يحتوي Sidebar + <Outlet/>
  _authenticated.admin.index.tsx        ← /admin → نظرة عامة (إحصاءات + اختصارات)
  _authenticated.admin.orders.tsx       ← /admin/orders → إدارة الطلبات
  _authenticated.admin.templates.tsx    ← /admin/templates → إدارة القوالب
  _authenticated.admin.approvals.tsx    ← /admin/approvals → اعتماد محتوى المستخدمين
  _authenticated.admin.users.tsx        ← /admin/users → إدارة المستخدمين
  _authenticated.admin.roles.tsx        ← /admin/roles → إدارة الصلاحيات (إسناد/سحب admin)
```

كل صفحة تستخدم `Route.useRouteContext` للتأكد أن المستخدم Admin، وإلا تعرض رسالة "مخصص للإدارة فقط".

## القائمة الجانبية

مكوّن جديد `src/features/admin/AdminSidebar.tsx` يستخدم shadcn `Sidebar` (`collapsible="icon"`) مع روابط:
- 🏠 نظرة عامة → `/admin`
- 📦 الطلبات → `/admin/orders`
- ✅ اعتماد المحتوى → `/admin/approvals` (مع badge لعدد المعلّقة)
- 📚 القوالب → `/admin/templates`
- 👥 المستخدمون → `/admin/users`
- 🛡️ الصلاحيات → `/admin/roles`

الـ Layout يلفّ كل شيء بـ `SidebarProvider` ويضع `SidebarTrigger` في header علوي صغير. RTL مدعوم (الـ Sidebar على اليمين عبر `side="right"`).

## تحسينات شاشة إدارة الطلبات `/admin/orders`

اليوم: قائمة بطاقات + Dialog ضخم لكل طلب. التحديثات:

1. **شريط فلاتر علوي واضح**: حالة الطلب (الكل / بانتظار الدفع / مُعتمد / قيد التوليد / جاهز / مُرسل / مرفوض) + بحث باسم الطفل أو رقم الواتساب + فلتر "بحاجة لإجراء" (دفع غير مؤكد أو جاهز للإرسال).
2. **جدول احترافي** بدل البطاقات (باستخدام `Table` من shadcn): الأعمدة = الطفل/العمر، القصة، الحالة، الدفع، التقدّم (X/Y)، الواتساب، آخر تحديث، إجراءات سريعة (👁 فتح، 💬 واتساب، ⬇ PDF).
3. **Dialog الطلب يُعاد تنظيمه بتبويبات** (`Tabs`):
   - **معلومات** — بيانات الطفل + التفضيلات (لغة، نمط الصورة) قابلة للتعديل، الواتساب، الملاحظات.
   - **الدفع** — صورة الإيصال + زر تأكيد/رفض مع سبب.
   - **الصفحات** — شبكة الصور المُولّدة + زر "توليد/إعادة توليد" لكل صفحة + زر اعتماد إداري نهائي.
   - **التسليم** — تحميل PDF، إرسال واتساب (رسالة جاهزة)، تغيير الحالة، النشر في المكتبة العامة (مع checkbox موافقة العميل).
4. **شريط حالة علوي ملوّن** داخل الـ Dialog يظهر بوضوح: الحالة الحالية + الخطوة التالية المقترحة (مثلاً: "الطلب جاهز — أرسل الـ PDF على واتساب").
5. **Toast واضح** بعد كل إجراء + إعادة جلب تلقائية للقائمة.

## إدارة المستخدمين والصلاحيات

- **Server functions جديدة** في `src/features/admin/users.functions.ts`:
  - `adminListUsers` — يقرأ من `auth.users` عبر `supabaseAdmin.auth.admin.listUsers()` + يجمع مع `user_roles` + عدد الطلبات لكل مستخدم.
  - `adminGrantRole` / `adminRevokeRole` — إدراج/حذف من `user_roles` (admin يمنع حذف نفسه).
  كلاهما محمي بـ `requireSupabaseAuth` + فحص `has_role(..., 'admin')`.
- **صفحة المستخدمين**: جدول (الإيميل، تاريخ التسجيل، آخر دخول، عدد الطلبات، الأدوار، إجراءات).
- **صفحة الصلاحيات**: نفس المستخدمين لكن مركّزة على إدارة الأدوار (Toggle/Badge لكل دور، زر "ترقية لـ Admin" / "إزالة Admin" مع تأكيد).

لا حاجة لـ migration: جدول `user_roles` و enum `app_role` موجودان بالفعل.

## فصل القوالب

`TemplatesManager` ينتقل كما هو إلى `_authenticated.admin.templates.tsx` ويُحذف استدعاؤه من الصفحة الرئيسية. مكوّنات اعتماد قوالب المستخدمين المعلّقة (`PendingTemplatesList`) تنتقل إلى `/admin/approvals`.

## ملفات سيتم إنشاؤها/تعديلها

**إنشاء:**
- `src/features/admin/AdminSidebar.tsx`
- `src/features/admin/users.functions.ts`
- `src/features/admin/OrdersTable.tsx` (الجدول + الفلاتر)
- `src/features/admin/OrderDetailsDialog.tsx` (الـ Dialog بتبويبات — استخراج من الملف الحالي)
- `src/routes/_authenticated.admin.index.tsx`
- `src/routes/_authenticated.admin.orders.tsx`
- `src/routes/_authenticated.admin.templates.tsx`
- `src/routes/_authenticated.admin.approvals.tsx`
- `src/routes/_authenticated.admin.users.tsx`
- `src/routes/_authenticated.admin.roles.tsx`

**تعديل:**
- `src/routes/_authenticated.admin.tsx` ← يصبح Layout (`<Outlet/>` + Sidebar) بدلاً من صفحة كاملة.

**حذف منطقي:** المحتوى الحالي للصفحة يُوزَّع على الراوتس الجديدة، ولا تُحذف أي server function.

## ملاحظات تقنية

- لا تغييرات على قاعدة البيانات.
- استخدام `Link` + `params` من `@tanstack/react-router` للتنقّل داخل اللوحة (لا `<a href>`).
- استخدام `var(--sidebar-width)` لتفادي مشكلة Tailwind 4 المعروفة.
- جميع server functions الجديدة تستعمل `requireSupabaseAuth` + فحص دور admin (نفس النمط الموجود).
