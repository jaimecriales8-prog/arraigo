'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/colombia'

const inputStyle = {
  width: '100%', padding: '11px 14px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
  fontSize: 14, outline: 'none',
}
const labelStyle = { fontSize: 13, color: 'var(--text-muted)', display: 'block' as const, marginBottom: 6 }

export default function CrearOrganizacionForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', nit: '', contact_email: '', contact_phone: '', department: '', city: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })) }
  function setDepartamento(v: string) { setForm(f => ({ ...f, department: v, city: '' })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const res = await fetch('/api/organizaciones/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setResult({ ok: true, msg: `Organización "${form.name}" creada.` })
      setForm({ name: '', nit: '', contact_email: '', contact_phone: '', department: '', city: '' })
      router.refresh()
    } else {
      setResult({ ok: false, msg: data.error ?? 'Error al crear la organización' })
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Nombre *</label>
        <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="Ej: Juzgado 3° Penal Municipal de Medellín" required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>NIT</label>
          <input style={inputStyle} value={form.nit} onChange={e => set('nit', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Email de contacto *</label>
          <input style={inputStyle} type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} required />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>Teléfono de contacto</label>
          <input style={inputStyle} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Departamento</label>
          <select style={inputStyle} value={form.department} onChange={e => setDepartamento(e.target.value)}>
            <option value="">Sin especificar</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Municipio</label>
        <select style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} disabled={!form.department}>
          <option value="">{form.department ? 'Sin especificar' : 'Elige un departamento primero'}</option>
          {form.department && municipiosDe(form.department).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {result && (
        <div style={{ fontSize: 13, color: result.ok ? 'var(--success)' : 'var(--danger)' }}>{result.msg}</div>
      )}

      <button type="submit" disabled={loading} style={{
        padding: '11px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
        background: loading ? 'var(--border)' : 'var(--accent)', color: '#fff',
        cursor: loading ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
      }}>
        {loading ? 'Creando…' : 'Crear organización'}
      </button>
    </form>
  )
}
