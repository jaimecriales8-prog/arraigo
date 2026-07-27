-- ============================================================
-- Reescribe la creación de check-ins programados como una sola
-- consulta SQL set-based, en vez del loop de la Edge Function
-- schedule-checkins (un round-trip a la BD por cada caso × horario
-- — no escala más allá de unos pocos miles de casos activos).
--
-- Mismo comportamiento exacto que el código anterior:
-- - Solo casos activos con checkin_times no nulo.
-- - Por cada horario del array, calcula scheduled_at/window_closes_at
--   en el timezone del caso (hora local, no UTC).
-- - Solo crea el check-in si "ahora" cae dentro de esa ventana.
-- - No duplica si ya existe un check-in 'scheduled' en esa ventana.
-- ============================================================

CREATE OR REPLACE FUNCTION create_scheduled_checkins()
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  WITH candidatos AS (
    SELECT
      c.id AS case_id,
      (
        date_trunc('day', now() AT TIME ZONE c.timezone)
        + (t.time_str)::time
      ) AT TIME ZONE c.timezone AS scheduled_at,
      (
        (
          date_trunc('day', now() AT TIME ZONE c.timezone)
          + (t.time_str)::time
        ) AT TIME ZONE c.timezone
      ) + (c.checkin_window_min || ' minutes')::interval AS window_closes_at
    FROM cases c
    CROSS JOIN LATERAL jsonb_array_elements_text(c.checkin_times) AS t(time_str)
    WHERE c.status = 'active'
      AND c.checkin_times IS NOT NULL
      AND jsonb_array_length(c.checkin_times) > 0
  ),
  en_ventana AS (
    SELECT *
    FROM candidatos
    WHERE now() >= scheduled_at AND now() <= window_closes_at
  ),
  a_crear AS (
    SELECT ev.*
    FROM en_ventana ev
    WHERE NOT EXISTS (
      SELECT 1 FROM checkins ck
      WHERE ck.case_id = ev.case_id
        AND ck.type = 'scheduled'
        AND ck.scheduled_at >= ev.scheduled_at
        AND ck.scheduled_at < ev.window_closes_at
    )
  ),
  insertados AS (
    INSERT INTO checkins (case_id, type, status, scheduled_at, window_closes_at, expires_at)
    SELECT case_id, 'scheduled', 'pending', scheduled_at, window_closes_at, window_closes_at
    FROM a_crear
    RETURNING id
  )
  SELECT count(*) INTO inserted_count FROM insertados;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Cron cada 15 min — mismo intervalo que ya documentaba docs/flujo-checkin.md
-- (la referencia a esta función ya existía en la documentación, pero nunca
-- se había creado realmente ni programado).
SELECT cron.schedule(
  'create-scheduled-checkins',
  '*/15 * * * *',
  'SELECT create_scheduled_checkins();'
);
