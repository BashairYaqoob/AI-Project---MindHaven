CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _account_type text := lower(coalesce(NEW.raw_user_meta_data->>'account_type', 'user'));
  _role app_role;
  _age_text text := NEW.raw_user_meta_data->>'age';
  _age bigint := NULL;
  _gender text := NEW.raw_user_meta_data->>'gender';
BEGIN
  IF _age_text IS NOT NULL AND _age_text ~ '^[0-9]+$' THEN
    _age := _age_text::bigint;
  END IF;

  IF _account_type = 'admin' THEN
    _role := 'admin'::app_role;
  ELSE
    _role := 'user'::app_role;
  END IF;

  INSERT INTO public."Profiles" (id, name, age, gender, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    _age,
    NULLIF(_gender, ''),
    _account_type
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    age = COALESCE(EXCLUDED.age, public."Profiles".age),
    gender = COALESCE(EXCLUDED.gender, public."Profiles".gender),
    role = EXCLUDED.role;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;