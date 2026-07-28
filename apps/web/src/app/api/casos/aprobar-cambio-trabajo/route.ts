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

  const { case_id } = await req.json()
  if (!case_id) return NextResponse.json({ error: 'Falta case_id' }, { status: 400 })

  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles').select('role, organization_id').eq('id', user.id).single()
  if (!me || !['judicial', 'super_admin'].includes(me.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: caso } = await supabase
    .from('cases')
    .select('id, organization_id, work_change_requested_at, work_change_approved_at')
    .eq('id', case_id)
    .maybeSingle()

  if (!caso) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  if (me.role !== 'super_admin' && caso.organization_id !== me.organization_id) {
    return NextResponse.json({ error: 'Caso de otra organización' }, { status: 403 })
  }
  if (!caso.work_change_requested_at) {
    return NextResponse.json({ error: 'No hay una solicitud de cambio pendiente' }, { status: 400 })
  }
  if (caso.work_change_approved_at) {
    return NextResponse.json({ error: 'Esta solicitud ya fue aprobada' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('cases')
    .update({ work_change_approved_at: new Date().toISOString(), work_change_approved_by: user.id })
    .eq('id', case_id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: caso.organization_id,
    caseId: case_id,
    actorId: user.id,
    actorRole: me.role,
    action: 'work_location_change_approved',
    entityType: 'case',
    entityId: case_id,
    payload: {},
  })

  return NextResponse.json({ success: true })
}
