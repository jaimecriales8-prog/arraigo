import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const J = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Falta autorización' }), { status: 401, headers: J })

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401, headers: J })

    const body = await req.json()
    const { caseId, photoUrl, gpsLat, gpsLng, gpsAccuracyM, gpsIsMock, selfieUrl } = body

    if (!caseId || !photoUrl || gpsLat == null || gpsLng == null) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400, headers: J })
    }

    const { data: caso } = await supabase
      .from('cases')
      .select('id, imputado_id, work_registered_at, work_change_approved_at')
      .eq('id', caseId)
      .single()

    if (!caso) return new Response(JSON.stringify({ error: 'Caso no encontrado' }), { status: 404, headers: J })
    if (caso.imputado_id !== user.id) {
      return new Response(JSON.stringify({ error: 'El caso no pertenece a este imputado' }), { status: 403, headers: J })
    }

    // Ya registrado y sin cambio aprobado → bloqueado hasta que un judicial lo autorice.
    if (caso.work_registered_at && !caso.work_change_approved_at) {
      return new Response(
        JSON.stringify({ error: 'El sitio de trabajo ya está registrado. Debe solicitar autorización de cambio.' }),
        { status: 403, headers: J }
      )
    }

    if (gpsIsMock) {
      return new Response(JSON.stringify({ error: 'GPS simulado detectado' }), { status: 400, headers: J })
    }

    // CARA — si la organización usa FaceTec, el veredicto se lee server-side
    // de facetec_sessions (mismo mecanismo que process-checkin), nunca de lo
    // que reporte el teléfono. Se reutiliza kind='auth' sin checkin_id (no
    // hay check-in en este flujo). Si la org no tiene FaceTec activo, se
    // acepta la foto de selfie subida (mismo nivel de verificación que el
    // check-in en modo acelerómetro, que tampoco valida el rostro server-side).
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { data: session } = await supabase
      .from('facetec_sessions')
      .select('id')
      .eq('imputado_id', user.id)
      .eq('kind', 'auth')
      .is('checkin_id', null)
      .eq('was_processed', true)
      .is('error', null)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session && !selfieUrl) {
      return new Response(
        JSON.stringify({ error: 'Verificación facial no registrada' }),
        { status: 400, headers: J }
      )
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update({
        work_location: `POINT(${gpsLng} ${gpsLat})`,
        work_photo_url: photoUrl,
        work_registered_at: new Date().toISOString(),
        work_change_requested_at: null,
        work_change_reason: null,
        work_change_approved_at: null,
        work_change_approved_by: null,
      })
      .eq('id', caseId)

    if (updateError) {
      return new Response(JSON.stringify({ error: `No se pudo guardar: ${updateError.message}` }), { status: 500, headers: J })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: J })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), { status: 500, headers: J })
  }
})
