-- First-time onboarding flow (Milestone 5 / F2): tracks whether a user has
-- completed or skipped the onboarding wizard, so it only shows once.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
