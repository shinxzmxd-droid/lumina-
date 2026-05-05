
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faculty/Admin create announcements" ON public.announcements FOR INSERT WITH CHECK (has_role(auth.uid(),'faculty') OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner/Admin delete announcements" ON public.announcements FOR DELETE USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner/Admin update announcements" ON public.announcements FOR UPDATE USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'));

CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT,
  event_date DATE NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faculty/Admin create events" ON public.events FOR INSERT WITH CHECK (has_role(auth.uid(),'faculty') OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner/Admin delete events" ON public.events FOR DELETE USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner/Admin update events" ON public.events FOR UPDATE USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'));
