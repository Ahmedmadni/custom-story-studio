-- Phase 2 (Referral abuse protection): referrals now start life as
-- 'pending' and only flip to 'rewarded' once the invited user's first
-- order is payment-verified (see rewardReferralAfterFirstVerifiedOrder in
-- src/features/referrals/referrals.functions.ts, called from both
-- adminVerifyPayment and the Kashier webhook). Previously the column
-- defaulted to 'rewarded' because the inviter was paid out immediately at
-- signup, which let anyone farm points with fake accounts and no purchase.
ALTER TABLE public.referrals ALTER COLUMN status SET DEFAULT 'pending';
