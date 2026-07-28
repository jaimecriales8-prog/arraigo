import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const J = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

// El imputado reporta una cita médica con anticipación (día, ventana de
// hora inicio/fin). Solo por adelantado — no sirve para justificar
// retroactivamente un check-in ya fallado. El efecto de negocio (excusar
// automáticamente check-ins dentro de la ventana) lo decide
// expire_missed_verifications() según organizations.auto_excusar_citas_medicas,
// no este endpoint — aquí solo se registra el reporte.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Falta autorización' }), { status: 401, headers: J })

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401, headers: J })

    const body = await req.json()
    const { caseId, appointmentDate, startTime, endTime, reason } = body
    if (!caseId || !appointmentDate || !startTime || !endTime) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400, headers: J })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !/^\d{2}:\d{2}(:\d{2})?$/.test(startTime) || !/^\d{2}:\d{2}(:\d{2})?$/.test(endTime)) {
      return new Response(JSON.stringify({ error: 'Formato de fecha/hora inválido' }), { status: 400, headers: J })
    }
    if (endTime <= startTime) {
      return new Response(JSON.stringify({ error: 'La hora de fin debe ser posterior a la hora de inicio' }), { status: 400, headers: J })
    }

    const { data: caso } = await supabase
      .from('cases')
      .select('id, imputado_id, organization_id')
      .eq('id', caseId)
      .single()

    if (!caso) return new Response(JSON.stringify({ error: 'Caso no encontrado' }), { status: 404, headers: J })
    if (caso.imputado_id !== user.id) {
      return new Response(JSON.stringify({ error: 'El caso no pertenece a este imputado' }), { status: 403, headers: J })
    }

    // Solo por adelantado: la fecha+hora de inicio debe ser futura.
    const appointmentStart = new Date(`${appointmentDate}T${startTime}`)
    if (isNaN(appointmentStart.getTime()) || appointmentStart.getTime() <= Date.now()) {
      return new Response(JSON.stringify({ error: 'La cita debe reportarse con anticipación (fecha/hora futura)' }), { status: 400, headers: J })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('max_citas_medicas_mes')
      .eq('id', caso.organization_id)
      .single()
    const limite = org?.max_citas_medicas_mes ?? 2

    const [year, month] = appointmentDate.split('-')
    const mesInicio = `${year}-${month}-01`
    const mesFin = new Date(Number(year), Number(month), 1).toISOString().slice(0, 10) // primer día del mes siguiente

    const { count } = await supabase
      .from('medical_appointments')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .gte('appointment_date', mesInicio)
      .lt('appointment_date', mesFin)

    if ((count ?? 0) >= limite) {
      return new Response(JSON.stringify({ error: `Ya alcanzaste el máximo de citas médicas de este mes (${limite})` }), { status: 400, headers: J })
    }

    const { error: insertError } = await supabase
      .from('medical_appointments')
      .insert({
        organization_id: caso.organization_id,
        case_id: caseId,
        imputado_id: user.id,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: endTime,
        reason: reason?.trim() || null,
      })

    if (insertError) {
      return new Response(JSON.stringify({ error: `No se pudo guardar: ${insertError.message}` }), { status: 500, headers: J })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: J })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), { status: 500, headers: J })
  }
})
