
-- 1) extend orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'vodafone_cash'
    CHECK (payment_provider IN ('vodafone_cash','kashier')),
  ADD COLUMN IF NOT EXISTS kashier_order_id text,
  ADD COLUMN IF NOT EXISTS kashier_transaction_id text,
  ADD COLUMN IF NOT EXISTS kashier_payload jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_kashier_order_id ON public.orders(kashier_order_id);

-- 2) payment_logs (audit trail for kashier webhooks)
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  kashier_order_id text,
  kashier_transaction_id text,
  event_type text,
  status text,
  amount numeric,
  currency text,
  signature_ok boolean NOT NULL DEFAULT false,
  raw_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_logs TO authenticated;
GRANT ALL ON public.payment_logs TO service_role;

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read payment_logs"
  ON public.payment_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_payment_logs_kashier_order ON public.payment_logs(kashier_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON public.payment_logs(created_at DESC);

-- 3) update INSERT policy to allow Kashier unpaid orders without receipt
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;

CREATE POLICY "Users create own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'::order_status
    AND payment_status IN ('unpaid'::payment_status, 'receipt_uploaded'::payment_status)
    AND admin_notes IS NULL
    AND payment_verified_at IS NULL
    AND payment_verified_by IS NULL
    AND (
      -- vodafone cash requires receipt
      (payment_provider = 'vodafone_cash' AND receipt_path IS NOT NULL)
      OR
      -- kashier creates unpaid order without receipt; webhook will verify
      (payment_provider = 'kashier' AND payment_status = 'unpaid'::payment_status AND receipt_path IS NULL)
    )
  );
