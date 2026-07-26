import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── APNs directo (idéntico a trigger-surprise) ───────────────────────────────
function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let cachedJwt: { token: string; iat: number } | null = null

async function apnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedJwt && now - cachedJwt.iat < 45 * 60) return cachedJwt.token

  const p8 = Deno.env.get('APNS_KEY_P8')!
  const keyId = Deno.env.get('APNS_KEY_ID')!
  const teamId = Deno.env.get('APNS_TEAM_ID')!

  const pem = p8.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  )

  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const payload = b64url(JSON.stringify({ iss: teamId, iat: now }))
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${payload}`)
  )
  const token = `${header}.${payload}.${b64url(new Uint8Array(sig))}`
  cachedJwt = { token, iat: now }
  return token
}

async function sendApns(deviceToken: string, title: string, body: string, data: Record<string, string>) {
  const env = Deno.env.get('APNS_ENV') ?? 'sandbox'
  const host = env === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'
  const topic = Deno.env.get('APNS_TOPIC') ?? 'co.arraigo.app'

  const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      'authorization': `bearer ${await apnsJwt()}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    },
    body: JSON.stringify({
      aps: { alert: { title, body }, sound: 'default', 'interruption-level': 'time-sensitive' },
      ...data,
    }),
  })

  if (!res.ok) {
    console.error(`APNs ${res.status}: ${await res.text()}`)
  }
  return res.ok
}

const MAX_MESSAGE_LEN = 500

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  const J = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: J })

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: J })

  const { case_id, message } = await req.json()
  if (!case_id || !message?.trim()) {
    return new Response(JSON.stringify({ error: 'Faltan case_id o message' }), { status: 400, headers: J })
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return new Response(JSON.stringify({ error: `Mensaje muy largo (máx ${MAX_MESSAGE_LEN} caracteres)` }), { status: 400, headers: J })
  }

  const { data: caso } = await supabase
    .from('cases')
    .select('id, organization_id, imputado:profiles!cases_imputado_id_fkey(push_token)')
    .eq('id', case_id)
    .single()

  if (!caso) return new Response(JSON.stringify({ error: 'Caso no encontrado' }), { status: 404, headers: J })

  // Control de acceso: solo staff con autoridad, y solo sobre casos de su organización.
  const { data: requester } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  const allowedRoles = ['super_admin', 'judicial', 'operador']
  const authorized =
    requester?.role === 'super_admin' ||
    (requester && allowedRoles.includes(requester.role) && requester.organization_id === caso.organization_id)

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Sin permisos' }), { status: 403, headers: J })
  }

  const { data: msg, error } = await supabase
    .from('case_messages')
    .insert({ organization_id: caso.organization_id, case_id, sent_by: user.id, message: message.trim() })
    .select()
    .single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: J })

  const pushToken = (caso.imputado as any)?.push_token
  let pushSent = false
  if (pushToken && Deno.env.get('APNS_KEY_P8')) {
    try {
      pushSent = await sendApns(
        pushToken,
        '📢 Mensaje del funcionario',
        message.trim(),
        { type: 'message', message_id: msg.id },
      )
      if (pushSent) {
        await supabase.from('case_messages').update({ push_sent: true }).eq('id', msg.id)
      }
    } catch (e) {
      console.error('APNs send error:', e)
    }
  }

  return new Response(JSON.stringify({ success: true, message_id: msg.id, push_sent: pushSent }), { headers: J })
})
