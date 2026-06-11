
-- payment status enum
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('unpaid','receipt_uploaded','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS price_egp integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_rejection_reason text;

-- Storage policies for payment-receipts bucket
-- Owners can upload to their own folder (path = {user_id}/...)
DROP POLICY IF EXISTS "Users upload own receipts" ON storage.objects;
CREATE POLICY "Users upload own receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users read own receipts" ON storage.objects;
CREATE POLICY "Users read own receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "Admins manage receipts" ON storage.objects;
CREATE POLICY "Admins manage receipts"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'));
