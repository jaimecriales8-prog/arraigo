-- ============================================================
-- Reporte de citas médicas del imputado, con excusa automática
-- opcional de check-ins que caigan dentro de la ventana declarada.
-- Solo por adelantado (no justificación retroactiva) — el edge
-- function report-medical-appointment valida esto server-side.
-- ============================================================

CREATE TABLE medical_appointments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  case_id          UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  imputado_id      UUID NOT NULL REFERENCES profiles(id),
  appointment_date DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_medical_appointments_case ON medical_appointments (case_id, appointment_date);

-- Solo el service role (edge function / panel) lee y escribe — sin políticas
-- de INSERT/UPDATE para el cliente, mismo patrón que facetec_sessions.
ALTER TABLE medical_appointments ENABLE ROW LEVEL SECURITY;

ALTER TABLE organizations ADD COLUMN auto_excusar_citas_medicas BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN max_citas_medicas_mes INTEGER NOT NULL DEFAULT 2;

-- ============================================================
-- expire_missed_verifications(): antes de marcar 'missed' los
-- check-ins pending vencidos, excusa automáticamente los que caen
-- dentro de una cita médica reportada, si la organización activó
-- auto_excusar_citas_medicas. excused_by queda NULL (excusa del
-- sistema, no de un funcionario).
-- ============================================================
CREATE OR REPLACE FUNCTION expire_missed_verifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH checkins_a_excusar AS (
    UPDATE checkins ck
      SET status = 'excused',
          excused_reason = 'Cita médica reportada por el imputado (excusa automática)'
    FROM cases c
    JOIN organizations o ON o.id = c.organization_id
    JOIN medical_appointments ma ON ma.case_id = c.id
    WHERE ck.case_id = c.id
      AND ck.status = 'pending'
      AND ck.window_closes_at < NOW()
      AND o.auto_excusar_citas_medicas = true
      AND ck.scheduled_at <= (ma.appointment_date + ma.end_time)
      AND ck.window_closes_at >= (ma.appointment_date + ma.start_time)
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
