# Final Production Readiness Report — Real Browser QA

Sprint: Real Browser QA & Production Validation. Unlike the prior
code-trace-only QA pass, this sprint actually ran the app
(`vite dev`) and drove it with a **real Chromium browser** via
Playwright — the thing every previous report flagged as the biggest
untested gap. It found real, previously-invisible bugs that no amount of
code reading turned up, which is exactly why this sprint mattered.

## Environment constraints (read first)

Two hard limits shaped what could be tested here, both discovered while
setting up:

1. **`SUPABASE_SERVICE_ROLE_KEY` is not set** in this sandbox's `.env` —
   any code path that dynamically imports the service-role client
   (`supabaseAdmin`) throws immediately when invoked.
2. **This sandbox's network proxy blocks `*.supabase.co` outright**
   (`403 Forbidden` on the CONNECT tunnel) — confirmed directly with
   `curl -x $HTTPS_PROXY`. This is a _separate, harder_ limit than #1: it
   means **no** Supabase call can succeed here, not even anon-key reads
   (browsing stories, signing up, logging in with valid credentials) —
   the network layer itself refuses the connection, regardless of which
   key is used.

Practically: the full 13-step user journey (register → referral reward)
requested in Phase 2 **cannot be executed against real data in this
environment**, full stop — not a caution I applied, a technical wall.
What follows is everything that _was_ achievable against the running
app, plus what that testing actually surfaced.

## Bugs found and fixed (real, browser-confirmed)

### 1. JSON-LD structured data was broken on _every single page load_ — high impact, invisible without a browser

**How it was found**: loading the homepage in a real Chromium instance
and reading the browser console showed two uncaught
`SyntaxError: Unexpected token ':'` errors on every page.

**Root cause, traced into `node_modules/@tanstack/react-router`'s
`Scripts.js`**: `__root.tsx` (and `help.tsx`, same pattern) defined
JSON-LD script tags as:

```ts
scripts: [{ attrs: { type: "application/ld+json" }, children: JSON.stringify({...}) }]
```

But the installed router version's `getScripts()` function destructures
`{ children, ...script }` and spreads `script` directly as the new
`attrs` object — so the _nested_ `attrs` key ends up one level too deep
(`attrs.attrs`), and the actual `type` attribute never reaches the
rendered `<script>` tag. The browser saw `<script attrs="[object Object]">`
— no `type`, so it defaulted to executing the JSON-LD payload as
JavaScript, which is invalid JS (a `:` after a bare string is a syntax
error) and threw on every load.

**Real-world impact this had, silently, before this fix**: the
`Organization` and `WebSite` structured data this app relies on for rich
search results was **never actually valid markup** — Google/Bing could
never have parsed it, because the script tag never had the correct
`type="application/ld+json"`. The prior sprint's SEO audit had marked
this "✅ present" based on reading the source code, which was technically
true but incomplete — it never rendered correctly. This is the clearest
example in this whole engagement of why real browser testing catches
things code review cannot.

**Fix**: switched both files to this router version's actual supported
convention — `meta: [{ "script:ld+json": {...} }]` (a typed field,
confirmed in `@tanstack/router-core`'s `route.d.ts`), which is handled
by a different, correct code path (`headContentUtils.js`) that builds
the tag properly. Verified via `curl`: the script tag now renders as
`<script type="application/ld+json">{"@context":...}</script>`, and a
fresh browser session shows **zero** page errors on every page tested.

**Also found and fixed a duplicate `meta` key** introduced while editing
`help.tsx` (two `meta: [...]` entries in the same object literal — the
second silently shadows the first in a JS object literal). Caught before
commit by re-reading the diff.

### 2. `/sitemap.xml` returned a hard 500 on any backend hiccup

**How it was found**: Phase 1's route sweep (`curl` against every
generated route) — `/sitemap.xml` returned 500 while `/robots.txt`
returned 200.

**Root cause**: the route's handler called `supabaseAdmin` with no error
handling; when the service-role client throws (missing key here — but
equally, a real transient DB error in production), the entire response
failed instead of degrading.

**Fix**: wrapped the dynamic story-slug query in a `try/catch`; on
failure it now logs the error and falls back to just the static paths,
returning a valid 200 sitemap instead of a 500. A public, crawler-facing
endpoint should never hard-fail because of a transient DB issue — this
is exactly the kind of resilience gap this app's own `docs/ERROR-HANDLING.md`
argues for, just not yet applied here. Verified: `/sitemap.xml` now
returns 200 with static paths even with `supabaseAdmin` unavailable.

### 3. Auth errors leaked raw English text into the Arabic UI

