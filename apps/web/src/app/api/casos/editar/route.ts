import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const ALLOWED_STATUS = ['active', 'suspended', 'closed']
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { case_id, status, checkin_times, geofence_radius_m } = await req.json()
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
    .from('cases').select('id, organization_id').eq('id', case_id).single()
  if (!caso || (me.role !== 'super_admin' && caso.organization_id !== me.organization_id)) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}

  if (status !== undefined) {
    if (!ALLOWED_STATUS.includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }
    updates.status = status
  }

  if (checkin_times !== undefined) {
    if (!Array.isArray(checkin_times) || checkin_times.length === 0 || !checkin_times.every(t => typeof t === 'string' && HHMM.test(t))) {
      return NextResponse.json({ error: 'Horarios inválidos (formato HH:MM)' }, { status: 400 })
    }
    updates.checkin_times = checkin_times
  }

  if (geofence_radius_m !== undefined) {
    const radius = Number(geofence_radius_m)
    if (!Number.isInteger(radius) || radius < 10 || radius > 5000) {
      return NextResponse.json({ error: 'Radio inválido (10-5000m)' }, { status: 400 })
    }
    updates.geofence_radius_m = radius
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  const { error } = await supabase.from('cases').update(updates).eq('id', case_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
