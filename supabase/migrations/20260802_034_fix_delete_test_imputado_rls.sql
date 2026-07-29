-- ============================================================
-- delete_test_imputado() seguía chocando con el mismo FK de audit_log
-- aunque el DELETE se veía correcto — sospecha: una política RLS de
-- audit_log deja el DELETE afectando 0 filas en vez de dar error,
-- incluso dentro de una función SECURITY DEFINER. Se fuerza
-- `row_security = off` para toda la función, garantizando que no haya
-- ninguna política filtrando los DELETE de limpieza.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_test_imputado(p_imputado_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
AS $func$
DECLARE
  v_case_ids UUID[];
  v_role TEXT;
  v_nombre TEXT;
  v_audit_borrados INT;
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
  GET DIAGNOSTICS v_audit_borrados = ROW_COUNT;

  DELETE FROM facetec_sessions WHERE imputado_id = p_imputado_id;

  BEGIN
    EXECUTE 'DELETE FROM checkin_errors WHERE imputado_id = $1' USING p_imputado_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    NULL;
  END;

  DELETE FROM cases WHERE imputado_id = p_imputado_id;
  DELETE FROM auth.users WHERE id = p_imputado_id;

  RETURN format('Imputado "%s" (%s) eliminado junto con %s caso(s), %s fila(s) de audit_log, y todo lo dependiente.',
    v_nombre, p_imputado_id, coalesce(array_length(v_case_ids, 1), 0), v_audit_borrados);
END;
$func$;
