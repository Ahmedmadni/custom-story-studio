# Supabase Manual Verification Checklist

Final Launch Cleanup, Task 2. A step-by-step checklist to run **directly
in the Supabase dashboard** (SQL Editor + Storage settings) for the
project `uhvzhbiqywmpvbmalyph`. No session in this engagement has been
able to reach this project's API from its sandbox (confirmed repeatedly:
the outbound proxy returns `403 Forbidden` on the CONNECT tunnel to
`*.supabase.co`, and `SUPABASE_SERVICE_ROLE_KEY` is never provisioned in
any of these sandboxes) — so every item below has to be run by a human
with real dashboard access. Total time: **under 15 minutes** for the
whole checklist.

Do these in order — items 1-2 are launch blockers, everything after is
lower priority.

---

## ☐ 1. `user_roles` RLS — the single highest-priority check in this entire engagement

**Why it matters**: `user_roles` determines who is an admin. Every
`assertAdmin()` call in this codebase reads it via the `has_role()`
function. If this table has no RLS policy restricting writes, any
signed-up user could grant themselves the `admin` role directly via the
REST API, bypassing every application-level check.

**Run this in the SQL Editor**:

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'user_roles'
order by cmd;
```

**Expected result**: at least one policy restricting `INSERT`/`UPDATE`/
`DELETE` on this table — either to `service_role` only (no policy for
`authenticated` at all, which is the safest and most likely correct
state given every role-grant in this codebase goes through
`supabaseAdmin`), or a policy whose `with_check`/`qual` requires
`has_role(auth.uid(), 'admin')`.

**FAIL condition — stop and fix immediately if you see**:

- Zero rows returned (no RLS policy at all — combined with RLS being
  enabled, this actually blocks everything by default, which is safe;
  but if RLS is _not enabled_ on this table, zero policies means
  **anyone can write anything**), OR
- Any policy with `cmd = 'INSERT'` or `'UPDATE'`, `roles` including
  `authenticated`, and a `with_check`/`qual` that is `true` or doesn't
  reference `has_role`/`service_role`.

**Also check RLS is actually enabled on the table**:

```sql
select relname, relrowsecurity from pg_class where relname = 'user_roles';
```

Expect `relrowsecurity = true`.

**If broken, apply this fix**:

```sql
alter table public.user_roles enable row level security;

create policy "Only admins manage roles"
on public.user_roles for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
```

☐ **Checked** — result: ******\_\_\_******

---

## ☐ 2. `child-photos` storage bucket — real children's photos, zero policy history

**Why it matters**: this bucket stores real photos of real children and
has no `CREATE POLICY` anywhere in this repo's migration history —
either it was configured outside migration tracking, or never
configured at all.

### 2a. Bucket public/private setting

**Where**: Dashboard → Storage → `child-photos` → bucket settings (or
the toggle directly in the bucket list).

**Expected result**: **Private**. If it shows "Public," anyone with a
file's URL can read it regardless of any RLS policy — public/private is
a separate gate from RLS entirely.

☐ **Checked** — bucket is: ☐ Private (correct) ☐ Public (**fix immediately**, see below)

### 2b. RLS policies on the bucket

**Run this in the SQL Editor**:

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (qual::text ilike '%child-photos%' or with_check::text ilike '%child-photos%');
```

**Expected result**: at least two policies — one for `INSERT` and one
for `SELECT` (matching the pattern already verified correct on the
`reference-children` bucket), each requiring
`(storage.foldername(name))[1] = auth.uid()::text`, plus an admin
override using `has_role(auth.uid(), 'admin')`. Optionally a `DELETE`
policy with the same owner-scoping.

**FAIL condition**: zero rows returned (no policy exists at all).

**If broken, apply this fix**:

```sql
create policy "Users manage own child photos"
on storage.objects for all to authenticated
using (bucket_id = 'child-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'child-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Admins manage all child photos"
on storage.objects for all to authenticated
using (bucket_id = 'child-photos' and public.has_role(auth.uid(), 'admin'));
```

**If the bucket is Public**: go to Storage → `child-photos` → bucket
settings → toggle to Private. Do this even if you also add the policies
above — a Public bucket bypasses RLS for reads regardless of policy.

☐ **Checked** — policies found: ******\_\_\_******

---

## ☐ 3. `orders`, `story_templates`, `generated_pages` RLS — secondary priority

**Why it matters**: these three tables predate this repo's migration
history, so their original policies (if any) are invisible in code.
`orders` INSERT is confirmed well-guarded (visible in migrations); the
open question is `SELECT`/`UPDATE`/`DELETE`.

