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

type AtomicReferralRpcClient = {
  rpc: (
    fn: "claim_referral_atomic" | "reward_pending_referral_after_verified_order",
    args: Record<string, unknown>,
  ) => PromiseLike<{
    data: unknown;
    error: { code?: string | null; message?: string | null } | null;
  }>;
};

function referralRpcErrorMessage(message?: string | null) {
  const text = message ?? "";
  if (text.includes("invalid referral code")) return "كود الإحالة غير صحيح";
  if (text.includes("self referral")) return "لا يمكنك استخدام كودك الخاص";
  if (text.includes("already claimed")) return "تم ربط هذا الحساب بإحالة من قبل";
  if (text.includes("invited user not found")) return "الحساب غير موجود";
  return "تعذر تسجيل الإحالة";
}

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
    const rpc = supabaseAdmin as unknown as AtomicReferralRpcClient;
    const { data: couponCode, error } = await rpc.rpc("claim_referral_atomic", {
      _invited_user_id: context.userId,
      _referral_code: data.code.trim().toUpperCase(),
    });

    if (error || typeof couponCode !== "string" || !couponCode) {
      throw new Error(referralRpcErrorMessage(error?.message));
    }

    return { ok: true, couponCode };
  });

/**
 * يُستدعى من adminVerifyPayment عند تأكيد دفع أي طلب. التنفيذ الفعلي أصبح
 * داخل PostgreSQL: تُقفل الإحالة pending، ثم تُمنح النقاط، وبعد نجاح المنح
 * فقط تتحول إلى rewarded. أي فشل يعيد المعاملة بالكامل ويُبقيها قابلة لإعادة
 * المحاولة بدون فقد أو تكرار للنقاط.
 */
export async function rewardReferralAfterFirstVerifiedOrder(invitedUserId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin as unknown as AtomicReferralRpcClient;
  const { error } = await rpc.rpc("reward_pending_referral_after_verified_order", {
    _invited_user_id: invitedUserId,
  });
  if (error) throw new Error("تعذر إكمال مكافأة الإحالة");
}
