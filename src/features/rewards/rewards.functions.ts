import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Award points to the authenticated user via the SECURITY DEFINER RPC. */
export const awardSelfPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { points: number; type: string; referenceId?: string; note?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("award_points", {
      _user_id: context.userId,
      _points: data.points,
      _type: data.type,
      _reference_id: data.referenceId ?? null,
      _note: data.note ?? null,
    });
    if (error) throw error;
    return { ok: true as const };
  });
