import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const body = await req.json()
  const {
    imputado_id, case_number, court, crime_description,
    address, city, department, start_date,
    geofence_radius_m, checkin_times,
  } = body

  if (!imputado_id || !case_number || !address || !city || !department) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Autorización: solo judicial (o super_admin) crea casos, y solo en su org.
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user: currentUser } } = await anonClient.auth.getUser()
  if (!currentUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', currentUser.id)
    .single()

  if (!currentProfile || !['judicial', 'super_admin'].includes(currentProfile.role)) {
    return NextResponse.json({ error: 'Sin permisos para crear casos' }, { status: 403 })
  }

  // El imputado debe existir, tener rol imputado y ser de la misma organización.
  const { data: imputado } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', imputado_id)
    .single()

  if (!imputado || imputado.role !== 'imputado' || imputado.organization_id !== currentProfile.organization_id) {
    return NextResponse.json({ error: 'Imputado inválido o de otra organización' }, { status: 400 })
  }

  // Un imputado no puede tener dos casos activos/en onboarding a la vez.
  const { data: existente } = await supabase
    .from('cases')
    .select('id')
    .eq('imputado_id', imputado_id)
    .in('status', ['onboarding', 'active'])
    .limit(1)
    .maybeSingle()

  if (existente) {
    return NextResponse.json({ error: 'Ese imputado ya tiene un caso activo' }, { status: 409 })
  }

  const insert: Record<string, unknown> = {
    organization_id: currentProfile.organization_id,
    imputado_id,
    case_number,
    court: court || null,
    crime_description: crime_description || null,
    address,
    city,
    department,
    start_date: start_date || new Date().toISOString().slice(0, 10),
    // status='onboarding', geofence/checkin_times/etc. usan defaults de la tabla
  }
  if (geofence_radius_m) insert.geofence_radius_m = geofence_radius_m
  if (Array.isArray(checkin_times) && checkin_times.length) insert.checkin_times = checkin_times

  const { data: caso, error } = await supabase
    .from('cases')
    .insert(insert)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, case_id: caso.id })
}
