# Performance Audit

Phase 5 of the Production Hardening & Launch Preparation Sprint. All numbers
below come from an actual production build (`vite build`, Cloudflare/nitro
target) run against this branch, not estimates — see each finding's
"measured" note.

## Method

```
node_modules/.bin/vite build
du -h .output/public/assets/*.js | sort -rh
gzip -c <file> | wc -c   # to get realistic transfer size
```

Route-based code splitting was already confirmed working: every file under
`src/routes/` produces its own output chunk (e.g. `_authenticated.admin.orders-*.js`,
`create-*.js`), so navigating between routes does not download the whole
app up front. The audit below focuses on what's _inside_ those chunks and
on runtime behavior (caching, prefetching, renders).

## Findings

### 1. PDF libraries (jspdf + html2canvas-pro) were eagerly bundled into page loads — FIXED

**Problem (measured)**: `src/features/pdf/PdfActions.tsx` (rendered on the
child's story page, `/story/$orderId`) and `src/features/admin/OrdersManager.tsx`
(admin orders list) both had a **static** top-level
`import { generateStoryPdf } from "@/features/pdf/storyPdf"`. Since
`storyPdf.ts` itself statically imports `jspdf` and `html2canvas-pro`, the
built chunk graph was:

```
route chunk → PdfActions/OrdersManager chunk → storyPdf chunk → jspdf.es.min (386 KB / 125 KB gz)
                                                              → html2canvas-pro.esm (245 KB / 61 KB gz)
```

All three are static ESM imports, so the browser fetches them as part of
loading the page — even though PDF generation only runs when the user
clicks "تحميل PDF" / "تصدير PDF", a discrete, infrequent action. That's
**~186 KB gzipped (~630 KB raw)** of JS shipped to every visitor who opens
a completed story, whether or not they ever download a PDF.

Also noted: `html2canvas` (201 KB / 47 KB gz) is bundled _in addition to_
`html2canvas-pro` (both appear as separate chunks) — `html2canvas-pro` is
not listed as a direct dependency's replacement for `html2canvas` in
`package.json`; it's a transitive dependency of something else pulling in
the non-`-pro` fork too. Not resolved in this phase (would require
dependency-tree surgery outside "no major changes" scope) but flagged for
a follow-up dependency audit.

**Fix applied**: both call sites now do
`const { generateStoryPdf } = await import("@/features/pdf/storyPdf")`
inside the click handler (`ensurePdf` in `PdfActions.tsx`,
`handleAdminExport` in `OrdersManager.tsx`) instead of a static top-level
import. The type-only import (`PdfStoryPage`) stays static since types are
erased at build time and cost nothing.

**Estimated impact**: ~186 KB gzip removed from the initial JS payload of
the story page and the admin orders page; that cost now only loads the
first time a user actually clicks download/share, and is cached by the
browser for any subsequent click in the same session.

### 2. Global QueryClient had no default `staleTime` — FIXED

**Problem**: `src/router.tsx` created `new QueryClient()` with no
`defaultOptions`. React Query's own default is `staleTime: 0`, meaning
every `useQuery` that doesn't set its own `staleTime` is considered stale
immediately and refetches on every component mount and every window
refocus — even for data that rarely changes within a session (e.g. a
child's profile, the logged-in user's reward balance shown in multiple
places). Several components already override this locally
(`TrustCounters`, `ParentReviewsSection`, `Header`, `RecentActivityTicker`,
`WaitingListStatus`, `stories.$slug`, `create.tsx`, `OnboardingWizard` —
all set an explicit `staleTime`), which shows the pattern was already
understood ad hoc, just not set as a sane default for everything else.

**Fix applied**: `getRouter()` now passes
`defaultOptions: { queries: { staleTime: 30_000, gcTime: 5 * 60_000 } }`.
30 seconds is short enough that admin/order-status data won't feel stale
in normal use, long enough to avoid refetch storms from remounting the
same query key across route transitions (e.g. switching between `/my-children`
and back). Existing per-query `staleTime` overrides are unaffected —
they still apply and take precedence for the components that already
tuned them.

**Estimated impact**: fewer duplicate network round-trips per session,
most noticeably on pages that mount the same query multiple times during
normal navigation (e.g. cart badge count, favorites list, reward balance
badge in the header appearing on every authenticated route).

### 3. LCP hero image missing `fetchpriority` — FIXED

**Problem**: `src/routes/index.tsx`'s hero `<img>` (the largest
above-the-fold image on the highest-traffic page) already correctly omits
`loading="lazy"` and has explicit `width`/`height` (good — prevents layout
shift and doesn't defer the LCP candidate), but had no
`fetchpriority="high"` hint, so the browser's default heuristic priority
is used instead of explicitly telling it this is the most important image
on the page.

**Fix applied**: added `fetchPriority="high"` to that one `<img>`.

**Estimated impact**: minor LCP improvement, most noticeable on
slower/first-time connections where the preload scanner now prioritizes
this request over same-priority-class resources discovered later in the
document.

## Findings — documented, not changed this phase

### 4. Story cover images are oversized for their display size

**Measured**: every cover image in `public/covers/*.jpg` (used by
`StoryCard.tsx`, `PortfolioGallery.tsx`, order/template detail pages) is a
**1024×1024 JPEG**, 70 KB–215 KB each (checked via `file`; total ~3.9 MB
across 19 files). They're rendered in a 3:4 aspect card at ~210–300 px
wide in grids/carousels — 3-5x more pixels than displayed, plus JPEG
rather than a modern format (WebP/AVIF would typically be 25-50% smaller
at equivalent visual quality).

Both consumers (`StoryCard.tsx:29`, `PortfolioGallery.tsx:77`) already do
use `loading="lazy"` correctly for below-the-fold grid images, so this is
purely a "wrong resolution/format," not a "wrong loading strategy," issue.

**Not fixed this phase**: re-encoding/generating responsive variants (e.g.
via a Cloudflare Images / Supabase Storage transform pipeline, or a build-time
`srcset` generator) is infrastructure work with real scope (choosing a
transform service, updating every image reference to use `srcset`/`sizes`,
regenerating admin-uploaded cover images retroactively) — bigger than a
one-line fix and risks image-quality regressions without visual QA.
**Recommendation**: if Supabase Storage image transforms are available on
the current plan, serve covers through it with a `width` param matching
each usage size; otherwise pre-generate 2-3 sizes (e.g. 320/640 px WebP)
at upload time in the admin template upload flow.

**Estimated impact**: could plausibly cut cover-image transfer weight by
60-80% (e.g. a 100 KB 1024px JPEG down to ~20-30 KB at a WebP 320px
equivalent) across every story grid — the single largest remaining
opportunity in the app, deliberately deferred as out-of-scope for this
hardening sprint's "no major new features/pipeline changes" constraint.

### 5. Main entry chunk (`index-*.js`) is ~229 KB gzipped

**Measured**: the client's core entry chunk (React, ReactDOM, the
Supabase JS client, TanStack Router core, Zod, Sonner, the Vite dynamic
`__vite__mapDeps` route manifest) is 773 KB raw / 229 KB gzip, loaded on
every page. This is within normal range for a React 19 + Supabase SPA
shell (React+ReactDOM alone is typically ~45 KB gzip; Supabase's client
bundles its own postgrest/auth/realtime/storage sub-clients which adds
meaningfully), but it's the largest always-loaded piece of the app.

