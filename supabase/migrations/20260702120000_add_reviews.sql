-- Parent reviews (Milestone 4 / F4) — also powers the rating shown in the
-- F2 "قصص أنشأناها" portfolio gallery. Reviews require admin approval
-- (is_published) before they appear publicly, matching the existing
-- template/payment approval pattern in this app.
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.story_templates(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  child_age int,
  category text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads published reviews" ON public.reviews
  FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "Users manage own reviews" ON public.reviews
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all reviews" ON public.reviews
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_reviews_template ON public.reviews(template_id) WHERE is_published;
CREATE INDEX idx_reviews_user ON public.reviews(user_id);
