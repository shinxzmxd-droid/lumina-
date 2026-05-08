
-- 1) Harden handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _assigned_faculty uuid;
BEGIN
  BEGIN
    _assigned_faculty := NULLIF(NEW.raw_user_meta_data->>'assigned_faculty_id','')::uuid;
  EXCEPTION WHEN others THEN
    _assigned_faculty := NULL;
  END;

  -- Always create as unapproved student. Admins must promote/approve via admin tools.
  INSERT INTO public.profiles (user_id, full_name, approved, assigned_faculty_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), false, _assigned_faculty);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$function$;

-- 2) Restrict course_materials SELECT to enrolled students / course faculty / admins
DROP POLICY IF EXISTS "Auth users view materials" ON public.course_materials;
CREATE POLICY "Enrolled or faculty view materials"
  ON public.course_materials FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_materials.course_id AND c.faculty_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = course_materials.course_id AND e.student_id = auth.uid())
  );

-- 3) Restrict student self-enrollment to courses they're a class-group member of
DROP POLICY IF EXISTS "Students self-enroll" ON public.enrollments;
CREATE POLICY "Students self-enroll in assigned courses"
  ON public.enrollments FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'faculty'::app_role)
    OR (
      student_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.class_group_members m
        JOIN public.class_groups g ON g.id = m.class_group_id
        JOIN public.courses c ON c.faculty_id = g.faculty_id
        WHERE m.student_id = auth.uid() AND c.id = enrollments.course_id
      )
    )
  );

-- 4) Storage policies for course-materials bucket: SELECT by enrolled/faculty/admin only,
--    explicit UPDATE for faculty/admin
DROP POLICY IF EXISTS "Auth read materials" ON storage.objects;
DROP POLICY IF EXISTS "Faculty/Admin update materials objects" ON storage.objects;

CREATE POLICY "Enrolled or faculty read course-materials"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'course-materials' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.course_materials cm
        JOIN public.courses c ON c.id = cm.course_id
        WHERE cm.file_url = storage.objects.name
          AND (
            c.faculty_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = c.id AND e.student_id = auth.uid())
          )
      )
    )
  );

CREATE POLICY "Faculty/Admin update materials objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-materials' AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'faculty'::app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'course-materials' AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'faculty'::app_role)
    )
  );
