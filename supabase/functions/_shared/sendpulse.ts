// SendPulse WhatsApp Business API — portado de GeoDataVoice
// (/Users/jaimecriales/Sites/GeoDataVoice/frontend/lib/whatsapp.ts), mismo
// patrón ya probado en producción, misma cuenta/bot de WhatsApp Business.
// Endpoint correcto para templates: POST /whatsapp/contacts/sendTemplateByPhone
// (WhatsApp Business exige plantilla pre-aprobada por Meta para cualquier
// mensaje que la empresa inicia — no se puede mandar texto libre).

const SP_URL = 'https://api.sendpulse.com'

let _token: string | null = null
let _tokenExp = 0

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExp) return _token
  const res = await fetch(`${SP_URL}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: Deno.env.get('SENDPULSE_API_ID'),
      client_secret: Deno.env.get('SENDPULSE_API_SECRET'),
    }),
  })
  if (!res.ok) throw new Error(`SendPulse auth failed: ${res.status}`)
  const data = await res.json()
  _token = data.access_token
  _tokenExp = Date.now() + (data.expires_in - 60) * 1000
  return _token!
}

// Normalización a Colombia — mismo criterio que GeoDataVoice.
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('57')) return digits
  if (digits.startsWith('3') && digits.length === 10) return `57${digits}`
  return digits
}

export async function sendTemplate(phone: string, templateName: string, params: string[]): Promise<{ ok: boolean; detail?: string }> {
  if (!Deno.env.get('SENDPULSE_API_ID') || !Deno.env.get('SENDPULSE_WA_BOT_ID')) {
    return { ok: false, detail: 'SendPulse no configurado (faltan secrets)' }
  }
  try {
    const token = await getToken()
    const res = await fetch(`${SP_URL}/whatsapp/contacts/sendTemplateByPhone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        bot_id: Deno.env.get('SENDPULSE_WA_BOT_ID'),
        phone: normalizePhone(phone),
        template: {
          name: templateName,
          language: { policy: 'deterministic', code: 'es' },
          components: [{
            type: 'body',
            parameters: params.map(text => ({ type: 'text', text })),
          }],
        },
      }),
    })
    const body = await res.text()
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}: ${body}` }
    return { ok: true, detail: body }
  } catch (e: any) {
    return { ok: false, detail: e?.message ?? String(e) }
  }
}
