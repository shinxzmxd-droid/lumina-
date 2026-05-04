
DROP POLICY IF EXISTS "Public read materials" ON storage.objects;
CREATE POLICY "Auth read materials" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='course-materials');
