-- Security hardening (Production Hardening Sprint / Phase 1).
-- See docs/SECURITY-AUDIT.md for the full findings this migration addresses.

-- ============================================================
-- 1) profiles: RLS was never enabled for this table in any prior
--    migration (only a table-level GRANT existed), meaning any
--    authenticated user could read/write ANY row via a direct
--    PostgREST call with their own JWT, bypassing the app entirely.
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2) coupons: the "Authenticated read active coupons" policy (added in
--    20260702121500_add_coupons_and_packages.sql) lets ANY signed-in
--    user SELECT * from every active coupon, including single-use
--    referral codes meant for one specific invitee. All real coupon
--    validation already happens server-side via the service-role
--    client (checkout.functions.ts, referrals.functions.ts) — the app
--    never needs client-side SELECT access, so this policy only
--    enabled code enumeration with no functional upside.
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read active coupons" ON public.coupons;
REVOKE SELECT ON public.coupons FROM authenticated;

-- service_role (used by every coupon read/write path in this app) is
-- unaffected by RLS/GRANT changes above. Admins keep full access via
-- the existing "Admins manage coupons" policy from the same migration.
