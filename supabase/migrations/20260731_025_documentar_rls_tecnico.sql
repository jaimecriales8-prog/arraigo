-- ============================================================
-- Estas dos políticas YA EXISTEN en producción (confirmado por
-- consulta directa a pg_policies el 2026-07-31) pero nunca quedaron
-- en una migración local — mismo patrón ya documentado en
-- docs/roadmap.md con create_scheduled_checkins. Esta migración solo
-- las formaliza en el repo (idempotente: DROP + CREATE) para que no
-- se pierdan en otra sesión/entorno; no cambia ningún comportamiento.
--
-- Habilitan que el técnico asignado a un caso pueda: (a) actualizar
-- ese caso durante el onboarding (location, onboarding_done_at,
-- status), y (b) actualizar la foto de referencia del imputado de
-- ese caso — exactamente lo que hace confirmar.tsx al finalizar el
-- onboarding.
-- ============================================================

DROP POLICY IF EXISTS "tecnico actualiza caso asignado" ON cases;
CREATE POLICY "tecnico actualiza caso asignado" ON cases
  FOR UPDATE TO authenticated
  USING (technician_id = auth.uid())
  WITH CHECK (technician_id = auth.uid());

DROP POLICY IF EXISTS "tecnico actualiza foto imputado" ON profiles;
CREATE POLICY "tecnico actualiza foto imputado" ON profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.imputado_id = profiles.id AND cases.technician_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cases WHERE cases.imputado_id = profiles.id AND cases.technician_id = auth.uid())
  );
