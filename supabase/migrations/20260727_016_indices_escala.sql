-- ============================================================
-- Índices compuestos para preparar la plataforma para escala
-- (revisión de código para soportar 50.000 casos activos).
-- Solo agrega índices — no cambia ningún comportamiento ni dato.
-- Seguro de aplicar en cualquier momento, incluso con la app en uso.
-- ============================================================

-- checkins: el reporte por caso y el consolidado filtran por
-- case_id + created_at (rango de fechas). Antes solo había índice
-- en case_id solo.
CREATE INDEX IF NOT EXISTS idx_checkins_case_created
  ON checkins(case_id, created_at DESC);

-- alerts: el consolidado y el panel filtran por case_id + is_resolved.
-- Antes había un índice de is_resolved solo (poco útil) y uno de
-- case_id solo.
CREATE INDEX IF NOT EXISTS idx_alerts_case_resolved
  ON alerts(case_id, is_resolved);

-- alerts: check_device_silence() hace un NOT EXISTS correlacionado
-- filtrando por case_id + type + created_at (para no repetir la
-- alerta de "dispositivo apagado" mientras la ventana de silencio
-- siga vigente) — sin índice, cada corrida del cron escanea alerts
-- fila por fila para cada caso activo.
CREATE INDEX IF NOT EXISTS idx_alerts_case_type_created
  ON alerts(case_id, type, created_at DESC);

-- audit_log: la pantalla de auditoría y cualquier futura paginación
-- filtran por organization_id + created_at.
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created
  ON audit_log(organization_id, created_at DESC);

-- case_messages y case_notes: ya tienen índice en case_id solo
-- (idx_case_messages_case_id, idx_case_notes_case_id); el detalle del
-- caso los ordena por created_at en memoria (dataset pequeño por
-- caso), así que no hace falta compuesto ahí todavía.
