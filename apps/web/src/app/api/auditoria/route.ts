import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const PER_PAGE = 15

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0)
  const accion = searchParams.get('accion') ?? ''
  const q = (searchParams.get('q') ?? '').trim()

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
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles').select('role, organization_id').eq('id', user.id).single()
  if (!me || !['judicial', 'operador', 'super_admin'].includes(me.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Búsqueda por funcionario/expediente: resolver primero los ids que
  // matchean, en vez de traer todo el audit_log a memoria para filtrar en JS
  // (con 50k casos, el log crece sin límite — filtrar en el server sí escala).
  let caseIds: string[] = []
  let actorIds: string[] = []
  if (q) {
    const [{ data: casosMatch }, { data: actoresMatch }] = await Promise.all([
      supabase.from('cases').select('id').ilike('case_number', `%${q}%`).limit(200),
      supabase.from('profiles').select('id').ilike('full_name', `%${q}%`).limit(200),
    ])
    caseIds = (casosMatch ?? []).map(c => c.id)
    actorIds = (actoresMatch ?? []).map(a => a.id)
    if (caseIds.length === 0 && actorIds.length === 0) {
      return NextResponse.json({ entradas: [], total: 0 })
    }
  }

  let query = supabase
    .from('audit_log')
    .select(`
      id, action, entity_type, entity_id, payload, created_at, case_id, actor_role,
      actor:profiles!audit_log_actor_id_fkey(full_name),
      cases(case_number)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1)

  if (me.role !== 'super_admin') query = query.eq('organization_id', me.organization_id)
  if (accion) query = query.eq('action', accion)
  if (q) {
    const orParts: string[] = []
    if (caseIds.length) orParts.push(`case_id.in.(${caseIds.join(',')})`)
    if (actorIds.length) orParts.push(`actor_id.in.(${actorIds.join(',')})`)
    query = query.or(orParts.join(','))
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

  return NextResponse.json({ entradas, total: count ?? 0 })
}
