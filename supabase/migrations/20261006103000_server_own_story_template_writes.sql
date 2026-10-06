-- Keep story template mutations behind authenticated server functions.
-- SELECT remains available through existing RLS for published templates and
-- for owners/admins of legacy custom templates.

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.story_templates
FROM authenticated;
