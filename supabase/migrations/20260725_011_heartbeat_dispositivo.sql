-- ============================================================
-- Heartbeat de dispositivo: detectar teléfono apagado/sin reportar
-- ============================================================
-- Hoy si el imputado apaga el teléfono o desinstala la app, nada lo detecta
-- hasta la próxima ventana de check-in perdida (hasta 6h de hueco). Esto
-- agrega una señal de "última vez visto" (last_seen_at en profiles,
-- actualizada por la app en foreground y por process-checkin en cada
-- verificación) + una alerta crítica si un imputado con caso activo lleva
-- más de 12h sin reportar.
--
-- LIMITACIÓN CONOCIDA: last_seen_at se actualiza mientras la app está en
-- primer plano (o al completar un check-in verificado server-side). No hay
-- tarea en segundo plano registrada — apagar el teléfono o forzar el cierre
-- de la app deja de generar señal, que es justamente lo que se quiere
-- detectar. Complementa (no reemplaza) las alertas de check-in no realizado.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION check_device_silence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_threshold CONSTANT INTERVAL := INTERVAL '12 hours';
BEGIN
  FOR r IN
    SELECT c.id AS case_id, p.last_seen_at
    FROM cases c
    JOIN profiles p ON p.id = c.imputado_id
    WHERE c.status = 'active'
      AND (p.last_seen_at IS NULL OR p.last_seen_at < NOW() - v_threshold)
      -- Dedup: no repetir mientras ya haya una alerta vigente de este tipo
      -- dentro de la misma ventana de silencio.
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.case_id = c.id
          AND a.type = 'device_silent'
          AND a.created_at > NOW() - v_threshold
      )
  LOOP
    INSERT INTO alerts (case_id, severity, type, message)
    VALUES (
      r.case_id, 'critical', 'device_silent',
      CASE WHEN r.last_seen_at IS NULL
        THEN 'El dispositivo del imputado nunca ha reportado actividad'
        ELSE 'El dispositivo lleva más de 12 horas sin reportar actividad (última vez: ' ||
             to_char(r.last_seen_at AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH24:MI') || ')'
      END
    );
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'check-device-silence',
  '*/30 * * * *',
  'SELECT check_device_silence();'
);
