
-- story-pdfs bucket: files stored under {orderId}/... — owner or admin can read; admins manage
CREATE POLICY "Order owner or admin reads story pdfs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'story-pdfs' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = (storage.foldername(objects.name))[1]
        AND o.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins manage story pdfs"
ON storage.objects FOR ALL
USING (bucket_id = 'story-pdfs' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'story-pdfs' AND has_role(auth.uid(), 'admin'::app_role));

-- reference-children bucket: files stored under {userId}/... — owner reads/writes own; admins manage all
CREATE POLICY "Users view own reference children"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reference-children' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Users upload own reference children"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reference-children'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users delete own reference children"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reference-children'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins manage reference children"
ON storage.objects FOR ALL
USING (bucket_id = 'reference-children' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'reference-children' AND has_role(auth.uid(), 'admin'::app_role));
