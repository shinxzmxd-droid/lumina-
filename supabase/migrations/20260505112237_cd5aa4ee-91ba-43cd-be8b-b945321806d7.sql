
-- Wipe app data
TRUNCATE TABLE public.ai_interactions, public.attendance, public.course_materials, public.timetable_slots, public.enrollments, public.student_leaves, public.leaves, public.courses, public.user_roles, public.profiles RESTART IDENTITY CASCADE;

-- Wipe auth users
DELETE FROM auth.users;

-- Add approval column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- Update handle_new_user to set approval correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role;
  _approved boolean := false;
  _admin_exists boolean;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student');

  -- First admin ever is auto-approved; otherwise pending
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO _admin_exists;
  IF _role = 'admin' AND NOT _admin_exists THEN
    _approved := true;
  END IF;

  -- Accounts created by an admin (flag in metadata) are auto-approved
  IF COALESCE((NEW.raw_user_meta_data->>'created_by_admin')::boolean, false) THEN
    _approved := true;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, approved)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), _approved);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$function$;

-- Make sure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: allow admins to update any profile (approval)
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));
