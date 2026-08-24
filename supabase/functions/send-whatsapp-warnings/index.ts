import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendTemplate } from '../_shared/sendpulse.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const TEMPLATE_NAME = 'aviso_dos_fallidas'

// Cron cada 15 min (mismo ciclo que expire_missed_verifications/
// check_device_silence) — a diferencia de esas, esta SÍ necesita una llamada
// HTTP externa (SendPulse), así que no puede ser una función SQL pura
// programada directo con pg_cron: se programa como Edge Function desde
// Database → Cron Jobs en el Dashboard de Supabase.
Deno.serve(async (_req) => {
  const { data: pendientes, error } = await supabase.rpc('find_pending_whatsapp_warnings')
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let enviados = 0
  let fallidos = 0

  for (const p of pendientes ?? []) {
    const result = await sendTemplate(p.telefono, TEMPLATE_NAME, [p.nombre ?? ''])
    if (result.ok) enviados++; else fallidos++

    await supabase.from('whatsapp_notifications').insert({
      case_id: p.case_id,
      checkin_id: p.checkin_id,
      kind: 'two_missed_warning',
      sent_ok: result.ok,
      // Guardamos el detalle SIEMPRE (no solo en fallo) — un HTTP 200 de
      // SendPulse no garantiza que WhatsApp realmente vaya a entregar el
      // mensaje; el cuerpo real es la única forma de diagnosticarlo.
      error: result.detail ?? (result.ok ? null : 'error desconocido'),
    })
  }

  return new Response(JSON.stringify({ evaluados: pendientes?.length ?? 0, enviados, fallidos }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
