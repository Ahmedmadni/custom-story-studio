-- Least-privilege hardening after live RLS/storage audit.
-- RLS is already enabled and correctly scopes row access. This migration removes
-- broad table privileges that are unnecessary for browser roles and, for some
-- commands such as TRUNCATE, are not governed by row-level policies.

-- Anonymous visitors only need published story-template reads through RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.story_templates
FROM anon;

REVOKE ALL
ON TABLE
  public.user_roles,
  public.generated_pages,
  public.child_profiles,
  public.reward_accounts,
  public.reward_transactions,
  public.game_progress,
  public.video_orders,
  public.video_projects,
  public.video_scenes,
  public.video_jobs,
  public.video_renders
FROM anon;

-- Authenticated users retain only privileges that match an existing app flow.
-- user_roles is read-only for the account owner/admin.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.user_roles
FROM authenticated;

-- Published/custom story flows need SELECT/INSERT/UPDATE/DELETE, but not DDL-style
-- privileges that are never used through the application.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.story_templates
FROM authenticated;

-- Generated pages are read by customers after order approval and otherwise
-- produced/administered by trusted server-side code.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.generated_pages
FROM authenticated;

-- Child profiles are legitimate owner-managed CRUD; only remove non-runtime
-- privileges.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.child_profiles
FROM authenticated;

-- Reward account creation is intentionally limited by RLS to an empty own
-- account. Balance mutations and ledger writes are server-owned.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.reward_accounts
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.reward_transactions
FROM authenticated;

-- Browser writes to game progress were already revoked in the prior hardening
-- migration. Remove the remaining non-runtime privileges as well.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.game_progress
FROM authenticated;

-- Kidzy Video customer mutations are server-owned. Customers may read their own
-- video_orders through RLS; all internal production tables remain admin/server
-- managed. Existing admin RLS policies remain as defense in depth.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.video_orders
FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE
  public.video_projects,
  public.video_scenes,
  public.video_jobs,
  public.video_renders
FROM authenticated;

-- Service role is intentionally untouched.
