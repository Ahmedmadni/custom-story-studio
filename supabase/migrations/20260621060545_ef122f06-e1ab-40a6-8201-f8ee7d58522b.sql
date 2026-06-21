ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS published_to_library_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_template_id uuid REFERENCES public.story_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_published_template ON public.orders(published_template_id);