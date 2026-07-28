-- ============================================================
-- Campo género (necesario para el estudio demográfico de
-- cumplimiento) + función de agregación que junta datos
-- demográficos del caso con sus estadísticas de check-in.
-- ============================================================

ALTER TABLE cases ADD COLUMN genero TEXT;

CREATE OR REPLACE FUNCTION demografia_cumplimiento_stats(p_organization_id UUID)
RETURNS TABLE (
  case_id UUID,
  genero TEXT, estrato INTEGER, nivel_educativo TEXT, estado_civil TEXT,
  ocupacion TEXT, regimen_salud TEXT, tenencia_vivienda TEXT,
  tiene_hijos BOOLEAN, movilidad_reducida BOOLEAN, danger_level SMALLINT,
  total_checkins BIGINT, aprobados BIGINT, excusados BIGINT
) AS $$
  SELECT
    c.id, c.genero, c.estrato, c.nivel_educativo, c.estado_civil,
    c.ocupacion, c.regimen_salud, c.tenencia_vivienda,
    c.tiene_hijos, c.movilidad_reducida, c.danger_level,
    count(ck.id) AS total_checkins,
    count(ck.id) FILTER (WHERE ck.status = 'completed' AND ck.overall_passed) AS aprobados,
    count(ck.id) FILTER (WHERE ck.status = 'excused') AS excusados
  FROM cases c
  LEFT JOIN checkins ck ON ck.case_id = c.id
  WHERE (p_organization_id IS NULL OR c.organization_id = p_organization_id)
  GROUP BY c.id;
$$ LANGUAGE sql STABLE;
