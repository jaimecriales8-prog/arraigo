import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Proxy de sesiones FaceTec (Milestone 2 sin FaceTec Server pago).
// La app manda los blobs aquí; nosotros los reenviamos a FaceTec y registramos
// la respuesta en facetec_sessions. El veredicto queda server-side —
// process-checkin lee de la BD, nunca del teléfono.
//
// Upstream actual: Testing API de FaceTec (desarrollo, gratis).
// Al licenciar FaceTec Server: cambiar FACETEC_UPSTREAM y quitar headers de testing.

const FACETEC_UPSTREAM = Deno.env.get('FACETEC_UPSTREAM') ?? 'https://api.facetec.com/api/v4/biometrics/process-request'
const DEVICE_KEY = Deno.env.get('FACETEC_DEVICE_KEY') ?? 'dTCCKq4bZ9mHJrkhc0dL2bCZuzAjMAF1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const { requestBlob, externalDatabaseRefID, testingApiHeader, kind, checkinId } = await req.json()
    if (!requestBlob || !kind) {
      return new Response(JSON.stringify({ error: 'requestBlob and kind required' }), { status: 400, headers: cors })
    }

    // Anti-suplantación:
    // - auth (check-in): el refID DEBE ser el imputado autenticado.
    // - enroll (onboarding): lo ejecuta el técnico sobre el imputado de un caso
    //   de su organización — se valida rol + pertenencia del caso.
    let refID: string
    if (kind === 'auth') {
      refID = user.id
      if (externalDatabaseRefID && externalDatabaseRefID !== refID) {
        return new Response(JSON.stringify({ error: 'refID mismatch' }), { status: 403, headers: cors })
      }
    } else if (kind === 'enroll') {
      if (!externalDatabaseRefID) {
        return new Response(JSON.stringify({ error: 'externalDatabaseRefID required for enroll' }), { status: 400, headers: cors })
      }
      const { data: tecnico } = await supabase
        .from('profiles').select('role, organization_id').eq('id', user.id).single()
      if (!tecnico || !['tecnico', 'super_admin'].includes(tecnico.role)) {
        return new Response(JSON.stringify({ error: 'Solo el técnico puede enrolar' }), { status: 403, headers: cors })
      }
      const { data: caso } = await supabase
        .from('cases')
        .select('id')
        .eq('imputado_id', externalDatabaseRefID)
        .eq('organization_id', tecnico.organization_id)
        .limit(1)
        .maybeSingle()
      if (!caso) {
        return new Response(JSON.stringify({ error: 'El imputado no pertenece a un caso de tu organización' }), { status: 403, headers: cors })
      }
      refID = externalDatabaseRefID
    } else {
      // init u otros: sesión de arranque del SDK, sin refID
      refID = user.id
    }

    // Reenviar a FaceTec
    const upstream = await fetch(FACETEC_UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': DEVICE_KEY,
        'X-Testing-API-Header': testingApiHeader ?? '',
      },
      body: JSON.stringify({ requestBlob, externalDatabaseRefID: refID }),
    })

    const bodyText = await upstream.text()
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(bodyText) } catch { /* respuesta no-JSON */ }

    // Registrar evidencia server-side (sin blobs — pesan y van encriptados)
    const { responseBlob: _rb, scanResultBlob: _srb, ...meta } = json as any
    // Formato Testing API v4: la respuesta FINAL trae success + result.livenessProven.
    // Las respuestas intermedias de la sesión no traen result — quedan en false.
    const processed =
      meta.wasProcessed === true ||
      (meta.success === true && meta.didError !== true && meta.result?.livenessProven === true)
    await supabase.from('facetec_sessions').insert({
      imputado_id: refID,
      checkin_id: checkinId ?? null,
      kind,
      was_processed: processed,
      error: upstream.ok ? (meta.error ? String(meta.error) : null) : `HTTP ${upstream.status}`,
      result: meta,
    })

    // Devolver la respuesta de FaceTec tal cual (el SDK necesita el responseBlob)
    return new Response(bodyText, { status: upstream.status, headers: cors })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: err?.message ?? String(err) }), { status: 500, headers: cors })
  }
})
