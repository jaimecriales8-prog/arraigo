-- ============================================================
-- Vulnerabilidad HIGH: las políticas RLS de UPDATE para tecnico en
-- cases/profiles (formalizadas en 20260731_025) restringen solo FILAS,
-- no columnas. Un técnico autenticado podía escribir CUALQUIER columna
-- de su caso asignado con su propia sesión vía PostgREST directo —
-- incluyendo organization_id, geofence_radius_m, work_change_approved_at
-- (auto-aprobarse un cambio de sitio de trabajo, saltándose la
-- aprobación de judicial), no solo los 4 campos que usa la app.
--
-- Postgres no permite restringir por columna con GRANT/REVOKE aquí
-- porque cases/profiles tienen otras políticas UPDATE (judicial,
-- org_admin) que sí necesitan escribir muchas columnas y comparten el
-- mismo rol 'authenticated' — restringir columnas a nivel de rol
-- rompería esas políticas también.
--
-- Fix: se elimina el UPDATE directo del cliente para tecnico; ese
-- guardado ahora pasa por el edge function finalize-onboarding
-- (service-role, lista blanca explícita: location, onboarding_done_at,
-- status, reference_photo_url — mismo patrón que register-work-location
-- y save-onboarding-details).
-- ============================================================

DROP POLICY IF EXISTS "tecnico actualiza caso asignado" ON cases;
DROP POLICY IF EXISTS "tecnico actualiza foto imputado" ON profiles;