**Run this in the SQL Editor**:

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'story_templates', 'generated_pages')
order by tablename, cmd;
```

**Expected result for `orders`**: an `INSERT` policy requiring
`user_id = auth.uid()` plus status/payment-status conditions (already
confirmed in migrations). For `SELECT`/`UPDATE`/`DELETE`: either no
policy at all (safe — blocks all direct client access, which matches
how this app actually works, since all reads/writes beyond insert go
through `supabaseAdmin`), or a policy scoped to `user_id = auth.uid()`
for `SELECT` and admin-only for `UPDATE`/`DELETE`.

**Expected result for `story_templates`**: a `SELECT` policy allowing
public/authenticated read **filtered to `is_published = true`** (there's
a `GRANT SELECT ... TO anon, authenticated` confirmed in migrations, but
the actual RLS policy content needs this check to confirm it doesn't
leak unpublished/draft templates).

**Expected result for `generated_pages`**: no policy needed for
`authenticated`/`anon` at all — every access in this app goes through
`supabaseAdmin`. If a permissive policy exists here that isn't
order-owner-scoped, that would leak other users' generated story pages.

**FAIL condition**: any policy on these three tables that grants broader
access than described above (e.g., `story_templates` SELECT with no
`is_published` filter, or any policy letting `authenticated` update/
delete arbitrary `orders` rows).

☐ **Checked** — result: ******\_\_\_******

---

## ☐ 4. Auth configuration

**Where**: Dashboard → Authentication → URL Configuration.

**Check**: "Redirect URLs" includes the real production domain
(`https://kidzy.life` and, if used, its `www` variant) — both email
confirmation links and Google OAuth callbacks redirect to
`window.location.origin`, so if the production domain isn't in this
allowlist, signup confirmation and Google sign-in will fail in
production even though they'd work fine against `localhost` in dev.

☐ **Checked** — `https://kidzy.life` present: ☐ Yes ☐ No (**add it if missing**)

**Where**: Dashboard → Authentication → Providers → Email.

**Check**: "Confirm email" setting — the app's own signup success
message ("تفقد بريدك لتأكيد التسجيل" — check your email to confirm)
assumes this is **enabled**. If it's actually disabled, this is a
cosmetic mismatch (misleading copy), not a security issue, but worth
knowing either way.

☐ **Checked** — "Confirm email" is: ☐ Enabled ☐ Disabled

---

## ☐ 5. Indexes (optional, performance only — not a launch blocker)

**Run this in the SQL Editor**:

```sql
select indexname, indexdef from pg_indexes
where tablename in ('orders', 'generated_pages')
order by tablename;
```

**Expected result**: `idx_orders_user_status` on `orders(user_id, status)`
and `idx_generated_pages_order` on `generated_pages(order_id)` should
both appear (added via migration `20260703092000_orders_generated_pages_indexes.sql`
during this engagement). If they're missing, the migration either wasn't
applied or was rolled back — reapply it.

☐ **Checked** — both indexes present: ☐ Yes ☐ No

---

## Screenshot checklist

For the record (and for anyone reviewing this checklist's execution
after the fact), take a screenshot of:

1. ☐ The `pg_policies` query result from Item 1 (`user_roles`).
2. ☐ The Storage → `child-photos` bucket settings page showing its
   public/private status (Item 2a).
3. ☐ The `pg_policies` query result from Item 2b (`child-photos`
   storage policies).
4. ☐ The `pg_policies` query result from Item 3 (`orders`,
   `story_templates`, `generated_pages`).
5. ☐ The Authentication → URL Configuration page showing the Redirect
   URLs list (Item 4).

Keep these attached to whatever launch-readiness ticket/record tracks
this decision — they're the actual evidence that this checklist was run
and what it found, since no automated session in this engagement could
capture them directly.

## Summary sign-off

| #   | Item                                             | Status                             |
| --- | ------------------------------------------------ | ---------------------------------- |
| 1   | `user_roles` RLS                                 | ☐ Pass ☐ Fixed ☐ Failed — escalate |
| 2a  | `child-photos` bucket private                    | ☐ Pass ☐ Fixed ☐ Failed — escalate |
| 2b  | `child-photos` storage policies                  | ☐ Pass ☐ Fixed ☐ Failed — escalate |
| 3   | `orders`/`story_templates`/`generated_pages` RLS | ☐ Pass ☐ Fixed ☐ Failed — escalate |
| 4   | Auth redirect URLs + email confirmation          | ☐ Pass ☐ Fixed ☐ N/A               |
| 5   | Indexes                                          | ☐ Pass ☐ Fixed ☐ N/A               |

**Do not open this app to public traffic until items 1 and 2 both show
"Pass" or "Fixed."** Items 3-5 are strongly recommended before launch but
are not the same severity.

Checked by: ******\_\_\_****** Date: ******\_\_\_******
