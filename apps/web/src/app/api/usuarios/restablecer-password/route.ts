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

  const { profile_id } = await req.json()
  if (!profile_id) return NextResponse.json({ error: 'Falta profile_id' }, { status: 400 })

  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user: currentUser } } = await anonClient.auth.getUser()
  if (!currentUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: currentProfile } = await supabase
    .from('profiles').select('organization_id, role').eq('id', currentUser.id).single()
  if (!currentProfile || !['judicial', 'super_admin'].includes(currentProfile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: target } = await supabase
    .from('profiles').select('id, full_name, role, organization_id').eq('id', profile_id).single()
  if (!target || (currentProfile.role !== 'super_admin' && target.organization_id !== currentProfile.organization_id)) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
  const { error: authError } = await supabase.auth.admin.updateUserById(profile_id, { password: tempPassword })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const { data: authUser } = await supabase.auth.admin.getUserById(profile_id)
  const email = authUser?.user?.email ?? ''

  await logAudit(supabase, {
    organizationId: target.organization_id,
    actorId: currentUser.id,
    actorRole: currentProfile.role,
    action: 'user.password_reset',
    entityType: 'profile',
    entityId: profile_id,
    payload: { full_name: target.full_name, email, role: target.role },
  })

  return NextResponse.json({ success: true, email, temp_password: tempPassword })
}
