-- ============================================================
-- Revierte 20260802_035: ON DELETE SET NULL no sirve porque el
-- mecanismo interno de FK necesita hacer un UPDATE sobre audit_log
-- para poner case_id en NULL, y la regla audit_log_no_update también
-- lo intercepta (mismo problema, un nivel más abajo) — Postgres da
-- error XX000 "referential integrity query gave unexpected result".
--
-- Vuelve al comportamiento por defecto (RESTRICT/NO ACTION): bloquear
-- el borrado de un caso con historial de auditoría es lo correcto
-- para casos reales (evita destruir evidencia). Para limpiar datos de
-- PRUEBA, el procedimiento correcto es levantar la regla
-- audit_log_no_delete temporalmente y a propósito — ver
-- docs/roadmap.md, no automatizarlo dentro de una función.
-- ============================================================

ALTER TABLE audit_log DROP CONSTRAINT audit_log_case_id_fkey;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id);
