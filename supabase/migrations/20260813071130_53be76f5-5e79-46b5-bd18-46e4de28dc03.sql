ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS orientation text NOT NULL DEFAULT 'landscape';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_orientation_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_orientation_check CHECK (orientation IN ('landscape','portrait'));