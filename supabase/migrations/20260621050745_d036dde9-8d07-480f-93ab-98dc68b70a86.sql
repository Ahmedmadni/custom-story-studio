DROP POLICY "Users create own orders" ON public.orders;
CREATE POLICY "Users create own orders" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'::order_status
  AND payment_status IN ('unpaid'::payment_status, 'receipt_uploaded'::payment_status)
  AND admin_notes IS NULL
  AND payment_verified_at IS NULL
  AND payment_verified_by IS NULL
);