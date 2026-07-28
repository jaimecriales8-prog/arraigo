-- El imputado puede leer sus propias citas médicas reportadas (para verlas
-- en la app) — solo SELECT, sin restricción de columna que aplique aquí
-- (no es UPDATE/INSERT, es de solo lectura, misma clase segura que
-- "imputado ve sus propios checkins").
CREATE POLICY "imputado ve sus propias citas medicas" ON medical_appointments
  FOR SELECT TO authenticated
  USING (imputado_id = auth.uid());
