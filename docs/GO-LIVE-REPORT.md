# Go-Live Report

Final Production Validation Sprint, Phases 4-7. Builds directly on
`docs/PRODUCTION-SUPABASE-AUDIT.md` (Phases 1-2) and
`docs/PAYMENT-FLOW-TRACE.md` (Phase 3) — read those first for the
detailed evidence behind the risk items below.

## Phase 4 — Admin surface validation

| Area               | Status                                                                                                                                                                                                                                                                | Evidence                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Order management   | ✅ Working                                                                                                                                                                                                                                                            | `OrdersManager.tsx` — status transitions, payment verify/reject (this sprint fixed the `paid_at` bug in the verify path), page generation, PDF export, publish-to-library, all gated by `assertAdmin()` server-side                |
| Analytics          | ✅ Working                                                                                                                                                                                                                                                            | `/admin/analytics` + `analytics.functions.ts`                                                                                                                                                                                      |
| Health dashboard   | ✅ Working                                                                                                                                                                                                                                                            | `/admin/health` — revenue/pending/stuck-order/conversion metrics, now more accurate after the `paid_at` fix                                                                                                                        |
| Reviews moderation | ✅ Working                                                                                                                                                                                                                                                            | Mounted in `/admin/approvals`, approve/reject/delete all wired                                                                                                                                                                     |
| Rewards management | 🚩 No admin UI exists                                                                                                                                                                                                                                                 | Carried over from the prior QA sprint, re-confirmed still true: no `adminListRewards`/`adminAdjustReward` function or route exists anywhere. Viewing or correcting a user's balance requires direct Supabase dashboard/SQL access. |
| Coupon management  | 🚩 No admin UI exists                                                                                                                                                                                                                                                 | Same gap, re-confirmed: no `adminListCoupons`/`adminCreateCoupon`. The 5 launch coupons were seeded via migration; creating a new one today requires direct DB access.                                                             |
| Referral oversight | ⚠️ Partial — `getMyReferralInfo` gives each user their own stats; no dedicated admin view of the `referrals` table exists (would need direct DB access to audit referral abuse patterns at scale, though the abuse vector itself is already closed at the code level) |

Neither of the 🚩 items are new — both were flagged in
`docs/FINAL-LAUNCH-REPORT.md` from the prior sprint and remain
unaddressed, since building them is feature work, explicitly out of
scope for "no feature development" sprints. They're repeated here
because a go-live decision should weigh them, not because they were
missed before.

## Phase 5 — Launch configuration

