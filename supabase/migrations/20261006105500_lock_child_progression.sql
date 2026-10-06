-- Make child progression state server/database-owned.
-- Parents may still read their child's universe through the existing RLS policy,
-- but XP, level, story_count and achievements must not be browser-editable.

CREATE OR REPLACE FUNCTION public.initialize_child_story_universe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.child_story_universe (child_id)
  VALUES (NEW.id)
  ON CONFLICT (child_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initialize_child_story_universe ON public.child_profiles;
CREATE TRIGGER trg_initialize_child_story_universe
AFTER INSERT ON public.child_profiles
FOR EACH ROW
EXECUTE FUNCTION public.initialize_child_story_universe();

-- Backfill any legacy child profiles that somehow missed their universe row.
INSERT INTO public.child_story_universe (child_id)
SELECT c.id
FROM public.child_profiles c
LEFT JOIN public.child_story_universe u ON u.child_id = c.id
WHERE u.child_id IS NULL
ON CONFLICT (child_id) DO NOTHING;

REVOKE ALL ON FUNCTION public.initialize_child_story_universe()
FROM PUBLIC, anon, authenticated;

-- Deleting a child profile already cascades to the universe row. Progression
-- mutations happen through trusted completion logic/triggers, not the browser.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.child_story_universe
FROM authenticated;
