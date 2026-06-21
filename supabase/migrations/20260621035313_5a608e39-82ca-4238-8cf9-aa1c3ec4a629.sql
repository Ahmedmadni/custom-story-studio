DROP POLICY IF EXISTS "Order owner or admin reads story pdfs" ON storage.objects;

CREATE POLICY "Order owner or admin reads story pdfs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'story-pdfs' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.story_templates t ON t.id = o.template_id
      WHERE o.id::text = (storage.foldername(storage.objects.name))[1]
        AND o.user_id = auth.uid()
        AND t.admin_approved_at IS NOT NULL
    )
  )
);