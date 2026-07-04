import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const cookieStore = await cookies()

  // Service-role puro para la escritura (sin cookies → no aplica RLS del usuario)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { case_id, technician_id } = await req.json()
  if (!case_id || !technician_id) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Autorización: solo judicial/super_admin
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

  // El caso debe ser de la organización del usuario
  const { data: caso } = await supabase
    .from('cases').select('id, organization_id').eq('id', case_id).single()
  if (!caso || caso.organization_id !== me.organization_id) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  // El técnico debe existir, ser técnico y de la misma organización
  const { data: tecnico } = await supabase
    .from('profiles').select('id, role, organization_id').eq('id', technician_id).single()
  if (!tecnico || !['tecnico', 'technician'].includes(tecnico.role) || tecnico.organization_id !== me.organization_id) {
    return NextResponse.json({ error: 'Técnico inválido o de otra organización' }, { status: 400 })
  }

  const { error } = await supabase
    .from('cases').update({ technician_id }).eq('id', case_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
