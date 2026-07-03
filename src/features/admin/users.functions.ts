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

export type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  roles: Array<"admin" | "user">;
  ordersCount: number;
};

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const all: Array<{
      id: string;
      email: string | undefined;
      created_at: string;
      last_sign_in_at: string | null | undefined;
    }> = [];
    let page = 1;
    // page until empty
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const users = data?.users ?? [];
      all.push(
        ...users.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        })),
      );
      if (users.length < 200) break;
      page += 1;
      if (page > 25) break; // safety cap (5000)
    }

    const ids = all.map((u) => u.id);
    const [rolesRes, ordersRes] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("orders")
        .select("user_id")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const rolesByUser = new Map<string, Array<"admin" | "user">>();
    (rolesRes.data ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as "admin" | "user");
      rolesByUser.set(r.user_id, arr);
    });
    const ordersByUser = new Map<string, number>();
    (ordersRes.data ?? []).forEach((o) => {
      ordersByUser.set(o.user_id, (ordersByUser.get(o.user_id) ?? 0) + 1);
    });

    const rows: AdminUserRow[] = all.map((u) => ({
      id: u.id,
      email: u.email ?? "—",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      roles: rolesByUser.get(u.id) ?? [],
      ordersCount: ordersByUser.get(u.id) ?? 0,
    }));

    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows;
  });

const RoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "user"]),
});

export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);

    const { logAdminAction } = await import("@/lib/audit/logAdminAction.server");
    await logAdminAction({
      actorId: ctx.userId,
      action: "grant_role",
      targetType: "user",
      targetId: data.userId,
      metadata: { role: data.role },
    });

    return { ok: true };
  });

export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    if (data.role === "admin" && data.userId === ctx.userId) {
      throw new Error("لا يمكنك إزالة دور الأدمن عن نفسك");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);

    const { logAdminAction } = await import("@/lib/audit/logAdminAction.server");
    await logAdminAction({
      actorId: ctx.userId,
      action: "revoke_role",
      targetType: "user",
      targetId: data.userId,
      metadata: { role: data.role },
    });

    return { ok: true };
  });
