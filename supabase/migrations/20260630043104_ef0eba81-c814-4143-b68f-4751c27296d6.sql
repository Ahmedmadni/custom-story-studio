
-- 1. child_profiles
CREATE TABLE public.child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  nickname text,
  birth_date date,
  age int,
  gender text,
  photo_url text,
  avatar_url text,
  favorite_color text,
  favorite_character text,
  hobbies text[],
  personality_traits text[],
  dream_job text,
  super_power text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_profiles TO authenticated;
GRANT ALL ON public.child_profiles TO service_role;
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents manage own children" ON public.child_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all children" ON public.child_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_child_profiles_updated
  BEFORE UPDATE ON public.child_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. child_story_universe
CREATE TABLE public.child_story_universe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL UNIQUE REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  level int NOT NULL DEFAULT 1,
  experience_points int NOT NULL DEFAULT 0,
  story_count int NOT NULL DEFAULT 0,
  favorite_world text,
  favorite_companions text[],
  achievements jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_story_universe TO authenticated;
GRANT ALL ON public.child_story_universe TO service_role;
ALTER TABLE public.child_story_universe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents manage own universe" ON public.child_story_universe
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.child_profiles c WHERE c.id = child_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.child_profiles c WHERE c.id = child_id AND c.user_id = auth.uid()));
CREATE POLICY "Admins view all universes" ON public.child_story_universe
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_universe_updated
  BEFORE UPDATE ON public.child_story_universe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. reward_accounts
CREATE TABLE public.reward_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance int NOT NULL DEFAULT 0,
  lifetime_points int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reward_accounts TO authenticated;
GRANT ALL ON public.reward_accounts TO service_role;
ALTER TABLE public.reward_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rewards" ON public.reward_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own rewards" ON public.reward_accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all rewards" ON public.reward_accounts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_reward_accounts_updated
  BEFORE UPDATE ON public.reward_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. reward_transactions
CREATE TABLE public.reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points int NOT NULL,
  type text NOT NULL,
  reference_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reward_transactions TO authenticated;
GRANT ALL ON public.reward_transactions TO service_role;
ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ledger" ON public.reward_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all ledger" ON public.reward_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_reward_tx_user ON public.reward_transactions(user_id, created_at DESC);
CREATE INDEX idx_child_profiles_user ON public.child_profiles(user_id);

-- 5. Welcome bonus on signup
CREATE OR REPLACE FUNCTION public.grant_welcome_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.reward_accounts (user_id, balance, lifetime_points)
  VALUES (NEW.id, 50, 50)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.reward_transactions (user_id, points, type, note)
  VALUES (NEW.id, 50, 'signup', 'مكافأة التسجيل')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_welcome_bonus ON auth.users;
CREATE TRIGGER trg_welcome_bonus
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_welcome_bonus();

-- 6. Helper: award points (security definer for safe server use)
CREATE OR REPLACE FUNCTION public.award_points(
  _user_id uuid,
  _points int,
  _type text,
  _reference_id text DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.reward_accounts (user_id, balance, lifetime_points)
  VALUES (_user_id, GREATEST(_points,0), GREATEST(_points,0))
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.reward_accounts.balance + _points,
        lifetime_points = public.reward_accounts.lifetime_points + GREATEST(_points,0),
        updated_at = now();
  INSERT INTO public.reward_transactions (user_id, points, type, reference_id, note)
  VALUES (_user_id, _points, _type, _reference_id, _note);
END;
$$;
