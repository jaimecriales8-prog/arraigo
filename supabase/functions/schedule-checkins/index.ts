import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (_req) => {
  const now = new Date()

  const { data: cases, error } = await supabase
    .from('cases')
    .select('id, checkin_times, checkin_window_min, timezone')
    .eq('status', 'active')
    .not('checkin_times', 'is', null)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let created = 0
  const results: string[] = []

  for (const caso of cases ?? []) {
    const tz = caso.timezone ?? 'America/Bogota'
    const windowMin = caso.checkin_window_min ?? 15

    for (const timeStr of (caso.checkin_times ?? [])) {
      const [hh, mm] = timeStr.split(':').map(Number)

      const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: tz }))
      const scheduledInTz = new Date(nowInTz)
      scheduledInTz.setHours(hh, mm, 0, 0)
      const windowClosesInTz = new Date(scheduledInTz.getTime() + windowMin * 60 * 1000)

      // Solo actuar si ahora está dentro de la ventana
      if (nowInTz < scheduledInTz || nowInTz > windowClosesInTz) continue

      // Calcular UTC equivalente
      const offsetMs = nowInTz.getTime() - now.getTime()
      const scheduledUtc = new Date(scheduledInTz.getTime() - offsetMs)
      const windowClosesUtc = new Date(windowClosesInTz.getTime() - offsetMs)

      // Evitar duplicados
      const { data: existing } = await supabase
        .from('checkins')
        .select('id')
        .eq('case_id', caso.id)
        .eq('type', 'scheduled')
        .gte('scheduled_at', scheduledUtc.toISOString())
        .lt('scheduled_at', windowClosesUtc.toISOString())
        .maybeSingle()

      if (existing) {
        results.push(`skip ${caso.id} @ ${timeStr}`)
        continue
      }

      const { error: insertError } = await supabase.from('checkins').insert({
        case_id: caso.id,
        type: 'scheduled',
        status: 'pending',
        scheduled_at: scheduledUtc.toISOString(),
        window_closes_at: windowClosesUtc.toISOString(),
        expires_at: windowClosesUtc.toISOString(),
      })

      if (insertError) {
        results.push(`error ${caso.id}: ${insertError.message}`)
      } else {
        created++
        results.push(`created ${caso.id} @ ${timeStr}`)
      }
    }
  }

  return new Response(
    JSON.stringify({ created, results }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
