import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AuditoriaLista from './AuditoriaLista'

export const dynamic = 'force-dynamic'

async function getAuditoria() {
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

  let query = supabase
    .from('audit_log')
    .select(`
      id, action, entity_type, entity_id, payload, created_at, case_id, actor_role,
      actor:profiles!audit_log_actor_id_fkey(full_name),
      cases(case_number)
    `)
    .order('created_at', { ascending: false })
    .limit(500)
  if (me.role !== 'super_admin') query = query.eq('organization_id', me.organization_id)

  const { data, error } = await query
  if (error) console.error('[auditoria] error:', error.message)

  return (data ?? []).map((a: any) => ({
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
}

export default async function AuditoriaPage() {
  const entradas = await getAuditoria()

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Auditoría</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
        {entradas.length} {entradas.length !== 1 ? 'acciones registradas' : 'acción registrada'} · cadena de custodia de cambios en el sistema
      </p>
      {entradas.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          Aún no hay acciones registradas.
        </div>
      ) : (
        <AuditoriaLista entradas={entradas} />
      )}
    </div>
  )
}
