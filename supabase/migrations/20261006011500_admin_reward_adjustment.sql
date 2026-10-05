-- Safe admin reward-balance adjustment.
-- The application checks admin role before calling this RPC and the function is
-- executable by service_role only. Row locking prevents concurrent adjustments
-- from allowing a negative balance.

CREATE OR REPLACE FUNCTION public.admin_adjust_reward_points(
  _user_id uuid,
  _points integer,
  _actor_id uuid,
  _note text
)
RETURNS TABLE (
  new_balance integer,
  lifetime_points integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account public.reward_accounts%ROWTYPE;
  next_balance integer;
BEGIN
  IF _user_id IS NULL OR _actor_id IS NULL THEN
    RAISE EXCEPTION 'user and actor are required';
  END IF;

  IF _points = 0 OR _points < -10000 OR _points > 10000 THEN
    RAISE EXCEPTION 'adjustment must be between -10000 and 10000 and not zero';
  END IF;

  INSERT INTO public.reward_accounts (user_id, balance, lifetime_points)
  VALUES (_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO account
  FROM public.reward_accounts
  WHERE user_id = _user_id
  FOR UPDATE;

  next_balance := account.balance + _points;
  IF next_balance < 0 THEN
    RAISE EXCEPTION 'reward balance cannot be negative';
  END IF;

  UPDATE public.reward_accounts AS ra
  SET
    balance = next_balance,
    lifetime_points = ra.lifetime_points + GREATEST(_points, 0),
    updated_at = now()
  WHERE ra.user_id = _user_id
  RETURNING ra.balance, ra.lifetime_points
  INTO new_balance, lifetime_points;

  INSERT INTO public.reward_transactions (
    user_id,
    points,
    type,
    reference_id,
    note
  )
  VALUES (
    _user_id,
    _points,
    'admin_adjustment',
    _actor_id::text,
    NULLIF(btrim(_note), '')
  );

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_reward_points(uuid, integer, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_adjust_reward_points(uuid, integer, uuid, text)
TO service_role;
