-- ============================================================
-- Causa raíz encontrada del bloqueo repetido al borrar casos de
-- prueba: audit_log tiene reglas a propósito (audit_log_no_delete,
-- audit_log_no_update) que hacen INMUTABLE el registro de auditoría
-- — ningún DELETE le afecta nunca, ni directo ni desde una función.
-- Correcto para cadena de custodia judicial, pero audit_log.case_id
-- (FK a cases, sin ON DELETE) bloqueaba entonces CUALQUIER borrado de
-- un caso que tuviera historial de auditoría — es decir, casi todos.
--
-- Fix: la referencia al caso pasa a NULL cuando el caso se borra, en
-- vez de bloquear el borrado. El contenido del registro de auditoría
-- (acción, actor, payload, fecha) se preserva intacto — solo se
-- pierde el link a un caso que ya no existe. No afecta la
-- inmutabilidad de las reglas existentes.
-- ============================================================

ALTER TABLE audit_log DROP CONSTRAINT audit_log_case_id_fkey;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
