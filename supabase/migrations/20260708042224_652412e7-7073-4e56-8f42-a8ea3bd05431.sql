CREATE OR REPLACE FUNCTION public.calc_child_level(_xp integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _xp >= 15000 THEN 10
    WHEN _xp >= 10000 THEN 9
    WHEN _xp >=  7000 THEN 8
    WHEN _xp >=  4000 THEN 7
    WHEN _xp >=  2000 THEN 6
    WHEN _xp >=  1000 THEN 5
    WHEN _xp >=   500 THEN 4
    WHEN _xp >=   250 THEN 3
    WHEN _xp >=   100 THEN 2
    ELSE 1
  END;
$function$;