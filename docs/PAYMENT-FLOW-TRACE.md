# Payment → Reward Pipeline: Mutation-by-Mutation Trace

Final Production Validation Sprint, Phase 3. Every mutation in the chain
requested — receipt upload → admin verify → `paid_at` → rewards → XP →
achievements → level up — traced against the actual current code (this
sprint's `paid_at` fix included), with exact table/column changes at each
step. Same environment limits as `docs/PRODUCTION-SUPABASE-AUDIT.md`
apply: this is a code trace, not a live execution, since no Supabase
connection is reachable from this session.

## Step-by-step

### 1. Receipt upload (`submitCheckout` / `checkout.functions.ts`)

```
INSERT INTO orders (
  user_id, template_id, child_id, child_name, ..., receipt_path,
  payment_status: 'receipt_uploaded',
  price_egp, discount_egp, coupon_code,
  paid_at: now(),   -- ⚠️ see note below
  status: (default 'pending', enforced by the INSERT RLS policy),
  ...
)
```

One row per cart item. `paid_at` is stamped here **at submission time**,
not verification time — this is intentional and _not_ a bug for this
step specifically: it just means "when the receipt was submitted," and
gets overwritten with the real confirmation timestamp in step 2. If a
coupon was applied: a second mutation,
`INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, discount_egp)`,
plus `UPDATE coupons SET used_count = used_count + 1`.

### 2. Admin verifies payment (`adminVerifyPayment`)

```sql
UPDATE orders SET
  payment_status = 'verified',
  payment_verified_by = <admin user id>,
  payment_verified_at = now(),
  paid_at = now(),              -- ⬅ this sprint's fix: overwrites step 1's
                                 --   submission-time value with the real
                                 --   confirmation moment
  payment_rejection_reason = NULL,
  status = 'approved'           -- NOT 'sent' yet — see step 4
WHERE id = :orderId
RETURNING user_id;
```

Then, best-effort (wrapped in try/catch, never blocks the response):

```
rewardReferralAfterFirstVerifiedOrder(order.user_id)
  → UPDATE referrals SET status='rewarded'
    WHERE invited_user_id = :user_id AND status = 'pending'
    RETURNING inviter_id
  → if a row was updated: award_points(inviter_id, 100, 'referral', ...)
```

Then, also best-effort: `INSERT INTO admin_action_log (action: 'verify_payment', ...)`.

**Mutation count at this step**: 1 guaranteed (`orders`), up to 3
conditional (`referrals`, `reward_accounts`+`reward_transactions` via
`award_points`, `admin_action_log`) — none of the conditional ones can
fail the primary payment verification, by design.

### 3. Order generation (not part of the requested chain, but sits between steps 2 and 4)

Between "approved" and "sent," the admin generates story pages
(`adminGeneratePage`, `adminSetStatus` moving through `generating` →
`ready`). No reward-relevant mutations happen here — this is pure content
production, not part of the reward pipeline. Included here only so the
chain isn't misread as verify→sent being one atomic step; they are two
separate, deliberate admin actions, often minutes to hours apart.

### 4. Admin marks story as sent (`adminSetStatus({ status: 'sent' })`)

```sql
UPDATE orders SET status = 'sent' WHERE id = :orderId;
```

This single `UPDATE` is what fires everything else. `orders.status`
transitioning to `'sent'` triggers `trg_orders_completion`
(`AFTER UPDATE OF status`), which calls `trg_orders_on_sent()`, which —
**only if** `OLD.status IS DISTINCT FROM 'sent'` and `NEW.child_id IS NOT
NULL` — calls `complete_story_for_child(NEW.id)`.

**Important gate, checked against every actual order-creation path in
this codebase, not hypothetically**: `orders.child_id` is nullable, and
`trg_orders_on_sent()` requires `NEW.child_id IS NOT NULL` to run any of
steps 5-9 at all. Three order-creation entry points exist:

| Entry point                                                                               | Sets `child_id`?                                                                                                     | Reachable from the live UI?                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.tsx` (cart-based, library templates)                                            | ✅ via `ChildPicker`                                                                                                 | Yes — the primary "order this story" flow, linked from `stories.$slug.tsx`                                                                                                                                        |
| `_authenticated.request-story.tsx` / `customRequest.functions.ts` (custom story requests) | ❌ **never sets `child_id`** (`template_id: null`, `is_custom_request: true`, no child field anywhere in the insert) | **Yes — actively linked from the homepage, `/stories`, and `/create`** ("اطلب قصة بأفكارك الخاصة")                                                                                                                |
| `_authenticated.order.$templateId.tsx` (direct single-template order)                     | ❌ never sets `child_id`                                                                                             | **No `<Link>` or `navigate()` call anywhere in the current UI targets this route** — appears to be an orphaned route from before the cart-based checkout existed, still fully functional if reached by direct URL |

**This means every custom-requested story — a real, actively-promoted,
primary product path, not an edge case — currently produces zero XP,
zero history entry, zero parent reward, and zero achievement/level
progress when the admin marks it `sent`, silently, with no error
anywhere.** This is very likely a real product gap rather than intended
behavior: custom requests are framed in the UI as a first-class way to
get a story ("اطلب قصة بأفكارك الخاصة" appears on the homepage,
`/stories`, and `/create`), and there's no visible reason a
custom-requested story shouldn't count toward a child's Story Hero
progress the same way a library-template order does.

**Not fixed this phase**: this would require either (a) adding a child
picker to the custom-request flow (a small UI/UX addition — a "new
feature," arguably, even though narrow) or (b) deciding this gap is
intentional (maybe custom requests are meant to bypass the reward system
for a business reason not visible in code). Given this sprint's explicit
"no feature development" constraint, this is flagged as a product
decision for whoever owns the rewards/Story Hero system, not silently
patched. The orphaned `/order/$templateId` route has the same technical
gap but far lower priority, since nothing in the current UI links to it.

### 5. `complete_story_for_child(order_id)` — idempotency check first

```sql
SELECT * FROM orders WHERE id = :order_id;
-- if NOT FOUND or child_id IS NULL → RETURN (no-op, see gate above)

IF EXISTS (SELECT 1 FROM child_story_history WHERE order_id = :order_id) THEN
  RETURN;  -- already processed, safe against duplicate trigger fires
END IF;
```

This makes the entire pipeline safe to re-trigger (e.g. if an admin
accidentally toggles status away from and back to `sent`) — it will not
double-award XP or points.

### 6. XP award + history insert

```sql
-- XP amount: 100 if first story ever for this child, 150 if the
-- template has an `occasion` set, 100 if pages_count >= 16, else 50.
INSERT INTO child_story_history (child_id, order_id, template_id, category, xp_awarded)
VALUES (:child_id, :order_id, :template_id, :category, :xp_award);

INSERT INTO child_story_universe (child_id, level, experience_points, story_count, achievements)
VALUES (:child_id, 1, 0, 0, '[]'::jsonb)
ON CONFLICT (child_id) DO NOTHING;   -- self-heals if the universe row was never created

UPDATE child_story_universe SET
  experience_points = experience_points + :xp_award,
  story_count = story_count + 1,
  level = calc_child_level(experience_points + :xp_award),
  updated_at = now()
WHERE child_id = :child_id
RETURNING experience_points, level, story_count, achievements
  INTO new_total_xp, new_level, new_count, ach;
```

`calc_child_level` is a pure lookup (10 tiers, 100 XP → level 2, up to
15000 XP → level 10) — no side effects, deterministic.

### 7. Achievement unlock

Five `SELECT COUNT(*)` queries against `child_story_history JOIN
story_templates` (category-matching via `ILIKE`), then:

```sql
-- for each achievement whose threshold is now met and not already unlocked:
ach_keys := ach_keys || '<achievement_key>';

UPDATE child_story_universe SET achievements = to_jsonb(ach_keys)
WHERE child_id = :child_id;
```

Achievement keys: `first_story` (≥1), `reader` (≥5), `explorer` (≥10),
`legend` (≥50), plus category-specific ones
(`adventure_master`/`space_hero`/`animal_friend`/`bedtime_champion`/`family_hero`)
at their respective thresholds. All idempotent (`NOT (key = ANY(ach_keys))`
guard before appending).

### 8. Level up

Not a separate mutation — `level` is computed and written in the same
`UPDATE child_story_universe` in step 6
(`level = calc_child_level(experience_points + xp_award)`). The
client-side `LevelUpWatcher` component (mounted on the child detail page)
detects a level increase by comparing the freshly-fetched `level` against
a previously-seen value and shows a celebratory modal — this is a
**read-side** UX effect, not a database mutation of its own.

### 9. Story-completion reward for the parent

```sql
-- last line of complete_story_for_child():
PERFORM award_points(order.user_id, 30, 'story_completed', order.id::text, ...);
  → UPDATE reward_accounts SET balance = balance + 30, lifetime_points = lifetime_points + 30
    WHERE user_id = :user_id (upserting the row if it doesn't exist)
  → INSERT INTO reward_transactions (user_id, points: 30, type: 'story_completed', reference_id: order.id, ...)
```

### 10. Review submission reward (separate, later, user-initiated — not automatic)

Not part of the automatic pipeline — only happens if the parent
subsequently submits a review via `submitReview`, gated on
`order.status === 'sent'` and one-review-per-order
(`UNIQUE(order_id)` on `reviews`, mapped to a friendly duplicate message
on conflict). Awards a separate 30 points via the same `award_points()`
pattern.

## Verified properties of this whole chain

- **Idempotent**: re-triggering step 4 (status flips away from and back
  to `sent`) cannot double-award anything — guarded at the top of
  `complete_story_for_child`.
- **Atomic per statement**: each `UPDATE`/`INSERT` above is a single SQL
  statement executed inside one Postgres function invocation (the whole
  of steps 5-9 runs inside one trigger-invoked function call, which
  Postgres executes within a single transaction) — there's no window
  where XP is updated but the history row isn't, for example.
- **Fails closed on the referral edge, not the payment**: if
  `rewardReferralAfterFirstVerifiedOrder` throws in step 2, the payment
  verification itself has already committed and returns success — a
  referral-reward failure never blocks or rolls back a real payment
  confirmation. Same pattern for `admin_action_log` writes.
- **Silent skip on missing `child_id`**: flagged above with real data —
  not a hypothetical. The custom-request flow (a live, promoted, primary
  path) never sets `child_id`, so every custom-requested story silently
  produces zero XP/reward/achievement effect with zero logged error.
  Worth a product decision, not necessarily a code fix (adding a child
  picker to the custom-request flow is a UI addition, out of this
  sprint's no-feature-development scope).

## Files reviewed (no changes made this phase — trace/verification only)

- `src/features/orders/checkout.functions.ts`
- `src/features/admin/admin.functions.ts` (`adminVerifyPayment`, `adminSetStatus`)
- `src/features/referrals/referrals.functions.ts` (`rewardReferralAfterFirstVerifiedOrder`)
- `supabase/migrations/20260701035924_e20745a2-a813-4574-878a-390a9a16a056.sql` (`complete_story_for_child`, `calc_child_level`, `trg_orders_on_sent`)
- `supabase/migrations/20260630043104_ef0eba81-c814-4143-b68f-4751c27296d6.sql` (`award_points`)
