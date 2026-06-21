ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS photo_mode text NOT NULL DEFAULT 'cartoon',
  ADD COLUMN IF NOT EXISTS hero_character text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_language_check,
  ADD CONSTRAINT orders_language_check CHECK (language IN ('ar','en','bilingual'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_photo_mode_check,
  ADD CONSTRAINT orders_photo_mode_check CHECK (photo_mode IN ('real','cartoon'));