# Observability

Phase 8 of the Production Hardening & Launch Preparation Sprint. Documents
what observability infrastructure exists today, what this phase adds, and
what's still a gap. Per the sprint's own instruction ("prepare
infrastructure for"), this phase adds a real, working audit-log table and
wires it into the highest-value admin actions as a working example — it
does not retrofit every admin action, matching the same "infra now, full
adoption incrementally" posture as Phase 3 (email) and Phase 4 (error
handling).

## 1. Application logs

**What exists**: `console.log`/`console.error` calls throughout server
function handlers (`*.functions.ts`), captured by Cloudflare Workers'
built-in log retention (visible via `wrangler tail` or the Cloudflare
dashboard's Workers Logs, retention depends on the Cloudflare plan). No
structured/centralized log aggregation service (e.g. Logpush to an
external sink) is configured in this repo.

**Not changed this phase**: wiring up Cloudflare Logpush (or an
alternative like Axiom/Datadog) is an infrastructure decision that
requires an external service account and billing choice — out of scope
for this repo-only sprint. **Recommendation**: if Workers Logs' default
retention window turns out to be too short for post-incident debugging,
enable Logpush before launch.

## 2. Audit logs (new this phase)

**Added**: `public.admin_action_log` table
(`supabase/migrations/20260703093000_admin_action_log.sql`) — an
append-only log of sensitive admin actions:

```sql
CREATE TABLE public.admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Design notes:

- `actor_id` uses `ON DELETE SET NULL`, not `CASCADE` — deliberately, per
  the `docs/DATABASE-AUDIT.md` finding that ledger/audit tables cascading
  away with their user erases history that matters even after the actor
  is gone. The log row survives; only the actor reference is nulled.
- RLS: admins can `SELECT` (`has_role(auth.uid(), 'admin')`); there is
  **no** `INSERT` policy for `authenticated`/`anon` — rows are written
  exclusively via `supabaseAdmin` (service_role) from server function
  handlers, the same pattern already used by `payment_logs`.
- Indexed on `(created_at DESC)` for a chronological admin-facing view,
  and `(actor_id, created_at DESC)` for "what has this admin done"
  lookups.

**Helper**: `src/lib/audit/logAdminAction.server.ts` — a small,
best-effort logging function:

```ts
await logAdminAction({
  actorId: ctx.userId,
  action: "grant_role",
  targetType: "user",
  targetId: data.userId,
  metadata: { role: data.role },
});
```

It swallows its own errors (`try/catch` + `console.error`) so a logging
failure can never block the actual admin action — the same defensive
pattern already established by `rewardReferralAfterFirstVerifiedOrder`'s
call site in Phase 2.

**Wired into** (proof-of-concept + highest-value call sites):

- `adminGrantRole` / `adminRevokeRole` (`users.functions.ts`) — privilege
  escalation is the single most security-sensitive admin action in this
  app; every grant/revoke is now logged with the affected user and role.
- `adminVerifyPayment` / `adminRejectPayment` (`admin.functions.ts`) — the
  two admin actions with direct financial consequence.

**Not wired into** (documented gap, not a bug): the other ~18 admin
server functions in `admin.functions.ts` (order status changes, template
approval/publish/delete, page regeneration, etc.) don't call
`logAdminAction` yet. Retrofitting all of them is mechanical but broad —
consistent with this sprint's "no major refactor" posture, the pattern is
now established and proven; adding a call to the remaining functions is a
small, low-risk follow-up whenever there's bandwidth, one function at a
time, with no schema changes required.

## 3. Payment logs (already existed, unchanged)

`public.payment_logs` (added `20260626113204_...sql`, Milestone 5) already
captures every Kashier webhook event (`event_type`, `status`, `amount`,
`signature_ok`, full `raw_payload`), admin-readable only, indexed on
`kashier_order_id` and `created_at DESC`. This is a solid, already-working
audit trail for the payment flow — no changes needed here.

## 4. Admin actions

Covered by §2 above (the new `admin_action_log`). Combined with the
pre-existing `payment_verified_by`/`payment_verified_at`,
`admin_approved_by`/`admin_approved_at` columns already on `orders` and
`story_templates` (a lightweight "last actor" record baked into the rows
themselves), the app now has two complementary layers: **current-state
attribution** (who last approved/verified this specific row — the
existing columns) and **historical trail** (every grant/revoke/verify/reject
event over time, even after the row's state changes again — the new
table).

## 5. Error tracking

Already built in Phase 4 (`docs/ERROR-HANDLING.md`) — `logError()` in
`src/lib/errors/errorLogger.ts` is the single seam: it always
`console.error`s a structured line, and additionally calls the existing
`reportLovableError()` client-side hook (`src/lib/lovable-error-reporting.ts`),
which forwards to `window.__lovableEvents.captureException` — Lovable's
own built-in error tracking integration, already present in this codebase
before this sprint.

**Not changed this phase**: no third-party APM/error-tracking service
(Sentry or similar) is wired in beyond what Lovable already provides
client-side. Server-side errors rely on Cloudflare Workers console logs
(§1) — there is no server-side equivalent of Lovable's client error
capture. **Recommendation**: if error volume/triage needs grow beyond what
Cloudflare's log viewer and Lovable's client tracking can practically
support, `logError()` is the one function to extend (per its own
docstring) — no call sites would need to change.

## 6. Performance metrics

**What exists**:

- `/admin/health` (`AdminHealthDashboard.tsx` + `health.functions.ts`,
  Milestone 5) — a real, working operational dashboard. It covers the original
  story-order metrics (pending/generating/stuck orders, today's revenue,
  average delivery time, active users, conversion rate, rejected payments)
  and now also reads the real Kidzy Video production tables:
  `video_orders`, `video_projects`, and `video_jobs`. The dashboard
  surfaces video payments awaiting review, projects in production, videos
  ready for delivery, failed/dead-letter jobs, queued/running jobs stuck for
  more than 30 minutes, and paid video orders that have passed their expected
  delivery time.
- Browser-side: none of the Web Vitals (LCP/CLS/INP) are currently
  measured or reported anywhere in this codebase — Phase 5's performance
  audit was based on a one-off production build inspection, not
  continuous field measurement.

**Not changed this phase**: adding real Web Vitals reporting (e.g. via
the `web-vitals` package posting to an analytics endpoint) or Cloudflare
Web Analytics (a toggle in the Cloudflare dashboard, zero code changes,
privacy-friendly, no cookies) are both reasonable low-effort additions,
but adding a new client-side script/dependency is a step beyond this
audit-and-harden phase's scope. **Recommendation**: enabling Cloudflare
Web Analytics (dashboard toggle, no code) is the lowest-risk first step
if real-user performance monitoring is wanted post-launch.

## Summary

| Area                | Status                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Application logs    | Exists (Cloudflare Workers console logs); no external aggregation — documented, not changed                                                                  |
| Audit logs          | **New**: `admin_action_log` table + `logAdminAction()` helper                                                                                                |
| Payment logs        | Already existed (`payment_logs`), unchanged, confirmed solid                                                                                                 |
| Admin actions       | **New**: wired into role grant/revoke + payment verify/reject; documented as an incremental-adoption pattern for the rest                                    |
| Error tracking      | Already built in Phase 4 (`logError`); no server-side APM added this phase                                                                                   |
| Performance metrics | `/admin/health` now covers both story orders and the real Kidzy Video queue/production state; field Web-Vitals monitoring remains a separate follow-up |

## Files changed

- `supabase/migrations/20260703093000_admin_action_log.sql` — new table + RLS + indexes.
- `src/integrations/supabase/types.ts` — added the `admin_action_log` table type (hand-written; this environment has no live database to run `supabase gen types` against — verify against the actual generated types post-launch).
- `src/lib/audit/logAdminAction.server.ts` — new logging helper.
- `src/features/admin/users.functions.ts` — `adminGrantRole`/`adminRevokeRole` now call `logAdminAction`.
- `src/features/admin/admin.functions.ts` — `adminVerifyPayment`/`adminRejectPayment` now call `logAdminAction`.
- `docs/OBSERVABILITY.md` — this document.

## Migrations created

- `20260703093000_admin_action_log.sql` — new table, additive only, no
  impact on existing data.

## Unresolved risks

- `src/integrations/supabase/types.ts`'s new `admin_action_log` entry was
  hand-written to match the migration exactly, since this environment
  can't run `supabase gen types typescript` against a live database.
  **Verify** by regenerating types for real against the live database
  once this migration is applied, and diff against what's committed here.
- The original story/admin surface still has partial audit coverage. Kidzy Video
  now logs its critical payment, storyboard reset, scene upload/approval,
  final-render/final-approval, readiness, and delivery actions to the same
  append-only `admin_action_log`.
- No external log aggregation, APM, or field performance monitoring is
  configured — everything currently relies on Cloudflare's built-in log
  viewer, Lovable's client-side error capture, and the existing
  `/admin/health` dashboard's `orders`-table-derived proxies.
