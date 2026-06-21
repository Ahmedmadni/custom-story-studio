
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS publish_consent boolean NOT NULL DEFAULT false;

ALTER TABLE public.story_templates
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES public.story_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_story_templates_source_template ON public.story_templates(source_template_id);
