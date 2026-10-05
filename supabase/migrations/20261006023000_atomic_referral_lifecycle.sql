-- Referral integrity hardening.
-- 1) Claiming a referral now creates the incentive coupon + referral row in one
--    PostgreSQL transaction.
-- 2) Rewarding the inviter now locks the pending referral, awards points, then
--    marks it rewarded. If point issuance fails, the transaction rolls back and
--    the referral remains pending for a safe retry.

CREATE OR REPLACE FUNCTION public.claim_referral_atomic(
  _invited_user_id uuid,
  _referral_code text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inviter_user_id uuid;
  generated_coupon_code text;
BEGIN
  IF _invited_user_id IS NULL OR nullif(btrim(_referral_code), '') IS NULL THEN
    RAISE EXCEPTION 'invited user and referral code are required';
  END IF;

  SELECT p.id
  INTO inviter_user_id
  FROM public.profiles p
  WHERE upper(p.referral_code) = upper(btrim(_referral_code))
  LIMIT 1;

  IF inviter_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid referral code';
  END IF;

  IF inviter_user_id = _invited_user_id THEN
    RAISE EXCEPTION 'self referral is not allowed';
  END IF;

  -- Serialize claims for this invited account using the auth.users row.
  PERFORM 1
  FROM auth.users
  WHERE id = _invited_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invited user not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.referrals r
    WHERE r.invited_user_id = _invited_user_id
  ) THEN
    RAISE EXCEPTION 'referral already claimed';
  END IF;

  LOOP
    generated_coupon_code :=
      'REF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.coupons c WHERE c.code = generated_coupon_code
    );
  END LOOP;

  INSERT INTO public.coupons (
    code,
    discount_type,
    discount_value,
    max_uses,
    max_uses_per_user,
    is_active
  )
  VALUES (
    generated_coupon_code,
    'percent',
    10,
    1,
    1,
    true
  );

  INSERT INTO public.referrals (
    inviter_id,
    invited_user_id,
    coupon_code,
    status
  )
  VALUES (
    inviter_user_id,
    _invited_user_id,
    generated_coupon_code,
    'pending'
  );

  RETURN generated_coupon_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.reward_pending_referral_after_verified_order(
  _invited_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inviter_user_id uuid;
BEGIN
  SELECT r.inviter_id
  INTO inviter_user_id
  FROM public.referrals r
  WHERE r.invited_user_id = _invited_user_id
    AND r.status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM public.award_points(
    inviter_user_id,
    100,
    'referral',
    _invited_user_id::text,
    'مكافأة إحالة صديق ناجحة (بعد أول طلب مؤكَّد)'
  );

  UPDATE public.referrals
  SET status = 'rewarded'
  WHERE invited_user_id = _invited_user_id
    AND status = 'pending';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_atomic(uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_atomic(uuid, text)
TO service_role;

REVOKE ALL ON FUNCTION public.reward_pending_referral_after_verified_order(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_pending_referral_after_verified_order(uuid)
TO service_role;
