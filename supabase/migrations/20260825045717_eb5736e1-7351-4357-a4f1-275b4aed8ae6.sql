-- Phase 2: atomic customer video order + project creation.
-- This function is callable only by service_role from the authenticated server function.
CREATE FUNCTION public.create_video_order_and_project(
  _user_id uuid,
  _template_id uuid,
  _child_id uuid,
  _child_name text,
  _child_age integer,
  _child_gender text,
  _child_photo_path text,
  _language text,
  _aspect_ratio text
)
RETURNS TABLE(video_order_id uuid, created_at timestamptz)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  offering record;
  child_record record;
  new_order_id uuid;
  new_created_at timestamptz;
  child_snapshot jsonb;
  source_snapshot jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user is required';
  END IF;

  IF _child_name IS NULL OR length(btrim(_child_name)) < 1 OR length(btrim(_child_name)) > 40 THEN
    RAISE EXCEPTION 'invalid child name';
  END IF;
  IF _child_age IS NOT NULL AND (_child_age < 1 OR _child_age > 14) THEN
    RAISE EXCEPTION 'invalid child age';
  END IF;
  IF _child_gender NOT IN ('boy', 'girl') THEN
    RAISE EXCEPTION 'invalid child gender';
  END IF;
  IF _language NOT IN ('ar', 'en', 'bilingual') THEN
    RAISE EXCEPTION 'invalid video language';
  END IF;
  IF _aspect_ratio NOT IN ('1:1', '16:9', '9:16') THEN
    RAISE EXCEPTION 'invalid video aspect ratio';
  END IF;

  SELECT
    o.price_egp,
    t.id AS template_id,
    t.title,
    t.slug,
    t.summary,
    t.moral,
    t.category,
    t.language AS template_language
  INTO offering
  FROM public.template_product_offerings o
  JOIN public.story_templates t ON t.id = o.template_id
  WHERE o.template_id = _template_id
    AND o.product_type = 'personalized_video'
    AND o.is_enabled = true
    AND t.is_published = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'personalized video is not available for this template';
  END IF;
  IF offering.price_egp IS NULL THEN
    RAISE EXCEPTION 'video offering price is not configured';
  END IF;

  IF _child_id IS NOT NULL THEN
    SELECT * INTO child_record
    FROM public.child_profiles
    WHERE id = _child_id AND user_id = _user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'child profile is not owned by user';
    END IF;
  END IF;

  IF _child_photo_path IS NULL
    OR (storage.foldername(_child_photo_path))[1] IS DISTINCT FROM _user_id::text
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id = 'child-photos' AND name = _child_photo_path
    ) THEN
    RAISE EXCEPTION 'child photo is not owned by user';
  END IF;

  child_snapshot := jsonb_build_object(
    'name', btrim(_child_name),
    'age', _child_age,
    'gender', _child_gender,
    'photo_path', _child_photo_path,
    'profile_id', _child_id
  );

  IF _child_id IS NOT NULL THEN
    child_snapshot := child_snapshot || jsonb_build_object(
      'nickname', child_record.nickname,
      'favorite_color', child_record.favorite_color,
      'favorite_character', child_record.favorite_character,
      'hobbies', child_record.hobbies,
      'personality_traits', child_record.personality_traits,
      'dream_job', child_record.dream_job,
      'super_power', child_record.super_power
    );
  END IF;

  source_snapshot := jsonb_build_object(
    'template_id', offering.template_id,
    'title', offering.title,
    'slug', offering.slug,
    'summary', offering.summary,
    'moral', offering.moral,
    'category', offering.category,
    'language', offering.template_language
  );

  INSERT INTO public.video_orders (
    user_id,
    child_id,
    source_template_id,
    payment_status,
    status,
    delivery_status,
    price_egp,
    discount_egp,
    child_input_snapshot,
    order_options_snapshot
  ) VALUES (
    _user_id,
    _child_id,
    _template_id,
    'unpaid',
    'submitted',
    'pending',
    offering.price_egp,
    0,
    child_snapshot,
    jsonb_build_object('language', _language, 'aspect_ratio', _aspect_ratio)
  )
  RETURNING id, public.video_orders.created_at INTO new_order_id, new_created_at;

  INSERT INTO public.video_projects (
    user_id,
    video_order_id,
    child_id,
    source_template_id,
    child_snapshot,
    source_snapshot,
    title,
    language,
    aspect_ratio,
    status,
    production_stage
  ) VALUES (
    _user_id,
    new_order_id,
    _child_id,
    _template_id,
    child_snapshot,
    source_snapshot,
    offering.title,
    _language,
    _aspect_ratio,
    'awaiting_payment',
    NULL
  );

  RETURN QUERY SELECT new_order_id, new_created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_video_order_and_project(
  uuid, uuid, uuid, text, integer, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_video_order_and_project(
  uuid, uuid, uuid, text, integer, text, text, text, text
) TO service_role;