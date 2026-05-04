
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
  faculty_id uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  s3 uuid := gen_random_uuid();
  c1 uuid := gen_random_uuid();
  c2 uuid := gen_random_uuid();
  d date;
  stu uuid;
  i int;
BEGIN
  INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) VALUES
  ('00000000-0000-0000-0000-000000000000', admin_id,'authenticated','authenticated','admin@lumina.edu',crypt('Admin@123',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Ada Admin','role','admin'),now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000', faculty_id,'authenticated','authenticated','faculty@lumina.edu',crypt('Faculty@123',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Prof. Fiona Faculty','role','faculty'),now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000', s1,'authenticated','authenticated','sam@lumina.edu',crypt('Student@123',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Sam Student','role','student'),now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000', s2,'authenticated','authenticated','riya@lumina.edu',crypt('Student@123',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Riya Roy','role','student'),now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000', s3,'authenticated','authenticated','karan@lumina.edu',crypt('Student@123',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Karan Kumar','role','student'),now(),now(),'','','','');

  -- Profiles & roles (in case trigger didn't fire)
  INSERT INTO public.profiles (user_id, full_name) VALUES
    (admin_id,'Ada Admin'),(faculty_id,'Prof. Fiona Faculty'),
    (s1,'Sam Student'),(s2,'Riya Roy'),(s3,'Karan Kumar')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES
    (admin_id,'admin'),(faculty_id,'faculty'),
    (s1,'student'),(s2,'student'),(s3,'student')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.courses (id, code, name, description, faculty_id) VALUES
    (c1,'CS101','Intro to Computer Science','Foundations of CS, algorithms, and problem solving.',faculty_id),
    (c2,'MA201','Linear Algebra','Vectors, matrices, eigenvalues and applications.',faculty_id);

  INSERT INTO public.enrollments (student_id, course_id) VALUES
    (s1,c1),(s2,c1),(s3,c1),(s1,c2),(s2,c2),(s3,c2);

  INSERT INTO public.course_materials (course_id, title, content, uploaded_by) VALUES
    (c1,'Week 1 Notes','Computer science studies algorithms, data structures, and computation. An algorithm is a finite sequence of well-defined instructions. Big-O notation describes the upper bound of growth rate. Common complexities: O(1), O(log n), O(n), O(n log n), O(n^2).',faculty_id),
    (c2,'Week 1 Notes','A vector is an ordered list of numbers. Matrix multiplication is associative but not commutative. Determinant of [[a,b],[c,d]] is ad-bc. Eigenvalues lambda satisfy det(A - lambda*I) = 0.',faculty_id);

  FOR i IN 0..13 LOOP
    d := CURRENT_DATE - i;
    IF EXTRACT(DOW FROM d) IN (0,6) THEN CONTINUE; END IF;
    FOREACH stu IN ARRAY ARRAY[s1,s2,s3] LOOP
      INSERT INTO public.attendance (student_id, course_id, session_date, present, marked_by)
        VALUES (stu, c1, d, (random() > 0.15), faculty_id);
      INSERT INTO public.attendance (student_id, course_id, session_date, present, marked_by)
        VALUES (stu, c2, d, (random() > 0.20), faculty_id);
    END LOOP;
  END LOOP;

  INSERT INTO public.timetable_slots (course_id, day_of_week, start_time, end_time, room) VALUES
    (c1,1,'09:00','10:00','R-101'),
    (c1,3,'09:00','10:00','R-101'),
    (c2,2,'11:00','12:00','R-102'),
    (c2,4,'11:00','12:00','R-102');

  INSERT INTO public.leaves (faculty_id, start_date, end_date, reason, status)
    VALUES (faculty_id, CURRENT_DATE + 7, CURRENT_DATE + 8, 'Conference travel', 'pending');
END $$;
