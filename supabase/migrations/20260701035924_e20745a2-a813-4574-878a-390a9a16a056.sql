
-- 1. Link orders to a specific child profile
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES public.child_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_child_id ON public.orders(child_id);

-- 2. Story completion history
CREATE TABLE IF NOT EXISTS public.child_story_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.story_templates(id) ON DELETE SET NULL,
  category text,
  xp_awarded integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(child_id, order_id)
);
GRANT SELECT, INSERT ON public.child_story_history TO authenticated;
GRANT ALL ON public.child_story_history TO service_role;
ALTER TABLE public.child_story_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own child history"
  ON public.child_story_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.child_profiles c
                 WHERE c.id = child_story_history.child_id AND c.user_id = auth.uid()));
CREATE POLICY "Admins view all history"
  ON public.child_story_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_history_child ON public.child_story_history(child_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_order ON public.child_story_history(order_id);

-- 3. Level calculation helper (10 tiers)
CREATE OR REPLACE FUNCTION public.calc_child_level(_xp integer)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
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
$$;

-- 4. Completion pipeline
CREATE OR REPLACE FUNCTION public.complete_story_for_child(_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  o record;
  tpl record;
  xp_award integer;
  new_total_xp integer;
  new_level integer;
  new_count integer;
  ach jsonb;
  ach_keys text[];
  cat_lower text;
  adventure_cnt integer;
  space_cnt integer;
  animal_cnt integer;
  bedtime_cnt integer;
  family_cnt integer;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR o.child_id IS NULL THEN RETURN; END IF;

  -- idempotent
  IF EXISTS (SELECT 1 FROM public.child_story_history WHERE order_id = _order_id) THEN
    RETURN;
  END IF;

  SELECT * INTO tpl FROM public.story_templates WHERE id = o.template_id;

  -- XP amount
  SELECT COUNT(*) INTO new_count FROM public.child_story_history WHERE child_id = o.child_id;
  IF new_count = 0 THEN xp_award := 100;
  ELSIF tpl.occasion IS NOT NULL THEN xp_award := 150;
  ELSIF o.pages_count >= 16 THEN xp_award := 100;
  ELSE xp_award := 50;
  END IF;

  INSERT INTO public.child_story_history(child_id, order_id, template_id, category, xp_awarded)
  VALUES (o.child_id, o.id, o.template_id, tpl.category, xp_award);

  -- Update universe
  INSERT INTO public.child_story_universe(child_id, level, experience_points, story_count, achievements)
  VALUES (o.child_id, 1, 0, 0, '[]'::jsonb)
  ON CONFLICT (child_id) DO NOTHING;

  UPDATE public.child_story_universe
     SET experience_points = experience_points + xp_award,
         story_count = story_count + 1,
         level = public.calc_child_level(experience_points + xp_award),
         updated_at = now()
   WHERE child_id = o.child_id
   RETURNING experience_points, level, story_count, achievements
        INTO new_total_xp, new_level, new_count, ach;

  -- Achievement checks (Arabic category tokens)
  ach_keys := ARRAY(SELECT jsonb_array_elements_text(ach));

  SELECT COUNT(*) FROM public.child_story_history h
    JOIN public.story_templates t ON t.id = h.template_id
    WHERE h.child_id = o.child_id AND t.category ILIKE '%مغامر%' INTO adventure_cnt;
  SELECT COUNT(*) FROM public.child_story_history h
    JOIN public.story_templates t ON t.id = h.template_id
    WHERE h.child_id = o.child_id AND (t.category ILIKE '%فضاء%' OR t.category ILIKE '%كواكب%') INTO space_cnt;
  SELECT COUNT(*) FROM public.child_story_history h
    JOIN public.story_templates t ON t.id = h.template_id
    WHERE h.child_id = o.child_id AND t.category ILIKE '%حيوان%' INTO animal_cnt;
  SELECT COUNT(*) FROM public.child_story_history h
    JOIN public.story_templates t ON t.id = h.template_id
    WHERE h.child_id = o.child_id AND (t.category ILIKE '%نوم%' OR t.category ILIKE '%bedtime%') INTO bedtime_cnt;
  SELECT COUNT(*) FROM public.child_story_history h
    JOIN public.story_templates t ON t.id = h.template_id
    WHERE h.child_id = o.child_id AND (t.category ILIKE '%أسرة%' OR t.category ILIKE '%عائل%' OR t.category ILIKE '%محبة%') INTO family_cnt;

  IF new_count >= 1  AND NOT ('first_story'      = ANY(ach_keys)) THEN ach_keys := ach_keys || 'first_story'; END IF;
  IF new_count >= 5  AND NOT ('reader'           = ANY(ach_keys)) THEN ach_keys := ach_keys || 'reader'; END IF;
  IF new_count >= 10 AND NOT ('explorer'         = ANY(ach_keys)) THEN ach_keys := ach_keys || 'explorer'; END IF;
  IF new_count >= 50 AND NOT ('legend'           = ANY(ach_keys)) THEN ach_keys := ach_keys || 'legend'; END IF;
  IF adventure_cnt >= 5 AND NOT ('adventure_master' = ANY(ach_keys)) THEN ach_keys := ach_keys || 'adventure_master'; END IF;
  IF space_cnt     >= 3 AND NOT ('space_hero'       = ANY(ach_keys)) THEN ach_keys := ach_keys || 'space_hero'; END IF;
  IF animal_cnt    >= 3 AND NOT ('animal_friend'    = ANY(ach_keys)) THEN ach_keys := ach_keys || 'animal_friend'; END IF;
  IF bedtime_cnt  >= 10 AND NOT ('bedtime_champion' = ANY(ach_keys)) THEN ach_keys := ach_keys || 'bedtime_champion'; END IF;
  IF family_cnt    >= 5 AND NOT ('family_hero'      = ANY(ach_keys)) THEN ach_keys := ach_keys || 'family_hero'; END IF;

  UPDATE public.child_story_universe
     SET achievements = to_jsonb(ach_keys)
   WHERE child_id = o.child_id;

  -- Reward parent
  PERFORM public.award_points(o.user_id, 30, 'story_completed', o.id::text, 'مكافأة إتمام قصة');
END;
$$;

REVOKE ALL ON FUNCTION public.complete_story_for_child(uuid) FROM PUBLIC, anon, authenticated;

-- 5. Trigger on order status → sent
CREATE OR REPLACE FUNCTION public.trg_orders_on_sent()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') AND NEW.child_id IS NOT NULL THEN
    PERFORM public.complete_story_for_child(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_completion ON public.orders;
CREATE TRIGGER trg_orders_completion
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_on_sent();
