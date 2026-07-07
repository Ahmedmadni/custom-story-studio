# Changelog

All notable changes to Kidzy (حكايتي) are documented here. This is the
first public beta release.

## [1.0.0-beta.1] — Unreleased

### Major features

- **Story & book ordering** — parents upload a child's photo and details,
  choose a library template or request a fully custom story idea, and
  receive an illustrated, personalized story or educational book as a
  print-ready PDF, deliverable via WhatsApp.
- **Child Profiles & Story Universe** — each child gets a persistent
  profile (name, age, photo, personality traits) and a "Story Hero"
  progression system: XP per completed story, 10 leveling tiers, and
  category/count-based achievements (first story, reader, explorer,
  legend, plus category specialists like adventure/space/animal/bedtime/family).
- **Rewards** — a points ledger (`reward_accounts`/`reward_transactions`)
  fed by a single consistent `award_points()` path: signup welcome bonus,
  referral reward, story-completion reward, and review-submission reward.
- **Referrals** — every user gets a shareable referral code; hardened
  during this release cycle so the inviter is rewarded only after the
  invited user's first _verified_ order, not at signup, closing a
  fake-signup-farming vector while preserving the invited user's
  immediate welcome coupon.
- **Coupons** — percent/fixed discounts with category scoping, minimum
  order thresholds, and global/per-user usage caps.
- **Reviews** — admin-moderated parent reviews, powering both a
  dedicated reviews section and star ratings on the public portfolio
  gallery of real delivered stories.
- **Admin dashboard** — order management (status pipeline, payment
  verify/reject, page generation, PDF export, publish-to-library),
  analytics, a health dashboard (revenue/conversion/stuck-order
  monitoring), reviews moderation, and role management.
- **SEO** — sitemap, robots.txt, per-page canonical URLs, and
  Organization/WebSite/FAQPage structured data.
- **Onboarding, Help Center, legal pages, trust components** — first-time
  user wizard, FAQ/help center, privacy/terms/refund-policy pages, and
  trust-building UI (delivery timers, recent activity, portfolio gallery,
  social proof counters).

### Security improvements

- Enabled and verified row-level security on `profiles` (previously had
  no RLS at all — any authenticated user could read/write any other
  user's profile row via direct PostgREST access).
- Closed a coupon-code enumeration hole (any authenticated user could
  list every active coupon code, including single-use referral codes
  meant for one specific invited user).
- Referral abuse hardening: signup → pending referral → reward only
  after the invited user's first verified order, replacing the previous
  reward-at-signup model.
- Added an append-only `admin_action_log` audit table (role grants/
  revokes, payment verify/reject), with `actor_id` set to `ON DELETE SET
NULL` rather than `CASCADE` so audit history survives even if the
  actor account is later removed.
- Verified consistent server-side authorization: every admin server
  function gates on `assertAdmin()`/`has_role()`, and the service-role
  Supabase client is always dynamically imported inside handler bodies —
  never statically imported into any code path reachable by the client
  bundle.
- Investigated the framework's CSRF middleware warning and confirmed no
  live exploit path exists for this app's auth architecture
  (`localStorage`-based bearer tokens, no cookies, no ambient credential
  for a cross-site request to ride).
- Centralized error handling (`AppError` hierarchy, Supabase/PostgREST
  error normalization to safe Arabic messages, a React `ErrorBoundary`
  alongside the router's own `errorComponent`).
- Centralized observability groundwork: the new `admin_action_log` table,
  plus documentation of what already existed (`payment_logs` webhook
  audit trail, the health dashboard).

### QA & production validation

This release went through four consecutive dedicated hardening/QA
passes, documented in full under `docs/`:

- `docs/SECURITY-AUDIT.md`, `docs/DATABASE-AUDIT.md` — static audits of
  RLS, storage policies, triggers, RPC permissions, and indexes across
  every table.
- `docs/PERFORMANCE-AUDIT.md` — a real production build inspection: PDF
  generation libraries (jspdf/html2canvas-pro, ~186 KB gzip) were being
  eagerly bundled into the story-detail and admin-orders pages and are
  now loaded on demand; added sensible React Query caching defaults.
- `docs/FINAL-LAUNCH-REPORT.md`, `docs/FINAL-PRODUCTION-READINESS.md` —
  code-trace and (where the environment allowed) real-browser QA of the
  full user journey, permission boundaries, admin workflow, SEO, and
  responsive layout (16 device/page combinations tested, zero horizontal
  overflow found).
- `docs/PRODUCTION-SUPABASE-AUDIT.md`, `docs/PAYMENT-FLOW-TRACE.md`,
  `docs/GO-LIVE-REPORT.md` — a mutation-by-mutation trace of the full
  payment → reward pipeline, and a formal CRITICAL/HIGH/MEDIUM/LOW risk
  classification.
- Real-browser testing (Chromium via Playwright) caught and fixed three
  defects invisible to static code review: JSON-LD structured data was
  silently broken on _every page load_ (a script-tag shape mismatch with
  the installed router version meant the browser tried to execute the
  JSON payload as JavaScript), `/sitemap.xml` hard-failed with a 500 on
  any backend hiccup instead of degrading gracefully, and a raw English
  "Failed to fetch" error could leak into the otherwise fully-Arabic auth
  UI on network failure.
- A full mutation trace of the reward pipeline (`docs/PAYMENT-FLOW-TRACE.md`)
  found and this release fixes a real gap: the custom-story-request flow
  (`/request-story`) never linked orders to a child profile, so every
  custom-requested story silently produced zero XP/reward/achievement
  effect. It now offers the same optional child picker as the standard
  checkout flow.
- Fixed a revenue-reporting bug: the admin health dashboard's "revenue
  today" figure filtered on `paid_at`, but for Vodafone Cash orders that
  timestamp was set at receipt-upload time rather than admin-verification
  time — payments verified today could be systematically excluded from
  today's total if uploaded on a prior day. `paid_at` now updates at
  verification, matching how card (Kashier) payments already behaved.

### Known limitations

- **`user_roles` RLS and the `child-photos` storage bucket's policies
  could not be verified against the live production database from any
  session in this engagement** (sandboxed environments here have no
  route to the production Supabase project). See
  `docs/SUPABASE-MANUAL-CHECKLIST.md` — this is a required manual
  pre-launch step, not optional.
- No admin UI exists yet for coupon or reward-balance management;
  both require direct Supabase dashboard/SQL access today.
- Email sending infrastructure is built (`docs/EMAIL-ARCHITECTURE.md`)
  but defaults to a mock provider — no real transactional emails are
  sent yet.
- No real Safari or Firefox browser testing has been performed in this
  engagement (only Chromium/Chrome-Edge was available in every testing
  environment used) — responsive layout and JS behavior are verified on
  Chromium only.
- Cover images are oversized JPEGs relative to their display size; a
  real but deliberately deferred performance opportunity pending an
  image-pipeline decision.
- A coupon redemption count/per-user-cap race condition exists under
  true concurrent checkout requests for the same coupon (low real-world
  likelihood at expected launch traffic).
- Printing/physical fulfillment, audio stories, and a native mobile app
  are not built — see `docs/ARCHITECTURE.md`'s "Deferred systems"
  section.
