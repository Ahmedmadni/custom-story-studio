# Database Health Audit

Phase 6 of the Production Hardening & Launch Preparation Sprint. Based on a
full read of all 34 files in `supabase/migrations/*.sql` (the only source of
truth available to this audit — there is no live database connection from
this environment) plus cross-referencing against actual query call sites in
`src/features/*/*.functions.ts`.

**Same limitation as `docs/SECURITY-AUDIT.md` §1**: `profiles`, `orders`,
`user_roles`, `story_templates`, and `generated_pages` were created before
this repo's migration history begins (the earliest tracked migration only
`ALTER`s `story_templates`). Their original `CREATE TABLE` statements —
including whatever indexes/constraints came with them — are not in this
repo. Everything below about those five tables is inferred from later
`ALTER TABLE`/`CREATE INDEX` migrations and RLS policy definitions that
reference them; it is **not** a substitute for running the queries in
"How to verify" against the live database before launch.

## 1. Indexes

### Confirmed present (from migrations)

| Table                  | Index                                             | Columns                                       |
| ---------------------- | ------------------------------------------------- | --------------------------------------------- |
| `story_templates`      | `idx_story_templates_content_type`                | `content_type`                                |
| `story_templates`      | `idx_story_templates_admin_approved_at`           | `admin_approved_at`                           |
| `story_templates`      | `idx_story_templates_source_template` / `_source` | `source_template_id`                          |
| `story_templates`      | `idx_story_templates_gallery`                     | `is_gallery` (partial, `WHERE is_gallery`)    |
| `story_templates`      | `story_templates_occasion_idx`                    | `occasion`                                    |
| `orders`               | `idx_orders_kashier_order_id`                     | `kashier_order_id`                            |
| `orders`               | `idx_orders_child_id`                             | `child_id`                                    |
| `orders`               | `idx_orders_published_template`                   | `published_template_id`                       |
| `payment_logs`         | `idx_payment_logs_kashier_order`                  | `kashier_order_id`                            |
| `payment_logs`         | `idx_payment_logs_created_at`                     | `created_at DESC`                             |
| `child_profiles`       | `idx_child_profiles_user`                         | `user_id`                                     |
| `child_story_universe` | (implicit, `UNIQUE`)                              | `child_id`                                    |
| `reward_accounts`      | (implicit, `PRIMARY KEY`)                         | `user_id`                                     |
| `reward_transactions`  | `idx_reward_tx_user`                              | `(user_id, created_at DESC)`                  |
| `child_story_history`  | `idx_history_child`                               | `(child_id, completed_at DESC)`               |
| `child_story_history`  | `idx_history_order`                               | `order_id`                                    |
| `reviews`              | `idx_reviews_template`                            | `template_id` (partial, `WHERE is_published`) |
| `reviews`              | `idx_reviews_user`                                | `user_id`                                     |
| `coupon_redemptions`   | `idx_coupon_redemptions_user`                     | `(coupon_id, user_id)`                        |
| `referrals`            | `idx_referrals_inviter`                           | `inviter_id`                                  |
| `referrals`            | (implicit, `UNIQUE`)                              | `invited_user_id`                             |
| `favorites`            | `favorites_user_idx`                              | `user_id`                                     |
| `favorites`            | (implicit, `UNIQUE`)                              | `(user_id, template_id)`                      |
| `game_progress`        | (implicit, `UNIQUE`)                              | `(user_id, game_key)`                         |
| `wizard_drafts`        | (implicit, `PRIMARY KEY`)                         | `user_id`                                     |

These are all well-targeted at their actual access patterns (owner-scoped
lookups, admin dashboards sorted by recency, uniqueness constraints doing
double duty as lookup indexes).

### Missing indexes (real risk, found via cross-reference)

**`orders.user_id` — no index found in migration history.** This is the
most significant finding in this audit. `orders.user_id = auth.uid()` (or
the equivalent `o.user_id = auth.uid()` inside an `EXISTS` subquery) is the
core RLS predicate used by:

- The `story-pdfs`, `story-pages`, and `reference-children` storage bucket
  policies (every file read/list against those buckets runs this check).
- The `generated_pages` "Order owner or admin views pages" policy.
- `orders`'s own RLS policies (implied, not shown in migrations since the
  base table predates tracked history).
- Every app-level query filtering a user's own orders (`_authenticated.my-orders.tsx`,
  `_authenticated.story.$orderId.tsx`, referral/coupon verification flows) —
  `orders` is referenced in 49 places across `src/features/*/*.functions.ts`.

Without an index, each of those checks — run on **every** authenticated
storage object access, not just page loads — requires a sequential scan of
the entire `orders` table to find the current user's rows. This scales
linearly with total order count across all users, not just the current
user's orders, and gets worse every day post-launch as the table grows.

