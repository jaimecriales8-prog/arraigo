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

  const { organization_id, auto_excusar_citas_medicas, max_citas_medicas_mes } = await req.json()
  if (!organization_id) {
    return NextResponse.json({ error: 'Falta organization_id' }, { status: 400 })
  }
  const limite = Number(max_citas_medicas_mes)
  if (!Number.isInteger(limite) || limite < 0 || limite > 31) {
    return NextResponse.json({ error: 'Máximo de citas por mes inválido (0-31)' }, { status: 400 })
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
  if (me.role !== 'super_admin' && organization_id !== me.organization_id) {
    return NextResponse.json({ error: 'Solo puedes configurar tu propia organización' }, { status: 403 })
  }

  const { error } = await supabase
    .from('organizations')
    .update({
      auto_excusar_citas_medicas: !!auto_excusar_citas_medicas,
      max_citas_medicas_mes: limite,
    })
    .eq('id', organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: organization_id,
    actorId: user.id,
    actorRole: me.role,
    action: 'organization.medical_appointments_config_updated',
    entityType: 'organization',
    entityId: organization_id,
    payload: { auto_excusar_citas_medicas: !!auto_excusar_citas_medicas, max_citas_medicas_mes: limite },
  })

  return NextResponse.json({ success: true })
}
