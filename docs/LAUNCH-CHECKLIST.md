# Production Launch Checklist

Phase 9 of the Production Hardening & Launch Preparation Sprint. Every
item below reflects what has actually been verified/built across this
sprint's Phases 1-8 (and, where noted, Milestones 4/5) — not a generic
template. `☑` = verified/implemented and confirmed in this sprint or an
earlier one; `☐` = still needs a human action (a live-database check, a
manual test in a real browser/device, or a business decision) before
launch. Items that need a live action are followed by a one-line "how".

## Security

☑ RLS verified on all newly-tracked tables (`docs/SECURITY-AUDIT.md`):
`profiles` (fixed this sprint), `child_profiles`, `child_story_universe`,
`child_story_history`, `reward_accounts`, `reward_transactions`,
`referrals`, `reviews`, `favorites`, `coupons` (enumeration hole fixed
this sprint), `coupon_redemptions`, `admin_action_log`.

☐ RLS on tables predating migration history: `orders`, `user_roles`,
`story_templates`, `generated_pages`. **How**: in the Supabase dashboard,
open each table's RLS policies and confirm no permissive policy grants
broader access than intended — this repo's migration history can't
confirm these five tables' original policies (see
`docs/SECURITY-AUDIT.md` §3 and `docs/DATABASE-AUDIT.md` intro).

☑ Admin access verified: every admin server function calls
`assertAdmin()`/`has_role(auth.uid(), 'admin')`; every `_authenticated.admin.*`
route sits under the `_authenticated.admin` layout gate; `SECURITY DEFINER`
functions with elevated privilege (`grant_welcome_bonus`, `award_points`,
`complete_story_for_child`) are `REVOKE`d from `PUBLIC, anon, authenticated`.

☐ `trg_orders_on_sent()` missing a defensive `REVOKE` (no real exploit
path — trigger functions error if called directly outside trigger
context, per `docs/DATABASE-AUDIT.md` §4). **How**: cosmetic consistency
fix, low priority, can ship without blocking launch.

☑ Storage bucket ownership patterns verified: `story-pdfs`, `story-pages`,
`reference-children`, `payment-receipts` all scope reads to
`(storage.foldername(name))[1] = auth.uid()::text` or an order-ownership
`EXISTS` check, plus admin override (`docs/SECURITY-AUDIT.md` §5).

☑ `child-photos` hardened in code by
`20261006003500_harden_child_photos_rls.sql`: bucket forced private and
RESTRICTIVE owner-folder policies applied to SELECT/INSERT/UPDATE/DELETE.
After deploying the migration, verify the four policies exist in `pg_policies`
and `storage.buckets.public = false`.

☑ Referral abuse hardened this sprint: signup → pending referral → reward
only after first verified order (`docs/DATABASE-AUDIT.md`/Phase 2 commit).

☑ `SUPABASE_SERVICE_ROLE_KEY` and AI provider keys never imported outside
`.server.ts` files or dynamic `import()`s inside server handlers
(verified by grep across `src/` — no static top-level import of
`client.server.ts` anywhere in client-reachable code).

## Performance

☑ Bundle sizes measured against a real production build
(`docs/PERFORMANCE-AUDIT.md`): route-based code splitting confirmed
working; jspdf/html2canvas-pro (~186 KB gzip) moved off the story-detail
and admin-orders route chunks via dynamic import, verified in a rebuild.

☐ Cover images (`public/covers/*.jpg`) are oversized 1024×1024 JPEGs for
their ~250px display size — documented, deliberately deferred (needs an
image-pipeline decision, `docs/PERFORMANCE-AUDIT.md` §4). **How**:
decide on Supabase Storage transforms vs. build-time WebP generation
before scaling traffic; not a launch blocker on its own.