**Not changed this phase**: no obvious unnecessary library is in this
chunk — everything found there (`@supabase/supabase-js`, `zod`, `sonner`,
`lucide-react` icon runtime) is used on essentially every authenticated
page. Splitting the Supabase client further isn't practical since
auth state must be available app-wide. Flagged as "acceptable for this
app's shape," not a defect, and out of scope for a no-new-architecture
hardening sprint.

### 6. Router prefetching is already well-configured

**Verified, no change needed**: `src/router.tsx` already sets
`defaultPreload: "intent"` (prefetch on link hover/touch-start, not on
mount for every visible link — good default, avoids over-fetching) and
`scrollRestoration: true`. `defaultPreloadStaleTime: 0` means preloaded
route data is always treated as stale by the time the user actually
clicks through, so it will refetch on navigation rather than serving the
hover-time snapshot — this trades a small amount of "why did it refetch,
I already hovered" duplicate work for correctness (no stale data flash).
Reasonable default; not changed.

### 7. No duplicate-query or unnecessary-render defects found in this pass

Reviewed the `useQueryClient()` call sites across admin (`TemplatesManager`,
`OrdersManager`, `UsersManager`, `PendingTemplatesList`), `OrderEditDialog`,
`FavoriteButton`, `ChildForm`, `ReviewsModerationList`, `ReviewDialog`,
`OnboardingWizard`, `_authenticated.my-orders`, `_authenticated.children.$id`,
and `_authenticated.story.$orderId` — each uses `useQueryClient()`
strictly for targeted `invalidateQueries`/`setQueryData` after its own
mutations, not for ad hoc duplicate fetching of data already owned by a
parent query. No evidence of the same query key being independently
fetched by sibling components with different options (which would cause
duplicate network requests before React Query's cache/dedup can help).

### 8. Hydration

**Verified, no change needed**: no use of `Math.random()`, `Date.now()`,
or other non-deterministic values found in render paths that would cause
server/client markup mismatches. `typeof window` guards exist in 7 files
and are used correctly (checked before accessing `window`/`navigator`
inside client-only logic, not inside JSX that would produce different
server vs. client markup).

## Summary table

| #   | Problem                                          | Status                 | Estimated impact                               |
| --- | ------------------------------------------------ | ---------------------- | ---------------------------------------------- |
| 1   | PDF libs (jspdf/html2canvas-pro) eagerly bundled | **Fixed**              | −~186 KB gzip off story/admin-orders page load |
| 2   | No default `staleTime` on QueryClient            | **Fixed**              | Fewer duplicate refetches per session          |
| 3   | Hero image missing `fetchpriority`               | **Fixed**              | Minor LCP improvement                          |
| 4   | Oversized/wrong-format cover images              | Documented, deferred   | Est. 60-80% smaller cover payload if addressed |
| 5   | ~229 KB gzip core entry chunk                    | Documented, acceptable | N/A — not a defect                             |
| 6   | Router prefetching config                        | Verified correct       | N/A                                            |
| 7   | Duplicate queries / unnecessary renders          | Verified, none found   | N/A                                            |
| 8   | Hydration mismatches                             | Verified, none found   | N/A                                            |

## Files changed

- `src/features/pdf/PdfActions.tsx` — dynamic import of `generateStoryPdf`.
- `src/features/admin/OrdersManager.tsx` — dynamic import of `generateStoryPdf`.
- `src/router.tsx` — added `defaultOptions.queries.{staleTime,gcTime}` to the `QueryClient`.
- `src/routes/index.tsx` — added `fetchPriority="high"` to the hero image.
- `docs/PERFORMANCE-AUDIT.md` — this document.

No migrations this phase.

## Unresolved risks

- Cover image sizing/format (finding #4) remains the biggest real
  opportunity and is intentionally deferred — needs a deliberate image
  pipeline decision (Supabase Storage transforms vs. build-time
  generation), not a quick patch.
- The duplicate `html2canvas` + `html2canvas-pro` bundling (finding #1)
  suggests an indirect dependency worth investigating with
  `npm ls html2canvas` in a follow-up, but removing/deduping it is a
  dependency change with its own risk, not done here.
- The new `staleTime: 30_000` default is a judgment call; if any
  screen is found post-launch to show stale data where a real-time feel is
  expected (e.g. admin order status right after a webhook update), that
  screen should get its own shorter `staleTime` override rather than
  lowering the global default.
