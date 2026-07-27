'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const MAX_LEN = 2000

export default function AgregarNota({ caseId }: { caseId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    if (!note.trim()) { setError('Escribe una nota'); return }
    setSaving(true)
    setError(null)
    const res = await fetch('/api/casos/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: caseId, note }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setOpen(false)
      setNote('')
      router.refresh()
    } else {
      setError(data.error ?? 'Error al guardar')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '10px 20px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)',
          borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        📝 Agregar nota
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
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Nota de seguimiento</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Solo visible para el staff — el imputado no la ve. Para eso está la mensajería.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_LEN))}
              placeholder="Ej: Habló con la familia, pendiente audiencia el 15 de agosto…"
              rows={4}
              style={{
                width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', marginBottom: 4,
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 12 }}>
              {note.length}/{MAX_LEN}
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
                onClick={guardar}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
                  background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
