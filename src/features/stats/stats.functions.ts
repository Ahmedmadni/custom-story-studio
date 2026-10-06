import { createServerFn } from "@tanstack/react-start";

/**
 * إحصاءات عامة (count فقط — لا بيانات شخصية) لعرضها في الواجهة.
 * نستخدم client.server للتحايل على RLS لأنّ العدّاد يحتاج رؤية جميع الصفوف.
 * نُرجع أعداداً مُجمَّعة فقط، لا بيانات حساسة.
 */
export const getTrustStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [ordersRes, usersRes, deliveryRes, reviewsRes] = await Promise.all([
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
    supabaseAdmin
      .from("reviews")
      .select("rating")
      .eq("is_published", true),
  ]);

  const storiesCount = ordersRes.count ?? 0;
  const families = new Set(
    (usersRes.data ?? []).map((r) => (r as { user_id: string | null }).user_id).filter(Boolean),
  ).size;

  let avgHours: number | null = null;
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

  const publishedRatings = (reviewsRes.data ?? [])
    .map((row) => Number((row as { rating?: number }).rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const rating =
    publishedRatings.length > 0
      ? publishedRatings.reduce((sum, value) => sum + value, 0) / publishedRatings.length
      : null;

  return {
    storiesCreated: storiesCount,
    happyFamilies: families,
    rating,
    avgDeliveryHours: avgHours == null ? null : Math.min(avgHours, 48),
  };
});

/**
 * حالة قائمة الانتظار الحالية: كم طلباً قيد المعالجة الآن، وكم قصة سُلّمت هذا
 * الأسبوع — لعرضها كإلحاح اجتماعي (F8/F10). لا بيانات شخصية.
 */
export const getQueueStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();

  const [processingRes, deliveredWeekRes] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["approved", "generating"]),
    supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("updated_at", weekAgo),
  ]);

  return {
    processingCount: Math.max(0, processingRes.count ?? 0),
    deliveredThisWeek: Math.max(0, deliveredWeekRes.count ?? 0),
  };
});

/**
 * تغذية النشاط الأخير (F9): آخر الطلبات المُسلَّمة وآخر ترقيات المستوى.
 * نعرض الاسم الأول فقط لكل طفل — لا صور، لا أرقام هواتف، لا بيانات حساسة.
 */
export const getActivityFeed = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [ordersRes, levelUpsRes] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("updated_at")
      .eq("status", "sent")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabaseAdmin
      .from("child_story_universe")
      .select("level, updated_at")
      .gt("level", 1)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  type OrderRow = {
    updated_at: string;
  };
  type LevelRow = {
    level: number;
    updated_at: string;
  };

  const fromOrders = ((ordersRes.data ?? []) as unknown as OrderRow[]).map((row) => ({
    type: "order" as const,
    text: "تم تسليم قصة جديدة لعائلة من كيدزي 📦",
    at: row.updated_at,
  }));

  const fromLevelUps = ((levelUpsRes.data ?? []) as unknown as LevelRow[]).map((row) => ({
    type: "level" as const,
    text: `بطل صغير وصل للمستوى ${row.level} 🎖️`,
    at: row.updated_at,
  }));

  return [...fromOrders, ...fromLevelUps]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);
});
