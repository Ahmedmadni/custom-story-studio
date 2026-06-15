-- Require admin_approved_at before non-admin order owners can download the story PDF
DROP POLICY IF EXISTS "Order owner or admin reads story pdfs" ON storage.objects;

CREATE POLICY "Order owner or admin reads story pdfs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'story-pdfs' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = (storage.foldername(objects.name))[1]
        AND o.user_id = auth.uid()
        AND o.admin_approved_at IS NOT NULL
    )
  )
);
