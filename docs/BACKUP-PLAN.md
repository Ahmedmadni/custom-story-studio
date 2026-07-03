# Backup & Disaster Recovery Plan

Phase 7 of the Production Hardening & Launch Preparation Sprint. This is a
documentation-only phase — no code or migrations were changed. It documents
what backup/recovery capability already exists in this stack (Supabase +
Cloudflare), what's missing, and the concrete steps to take before and
during an incident.

## What this app actually depends on (recovery surface)

| Component                                              | Where it lives                                                                                                  | Backed up by                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Postgres schema + data                                 | Supabase-managed Postgres (project `uhvzhbiqywmpvbmalyph`)                                                      | Supabase platform backups (tier-dependent — see §1)              |
| File storage (photos, receipts, generated pages, PDFs) | Supabase Storage buckets: `child-photos`, `payment-receipts`, `reference-children`, `story-pages`, `story-pdfs` | **Not** covered by Postgres backups — separate concern, see §1.3 |
| Application code                                       | This git repo, branch-deployed                                                                                  | GitHub (this is the backup)                                      |
| Schema migration history                               | `supabase/migrations/*.sql`, 35 tracked files as of this phase                                                  | Same git repo                                                    |
| Runtime deploy target                                  | Cloudflare Workers (via `nitro`/`vite build`, no `wrangler.toml` checked in — generated at build time)          | Re-buildable from source; secrets are the actual risk (see §4)   |
| Auth users                                             | `auth.users` (Supabase Auth)                                                                                    | Covered by the same Postgres backups as §1                       |
| Payment webhook audit trail                            | `payment_logs` table                                                                                            | Covered by Postgres backups                                      |

## 1. Backup strategy

### 1.1 Database (Postgres)

Supabase provides platform-level backups whose scope depends on the
project's plan tier:

- **Free/Pro tier (daily backups)**: automatic daily snapshots, retained
  for a limited window (7 days on Pro at time of writing). Point-in-time
  recovery (PITR) is **not** included.
- **Pro tier + PITR add-on / Team+ tier**: continuous WAL archiving,
  enabling restore to any point within the retention window (down to the
  minute), not just the last daily snapshot.

**This audit cannot determine from the repo which tier/add-on is active**
— that's a Supabase dashboard/billing setting, not something checked into
version control. **Action required before launch**: confirm in the
Supabase dashboard (Project Settings → Backups) whether PITR is enabled.
Given this app processes real payments (Kashier) and stores children's
photos, daily-snapshot-only backup means **up to 24 hours of data loss**
in a worst case (e.g. an accidental `DELETE`/bad migration right after the
last nightly snapshot) — recommend enabling PITR before public launch if
not already active.

### 1.2 Schema (migrations)

The 35 files in `supabase/migrations/*.sql` are the schema's version
history and are backed up the same way the rest of the repo is (git, on
GitHub). **Caveat, already flagged in `docs/SECURITY-AUDIT.md` and
`docs/DATABASE-AUDIT.md`**: `profiles`, `orders`, `user_roles`,
`story_templates`, and `generated_pages` were created before migration
tracking began — their original `CREATE TABLE` statements (including
whatever indexes/RLS policies shipped with them) exist **only** in the
live database, not in this repo. This means: if the live database were
lost entirely and only this git repo survived, the schema **could not be
fully reconstructed** from migrations alone — those five tables' base
definitions would need to be pulled from a Supabase backup or the
dashboard's schema/RLS UI first.

**Recommendation**: run `supabase db dump --schema public -f schema_baseline.sql`
(or equivalent via the Supabase dashboard's SQL editor exporting
`pg_dump --schema-only`) at least once and store the output outside the
live database (e.g. committed to the repo or an internal wiki) as a
point-in-time full-schema snapshot, so the "predates migration history"
gap has at least one recovery anchor. Not done in this phase — it
requires a live database connection this environment doesn't have.

### 1.3 File storage (the actual gap)

**Supabase Storage buckets are not covered by Postgres database
backups/PITR** — they're a separate object-storage layer. If Supabase's
platform backup is Postgres-only (the common case), the following are
**not backed up by default**:

- `child-photos` — parent-uploaded reference photos (owner-scoped, RLS-protected).
- `payment-receipts` — Vodafone Cash payment receipt uploads.
- `reference-children` — additional child reference images.
- `story-pages` — AI-generated story page images (regeneratable, but at
  real AI-generation cost if lost).
- `story-pdfs` — final delivered PDFs (regeneratable client-side from
  `generated_pages` + `storyPdf.ts` as long as the source images in
  `story-pages` still exist).

