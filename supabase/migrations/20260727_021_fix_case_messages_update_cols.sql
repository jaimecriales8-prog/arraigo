-- ============================================================
-- La política "imputado marca sus mensajes como leidos" (RLS UPDATE
-- en case_messages) solo filtra FILAS (que el mensaje sea de su propio
-- caso), pero RLS no restringe COLUMNAS. Con la anon key + su propio
-- JWT, un imputado podía hacer PATCH directo por PostgREST y modificar
-- cualquier columna del mensaje (incluyendo `message` o `sent_by`),
-- no solo `read_at` como estaba previsto. Se restringe el UPDATE a
-- nivel de columna: el rol `authenticated` solo puede escribir `read_at`.
-- ============================================================

REVOKE UPDATE ON case_messages FROM authenticated;
GRANT UPDATE (read_at) ON case_messages TO authenticated;
