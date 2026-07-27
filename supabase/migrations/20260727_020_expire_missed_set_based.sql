-- ============================================================
-- Reescribe expire_missed_verifications() a SQL set-based — el UPDATE
-- ya era set-based, pero el INSERT de alertas resultante iba fila por
-- fila dentro de un loop PL/pgSQL. Con 50k casos y miles de check-ins
-- venciendo en una misma corrida (pico cada 15 min), eso son miles de
-- inserts individuales serializados en vez de uno solo por lote.
-- Mismo comportamiento exacto: check-ins pending vencidos → missed +
-- alerta warning; sorpresas pending vencidas → expired + alerta critical.
-- ============================================================

CREATE OR REPLACE FUNCTION expire_missed_verifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH checkins_vencidos AS (
    UPDATE checkins
      SET status = 'missed'
    WHERE status = 'pending'
      AND window_closes_at < NOW()
    RETURNING id, case_id
  ),
  alertas_checkins AS (
    INSERT INTO alerts (case_id, checkin_id, severity, type, message)
    SELECT case_id, id, 'warning', 'missed',
           'No realizó la verificación en la ventana asignada'
    FROM checkins_vencidos
  ),
  sorpresas_vencidas AS (
    UPDATE surprise_verifications
      SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < NOW()
    RETURNING id, case_id
  )
  INSERT INTO alerts (case_id, checkin_id, severity, type, message)
  SELECT case_id, NULL, 'critical', 'surprise_missed',
         'No respondió a la verificación sorpresa dentro del tiempo límite'
  FROM sorpresas_vencidas;
$$;
