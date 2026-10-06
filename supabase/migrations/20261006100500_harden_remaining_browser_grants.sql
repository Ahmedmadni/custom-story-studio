-- Third least-privilege pass for remaining legacy browser grants.
-- Preserve only the CRUD operations that are still intentionally performed
-- through the authenticated browser/session.

-- Sensitive operational logs: browser roles may never mutate them.
REVOKE ALL ON TABLE public.admin_action_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.admin_action_log FROM authenticated;

REVOKE ALL ON TABLE public.payment_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.payment_logs FROM authenticated;

-- Child story history is produced by trusted completion logic; parents/admins
-- only need to read it.
REVOKE ALL ON TABLE public.child_story_history FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.child_story_history FROM authenticated;

-- Favorites remain intentional owner-controlled INSERT/DELETE + SELECT.
REVOKE ALL ON TABLE public.favorites FROM anon;
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.favorites FROM authenticated;

-- Profiles still need owner SELECT/INSERT/UPDATE for account/onboarding flows.
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.profiles FROM authenticated;

-- Product offerings are public-read configuration; all writes are server/admin owned.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.template_product_offerings FROM anon, authenticated;

-- Video production tables are server-owned. Admin authorization is enforced in
-- server functions and RLS remains as defense in depth; browser roles keep only
-- SELECT where existing policies permit it.
REVOKE ALL ON TABLE
  public.video_jobs,
  public.video_projects,
  public.video_renders,
  public.video_scenes
FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE
  public.video_jobs,
  public.video_projects,
  public.video_renders,
  public.video_scenes
FROM authenticated;

-- Wizard drafts are saved/deleted by server functions; authenticated clients
-- only need to read their own draft.
REVOKE ALL ON TABLE public.wizard_drafts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.wizard_drafts FROM authenticated;

-- Existing legitimate direct-browser CRUD remains untouched on:
--   child_profiles, child_story_universe, story_templates, reward_accounts
