-- Phase 8 (Observability): append-only audit log for admin actions
-- (role grants/revokes, payment verification/rejection today; more
-- call sites can log into this incrementally without a schema change).
-- actor_id uses ON DELETE SET NULL (not CASCADE) so the log survives an
-- admin account being removed later — see docs/DATABASE-AUDIT.md's
-- finding about ledger tables cascading away audit history.
CREATE TABLE public.admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_action_log TO authenticated;
GRANT ALL ON public.admin_action_log TO service_role;

ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read action log" ON public.admin_action_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT policy for authenticated/anon: rows are written exclusively
-- via supabaseAdmin (service_role) from server function handlers, same
-- pattern as public.payment_logs.

CREATE INDEX idx_admin_action_log_created ON public.admin_action_log (created_at DESC);
CREATE INDEX idx_admin_action_log_actor ON public.admin_action_log (actor_id, created_at DESC);
