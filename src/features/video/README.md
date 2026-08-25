# Kidzy Video foundation

This folder contains the disabled-by-default customer order foundation. It intentionally contains
no admin production workspace, provider, worker, payment execution, or generation code.

## Feature flag

Set `VITE_KIDZY_VIDEO_ENABLED=true` only when a later phase adds guarded entry points. Missing,
empty, or any value other than the exact string `true` keeps the feature disabled. This is a
public availability switch, never a security boundary; server-side authorization and database RLS
remain mandatory.

## Foundation decisions

- Existing story templates are not backfilled into `template_product_offerings`. Existing story
  discovery and checkout do not read that table, so a backfill would add data without compatibility
  benefit. A later controlled rollout should add `personalized_video` offerings only for approved
  templates. `illustrated_story` rows become necessary only if story discovery is deliberately
  migrated to the offering layer in a separate phase.
- A scene keeps the selected paths on `video_scenes`; previous attempt paths can be retained in the
  immutable `video_jobs.response_meta`. This avoids an asset-version table in the foundation while
  preserving regeneration history. Add a normalized asset-version table before workflows if the
  provider adapter needs querying, retention, or approval per asset version.
- Per-row scene and render durations are capped at 60,000ms in SQL. The sum of sibling scene
  durations cannot be enforced safely with a `CHECK`; the future admin/server composition command
  must validate the aggregate in the same transaction before queueing composition/final render.
- The checked-in Supabase type artifact includes the deployed foundation schema. After Lovable
  applies a new video migration, regenerate the complete artifact from the project rather than
  introducing local casts:

  ```bash
  supabase gen types typescript --project-id uhvzhbiqywmpvbmalyph \
    > src/integrations/supabase/types.ts
  ```

- Phase 2 adds `20260824000000_create_video_order_rpc.sql`. Its service-role-only RPC performs the
  video order and linked project inserts in one database transaction. Apply that migration before
  enabling the flag, then regenerate the types again with the same command.
