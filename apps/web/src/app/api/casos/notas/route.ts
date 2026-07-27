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

  const { case_id, note } = await req.json()
  if (!case_id || !note?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }
  if (note.trim().length > 2000) {
    return NextResponse.json({ error: 'Nota demasiado larga (máx. 2000 caracteres)' }, { status: 400 })
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
  if (!me || !['judicial', 'operador', 'tecnico', 'super_admin'].includes(me.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: caso } = await supabase
    .from('cases').select('id, organization_id').eq('id', case_id).single()
  if (!caso || (me.role !== 'super_admin' && caso.organization_id !== me.organization_id)) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const { data: nota, error } = await supabase
    .from('case_notes')
    .insert({
      organization_id: caso.organization_id,
      case_id,
      author_id: user.id,
      note: note.trim(),
    })
    .select('id, note, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: caso.organization_id,
    caseId: case_id,
    actorId: user.id,
    actorRole: me.role,
    action: 'case.note_added',
    entityType: 'case_note',
    entityId: nota.id,
    payload: { preview: note.trim().slice(0, 120) },
  })

  return NextResponse.json({ success: true, nota })
}
