'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'judicial', label: 'Entidad Judicial' },
  { value: 'tecnico', label: 'Técnico' },
]

export default function CrearUsuarioForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('judicial')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const res = await fetch('/api/usuarios/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, email, role }),
    })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setResult({ ok: true, msg: `Usuario creado. Se envió invitación a ${email}` })
      setFullName('')
      setEmail('')
      setRole('judicial')
      router.refresh()
    } else {
      setResult({ ok: false, msg: data.error ?? 'Error al crear usuario' })
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
  }
  const labelStyle = { fontSize: 13, color: 'var(--text-muted)', display: 'block' as const, marginBottom: 6 }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Crear usuario</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Nombre completo</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} required style={inputStyle} placeholder="Juan Pérez" />
        </div>
        <div>
          <label style={labelStyle}>Correo electrónico</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="juez@rama.gov.co" />
        </div>
        <div>
          <label style={labelStyle}>Rol</label>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {result && (
          <p style={{ fontSize: 13, color: result.ok ? 'var(--success)' : 'var(--danger)', lineHeight: 1.5 }}>
            {result.ok ? '✓ ' : '✗ '}{result.msg}
          </p>
        )}

        <button type="submit" disabled={loading} style={{
          padding: '12px',
          background: loading ? 'var(--border)' : 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          marginTop: 4,
        }}>
          {loading ? 'Creando...' : 'Crear y enviar invitación'}
        </button>
      </form>
    </div>
  )
}
