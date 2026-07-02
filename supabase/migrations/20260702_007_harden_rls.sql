-- ============================================================
-- Endurecimiento RLS (auditoría de seguridad 2026-07-02)
-- ============================================================
-- El imputado NO debe poder marcar sus propias sorpresas como completadas.
-- Esa transición la hace process-checkin (service role) tras verificar el
-- check-in. Con esta política el imputado podía cerrar una sorpresa sin
-- verificarse.
-- ============================================================

DROP POLICY IF EXISTS "imputado actualiza sus verificaciones sorpresa" ON surprise_verifications;

-- (El imputado conserva SELECT sobre sus sorpresas para el flujo de detección.)
