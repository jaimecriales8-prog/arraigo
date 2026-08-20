-- ============================================================
-- Aviso por WhatsApp al imputado tras 2 verificaciones seguidas sin
-- completar (missed/failed/completed-no-aprobado) — un paso antes del
-- escalamiento a alerta crítica que ya existe a las 3 seguidas
-- (check_case_escalation(), 20260725_010_escalamiento_alertas.sql).
-- Mismo cálculo de racha, pero streak_len=2 y sin trigger — el envío
-- es una llamada HTTP externa (SendPulse), así que se resuelve por
-- cron (mismo patrón que expire_missed_verifications/
-- check_device_silence) en vez de un trigger de Postgres.
-- ============================================================

CREATE TABLE whatsapp_notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  checkin_id  UUID NOT NULL REFERENCES checkins(id),
  kind        TEXT NOT NULL DEFAULT 'two_missed_warning',
  sent_ok     BOOLEAN NOT NULL,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (checkin_id, kind)
);

-- Solo el service role (edge function) escribe/lee. Sin RLS de cliente,
-- mismo patrón que facetec_sessions.
ALTER TABLE whatsapp_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION find_pending_whatsapp_warnings()
RETURNS TABLE (
  case_id UUID, checkin_id UUID, imputado_id UUID, nombre TEXT, telefono TEXT
)
LANGUAGE sql STABLE
AS $func$
  WITH ultimos AS (
    SELECT
      ck.case_id, ck.id AS checkin_id, ck.status, ck.overall_passed,
      ROW_NUMBER() OVER (PARTITION BY ck.case_id ORDER BY COALESCE(ck.completed_at, ck.scheduled_at) DESC) AS rn
    FROM checkins ck
    WHERE ck.status IN ('completed', 'missed', 'failed', 'excused')
  ),
  ultimos2 AS (
    SELECT * FROM ultimos WHERE rn <= 2
  ),
  rachas AS (
    SELECT
      case_id,
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE status = 'missed' OR status = 'failed' OR (status = 'completed' AND overall_passed = false)
      ) AS incumplidos,
      (array_agg(checkin_id ORDER BY rn))[1] AS ultimo_checkin_id
    FROM ultimos2
    GROUP BY case_id
  )
  SELECT r.case_id, r.ultimo_checkin_id, c.imputado_id, p.full_name, p.phone
  FROM rachas r
  JOIN cases c ON c.id = r.case_id
  JOIN profiles p ON p.id = c.imputado_id
  WHERE r.total = 2
    AND r.incumplidos = 2
    AND p.phone IS NOT NULL AND p.phone <> ''
    AND NOT EXISTS (
      SELECT 1 FROM whatsapp_notifications wn
      WHERE wn.checkin_id = r.ultimo_checkin_id AND wn.kind = 'two_missed_warning'
    );
$func$;
