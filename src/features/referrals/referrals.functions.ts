import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** بيانات صفحة الإحالة الخاصة بالمستخدم: كوده، وعدد من دعاهم بنجاح. */
export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", context.userId)
      .single();

    const { count } = await context.supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("inviter_id", context.userId);

    return {
      referralCode: profile?.referral_code ?? null,
      invitedCount: count ?? 0,
      pointsFromReferrals: (count ?? 0) * 100,
    };
  });

const ClaimInput = z.object({ code: z.string().trim().min(3).max(20) });

/**
 * يُستدعى تلقائياً أول مرة يظهر فيها مستخدم مسجّل دخوله ولديه كود إحالة
 * غير مُطالَب به محفوظاً محلياً (F5) — انظر ReferralCapture. يمنح المُحيل
 * 100 نقطة فوراً عبر award_points، ويصدر كوبون خصم 10% لمرة واحدة للمدعو.
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
      status: "rewarded",
    });
    if (refErr) throw new Error("تعذر تسجيل الإحالة");

    await supabaseAdmin.rpc("award_points", {
      _user_id: inviterProfile.id,
      _points: 100,
      _type: "referral",
      _reference_id: context.userId,
      _note: "مكافأة إحالة صديق ناجحة",
    });

    return { ok: true, couponCode };
  });
