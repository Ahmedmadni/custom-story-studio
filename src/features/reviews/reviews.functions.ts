import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

const SubmitReviewInput = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1000).nullable().optional(),
});

/**
 * تقييم الأهالي (F4) — يُقفل بالطلب: طلب واحد = تقييم واحد، ولا يُتاح إلا
 * لصاحب الطلب بعد وصول القصة (status='sent'). يمنح 30 نقطة مكافأة عبر
 * award_points (نفس الوعد الوارد في خطة النقاط بالميلستون 2).
 */
export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitReviewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status, child_age, template_id, story_templates!template_id(category)")
      .eq("id", data.orderId)
      .single();
    if (orderErr || !order) throw new Error("الطلب غير موجود");
    if (order.user_id !== context.userId) throw new Error("غير مصرح");
    if (order.status !== "sent") throw new Error("يمكن التقييم بعد استلام القصة فقط");

    const { error } = await supabaseAdmin.from("reviews").insert({
      user_id: context.userId,
      order_id: data.orderId,
      template_id: order.template_id,
      rating: data.rating,
      body: data.body?.trim() || null,
      child_age: order.child_age,
      category: (order.story_templates as { category?: string } | null)?.category ?? null,
    });
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new Error("لقد قيّمت هذا الطلب من قبل");
      }
      throw new Error("تعذر إرسال التقييم");
    }

    await supabaseAdmin.rpc("award_points", {
      _user_id: context.userId,
      _points: 30,
      _type: "review_submitted",
      _reference_id: data.orderId,
      _note: "مكافأة كتابة تقييم",
    });

    return { ok: true };
  });

/** الأدمن: كل التقييمات (منشورة وغير منشورة) للمراجعة */
export const adminListReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reviews")
      .select("id, rating, body, child_age, category, is_published, created_at, orders(child_name), story_templates(title)")
      .order("created_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل التقييمات");
    return (data ?? []).map((r) => ({
      id: r.id as string,
      rating: r.rating as number,
      body: r.body as string | null,
      childAge: r.child_age as number | null,
      category: r.category as string | null,
      isPublished: Boolean(r.is_published),
      createdAt: r.created_at as string,
      childName: (r.orders as { child_name?: string } | null)?.child_name ?? null,
      storyTitle: (r.story_templates as { title?: string } | null)?.title ?? null,
    }));
  });

const ModerateInput = z.object({
  reviewId: z.string().uuid(),
  action: z.enum(["approve", "reject", "delete"]),
});

export const adminModerateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ModerateInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.action === "delete") {
      const { error } = await supabaseAdmin.from("reviews").delete().eq("id", data.reviewId);
      if (error) throw new Error("تعذر حذف التقييم");
      return { ok: true };
    }

    const { error } = await supabaseAdmin
      .from("reviews")
      .update({ is_published: data.action === "approve" })
      .eq("id", data.reviewId);
    if (error) throw new Error("تعذر تحديث التقييم");
    return { ok: true };
  });
