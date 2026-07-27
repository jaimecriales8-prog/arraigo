import { createClient } from 'jsr:@supabase/supabase-js@2'

// Deprecado como mecanismo principal — la creación de check-ins programados
// ahora corre vía pg_cron cada 15 min (create_scheduled_checkins(), ver
// supabase/migrations/20260727_017_schedule_checkins_set_based.sql), que es
// set-based y no hace un round-trip a la BD por cada caso/horario como hacía
// este archivo antes. Se deja como wrapper delgado por si algo externo
// todavía dispara esta URL — sigue siendo seguro e idempotente (la función
// SQL no duplica check-ins ya creados).
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (_req) => {
  const { data, error } = await supabase.rpc('create_scheduled_checkins')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(
    JSON.stringify({ created: data }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
