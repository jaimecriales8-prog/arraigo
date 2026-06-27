import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { case_id } = await req.json()
  if (!case_id) return new Response('case_id required', { status: 400 })

  // Get case + imputado push token
  const { data: caso } = await supabase
    .from('cases')
    .select('id, organization_id, imputado:profiles!cases_imputado_id_fkey(id, push_token, full_name)')
    .eq('id', case_id)
    .single()

  if (!caso) return new Response('Case not found', { status: 404 })

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  // Create surprise verification record
  const { data: sv, error } = await supabase
    .from('surprise_verifications')
    .insert({
      organization_id: caso.organization_id,
      case_id,
      requested_by: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) return new Response(JSON.stringify(error), { status: 500 })

  // Send push notification via Expo Push API
  const pushToken = (caso.imputado as any)?.push_token
  if (pushToken) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title: '⚠️ Verificación requerida',
        body: 'Tienes 15 minutos para completar tu verificación de presencia.',
        data: { type: 'surprise', verification_id: sv.id, expires_at: expiresAt },
        sound: 'default',
        priority: 'high',
      }),
    })
  }

  return new Response(JSON.stringify({ success: true, verification_id: sv.id, expires_at: expiresAt }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
})
