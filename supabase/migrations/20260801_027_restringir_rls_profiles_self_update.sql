-- ============================================================
-- Vulnerabilidad CRITICAL: la política "usuario actualiza su propio
-- perfil" (creada en el schema original, nunca corregida) restringe
-- solo FILAS (id = auth.uid()), no columnas. Cualquier usuario
-- autenticado — incluido un imputado, el rol de menor privilegio del
-- sistema — podía escribir CUALQUIER columna de su propia fila en
-- profiles con su sesión legítima, incluyendo:
--
--   UPDATE profiles SET role = 'super_admin' WHERE id = auth.uid();
--
-- Como todas las políticas RLS de cases/checkins/alerts/etc. verifican
-- el rol vía auth_role()/is_super_admin() leyendo profiles.role del
-- propio usuario, esto es una escalada de privilegios completa: de
-- imputado a super_admin con solo sus propias credenciales, sin pasar
-- por ningún endpoint de creación de usuarios.
--
-- Confirmado que el cliente solo escribe push_token y last_seen_at vía
-- esta política (apps/mobile/src/hooks/usePushNotifications.ts:73,96)
-- — no hay otro uso legítimo de UPDATE directo sobre profiles.
--
-- Mismo patrón de fix que case_messages (20260727_021): restringir el
-- GRANT a nivel de columna en vez de eliminar la política (aquí es la
-- única política UPDATE de self-service sobre profiles, no colisiona
-- con otras como sí pasaba con cases/profiles de tecnico).
-- ============================================================

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (push_token, last_seen_at) ON profiles TO authenticated;
