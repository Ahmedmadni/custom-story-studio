# بنية البريد الإلكتروني — كيدزي

**الحالة: البنية جاهزة وربط Kidzy Video تم فعلياً.** مزوّد البريد يظل آمناً
افتراضياً لأن `EMAIL_PROVIDER=mock` هو الوضع الافتراضي، لكن دورة Kidzy Video
تستدعي الآن مزوّد البريد في الأحداث المهمة. الإرسال الحقيقي لا يحدث إلا عند اختيار
`resend` وضبط مفاتيح الإنتاج عمداً.

## التفعيل الفعلي

البنية تدعم Resend فعلياً عبر REST، وتستخدم Mock Provider افتراضياً حتى لا يخرج أي بريد
حقيقي بالخطأ. تم ربط Kidzy Video بالأحداث الآتية: استلام الطلب، اعتماد التحويل، رفض
الإيصال وطلب بديل، وتسليم الفيديو. فشل البريد best-effort ولا يُفشل الطلب أو الدفع أو
التسليم. ما يزال ربط أحداث القصص والمكافآت بالبريد عملاً مستقلاً لاحقاً.

## البنية

```
src/features/notifications/
├── emailTemplates.ts              # المحتوى (من Milestone 5) — subject + html لكل حدث
└── providers/
    ├── types.ts                   # EmailProvider, EmailMessage, EmailSendResult
    ├── mockProvider.ts             # يسجّل فقط، لا إرسال حقيقي أبداً — لا أسرار
    ├── resendProvider.server.ts    # REST API عبر fetch مباشرة، بلا SDK إضافي
    ├── smtpProvider.server.ts      # هيكل فقط — يحتاج مكتبة (nodemailer) لإكماله
    └── index.server.ts             # getEmailProvider() — يختار المزوّد من env
```

### واجهة `EmailProvider`
```ts
interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
type EmailMessage = { to: string; subject: string; html: string; text?: string; replyTo?: string };
type EmailSendResult =
  | { ok: true; id?: string; provider: string }
  | { ok: false; error: string; provider: string };
```

كل مزوّد جديد (مستقبلاً: Postmark، AWS SES، إلخ) يُضاف بتطبيق نفس الواجهة في ملف
`xProvider.server.ts` وإضافة حالة له في `getEmailProvider()` — لا حاجة لتغيير أي كود
مستهلك (templates أو نقاط الاستدعاء المستقبلية).

### اختيار المزوّد
`getEmailProvider()` يقرأ `EMAIL_PROVIDER` من env (`resend` | `smtp` | `mock`).
**الافتراضي دائماً `mock`** حتى لو المتغيّر غير مضبوط — لمنع إرسال بريد حقيقي بالخطأ قبل
تفعيل النظام عمداً بقرار صريح.

| القيمة | الحالة |
|---|---|
| (غير مضبوطة) أو `mock` | يسجّل في الكونسول فقط، لا إرسال، آمن دائماً |
| `resend` | يعمل فعلياً بمجرد ضبط `RESEND_API_KEY` (و`EMAIL_FROM` اختياري) |
| `smtp` | **غير مكتمل عمداً** — يُرجع خطأ واضحاً حتى لو ضُبطت متغيرات `SMTP_*` |

## القوالب (من Milestone 5 — لم تُعدَّل)
`src/features/notifications/emailTemplates.ts` يحتوي دالة لكل من الأحداث التسعة
المطلوبة، كل واحدة تُرجع `{ subject, html }`:

| الحدث | الدالة |
|---|---|
| ترحيب | `welcomeEmail({ displayName })` |
| استلام الطلب | `orderReceivedEmail({ childName, storyTitle })` |
| تأكيد الدفع | `paymentConfirmedEmail({ childName, storyTitle })` |
| بدء القصة | `storyStartedEmail({ childName, storyTitle })` |
| اكتمال القصة | `storyCompletedEmail({ childName, storyTitle, pdfUrl? })` |
| فتح إنجاز | `achievementUnlockedEmail({ childName, achievementTitle, achievementEmoji })` |
| ترقية مستوى | `levelUpEmail({ childName, level, levelLabel, levelEmoji })` |
| مكافأة إحالة | `referralBonusEmail({ points })` |
| كسب نقاط | `rewardEarnedEmail({ points, reason })` |

