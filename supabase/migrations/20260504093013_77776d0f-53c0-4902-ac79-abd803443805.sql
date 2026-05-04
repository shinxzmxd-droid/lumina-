CREATE POLICY "Public read course-materials"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'course-materials');