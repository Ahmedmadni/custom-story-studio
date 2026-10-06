-- Second least-privilege pass for legacy browser grants.
-- RLS remains enabled, but broad table grants such as TRUNCATE/REFERENCES/TRIGGER
-- are unnecessary for browser roles and can bypass the protection model we want.

-- Public/anonymous traffic never needs direct access to these private tables.
REVOKE ALL
ON TABLE
  public.orders,
  public.referrals,
  public.reviews,
  public.coupons,
  public.coupon_redemptions,
  public.child_story_universe
FROM anon;

-- Orders are now created/updated/deleted through authenticated server functions.
-- Customers only need to read their own rows through existing RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.orders
FROM authenticated;

-- Reviews are submitted through submit_review_and_reward (service-role-only)
-- and moderated through admin server functions. Browser roles keep SELECT only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.reviews
FROM authenticated;

-- Referral creation/reward transitions are handled by locked server-side RPCs.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.referrals
FROM authenticated;

-- Coupon configuration and redemption are server-owned.
REVOKE ALL
ON TABLE public.coupons
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.coupon_redemptions
FROM authenticated;

-- child_story_universe is still owner-managed from the authenticated app today,
-- so keep normal CRUD/SELECT but remove non-runtime privileges.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.child_story_universe
FROM authenticated;
