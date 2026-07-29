-- ============================================================
-- Función reutilizable para borrar un imputado de PRUEBA y todo lo
-- que depende de él, en el orden correcto para no chocar con foreign
-- keys (mismo problema que tuvimos manualmente con Oswaldo Saumet:
-- audit_log bloqueaba el DELETE de cases).
--
-- Solo borra perfiles con role = 'imputado' — nunca técnico/judicial/
-- super_admin, para no destruir cuentas reales de staff por error.
--
-- Uso: SELECT delete_test_imputado('<uuid-del-imputado>');
-- ============================================================

CREATE OR REPLACE FUNCTION delete_test_imputado(p_imputado_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_case_ids UUID[];
  v_role TEXT;
  v_nombre TEXT;
BEGIN
  SELECT role, full_name INTO v_role, v_nombre FROM profiles WHERE id = p_imputado_id;

  IF v_role IS NULL THEN
    RETURN 'No existe ningún perfil con ese id.';
  END IF;
  IF v_role <> 'imputado' THEN
    RETURN format('Bloqueado: el perfil "%s" tiene rol %s, no imputado — esta función solo borra imputados.', v_nombre, v_role);
  END IF;

  SELECT array_agg(id) INTO v_case_ids FROM cases WHERE imputado_id = p_imputado_id;

  DELETE FROM audit_log WHERE actor_id = p_imputado_id OR case_id = ANY(v_case_ids);
  DELETE FROM facetec_sessions WHERE imputado_id = p_imputado_id;

  -- checkin_errors no tiene migración local (vive en producción sin
  -- respaldo en el repo, igual que create_scheduled_checkins) — se
  -- borra defensivamente por si su forma exacta cambia.
  BEGIN
    EXECUTE 'DELETE FROM checkin_errors WHERE imputado_id = $1' USING p_imputado_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    NULL;
  END;

  -- Cascada automática desde aquí: checkins, checkpoints, alerts,
  -- surprise_verifications, case_messages, case_notes, medical_appointments.
  DELETE FROM cases WHERE imputado_id = p_imputado_id;

  -- Cascada automática: profiles (ON DELETE CASCADE desde auth.users).
  DELETE FROM auth.users WHERE id = p_imputado_id;

  RETURN format('Imputado "%s" (%s) eliminado junto con %s caso(s) y todo lo dependiente.', v_nombre, p_imputado_id, coalesce(array_length(v_case_ids, 1), 0));
END;
$func$;
