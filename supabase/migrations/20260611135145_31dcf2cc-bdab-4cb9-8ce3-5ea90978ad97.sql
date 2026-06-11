
DO $$ BEGIN
  CREATE TYPE public.child_gender AS ENUM ('boy', 'girl');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gender public.child_gender NOT NULL DEFAULT 'boy';
