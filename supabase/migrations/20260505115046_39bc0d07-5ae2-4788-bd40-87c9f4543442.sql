ALTER TABLE public.timetable_slots ADD COLUMN IF NOT EXISTS class_group_id uuid REFERENCES public.class_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_timetable_slots_class_group ON public.timetable_slots(class_group_id);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_course_day ON public.timetable_slots(course_id, day_of_week, start_time);