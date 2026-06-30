-- ============================================================
-- Añadir rol 'operador' + políticas RLS
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'operador';

-- profiles: operador ve perfiles de su org
CREATE POLICY "operador ve perfiles de su org" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'operador'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- cases: operador ve casos de su org
CREATE POLICY "operador ve casos de su org" ON cases
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'operador'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- checkpoints: operador ve los de su org (via cases)
CREATE POLICY "operador ve checkpoints de su org" ON checkpoints
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'operador'
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_id
        AND c.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- checkins: operador ve los de su org (via cases)
CREATE POLICY "operador ve checkins de su org" ON checkins
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'operador'
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_id
        AND c.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- alerts: operador ve alertas de su org (via cases)
CREATE POLICY "operador ve alertas de su org" ON alerts
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'operador'
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_id
        AND c.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "operador actualiza alertas de su org" ON alerts
  FOR UPDATE TO authenticated
  USING (
    auth_role() = 'operador'
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_id
        AND c.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- surprise_verifications: operador puede crear y ver
CREATE POLICY "operador crea verificaciones sorpresa" ON surprise_verifications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'operador'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "operador ve verificaciones de su org" ON surprise_verifications
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'operador'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- audit_log: operador puede leer el de su org
CREATE POLICY "operador lee audit_log de su org" ON audit_log
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'operador'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
