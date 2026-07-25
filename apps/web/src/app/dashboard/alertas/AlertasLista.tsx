'use client'
import { useState } from 'react'
import Link from 'next/link'
import ResolverAlerta from './ResolverAlerta'

type Alerta = {
  id: string
  severity: string
  type: string
  message: string
  created_at: string
  caseId: string | null
  caseNumber: string | null
  imputado: string | null
}

const SEV: Record<string, { label: string; color: string }> = {
  critical: { label: 'Crítica', color: 'var(--danger)' },
  warning: { label: 'Advertencia', color: 'var(--warning)' },
  info: { label: 'Info', color: 'var(--accent)' },
}
const TIPO: Record<string, string> = {
  gps_out: 'GPS fuera del domicilio',
  mock_gps: 'GPS simulado',
  face_fail: 'Verificación facial fallida',
  scene_fail: 'Escena no coincide',
  missed: 'Verificación no realizada',
  surprise_missed: 'Sorpresa no atendida',
  escalation: '🚨 Escalamiento — 3 incumplimientos seguidos',
}

function btn(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: '1px solid var(--border)', background: 'transparent',
    color: disabled ? 'var(--text-muted)' : 'var(--text)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  }
}

export default function AlertasLista({ alertas, perPage = 12 }: { alertas: Alerta[]; perPage?: number }) {
  const [page, setPage] = useState(0)
  const total = alertas.length
  const pages = Math.max(1, Math.ceil(total / perPage))
  const p = Math.min(page, pages - 1)
  const slice = alertas.slice(p * perPage, (p + 1) * perPage)

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {slice.map((a) => {
          const sev = SEV[a.severity] ?? { label: a.severity, color: 'var(--text-muted)' }
          return (
            <div key={a.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${sev.color}`, borderRadius: 12, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: sev.color + '22', color: sev.color, textTransform: 'uppercase', letterSpacing: '.04em',
                  }}>{sev.label}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{TIPO[a.type] ?? a.type}</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text)', marginBottom: 4 }}>{a.message}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {a.caseNumber ? (
                    <>Exp. <Link href={`/dashboard/casos/${a.caseId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{a.caseNumber}</Link> · {a.imputado ?? '—'} · </>
                  ) : null}
                  {new Date(a.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
                </div>
              </div>
              <ResolverAlerta alertId={a.id} />
            </div>
          )
        })}
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>{p * perPage + 1}–{Math.min((p + 1) * perPage, total)} de {total}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPage(p - 1)} disabled={p === 0} style={btn(p === 0)}>← Anterior</button>
            <button onClick={() => setPage(p + 1)} disabled={p >= pages - 1} style={btn(p >= pages - 1)}>Siguiente →</button>
          </div>
        </div>
      )}
    </>
  )
}
