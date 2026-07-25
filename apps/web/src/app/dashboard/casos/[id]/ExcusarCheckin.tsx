'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ExcusarCheckin({ checkinId }: { checkinId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function excusar() {
    if (!reason.trim()) {
      setError('Escribe el motivo de la excusa')
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch('/api/checkins/excusar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkin_id: checkinId, reason }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setOpen(false)
      setReason('')
      router.refresh()
    } else {
      setError(data.error ?? 'Error al excusar')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--warning)',
          cursor: 'pointer',
        }}
      >
        Excusar
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
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Excusar ausencia</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              El check-in dejará de contar como incumplimiento y sus alertas asociadas se marcarán como resueltas.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (ej: hospitalización, cita médica autorizada...)"
              rows={4}
              style={{
                width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', marginBottom: 12,
              }}
            />
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
                onClick={excusar}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
                  background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Guardando…' : 'Excusar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
