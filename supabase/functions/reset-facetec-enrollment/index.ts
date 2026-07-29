import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Mismo host que facetec-proxy (FACETEC_UPSTREAM), pero el endpoint de borrado
// de FaceTec es /enrollment-3d en vez de /process-request — se deriva del
// mismo secret para no duplicar configuración.
const FACETEC_UPSTREAM = Deno.env.get('FACETEC_UPSTREAM') ?? 'https://api.facetec.com/api/v4/biometrics/process-request'
const FACETEC_DELETE_ENROLLMENT_URL = FACETEC_UPSTREAM.replace('/process-request', '/enrollment-3d')
const DEVICE_KEY = Deno.env.get('FACETEC_DEVICE_KEY')

const J = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

// Permite al técnico reiniciar el enrolamiento facial de un imputado cuando
// FaceTec rechaza un re-enrolamiento ("An enrollment already exists for this
// externalDatabaseRefID") — pasa después de un intento fallido/interrumpido
// (batería, red, error de cámara) durante el onboarding real, no solo en
// pruebas. Borra el FaceMap guardado en FaceTec para ese imputado, así el
// siguiente intento de enroll puede volver a guardarlo.
//
// Límite operacional: solo mientras el caso siga en estado 'onboarding' —
// una vez el caso está 'active', reiniciar la referencia facial es un cambio
// de identidad biométrica que necesita un control más estricto (no un botón
// libre), igual que el cambio de sitio de trabajo requiere aprobación.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    if (!DEVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Servicio de verificación facial no configurado' }), { status: 500, headers: J })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Falta autorización' }), { status: 401, headers: J })

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401, headers: J })

    const { caseId } = await req.json()
    if (!caseId) return new Response(JSON.stringify({ error: 'Falta caseId' }), { status: 400, headers: J })

    const { data: tecnico } = await supabase
      .from('profiles').select('role, organization_id').eq('id', user.id).single()
    if (!tecnico || !['tecnico', 'super_admin'].includes(tecnico.role)) {
      return new Response(JSON.stringify({ error: 'Solo el técnico puede reiniciar un enrolamiento' }), { status: 403, headers: J })
    }

    const { data: caso } = await supabase
      .from('cases')
      .select('id, imputado_id, technician_id, organization_id, status')
      .eq('id', caseId)
      .single()

    if (!caso) return new Response(JSON.stringify({ error: 'Caso no encontrado' }), { status: 404, headers: J })
    if (tecnico.role !== 'super_admin' && caso.technician_id !== user.id) {
      return new Response(JSON.stringify({ error: 'No eres el técnico asignado a este caso' }), { status: 403, headers: J })
    }
    if (caso.status !== 'onboarding') {
      return new Response(JSON.stringify({ error: 'Solo se puede reiniciar el enrolamiento mientras el caso está en onboarding' }), { status: 400, headers: J })
    }

    const upstream = await fetch(FACETEC_DELETE_ENROLLMENT_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Device-Key': DEVICE_KEY },
      body: JSON.stringify({ externalDatabaseRefID: caso.imputado_id }),
    })
    const bodyText = await upstream.text()

    await supabase.from('facetec_sessions').insert({
      imputado_id: caso.imputado_id,
      kind: 'enroll',
      was_processed: false,
      error: upstream.ok ? 'Enrolamiento reiniciado por el técnico' : `Reinicio falló: HTTP ${upstream.status}`,
      result: { reset: true, upstream_status: upstream.status, upstream_body: bodyText.slice(0, 500) },
    })

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `FaceTec no pudo borrar el enrolamiento (HTTP ${upstream.status})`, detail: bodyText }), { status: 502, headers: J })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: J })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), { status: 500, headers: J })
  }
})
