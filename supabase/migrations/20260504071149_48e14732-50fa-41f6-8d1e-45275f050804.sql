
-- Storage bucket for course materials (PDFs)
INSERT INTO storage.buckets (id, name, public) VALUES ('course-materials','course-materials', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read materials" ON storage.objects FOR SELECT USING (bucket_id='course-materials');
CREATE POLICY "Faculty/Admin upload materials" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='course-materials' AND (public.has_role(auth.uid(),'faculty') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Faculty/Admin delete materials" ON storage.objects FOR DELETE
  USING (bucket_id='course-materials' AND (public.has_role(auth.uid(),'faculty') OR public.has_role(auth.uid(),'admin')));

-- Add file_url to course_materials, make content optional
ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.course_materials ALTER COLUMN content DROP NOT NULL;

-- Student leaves table
CREATE TABLE IF NOT EXISTS public.student_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student creates own leave" ON public.student_leaves FOR INSERT
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "Student/Faculty/Admin view leaves" ON public.student_leaves FOR SELECT
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'faculty'));
CREATE POLICY "Faculty/Admin update leave" ON public.student_leaves FOR UPDATE
  USING (public.has_role(auth.uid(),'faculty') OR public.has_role(auth.uid(),'admin'));
