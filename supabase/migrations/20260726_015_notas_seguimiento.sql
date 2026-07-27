-- ============================================================
-- Notas de seguimiento internas por caso (NO visibles para el imputado,
-- a diferencia de case_messages). Para observaciones del funcionario
-- judicial: "habló con la familia", "pendiente audiencia el 15", etc.
-- ============================================================
CREATE TABLE case_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES profiles(id),
  note            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_notes_case_id ON case_notes(case_id);

ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;

-- Staff (judicial/operador/tecnico/super_admin) ve y crea notas de casos de su org.
CREATE POLICY "staff ve notas de su org" ON case_notes
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "staff crea notas en su org" ON case_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() IN ('judicial', 'operador', 'tecnico', 'super_admin') AND
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
