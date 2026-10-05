-- Defense-in-depth hardening for the private child-photos bucket.
-- The original bucket/policies predate this repository's migration history.
--
-- RESTRICTIVE policies are intentionally used here. They do not grant access
-- on their own; they AND with any existing permissive policy. This means an
-- older overly-broad policy cannot bypass the owner-folder rule below.
--
-- Expected object path convention:
--   <auth.uid()>/<uuid>.<ext>

UPDATE storage.buckets
SET public = false
WHERE id = 'child-photos';

CREATE POLICY "child_photos_owner_select_restrictive"
ON storage.objects
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  bucket_id IS DISTINCT FROM 'child-photos'
  OR (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "child_photos_owner_insert_restrictive"
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IS DISTINCT FROM 'child-photos'
  OR (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "child_photos_owner_update_restrictive"
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  bucket_id IS DISTINCT FROM 'child-photos'
  OR (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  bucket_id IS DISTINCT FROM 'child-photos'
  OR (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "child_photos_owner_delete_restrictive"
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  bucket_id IS DISTINCT FROM 'child-photos'
  OR (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);
