-- Atomic coupon consumption for checkout.
-- Serializes concurrent uses of the same coupon so max_uses and per-user limits
-- cannot be bypassed by racing multiple checkout requests.

CREATE OR REPLACE FUNCTION public.consume_coupon_redemption(
  _coupon_id uuid,
  _user_id uuid,
  _order_id uuid,
  _discount_egp integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons%ROWTYPE;
  user_uses integer;
BEGIN
  IF _coupon_id IS NULL OR _user_id IS NULL OR _order_id IS NULL THEN
    RAISE EXCEPTION 'coupon redemption identifiers are required';
  END IF;

  IF _discount_egp IS NULL OR _discount_egp <= 0 THEN
    RAISE EXCEPTION 'coupon discount must be positive';
  END IF;

  -- Lock the coupon row. Every redemption for this coupon is serialized behind
  -- this lock, making used_count and per-user checks race-safe.
  SELECT *
  INTO c
  FROM public.coupons
  WHERE id = _coupon_id
  FOR UPDATE;

  IF NOT FOUND OR NOT c.is_active THEN
    RAISE EXCEPTION 'coupon is not active';
  END IF;

  IF c.starts_at IS NOT NULL AND now() < c.starts_at THEN
    RAISE EXCEPTION 'coupon has not started';
  END IF;

  IF c.expires_at IS NOT NULL AND now() > c.expires_at THEN
    RAISE EXCEPTION 'coupon has expired';
  END IF;

  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN
    RAISE EXCEPTION 'coupon global use limit reached';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = _order_id
      AND o.user_id = _user_id
      AND upper(coalesce(o.coupon_code, '')) = upper(c.code)
  ) THEN
    RAISE EXCEPTION 'coupon order does not belong to user or code does not match';
  END IF;

  -- Idempotency for an already-recorded checkout order.
  IF EXISTS (
    SELECT 1
    FROM public.coupon_redemptions r
    WHERE r.coupon_id = _coupon_id
      AND r.user_id = _user_id
      AND r.order_id = _order_id
  ) THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
  INTO user_uses
  FROM public.coupon_redemptions r
  WHERE r.coupon_id = _coupon_id
    AND r.user_id = _user_id;

  IF user_uses >= c.max_uses_per_user THEN
    RAISE EXCEPTION 'coupon per-user use limit reached';
  END IF;

  INSERT INTO public.coupon_redemptions (
    coupon_id,
    user_id,
    order_id,
    discount_egp
  )
  VALUES (
    _coupon_id,
    _user_id,
    _order_id,
    _discount_egp
  );

  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE id = _coupon_id;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_coupon_redemption(uuid, uuid, uuid, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_coupon_redemption(uuid, uuid, uuid, integer)
TO service_role;
