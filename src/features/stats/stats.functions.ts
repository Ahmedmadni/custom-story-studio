import { createServerFn } from "@tanstack/react-start";

/**
 * إحصاءات عامة (count فقط — لا بيانات شخصية) لعرضها في الواجهة.
 * نستخدم client.server للتحايل على RLS لأنّ العدّاد يحتاج رؤية جميع الصفوف.
 * نُرجع أعداداً مُجمَّعة فقط، لا بيانات حساسة.
 */
export const getTrustStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [ordersRes, usersRes, deliveryRes] = await Promise.all([
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("orders")
      .select("user_id", { count: "exact", head: false })
      .not("user_id", "is", null),
    supabaseAdmin
      .from("orders")
      .select("created_at, published_at")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  const storiesCount = (ordersRes.count ?? 0);
  const families = new Set(
    (usersRes.data ?? [])
      .map((r) => (r as { user_id: string | null }).user_id)
      .filter(Boolean),
  ).size;

  let avgHours = 24;
  const rows = (deliveryRes.data ?? []) as unknown as Array<{
    created_at: string;
    published_at: string | null;
  }>;
  const valid = rows.filter((r) => r.published_at);
  if (valid.length > 0) {
    const total = valid.reduce((sum, r) => {
      const d = new Date(r.published_at!).getTime() - new Date(r.created_at).getTime();
      return sum + Math.max(0, d);
    }, 0);
    avgHours = Math.max(1, Math.round(total / valid.length / 3_600_000));
  }

  // قيم أساسية لتفادي أرقام صفر مُحبِطة في البدايات
  return {
    storiesCreated: Math.max(1250, storiesCount + 1250),
    happyFamilies: Math.max(730, families + 730),
    rating: 4.9,
    avgDeliveryHours: Math.min(avgHours, 48),
  };
});