## مثال الربط

```ts
// داخل أي server function مناسبة، مثال: بعد adminVerifyPayment
const { getEmailProvider } = await import("@/features/notifications/providers/index.server");
const { paymentConfirmedEmail } = await import("@/features/notifications/emailTemplates");

const provider = getEmailProvider();
const { subject, html } = paymentConfirmedEmail({ childName, storyTitle });
const result = await provider.send({ to: userEmail, subject, html });
if (!result.ok) console.error(`email send failed via ${result.provider}:`, result.error);
```

نقاط الربط الطبيعية لكل حدث (حين يُقرَّر التفعيل):
- **ترحيب**: مشغّل `handle_new_user` (خارج نطاق ملفات الهجرة — غير مرئي في الكود، راجع
  docs/SECURITY-AUDIT.md) أو `claimReferral`/أول تسجيل دخول.
- **استلام الطلب / تأكيد الدفع**: `submitCheckout` و`adminVerifyPayment` في
  `checkout.functions.ts` / `admin.functions.ts`.
- **بدء/اكتمال القصة**: `adminGeneratePage` (أول صفحة / آخر صفحة) في `admin.functions.ts`.
- **فتح إنجاز / ترقية مستوى**: دالة `complete_story_for_child` (SQL) — تحتاج استدعاء
  HTTP خارجي من دالة قاعدة بيانات (Supabase Edge Function أو webhook) لأن Postgres لا
  يستطيع استدعاء fetch مباشرة؛ أو انقل منطق "هل ترقّى المستوى؟" لطبقة التطبيق بدل الزناد.
- **مكافأة إحالة**: `rewardReferralAfterFirstVerifiedOrder` (Phase 2 من هذه الجولة).
- **كسب نقاط**: `award_points` تُستدعى من عدة أماكن (`reviews.functions.ts`,
  `rewards.functions.ts`, `referrals.functions.ts`) — يُفضَّل إضافة استدعاء بريد بعد كل
  استدعاء `award_points` ناجح بدل تكراره، أو تغليف `award_points` بدالة تطبيق واحدة.

## ما يلزم قبل التفعيل الفعلي
1. اختيار مزوّد فعلي (Resend مُوصى به — جاهز فعلياً هنا، الأبسط للربط عبر fetch).
2. ضبط `RESEND_API_KEY` و`EMAIL_FROM` كـ secrets في بيئة الإنتاج (Cloudflare/Lovable) —
   **ليس** في `.env` المُتتبَّع بـ git.
3. إضافة عمود بريد فعلي يمكن الاعتماد عليه — تحقّق أن `auth.users.email` (متاح عبر
   Supabase Auth) يكفي، أو أضف تفضيل "استلام بريد" لكل مستخدم.
4. اختبار فعلي في بيئة تشغيل حقيقية (غير متاح في صندوق هذه الجلسة) قبل ربط أي حدث حقيقي.
5. مراقبة معدّل الفشل (`EmailSendResult.ok === false`) — راجع docs/OBSERVABILITY.md.


## Kidzy Video — الربط الحالي

- `submitVideoOrder`: رسالة استلام طلب الفيديو.
- `approveVideoPaymentAndPrepareScenes`: رسالة اعتماد التحويل وبدء الإنتاج.
- `updateVideoPaymentStatus`: رسائل اعتماد/رفض التحويل لمسارات الإدارة والطلبات القديمة.
- `markVideoDelivered`: رسالة أن الفيديو أصبح متاحاً للمشاهدة.
- كل الرسائل تربط العميل بصفحة `/my-videos` فقط؛ لا تُرسل روابط تخزين موقعة داخل البريد.
- القيم القادمة من المستخدم (اسم الطفل/القصة/سبب الرفض) تُفلتر قبل إدخالها في HTML.
- `src/features/video/video-notifications.server.ts` يستخرج بريد صاحب الحساب من Supabase Auth
  ثم يستخدم `getEmailProvider()` بشكل best-effort.
