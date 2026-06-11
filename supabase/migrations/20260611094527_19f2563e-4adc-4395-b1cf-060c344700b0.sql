ALTER TABLE public.story_templates ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ;
ALTER TABLE public.story_templates ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_story_templates_admin_approved_at ON public.story_templates(admin_approved_at);