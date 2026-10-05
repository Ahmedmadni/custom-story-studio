-- Reward consistency hardening.
-- 1) Reviews and their +30 point reward are committed in one PostgreSQL transaction.
-- 2) Story completion rewards are also granted when an order was created without
--    linking a saved child profile, while remaining idempotent.

CREATE OR REPLACE FUNCTION public.submit_review_and_reward(
  _user_id uuid,
  _order_id uuid,
  _rating integer,
  _body text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o record;
  review_id uuid;
  review_category text;
BEGIN
  IF _user_id IS NULL OR _order_id IS NULL THEN
    RAISE EXCEPTION 'user and order are required';
  END IF;

  IF _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'rating must be between 1 and 5';
  END IF;

  IF _body IS NOT NULL AND length(_body) > 1000 THEN
    RAISE EXCEPTION 'review body is too long';
  END IF;

  SELECT id, user_id, status, child_age, template_id
  INTO o
  FROM public.orders
  WHERE id = _order_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF o.user_id IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'review order does not belong to user';
  END IF;

  IF o.status <> 'sent' THEN
    RAISE EXCEPTION 'order is not delivered';
  END IF;

  SELECT category
  INTO review_category
  FROM public.story_templates
  WHERE id = o.template_id;

  INSERT INTO public.reviews (
    user_id,
    order_id,
    template_id,
    rating,
    body,
    child_age,
    category
  )
  VALUES (
    _user_id,
    _order_id,
    o.template_id,
    _rating,
    NULLIF(btrim(_body), ''),
    o.child_age,
    review_category
  )
  RETURNING id INTO review_id;

  PERFORM public.award_points(
    _user_id,
    30,
    'review_submitted',
    _order_id::text,
    'مكافأة كتابة تقييم'
  );

  RETURN review_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'review already exists';
END;
$$;

REVOKE ALL ON FUNCTION public.submit_review_and_reward(uuid, uuid, integer, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review_and_reward(uuid, uuid, integer, text)
TO service_role;


CREATE OR REPLACE FUNCTION public.trg_orders_on_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
    IF NEW.child_id IS NOT NULL THEN
      -- Existing path remains idempotent through child_story_history(order_id).
      PERFORM public.complete_story_for_child(NEW.id);
    ELSE
      -- Orders created without a saved child profile still earn the parent
      -- completion reward. reward_transactions is used as the durable
      -- idempotency marker if an admin later moves the order out of sent and
      -- back to sent.
      IF NOT EXISTS (
        SELECT 1
        FROM public.reward_transactions rt
        WHERE rt.user_id = NEW.user_id
          AND rt.type = 'story_completed'
          AND rt.reference_id = NEW.id::text
      ) THEN
        PERFORM public.award_points(
          NEW.user_id,
          30,
          'story_completed',
          NEW.id::text,
          'مكافأة إتمام قصة'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
