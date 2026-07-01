
REVOKE ALL ON FUNCTION public.trg_orders_on_sent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calc_child_level(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calc_child_level(integer) TO service_role;