**`orders.status` — no index found.** Used in the same RLS policies
(`o.status IN ('approved','generating','ready','sent')`) and in admin
dashboard filtering (`OrdersManager.tsx`'s status tabs). A composite index
on `(user_id, status)` would cover both the RLS predicate and the owner+status
combination in one index, and is likely the single highest-value index to
add before launch.

**`generated_pages.order_id` — no index found.** The RLS policy joins
`generated_pages.order_id` to `orders.id` (`o.id = generated_pages.order_id`),
and the app fetches all pages for an order (`adminGetOrderPages`, story
detail page) via `WHERE order_id = ...`. Every "view story" page load and
every generated-page RLS check scans `generated_pages` for this order
without an index.

**Fixed**: `supabase/migrations/20260703092000_orders_generated_pages_indexes.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_generated_pages_order ON public.generated_pages (order_id);
```

### Why this was safe to apply directly (unlike the Phase 1 RLS gaps)

Unlike the `orders`/`user_roles` RLS-policy unknowns flagged in
`docs/SECURITY-AUDIT.md` (where an additional permissive policy can
silently OR-compose with an unknown pre-existing one and change access
semantics), an index is pure read-path performance with no semantic
effect: `CREATE INDEX IF NOT EXISTS` either adds a new index or is a
no-op keyed on the given name. There is no scenario where this migration
changes query _results_, only (at best) their cost — so it doesn't need
the same "flag and wait for manual DB verification" treatment. If an
equivalent index already exists under a different name from the
untracked pre-migration schema, this migration simply adds a second,
redundant one; Postgres and the query planner tolerate that safely (minor
extra disk/write overhead, never a correctness issue), and it's a
one-line `DROP INDEX` cleanup if confirmed redundant later.

## 2. Foreign keys & cascading deletes

All foreign keys found use an explicit `ON DELETE` action (no bare,
default-`NO ACTION` foreign keys were found, which is good hygiene — every
relationship's delete behavior is a deliberate choice, not an accident).

| Child table.column                          | → Parent                 | On delete               |
| ------------------------------------------- | ------------------------ | ----------------------- |
| `child_profiles.user_id`                    | `auth.users`             | CASCADE                 |
| `child_story_universe.child_id`             | `child_profiles`         | CASCADE                 |
| `reward_accounts.user_id`                   | `auth.users`             | CASCADE                 |
| `reward_transactions.user_id`               | `auth.users`             | CASCADE                 |
| `child_story_history.child_id`              | `child_profiles`         | CASCADE                 |
| `child_story_history.order_id`              | `orders`                 | CASCADE                 |
| `child_story_history.template_id`           | `story_templates`        | SET NULL                |
| `reviews.user_id`                           | `auth.users`             | CASCADE                 |
| `reviews.order_id`                          | `orders`                 | CASCADE                 |
| `reviews.template_id`                       | `story_templates`        | SET NULL                |
| `coupon_redemptions.coupon_id`              | `coupons`                | CASCADE                 |
| `coupon_redemptions.user_id`                | `auth.users`             | CASCADE                 |
| `coupon_redemptions.order_id`               | `orders`                 | SET NULL                |
| `referrals.inviter_id` / `.invited_user_id` | `auth.users`             | CASCADE                 |
| `favorites.user_id`                         | `auth.users`             | CASCADE                 |
| `favorites.template_id`                     | `story_templates`        | CASCADE                 |
| `orders.child_id`                           | `child_profiles`         | SET NULL                |
| `orders.published_template_id`              | `story_templates`        | SET NULL                |
| `story_templates.source_template_id`        | `story_templates` (self) | SET NULL                |
| `story_templates.source_order_id`           | `orders`                 | SET NULL                |
| `story_templates.admin_approved_by`         | `auth.users`             | _(no action specified)_ |
| `wizard_drafts.user_id`                     | `auth.users`             | CASCADE                 |
| `game_progress.user_id`                     | `auth.users`             | CASCADE                 |

### Finding: deleting a user cascades through the entire financial/audit trail

Deleting a row from `auth.users` (e.g. via a future "delete my account"
feature, or an admin manually removing a user) cascades through:
`child_profiles` → `child_story_universe` + `child_story_history`, and
independently `reward_accounts` + `reward_transactions`, `favorites`,
`referrals`, `coupon_redemptions`, `game_progress`, `wizard_drafts`.

For profile/gameplay data this is the correct, expected behavior (a
deleted user's children's data and game scores should disappear). But
`reward_transactions` and `coupon_redemptions` are **ledger/audit tables**
— they record what discounts and reward points were actually granted and
redeemed, which matters for financial reconciliation and dispute handling
even after a user is gone (e.g. "did this account actually redeem
WELCOME20 before it was deleted?"). Cascading these away means that
history is unrecoverable the moment a user row is deleted.

**Not changed this phase** (no user-deletion feature exists yet in the
app, so this is not an active bug — flagging for when one is built):
if/when an account-deletion feature is added, consider either (a)
anonymizing the ledger rows instead of relying on cascade, or (b) using a
soft-delete flag on `auth.users`-adjacent business rows before any hard
delete, rather than changing the FK actions now for a feature that doesn't
exist.

### `story_templates.admin_approved_by` has no explicit `ON DELETE` action

Found in `20260611094527_...sql`: `admin_approved_by UUID REFERENCES auth.users(id)`
with no `ON DELETE` clause, meaning it defaults to `NO ACTION` — deleting
the admin user who approved a template would be **blocked** by Postgres
(a `foreign key violation` error) rather than cascading or nulling. Low
real-world impact (admin accounts are rarely deleted), but inconsistent
with every other FK in the schema, which all specify an explicit
`ON DELETE`. **Recommendation**: `ON DELETE SET NULL` for consistency, if
touched in a future migration — not urgent enough to justify a migration
on its own in this phase.

## 3. Triggers

| Table                  | Trigger                           | Fires                    | Function                                              |
| ---------------------- | --------------------------------- | ------------------------ | ----------------------------------------------------- |
| `wizard_drafts`        | `update_wizard_drafts_updated_at` | `BEFORE UPDATE`          | `update_updated_at()`                                 |
| `game_progress`        | `game_progress_updated_at`        | `BEFORE UPDATE`          | `update_updated_at()`                                 |
| `child_profiles`       | `trg_child_profiles_updated`      | `BEFORE UPDATE`          | `update_updated_at()`                                 |
| `child_story_universe` | `trg_universe_updated`            | `BEFORE UPDATE`          | `update_updated_at()`                                 |
| `reward_accounts`      | `trg_reward_accounts_updated`     | `BEFORE UPDATE`          | `update_updated_at()`                                 |
| `auth.users`           | `trg_welcome_bonus`               | `AFTER INSERT`           | `grant_welcome_bonus()`                               |
| `public.orders`        | `trg_orders_completion`           | `AFTER UPDATE OF status` | `trg_orders_on_sent()` → `complete_story_for_child()` |
| `public.profiles`      | `trg_set_referral_code`           | `BEFORE INSERT`          | `set_referral_code()`                                 |

All `updated_at` triggers follow the same simple, safe pattern (no
recursion risk, no cross-table writes). All are `SECURITY DEFINER` where
they need to write across RLS boundaries (`grant_welcome_bonus`,
`complete_story_for_child`, `trg_orders_on_sent`), and are correctly
`REVOKE`d from `PUBLIC, anon, authenticated` where they shouldn't be
directly callable (verified in `docs/SECURITY-AUDIT.md`).

### `complete_story_for_child` does 5 sequential aggregate joins per call

**Observed** (not yet a real problem, flagged for scale): the achievement
check block in `complete_story_for_child()` runs 5 separate
`SELECT COUNT(*) ... FROM child_story_history h JOIN story_templates t ...`
queries per invocation (one per achievement category), each scanning the
same child's history rows and joining categories via `ILIKE '%...%'`
pattern matches (not indexed — `ILIKE` with a leading wildcard can't use a
btree index anyway). This only runs once per order (guarded by the
`IF EXISTS (...) THEN RETURN` idempotency check at the top), and
`idx_history_child` bounds each subquery to one child's rows, so at
current per-child story counts (tens, not thousands) this is not a
measurable problem. **Not changed**: rewriting this as a single query with
conditional aggregation would be a genuine improvement at much higher
scale, but is a behavior-sensitive rewrite of achievement logic — out of
scope for a "no major changes" hardening sprint without dedicated QA of
every achievement threshold.

## 4. RPC functions — permission boundary summary

(Full detail already in `docs/SECURITY-AUDIT.md` §6-7; summarized here for
the database-health angle.)

| Function                   | SECURITY DEFINER           | Revoked from public/anon/authenticated                                                                         | Notes                                                                                                                                        |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `has_role`                 | predates migrations        | not verifiable from repo                                                                                       | used pervasively in RLS `USING` clauses — must remain callable by `authenticated` (it's not meant to be revoked; it's the RLS helper itself) |
| `update_updated_at`        | predates migrations        | **yes**, explicit `REVOKE` found                                                                               | trigger-only function                                                                                                                        |
| `grant_welcome_bonus`      | yes                        | yes                                                                                                            | trigger-only                                                                                                                                 |
| `award_points`             | yes                        | yes                                                                                                            | called only via `supabaseAdmin` (service_role) server-side                                                                                   |
| `calc_child_level`         | no (plain `sql immutable`) | not revoked — but pure/stateless, safe to leave callable                                                       | no side effects, cannot be abused                                                                                                            |
| `complete_story_for_child` | yes                        | yes (`REVOKE ALL ... FROM PUBLIC, anon, authenticated`)                                                        | trigger-invoked only                                                                                                                         |
| `trg_orders_on_sent`       | yes                        | n/a (trigger functions aren't directly callable via RPC in practice, but no explicit revoke found — see below) |                                                                                                                                              |
| `gen_referral_code`        | no                         | yes                                                                                                            | pure/random generator, revoked defensively even though harmless                                                                              |
| `set_referral_code`        | no                         | yes                                                                                                            | trigger-only                                                                                                                                 |

**Minor gap**: `trg_orders_on_sent()` has no explicit `REVOKE` statement
(unlike its sibling `complete_story_for_child`, which does). In practice,
Postgres does grant `EXECUTE` on new functions to `PUBLIC` by default,
so `trg_orders_on_sent()` is technically callable directly by any
authenticated/anon role via `SELECT public.trg_orders_on_sent()` — but
calling a trigger function directly (outside trigger context) simply
errors (`trigger functions can only be called as triggers`) rather than
executing meaningfully, so there's no real exploit path. Still,
recommend adding the matching `REVOKE` for consistency with the rest of
the schema in a follow-up migration.

## 5. Slow-query candidates (heuristic, not measured — no live DB access)

Based on query shape alone (not `EXPLAIN ANALYZE`, which requires a live
connection this environment doesn't have):

1. **Admin order list** (`adminListOrders` → `OrdersManager.tsx`, polled
   every 30s via `refetchInterval: 30000`) — likely does an unfiltered or
   lightly-filtered `SELECT * FROM orders ORDER BY created_at DESC`-style
   query for the admin dashboard. Once `orders` grows into the thousands,
   this should get a `created_at DESC` index and/or pagination if it
   doesn't have one already — not verifiable from migrations since the
   query itself lives in `admin.functions.ts`, not SQL. Recommend checking
   `EXPLAIN ANALYZE` on this query specifically once there's production
   data volume.
2. **`complete_story_for_child`'s achievement `ILIKE` joins** (§3 above) —
   not indexable as written; fine at current scale, worth revisiting if
   per-child story counts grow past low hundreds.
3. **Any query filtering `orders` by `user_id`/`status` without the
   missing composite index (§1)** — the RLS-driven storage checks are the
   most-executed of these (once per storage object access), making them
   the top priority to verify/fix.

## How to verify (run against the live Supabase database before launch)

```sql
-- Confirm/deny the "missing index" findings above:
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'orders';
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'generated_pages';

-- Find genuinely missing indexes on FK columns generally:
SELECT c.conrelid::regclass AS table_name, a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
  );

-- Slow queries (requires pg_stat_statements, if enabled on the Supabase project):
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 20;
```

## Summary

| #   | Finding                                                                                  | Severity                             | Status                                        |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------- |
| 1   | `orders.user_id` / `orders.status` likely unindexed, hit by every storage-RLS check      | High                                 | **Fixed** — `idx_orders_user_status` added    |
| 2   | `generated_pages.order_id` likely unindexed                                              | Medium                               | **Fixed** — `idx_generated_pages_order` added |
| 3   | Ledger tables (`reward_transactions`, `coupon_redemptions`) cascade-delete with the user | Low (no deletion feature exists yet) | Documented for future account-deletion work   |
| 4   | `story_templates.admin_approved_by` FK has no `ON DELETE` action (defaults to blocking)  | Low                                  | Documented                                    |
| 5   | `complete_story_for_child` does 5 non-indexable `ILIKE` joins per call                   | Low (fine at current scale)          | Documented                                    |
| 6   | `trg_orders_on_sent()` missing a defensive `REVOKE` (no real exploit path)               | Informational                        | Documented                                    |

## Files changed

- `docs/DATABASE-AUDIT.md` — this document.
- `supabase/migrations/20260703092000_orders_generated_pages_indexes.sql` — new, additive-only indexes (§1).

## Migrations created

- `20260703092000_orders_generated_pages_indexes.sql` — `idx_orders_user_status`
  on `orders(user_id, status)`, `idx_generated_pages_order` on
  `generated_pages(order_id)`. Both `CREATE INDEX IF NOT EXISTS`, no data
  changes, safe to run against the live database at any time. Still
  recommend running the "How to verify" queries above post-launch to
  confirm they're actually being used (`EXPLAIN ANALYZE`) and to check for
  any other FK columns missing indexes that this repo-only audit couldn't
  see (tables predating migration history).
