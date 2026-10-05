import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const legacySelfAwardInput = z
  .object({
    points: z.number(),
    type: z.string(),
    referenceId: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();

/**
 * Legacy compatibility endpoint.
 *
 * Reward amounts must never be supplied by the browser. Points are awarded only
 * from trusted, server-verified business events (signup/order/referral/etc.).
 * Keep this export temporarily so stale clients fail safely instead of turning
 * an authenticated user into a trusted reward authority.
 */
export const awardSelfPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => legacySelfAwardInput.parse(input))
  .handler(async () => {
    throw new Error("يتم منح نقاط كيدزي تلقائياً من أحداث موثوقة فقط");
  });