| Item                                        | Status                                                                                                                                                           | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SITE_URL`                                  | ✅ Correct                                                                                                                                                       | `src/lib/siteUrl.ts` defaults to `https://kidzy.life`, overridable via `VITE_SITE_URL` — **not set in this sandbox's `.env`**, so the app is currently running on the hardcoded fallback. ⚠️ Confirm the real Cloudflare Workers production environment either matches this domain or intentionally sets `VITE_SITE_URL` — a silent mismatch here would break canonical URLs, OG tags, and the sitemap's domain everywhere at once.                                                                                                                                |
| Sitemap                                     | ✅ Fixed and verified this sprint                                                                                                                                | Was hard-500ing on backend failure; now degrades to static paths (see `docs/FINAL-PRODUCTION-READINESS.md`)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Robots                                      | ✅ Working                                                                                                                                                       | Verified live in the previous sprint's browser session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Canonical URLs                              | ✅ Working                                                                                                                                                       | Present and per-page-dynamic on `stories.$slug` and others                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| JSON-LD / structured data                   | ✅ **Fixed this session** (see `docs/FINAL-PRODUCTION-READINESS.md`) — was silently broken on every page load until this sprint's real-browser testing caught it |
| Email provider                              | ✅ Correctly defaults to safe state                                                                                                                              | `EMAIL_PROVIDER` env var not set → `getEmailProvider()` defaults to `"mock"` — no real emails are sent. This is intentional per `docs/EMAIL-ARCHITECTURE.md` (infrastructure built, not yet activated). **Confirm this is still the desired state for launch** — if real transactional emails (order confirmation, payment verified, etc.) are expected at launch, `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` need to be set in the real production environment, and the template-sending call sites need to actually be wired in (per that doc, they aren't yet). |
| `SUPABASE_SERVICE_ROLE_KEY` / other secrets | ⚠️ Cannot verify from this session                                                                                                                               | This sandbox's `.env` doesn't have it (by design, for safety) — this says nothing about whether the _real_ Cloudflare Workers production environment has it configured. That must be confirmed directly in the Cloudflare dashboard, not inferred from this repo.                                                                                                                                                                                                                                                                                                  |

## Phase 6 — Risk classification

### CRITICAL

- **`user_roles` RLS policy unverified** (`docs/PRODUCTION-SUPABASE-AUDIT.md` §1). This table gates every admin check in the entire app. If it has no policy, or a policy that lets `authenticated` insert/update it, any signed-up user could grant themselves admin. **Must be checked with the provided `pg_policies` query before any public launch — this is the single highest-priority action across every sprint in this engagement.**
- **`child-photos` storage bucket unverified, public/private status unknown** (`docs/PRODUCTION-SUPABASE-AUDIT.md` §2.1). Real photos of real children, zero policy history in this repo. If the bucket is public and/or has no RLS policy, this is a real child-safety and privacy exposure, not just a generic access-control gap.

### HIGH

- **Custom-requested stories never receive rewards/XP/achievements** (`docs/PAYMENT-FLOW-TRACE.md`). A live, promoted, primary product path (`/request-story`) silently produces zero effect on the reward pipeline. Not a security issue, but a real, active product/business-logic gap affecting every custom order placed since this feature launched.
- **`orders`/`story_templates`/`generated_pages` RLS partially unverified** (`docs/PRODUCTION-SUPABASE-AUDIT.md` §1). Lower stakes than `user_roles` (INSERT on `orders` is well-guarded; the open question is UPDATE/DELETE/SELECT), but still needs the same live query run before launch.
- **`SITE_URL`/`VITE_SITE_URL` alignment with the real production environment is unconfirmed** — a mismatch would silently break canonicals, OG previews, and the sitemap domain across the entire site at once.

### MEDIUM

- **No admin UI for coupon or reward management** — operationally limiting as volume grows, not a security issue; workable at small scale via direct database access.
- **Email provider is mock by default** — intentional per its own docs, but confirm this matches launch intent; if real transactional emails are expected, activation work (provider config + wiring send calls into event flows) hasn't been done yet.
- **Coupon redemption count/per-user-cap check has a TOCTOU race** under true concurrency (`docs/FINAL-LAUNCH-REPORT.md`) — low real-world likelihood at this app's expected traffic scale.
- **No real Safari/Firefox browser testing has been performed**, across two consecutive QA sprints, purely for lack of those engines in any available environment.

### LOW

- **`has_role()` minor information leak** — any authenticated user can check whether an arbitrary other user ID is an admin, via direct RPC call. No privilege escalation, just a small enumeration leak.
- **`referrals` has no SELECT policy for the invited user** — no current UI depends on it, informational only.
- **`OrdersManager.tsx` table clips instead of scrolling on narrow viewports** — admin-only, desktop-oriented tool.
- **Duplicate `html2canvas`/`html2canvas-pro` dependency bundling** — a minor bundle-size inefficiency, not a correctness issue.
- **Cover images are oversized JPEGs for their display size** — a real performance opportunity, already thoroughly documented in `docs/PERFORMANCE-AUDIT.md`, deliberately deferred pending an image-pipeline decision.

## Phase 7 — Final decision

## GO LIVE WITH WARNINGS

The codebase is in genuinely strong shape after four consecutive
hardening/QA sprints: RLS is comprehensive and consistently
owner-scoped everywhere it's visible in this repo, the reward/referral/
coupon abuse vectors this whole engagement worried about were found and
closed, and this final sprint's real payment-flow trace and live browser
testing caught and fixed real, previously invisible defects (broken
JSON-LD on every page, a sitemap that hard-failed on backend hiccups, a
raw English error leaking into the Arabic UI) rather than turning up
nothing. That's a healthy signal, not a formality.

The decision is **not** a clean GO LIVE, for two reasons that are both
about verification, not code quality:

1. **Two CRITICAL items depend on a five-minute check in the Supabase
   dashboard that no session in this entire engagement has been able to
   perform** (`user_roles` RLS, `child-photos` bucket policy/visibility).
   Every other finding in this report assumes these come back clean.
   **Do not launch publicly until both are confirmed** — the exact
   queries to run are in `docs/PRODUCTION-SUPABASE-AUDIT.md` §1 and
   §2.1, and they take minutes, not hours.
2. **One HIGH item is a real, live product gap** (custom requests don't
   feed the reward system) that the business should explicitly accept or
   schedule a fix for, rather than launch unaware of it.

If both dashboard checks come back clean and the custom-request gap is
either accepted as known or scheduled, this becomes a clean **GO LIVE**.
As written today, with those two items still unconfirmed, it's **GO LIVE
WITH WARNINGS** — ship the code, but treat the dashboard checks as a
same-day, pre-traffic gate, not a someday-follow-up.

## Files changed

- `docs/PRODUCTION-SUPABASE-AUDIT.md` — Phase 1-2 deliverable.
- `docs/PAYMENT-FLOW-TRACE.md` — Phase 3 deliverable.
- `docs/GO-LIVE-REPORT.md` — this document, Phase 7 deliverable.

No code or migrations changed this phase — this sprint's scope was
verification and risk classification, not implementation. The bugs
referenced above as already fixed were fixed in earlier sprints in this
same engagement: the `paid_at` timestamp bug in the Final Pre-Launch QA
sprint, and the JSON-LD/sitemap/auth-error bugs in the Real Browser QA
sprint immediately before this one — both already committed and
reflected accurately in the traces above.