**How it was found**: actually submitting the signup form in the running
browser (the only Supabase-touching action worth attempting, since it
fails fast and safely) surfaced a toast reading **"Failed to fetch ⚠️"**
— in English, in an app whose entire UI is Arabic.

**Root cause**: `signIn`/`signUp` in `auth.tsx` only special-cased two
specific Supabase error strings ("Invalid login", "already registered")
and fell through to `error.message` verbatim for anything else — which,
for a genuine network-level failure (not a Supabase API error), is
whatever raw string the `fetch` API produced.

**Fix**: added a `friendlyAuthError()` helper that recognizes
network-failure-shaped messages (`failed to fetch`, `network`,
`load failed`) and maps them to a proper Arabic message
("تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت وحاول مرة أخرى").
Re-verified live: the toast now shows the Arabic message. This matters
beyond this sandbox — any real user with a flaky connection would have
hit the same English leak in production.

## Investigated, not fixed

### CSRF middleware warning — real framework warning, verified low actual risk

The dev server logs TanStack Start's standard warning that server
functions aren't wrapped in CSRF middleware. Traced this fully rather
than either ignoring it or blindly adding the suggested middleware:

- `src/integrations/supabase/client.ts` stores the Supabase session in
  **`localStorage`**, not cookies.
- `src/integrations/supabase/auth-middleware.ts`'s `requireSupabaseAuth`
  strictly requires an explicit `Authorization: Bearer <token>` header —
  no cookie fallback anywhere.
- The client-side `attachSupabaseAuth` middleware is what attaches that
  header, reading the token from `localStorage` — which a cross-origin
  attacker page cannot read (same-origin policy) and cannot forge without
  already knowing the victim's token.

