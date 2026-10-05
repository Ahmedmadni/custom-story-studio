# Final Pre-Launch QA Report

Final Pre-Launch QA Sprint. **Methodology note, read first**: this repo's
`.env` points at the **live production Supabase project**
(`uhvzhbiqywmpvbmalyph`), and there is no staging environment or real
browser/device available in this sandboxed session. Rather than write
test data into production or skip testing silently, this QA pass was run
as a **code-trace audit** — every flow below was verified by reading the
actual route, server-function, RLS, and trigger code that implements it
(the same method used for the security/database audits in the prior
hardening sprint), not by clicking through a live deployment. Three real
bugs were found and fixed this way (§"Fixes Applied"). Anything that
_requires_ a live browser/device/production click-through is explicitly
called out as **not performed** rather than assumed to pass.

## Phase 1 — End-to-End User Flow (code-traced)

| #   | Step                  | Result                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Registration          | ✅ Pass                   | `supabase.auth.signUp` with `display_name` metadata; Supabase Auth handles its own confirmation email independently of this app's (currently mock) `EmailProvider`.                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | Onboarding            | ✅ Pass                   | `OnboardingWizard` + `profiles.onboarding_completed_at`, `localStorage` mirror prevents flash-of-wizard on repeat visits.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | Create child profile  | ✅ Pass                   | Direct client insert into `child_profiles`, RLS-scoped to `auth.uid()`. The companion `child_story_universe` insert is now checked; if it fails, the just-created child profile is removed so the user is not left with a partially initialized record. |
| 4   | Browse stories        | ✅ Pass                   | `/stories`, `/books` — public read via RLS-open `story_templates` SELECT grant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | Add favorites         | ✅ Pass                   | `favorites` table, owner-scoped RLS, `UNIQUE(user_id, template_id)` prevents duplicates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 6   | Select child          | ✅ Pass                   | Client-side selection, no server round-trip needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 7   | Create order          | ✅ Pass                   | `submitCheckout`/order routes validate via Zod, price computed server-side from `pricePerPages`/package tier — not client-supplied.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 8   | Apply coupon          | ✅ Pass                   | Validation remains server-side, and redemption now uses the deployed `consume_coupon_redemption` RPC. The coupon row is locked while global/per-user limits, ledger insertion, and `used_count` increment are applied atomically. |
| 9   | Vodafone Cash payment | ✅ Pass                   | Receipt upload → `payment_status: "receipt_uploaded"`; order correctly blocked from proceeding until admin action.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 10  | Admin verification    | 🐛 **Bug found & fixed**  | `adminVerifyPayment` set `payment_verified_at` but never updated `paid_at` — see Fixes Applied #1.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 11  | Story completion      | ✅ Pass                   | Admin sets `status: "sent"` → `trg_orders_on_sent` trigger → `complete_story_for_child()`, idempotent (guarded by an existing `child_story_history` row check).                                                                                                                                                                                                                                                                                                                                                                                                 |
| 12  | XP award              | ✅ Pass                   | `calc_child_level`/XP tiers computed correctly inside the same function, atomic with the history insert.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 13  | Reward points         | ✅ Pass                   | `award_points()` ledger pattern used consistently for signup/referral/story-completion/review rewards — single audit trail.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 14  | Achievement unlock    | ✅ Pass                   | Category-matching `ILIKE` queries against `child_story_history`, correct threshold logic (verified against `docs/DATABASE-AUDIT.md`'s prior read of this function).                                                                                                                                                                                                                                                                                                                                                                                             |
| 15  | Level-up flow         | ✅ Pass                   | `LevelUpWatcher` component + `calc_child_level`, client-visible via `_authenticated.children.$id.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 16  | Review submission     | ✅ Pass                   | Ownership check (`order.user_id === context.userId`), `status='sent'` gate, `UNIQUE(order_id)` mapped to a friendly Arabic message on conflict, 30-point reward.                                                                                                                                                                                                                                                                                                                                                                                                |
| 17  | Referral reward       | ✅ Pass                   | Hardened in the prior sprint: signup → pending → reward only after first verified order; correctly hooked into both `adminVerifyPayment` and the Kashier webhook.                                                                                                                                                                                                                                                                                                                                                                                               |

**Not performed** (requires a live browser): actually submitting a form,
observing toast timing/animation, testing the multi-step wizard's back/
forward UX, or confirming the AI generation pipeline's real output
quality. These are runtime/visual concerns a code trace cannot verify.

## Phase 2 — Permission Testing (code-traced)

| Check                                  | Result                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User cannot access another user's data | ✅ Pass                                    | RLS `auth.uid() = user_id` (or an ownership `EXISTS` join) on every user-scoped table; verified no query anywhere trusts a client-supplied user ID over `auth.uid()`/`context.userId`.                                                                                                                                                                                                                                                                                                                           |
| Parent cannot access another child     | 🐛 **UX bug found & fixed**                | RLS already blocked the _data_ correctly, but two routes (`_authenticated.children.$id.tsx`, `.edit.tsx`) got stuck on an infinite loading spinner instead of a "not found" message when RLS denies access — see Fixes Applied #2/#3. No data leak existed; this was purely a stuck-UI bug.                                                                                                                                                                                                                      |
| Rewards cannot be manipulated          | ✅ Pass                                    | `reward_accounts`/`reward_transactions` have `GRANT UPDATE/INSERT` to `authenticated` at the table level, but **no RLS `UPDATE` policy exists for either table** — Postgres RLS defaults to deny when no policy matches, so the grant is inert; the only way to change a balance is `award_points()` (`SECURITY DEFINER`, revoked from `authenticated`), callable only server-side via `supabaseAdmin`.                                                                                                          |
| Referrals cannot be abused             | ✅ Pass                                    | Hardened last sprint (pending → reward-after-first-verified-order); re-verified the wiring is intact in both `adminVerifyPayment` and the Kashier webhook.                                                                                                                                                                                                                                                                                                                                                       |
| Admin routes are protected             | ✅ Pass                                    | Two layers: client-side UX guard (`isAdmin` check in `_authenticated.admin.tsx`, purely cosmetic) plus the real boundary — every admin server function calls `assertAdmin()`/`has_role()` server-side, and RLS has an admin-override policy on every table. SSR never renders authenticated/admin content prematurely, since the outer `_authenticated.tsx` gate always renders a loading spinner (not `<Outlet/>`) while `loading` is true, which it always is during SSR (auth state is client-hydrated only). |
| Storage permissions are correct        | ✅ Pass — live verified                    | `story-pdfs`, `story-pages`, `reference-children`, and `payment-receipts` are owner/order-scoped. On the live Supabase project, `child-photos` is private and all four RESTRICTIVE owner-folder policies (SELECT/INSERT/UPDATE/DELETE) are present. |

## Phase 3 — Mobile Responsiveness (static review — no real device/browser available)

- Viewport meta tag present (`width=device-width, initial-scale=1`).
- Spot-checked `checkout.tsx` (a core user-facing flow): correctly
  mobile-first (`grid gap-4 md:grid-cols-2` pattern — single column by
  default, multi-column only at larger breakpoints).
- **Fixed**: `OrdersManager.tsx` now uses horizontal overflow on narrow
  screens, so the admin order table no longer clips wide columns on mobile.
- **Not performed**: actual rendering on iPhone Safari, Android Chrome,
  or a tablet — no device or browser available in this environment. This
  gap was already flagged in `docs/LAUNCH-CHECKLIST.md` from the prior
  sprint and remains open.

## Phase 4 — Admin Workflow

| Area                  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Order management      | ✅ Confirmed working — `OrdersManager.tsx` covers status transitions, payment verify/reject, page generation, PDF export, publish-to-library.                                                                                                                                                                                                                                                                                                                       |
| Reviews moderation    | ✅ Confirmed working — `ReviewsModerationList` mounted inside `/admin/approvals`, approve/reject/delete all wired to `adminModerateReview`.                                                                                                                                                                                                                                                                                                                         |
| Analytics             | ✅ Confirmed working — `/admin/analytics` + `analytics.functions.ts`.                                                                                                                                                                                                                                                                                                                                                                                               |
| Health dashboard      | ✅ Confirmed working (and its "revenue today" figure just got more accurate — Fix #1).                                                                                                                                                                                                                                                                                                                                                                              |
| **Reward management** | ✅ Added — `/admin/commerce` lists real user balances and lifetime points and supports audited +/- balance adjustments. Adjustments run through the service-role-only `admin_adjust_reward_points` RPC with row locking and a no-negative-balance guard. |
| **Coupon management** | ✅ Added — `/admin/commerce` lists, creates, edits, activates, and deactivates coupons, including validity windows and usage limits. Used coupon codes cannot be renamed, and financial checkout redemption remains protected by the atomic locked redemption RPC. |

## Phase 5 — SEO Validation

| Check           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sitemap         | ✅ `/sitemap.xml` present, lists static + dynamic paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Robots          | ✅ `/robots.txt` present, correctly disallows authenticated-only paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Canonical tags  | ✅ Present and correctly per-page-dynamic (e.g. `stories.$slug.tsx` builds `${SITE_URL}/stories/${params.slug}` from the actual route param).                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| OpenGraph       | ⚠️ **Gap found**: site-wide OG tags (`og:title`, `og:description`, `og:image`, `og:type`) are set once in `__root.tsx` and are **never overridden per-page**. Concretely: sharing a specific story link via WhatsApp shows generic "Kidzy" branding, not that story's title/cover — undercutting the app's own "شارك عبر واتساب" (share via WhatsApp) feature's social proof value. Also, `stories.$slug.tsx`'s `<title>` is a static "معاينة القصة — كيدزي" for every story, not the actual story's title, which is a mild but real duplicate-title SEO issue across the entire story catalog. |
| JSON-LD         | ✅ `Organization` + `WebSite` structured data present in `__root.tsx`, using the real domain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Structured data | ✅ Same as above; no per-story `Product`/`Article`/`BreadcrumbList` structured data exists, which is a missed (not broken) SEO enhancement opportunity.                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Why the OpenGraph/title gap wasn't fixed here**: `stories.$slug.tsx`'s
`head()` function only receives route `params`, not the story's fetched
data (title/summary/cover are loaded client-side via `useQuery`, not a
route `loader`). Making `head()` dynamic per-story would require
converting this route to use a TanStack Router `loader` so `head()` can
read `loaderData` — a real architectural change to the route, not a
one-line patch, and risks introducing new SSR/data-fetching bugs without
proper testing. Flagged as a valuable follow-up, not attempted under this
sprint's "no refactoring" constraint.

## Phase 6 — Performance Validation

No new measurement was needed this phase — none of this QA sprint's
three code fixes touch bundle composition, and the prior sprint's
`docs/PERFORMANCE-AUDIT.md` already measured a real production build
(route splitting confirmed working, PDF libraries moved off eager route
chunks, sensible `QueryClient` caching defaults added). Re-confirmed
those findings are still accurate by inspecting the diffs made this
session (two route files + one server function — none touch imports of
heavy dependencies). **Not performed**: a live Lighthouse/Web Vitals run
against a real deployment — no browser available in this environment;
see `docs/PERFORMANCE-AUDIT.md` for what _was_ measured.

## Fixes Applied

1. **`adminVerifyPayment` didn't update `paid_at`** (`src/features/admin/admin.functions.ts`).
   For Vodafone Cash orders, `paid_at` was stamped at receipt-upload time,
   not at actual admin verification — while Kashier and admin-direct
   orders correctly stamp it at confirmation time. Since
   `/admin/health`'s "revenue today" query filters on
   `payment_status='verified' AND paid_at >= todayStart`, this
   systematically miscounted revenue whenever verification happened on a
   different day than upload (the common case). **Fix**: `adminVerifyPayment`
   now also sets `paid_at: new Date().toISOString()`, making `paid_at`
   consistently mean "payment confirmed" across all three order-creation
   paths.

2. **Infinite loading spinner on an inaccessible/nonexistent child profile**
   (`src/routes/_authenticated.children.$id.tsx`). The query used
   `.single()` (throws on zero rows — which is exactly what RLS returns
   for another user's child or a deleted/invalid ID) but the render guard
   only checked `isLoading || !child` as one condition, so once the query
   settled into an error state (`isLoading: false`, `data: undefined`),
   the page stayed on the loading spinner forever instead of showing a
   clear message. RLS was never at risk (no data was ever exposed — this
   was a pure UI dead-end), but it's a real, reachable dead-end for any
   user who follows a stale/incorrect child link. **Fix**: destructured
   `error` from the query, added `retry: false` (an RLS/not-found denial
   is permanent, not worth React Query's default 3 retries), and added a
   proper "لم نجد ملف هذا الطفل" (child profile not found) empty state
   with a link back to `/my-children`.

3. **Same bug, same fix**, in `src/routes/_authenticated.children.$id.edit.tsx`
   (the edit page uses an identical query pattern).

All three fixes verified with `tsc --noEmit` and `eslint` — both clean.

## Open Issues / Backlog (not fixed — feature gaps or out-of-scope refactors)

| #   | Issue                                                                                  | Category         | Why not fixed now                                                                |
| --- | -------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| 1   | Admin reward-balance management                                                       | ✅ Fixed          | `/admin/commerce` now exposes balances and audited row-locked adjustments       |
| 2   | Admin coupon management                                                               | ✅ Fixed          | `/admin/commerce` now supports create/edit/activate/deactivate and usage limits |
| 3   | Coupon redemption concurrency race                                                     | ✅ Fixed          | `consume_coupon_redemption` now locks the coupon row and performs limits + ledger insert + counter increment atomically |
| 4   | Per-story `<title>`/OpenGraph tags                                                   | ✅ Fixed          | `/stories/$slug` uses a loader + dynamic title/description/OG/Twitter/canonical metadata |
| 5   | Admin orders table mobile clipping                                                     | ✅ Fixed          | Wrapper now uses horizontal scrolling                                            |
| 6   | `child-photos` owner isolation                                                       | ✅ Fixed + live verified | Restrictive RLS is deployed; bucket is private and all four restrictive policies are present |
| 7   | No real browser/device testing performed anywhere in this QA pass                      | Testing gap      | No staging environment or browser/device available in this sandboxed session     |

## Launch Blockers

**None found that are code-fixable within this sprint's constraints.**
The two items that could plausibly block a _responsible_ launch are not
code bugs:

- **Item 7 above (no real browser/device QA)** — this is the single
  biggest actual risk to a smooth launch, purely because it hasn't been
  done anywhere, by anyone, on this codebase, in any session. Code
  correctness does not guarantee visual/interaction correctness across
  Safari/Chrome/Firefox/mobile.
- **Child-photo storage is now verified on the live database**: the bucket is private and the four restrictive policies are active.

## Risk Assessment

| Area                                    | Risk level  | Basis                                                                                                                                                                 |
| --------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core user flow correctness (code-level) | Low         | All 17 traced steps check out; the one real functional bug found (revenue timestamp) is fixed and doesn't affect user-facing behavior, only an internal admin metric. |
| Data isolation / permissions            | Low         | RLS is comprehensive and consistently owner-scoped + admin-override; the one UI bug found never exposed data, only got stuck.                                         |
| Admin operability                       | Low         | Coupons and reward balances are now manageable from `/admin/commerce`, with audit logging and row-locked reward adjustments.                                         |
| SEO / social sharing                    | Low         | Sitemap/robots/canonicals/JSON-LD are present and story pages now emit dynamic title/description/OG/Twitter/canonical metadata.                                      |
| Visual/cross-browser/mobile correctness | **Unknown** | Never tested in any session on this codebase — this is a genuine unknown, not a "low risk," and should be treated as such.                                            |
| Database backup/recovery posture        | Medium      | Documented in `docs/BACKUP-PLAN.md` — PITR/Storage backup coverage unconfirmed.                                                                                       |

## Production Readiness Score

**8.5 / 10** — the remaining risk is now concentrated outside the core
application logic. The coupon race, child-photo isolation, coupon/reward
admin tooling, and per-story social metadata gaps are closed; the relevant
database migrations are deployed and the legacy `orders`, `user_roles`,
`story_templates`, and `generated_pages` tables were read-only verified
with RLS enabled on the live Supabase project. The main unresolved items are
real browser/device QA, backup/PITR confirmation, and restoring the GitHub
Actions runner that is currently failing before any CI step starts.

## Launch Recommendation

## READY FOR CONTROLLED BETA — WITH EXTERNAL QA

From a code and live-database-permission perspective, the previously identified
launch gaps are closed. Before calling the release fully verified for a broad
public launch:

1. Run `docs/QA-CHECKLIST.md` in a real desktop browser and on at least one
   real phone. Visual/interaction behavior is the largest remaining unknown.
2. Confirm the production backup/PITR and storage-backup posture described in
   `docs/BACKUP-PLAN.md`.
3. Restore GitHub Actions execution. Recent workflow jobs are failing before
   the first step starts (no checkout/typecheck/test/build steps execute), so
   that is currently a CI-infrastructure warning rather than an application
   test failure.

Live checks completed in this follow-up:
- `consume_coupon_redemption(uuid,uuid,uuid,integer)` exists in production.
- `admin_adjust_reward_points(uuid,integer,uuid,text)` exists in production.
- `child-photos` is private with four RESTRICTIVE owner policies.
- RLS is enabled on `orders`, `user_roles`, `story_templates`, and
  `generated_pages`.

## Files changed

- `src/features/admin/admin.functions.ts` — `paid_at` fix in `adminVerifyPayment`.
- `src/routes/_authenticated.children.$id.tsx` — error-state handling fix.
- `src/routes/_authenticated.children.$id.edit.tsx` — same fix.
- `docs/FINAL-LAUNCH-REPORT.md` — this document.

No migrations this phase. `tsc --noEmit` and `eslint` clean on all
touched files.
