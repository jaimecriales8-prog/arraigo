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

  const { name, nit, contact_email, contact_phone, city, department } = await req.json()
  if (!name || !contact_email) {
    return NextResponse.json({ error: 'Faltan campos requeridos (nombre y email de contacto)' }, { status: 400 })
  }

  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!me || me.role !== 'super_admin') {
    return NextResponse.json({ error: 'Solo super_admin puede crear organizaciones' }, { status: 403 })
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name,
      nit: nit || null,
      contact_email,
      contact_phone: contact_phone || null,
      city: city || null,
      department: department || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: org.id,
    actorId: user.id,
    actorRole: me.role,
    action: 'organization.created',
    entityType: 'organization',
    entityId: org.id,
    payload: { name, nit, contact_email, city, department },
  })

  return NextResponse.json({ success: true, id: org.id })
}
