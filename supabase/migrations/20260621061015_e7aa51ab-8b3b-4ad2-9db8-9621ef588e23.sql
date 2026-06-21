-- Tighten storage policies to authenticated role only
DROP POLICY IF EXISTS "Admins manage reference children" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own reference children" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own reference children" ON storage.objects;
DROP POLICY IF EXISTS "Users view own reference children" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage story pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Order owner or admin reads story pdfs" ON storage.objects;

CREATE POLICY "Admins manage reference children"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'reference-children' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'reference-children' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users upload own reference children"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reference-children' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own reference children"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reference-children' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own reference children"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reference-children' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins manage story pdfs"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'story-pdfs' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'story-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Order owner or admin reads story pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'story-pdfs' AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = auth.uid()
        AND (storage.foldername(name))[1] = o.id::text
    )
  )
);