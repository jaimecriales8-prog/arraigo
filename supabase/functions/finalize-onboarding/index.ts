import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const J = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

// Reemplaza los UPDATE directos que hacía el cliente del técnico sobre
// cases/profiles (vía RLS sin restricción de columna — el técnico podía
// escribir CUALQUIER campo de su caso asignado, no solo estos 4). Mismo
// patrón auto-autorizado que register-work-location/save-onboarding-details:
// lista blanca explícita de columnas, sin depender de RLS de UPDATE amplia.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Falta autorización' }), { status: 401, headers: J })

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401, headers: J })

    const body = await req.json()
    const { caseId, lat, lng, referencePhotoUrl } = body

    if (!caseId || lat == null || lng == null) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400, headers: J })
    }

    const { data: caso } = await supabase
      .from('cases')
      .select('id, imputado_id, technician_id')
      .eq('id', caseId)
      .single()

    if (!caso) return new Response(JSON.stringify({ error: 'Caso no encontrado' }), { status: 404, headers: J })

    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const esTecnicoDelCaso = caso.technician_id === user.id
    const esSuperAdmin = me?.role === 'super_admin'
    if (!esTecnicoDelCaso && !esSuperAdmin) {
      return new Response(JSON.stringify({ error: 'No autorizado para este caso' }), { status: 403, headers: J })
    }

    const { error: caseError } = await supabase
      .from('cases')
      .update({
        location: `POINT(${lng} ${lat})`,
        onboarding_done_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', caseId)

    if (caseError) {
      return new Response(JSON.stringify({ error: `No se pudo guardar el caso: ${caseError.message}` }), { status: 500, headers: J })
    }

    if (referencePhotoUrl && caso.imputado_id) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ reference_photo_url: referencePhotoUrl })
        .eq('id', caso.imputado_id)

      if (profileError) {
        return new Response(JSON.stringify({ error: `No se pudo guardar la foto de referencia: ${profileError.message}` }), { status: 500, headers: J })
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: J })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), { status: 500, headers: J })
  }
})
