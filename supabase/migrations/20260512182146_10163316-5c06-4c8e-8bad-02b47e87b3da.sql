DROP POLICY IF EXISTS "Faculty/Admin delete materials" ON storage.objects;
DROP POLICY IF EXISTS "Faculty/Admin update materials objects" ON storage.objects;

CREATE POLICY "Faculty owners or admin delete materials"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-materials'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.course_materials cm
      JOIN public.courses c ON c.id = cm.course_id
      WHERE cm.file_url = storage.objects.name
        AND c.faculty_id = auth.uid()
    )
  )
);

CREATE POLICY "Faculty owners or admin update materials"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-materials'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.course_materials cm
      JOIN public.courses c ON c.id = cm.course_id
      WHERE cm.file_url = storage.objects.name
        AND c.faculty_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'course-materials'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.course_materials cm
      JOIN public.courses c ON c.id = cm.course_id
      WHERE cm.file_url = storage.objects.name
        AND c.faculty_id = auth.uid()
    )
  )
);