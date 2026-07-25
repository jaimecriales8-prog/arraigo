import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Estados que representan un incumplimiento excusable. Un check-in 'completed'
// con overall_passed=true no necesita excusa.
const EXCUSABLE_STATUSES = ['missed', 'failed']

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { checkin_id, reason } = await req.json()
  if (!checkin_id || !reason?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

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

  const { data: checkin } = await supabase
    .from('checkins')
    .select('id, status, overall_passed, case_id, cases(organization_id)')
    .eq('id', checkin_id)
    .maybeSingle()

  if (!checkin) return NextResponse.json({ error: 'Check-in no encontrado' }, { status: 404 })

  const caseOrgId = (checkin.cases as unknown as { organization_id: string } | null)?.organization_id
  if (me.role !== 'super_admin' && caseOrgId !== me.organization_id) {
    return NextResponse.json({ error: 'Caso de otra organización' }, { status: 403 })
  }

  const isIncumplimiento =
    EXCUSABLE_STATUSES.includes(checkin.status) ||
    (checkin.status === 'completed' && checkin.overall_passed === false)
  if (!isIncumplimiento) {
    return NextResponse.json({ error: 'Este check-in no requiere excusa' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('checkins')
    .update({ status: 'excused', excused_by: user.id, excused_reason: reason.trim() })
    .eq('id', checkin_id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Resolver las alertas asociadas a este check-in — ya no es un incumplimiento.
  await supabase
    .from('alerts')
    .update({
      is_resolved: true,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolved_note: `Excusado: ${reason.trim()}`,
    })
    .eq('checkin_id', checkin_id)
    .eq('is_resolved', false)

  return NextResponse.json({ success: true })
}