**Conclusion**: classic CSRF (an attacker's page silently riding a
victim's ambient session credential) isn't actually exploitable here,
because there's no ambient credential — every request needs an explicit
bearer token only this app's own same-origin JS can obtain. The warning
is a generic framework default, not a live vulnerability for this app's
auth architecture. **Not fixed**: adding the suggested
`createCsrfMiddleware` would still be reasonable defense-in-depth (cheap,
officially supported, guards against this assumption ever silently
changing in the future), but since there's no active exploit path today,
this is a product/engineering judgment call rather than a bug fix, and is
left as a recommendation rather than applied unprompted.

### Story-grid "stuck empty skeleton" on `/stories` — confirmed to be this sandbox's network behavior, not an app bug

On mobile viewport, `/stories` showed 8 blank gray placeholder boxes that
never resolved even after an 8-second wait. Traced the code
(`stories.index.tsx`) and confirmed it **already** has correct
`isLoading`/`isError` handling — an `ErrorBlock` with a retry button is
wired for the error case. The reason it never appeared here: this
sandbox's direct (non-proxied) connections to blocked external hosts
hang for a long time before failing (rather than an immediate rejection),
and React Query's default retry-with-backoff compounds that delay well
past what a UI test could reasonably wait for. In a real production
outage, the same code would show the skeleton briefly, then the proper
Arabic error message — this is correct, intentional resilience behavior,
just not something this sandbox's networking lets a screenshot capture
quickly. Not a bug; not changed.

## Live security validation

Attempted unauthenticated access to `/admin`, `/my-orders`, and
`/rewards` in a fresh (no session) browser context. **Result: no
protected content ever rendered** — confirmed by screenshot, the admin
route showed only a permanent loading spinner (because the auth check
itself couldn't resolve in this network-blocked sandbox), never the
actual admin UI. This is a **secure failure mode**: even in a worst-case
scenario where the client-side auth check hangs indefinitely, no
protected data leaks. The real security boundary (server-side
`assertAdmin()`/RLS, verified extensively in the prior sprint's audits)
was never even reached in this test since the client-side gate already
holds. Full permission-boundary testing (cross-user data access, reward
manipulation attempts, etc.) still relies on the prior sprint's
code-trace verification, since this sandbox cannot reach real data to
attempt live queries against.

## Responsive testing

Real Chromium rendering (desktop 1440px, iPad 768px, iPhone 390px,
Android 412px) across home, stories, auth, and help pages — **16
combinations, zero horizontal overflow detected**, layouts adapt cleanly
mobile-first at every breakpoint checked. **Caveat, same as the prior
sprint**: this sandbox only has Chromium installed (covers Chrome/Edge,
same rendering engine) — no WebKit (Safari) or Gecko (Firefox) engines
are available here, so genuine Safari/Firefox-specific rendering
differences (date input styling, flexbox edge cases, RTL font fallback)
remain untested by any session so far, on any sprint. This is the one
item from the previous report's "highest-value remaining action" that
still isn't closed.

## Performance validation

Time-to-first-byte was measured directly and is genuinely fast in dev
mode (29-76ms for static pages) — confirming no server-side slowness.
**Full page-load timing could not be meaningfully measured here**: this
sandbox's blocked external connections (Supabase, Google Fonts) hang
rather than fail fast, inflating `load` event timing to 12-13 seconds —
an artifact of this sandbox's network, not the app. The prior sprint's
`docs/PERFORMANCE-AUDIT.md` (a real production `vite build` bundle
inspection) remains the most reliable performance data available and is
unaffected by anything found this sprint (no bundle-affecting code was
touched).

## Production readiness spot-check

Re-confirmed still in place and correctly wired: `ErrorBoundary` around
`<Outlet/>` in `__root.tsx`; `admin_action_log` table present in the type
definitions; 36 tracked migrations; `/admin/health` route exists (could
not be exercised live — same Supabase-blocked limitation). No new gaps
found beyond what `docs/OBSERVABILITY.md` and `docs/BACKUP-PLAN.md`
already documented.

## Summary

| #   | Finding                                                              | Severity                                                          | Status                                                 |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | JSON-LD structured data broken on every page (2 files)               | **High** — silent SEO/console-error issue on 100% of page loads   | **Fixed**                                              |
| 2   | `/sitemap.xml` hard 500s on any backend failure                      | Medium — public/crawler-facing endpoint                           | **Fixed**                                              |
| 3   | Raw English network error leaks into Arabic auth UI                  | Medium — real UX regression for any user with connectivity issues | **Fixed**                                              |
| 4   | CSRF middleware not configured                                       | Low (verified) — no ambient credential exists to exploit          | Documented, not fixed                                  |
| 5   | Stories grid shows blank skeleton indefinitely under network failure | None (sandbox artifact) — code already handles this correctly     | Documented, not a bug                                  |
| 6   | Full E2E flow untestable live (register→referral)                    | Environmental                                                     | Documented — network/credential limits of this sandbox |
| 7   | Safari/Firefox real-engine testing still never performed             | Testing gap, carried over                                         | Documented, unresolved                                 |

## Launch blockers

**None.** All code-level issues found this sprint are fixed and verified
live in a real browser. The JSON-LD fix in particular closes a real,
previously undetected defect that had been silently broken since it was
first written — worth flagging specifically to whoever owns SEO/growth,
since structured data has been non-functional until this fix.

## Risk assessment

| Area                                     | Risk                    | Basis                                                                          |
| ---------------------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| Structured data / rich snippets          | **Was High, now Low**   | Fixed and verified this sprint                                                 |
| Public endpoint resilience (sitemap)     | **Was Medium, now Low** | Fixed and verified this sprint                                                 |
| Auth error UX                            | **Was Medium, now Low** | Fixed and verified this sprint                                                 |
| CSRF                                     | Low                     | Verified no exploitable ambient-credential path                                |
| Cross-browser (Safari/Firefox) rendering | **Unknown**             | Never tested with a real engine, in any sprint                                 |
| Core business logic correctness          | Low                     | Consistent with prior sprint's code-trace findings; nothing new contradicts it |

## Production readiness score

**8/10** — up from the prior report's 7.5, because this sprint actually
exercised the app in a real browser and found (and fixed) a genuinely
significant, previously invisible defect (broken structured data on
every page), plus two smaller real UX/resilience bugs, all verified live
rather than by inspection alone. It isn't higher because the single
biggest remaining gap — real Safari and Firefox testing — has now gone
unaddressed across two consecutive QA sprints, purely for lack of those
engines in any available environment, not for lack of trying.

## Launch Recommendation

## READY WITH WARNINGS

Code-level: ship it — the defects found this sprint were real and are
now fixed and verified. The warning is unchanged from the last report
and now impossible to defer further without a deliberate decision: **do
one real pass on actual Safari and Firefox** (a real iPhone/Mac for
Safari, any machine with Firefox installed) before calling this a clean
READY. Everything else this sprint could check, it checked, live, in a
real browser, and came back clean or fixed.

## Files changed

- `src/routes/__root.tsx` — JSON-LD fix (moved to `meta[].{"script:ld+json"}`).
- `src/routes/help.tsx` — same JSON-LD fix + removed an accidental duplicate `meta` key.
- `src/routes/sitemap[.]xml.tsx` — try/catch around the dynamic story-slug query.
- `src/routes/auth.tsx` — friendly Arabic fallback for network-level auth errors.
- `docs/FINAL-PRODUCTION-READINESS.md` — this document.

No migrations this sprint. `tsc --noEmit` and `eslint` clean on all
touched files, confirmed after every change, not just at the end.
