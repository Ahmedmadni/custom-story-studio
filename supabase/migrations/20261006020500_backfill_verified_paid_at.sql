-- Backfill legacy verified story orders created before adminVerifyPayment
-- consistently populated paid_at. New confirmations already set paid_at at the
-- moment payment is verified; this migration only repairs historical rows.

UPDATE public.orders
SET paid_at = payment_verified_at
WHERE payment_status = 'verified'
  AND paid_at IS NULL
  AND payment_verified_at IS NOT NULL;
