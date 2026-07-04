'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLES_POR_ROL: Record<string, { value: string; label: string }[]> = {
  super_admin: [
    { value: 'judicial', label: 'Entidad Judicial' },
    { value: 'tecnico', label: 'Técnico' },
  ],
  judicial: [
    { value: 'imputado', label: 'Imputado (arrestado)' },
    { value: 'operador', label: 'Operador' },
  ],
}

export default function CrearUsuarioForm({ currentRole }: { currentRole: string }) {
  const rolesDisponibles = ROLES_POR_ROL[currentRole] ?? []

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(rolesDisponibles[0]?.value ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [creds, setCreds] = useState<{ email: string; password: string; role: string } | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setCreds(null)

    const res = await fetch('/api/usuarios/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, email, role }),
    })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setCreds({ email: data.email, password: data.temp_password, role: data.role })
      setResult(null)
      setFullName('')
      setEmail('')
      setRole(rolesDisponibles[0]?.value ?? '')
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
            {rolesDisponibles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {result && (
          <p style={{ fontSize: 13, color: result.ok ? 'var(--success)' : 'var(--danger)', lineHeight: 1.5 }}>
            {result.ok ? '✓ ' : '✗ '}{result.msg}
          </p>
        )}

        {creds && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--success)', borderRadius: 8, padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 10 }}>
              ✓ Usuario creado. Entrega estas credenciales de forma segura:
            </p>
            <div style={{ fontSize: 13, fontFamily: 'monospace', lineHeight: 1.9, color: 'var(--text)' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Correo: </span>{creds.email}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Contraseña: </span>{creds.password}</div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              {creds.role === 'imputado'
                ? 'Entrégalas al técnico: con ellas inicia sesión en la app del imputado durante el onboarding en el domicilio. No se envía correo.'
                : 'El usuario inicia sesión con estas credenciales. No se envía correo de invitación.'}
            </p>
          </div>
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
          {loading ? 'Creando...' : 'Crear usuario'}
        </button>
      </form>
    </div>
  )
}
