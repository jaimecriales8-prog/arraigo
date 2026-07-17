-- ============================================================
-- Vencimiento de verificaciones no realizadas + alerta al operador
-- ============================================================
-- pg_cron cada 15 min:
--  1. Check-ins programados 'pending' con la ventana cerrada → 'missed' + alerta warning.
--  2. Sorpresas 'pending' cuyo expires_at pasó → 'expired' + alerta critical.
-- NOTA: la tabla alerts NO tiene organization_id (se deriva del caso vía RLS).
-- ============================================================

CREATE OR REPLACE FUNCTION expire_missed_verifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Check-ins programados vencidos → missed
  FOR r IN
    UPDATE checkins c
      SET status = 'missed'
    WHERE c.status = 'pending'
      AND c.window_closes_at < NOW()
    RETURNING c.id, c.case_id
  LOOP
    INSERT INTO alerts (case_id, checkin_id, severity, type, message)
    VALUES (r.case_id, r.id, 'warning', 'missed',
            'No realizó la verificación en la ventana asignada');
  END LOOP;

  -- 2. Sorpresas no atendidas → expired
  FOR r IN
    UPDATE surprise_verifications sv
      SET status = 'expired'
    WHERE sv.status = 'pending'
      AND sv.expires_at < NOW()
    RETURNING sv.id, sv.case_id
  LOOP
    INSERT INTO alerts (case_id, checkin_id, severity, type, message)
    VALUES (r.case_id, NULL, 'critical', 'surprise_missed',
            'No respondió a la verificación sorpresa dentro del tiempo límite');
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'expire-missed-verifications',
  '*/15 * * * *',
  'SELECT expire_missed_verifications();'
);