**Action required**: confirm with Supabase whether Storage is included in
the project's backup plan (varies by tier). If not, the practical mitigation
given this app's architecture is that **most storage content is
regeneratable from Postgres data** (page images can be re-run through the
AI generation pipeline from `generated_pages` rows if the underlying
prompt/order data survives; PDFs can be regenerated client-side from page
images). The **non-regeneratable** content is `child-photos`,
`reference-children`, and `payment-receipts` — original user uploads with
no source-of-truth elsewhere. These are the highest-priority buckets for
an explicit backup policy (e.g. a scheduled `rclone`/S3-compatible sync
job to a secondary bucket, since Supabase Storage exposes an S3-compatible
API) if the platform's own backup doesn't already cover them.

## 2. Restore strategy

### 2.1 Database restore (Supabase-managed)

1. From the Supabase dashboard: **Project Settings → Backups → Restore**.
   Pick either the latest daily snapshot or (if PITR is enabled) a
   specific timestamp.
2. Supabase restores to a new project or in-place, depending on the
   restore type offered by the current plan — **verify this behavior
   ahead of time** (some restore paths create a new project URL, which
   would require updating `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in
   the Cloudflare Workers environment — see §4).
3. After restore, run `supabase migration list` (or compare against
   `supabase/migrations/*.sql` in this repo) to confirm the restored
   database's migration state matches what the app code expects. If the
   restore point predates a migration in this repo, that migration must
   be re-applied post-restore.
4. Smoke-test against `docs/QA-CHECKLIST.md`'s auth/order/admin/PDF flows
   before reopening the site to traffic.

### 2.2 Storage restore

If a secondary backup/sync exists (§1.3), restore is a reverse sync back
into the bucket. If no secondary backup exists and Supabase's own backup
doesn't include Storage, **lost original uploads (`child-photos`,
`reference-children`, `payment-receipts`) cannot be recovered** — this is
the single largest actual disaster-recovery gap in this stack and is
worth resolving before scaling up, even though this phase's docs-only
scope doesn't implement the sync job itself.

### 2.3 Code/deploy restore

Since the Cloudflare deploy target has no checked-in `wrangler.toml` (it's
generated by `nitro`/`@lovable.dev/vite-tanstack-config` at build time),
restoring the running app is: `git checkout <last-known-good-commit>` →
`bun install` → `bun run build` → `npx nitro deploy --prebuilt` (or
whatever the project's actual deploy trigger is — this repo doesn't
contain a CI/CD workflow file, so deploys are presumably manual or
triggered from the Lovable/Cloudflare dashboard directly; **confirm the
actual deploy mechanism before launch**, since this document can only
observe what's in the repo).

## 3. Migration rollback strategy

**Current state**: all 35 migrations in `supabase/migrations/` are
forward-only — there are no paired "down" migrations anywhere in this
repo, which is normal for Supabase's migration tooling (it doesn't
generate down-migrations by convention) but means rollback is a manual,
case-by-case exercise, not an automated `migrate down`.

Observed patterns that make most of this history low-risk to reason about:

- Nearly every migration uses `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF
NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, or `CREATE POLICY` (additive,
  idempotent) rather than `DROP`/destructive operations. Re-running the
  full migration history against a fresh database is safe and repeatable.
- The few genuinely destructive statements found are narrow and
  intentional: `DROP POLICY IF EXISTS "<name>"` immediately followed by
  `CREATE POLICY` of the same name (a policy _replacement_ pattern, used
  throughout `orders`/`story_templates`/storage policies), and this
  sprint's own `20260703090000_security_hardening.sql`, which drops one
  coupon SELECT policy as a deliberate security fix.

**Rollback recommendation for future migrations** (process, not code):

1. Before applying any migration that changes existing behavior (not just
   additive), write and test the manual rollback SQL alongside it (e.g.
   as a comment block at the top of the migration file, or a matching
   `_rollback.sql` sibling file) — this repo doesn't have that convention
   yet; establishing it now is cheap and pays off the first time a
   migration needs reverting under pressure.
2. For destructive changes (`DROP COLUMN`, `DROP TABLE`, changing a
   `NOT NULL`/type), always test against a Supabase branch/staging project
   first — this repo shows evidence of migrations being written carefully
   (idempotent guards everywhere) but no evidence of a staging environment
   being used before applying to production.
3. If a bad migration reaches production: the only real rollback for
   anything beyond a simple additive change is a database restore to the
   pre-migration point-in-time (§2.1) — which is why §1.1's PITR
   recommendation directly supports migration rollback capability, not
   just general disaster recovery.

## 4. Disaster recovery

### 4.1 Secrets / environment configuration

Per this project's own convention (`src/lib/config.server.ts`, `CLAUDE.md`),
server secrets (`SUPABASE_SERVICE_ROLE_KEY`, Lovable AI keys, and — per
Phase 3 of this sprint — a future `RESEND_API_KEY`) are read from
`process.env` inside `.server.ts` files, bound per-request by Cloudflare
Workers. **These secrets live only in the Cloudflare dashboard's
environment variable configuration** (or wherever this project's CI
injects them at deploy time) — they are not in this repo (correctly, per
`.gitignore`/`CLAUDE.md`'s "never expose service role key" rule) and
**not backed up by any of the database/storage backups above**. If the
Cloudflare project configuration is lost, the app can be redeployed from
source but will not function until every secret is manually re-entered.

**Recommendation**: maintain an out-of-band, access-controlled record of
which secrets exist and where to regenerate each one (Supabase dashboard
for `SUPABASE_SERVICE_ROLE_KEY`, Lovable AI provider dashboard for AI
keys, Kashier merchant dashboard for payment keys) — not the secret
values themselves, just the recovery procedure — so a Cloudflare project
loss doesn't turn into "nobody remembers which 6 environment variables
this app needs."

### 4.2 Third-party dependencies with no fallback

- **Kashier** (payment provider): if Kashier has an outage, card payments
  fail; Vodafone Cash (receipt-upload) orders are unaffected since that
  flow doesn't depend on Kashier's API. No code change needed — this is
  architecturally already a partial fallback, just worth stating
  explicitly for an incident runbook.
- **Lovable AI functions** (story text + image generation): if this
  service is unavailable, new story generation stalls but doesn't corrupt
  existing data (orders simply stay in `generating` status). Existing
  completed stories/PDFs remain fully accessible.
- **Supabase itself**: a full Supabase outage takes down auth, database,
  and storage simultaneously — there is no fallback for this in the
  current architecture (nor would one be reasonable to build for a
  platform this small). This is an accepted risk, not a gap to close.

### 4.3 Recovery time/point objectives (recommended targets, not currently enforced)

No RTO/RPO targets are currently documented or enforced anywhere in this
repo or its configuration. As a starting point for a launch runbook:

- **RPO (data loss tolerance)**: with PITR enabled (§1.1), realistic RPO
  is minutes; without it, RPO is up to 24 hours (time since last daily
  snapshot). Given real payment data flows through this app, **recommend
  targeting minutes**, i.e. enabling PITR.
- **RTO (time to restore service)**: dominated by Supabase's own restore
  time (typically minutes to low hours depending on database size) plus
  the code-redeploy step (§2.3, a few minutes given no CI pipeline
  currently gates it). No specific target is enforced today; recommend
  setting one (e.g. "under 2 hours") once the actual deploy mechanism is
  confirmed, since this document can't verify it from the repo alone.

### 4.4 Backup restore testing

**Not currently practiced** (nothing in this repo indicates a restore
drill has ever been run). A backup that has never been restored is
unverified. **Recommendation**: before public launch, do at least one
practice restore (Supabase supports restoring to a new project without
affecting the live one) and walk through §2.1-2.3 end-to-end once, timing
it, to get a real RTO number instead of an estimate.

## Summary

| #   | Area                             | Status                                                                                                                                                                                  |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Postgres backup tier/PITR        | **Unverified from repo — action required**: confirm in Supabase dashboard before launch                                                                                                 |
| 2   | Storage bucket backups           | **Likely gap** — Supabase Storage typically isn't covered by DB backups; `child-photos`/`reference-children`/`payment-receipts` are non-regeneratable and highest priority if uncovered |
| 3   | Schema pre-migration-history gap | Documented (same finding as Security/Database audits) — recommend a one-time full schema dump as a recovery anchor                                                                      |
| 4   | Migration rollback               | No down-migrations exist (normal for this tooling); history is overwhelmingly additive/idempotent, which is good; recommend a rollback-SQL-alongside-migration convention going forward |
| 5   | Deploy mechanism                 | Not documented in-repo (no CI/CD workflow found) — confirm actual trigger before relying on this plan's §2.3                                                                            |
| 6   | Secrets recovery                 | No backed-up record of what secrets exist / how to regenerate them — recommend an out-of-band runbook entry                                                                             |
| 7   | Restore testing                  | Never practiced (no evidence in repo/history) — recommend one drill pre-launch                                                                                                          |

## Files changed

- `docs/BACKUP-PLAN.md` — this document.

No code or migrations changed this phase (documentation-only, per the
sprint's Phase 7 scope). No `tsc`/`eslint` verification needed — no
TypeScript files touched.
