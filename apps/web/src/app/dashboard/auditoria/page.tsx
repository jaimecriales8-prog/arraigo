import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AuditoriaLista from './AuditoriaLista'

export const dynamic = 'force-dynamic'

const PER_PAGE = 15

async function getPrimeraPagina() {
  const cookieStore = await cookies()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('profiles').select('role, organization_id').eq('id', user.id).single()
  if (!me || !['judicial', 'operador', 'super_admin'].includes(me.role)) {
    redirect('/dashboard')
  }

  // Solo la primera página server-side (evita el "flash" de carga inicial);
  // el resto de páginas/filtros se piden a /api/auditoria desde el cliente.
  // Antes esto traía hasta 500 filas de una vez y filtraba/paginaba en JS —
  // con 50k casos el audit_log crece sin límite, así que se movió a
  // paginación + filtro real en el servidor (ver /api/auditoria/route.ts).
  let query = supabase
    .from('audit_log')
    .select(`
      id, action, entity_type, entity_id, payload, created_at, case_id, actor_role,
      actor:profiles!audit_log_actor_id_fkey(full_name),
      cases(case_number)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, PER_PAGE - 1)
  if (me.role !== 'super_admin') query = query.eq('organization_id', me.organization_id)

  const { data, count } = await query

  const entradas = (data ?? []).map((a: any) => ({
    id: a.id,
    action: a.action,
    entityType: a.entity_type,
    entityId: a.entity_id,
    payload: a.payload,
    createdAt: a.created_at,
    caseId: a.case_id,
    caseNumber: a.cases?.case_number ?? null,
    actorNombre: a.actor?.full_name ?? 'Desconocido',
    actorRole: a.actor_role,
  }))

  return { entradas, total: count ?? 0 }
}

export default async function AuditoriaPage() {
  const { entradas, total } = await getPrimeraPagina()

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Auditoría</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
        {total} {total !== 1 ? 'acciones registradas' : 'acción registrada'} · cadena de custodia de cambios en el sistema
      </p>
      {total === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          Aún no hay acciones registradas.
        </div>
      ) : (
        <AuditoriaLista entradasIniciales={entradas} totalInicial={total} />
      )}
    </div>
  )
}
