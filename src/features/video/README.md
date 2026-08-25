# Kidzy Video foundation

This folder contains the customer ordering foundation and the Phase 3 admin production workspace.
It intentionally contains no provider integration, worker, or media generation code.

## Availability

Kidzy Video is intentionally always enabled. `config.ts` returns `true`; there is no environment
flag. Template availability remains controlled by published `personalized_video` offerings.

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
  accepting orders, then regenerate the types again with the same command.

## Phase 3 admin production

- `/admin/videos` is a dedicated queue; `/admin/videos/$videoOrderId` is the private production
  workspace. It is intentionally separate from illustrated-story order management.
- Every video admin server function authenticates the request, verifies the `admin` role, validates
  input, and only then loads the service-role client. Private assets are represented by 15-minute
  signed URLs; raw storage paths are removed from workspace DTOs.
- Project status and production stage advances are one-way and sequential. Image, script, scene,
  quality, final-render, ready, and delivery prerequisites are checked on the server.
- Scene edits invalidate scene/quality approval and the aggregate duration may not exceed 60 seconds.
  Scene approval requires a real stored clip; readiness requires a current final render.
- `provider-boundary.ts` defines future integrations. Phase 3 neither calls providers nor creates
  fake assets; generation actions remain explicitly disabled until a later phase.
- The existing schema is sufficient for Phase 3. No migration or generated-type change is needed.
