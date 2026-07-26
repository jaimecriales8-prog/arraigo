-- ============================================================
-- Nivel de peligrosidad del caso (1-5)
-- ============================================================
-- Clasificación manual que asigna el juzgado al crear/editar el caso, para
-- priorizar monitoreo y filtrar en el panel y el mapa. 1 = menos peligroso,
-- 5 = más peligroso. Default 3 (nivel medio) para casos existentes/nuevos
-- sin clasificar explícitamente.
-- ============================================================

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS danger_level SMALLINT NOT NULL DEFAULT 3
    CHECK (danger_level BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_cases_danger_level ON cases(danger_level);
