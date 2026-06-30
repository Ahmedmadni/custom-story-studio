
REVOKE EXECUTE ON FUNCTION public.grant_welcome_bonus() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, int, text, text, text) FROM PUBLIC, anon, authenticated;
