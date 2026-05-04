
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'faculty', 'student');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() ORDER BY
    CASE role WHEN 'admin' THEN 1 WHEN 'faculty' THEN 2 ELSE 3 END LIMIT 1;
$$;

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + default student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Courses
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  faculty_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Enrollments
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  present BOOLEAN NOT NULL DEFAULT true,
  marked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id, session_date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Leaves
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Timetable
CREATE TABLE public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL, -- 1=Mon..6=Sat
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;

-- Course materials
CREATE TABLE public.course_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;

-- AI interactions
CREATE TABLE public.ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'chat',
  prompt TEXT,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Profiles viewable by all auth users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- courses
CREATE POLICY "Anyone auth views courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faculty/Admin create courses" ON public.courses FOR INSERT WITH CHECK (public.has_role(auth.uid(),'faculty') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Faculty update own / admin all" ON public.courses FOR UPDATE USING (faculty_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Faculty delete own / admin all" ON public.courses FOR DELETE USING (faculty_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- enrollments
CREATE POLICY "Students view own enrollments, faculty/admin all" ON public.enrollments FOR SELECT USING (
  student_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.faculty_id = auth.uid())
);
CREATE POLICY "Students self-enroll" ON public.enrollments FOR INSERT WITH CHECK (student_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'faculty'));
CREATE POLICY "Admin/Faculty delete enrollment" ON public.enrollments FOR DELETE USING (student_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.faculty_id = auth.uid()));

-- attendance
CREATE POLICY "View attendance" ON public.attendance FOR SELECT USING (
  student_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.faculty_id = auth.uid())
);
CREATE POLICY "Faculty/Admin mark attendance" ON public.attendance FOR INSERT WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.faculty_id = auth.uid())
);
CREATE POLICY "Faculty/Admin update attendance" ON public.attendance FOR UPDATE USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.faculty_id = auth.uid())
);

-- leaves
CREATE POLICY "Faculty view own / admin all leaves" ON public.leaves FOR SELECT USING (faculty_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Faculty create own leave" ON public.leaves FOR INSERT WITH CHECK (faculty_id = auth.uid());
CREATE POLICY "Admin update leave" ON public.leaves FOR UPDATE USING (public.has_role(auth.uid(),'admin'));

-- timetable
CREATE POLICY "Anyone auth views timetable" ON public.timetable_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faculty/Admin manage timetable" ON public.timetable_slots FOR ALL USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.faculty_id = auth.uid())
) WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.faculty_id = auth.uid())
);

-- materials
CREATE POLICY "Auth users view materials" ON public.course_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faculty/Admin manage materials" ON public.course_materials FOR ALL USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.faculty_id = auth.uid())
) WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.faculty_id = auth.uid())
);

-- ai_interactions
CREATE POLICY "Users view own AI / admin all" ON public.ai_interactions FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own AI" ON public.ai_interactions FOR INSERT WITH CHECK (user_id = auth.uid());
