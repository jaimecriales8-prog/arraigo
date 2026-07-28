import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const BUCKET = 'checkin-evidence'
const SIGNED_URL_TTL_S = 300

// El campo puede venir como path relativo (datos nuevos) o URL pública completa
// (datos viejos) — createSignedUrl requiere el path.
function toPath(value: string): string {
  const marker = `/${BUCKET}/`
  const i = value.indexOf(marker)
  return i >= 0 ? value.slice(i + marker.length) : value
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

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

  const { data: checkin } = await supabase
    .from('checkins')
    .select('id, case_id, face_photo_url, scene_photo_url, scene_checkpoint_id, cases(organization_id)')
    .eq('id', id)
    .maybeSingle()

  if (!checkin) return NextResponse.json({ error: 'Check-in no encontrado' }, { status: 404 })

  const caseOrgId = (checkin.cases as unknown as { organization_id: string } | null)?.organization_id
  if (!['super_admin'].includes(me.role) && caseOrgId !== me.organization_id) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  let referencePhotoUrl: string | null = null
  if (checkin.scene_checkpoint_id) {
    const { data: checkpoint } = await supabase
      .from('checkpoints').select('photo_url')
      .eq('id', checkin.scene_checkpoint_id).maybeSingle()
    referencePhotoUrl = checkpoint?.photo_url ?? null
  }

  const targets: { key: 'face' | 'scene' | 'reference'; path: string }[] = []
  if (checkin.face_photo_url) targets.push({ key: 'face', path: toPath(checkin.face_photo_url) })
  if (checkin.scene_photo_url) targets.push({ key: 'scene', path: toPath(checkin.scene_photo_url) })
  if (referencePhotoUrl) targets.push({ key: 'reference', path: toPath(referencePhotoUrl) })

  const signed = await Promise.all(
    targets.map(t => supabase.storage.from(BUCKET).createSignedUrl(t.path, SIGNED_URL_TTL_S))
  )

  const result: Record<string, string | null> = { face: null, scene: null, reference: null }
  targets.forEach((t, i) => {
    result[t.key] = signed[i].data?.signedUrl ?? null
  })

  return NextResponse.json(result)
}
