## الهدف
إضافة زر "تصدير PDF" داخل لوحة الأدمن (نافذة تفاصيل الطلب) ليستطيع الأدمن تنزيل ملف القصة جاهزاً وإرساله يدوياً للعميل عبر الواتساب — دون الحاجة لاعتماد العميل أو الانتظار لاعتماد ثانٍ.

## التغييرات

### 1) `src/routes/_authenticated.admin.tsx` (داخل `OrderDialog`)
- استيراد `generateStoryPdf` و `PdfStoryPage` من `@/features/pdf/storyPdf`، وأيقونتي `FileDown` و `Loader2`.
- إضافة state: `exportingPdf: boolean` و `pdfProgress: {done,total} | null`.
- دالة `handleAdminExport()`:
  - تبني مصفوفة `PdfStoryPage[]` من `pageNumbers` + `pageMap` (تتجاهل الصفحات بلا `imageUrl` وتنبّه إن كانت ناقصة).
  - تستدعي `generateStoryPdf({ title: order.storyTitle, childName: order.childName, language: order.language, contentType: order.contentType, pages, onProgress })`.
  - تنزّل الملف محلياً باسم `{storyTitle}-{childName}.pdf` (بدون رفع للخادم — هذه نسخة أدمن خاصة).
  - عند الخطأ: `toast.error` بالرسالة.

### 2) موضع الزر
يُضاف زر بنفس صف "إرسال عبر الواتساب" (السطر 524-537)، ويظهر دائماً متى كانت الحالة `approved`/`generating`/`ready`/`sent` وكان عدد الصفحات الجاهزة > 0:

```
[ تصدير PDF (أدمن) ]  [ إرسال عبر الواتساب ]
```

- متعطل أثناء التوليد أو حين `donePages === 0`، مع تلميح: "اكتمل {done}/{total} صورة".
- شريط تقدم صغير تحت الأزرار أثناء التوليد: `📄 جارٍ تجهيز PDF… {done}/{total}`.

## خارج النطاق
- لا تغيير على شروط الاعتماد الخاصة بالمستخدم (`saveStoryPdf` تبقى كما هي).
- لا رفع للملف على Storage — الأدمن يحمّل النسخة محلياً ويرفعها يدوياً للواتساب.
- لا تغييرات على قواعد البيانات أو الأمان.
