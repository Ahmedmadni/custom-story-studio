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

type OrderRow = {
  user_id: string;
  price_egp: number;
  payment_status: string;
  created_at: string;
  template_id: string | null;
  story_templates: { title: string | null; category: string | null } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * تحليلات الأدمن (F11) — كل الحسابات تُجرى في الخادم على بيانات `orders`
 * الحقيقية. لا يوجد تتبّع زوار في هذا التطبيق، لذا "معدّل التحويل" هنا
 * يعني نسبة الطلبات التي أُكِّد دفعها من إجمالي الطلبات المُنشأة (وليس
 * زوار → طلبات، لعدم توفر بيانات جلسات).
 */
export const adminGetAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count: totalOrders } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true });

    const { data: rows } = await supabaseAdmin
      .from("orders")
      .select(
        "user_id, price_egp, payment_status, created_at, template_id, story_templates!template_id(title, category)",
      )
      .eq("payment_status", "verified");

    const verified = (rows ?? []) as unknown as OrderRow[];

    const revenue = verified.reduce((sum, o) => sum + (o.price_egp ?? 0), 0);
    const aov = verified.length > 0 ? Math.round(revenue / verified.length) : 0;
    const conversionRatePct =
      totalOrders && totalOrders > 0 ? Math.round((verified.length / totalOrders) * 1000) / 10 : 0;

    // Repeat purchase rate: % من العملاء الذين لديهم أكثر من طلب مؤكد واحد
    const ordersByUser = new Map<string, number>();
    for (const o of verified) {
      ordersByUser.set(o.user_id, (ordersByUser.get(o.user_id) ?? 0) + 1);
    }
    const distinctUsers = ordersByUser.size;
    const repeatUsers = Array.from(ordersByUser.values()).filter((n) => n >= 2).length;
    const repeatPurchaseRatePct =
      distinctUsers > 0 ? Math.round((repeatUsers / distinctUsers) * 1000) / 10 : 0;

    // أهم التصنيفات وأكثر القوالب ربحية
    const byCategory = new Map<string, { count: number; revenue: number }>();
    const byTemplate = new Map<string, { title: string; count: number; revenue: number }>();
    for (const o of verified) {
      const category = o.story_templates?.category ?? "غير مصنّف";
      const cat = byCategory.get(category) ?? { count: 0, revenue: 0 };
      cat.count += 1;
      cat.revenue += o.price_egp ?? 0;
      byCategory.set(category, cat);

      if (o.template_id) {
        const tpl = byTemplate.get(o.template_id) ?? {
          title: o.story_templates?.title ?? "قصة محذوفة",
          count: 0,
          revenue: 0,
        };
        tpl.count += 1;
        tpl.revenue += o.price_egp ?? 0;
        byTemplate.set(o.template_id, tpl);
      }
    }
    const topCategories = Array.from(byCategory.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    const topTemplates = Array.from(byTemplate.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // معدّل الاحتفاظ الشهري: من كان نشطاً في نافذة 30-60 يوماً، كم بالمئة عاد خلال آخر 30 يوماً؟
    const now = Date.now();
    const usersLast30 = new Set<string>();
    const usersPrev30to60 = new Set<string>();
    for (const o of verified) {
      const age = now - new Date(o.created_at).getTime();
      if (age <= 30 * DAY_MS) usersLast30.add(o.user_id);
      else if (age <= 60 * DAY_MS) usersPrev30to60.add(o.user_id);
    }
    let retained = 0;
    for (const u of usersPrev30to60) if (usersLast30.has(u)) retained += 1;
    const retentionRatePct =
      usersPrev30to60.size > 0 ? Math.round((retained / usersPrev30to60.size) * 1000) / 10 : 0;

    return {
      totalOrders: totalOrders ?? 0,
      verifiedOrders: verified.length,
      revenueEgp: revenue,
      averageOrderValueEgp: aov,
      conversionRatePct,
      repeatPurchaseRatePct,
      retentionRatePct,
      topCategories,
      topTemplates,
    };
  });
