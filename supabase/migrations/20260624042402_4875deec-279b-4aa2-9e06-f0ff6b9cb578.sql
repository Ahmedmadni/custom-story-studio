ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS custom_brief text,
  ADD COLUMN IF NOT EXISTS is_custom_request boolean NOT NULL DEFAULT false;

ALTER TABLE public.orders ALTER COLUMN template_id DROP NOT NULL;