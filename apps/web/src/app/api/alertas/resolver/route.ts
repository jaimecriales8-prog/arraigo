import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/auditLog'

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { alert_id } = await req.json()
  if (!alert_id) return NextResponse.json({ error: 'Falta alert_id' }, { status: 400 })

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

  const { data: alerta } = await supabase
    .from('alerts')
    .select('id, case_id, type, is_resolved, cases(organization_id)')
    .eq('id', alert_id)
    .maybeSingle()
  if (!alerta) return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })

  const caseOrgId = (alerta.cases as unknown as { organization_id: string } | null)?.organization_id
  if (me.role !== 'super_admin' && caseOrgId !== me.organization_id) {
    return NextResponse.json({ error: 'Alerta de otra organización' }, { status: 403 })
  }
  if (alerta.is_resolved) return NextResponse.json({ success: true })

  const { error } = await supabase
    .from('alerts')
    .update({ is_resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', alert_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: caseOrgId ?? me.organization_id,
    caseId: alerta.case_id,
    actorId: user.id,
    actorRole: me.role,
    action: 'alert.resolved',
    entityType: 'alert',
    entityId: alert_id,
    payload: { type: alerta.type },
  })

  return NextResponse.json({ success: true })
}
