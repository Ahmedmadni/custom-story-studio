import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthedContext = {
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" | "user" },
    ) => PromiseLike<{ data: boolean | null }>;
  };
  userId: string;
};

async function assertAdmin(context: AuthedContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("غير مصرح لك بالوصول");
}

const STUCK_GENERATING_HOURS = 6;
const STUCK_VIDEO_JOB_MINUTES = 30;

/**
 * لوحة صحة النظام (F10) — كلها من بيانات حقيقية في `orders`. لا يوجد نظام
 * طوابير مهام في هذا التطبيق، لذا "Failed jobs" هنا تعني طلبات علِقت في
 * حالة `generating` لأكثر من STUCK_GENERATING_HOURS ساعات — أفضل مؤشر متاح.
 * كذلك لا يوجد نظام تسجيل أخطاء مركزي، فـ"سجلات الأخطاء" بديلها هنا عدد
 * المدفوعات المرفوضة مؤخراً.
 */
export const adminGetHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const stuckBefore = new Date(now.getTime() - STUCK_GENERATING_HOURS * 3_600_000).toISOString();

    const videoJobStuckBefore = new Date(
      now.getTime() - STUCK_VIDEO_JOB_MINUTES * 60_000,
    ).toISOString();

    const [
      pendingRes,
      generatingRes,
      stuckRes,
      revenueTodayRes,
      rejectedRecentRes,
      deliveredRes,
      videoPendingPaymentRes,
      videoProcessingRes,
      videoReadyRes,
      videoFailedJobsRes,
      videoStuckJobsRes,
      videoOverdueRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "generating"),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "generating")
        .lt("updated_at", stuckBefore),
      supabaseAdmin
        .from("orders")
        .select("price_egp")
        .eq("payment_status", "verified")
        .gte("paid_at", todayStart),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "rejected")
        .gte("updated_at", new Date(now.getTime() - 7 * 24 * 3_600_000).toISOString()),
      supabaseAdmin
        .from("orders")
        .select("created_at, published_at")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("video_orders")
        .select("id", { count: "exact", head: true })
        .in("payment_status", ["unpaid", "pending"]),
      supabaseAdmin
        .from("video_projects")
        .select("id", { count: "exact", head: true })
        .in("status", ["paid", "approved", "processing"]),
      supabaseAdmin
        .from("video_projects")
        .select("id", { count: "exact", head: true })
        .eq("status", "ready"),
      supabaseAdmin
        .from("video_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["failed", "dead_letter"]),
      supabaseAdmin
        .from("video_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["queued", "running"])
        .lt("updated_at", videoJobStuckBefore),
      supabaseAdmin
        .from("video_orders")
        .select("id", { count: "exact", head: true })
        .eq("delivery_status", "pending")
        .eq("payment_status", "paid")
        .lt("expected_delivery_at", now.toISOString()),
    ]);

    const revenueToday = (revenueTodayRes.data ?? []).reduce(
      (sum, r) => sum + ((r as { price_egp?: number }).price_egp ?? 0),
      0,
    );

    let avgDeliveryHours = 24;
    const deliveryRows = (deliveredRes.data ?? []) as unknown as Array<{
      created_at: string;
      published_at: string | null;
    }>;
    const valid = deliveryRows.filter((r) => r.published_at);
    if (valid.length > 0) {
      const total = valid.reduce((sum, r) => {
        const d = new Date(r.published_at!).getTime() - new Date(r.created_at).getTime();
        return sum + Math.max(0, d);
      }, 0);
      avgDeliveryHours = Math.max(1, Math.round(total / valid.length / 3_600_000));
    }

    // مستخدمون نشطون اليوم (سجّلوا دخولاً) — عيّنة أول 600 مستخدم كحدّ أقصى، كافية لحجم هذا التطبيق
    let activeUsersToday = 0;
    for (let page = 1; page <= 3; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const users = data?.users ?? [];
      activeUsersToday += users.filter(
        (u) => u.last_sign_in_at && u.last_sign_in_at >= todayStart,
      ).length;
      if (users.length < 200) break;
    }

    const { count: totalOrders } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true });
    const { count: verifiedOrders } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "verified");
    const conversionRatePct =
      totalOrders && totalOrders > 0
        ? Math.round(((verifiedOrders ?? 0) / totalOrders) * 1000) / 10
        : 0;

    return {
      pendingOrders: pendingRes.count ?? 0,
      generatingOrders: generatingRes.count ?? 0,
      stuckOrders: stuckRes.count ?? 0,
      revenueTodayEgp: revenueToday,
      avgDeliveryHours,
      activeUsersToday,
      conversionRatePct,
      rejectedPaymentsLast7d: rejectedRecentRes.count ?? 0,
      videoPendingPayments: videoPendingPaymentRes.count ?? 0,
      videoInProduction: videoProcessingRes.count ?? 0,
      videoReadyForDelivery: videoReadyRes.count ?? 0,
      videoFailedJobs: videoFailedJobsRes.count ?? 0,
      videoStuckJobs: videoStuckJobsRes.count ?? 0,
      videoOverdueOrders: videoOverdueRes.count ?? 0,
    };
  });
