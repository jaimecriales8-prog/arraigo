-- ============================================================
-- Escalamiento de alertas: 3 incumplimientos consecutivos → crítica
-- ============================================================
-- Hoy cada check-in fallido/no realizado genera una alerta suelta (warning
-- o critical según el tipo), pero nadie agrega el patrón. Este trigger mira
-- los últimos 3 check-ins RESUELTOS de un caso (completed/missed/failed/
-- excused) cada vez que uno pasa a un estado terminal, y si los 3 son
-- incumplimiento (missed, failed, o completed con overall_passed=false —
-- 'excused' NO cuenta como incumplimiento), crea una alerta type='escalation'
-- severity='critical'. Solo alerta en el panel por ahora — no hay proveedor
-- de email/SMS configurado en el proyecto para notificar al juez fuera de él.
--
-- Dedup: se guarda checkin_id = el check-in que disparó la racha, así que un
-- reprocesamiento del mismo check-in no duplica la alerta.
-- ============================================================

CREATE OR REPLACE FUNCTION check_case_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak_len CONSTANT INT := 3;
  v_total INT;
  v_incumplidos INT;
  v_ya_escalado BOOLEAN;
BEGIN
  IF NEW.status NOT IN ('completed', 'missed') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE status = 'missed'
         OR status = 'failed'
         OR (status = 'completed' AND overall_passed = false)
    )
  INTO v_total, v_incumplidos
  FROM (
    SELECT status, overall_passed
    FROM checkins
    WHERE case_id = NEW.case_id
      AND status IN ('completed', 'missed', 'failed', 'excused')
    ORDER BY COALESCE(completed_at, scheduled_at) DESC
    LIMIT v_streak_len
  ) ultimos;

  IF v_total = v_streak_len AND v_incumplidos = v_streak_len THEN
    SELECT EXISTS(
      SELECT 1 FROM alerts WHERE type = 'escalation' AND checkin_id = NEW.id
    ) INTO v_ya_escalado;

    IF NOT v_ya_escalado THEN
      INSERT INTO alerts (case_id, checkin_id, severity, type, message)
      VALUES (NEW.case_id, NEW.id, 'critical', 'escalation',
        v_streak_len::text || ' incumplimientos consecutivos — requiere atención judicial inmediata');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_case_escalation ON checkins;

CREATE TRIGGER trg_check_case_escalation
AFTER UPDATE ON checkins
FOR EACH ROW
WHEN (NEW.status IN ('completed', 'missed') AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION check_case_escalation();
