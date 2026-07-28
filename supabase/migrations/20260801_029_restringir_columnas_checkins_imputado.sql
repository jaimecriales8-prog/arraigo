-- ============================================================
-- Vulnerabilidad CRITICAL: la política "imputado registra checkin"
-- (INSERT) valida que el case_id le pertenezca y esté activo, pero no
-- restringe columnas. Un imputado podía insertar directo, con su
-- propia sesión, una fila con status='completed', overall_passed=true,
-- gps_passed=true, face_passed=true, scene_passed=true — fabricando
-- un check-in "cumplido" sin selfie, GPS ni escena real, sin pasar
-- nunca por process-checkin. Esto anula la garantía central del
-- producto (monitoreo verificado de arresto domiciliario).
--
-- Esta política de INSERT la usa únicamente el flujo de verificación
-- sorpresa (apps/mobile/app/(imputado)/checkin/sorpresa.tsx) — los
-- check-ins programados los crea el cron (create_scheduled_checkins,
-- SECURITY DEFINER, no pasa por RLS de cliente). El insert legítimo
-- del imputado solo necesita: case_id, type, scheduled_at,
-- window_closes_at, expires_at — status queda en su default 'pending'
-- y todos los campos de resultado (face_*, gps_*, scene_*, overall_*,
-- completed_at) solo los escribe process-checkin con service-role.
-- ============================================================

REVOKE INSERT ON checkins FROM authenticated;
GRANT INSERT (case_id, type, scheduled_at, window_closes_at, expires_at) ON checkins TO authenticated;
