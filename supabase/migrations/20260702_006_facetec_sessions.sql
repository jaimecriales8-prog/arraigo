-- ============================================================
-- Sesiones FaceTec registradas SERVER-SIDE (Milestone 2 / proxy)
-- ============================================================
-- El veredicto de liveness/match ya no se confía del teléfono:
-- facetec-proxy reenvía los blobs a FaceTec y guarda aquí lo que
-- FaceTec respondió. process-checkin lee de esta tabla.
-- ============================================================

CREATE TABLE facetec_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imputado_id     UUID NOT NULL REFERENCES profiles(id),
  checkin_id      UUID REFERENCES checkins(id),
  kind            TEXT NOT NULL CHECK (kind IN ('enroll', 'auth')),
  was_processed   BOOLEAN NOT NULL DEFAULT false,
  error           TEXT,
  result          JSONB,          -- respuesta de FaceTec sin blobs (diagnóstico/peritaje)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_facetec_sessions_lookup
  ON facetec_sessions (imputado_id, kind, created_at DESC);

-- Solo el service role (Edge Functions) escribe y lee. Sin políticas = sin acceso cliente.
ALTER TABLE facetec_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE facetec_sessions IS
  'Evidencia server-side de sesiones FaceTec (proxy). El cliente nunca escribe aquí.';
