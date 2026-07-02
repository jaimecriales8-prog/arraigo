import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── APNs directo (sin Expo Push / EAS) ───────────────────────────────────────
// Secrets requeridos: APNS_KEY_P8 (contenido del .p8), APNS_KEY_ID, APNS_TEAM_ID
// Opcionales: APNS_TOPIC (default co.arraigo.app), APNS_ENV (sandbox|production)

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let cachedJwt: { token: string; iat: number } | null = null

async function apnsJwt(): Promise<string> {
  // APNs acepta tokens de hasta 1h; renovar a los 45 min
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
    .select('id, organization_id, supervisor_id, imputado:profiles!cases_imputado_id_fkey(id, push_token, full_name)')
    .eq('id', case_id)
    .single()

  if (!caso) return new Response('Case not found', { status: 404 })

  // Control de acceso: solo roles con autoridad, y SOLO sobre casos de su
  // organización (o el supervisor asignado). Impide que un imputado —o alguien
  // de otra organización— dispare sorpresas sobre cualquier caso.
  const { data: requester } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  const allowedRoles = ['super_admin', 'org_admin', 'officer', 'operador', 'judicial']
  const sameOrg = requester?.organization_id === caso.organization_id
  const isSupervisor = caso.supervisor_id === user.id
  const authorized =
    requester?.role === 'super_admin' ||
    (requester && allowedRoles.includes(requester.role) && (sameOrg || isSupervisor))

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

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

  // Push directo a APNs (si hay token registrado y credenciales configuradas).
  // Si falla, la sorpresa sigue llegando por polling con la app abierta.
  const pushToken = (caso.imputado as any)?.push_token
  let pushSent = false
  if (pushToken && Deno.env.get('APNS_KEY_P8')) {
    try {
      pushSent = await sendApns(
        pushToken,
        '⚠️ Verificación requerida',
        'Tienes 15 minutos para completar tu verificación de presencia.',
        { type: 'surprise', verification_id: sv.id, expires_at: expiresAt },
      )
    } catch (e) {
      console.error('APNs send error:', e)
    }
  }

  return new Response(JSON.stringify({ success: true, verification_id: sv.id, expires_at: expiresAt, push_sent: pushSent }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
})
