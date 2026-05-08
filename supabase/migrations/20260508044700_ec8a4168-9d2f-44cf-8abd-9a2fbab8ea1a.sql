
-- Allowed email domains table
CREATE TABLE IF NOT EXISTS public.allowed_email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.allowed_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view allowed domains"
  ON public.allowed_email_domains FOR SELECT
  USING (true);

CREATE POLICY "Admins manage allowed domains"
  ON public.allowed_email_domains FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed example domains
INSERT INTO public.allowed_email_domains (domain) VALUES
  ('mvjce.edu.in'),
  ('vemanait.edu.in'),
  ('college.edu')
ON CONFLICT (domain) DO NOTHING;

-- Replace handle_new_user to enforce allowed-domain check
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _assigned_faculty uuid;
  _domain text;
  _allowed boolean;
BEGIN
  _domain := lower(split_part(NEW.email, '@', 2));

  SELECT EXISTS(
    SELECT 1 FROM public.allowed_email_domains WHERE lower(domain) = _domain
  ) INTO _allowed;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'Please use your official college email address to continue.'
      USING ERRCODE = 'check_violation';
  END IF;

  BEGIN
    _assigned_faculty := NULLIF(NEW.raw_user_meta_data->>'assigned_faculty_id','')::uuid;
  EXCEPTION WHEN others THEN
    _assigned_faculty := NULL;
  END;

  INSERT INTO public.profiles (user_id, full_name, approved, assigned_faculty_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), false, _assigned_faculty);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$function$;
