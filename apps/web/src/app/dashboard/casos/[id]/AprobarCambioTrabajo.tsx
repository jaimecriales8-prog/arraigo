'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AprobarCambioTrabajo({ caseId, reason }: { caseId: string; reason: string | null }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function aprobar() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/casos/aprobar-cambio-trabajo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: caseId }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      router.refresh()
    } else {
      setError(data.error ?? 'Error al aprobar')
    }
  }

  return (
    <div style={{
      background: 'var(--warning)11', border: '1px solid var(--warning)', borderRadius: 12,
      padding: 16, marginBottom: 16,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)', marginBottom: 6 }}>
        Solicitud de cambio de sitio de trabajo
      </div>
      {reason && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Motivo: {reason}
        </div>
      )}
      {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button
        onClick={aprobar}
        disabled={saving}
        style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none',
          background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff',
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Aprobando…' : 'Aprobar solicitud'}
      </button>
    </div>
  )
}
