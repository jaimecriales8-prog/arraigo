-- ============================================================
-- Reescribe check_device_silence() a SQL set-based — antes hacía un
-- loop PL/pgSQL fila por fila (un INSERT por caso silencioso) sobre
-- todos los casos activos cada 30 min. Con 50k casos activos, ese
-- loop sería miles de iteraciones secuenciales cada corrida del cron.
-- Mismo comportamiento exacto: alerta crítica si un imputado con caso
-- activo lleva >12h sin reportar (o nunca ha reportado), sin duplicar
-- mientras la ventana de silencio siga vigente.
-- ============================================================

CREATE OR REPLACE FUNCTION check_device_silence()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO alerts (case_id, severity, type, message)
  SELECT
    c.id,
    'critical',
    'device_silent',
    CASE WHEN p.last_seen_at IS NULL
      THEN 'El dispositivo del imputado nunca ha reportado actividad'
      ELSE 'El dispositivo lleva más de 12 horas sin reportar actividad (última vez: ' ||
           to_char(p.last_seen_at AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH24:MI') || ')'
    END
  FROM cases c
  JOIN profiles p ON p.id = c.imputado_id
  WHERE c.status = 'active'
    AND (p.last_seen_at IS NULL OR p.last_seen_at < NOW() - INTERVAL '12 hours')
    AND NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.case_id = c.id
        AND a.type = 'device_silent'
        AND a.created_at > NOW() - INTERVAL '12 hours'
    );
$$;
