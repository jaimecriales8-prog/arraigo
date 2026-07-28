-- Las políticas originales de audit_log usaban los roles del enum inicial
-- ('org_admin', 'officer'), pero la app usa 'judicial' en su lugar — quedó
-- sin política de lectura. El panel lee vía service-role (bypassa RLS), pero
-- se agrega esta política para dejar el acceso correcto también por RLS.
DROP POLICY IF EXISTS "judicial lee audit_log de su org" ON audit_log;
CREATE POLICY "judicial lee audit_log de su org" ON audit_log
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'judicial'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
