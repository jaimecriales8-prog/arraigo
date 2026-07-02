-- ============================================================
-- Feature toggle: FaceTec (liveness facial certificado + matching)
-- ============================================================
-- Modelo "ambos": default global (env FACETEC_DEFAULT en app y
-- Edge Function) con override por organización.
--   facetec_enabled = NULL  → heredar el default global
--   facetec_enabled = TRUE  → forzar FaceTec para esta organización
--   facetec_enabled = FALSE → forzar modo actual (acelerómetro)
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS facetec_enabled BOOLEAN;

COMMENT ON COLUMN organizations.facetec_enabled IS
  'Override de FaceTec por organización. NULL = usar default global (env FACETEC_DEFAULT).';

-- Registrar qué método de liveness se usó en cada check-in (auditoría / peso probatorio)
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS liveness_method TEXT NOT NULL DEFAULT 'accelerometer';

COMMENT ON COLUMN checkins.liveness_method IS
  'Método de liveness usado: accelerometer | facetec';
