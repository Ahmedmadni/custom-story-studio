ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pages_count integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS print_copy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_address text;