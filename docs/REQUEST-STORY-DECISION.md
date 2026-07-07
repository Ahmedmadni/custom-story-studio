# `/request-story` Reward-Pipeline Decision

Final Launch Cleanup, Task 1. Decision: **this is an inconsistency, not
an intentional design choice — fixed this sprint** (impact analysis
below confirms zero backward-compatibility risk).

## The audit

`/request-story` (custom story requests, `customRequest.functions.ts`)
collects child data as free-text fields (`childName`, `childNameEn`,
`childAge`, `gender`) and never sets `orders.child_id`. Compare against
the other live order path, `checkout.tsx` (library-template orders via
the cart), which collects the exact same free-text fields **plus** an
optional link to a saved `child_profiles` record via the existing,
already-built `ChildPicker` component.

Three things point at oversight rather than intent:

1. **The schema and reward pipeline are entirely child-profile-centric**
   by design — `child_story_universe`, `child_story_history`, XP,
   achievements, levels all key off `child_id`. There's no separate
   "custom request" track anywhere in that system; excluding one order
   type from it isn't a designed alternative, it's just an absence.
2. **Custom requests go through the identical fulfillment pipeline**
   eventually — the code comment in `customRequest.functions.ts` says
   plainly: `template_id` stays null "حتى يُولّد الأدمن القصة لاحقاً عبر
   /create" (until the admin generates the story later via `/create`).
   It becomes a fully generated, delivered story exactly like a
   library-template order — there's no product reason visible anywhere
   for it to be treated as a lesser category once delivered.
3. **The reusable component for this already exists and is already
   optional-by-design**: `ChildPicker` (`src/features/children/ChildPicker.tsx`)
   lets a user pick an existing child or select none at all — it already
   handles "no children yet" gracefully with a CTA to create one. It's
   used exactly this way in `checkout.tsx`. Nothing about it is
   checkout-specific; it just was never added to the second form.

**Conclusion**: no evidence of an intentional exclusion. This looks like
`request-story.tsx` was built (or last touched) before or independently
of the Story Universe/rewards system, and nobody went back to wire it
in. Proceeding with the smallest possible fix, as instructed.

## Impact analysis (completed before any code change, per instructions)

### Database changes

**None required.** `orders.child_id uuid REFERENCES child_profiles(id)
ON DELETE SET NULL` already exists (added in migration
`20260701035924`, the same one that introduced the Story Universe
system) and is already nullable. This fix only starts _populating_ an
existing, already-nullable column from one additional code path — no
`ALTER TABLE`, no new column, no new index, no RLS policy change.

### Existing orders

**Zero risk, and no retroactive effect.** Every existing custom-request
order already has `child_id = NULL` and will keep it — this change only
affects orders placed _after_ the fix ships. Two sub-cases worth being
explicit about:

- **Existing custom orders not yet marked `sent`**: will go through the
  fix's new code path? No — `child_id` is set once, at order creation
  time, by the client submitting the form. An order already sitting in
  the database with `child_id = NULL` was created by the _old_ client
  code and won't retroactively gain a value just because the server
  code changes. It will complete exactly as before (no reward pipeline
  effect) — consistent, not broken.
- **Existing custom orders already marked `sent`**: identical — already
  processed (or already silently skipped) by `complete_story_for_child`,
  and its idempotency guard (`IF EXISTS in child_story_history THEN
RETURN`) means even if someone wanted to force a re-run, there's no
  built-in mechanism to backfill these after the fact without a manual
  one-off admin action (e.g., an admin manually linking a child to the
  order via `OrderEditDialog` if that path supports it, then toggling
  status away from and back to `sent` to re-fire the trigger). **This
  fix does not attempt that backfill** — it's a separate, explicit
  product decision (whether to retroactively reward already-completed
  custom orders), out of scope for "smallest possible implementation,"
  and not something to do silently as a side effect of this change.

### Rewards

No change to the reward _logic_ at all — `complete_story_for_child()`
is untouched. It already handles `template_id IS NULL` gracefully today
(verified in `docs/PAYMENT-FLOW-TRACE.md`): the `SELECT ... INTO tpl`
against `story_templates` simply returns no row, so `tpl.category` and
`tpl.occasion` evaluate to `NULL` in Postgres (accessing a field on a
null composite record is `NULL`, not an error) — the XP-amount
`ELSIF`/`ELSE` chain still resolves correctly, defaulting through to 50
or 100 XP as appropriate, and `child_story_history.category` is simply
stored as `NULL` for these rows (meaning they count toward
count-based achievements like `first_story`/`reader`/`explorer`/`legend`,
but not category-specific ones like `adventure_master` — there's no
category to match since custom requests don't pick one). This was
already true before this fix; the only thing missing was `child_id`
ever being non-null in the first place.

### Child profiles

No schema or component change to `child_profiles` itself. The only new
requirement is UX-level: a user submitting a custom request now sees an
_optional_ child picker, matching `checkout.tsx` exactly — they can
still submit without selecting one (preserving today's behavior for
anyone who hasn't created a child profile yet, or doesn't want to link
one), or pick an existing child to have the resulting story count toward
that child's Story Hero progress.

### Analytics

**No impact.** `analytics.functions.ts` has zero references to
`child_id` or `is_custom_request` — nothing there assumes custom
requests always have a null `child_id`, so populating it going forward
changes no existing analytics computation.

### Backward compatibility verdict

**No backward-compatibility risk identified.** This is additive only:
one new optional input field, threaded through one existing nullable
column, reusing one already-built, already-optional component. No
existing order, no existing query, and no existing UI path is altered by
this change — only new custom-request submissions gain the option.

## Implementation (smallest possible, matching `checkout.tsx`'s exact pattern)

1. `customRequest.functions.ts`: add `childId: z.string().uuid().nullable().optional()`
   to `CustomRequestInput`, and `child_id: data.childId ?? null` to the
   `orders.insert()` call.
2. `_authenticated.request-story.tsx`: add a `childId` state
   (`useState<string | null>(null)`), render the existing `ChildPicker`
   component in step 0 alongside the current free-text fields, and pass
   `childId` through to `submitFn`.

No new components, no schema changes, no changes to any other order
path, no changes to the reward pipeline's SQL. See the corresponding
commit for the actual diff.
