
-- Grant Data API access to public tables (was missing → every query failed silently)
GRANT SELECT ON public.story_templates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.story_templates TO authenticated;
GRANT ALL ON public.story_templates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_pages TO authenticated;
GRANT ALL ON public.generated_pages TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wizard_drafts TO authenticated;
GRANT ALL ON public.wizard_drafts TO service_role;
