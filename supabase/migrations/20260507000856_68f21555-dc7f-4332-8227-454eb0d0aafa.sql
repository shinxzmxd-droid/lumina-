
-- 1. Make course-materials bucket private, remove anon SELECT policy
UPDATE storage.buckets SET public = false WHERE id = 'course-materials';
DROP POLICY IF EXISTS "Public read course-materials" ON storage.objects;

-- 2. Leaves: add DELETE policy for owner/admin
CREATE POLICY "Faculty delete own / admin all leaves"
ON public.leaves
FOR DELETE
TO public
USING ((faculty_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Profiles: tighten SELECT
DROP POLICY IF EXISTS "Profiles viewable by all auth users" ON public.profiles;

CREATE POLICY "Profiles visibility scoped"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'faculty'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.user_id AND ur.role = 'faculty'::app_role
  )
);

-- 4. user_roles: explicit admin-only write policies (defense-in-depth)
CREATE POLICY "Only admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
