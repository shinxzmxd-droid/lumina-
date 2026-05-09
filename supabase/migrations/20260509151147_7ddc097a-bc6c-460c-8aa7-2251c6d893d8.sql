
-- Ensure domain is allowed
INSERT INTO public.allowed_email_domains (domain)
VALUES ('test.edu')
ON CONFLICT DO NOTHING;

-- Create the auth user if not exists
DO $$
DECLARE
  new_uid uuid;
BEGIN
  SELECT id INTO new_uid FROM auth.users WHERE email = 'admin@test.edu';

  IF new_uid IS NULL THEN
    new_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated',
      'admin@test.edu', crypt('Admin@12345', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Test Admin"}'::jsonb,
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_uid, jsonb_build_object('sub', new_uid::text, 'email', 'admin@test.edu'), 'email', new_uid::text, now(), now(), now());
  END IF;

  -- Ensure profile exists & approved
  INSERT INTO public.profiles (user_id, full_name, approved)
  VALUES (new_uid, 'Test Admin', true)
  ON CONFLICT (user_id) DO UPDATE SET approved = true, full_name = 'Test Admin';

  -- Remove any existing roles, set admin
  DELETE FROM public.user_roles WHERE user_id = new_uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (new_uid, 'admin');
END $$;
