'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dangerColor, dangerLabel } from '@/lib/danger'

const ESTADOS: Record<string, string> = {
  active: 'Activo',
  suspended: 'Suspendido',
  closed: 'Cerrado',
}

export default function EditarCaso({
  caseId, currentStatus, currentTimes, currentRadius, currentDangerLevel,
}: { caseId: string; currentStatus: string; currentTimes: string[]; currentRadius: number; currentDangerLevel: number }) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [times, setTimes] = useState(currentTimes.join(', '))
  const [radius, setRadius] = useState(String(currentRadius))
  const [dangerLevel, setDangerLevel] = useState(currentDangerLevel)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const timesArray = times.split(',').map(t => t.trim()).filter(Boolean)
  const changed = status !== currentStatus || times !== currentTimes.join(', ') || radius !== String(currentRadius) || dangerLevel !== currentDangerLevel

  async function guardar() {
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/casos/editar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        case_id: caseId,
        status,
        checkin_times: timesArray,
        geofence_radius_m: Number(radius),
        danger_level: dangerLevel,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setMsg({ ok: true, text: 'Caso actualizado' })
      router.refresh()
    } else {
      setMsg({ ok: false, text: data.error ?? 'Error al actualizar' })
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text)', fontSize: 14,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
      <div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Estado del caso</label>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {Object.entries(ESTADOS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Horarios (separados por coma, HH:MM)</label>
        <input value={times} onChange={e => setTimes(e.target.value)} placeholder="08:00, 14:00, 20:00" style={inputStyle} />
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Radio permitido (metros)</label>
        <input type="number" min={10} max={5000} value={radius} onChange={e => setRadius(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nivel de peligrosidad</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4, 5].map(n => {
            const selected = dangerLevel === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => setDangerLevel(n)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  border: `2px solid ${selected ? dangerColor(n) : 'var(--border)'}`,
                  background: selected ? dangerColor(n) + '22' : 'transparent',
                  color: selected ? dangerColor(n) : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{dangerLabel(dangerLevel)}</p>
      </div>
      <button
        onClick={guardar}
        disabled={saving || !changed}
        style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
          background: saving || !changed ? 'var(--border)' : 'var(--accent)', color: '#fff',
          cursor: saving || !changed ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {msg && (
        <span style={{ fontSize: 12, color: msg.ok ? 'var(--success)' : 'var(--danger)' }}>
          {msg.ok ? '✓ ' : '✗ '}{msg.text}
        </span>
      )}
    </div>
  )
}
