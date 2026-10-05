import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthedContext = {
  userId: string;
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" | "user" },
    ) => PromiseLike<{ data: boolean | null }>;
  };
};

async function assertAdmin(context: AuthedContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("غير مصرح لك بالوصول");
}

function normalizeOptionalDate(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("صيغة التاريخ غير صحيحة");
  return date.toISOString();
}

export const adminListCoupons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("coupons")
      .select(
        "id, code, discount_type, discount_value, category, min_order_egp, max_uses, max_uses_per_user, used_count, is_active, starts_at, expires_at, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل أكواد الخصم");
    return data ?? [];
  });

const CouponInput = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z0-9_-]+$/.test(value), "استخدم حروفاً إنجليزية وأرقاماً فقط"),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.number().positive().max(100_000),
    category: z.string().trim().max(100).nullable().optional(),
    minOrderEgp: z.number().int().min(0).max(1_000_000).nullable().optional(),
    maxUses: z.number().int().min(1).max(1_000_000).nullable().optional(),
    maxUsesPerUser: z.number().int().min(1).max(10_000),
    isActive: z.boolean(),
    startsAt: z.string().trim().max(40).nullable().optional(),
    expiresAt: z.string().trim().max(40).nullable().optional(),
  })
  .strict();

export const adminSaveCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CouponInput.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.discountType === "percent" && data.discountValue > 100) {
      throw new Error("نسبة الخصم لا يمكن أن تتجاوز 100%");
    }

    const startsAt = normalizeOptionalDate(data.startsAt);
    const expiresAt = normalizeOptionalDate(data.expiresAt);
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
      throw new Error("تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية");
    }

    const patch = {
      code: data.code,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      category: data.category?.trim() || null,
      min_order_egp: data.minOrderEgp ?? null,
      max_uses: data.maxUses ?? null,
      max_uses_per_user: data.maxUsesPerUser,
      is_active: data.isActive,
      starts_at: startsAt,
      expires_at: expiresAt,
    };

    let couponId = data.id ?? null;
    let action = "coupon_created";

    if (data.id) {
      const { data: current, error: currentError } = await supabaseAdmin
        .from("coupons")
        .select("id, used_count")
        .eq("id", data.id)
        .single();
      if (currentError || !current) throw new Error("كود الخصم غير موجود");
      if (data.maxUses != null && data.maxUses < current.used_count) {
        throw new Error("الحد الإجمالي لا يمكن أن يكون أقل من عدد الاستخدامات الحالية");
      }

      const { error } = await supabaseAdmin.from("coupons").update(patch).eq("id", data.id);
      if (error) {
        if ((error as { code?: string }).code === "23505") throw new Error("كود الخصم مستخدم بالفعل");
        throw new Error("تعذر تحديث كود الخصم");
      }
      action = "coupon_updated";
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("coupons")
        .insert(patch)
        .select("id")
        .single();
      if (error || !inserted) {
        if ((error as { code?: string } | null)?.code === "23505")
          throw new Error("كود الخصم مستخدم بالفعل");
        throw new Error("تعذر إنشاء كود الخصم");
      }
      couponId = inserted.id;
    }

    const { logAdminAction } = await import("@/lib/audit/logAdminAction.server");
    await logAdminAction({
      actorId: ctx.userId,
      action,
      targetType: "coupon",
      targetId: couponId ?? undefined,
      metadata: {
        code: data.code,
        discount_type: data.discountType,
        discount_value: data.discountValue,
        is_active: data.isActive,
      },
    });

    return { ok: true as const, id: couponId };
  });

export const adminListRewardAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const accountsPromise = supabaseAdmin
      .from("reward_accounts")
      .select("user_id, balance, lifetime_points, updated_at")
      .order("updated_at", { ascending: false });

    const users: Array<{
      id: string;
      email: string | undefined;
      created_at: string;
    }> = [];
    for (let page = 1; page <= 25; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error("تعذر تحميل المستخدمين");
      const batch = data?.users ?? [];
      users.push(
        ...batch.map((user) => ({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        })),
      );
      if (batch.length < 200) break;
    }

    const { data: accounts, error: accountsError } = await accountsPromise;
    if (accountsError) throw new Error("تعذر تحميل أرصدة المكافآت");
    const byUser = new Map((accounts ?? []).map((row) => [row.user_id, row]));

    return users
      .map((user) => {
        const account = byUser.get(user.id);
        return {
          userId: user.id,
          email: user.email ?? "—",
          balance: account?.balance ?? 0,
          lifetimePoints: account?.lifetime_points ?? 0,
          updatedAt: account?.updated_at ?? user.created_at,
        };
      })
      .sort((a, b) => b.balance - a.balance || a.email.localeCompare(b.email));
  });

const RewardAdjustmentInput = z
  .object({
    userId: z.string().uuid(),
    points: z.number().int().min(-10_000).max(10_000).refine((value) => value !== 0),
    note: z.string().trim().min(3).max(300),
  })
  .strict();

type RewardRpcClient = {
  rpc: (
    fn: "admin_adjust_reward_points",
    args: {
      _user_id: string;
      _points: number;
      _actor_id: string;
      _note: string;
    },
  ) => PromiseLike<{
    data: Array<{ new_balance: number; lifetime_points: number }> | null;
    error: { message?: string | null } | null;
  }>;
};

export const adminAdjustRewardPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RewardAdjustmentInput.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userError || !user.user) throw new Error("المستخدم غير موجود");

    const rpc = supabaseAdmin as unknown as RewardRpcClient;
    const { data: result, error } = await rpc.rpc("admin_adjust_reward_points", {
      _user_id: data.userId,
      _points: data.points,
      _actor_id: ctx.userId,
      _note: data.note,
    });
    if (error) {
      if ((error.message ?? "").includes("cannot be negative")) {
        throw new Error("لا يمكن أن يصبح رصيد النقاط سالباً");
      }
      throw new Error("تعذر تعديل رصيد المكافآت");
    }

    const row = result?.[0];
    const { logAdminAction } = await import("@/lib/audit/logAdminAction.server");
    await logAdminAction({
      actorId: ctx.userId,
      action: "reward_balance_adjusted",
      targetType: "user",
      targetId: data.userId,
      metadata: {
        points: data.points,
        note: data.note,
        new_balance: row?.new_balance ?? null,
      },
    });

    return {
      ok: true as const,
      balance: row?.new_balance ?? null,
      lifetimePoints: row?.lifetime_points ?? null,
    };
  });
