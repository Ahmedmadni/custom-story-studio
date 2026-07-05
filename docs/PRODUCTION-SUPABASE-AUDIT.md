# Production Supabase Audit

Final Production Validation Sprint, Phase 1-2. **Methodology, read first**:
this sprint asked for direct verification against the live production
Supabase project (`uhvzhbiqywmpvbmalyph`). That was attempted and is
**not possible from this session** — confirmed with two independent
tests before writing a line of this report:

```
$ curl --connect-timeout 3 https://uhvzhbiqywmpvbmalyph.supabase.co/rest/v1/
→ times out (000), no proxy
$ curl -x $HTTPS_PROXY --cacert /root/.ccr/ca-bundle.crt https://uhvzhbiqywmpvbmalyph.supabase.co/rest/v1/
→ HTTP/1.1 403 Forbidden on the CONNECT tunnel itself
$ grep SUPABASE_SERVICE_ROLE_KEY .env
→ (no match — not set)
```

The sandbox's outbound proxy explicitly refuses `*.supabase.co` (not a
timeout, an explicit 403 — this host is not on its allowlist), and the
service-role key isn't provisioned here either. Both would need to be
true for a live audit to run, and neither is. This is the same wall
documented in `docs/FINAL-PRODUCTION-READINESS.md` from the prior
sprint — re-confirmed, not assumed, before starting this one.

**What this document is instead**: every finding below is the
**code-level answer** (from `supabase/migrations/*.sql` and `src/`),
consolidated from this engagement's prior audits
(`docs/SECURITY-AUDIT.md`, `docs/DATABASE-AUDIT.md`) plus new items this
phase specifically asked for that weren't covered before (auth
configuration). Every item that genuinely requires the live dashboard or
SQL editor to confirm is marked **⚠️ LIVE CHECK REQUIRED** with the exact
query or dashboard path to run it — this document does not claim things
are safe that were never actually observed.

## 1. RLS status, table by table

| Table                  | RLS enabled                        | Policies visible in migrations                                                | Status                                                                                             |
| ---------------------- | ---------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `profiles`             | ✅ (fixed in the hardening sprint) | Yes                                                                           | Safe — verified in code                                                                            |
| `child_profiles`       | ✅                                 | Yes                                                                           | Safe — owner + admin                                                                               |
| `child_story_universe` | ✅                                 | Yes                                                                           | Safe — via child ownership join                                                                    |
| `child_story_history`  | ✅                                 | Yes                                                                           | Safe — read-only for owner, writes only via RPC                                                    |
| `reward_accounts`      | ✅                                 | Yes                                                                           | Safe — no client UPDATE policy exists (grant is inert without one)                                 |
| `reward_transactions`  | ✅                                 | Yes                                                                           | Safe — read-only; writes only via `award_points()`                                                 |
| `referrals`            | ✅                                 | Yes                                                                           | Safe, minor gap: no SELECT policy for the invited user (informational, no functional impact today) |
| `reviews`              | ✅                                 | Yes                                                                           | Safe                                                                                               |
| `favorites`            | ✅                                 | Yes                                                                           | Safe                                                                                               |
| `coupons`              | ✅                                 | Yes (enumeration hole fixed)                                                  | Safe                                                                                               |
| `coupon_redemptions`   | ✅                                 | Yes                                                                           | Safe — read-only, writes via service_role                                                          |
| `admin_action_log`     | ✅                                 | Yes                                                                           | Safe — admin-read-only, writes via service_role                                                    |
| `orders`               | Assumed enabled                    | **Partial** — only INSERT policy visible (well-guarded, 3 iterations)         | ⚠️ **LIVE CHECK REQUIRED**                                                                         |
| `user_roles`           | Unknown                            | **None visible**                                                              | 🔴 **LIVE CHECK REQUIRED — highest priority**                                                      |
| `story_templates`      | Unknown                            | **None visible** (only `DROP POLICY` for policies created outside migrations) | ⚠️ **LIVE CHECK REQUIRED**                                                                         |
| `generated_pages`      | Unknown                            | **None visible**                                                              | ⚠️ **LIVE CHECK REQUIRED**                                                                         |

