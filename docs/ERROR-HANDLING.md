# Error Handling Architecture

Phase 4 of the Production Hardening & Launch Preparation Sprint. This document
describes the centralized error-handling infrastructure added under
`src/lib/errors/` and `src/components/ErrorBoundary.tsx`, how it relates to
error handling that already existed in the app, and what was deliberately
**not** changed.

## Goals

- One place that knows how to turn _any_ thrown value (Supabase/PostgREST
  error, a plain `Error`, an unknown value) into a safe Arabic message for
  the UI, instead of every call site guessing the shape of the error.
- One place that logs errors consistently (client + server), as a seam for
  swapping in a real error-tracking service later (see
  `docs/OBSERVABILITY.md`).
- A reusable React error boundary for defense-in-depth around subtrees,
  complementing (not replacing) the router's existing root-level
  `errorComponent`.
- Additive infrastructure only — no existing `throw new Error(...)` call
  site was rewritten. This sprint is explicitly "no major new features";
  retrofitting ~30 `*.functions.ts` files and all `useQuery`/`useMutation`
  error handling across the app is a larger, separate effort with real
  regression risk and is out of scope here.

## What already existed (unchanged)

- `src/components/ErrorBlock.tsx` — presentational error card with retry
  button, already used in a few places. Reused as-is by the new
  `ErrorBoundary` for its fallback UI.
- `src/lib/lovable-error-reporting.ts` (`reportLovableError`) — existing
  client-side error reporting hook into the Lovable toolchain. It already
  no-ops when `window` is unavailable (server). Reused as-is by the new
  `logError`, not duplicated.
