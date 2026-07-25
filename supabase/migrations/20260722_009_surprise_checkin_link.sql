-- ============================================================
-- Enlazar surprise_verifications con su check-in (para ver el resultado real)
-- ============================================================
-- Una sorpresa 'completed' solo significa que el imputado respondió; si el
-- check-in falló (overall_passed=false) es una sorpresa FALLIDA. Sin un enlace
-- directo, el panel no podía distinguir "respondió y pasó" de "respondió y falló".
-- process-checkin ahora setea checkin_id al completar la sorpresa.
-- ============================================================

ALTER TABLE surprise_verifications
  ADD COLUMN IF NOT EXISTS checkin_id UUID REFERENCES checkins(id);

-- Backfill: enlazar sorpresas completadas al check-in tipo 'surprise' del mismo
-- caso creado dentro de la ventana de la sorpresa.
UPDATE surprise_verifications sv
SET checkin_id = (
  SELECT c.id FROM checkins c
  WHERE c.case_id = sv.case_id
    AND c.type = 'surprise'
    AND c.created_at BETWEEN sv.created_at - INTERVAL '1 min' AND sv.expires_at + INTERVAL '1 min'
  ORDER BY c.created_at DESC
  LIMIT 1
)
WHERE sv.status = 'completed' AND sv.checkin_id IS NULL;
