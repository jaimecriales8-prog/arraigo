'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Persona = { id: string; full_name: string }

export default function ReasignarTecnico({
  caseId, tecnicos, current,
}: { caseId: string; tecnicos: Persona[]; current: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? tecnicos[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (tecnicos.length === 0) return null

  async function guardar() {
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/casos/reasignar-tecnico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: caseId, technician_id: value }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setMsg({ ok: true, text: 'Técnico actualizado' })
      router.refresh()
    } else {
      setMsg({ ok: false, text: data.error ?? 'Error al reasignar' })
    }
  }

  const changed = value !== (current ?? '')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text)', fontSize: 14, cursor: 'pointer',
          }}
        >
          {tecnicos.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
        <button
          onClick={guardar}
          disabled={saving || !changed}
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
            background: saving || !changed ? 'var(--border)' : 'var(--accent)', color: '#fff',
            cursor: saving || !changed ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {saving ? 'Guardando…' : 'Reasignar'}
        </button>
      </div>
      {msg && (
        <span style={{ fontSize: 12, color: msg.ok ? 'var(--success)' : 'var(--danger)' }}>
          {msg.ok ? '✓ ' : '✗ '}{msg.text}
        </span>
      )}
    </div>
  )
}
