'use client'
import { useState } from 'react'
import FotosViewer from './FotosViewer'
import ExcusarCheckin from './ExcusarCheckin'

type Row = {
  id: string
  status: string
  created_at: string
  expires_at?: string
  overall_passed?: boolean | null
  checkin_overall_passed?: boolean | null
  has_photos?: boolean
  checkin_id?: string | null
}

const EXCUSABLE = (r: Row) =>
  r.status === 'missed' || r.status === 'failed' || (r.status === 'completed' && r.overall_passed === false)

function checkinResult(c: Row): { label: string; color: string } {
  if (c.status === 'pending') return { label: 'Pendiente', color: 'var(--warning)' }
  if (c.status === 'missed') return { label: 'No realizada', color: 'var(--danger)' }
  if (c.status === 'excused') return { label: 'Excusada', color: 'var(--text-muted)' }
  if (c.status === 'failed') return { label: 'Fallido', color: 'var(--danger)' }
  return c.overall_passed
    ? { label: 'Aprobado', color: 'var(--success)' }
    : { label: 'Fallido', color: 'var(--danger)' }
}
function sorpresaResult(s: Row): { label: string; color: string } {
  if (s.status === 'pending') return { label: 'Pendiente', color: 'var(--warning)' }
  if (s.status === 'expired') return { label: 'Incumplida', color: 'var(--danger)' }
  if (s.checkin_overall_passed === false) return { label: 'Fallida', color: 'var(--danger)' }
  return { label: 'Completada', color: 'var(--success)' }
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })

const cellTd = { padding: '13px 20px', fontSize: 13 } as const
const th = {
  padding: '12px 20px', textAlign: 'left' as const, fontSize: 12, fontWeight: 600,
  color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

export default function HistorialTabla({ kind, rows, perPage = 8, puedeGestionar = false }: { kind: 'checkin' | 'surprise'; rows: Row[]; perPage?: number; puedeGestionar?: boolean }) {
  const [page, setPage] = useState(0)
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / perPage))
  const p = Math.min(page, pages - 1)
  const slice = rows.slice(p * perPage, (p + 1) * perPage)
  const headers = kind === 'checkin' ? ['Fecha', 'Estado', ''] : ['Enviada', 'Expira', 'Estado', '']

  return (
    <>
      <div className="table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {headers.map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {total === 0 && (
              <tr><td colSpan={headers.length} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                {kind === 'checkin' ? 'Sin check-ins aún.' : 'Sin verificaciones sorpresa aún.'}
              </td></tr>
            )}
            {slice.map((r, i) => {
              const res = kind === 'checkin' ? checkinResult(r) : sorpresaResult(r)
              return (
                <tr key={r.id} style={{ borderBottom: i < slice.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={cellTd}>{fmt(r.created_at)}</td>
                  {kind === 'surprise' && (
                    <td style={{ ...cellTd, color: 'var(--text-muted)' }}>{r.expires_at ? fmt(r.expires_at) : '—'}</td>
                  )}
                  <td style={{ padding: '13px 20px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: res.color + '22', color: res.color }}>
                      {res.label}
                    </span>
                  </td>
                  <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {kind === 'checkin' && puedeGestionar && EXCUSABLE(r) && (
                        <ExcusarCheckin checkinId={r.id} />
                      )}
                      <FotosViewer
                        checkinId={(kind === 'checkin' ? r.id : r.checkin_id) ?? ''}
                        hasPhotos={Boolean(kind === 'checkin' ? r.has_photos : r.checkin_id && r.has_photos)}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {p * perPage + 1}–{Math.min((p + 1) * perPage, total)} de {total}
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

function btn(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: '1px solid var(--border)', background: 'transparent',
    color: disabled ? 'var(--text-muted)' : 'var(--text)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  }
}
