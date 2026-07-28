-- ============================================================
-- Fix de zona horaria en expire_missed_verifications(): la
-- comparación `ck.scheduled_at <= (ma.appointment_date + ma.end_time)`
-- comparaba un timestamptz contra un timestamp SIN zona horaria — Postgres
-- lo interpreta implícitamente en la zona del SESSION (UTC en Supabase),
-- no en la zona del caso (America/Bogota). Mismo bug que se corrigió del
-- lado del edge function report-medical-appointment. Se agrega
-- `AT TIME ZONE c.timezone`, mismo patrón que create_scheduled_checkins()
-- (20260727_017_schedule_checkins_set_based.sql).
-- ============================================================

CREATE OR REPLACE FUNCTION expire_missed_verifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $func$
  WITH checkins_a_excusar AS (
    UPDATE checkins ck
      SET status = 'excused',
          excused_reason = 'Cita medica reportada por el imputado (excusa automatica)'
    FROM cases c
    JOIN organizations o ON o.id = c.organization_id
    JOIN medical_appointments ma ON ma.case_id = c.id
    WHERE ck.case_id = c.id
      AND ck.status = 'pending'
      AND ck.window_closes_at < NOW()
      AND o.auto_excusar_citas_medicas = true
      AND ck.scheduled_at <= ((ma.appointment_date + ma.end_time) AT TIME ZONE c.timezone)
      AND ck.window_closes_at >= ((ma.appointment_date + ma.start_time) AT TIME ZONE c.timezone)
    RETURNING ck.id
  ),
  checkins_vencidos AS (
    UPDATE checkins
      SET status = 'missed'
    WHERE status = 'pending'
      AND window_closes_at < NOW()
      AND id NOT IN (SELECT id FROM checkins_a_excusar)
    RETURNING id, case_id
  ),
  alertas_checkins AS (
    INSERT INTO alerts (case_id, checkin_id, severity, type, message)
    SELECT case_id, id, 'warning', 'missed',
           'No realizo la verificacion en la ventana asignada'
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
         'No respondio a la verificacion sorpresa dentro del tiempo limite'
  FROM sorpresas_vencidas;
$func$;
