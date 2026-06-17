-- ============================================================
-- SEED DE PRUEBA — usuario imputado + caso completo
-- Ejecutar en SQL Editor del Dashboard
-- ============================================================

-- 1. Deshabilitar trigger problemático temporalmente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Insertar usuario imputado directamente en auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'prueba.imputado@arraigo.co',
  crypt('Arraigo2026!', gen_salt('bf')),
  NOW(),
  '{"full_name": "Carlos Andrés Ríos", "role": "imputado"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  'authenticated',
  'authenticated',
  NOW(),
  NOW(),
  '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- También insertar en auth.identities (requerido por Supabase)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'prueba.imputado@arraigo.co',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"prueba.imputado@arraigo.co"}'::jsonb,
  'email',
  NOW(), NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Crear perfil del imputado
INSERT INTO profiles (id, organization_id, role, full_name, document_type, document_number, phone)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  'imputado',
  'Carlos Andrés Ríos',
  'CC',
  '1023456789',
  '3001234567'
) ON CONFLICT (id) DO NOTHING;

-- 4. Crear caso activo para el imputado
INSERT INTO cases (
  id,
  organization_id,
  imputado_id,
  case_number,
  court,
  crime_description,
  status,
  address,
  city,
  department,
  location,
  geofence_radius_m,
  checkin_times,
  checkin_window_min,
  timezone,
  face_threshold,
  scene_threshold,
  start_date,
  onboarding_done_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '2026-00123',
  'Juzgado 5 Penal del Circuito de Bogotá',
  'Hurto agravado',
  'active',
  'Calle 45 # 12-34, Barrio Chapinero',
  'Bogotá',
  'Cundinamarca',
  ST_SetSRID(ST_MakePoint(-74.0721, 4.6097), 4326),
  150,
  '["08:00","14:00","20:00"]'::jsonb,
  30,
  'America/Bogota',
  0.80,
  0.82,
  '2026-06-01',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 5. Crear checkpoints del domicilio (los que el técnico registraría)
INSERT INTO checkpoints (id, case_id, label, description, photo_url, sort_order, created_by)
VALUES
  (
    'cccc0001-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Ventana sala con cortina gris',
    'Apunta la cámara hacia la ventana grande de la sala. Deben verse las cortinas grises.',
    'https://placehold.co/400x300?text=Ventana+sala',
    1,
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'cccc0002-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Nevera de la cocina',
    'Apunta hacia la nevera blanca en la cocina. Debe verse la manija.',
    'https://placehold.co/400x300?text=Nevera+cocina',
    2,
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'cccc0003-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Puerta principal',
    'Apunta hacia la puerta de entrada del apartamento.',
    'https://placehold.co/400x300?text=Puerta+principal',
    3,
    '11111111-1111-1111-1111-111111111111'
  );

-- 6. Crear un check-in pendiente AHORA (ventana abierta por 30 min)
INSERT INTO checkins (id, case_id, scheduled_at, window_closes_at, status)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  NOW() - INTERVAL '5 minutes',
  NOW() + INTERVAL '25 minutes',
  'pending'
) ON CONFLICT (id) DO NOTHING;

-- 7. Recrear trigger corregido
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role := 'imputado';
  v_role_str TEXT;
BEGIN
  v_role_str := NEW.raw_user_meta_data->>'role';
  IF v_role_str IS NOT NULL THEN
    BEGIN
      v_role := v_role_str::user_role;
    EXCEPTION WHEN OTHERS THEN
      v_role := 'imputado'::user_role;
    END;
  END IF;

  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  ) ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

SELECT 'Seed completado ✓' AS resultado;