- `src/routes/__root.tsx` `ErrorComponent` (the route's `errorComponent`) —
  TanStack Router's built-in handler for errors thrown during route
  loading/rendering at the root. Already calls `reportLovableError` in a
  `useEffect`. This continues to be the **first line of defense** for
  route-level errors (e.g. a loader throwing).
- Server function handlers (`*.functions.ts`) largely already follow the
  convention `throw new Error("<Arabic message>")`, i.e. the thrown message
  is already meant to be shown to the user. This convention is preserved,
  not replaced.

## What was added

### `src/lib/errors/AppError.ts`

A small typed error hierarchy for _new_ code that wants to distinguish
error categories (e.g. to branch on `error.code`) instead of parsing
message strings:

- `AppError` (base) — `code`, `message` (technical/log-only), `userMessage`
  (Arabic, safe to display), optional `cause`.
- `ValidationError` (`validation_error`), `AuthError` (`auth_error`),
  `NotFoundError` (`not_found`), `PaymentError` (`payment_error`),
  `ExternalServiceError` (`external_service_error`).
- `isAppError(error)` type guard.

None of these are thrown anywhere yet — they're available for new features
(e.g. the Phase 3 email providers could throw `ExternalServiceError` in a
future iteration) without forcing a rewrite of existing code.

### `src/lib/errors/normalizeError.ts`

`normalizeError(error: unknown): { userMessage, code, original }` —
the single function that knows how to interpret:

1. An `AppError` → uses its `userMessage`/`code` directly.
2. A PostgREST/Supabase-shaped error (duck-typed: has `message` plus one of
   `code`/`details`/`hint`) → maps known Postgres/PostgREST codes
   (`23505`, `23503`, `23502`, `42501`, `PGRST116`, `PGRST301`) to Arabic
   messages via `POSTGRES_CODE_MESSAGES`; falls back to a generic Arabic
   message for unknown codes.
3. A plain `Error` → uses `error.message` as-is (matches the existing
   `throw new Error("<Arabic message>")` convention in server functions).
4. Anything else → generic Arabic fallback.

`getErrorMessage(error)` is a one-line convenience for UI call sites, e.g.
`toast.error(getErrorMessage(e))`.

### `src/lib/errors/errorLogger.ts`

`logError(error, context?)` — isomorphic (safe to call from client or
server code):

- Always `console.error`s a structured line (`[error:<code>] <message>
<context> <original>`), which on the server is captured by Cloudflare
  Workers logs.
- Calls the existing `reportLovableError` (client-only no-op on server).

This is the single seam to swap in Sentry/another tracker later without
touching call sites — see `docs/OBSERVABILITY.md`.

### `src/lib/errors/withErrorHandling.ts`

`withErrorHandling(handler, operationName)` — an **optional** higher-order
wrapper for `createServerFn().handler(...)` bodies. Catches any thrown
error, logs it via `logError` with the operation name as context, then
re-throws a plain `Error` with the normalized Arabic `userMessage` (so the
error shape reaching the client is unchanged from today).

Not applied to any existing server function in this phase — introducing it
retroactively across every handler is a mechanical but wide-reaching change
better done as its own follow-up with full manual QA, not bundled into a
hardening sprint that explicitly excludes broad refactors. Recommended for
new server functions going forward.

### `src/lib/errors/index.ts`

Barrel re-exporting all of the above for convenient imports:
`import { normalizeError, getErrorMessage, logError, AppError, ... } from "@/lib/errors";`

### `src/components/ErrorBoundary.tsx`

A reusable class-based React error boundary (`getDerivedStateFromError` +
`componentDidCatch`):

- Renders the existing `ErrorBlock` as its fallback (optional
  `fallbackTitle`/`fallbackMessage` props), with a retry button that resets
  local boundary state.
- Calls `logError` in `componentDidCatch` with
  `{ boundary: "react_error_boundary", componentStack }`.
- Wired into `src/routes/__root.tsx`, wrapping `<Outlet />`:

  ```tsx
  <ErrorBoundary>
    <Outlet />
  </ErrorBoundary>
  ```

**Relationship to the router's `errorComponent`**: the router's
`errorComponent` catches errors thrown during route loading (loaders,
`beforeLoad`) and full-page render failures at the root route level, and
replaces the entire page with a full-screen "٤٠٤-style" error page. The new
`ErrorBoundary` around `<Outlet />` is a second, narrower net: React render
errors that happen _after_ a route has successfully loaded (e.g. a runtime
exception inside a page component's render) that the router's own mechanism
may not catch depending on where in the tree they occur. The two are
complementary, not redundant. `ErrorBoundary` is also exported for reuse
around specific risky subtrees (e.g. the admin AI image-generation panel)
in future work, so a failure there doesn't take down an entire admin page —
not done in this phase to keep the diff scoped to infrastructure only.

## Usage going forward (not retrofitted)

```ts
// New server function:
export const myFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(withErrorHandling(async ({ context }) => {
    // ...
  }, "myFn"));

// New client code:
import { getErrorMessage } from "@/lib/errors";
try {
  await myFn();
} catch (e) {
  toast.error(getErrorMessage(e));
}

// Wrapping a risky subtree:
import { ErrorBoundary } from "@/components/ErrorBoundary";
<ErrorBoundary fallbackTitle="تعذّر تحميل هذا القسم">
  <RiskyWidget />
</ErrorBoundary>
```

## Unresolved risks / follow-ups

- Most existing `*.functions.ts` handlers still throw raw `Error` directly
  rather than going through `withErrorHandling`/`normalizeError` — this is
  intentional for this phase (see Goals) but means error logging coverage
  on the server is not yet uniform. Recommended follow-up: adopt
  `withErrorHandling` incrementally, function-by-function, with QA per
  touched flow.
- Many client `useQuery`/`useMutation` call sites still do
  `if (error) throw error` or render `error.message` directly rather than
  `getErrorMessage(error)`. Not changed in this phase for the same reason.
- `logError` currently only reaches `console.error` + the existing Lovable
  client reporter — there is no server-side error aggregation yet (no
  Sentry/equivalent). Tracked as a Phase 8 (Observability) concern.
- The Postgres/PostgREST error-code map in `normalizeError.ts` only covers
  codes observed to actually occur in this app's flows; unmapped codes fall
  back to a generic message (safe, but not maximally informative in logs
  until `details`/`hint` are also surfaced to `logError`'s context, which
  they already are via `original`).

## Verification

- `tsc --noEmit` — passes with no new errors introduced by this phase's
  files.
- `eslint` — passes on all new/changed files.
- No route files were added or changed in this phase beyond wrapping
  `<Outlet />` inside the existing root route's `component`, so
  `routeTree.gen.ts` regeneration was not required.
- No new database migrations in this phase.
