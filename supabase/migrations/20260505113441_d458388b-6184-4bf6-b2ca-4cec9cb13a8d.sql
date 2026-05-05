-- 1) add assigned_faculty_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_faculty_id uuid;

CREATE INDEX IF NOT EXISTS profiles_assigned_faculty_idx
  ON public.profiles(assigned_faculty_id);

-- 2) class_groups (e.g., "3rd Semester - CSE A")
CREATE TABLE IF NOT EXISTS public.class_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  semester text NOT NULL,
  faculty_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view class groups"
  ON public.class_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Faculty/admin create class groups"
  ON public.class_groups FOR INSERT
  WITH CHECK (faculty_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Faculty/admin update class groups"
  ON public.class_groups FOR UPDATE
  USING (faculty_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Faculty/admin delete class groups"
  ON public.class_groups FOR DELETE
  USING (faculty_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 3) class_group_members
CREATE TABLE IF NOT EXISTS public.class_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_group_id, student_id)
);

ALTER TABLE public.class_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members viewable by group faculty/admin/self"
  ON public.class_group_members FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.class_groups g
      WHERE g.id = class_group_members.class_group_id AND g.faculty_id = auth.uid()
    )
  );

CREATE POLICY "Faculty/admin add members"
  ON public.class_group_members FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.class_groups g
      WHERE g.id = class_group_members.class_group_id AND g.faculty_id = auth.uid()
    )
  );

CREATE POLICY "Faculty/admin remove members"
  ON public.class_group_members FOR DELETE
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.class_groups g
      WHERE g.id = class_group_members.class_group_id AND g.faculty_id = auth.uid()
    )
  );

-- 4) Allow faculty to update profiles of their assigned students (approval)
CREATE POLICY "Assigned faculty update student profile"
  ON public.profiles FOR UPDATE
  USING (
    public.has_role(auth.uid(),'faculty')
    AND assigned_faculty_id = auth.uid()
  );

-- 5) Update handle_new_user to store assigned_faculty_id
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
  _assigned_faculty uuid;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student');

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO _admin_exists;
  IF _role = 'admin' AND NOT _admin_exists THEN
    _approved := true;
  END IF;

  IF COALESCE((NEW.raw_user_meta_data->>'created_by_admin')::boolean, false) THEN
    _approved := true;
  END IF;

  BEGIN
    _assigned_faculty := NULLIF(NEW.raw_user_meta_data->>'assigned_faculty_id','')::uuid;
  EXCEPTION WHEN others THEN
    _assigned_faculty := NULL;
  END;

  INSERT INTO public.profiles (user_id, full_name, approved, assigned_faculty_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), _approved, _assigned_faculty);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$function$;