☑ Lazy loading: story/portfolio grid images use `loading="lazy"`; PDF
generation libraries load on-demand (this sprint's Phase 5 fix); the
homepage LCP hero image is explicitly eager with `fetchPriority="high"`.

☑ Caching: global `QueryClient` now has a `staleTime`/`gcTime` default
(this sprint's Phase 5 fix) in addition to the several components that
already tuned their own; router prefetching (`defaultPreload: "intent"`)
already correctly configured.

☑ Missing RLS-hot-path database indexes fixed this sprint
(`idx_orders_user_status`, `idx_generated_pages_order`,
`docs/DATABASE-AUDIT.md`).

## SEO

☑ Sitemap: `/sitemap.xml` route exists, lists static paths and
(presumably) dynamic story/template slugs — served with correct
`Content-Type`.

☑ Robots: `/robots.txt` route exists, allows crawling of public pages,
explicitly disallows authenticated-only paths (`/admin`, `/checkout`,
`/my-orders`, etc.), and points to the sitemap.

☑ Canonicals: present on `stories.$slug`, `stories.index`, `books`,
`games`, `help`, `contact`, `privacy`, `terms`, `refund-policy` (verified
via grep for `canonical` across `src/routes`).

☑ JSON-LD: `Organization` and `WebSite` structured data present in
`__root.tsx`'s head scripts, using the real production domain
(`kidzy.life`) via `SITE_URL`.

☐ Verify canonical URLs resolve to the live domain (not a staging/preview
URL) once deployed. **How**: view-source on the production site post-deploy
and confirm `<link rel="canonical">` points to `https://kidzy.life/...`.

## Browser

☐ Chrome — manual test required. **How**: run through
`docs/QA-CHECKLIST.md` end-to-end (auth, order flow, admin, PDF export)
in latest Chrome.

☐ Edge — manual test required (same checklist; Edge shares Chromium's
engine but test separately for Cloudflare/Workers edge-case rendering
and any Arabic RTL font-rendering differences).

☐ Firefox — manual test required, with particular attention to RTL
layout and any CSS Grid/Flexbox differences (Tailwind v4 is broadly
compatible, but this hasn't been visually verified in this environment).

☐ Safari — manual test required, with particular attention to: (a) date
inputs/`<input type="date">` styling differences, (b) `fetchPriority`
attribute support (added this sprint — gracefully ignored if unsupported,
not a functional blocker), (c) PDF download/share flow using
`navigator.share`/`navigator.canShare` (Safari has historically had the
most varied support for the Web Share API with files).

_(None of the four browser checks above could be performed in this
sandboxed environment — no real browser session was available for visual
QA. This is an explicit gap, not an oversight: flag before launch.)_

## Mobile

☐ Android — manual test required, focus on: WhatsApp share deep-link
flow (`shareWaLink`), photo upload from camera vs. gallery, RTL Arabic
keyboard input in forms.

☐ iPhone — manual test required, focus on: `navigator.share` PDF flow
(§Browser/Safari above), Safari's stricter Storage/cookie behavior for
the Supabase Auth session, home-screen/PWA-adjacent behavior if
applicable.

_(Same gap as Browser — no physical devices or mobile emulation were
available in this environment. Both need real-device QA before launch.)_

## Business

☑ Coupons: engine functional since Milestone 4 (percent/fixed discount,
category scoping, min-order, max-uses/max-uses-per-user, active window);
the enumeration hole (any authenticated user could list all coupon codes)
was fixed this sprint (`docs/SECURITY-AUDIT.md` §3.2).

☑ Referrals: functional since Milestone 4; abuse-hardened this sprint —
signup no longer immediately grants the inviter's point reward, only a
pending record is created, and the inviter is rewarded only after the
invited user's first verified order (Phase 2 this sprint). The invited
user's welcome coupon is still issued at signup (self-limiting, no cash
value, preserves the existing "10% off your first order" promise).

☑ Rewards: `reward_accounts`/`reward_transactions` + `award_points` RPC
functional since Milestone 5; welcome bonus, referral reward, story
completion reward, review reward all wired.

☐ Rewards redemption at checkout: `docs/DEVELOPMENT-PLAN.md`/Milestone 2
status already flagged this as unverified — **no evidence found in this
sprint either** of `points_used`/`points_discount_egp` actually wired
into the checkout total calculation. **How**: confirm with the team
whether points redemption at checkout is an intended launch feature; if
so, it needs its own implementation pass (out of scope for this
hardening-only sprint).

☑ Reviews: functional since Milestone 4 — admin-moderated (`is_published`
gate), reward-on-review wired, powers both the dedicated reviews section
and the portfolio gallery's star ratings.

## Summary of items requiring action before launch

| Category    | Action needed                                                                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security    | Manually verify RLS on `orders`, `user_roles`, `story_templates`, `generated_pages`, `child-photos` bucket in the Supabase dashboard (these predate migration history) |
| Performance | Decide on an image pipeline for cover photos (deferred, not urgent)                                                                                                    |
| SEO         | Spot-check canonical URLs resolve to the live domain post-deploy                                                                                                       |
| Browser     | Run `docs/QA-CHECKLIST.md` manually in Chrome, Edge, Firefox, Safari — not performed in this environment                                                               |
| Mobile      | Run through the same checklist on a real Android and iPhone device — not performed in this environment                                                                 |
| Business    | Confirm with the team whether reward-points checkout redemption is expected at launch; it does not appear wired yet                                                    |

## Files changed

- `docs/LAUNCH-CHECKLIST.md` — this document.

No code or migrations changed this phase (checklist compilation from the
prior 8 phases' verified findings).
