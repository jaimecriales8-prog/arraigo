'use client'
import { useMemo, useState } from 'react'
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

type Grupo = {
  caseId: string | null
  caseNumber: string | null
  imputado: string | null
  alertas: Alerta[]
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
  device_silent: '📵 Dispositivo sin reportar actividad',
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })

function btn(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: '1px solid var(--border)', background: 'transparent',
    color: disabled ? 'var(--text-muted)' : 'var(--text)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  }
}

const PREVIEW_CAP = 5

function GrupoCard({ grupo }: { grupo: Grupo }) {
  const [expandido, setExpandido] = useState(grupo.alertas.length <= 3)
  const [verTodas, setVerTodas] = useState(false)
  const masCriticos = grupo.alertas.filter(a => a.severity === 'critical').length
  const visibles = verTodas ? grupo.alertas : grupo.alertas.slice(0, PREVIEW_CAP)

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setExpandido(e => !e)}
        style={{
          width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          minWidth: 28, height: 28, borderRadius: '50%', background: 'var(--danger)' + '22', color: 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>{grupo.alertas.length}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {grupo.caseNumber ? (
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              Exp. {grupo.caseNumber} · {grupo.imputado ?? '—'}
            </span>
          ) : (
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-muted)' }}>Sin caso asociado</span>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {grupo.alertas.length} alerta{grupo.alertas.length !== 1 ? 's' : ''} sin resolver
            {masCriticos > 0 && <span style={{ color: 'var(--danger)' }}> · {masCriticos} crítica{masCriticos !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        {grupo.caseId && (
          <Link
            href={`/dashboard/casos/${grupo.caseId}`}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', flexShrink: 0 }}
          >
            Ver caso →
          </Link>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>{expandido ? '▲' : '▼'}</span>
      </button>

      {expandido && (
        <div style={{ borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          {visibles.map((a, i) => {
            const sev = SEV[a.severity] ?? { label: a.severity, color: 'var(--text-muted)' }
            return (
              <div key={a.id} style={{
                padding: '12px 18px', borderBottom: i < visibles.length - 1 || grupo.alertas.length > visibles.length ? '1px solid var(--border)' : 'none',
                borderLeft: `3px solid ${sev.color}`, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(a.created_at)}</div>
                </div>
                <ResolverAlerta alertId={a.id} />
              </div>
            )
          })}
          {!verTodas && grupo.alertas.length > PREVIEW_CAP && (
            <button
              onClick={() => setVerTodas(true)}
              style={{ padding: '10px 18px', fontSize: 13, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              Mostrar {grupo.alertas.length - PREVIEW_CAP} más →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function AlertasLista({ alertas, perPage = 8 }: { alertas: Alerta[]; perPage?: number }) {
  const [page, setPage] = useState(0)

  const grupos = useMemo(() => {
    const porCaso = new Map<string, Grupo>()
    for (const a of alertas) {
      const key = a.caseId ?? '__sin_caso__'
      if (!porCaso.has(key)) {
        porCaso.set(key, { caseId: a.caseId, caseNumber: a.caseNumber, imputado: a.imputado, alertas: [] })
      }
      porCaso.get(key)!.alertas.push(a)
    }
    // Más alertas primero; empate → la más reciente primero
    return Array.from(porCaso.values()).sort((g1, g2) => {
      if (g2.alertas.length !== g1.alertas.length) return g2.alertas.length - g1.alertas.length
      return new Date(g2.alertas[0].created_at).getTime() - new Date(g1.alertas[0].created_at).getTime()
    })
  }, [alertas])

  const totalGrupos = grupos.length
  const pages = Math.max(1, Math.ceil(totalGrupos / perPage))
  const p = Math.min(page, pages - 1)
  const slice = grupos.slice(p * perPage, (p + 1) * perPage)

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {slice.map((g) => <GrupoCard key={g.caseId ?? '__sin_caso__'} grupo={g} />)}
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {p * perPage + 1}–{Math.min((p + 1) * perPage, totalGrupos)} de {totalGrupos} caso{totalGrupos !== 1 ? 's' : ''} con alertas
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPage(p - 1)} disabled={p === 0} style={btn(p === 0)}>← Anterior</button>
            <button onClick={() => setPage(p + 1)} disabled={p >= pages - 1} style={btn(p >= pages - 1)}>Siguiente →</button>
          </div>
        </div>
      )}
    </>
  )
}
