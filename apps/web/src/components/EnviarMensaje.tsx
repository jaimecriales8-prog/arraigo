'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const MAX_LEN = 500

export default function EnviarMensaje({ caseId }: { caseId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function enviar() {
    if (!message.trim()) {
      setError('Escribe un mensaje')
      return
    }
    setSaving(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ case_id: caseId, message }),
    })
    const data = await res.json()
    setSaving(false)

    if (res.ok) {
      setOpen(false)
      setMessage('')
      router.refresh()
    } else {
      setError(data.error ?? 'Error al enviar')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        💬 Enviar mensaje
      </button>

      {open && (
        <div
          onClick={() => !saving && setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: 24,
              maxWidth: 420, width: '100%', border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Enviar mensaje al imputado</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Se envía como notificación push (si tiene token registrado) y queda visible en su app. No requiere una verificación de presencia — para eso usa la sorpresa.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
              placeholder="Ej: Preséntese en la puerta de su domicilio ahora, o Acérquese a la ventana para la verificación."
              rows={4}
              style={{
                width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', marginBottom: 4,
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 12 }}>
              {message.length}/{MAX_LEN}
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 14, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
                  background: saving ? 'var(--border)' : '#2563eb', color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
