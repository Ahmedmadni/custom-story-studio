-- Kidzy Video foundation: additive, isolated schema only.
-- No existing story table, trigger, checkout, payment function, or reward flow is changed.

CREATE TYPE public.template_product_type AS ENUM ('illustrated_story', 'personalized_video');
CREATE TYPE public.video_payment_status AS ENUM ('unpaid', 'pending', 'paid', 'failed', 'refunded');
CREATE TYPE public.video_order_status AS ENUM ('submitted', 'confirmed', 'cancelled');
CREATE TYPE public.video_delivery_status AS ENUM ('pending', 'delivered');
CREATE TYPE public.video_project_status AS ENUM (
  'awaiting_payment', 'paid', 'approved', 'processing', 'ready', 'failed', 'cancelled'
);
CREATE TYPE public.video_production_stage AS ENUM (
  'image_generation', 'image_review', 'script_generation', 'script_review',
  'video_generation', 'quality_review', 'final_render'
);
CREATE TYPE public.video_scene_status AS ENUM (
  'draft', 'queued', 'generating', 'review', 'approved', 'failed'
);
CREATE TYPE public.video_job_type AS ENUM (
  'reference_image', 'script', 'scene_clip', 'narration', 'compose', 'final_render'
);
CREATE TYPE public.video_job_status AS ENUM (
  'queued', 'running', 'succeeded', 'failed', 'dead_letter'
);
CREATE TYPE public.video_render_type AS ENUM ('preview', 'final');

-- Product availability is separate from story_templates.content_type.
-- Existing story behavior intentionally does not read or backfill this table.
CREATE TABLE public.template_product_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.story_templates(id) ON DELETE CASCADE,
  product_type public.template_product_type NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  price_egp numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_product_offerings_template_product_key UNIQUE (template_id, product_type),
  CONSTRAINT template_product_offerings_price_check CHECK (price_egp IS NULL OR price_egp >= 0)
);

-- Commercial and delivery record. The production project points back to this order
-- (one-to-one); a circular project_id column is deliberately avoided.
CREATE TABLE public.video_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  child_id uuid REFERENCES public.child_profiles(id) ON DELETE SET NULL,
  source_template_id uuid REFERENCES public.story_templates(id) ON DELETE SET NULL,
  payment_status public.video_payment_status NOT NULL DEFAULT 'unpaid',
  status public.video_order_status NOT NULL DEFAULT 'submitted',
  delivery_status public.video_delivery_status NOT NULL DEFAULT 'pending',
  price_egp numeric(10,2) NOT NULL,
  discount_egp numeric(10,2) NOT NULL DEFAULT 0,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  coupon_code text,
  child_input_snapshot jsonb NOT NULL,
  order_options_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_delivery_at timestamptz,
  paid_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_orders_price_check CHECK (price_egp >= 0),
  CONSTRAINT video_orders_discount_check CHECK (discount_egp >= 0 AND discount_egp <= price_egp),
  CONSTRAINT video_orders_child_snapshot_check CHECK (jsonb_typeof(child_input_snapshot) = 'object'),
  CONSTRAINT video_orders_options_snapshot_check CHECK (jsonb_typeof(order_options_snapshot) = 'object'),
  CONSTRAINT video_orders_delivery_time_check CHECK (
    (delivery_status = 'pending' AND delivered_at IS NULL)
    OR (delivery_status = 'delivered' AND delivered_at IS NOT NULL)
  )
);

