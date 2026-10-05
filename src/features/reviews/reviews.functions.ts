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
type SubmitReviewRpcClient = {
  rpc: (
    fn: "submit_review_and_reward",
    args: {
      _user_id: string;
      _order_id: string;
      _rating: number;
      _body: string | null;
    },
  ) => PromiseLike<{
    data: string | null;
    error: { message?: string | null } | null;
  }>;
};

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitReviewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin as unknown as SubmitReviewRpcClient;
    const { error } = await rpc.rpc("submit_review_and_reward", {
      _user_id: context.userId,
      _order_id: data.orderId,
      _rating: data.rating,
      _body: data.body?.trim() || null,
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("review already exists")) {
        throw new Error("لقد قيّمت هذا الطلب من قبل");
      }
      if (message.includes("order is not delivered")) {
        throw new Error("يمكن التقييم بعد استلام القصة فقط");
      }
      if (
        message.includes("order not found") ||
        message.includes("does not belong to user")
      ) {
        throw new Error("الطلب غير موجود أو غير مصرح");
      }
      throw new Error("تعذر إرسال التقييم");
    }

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
      .select(
        "id, rating, body, child_age, category, is_published, created_at, orders(child_name), story_templates(title)",
      )
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
