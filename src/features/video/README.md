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

## Phase 4A production engine

- `video_jobs` is the source of truth. Reference, script, and per-scene operations use one stable
  unique idempotency key per project/scene. Concurrent clicks reuse an active job; failed or
  completed jobs are deliberately retried on the same row up to `VIDEO_JOB_MAX_ATTEMPTS` (default 3).
- Reference images use the repository's existing direct Gemini image pattern. Structured scripts use
  the existing Lovable AI gateway. Scene clips use the existing Replicate connector asynchronously:
  submission returns quickly and the admin workspace polls Kidzy job state while short reconciliation
  calls poll Replicate. Provider/model configuration is isolated in `provider-config.server.ts`.
- Scene generation defaults to Replicate's `wan-video/wan-2.2-5b-fast`; deployments may override it
  with `VIDEO_SCENE_REPLICATE_MODEL`. The Wan request sends `image`, `prompt`, `num_frames`,
  `frames_per_second`, and a supported `aspect_ratio`. It uses 81 frames and calculates FPS as
  `clamp(round(81 / desiredSeconds), 5, 30)`. Newly generated
  storyboards prefer 3-15 second scenes; an existing 2-second scene maps to 30 FPS and produces about
  2.7 seconds because Wan cannot render 81 frames in exactly 2 seconds within its FPS limit. Kidzy
  `16:9` and `9:16` map directly to Wan. For `1:1`, Phase 4A deliberately omits `aspect_ratio` and lets
  the provider use its default framing rather than silently changing the customer's stored choice.
  `image` and `prompt` field names remain overridable for a deliberately selected alternative model.
  No model name or secret is sent to UI components.
- Provider outputs are copied into the private `video-assets` bucket and only signed previews leave
  the server. Canonical provider-hosted URLs are never persisted on projects or scenes.
- Storyboards are strict structured JSON with contiguous scenes and a maximum 60-second aggregate.
  Draft scenes reconcile deterministically by `(project_id, scene_number)`. Regeneration is rejected
  once any scene owns generated media; a later explicit rebuild workflow is required to destroy it.
- Phase 4A leaves final composition behind `FinalRenderProvider`; it does not create fake renders,
  automate delivery, or alter payment/customer status behavior. No schema migration is required.