CREATE TABLE public.video_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  video_order_id uuid NOT NULL UNIQUE REFERENCES public.video_orders(id) ON DELETE RESTRICT,
  child_id uuid REFERENCES public.child_profiles(id) ON DELETE SET NULL,
  source_template_id uuid REFERENCES public.story_templates(id) ON DELETE SET NULL,
  source_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  child_snapshot jsonb NOT NULL,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  title text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  style text,
  aspect_ratio text NOT NULL DEFAULT '16:9',
  status public.video_project_status NOT NULL DEFAULT 'awaiting_payment',
  production_stage public.video_production_stage,
  reference_image_prompt text,
  reference_image_path text,
  reference_image_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  script jsonb,
  image_approved_at timestamptz,
  image_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  script_approved_at timestamptz,
  script_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  quality_approved_at timestamptz,
  quality_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  production_started_at timestamptz,
  production_completed_at timestamptz,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_projects_child_snapshot_check CHECK (jsonb_typeof(child_snapshot) = 'object'),
  CONSTRAINT video_projects_source_snapshot_check CHECK (jsonb_typeof(source_snapshot) = 'object'),
  CONSTRAINT video_projects_reference_meta_check CHECK (jsonb_typeof(reference_image_meta) = 'object'),
  CONSTRAINT video_projects_script_check CHECK (script IS NULL OR jsonb_typeof(script) = 'object'),
  CONSTRAINT video_projects_language_check CHECK (language IN ('ar', 'en', 'bilingual')),
  CONSTRAINT video_projects_aspect_ratio_check CHECK (aspect_ratio IN ('1:1', '16:9', '9:16')),
  CONSTRAINT video_projects_image_approval_check CHECK (
    image_approved_by IS NULL OR image_approved_at IS NOT NULL
  ),
  CONSTRAINT video_projects_script_approval_check CHECK (
    script_approved_by IS NULL OR script_approved_at IS NOT NULL
  ),
  CONSTRAINT video_projects_quality_approval_check CHECK (
    quality_approved_by IS NULL OR quality_approved_at IS NOT NULL
  )
);

CREATE TABLE public.video_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  scene_number integer NOT NULL,
  source_page_number integer,
  narration_text text,
  visual_prompt text,
  duration_ms integer NOT NULL,
  status public.video_scene_status NOT NULL DEFAULT 'draft',
  selected_image_path text,
  audio_path text,
  clip_path text,
  selected_asset_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 0,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_scenes_project_number_key UNIQUE (project_id, scene_number),
  CONSTRAINT video_scenes_id_project_key UNIQUE (id, project_id),
  CONSTRAINT video_scenes_scene_number_check CHECK (scene_number > 0),
  CONSTRAINT video_scenes_source_page_check CHECK (source_page_number IS NULL OR source_page_number > 0),
  CONSTRAINT video_scenes_duration_check CHECK (duration_ms > 0 AND duration_ms <= 60000),
  CONSTRAINT video_scenes_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT video_scenes_asset_meta_check CHECK (jsonb_typeof(selected_asset_meta) = 'object'),
  CONSTRAINT video_scenes_approval_check CHECK (
    approved_by IS NULL OR approved_at IS NOT NULL
  )
);

CREATE TABLE public.video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  scene_id uuid,
  job_type public.video_job_type NOT NULL,
  provider text NOT NULL,
  provider_job_id text,
  status public.video_job_status NOT NULL DEFAULT 'queued',
  idempotency_key text NOT NULL UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  last_error text,
  request_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_jobs_scene_project_fkey
    FOREIGN KEY (scene_id, project_id)
    REFERENCES public.video_scenes(id, project_id) ON DELETE CASCADE,
  CONSTRAINT video_jobs_provider_check CHECK (length(btrim(provider)) > 0),
  CONSTRAINT video_jobs_idempotency_key_check CHECK (length(btrim(idempotency_key)) > 0),
  CONSTRAINT video_jobs_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT video_jobs_request_meta_check CHECK (jsonb_typeof(request_meta) = 'object'),
  CONSTRAINT video_jobs_response_meta_check CHECK (jsonb_typeof(response_meta) = 'object')
);

CREATE TABLE public.video_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  version integer NOT NULL,
  render_type public.video_render_type NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'video/mp4',
  duration_ms integer NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  size_bytes bigint NOT NULL,
  checksum text,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_renders_project_version_key UNIQUE (project_id, version),
  CONSTRAINT video_renders_version_check CHECK (version > 0),
  CONSTRAINT video_renders_storage_path_check CHECK (length(btrim(storage_path)) > 0),
  CONSTRAINT video_renders_duration_check CHECK (duration_ms > 0 AND duration_ms <= 60000),
  CONSTRAINT video_renders_dimensions_check CHECK (width > 0 AND height > 0),
  CONSTRAINT video_renders_size_check CHECK (size_bytes > 0)
);

-- Only one final render may be current. Preview versions may be retained independently.
CREATE UNIQUE INDEX idx_video_renders_one_current_final
  ON public.video_renders (project_id)
  WHERE is_current AND render_type = 'final';

CREATE INDEX idx_template_product_offerings_enabled
  ON public.template_product_offerings (template_id, product_type)
  WHERE is_enabled;
