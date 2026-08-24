# Kidzy Video foundation

This folder currently contains data contracts and the disabled-by-default feature flag only.
It intentionally contains no customer workflow, admin workspace, provider, worker, or payment code.

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
- Generated Supabase types must be regenerated from the applied migration. Do not add handwritten
  table shapes or permanent unsafe casts in the meantime. After Lovable applies
  `20260823000000_kidzy_video_foundation.sql`, run:

  ```bash
  supabase gen types typescript --project-id uhvzhbiqywmpvbmalyph \
    > src/integrations/supabase/types.ts
  ```
