import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * بيانات صفحة الإحالة الخاصة بالمستخدم: كوده، عدد من دعاهم (بانتظار أول
 * طلب مؤكَّد)، وعدد الإحالات المكافأة فعلياً (بعد أول طلب مؤكَّد لدى المدعو).
 */
export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", context.userId)
      .single();

    const { data: referrals } = await context.supabase
      .from("referrals")
      .select("status")
      .eq("inviter_id", context.userId);

    const invitedCount = referrals?.length ?? 0;
    const rewardedCount = referrals?.filter((r) => r.status === "rewarded").length ?? 0;

    return {
      referralCode: profile?.referral_code ?? null,
      invitedCount,
      rewardedCount,
      pointsFromReferrals: rewardedCount * 100,
    };
  });

const ClaimInput = z.object({ code: z.string().trim().min(3).max(20) });

/**
 * يُستدعى تلقائياً أول مرة يظهر فيها مستخدم مسجّل دخوله ولديه كود إحالة
 * غير مُطالَب به محفوظاً محلياً (F5) — انظر ReferralCapture.
 *
 * حماية من إساءة الاستخدام: لا يُمنح المُحيل نقاطه هنا بعد الآن — الإحالة
 * تُسجَّل بحالة `pending` فقط، ولا يُمنح المُحيل الـ 100 نقطة إلا بعد أول
 * طلب مؤكَّد الدفع فعلياً للمدعو (انظر rewardReferralAfterFirstVerifiedOrder
 * التي يستدعيها adminVerifyPayment). هذا يمنع تصعيد حسابات وهمية لجمع نقاط
 * دون أي عملية شراء حقيقية.
 *
 * كوبون خصم 10% للمدعو يُصدَر فوراً هنا (لا عند أول طلب) لأنه — بعكس
 * النقاط — بلا قيمة نقدية قابلة للاستخراج بمعزل عن دفعة حقيقية موثّقة؛
 * الغرض منه أصلاً هو تحفيز أول طلب، فتأجيل إصداره لما بعد ذلك الطلب يُبطل
 * الغرض منه.
 */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClaimInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const code = data.code.trim().toUpperCase();
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!inviterProfile) throw new Error("كود الإحالة غير صحيح");
    if (inviterProfile.id === context.userId) throw new Error("لا يمكنك استخدام كودك الخاص");

    const { data: existing } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("invited_user_id", context.userId)
      .maybeSingle();
    if (existing) throw new Error("تم ربط هذا الحساب بإحالة من قبل");

    const couponCode = `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { error: couponErr } = await supabaseAdmin.from("coupons").insert({
      code: couponCode,
      discount_type: "percent",
      discount_value: 10,
      max_uses: 1,
      max_uses_per_user: 1,
      is_active: true,
    });
    if (couponErr) throw new Error("تعذر إصدار كود الخصم");

    const { error: refErr } = await supabaseAdmin.from("referrals").insert({
      inviter_id: inviterProfile.id,
      invited_user_id: context.userId,
      coupon_code: couponCode,
      status: "pending",
    });
    if (refErr) throw new Error("تعذر تسجيل الإحالة");

    return { ok: true, couponCode };
  });

/**
 * يُستدعى من adminVerifyPayment عند تأكيد دفع أي طلب. لو كان هذا المستخدم
 * مدعوّاً بإحالة لا تزال `pending`، يمنح المُحيل 100 نقطة الآن ويقفل
 * الإحالة إلى `rewarded`. آمن عند التكرار: يعتمد على
 * `UPDATE ... WHERE status = 'pending'` فلا يُمنح المُحيل أكثر من مرة حتى
 * لو تكرّر الاستدعاء أو تحقّقت عدة طلبات للمستخدم نفسه لاحقاً.
 */
export async function rewardReferralAfterFirstVerifiedOrder(invitedUserId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: referral } = await supabaseAdmin
    .from("referrals")
    .update({ status: "rewarded" })
    .eq("invited_user_id", invitedUserId)
    .eq("status", "pending")
    .select("inviter_id")
    .maybeSingle();

  if (!referral) return;

  await supabaseAdmin.rpc("award_points", {
    _user_id: referral.inviter_id,
    _points: 100,
    _type: "referral",
    _reference_id: invitedUserId,
    _note: "مكافأة إحالة صديق ناجحة (بعد أول طلب مؤكَّد)",
  });
}
