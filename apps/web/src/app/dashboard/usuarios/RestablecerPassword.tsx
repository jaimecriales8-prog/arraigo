'use client'
import { useState } from 'react'

export default function RestablecerPassword({ profileId, nombre, compact }: { profileId: string; nombre: string; compact?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{ email: string; temp_password: string } | null>(null)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  async function restablecer() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/usuarios/restablecer-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId }),
    })
    const data = await res.json()
    setLoading(false)
    setConfirmando(false)
    if (!res.ok) { setError(data.error ?? 'Error al restablecer'); return }
    setResultado({ email: data.email, temp_password: data.temp_password })
  }

  if (resultado) {
    return (
      <div style={overlayStyle} onClick={() => setResultado(null)}>
        <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Contraseña restablecida</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Entrega estas credenciales a <strong style={{ color: 'var(--text)' }}>{nombre}</strong> por un canal seguro. No se envía por correo automáticamente.
          </p>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 16, fontFamily: 'monospace', fontSize: 13 }}>
            <div>Correo: {resultado.email}</div>
            <div>Contraseña temporal: <strong>{resultado.temp_password}</strong></div>
          </div>
          <button onClick={() => setResultado(null)} style={{ ...btnStyle, width: '100%' }}>Cerrar</button>
        </div>
      </div>
    )
  }

  if (confirmando) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>¿Confirmar?</span>
        <button onClick={restablecer} disabled={loading} style={{ ...btnStyle, padding: '4px 10px', fontSize: 12 }}>
          {loading ? '...' : 'Sí'}
        </button>
        <button onClick={() => setConfirmando(false)} style={{ ...btnStyle, padding: '4px 10px', fontSize: 12, background: 'transparent' }}>
          No
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirmando(true)} style={{
      padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
      border: error ? '1px solid var(--danger)' : '1px solid var(--border)',
      background: 'transparent', color: error ? 'var(--danger)' : 'var(--text)', cursor: 'pointer',
    }}>
      {error || (compact ? '🔑 Restablecer' : '🔑 Restablecer contraseña')}
    </button>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
  padding: 24, maxWidth: 420, width: '100%',
}
const btnStyle: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  border: '1px solid var(--border)', background: 'var(--accent)', color: '#fff', cursor: 'pointer',
}
