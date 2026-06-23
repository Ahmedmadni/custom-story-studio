
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gifted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS gifted_by_relation TEXT,
  ADD COLUMN IF NOT EXISTS publish_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_template_id UUID REFERENCES public.story_templates(id) ON DELETE SET NULL;

ALTER TABLE public.story_templates
  ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.story_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_gallery BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_story_templates_gallery ON public.story_templates(is_gallery) WHERE is_gallery = true;
CREATE INDEX IF NOT EXISTS idx_story_templates_source ON public.story_templates(source_template_id);
