-- Referral system (Milestone 4 / F5): every user gets a shareable
-- referral_code; a successful referred signup rewards the inviter with
-- 100 points and gives the invited user a one-time 10% coupon.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS text
LANGUAGE sql
AS $$
  SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
$$;

REVOKE ALL ON FUNCTION public.gen_referral_code() FROM PUBLIC, anon, authenticated;

UPDATE public.profiles SET referral_code = public.gen_referral_code() WHERE referral_code IS NULL;

CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.gen_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_referral_code() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_referral_code ON public.profiles;
CREATE TRIGGER trg_set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_code text,
  status text NOT NULL DEFAULT 'rewarded' CHECK (status IN ('pending', 'rewarded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_not_self CHECK (inviter_id <> invited_user_id)
);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inviters view their referrals" ON public.referrals
  FOR SELECT TO authenticated USING (auth.uid() = inviter_id);
CREATE POLICY "Admins view all referrals" ON public.referrals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_referrals_inviter ON public.referrals(inviter_id);
