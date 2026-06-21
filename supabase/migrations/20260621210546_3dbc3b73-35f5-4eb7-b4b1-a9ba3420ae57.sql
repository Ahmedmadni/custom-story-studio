
-- 1) generated_pages: owner can read only after admin approves the order
DROP POLICY IF EXISTS "Order owner or admin views pages" ON public.generated_pages;
CREATE POLICY "Order owner or admin views pages"
  ON public.generated_pages
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = generated_pages.order_id
        AND o.user_id = auth.uid()
        AND o.status IN ('approved'::order_status, 'generating'::order_status, 'ready'::order_status, 'sent'::order_status)
    )
  );

-- 2) storage: story-pages — owner only after approval
DROP POLICY IF EXISTS "Order owner or admin views story pages" ON storage.objects;
CREATE POLICY "Order owner or admin views story pages"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'story-pages'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE (o.id)::text = (storage.foldername(objects.name))[1]
          AND o.user_id = auth.uid()
          AND o.status IN ('approved'::order_status, 'generating'::order_status, 'ready'::order_status, 'sent'::order_status)
      )
    )
  );

-- 3) storage: story-pdfs — owner only after final delivery (ready/sent)
DROP POLICY IF EXISTS "Order owner or admin reads story pdfs" ON storage.objects;
CREATE POLICY "Order owner or admin reads story pdfs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'story-pdfs'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.user_id = auth.uid()
          AND (storage.foldername(objects.name))[1] = (o.id)::text
          AND o.status IN ('ready'::order_status, 'sent'::order_status)
      )
    )
  );

-- 4) story_templates INSERT: users cannot self-publish or self-approve
DROP POLICY IF EXISTS "Users create own custom stories" ON public.story_templates;
CREATE POLICY "Users create own custom stories"
  ON public.story_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND is_custom = true
    AND is_published = false
    AND admin_approved_at IS NULL
    AND admin_approved_by IS NULL
    AND approved_at IS NULL
  );

-- 5) story_templates UPDATE for users: only own un-approved custom stories; cannot publish/approve
CREATE POLICY "Users update own un-approved custom stories"
  ON public.story_templates
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND is_custom = true
    AND admin_approved_at IS NULL
  )
  WITH CHECK (
    created_by = auth.uid()
    AND is_custom = true
    AND is_published = false
    AND admin_approved_at IS NULL
    AND admin_approved_by IS NULL
    AND approved_at IS NULL
  );
