-- Fix trigger handle_new_user + datos de prueba

-- 1. Corregir el trigger (el cast del enum fallaba cuando metadata era null)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
  v_role_str TEXT;
BEGIN
  v_role_str := NEW.raw_user_meta_data->>'role';
  BEGIN
    v_role := v_role_str::user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'imputado'::user_role;
  END;
  IF v_role IS NULL THEN
    v_role := 'imputado'::user_role;
  END IF;

  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Organización de prueba
INSERT INTO organizations (id, name, nit, contact_email, city, department)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'INPEC Regional Bogotá',
  '899999032-5',
  'regional.bogota@inpec.gov.co',
  'Bogotá',
  'Cundinamarca'
) ON CONFLICT (id) DO NOTHING;
