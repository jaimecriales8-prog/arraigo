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

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
