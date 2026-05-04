ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_marked_by_fkey;
ALTER TABLE public.student_leaves DROP CONSTRAINT IF EXISTS student_leaves_student_id_fkey;
ALTER TABLE public.leaves DROP CONSTRAINT IF EXISTS leaves_faculty_id_fkey;