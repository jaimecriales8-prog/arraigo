-- ============================================================
-- Mensajería al preso: instrucción/advertencia del funcionario
-- ============================================================
-- Más allá de la verificación sorpresa (que exige una acción de verificación),
-- esto es un mensaje de texto libre ("preséntese ahora", "acérquese a la
-- ventana") que el funcionario envía al imputado. Se entrega por push (APNs)
-- si hay token registrado, y queda persistido para que la app lo muestre
-- aunque el push falle (polling, igual que las sorpresas) y para trazabilidad
-- judicial (quién envió qué y cuándo, si el imputado lo vio).
-- ============================================================

CREATE TABLE case_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  sent_by         UUID NOT NULL REFERENCES profiles(id),
  message         TEXT NOT NULL,
  push_sent       BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_messages_case_id ON case_messages(case_id);

ALTER TABLE case_messages ENABLE ROW LEVEL SECURITY;

-- Staff (judicial/operador/super_admin) ve y crea mensajes de casos de su org.
CREATE POLICY "staff ve mensajes de su org" ON case_messages
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "staff crea mensajes en su org" ON case_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() IN ('judicial', 'operador', 'super_admin') AND
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- El imputado ve y marca como leídos los mensajes de su propio caso.
CREATE POLICY "imputado ve sus mensajes" ON case_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases c WHERE c.id = case_id AND c.imputado_id = auth.uid())
  );

CREATE POLICY "imputado marca sus mensajes como leidos" ON case_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases c WHERE c.id = case_id AND c.imputado_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cases c WHERE c.id = case_id AND c.imputado_id = auth.uid())
  );
