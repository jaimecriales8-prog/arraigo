import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const cookieStore = await cookies()

  // Cliente service-role PURO (sin cookies) → bypassa RLS de verdad.
  // Con cookies, @supabase/ssr adjunta el JWT del usuario y RLS aplica como él.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { full_name, email, role } = await req.json()

  if (!full_name || !email || !role) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Get org from current session
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

  if (!currentProfile || !['admin', 'judicial', 'super_admin'].includes(currentProfile.role)) {
    return NextResponse.json({ error: 'Sin permisos para crear usuarios' }, { status: 403 })
  }

  // Validar roles permitidos por quien crea
  const rolesPermitidos: Record<string, string[]> = {
    super_admin: ['judicial', 'tecnico'],
    judicial: ['imputado', 'operador'],
  }
  const permitidos = rolesPermitidos[currentProfile.role]
  if (!permitidos || !permitidos.includes(role)) {
    return NextResponse.json({ error: 'No puede crear usuarios con ese rol' }, { status: 403 })
  }

  // Create auth user with temp password (user can reset later)
  const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
  const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name, role },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  // Create profile
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: newUser.user.id,
    organization_id: currentProfile.organization_id,
    full_name,
    role,
  })

  if (profileError) {
    // Rollback: borrar el usuario auth para no dejar huérfanos (email quedaría bloqueado)
    await supabase.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Se devuelven las credenciales para entregarlas (no se envía email de invitación).
  // El imputado se loguea en la app con esto durante el onboarding del técnico.
  return NextResponse.json({ success: true, email, temp_password: tempPassword, role })
}
