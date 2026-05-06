
CREATE TABLE public.results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid,
  exam_name text NOT NULL,
  marks_obtained numeric NOT NULL DEFAULT 0,
  max_marks numeric NOT NULL DEFAULT 100,
  grade text,
  remarks text,
  semester text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student views own / faculty+admin all"
ON public.results FOR SELECT
USING (
  student_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'faculty')
);

CREATE POLICY "Faculty/Admin insert results"
ON public.results FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'faculty') OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Faculty/Admin update results"
ON public.results FOR UPDATE
USING (
  public.has_role(auth.uid(), 'faculty') OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Faculty/Admin delete results"
ON public.results FOR DELETE
USING (
  public.has_role(auth.uid(), 'faculty') OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX idx_results_student ON public.results(student_id);
