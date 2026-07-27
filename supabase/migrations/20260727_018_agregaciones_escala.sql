-- ============================================================
-- Agregaciones en SQL para el mapa y el reporte consolidado —
-- antes traían TODOS los check-ins/alertas de TODOS los casos al
-- servidor de Next.js para sumarlos en JavaScript. Con 50.000 casos
-- y meses de historial (3 check-ins/día c/u), eso son millones de
-- filas por request. Ahora la suma/último-registro la hace Postgres,
-- y solo viaja un resumen (una fila por caso).
-- ============================================================

-- Vista: último check-in por caso, para el mapa (antes traía TODO el
-- historial de check-ins anidado solo para calcular el más reciente).
-- Respeta RLS de las tablas subyacentes (cases/checkins) — no hace
-- falta política nueva, una vista normal aplica el RLS del que consulta.
CREATE OR REPLACE VIEW mapa_casos
WITH (security_invoker = true) -- OBLIGATORIO: sin esto, la vista corre con
                                -- los privilegios del dueño (postgres) y
                                -- se salta el RLS de cases/checkins/profiles.
AS
SELECT
  c.id,
  c.case_number,
  c.status,
  c.department,
  c.city,
  c.location,
  c.danger_level,
  c.organization_id,
  p.full_name AS imputado_nombre,
  ck.id AS ultimo_checkin_id,
  ck.status AS ultimo_checkin_status,
  ck.overall_passed AS ultimo_overall_passed,
  ck.created_at AS ultimo_checkin_created_at
FROM cases c
LEFT JOIN profiles p ON p.id = c.imputado_id
LEFT JOIN LATERAL (
  SELECT id, status, overall_passed, created_at
  FROM checkins
  WHERE checkins.case_id = c.id
  ORDER BY created_at DESC
  LIMIT 1
) ck ON true;

-- Función: estadísticas agregadas por caso para el reporte consolidado
-- (antes traía cada check-in y cada alerta cruda al servidor y sumaba
-- en JS). SECURITY INVOKER (default) — respeta RLS del que llama, pero
-- igual filtramos explícito por organization_id como ya hacía la ruta.
CREATE OR REPLACE FUNCTION reporte_consolidado_stats(
  p_organization_id UUID,       -- NULL = todas las orgs (solo super_admin debería llamar así)
  p_desde TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  case_id UUID,
  total_checkins BIGINT,
  aprobados BIGINT,
  fallidos BIGINT,
  excusados BIGINT,
  alertas_total BIGINT,
  alertas_criticas BIGINT
) AS $$
  SELECT
    c.id,
    count(ck.id) AS total_checkins,
    count(ck.id) FILTER (
      WHERE ck.status = 'completed' AND ck.overall_passed
    ) AS aprobados,
    count(ck.id) FILTER (
      WHERE ck.status IN ('failed', 'missed')
        OR (ck.status = 'completed' AND ck.overall_passed = false)
    ) AS fallidos,
    count(ck.id) FILTER (WHERE ck.status = 'excused') AS excusados,
    count(DISTINCT a.id) AS alertas_total,
    count(DISTINCT a.id) FILTER (WHERE a.severity = 'critical') AS alertas_criticas
  FROM cases c
  LEFT JOIN checkins ck
    ON ck.case_id = c.id
    AND (p_desde IS NULL OR ck.created_at >= p_desde)
  LEFT JOIN alerts a
    ON a.case_id = c.id
    AND a.is_resolved = false
  WHERE (p_organization_id IS NULL OR c.organization_id = p_organization_id)
  GROUP BY c.id;
$$ LANGUAGE sql STABLE;
