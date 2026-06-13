
-- 1) Game progress table
CREATE TABLE public.game_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_key text NOT NULL,
  age_group text,
  score integer NOT NULL DEFAULT 0,
  best_score integer NOT NULL DEFAULT 0,
  rounds_played integer NOT NULL DEFAULT 0,
  last_played_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_progress TO authenticated;
GRANT ALL ON public.game_progress TO service_role;

ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own progress" ON public.game_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own progress" ON public.game_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own progress" ON public.game_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own progress" ON public.game_progress
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER game_progress_updated_at
  BEFORE UPDATE ON public.game_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Harden orders INSERT policy (security finding)
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;

CREATE POLICY "Users create own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND payment_status = 'unpaid'
    AND admin_notes IS NULL
    AND payment_verified_at IS NULL
    AND payment_verified_by IS NULL
  );
