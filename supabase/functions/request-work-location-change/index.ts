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
    const { caseId, reason } = body
    if (!caseId) return new Response(JSON.stringify({ error: 'Falta caseId' }), { status: 400, headers: J })

    const { data: caso } = await supabase
      .from('cases')
      .select('id, imputado_id, work_registered_at')
      .eq('id', caseId)
      .single()

    if (!caso) return new Response(JSON.stringify({ error: 'Caso no encontrado' }), { status: 404, headers: J })
    if (caso.imputado_id !== user.id) {
      return new Response(JSON.stringify({ error: 'El caso no pertenece a este imputado' }), { status: 403, headers: J })
    }
    if (!caso.work_registered_at) {
      return new Response(JSON.stringify({ error: 'No hay un sitio de trabajo registrado para solicitar cambio' }), { status: 400, headers: J })
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update({
        work_change_requested_at: new Date().toISOString(),
        work_change_reason: reason ?? null,
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