**Why these four can't be resolved from code**: they were created before
this repo's migration history begins. Postgres RLS policies are
`PERMISSIVE` by default and OR-compose — writing a new restrictive-looking
policy from this session would not override or reveal an existing
permissive one that might already grant broader access. Guessing wrong
here would create false confidence, not safety.

**⚠️ LIVE CHECK REQUIRED — run this first, before anything else in this
document**:

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_roles', 'orders', 'story_templates', 'generated_pages')
order by tablename, cmd;
```

**What to look for**: `user_roles` is the single most consequential table
in the entire schema — every admin check (`has_role()`) reads from it. If
it has no policy restricting `INSERT`/`UPDATE` to service_role or an
existing admin, any authenticated user could grant themselves the
`admin` role directly via PostgREST, bypassing every application-level
check in this codebase. **If that query shows `user_roles` has zero
policies, or a policy permitting `authenticated` to `INSERT`/`UPDATE`
without an admin check — treat this as a launch blocker and fix before
any public traffic.**

## 2. Storage bucket permissions

| Bucket               | Policy visible in code                      | Status                                                                          |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| `payment-receipts`   | Yes — owner-scoped + admin                  | Safe                                                                            |
| `story-pdfs`         | Yes — order-owner (tightened twice) + admin | Safe                                                                            |
| `reference-children` | Yes — authenticated read/write own + admin  | Safe                                                                            |
| `story-pages`        | Yes — order-owner (status-gated) + admin    | Safe                                                                            |
| `child-photos`       | **None found in any migration**             | 🔴 **LIVE CHECK REQUIRED — see below, this is the sprint's named focus bucket** |

### 2.1 `child-photos` — the sprint's named focus bucket, checked in detail

This bucket stores real photos of real children. It is the single
highest-consequence storage target in this app, and it's also the one
bucket with **zero policy history in this repo** — every other bucket
(`payment-receipts`, `story-pdfs`, `reference-children`, `story-pages`)
has at least one `CREATE POLICY` in `supabase/migrations/*.sql`;
`child-photos` has none, not even a `DROP POLICY` reference. This means
either it was configured directly in the Supabase dashboard (bypassing
migration tracking), or it was never configured at all. Both are
indistinguishable from the code, and the difference matters enormously.

**What the code assumes** (verified across all 6+ upload call sites:
`ai.functions.ts`, `admin.functions.ts`, `OrderEditDialog.tsx`,
`request-story.tsx`'s `uploadToBucket` helper, `checkout.tsx`,
`order.$templateId.tsx`, `create.tsx`): every upload consistently writes
to a path of the form `${user.id}/<uuid>.<ext>` — the exact same
convention as `reference-children`, which **does** have a verified,
correct owner-scoped policy in migrations. If `child-photos` has an
equivalent policy (just applied outside migration tracking), the path
structure fully supports it working correctly.

**Public access**: ⚠️ **LIVE CHECK REQUIRED** — in the Supabase dashboard,
Storage → `child-photos` → check whether the bucket itself is marked
"Public". If it is public, **every file in it is fetchable by anyone
with the URL, regardless of any RLS policy on `storage.objects`** —
bucket-level "public" and object-level RLS policies are two independent
gates, and a public bucket bypasses RLS for reads entirely. This is the
single most important checkbox in this entire audit given what this
bucket contains. It should be **private**, matching the other
user-photo bucket (`reference-children`, confirmed private + policy-gated
in code).

**Upload permissions**: ⚠️ **LIVE CHECK REQUIRED**:

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (qual::text ilike '%child-photos%' or with_check::text ilike '%child-photos%');
```

Expect an `INSERT` policy requiring
`(storage.foldername(name))[1] = auth.uid()::text` (the user can only
upload into their own folder) — matching `reference-children`'s pattern
exactly.

**Read permissions**: same query — expect a `SELECT` policy scoped the
same way (owner reads own folder) plus an admin-override clause
(`has_role(auth.uid(), 'admin')`), matching every other bucket in this
app.

**Delete permissions**: `admin.functions.ts` removes files from this
bucket when an order/child record is deleted or a photo is replaced
(3 call sites found: lines 410, 566, 594) — all via the service-role
client, which bypasses RLS entirely for these specific server-initiated
deletes. That path is safe regardless of the bucket's RLS state. The
open question is whether a **non-admin client-side delete** is also
possible — if no `DELETE` policy exists (or one exists but is
misconfigured to allow any authenticated user to delete any file, not
just their own), a user could delete another user's uploaded photo
directly via the storage API. Check for a `DELETE` policy in the same
query above and confirm it's owner-scoped if present.

**If the query above returns zero rows for `child-photos`**: the bucket
has no RLS policy at all. Combined with a public bucket setting, this
would mean anyone with a guessed or leaked URL can read any child's
photo, and (if the bucket also grants broad `storage.objects` access at
the table level to `authenticated`, as several buckets in this schema
do) any logged-in user could potentially write or delete files anywhere
in the bucket. **This is the single highest-priority item in this
entire report.** If confirmed missing, apply immediately:

```sql
create policy "Users manage own child photos"
on storage.objects for all to authenticated
using (bucket_id = 'child-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'child-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Admins manage all child photos"
on storage.objects for all to authenticated
using (bucket_id = 'child-photos' and public.has_role(auth.uid(), 'admin'));
```

And separately, in Storage settings, confirm/set the bucket to
**private** if it is currently public.

## 3. Triggers (verified in code, all present and correctly scoped)

| Trigger                                                                                                                                                | On                | Fires                    | Calls                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------ | -------------------------------------------------------------------------------- |
| `update_wizard_drafts_updated_at` / `game_progress_updated_at` / `trg_child_profiles_updated` / `trg_universe_updated` / `trg_reward_accounts_updated` | respective tables | `BEFORE UPDATE`          | `update_updated_at()`                                                            |
| `trg_welcome_bonus`                                                                                                                                    | `auth.users`      | `AFTER INSERT`           | `grant_welcome_bonus()` — 50pt signup bonus                                      |
| `trg_orders_completion`                                                                                                                                | `public.orders`   | `AFTER UPDATE OF status` | `trg_orders_on_sent()` → `complete_story_for_child()` when status reaches `sent` |
| `trg_set_referral_code`                                                                                                                                | `public.profiles` | `BEFORE INSERT`          | `set_referral_code()`                                                            |

No gaps found here — same conclusion as `docs/DATABASE-AUDIT.md` §3,
re-confirmed for this report.

## 4. RPC permissions

| Function                                  | `SECURITY DEFINER`            | Revoked from public/anon/authenticated | Client-callable?                                                                                                                                            |
| ----------------------------------------- | ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `has_role`                                | Unknown (predates migrations) | ⚠️ **No REVOKE found in migrations**   | Yes — called from client in 9 places, always with the caller's own `context.userId` in every call site examined (self-check pattern, not other-user lookup) |
| `award_points`                            | Yes                           | Yes                                    | No — service_role only                                                                                                                                      |
| `complete_story_for_child`                | Yes                           | Yes                                    | No — trigger only                                                                                                                                           |
| `calc_child_level`                        | No (pure SQL)                 | N/A — no side effects                  | Irrelevant (stateless)                                                                                                                                      |
| `gen_referral_code` / `set_referral_code` | No / Yes                      | Yes                                    | No — trigger only                                                                                                                                           |
| `update_updated_at`                       | Unknown (predates migrations) | Yes                                    | No — trigger only                                                                                                                                           |

**Minor, low-severity, informational**: `has_role(_user_id, _role)` takes
`_user_id` as a free parameter with no visible `REVOKE`. Every call site
in this codebase passes the caller's own ID, so this isn't exploited
today, but a client could technically call
`supabase.rpc('has_role', { _user_id: '<someone-else>', _role: 'admin' })`
directly via PostgREST and learn whether an arbitrary user is an admin —
a minor information leak, not a privilege escalation. Not fixed
(matches `docs/SECURITY-AUDIT.md` §6's original assessment; a wrapper
function taking no parameters would close it if ever prioritized).

## 5. Indexes

Confirmed from `docs/DATABASE-AUDIT.md` (fixed in the hardening sprint):
`idx_orders_user_status` on `orders(user_id, status)` and
`idx_generated_pages_order` on `generated_pages(order_id)` — both target
the exact predicate columns evaluated on every storage-bucket RLS check.
Full index inventory is in that document; nothing new to add here.

**⚠️ LIVE CHECK REQUIRED (optional, not blocking)** — confirm these
landed and are actually used:

```sql
select indexname, indexdef from pg_indexes where tablename in ('orders', 'generated_pages');
explain analyze select * from orders where user_id = '<a-real-user-id>' and status = 'sent';
```

## 6. Auth configuration — new this phase, not covered by prior audits

Nothing about Supabase Auth's _dashboard_ configuration exists in this
repo (no `supabase/config.toml` auth block — that file only contains
`project_id`). What the code assumes, that needs live confirmation:

- **Email confirmation**: `auth.tsx`'s signup success message
  ("تفقد بريدك لتأكيد التسجيل" — check your email to confirm) assumes
  email confirmation is **required** before login works. **⚠️ LIVE CHECK**:
  Authentication → Providers → Email → confirm "Confirm email" is
  enabled. If it's actually disabled, the app's own messaging would be
  misleading (telling users to check email for a step that doesn't
  exist), though not a security issue either way.
- **Redirect URL allowlist**: both email signup
  (`emailRedirectTo: window.location.origin`) and Google OAuth
  (`redirect_uri: window.location.origin`, routed through Lovable's auth
  wrapper in `src/integrations/lovable/index.ts`) redirect back to
  whatever origin served the page. **⚠️ LIVE CHECK**: Authentication → URL
  Configuration → Redirect URLs must include the real production domain
  (`https://kidzy.life` per `SITE_URL`, and its `www` variant if used) —
  if it's missing, email confirmation links and/or the Google OAuth
  callback will fail in production even though they'd work fine
  redirecting to a `localhost` dev URL.
- **JWT expiry / refresh token rotation**: not referenced anywhere in
  this codebase (the client SDK handles refresh transparently via
  `persistSession: true`, `autoRefreshToken` default). No code-level
  concern; standard Supabase defaults are reasonable. Not flagged as
  needing a specific check.
- **Google OAuth provider**: configured through Lovable's own auth layer,
  not directly through Supabase's native Google provider settings — this
  repo doesn't hold the Google OAuth client ID/secret at all (it should
  live in Lovable Cloud's connector configuration, not this app's `.env`).
  **⚠️ LIVE CHECK**: outside this repo's visibility entirely; confirm in
  Lovable's own connector settings that Google sign-in is actually
  configured and working, since this codebase cannot verify it.

## Summary of required live actions, by priority

| #   | Action                                                                                          | Priority                                                     |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Run the `pg_policies` query in §1 for `user_roles`/`orders`/`story_templates`/`generated_pages` | 🔴 Blocking — do before public launch                        |
| 2   | Confirm `child-photos` bucket storage policy (Phase 2 below has the exact query)                | 🔴 Blocking                                                  |
| 3   | Confirm Auth redirect URL allowlist includes the production domain                              | 🟠 High — breaks signup/OAuth in production if missing       |
| 4   | Confirm "Confirm email" setting matches the app's own messaging                                 | 🟡 Medium — cosmetic mismatch if wrong, not a security issue |
| 5   | Confirm Google OAuth connector is actually live in Lovable Cloud                                | 🟡 Medium — feature works or doesn't, not a security issue   |
| 6   | Confirm the two new indexes exist and are used by the planner                                   | 🔵 Low — optimization, not correctness                       |

## Files changed

- `docs/PRODUCTION-SUPABASE-AUDIT.md` — this document.

No code or migrations changed this phase (audit/verification only, no
live database access available to act on findings even if a fix were
warranted).
