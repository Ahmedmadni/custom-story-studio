ALTER TABLE public.story_templates
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'story' CHECK (content_type IN ('story','book')),
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ar' CHECK (language IN ('ar','en'));

CREATE INDEX IF NOT EXISTS idx_story_templates_content_type ON public.story_templates (content_type);