CREATE INDEX idx_video_orders_user_created ON public.video_orders (user_id, created_at DESC);
CREATE INDEX idx_video_orders_payment ON public.video_orders (payment_status, created_at);
CREATE INDEX idx_video_orders_delivery ON public.video_orders (delivery_status, expected_delivery_at);
CREATE INDEX idx_video_projects_user_created ON public.video_projects (user_id, created_at DESC);
CREATE INDEX idx_video_projects_queue ON public.video_projects (status, production_stage, updated_at);
CREATE INDEX idx_video_projects_source_template ON public.video_projects (source_template_id);
CREATE INDEX idx_video_projects_source_order ON public.video_projects (source_order_id);
CREATE INDEX idx_video_scenes_project_status ON public.video_scenes (project_id, status, scene_number);
CREATE INDEX idx_video_jobs_project_created ON public.video_jobs (project_id, created_at DESC);
CREATE INDEX idx_video_jobs_scene_created ON public.video_jobs (scene_id, created_at DESC) WHERE scene_id IS NOT NULL;
CREATE INDEX idx_video_jobs_retry ON public.video_jobs (status, next_retry_at)
  WHERE status IN ('queued', 'failed');
CREATE UNIQUE INDEX idx_video_jobs_provider_job
  ON public.video_jobs (provider, provider_job_id)
  WHERE provider_job_id IS NOT NULL;
CREATE INDEX idx_video_renders_project_created ON public.video_renders (project_id, created_at DESC);

CREATE TRIGGER trg_template_product_offerings_updated
  BEFORE UPDATE ON public.template_product_offerings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_video_orders_updated
  BEFORE UPDATE ON public.video_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_video_projects_updated
  BEFORE UPDATE ON public.video_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_video_scenes_updated
  BEFORE UPDATE ON public.video_scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_video_jobs_updated
  BEFORE UPDATE ON public.video_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Defense in depth for future service-role mutations: references owned by a user
-- must belong to the same user. Templates are catalog resources, not user-owned.
CREATE FUNCTION public.validate_video_order_reference_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.child_profiles c
    WHERE c.id = NEW.child_id AND c.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'video child reference is not owned by user';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.validate_video_project_reference_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.child_profiles c
    WHERE c.id = NEW.child_id AND c.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'video child reference is not owned by user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.video_orders vo
    WHERE vo.id = NEW.video_order_id AND vo.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'video order reference is not owned by user';
  END IF;

  IF NEW.source_order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = NEW.source_order_id AND o.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'source story order is not owned by user';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_video_order_reference_ownership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_video_project_reference_ownership() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_video_orders_reference_ownership
  BEFORE INSERT OR UPDATE OF user_id, child_id ON public.video_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_video_order_reference_ownership();
CREATE TRIGGER trg_video_projects_reference_ownership
  BEFORE INSERT OR UPDATE OF user_id, video_order_id, child_id, source_order_id ON public.video_projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_video_project_reference_ownership();

ALTER TABLE public.template_product_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_renders ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.template_product_offerings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.template_product_offerings TO authenticated;
GRANT SELECT ON public.video_orders TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.video_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_scenes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_renders TO authenticated;
GRANT ALL ON public.template_product_offerings, public.video_orders, public.video_projects,
  public.video_scenes, public.video_jobs, public.video_renders TO service_role;

CREATE POLICY "Public reads enabled template offerings"
  ON public.template_product_offerings FOR SELECT TO anon, authenticated
  USING (is_enabled);
CREATE POLICY "Admins manage template offerings"
  ON public.template_product_offerings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners read own video orders"
  ON public.video_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins manage video orders"
  ON public.video_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Projects, scenes, jobs, and render rows contain internal production data.
-- Owners intentionally receive no policy on these tables; future customer-safe
-- status and signed-render endpoints read through server-side service-role code.
CREATE POLICY "Admins manage video projects"
  ON public.video_projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage video scenes"
  ON public.video_scenes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage video jobs"
  ON public.video_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage video renders"
  ON public.video_renders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Private buckets. service_role workers bypass storage RLS. Authenticated
-- customers have no object policy, including on final renders; delivery will
-- use a short-lived signed URL created by a future authorized server function.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('video-assets', 'video-assets', false),
  ('video-renders', 'video-renders', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Admins manage video assets"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'video-assets' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'video-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage video renders"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'video-renders' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'video-renders' AND public.has_role(auth.uid(), 'admin'));
