'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Imputado = { id: string; full_name: string }

const inputStyle = {
  width: '100%', padding: '11px 14px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
  fontSize: 14, outline: 'none',
}
const labelStyle = { fontSize: 13, color: 'var(--text-muted)', display: 'block' as const, marginBottom: 6 }

export default function CrearCasoForm({ imputados }: { imputados: Imputado[] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    imputado_id: imputados[0]?.id ?? '',
    case_number: '',
    court: '',
    crime_description: '',
    address: '',
    city: '',
    department: '',
    start_date: new Date().toISOString().slice(0, 10),
    geofence_radius_m: '100',
    checkin_times: '08:00, 14:00, 20:00',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const checkin_times = form.checkin_times
      .split(',')
      .map(s => s.trim())
      .filter(s => /^\d{1,2}:\d{2}$/.test(s))

    const res = await fetch('/api/casos/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        geofence_radius_m: Number(form.geofence_radius_m) || 100,
        checkin_times,
      }),
    })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      router.push(`/dashboard/casos/${data.case_id}`)
      router.refresh()
    } else {
      setResult({ ok: false, msg: data.error ?? 'Error al crear el caso' })
    }
  }

  if (imputados.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          No hay imputados disponibles. Primero crea el usuario imputado en{' '}
          <a href="/dashboard/usuarios" style={{ color: 'var(--accent)' }}>Usuarios</a>, luego regresa a registrar el caso.
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 640 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Imputado</label>
          <select value={form.imputado_id} onChange={e => set('imputado_id', e.target.value)} required style={{ ...inputStyle, cursor: 'pointer' }}>
            {imputados.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>N.º de expediente</label>
            <input value={form.case_number} onChange={e => set('case_number', e.target.value)} required style={inputStyle} placeholder="2026-00123" />
          </div>
          <div>
            <label style={labelStyle}>Fecha de inicio</label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} required style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Juzgado (opcional)</label>
          <input value={form.court} onChange={e => set('court', e.target.value)} style={inputStyle} placeholder="Juzgado 3 Penal de Bogotá" />
        </div>

        <div>
          <label style={labelStyle}>Descripción del delito (opcional)</label>
          <input value={form.crime_description} onChange={e => set('crime_description', e.target.value)} style={inputStyle} placeholder="Hurto agravado" />
        </div>

        <div>
          <label style={labelStyle}>Dirección del domicilio</label>
          <input value={form.address} onChange={e => set('address', e.target.value)} required style={inputStyle} placeholder="Calle 45 #12-34" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Ciudad</label>
            <input value={form.city} onChange={e => set('city', e.target.value)} required style={inputStyle} placeholder="Bogotá" />
          </div>
          <div>
            <label style={labelStyle}>Departamento</label>
            <input value={form.department} onChange={e => set('department', e.target.value)} required style={inputStyle} placeholder="Cundinamarca" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Radio geocerca (m)</label>
            <input type="number" value={form.geofence_radius_m} onChange={e => set('geofence_radius_m', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Horarios de verificación</label>
            <input value={form.checkin_times} onChange={e => set('checkin_times', e.target.value)} style={inputStyle} placeholder="08:00, 14:00, 20:00" />
          </div>
        </div>

        {result && (
          <p style={{ fontSize: 13, color: result.ok ? 'var(--success)' : 'var(--danger)', lineHeight: 1.5 }}>
            {result.ok ? '✓ ' : '✗ '}{result.msg}
          </p>
        )}

        <button type="submit" disabled={loading} style={{
          padding: '12px', background: loading ? 'var(--border)' : 'var(--accent)',
          color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Creando…' : 'Crear caso'}
        </button>
      </form>
    </div>
  )
}
