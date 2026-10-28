-- Atomic creation, coupon consumption and reward spending for story requests.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS points_used integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS points_discount_egp integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_request_id uuid;
CREATE INDEX IF NOT EXISTS orders_checkout_request_idx ON public.orders(user_id, checkout_request_id);

CREATE OR REPLACE FUNCTION public.create_story_checkout(
  _user_id uuid, _request_id uuid, _rows jsonb,
  _points integer DEFAULT 0, _coupon_id uuid DEFAULT NULL, _coupon_discount integer DEFAULT 0
) RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ids uuid[]; row_data jsonb; order_id uuid; balance_now integer;
  eligible integer; remaining integer; share integer; discount_total integer;
BEGIN
  IF _user_id IS NULL OR _request_id IS NULL OR _points IS NULL OR _points NOT IN (0,100)
    OR _rows IS NULL OR jsonb_typeof(_rows) <> 'array'
    OR jsonb_array_length(_rows) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Invalid checkout request';
  END IF;
  -- Serialize retries before locking the reward account.
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || _request_id::text, 0));
  SELECT array_agg(id ORDER BY created_at,id) INTO ids FROM public.orders
    WHERE user_id=_user_id AND checkout_request_id=_request_id;
  IF ids IS NOT NULL THEN RETURN ids; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_rows) r
    WHERE (r->>'user_id')::uuid IS DISTINCT FROM _user_id
      OR (r->>'price_egp')::integer IS NULL OR (r->>'price_egp')::integer < 0) THEN
    RAISE EXCEPTION 'Invalid order owner or price';
  END IF;
  SELECT sum((r->>'price_egp')::integer - CASE WHEN r->>'print_copy'='true'
    AND r->>'delivery_address' IS NOT NULL AND r = _rows->0 THEN 200 ELSE 0 END)
    INTO eligible FROM jsonb_array_elements(_rows) r;
  discount_total := CASE WHEN _points=100 THEN 25 ELSE 0 END;
  IF eligible < discount_total THEN RAISE EXCEPTION 'Reward exceeds eligible amount'; END IF;
  IF _points > 0 THEN
    SELECT balance INTO balance_now FROM public.reward_accounts WHERE user_id=_user_id FOR UPDATE;
    IF balance_now IS NULL OR balance_now < _points THEN RAISE EXCEPTION 'Insufficient reward points'; END IF;
  END IF;
  ids := ARRAY[]::uuid[];
  remaining := discount_total;
  FOR row_data IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    -- Allocate from remaining payable amounts; never discount print charges.
    share := LEAST(remaining, GREATEST(0, (row_data->>'price_egp')::integer -
      CASE WHEN cardinality(ids)=0 AND row_data->>'print_copy'='true' THEN 200 ELSE 0 END));
    remaining := remaining-share;
    row_data := row_data || jsonb_build_object('price_egp',(row_data->>'price_egp')::integer-share,
      'discount_egp',coalesce((row_data->>'discount_egp')::integer,0)+share);
    INSERT INTO public.orders (
      user_id,template_id,child_id,child_name,child_name_en,child_age,gender,whatsapp,
      child_photo_path,notes,receipt_path,payment_status,price_egp,discount_egp,coupon_code,
      paid_at,language,photo_mode,aspect_ratio,orientation,publish_consent,pages_count,
      print_copy,delivery_address,gifted_by_name,gifted_by_relation,is_custom_request,
      custom_brief,points_used,points_discount_egp,checkout_request_id
    ) SELECT
      o.user_id,o.template_id,o.child_id,o.child_name,o.child_name_en,o.child_age,o.gender,o.whatsapp,
      o.child_photo_path,o.notes,o.receipt_path,o.payment_status,o.price_egp,o.discount_egp,o.coupon_code,
      o.paid_at,o.language,o.photo_mode,o.aspect_ratio,o.orientation,o.publish_consent,o.pages_count,
      coalesce(o.print_copy,false),o.delivery_address,o.gifted_by_name,o.gifted_by_relation,
      coalesce(o.is_custom_request,false),o.custom_brief,share*4,share,_request_id
      FROM jsonb_populate_record(NULL::public.orders,row_data) o RETURNING id INTO order_id;
    ids := array_append(ids,order_id);
  END LOOP;
  IF remaining <> 0 THEN RAISE EXCEPTION 'Reward allocation failed'; END IF;
  IF _coupon_id IS NOT NULL AND _coupon_discount>0 THEN
    PERFORM public.consume_coupon_redemption(_coupon_id,_user_id,ids[1],_coupon_discount);
  END IF;
  IF _points>0 THEN
    UPDATE public.reward_accounts SET balance=balance-_points WHERE user_id=_user_id;
    INSERT INTO public.reward_transactions(user_id,points,type,reference_id,note)
      VALUES(_user_id,-_points,'redeem',_request_id::text,'خصم 25 جنيه على طلب قصص');
  END IF;
  RETURN ids;
END;
$$;
REVOKE ALL ON FUNCTION public.create_story_checkout(uuid,uuid,jsonb,integer,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_story_checkout(uuid,uuid,jsonb,integer,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_deleted_order_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.points_used>0 THEN
    UPDATE public.reward_accounts SET balance=balance+OLD.points_used WHERE user_id=OLD.user_id;
    INSERT INTO public.reward_transactions(user_id,points,type,reference_id,note)
      VALUES(OLD.user_id,OLD.points_used,'redeem_refund',OLD.id::text,'إعادة نقاط طلب محذوف');
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_refund_deleted_order_points BEFORE DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.refund_deleted_order_points();

CREATE OR REPLACE FUNCTION public.protect_order_reward_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND
    (NEW.points_used IS DISTINCT FROM OLD.points_used OR
     NEW.points_discount_egp IS DISTINCT FROM OLD.points_discount_egp OR
     NEW.checkout_request_id IS DISTINCT FROM OLD.checkout_request_id) THEN
    RAISE EXCEPTION 'Reward spending is server managed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_order_reward_fields BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_order_reward_fields();
