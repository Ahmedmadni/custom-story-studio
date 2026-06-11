
-- Expand language values
ALTER TABLE public.story_templates
  DROP CONSTRAINT IF EXISTS story_templates_language_check;
ALTER TABLE public.story_templates
  ADD CONSTRAINT story_templates_language_check
  CHECK (language = ANY (ARRAY['ar'::text, 'en'::text, 'bilingual'::text]));

-- Approval gate + structured book meta
ALTER TABLE public.story_templates
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS book_meta jsonb;

-- Wizard drafts (one row per user)
CREATE TABLE IF NOT EXISTS public.wizard_drafts (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wizard_drafts TO authenticated;
GRANT ALL ON public.wizard_drafts TO service_role;

ALTER TABLE public.wizard_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own draft"
  ON public.wizard_drafts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_wizard_drafts_updated_at
  BEFORE UPDATE ON public.wizard_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
