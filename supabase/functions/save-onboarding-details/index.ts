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
    const {
      caseId,
      estrato, nivelEducativo, estadoCivil, ocupacion, tieneHijos, numHijos, regimenSalud, tenenciaVivienda,
      contactoEmergenciaNombre, contactoEmergenciaTelefono, contactoEmergenciaParentesco,
      movilidadReducida, condicionesMedicas, medicamentos,
    } = body

    if (!caseId) return new Response(JSON.stringify({ error: 'Falta caseId' }), { status: 400, headers: J })

    const { data: caso } = await supabase
      .from('cases')
      .select('id, technician_id, organization_id')
      .eq('id', caseId)
      .single()

    if (!caso) return new Response(JSON.stringify({ error: 'Caso no encontrado' }), { status: 404, headers: J })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    const esTecnicoDelCaso = caso.technician_id === user.id
    const esSuperAdmin = me?.role === 'super_admin'
    if (!esTecnicoDelCaso && !esSuperAdmin) {
      return new Response(JSON.stringify({ error: 'No autorizado para este caso' }), { status: 403, headers: J })
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update({
        estrato: estrato ?? null,
        nivel_educativo: nivelEducativo ?? null,
        estado_civil: estadoCivil ?? null,
        ocupacion: ocupacion ?? null,
        tiene_hijos: tieneHijos ?? null,
        num_hijos: numHijos ?? null,
        regimen_salud: regimenSalud ?? null,
        tenencia_vivienda: tenenciaVivienda ?? null,
        contacto_emergencia_nombre: contactoEmergenciaNombre ?? null,
        contacto_emergencia_telefono: contactoEmergenciaTelefono ?? null,
        contacto_emergencia_parentesco: contactoEmergenciaParentesco ?? null,
        movilidad_reducida: movilidadReducida ?? null,
        condiciones_medicas: condicionesMedicas ?? null,
        medicamentos: medicamentos ?? null,
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
