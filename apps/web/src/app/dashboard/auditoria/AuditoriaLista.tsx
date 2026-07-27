'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'

type Entrada = {
  id: number
  action: string
  entityType: string
  entityId: string | null
  payload: Record<string, unknown> | null
  createdAt: string
  caseId: string | null
  caseNumber: string | null
  actorNombre: string
  actorRole: string
}

const ACTION_LABEL: Record<string, string> = {
  'case.created': 'Caso creado',
  'case.updated': 'Caso editado',
  'case.technician_reassigned': 'Técnico reasignado',
  'checkin.excused': 'Check-in excusado',
  'user.created': 'Usuario creado',
  'user.password_reset': 'Contraseña restablecida',
  'alert.resolved': 'Alerta resuelta',
  'case.note_added': 'Nota de seguimiento agregada',
}
const ROL_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', judicial: 'Entidad Judicial', tecnico: 'Técnico', operador: 'Operador', imputado: 'Imputado',
}
const ACTION_COLOR: Record<string, string> = {
  'case.created': 'var(--success)',
  'case.updated': 'var(--accent)',
  'case.technician_reassigned': 'var(--accent)',
  'checkin.excused': 'var(--warning)',
  'user.created': 'var(--success)',
  'user.password_reset': 'var(--warning)',
  'alert.resolved': 'var(--success)',
  'case.note_added': 'var(--accent)',
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })

function detalle(a: Entrada): string {
  const p = a.payload ?? {}
  switch (a.action) {
    case 'case.updated': {
      const campos = Object.keys(p)
      return campos.length ? `Campos: ${campos.join(', ')}` : '—'
    }
    case 'case.created':
      return `Expediente ${p.case_number ?? '—'}`
    case 'checkin.excused':
      return `Motivo: ${p.reason ?? '—'}`
    case 'user.created':
      return `${p.full_name ?? ''} (${p.email ?? ''}) · rol ${ROL_LABEL[p.role as string] ?? p.role ?? '—'}`
    case 'user.password_reset':
      return `Usuario: ${p.email ?? p.full_name ?? '—'}`
    case 'alert.resolved':
      return `Tipo: ${p.type ?? '—'}`
    case 'case.note_added':
      return `${p.preview ?? ''}`
    case 'case.technician_reassigned':
      return 'Nuevo técnico asignado'
    default:
      return ''
  }
}

const PER_PAGE = 15

export default function AuditoriaLista({ entradas }: { entradas: Entrada[] }) {
  const [accion, setAccion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(0)

  const acciones = useMemo(
    () => Array.from(new Set(entradas.map(e => e.action))).sort(),
    [entradas]
  )

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return entradas.filter(e => {
      if (accion && e.action !== accion) return false
      if (q && !e.actorNombre.toLowerCase().includes(q) && !(e.caseNumber ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [entradas, accion, busqueda])

  const total = filtradas.length
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  const p = Math.min(page, pages - 1)
  const slice = filtradas.slice(p * PER_PAGE, (p + 1) * PER_PAGE)

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={accion} onChange={(e) => { setAccion(e.target.value); setPage(0) }} style={selectStyle}>
          <option value="">Todas las acciones</option>
          {acciones.map(a => <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>)}
        </select>
        <input
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(0) }}
          placeholder="Buscar por funcionario o expediente…"
          style={{ ...selectStyle, flex: 1, minWidth: 220 }}
        />
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }} className="table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Fecha', 'Acción', 'Funcionario', 'Caso', 'Detalle'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: i < slice.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(a.createdAt)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    background: (ACTION_COLOR[a.action] ?? 'var(--text-muted)') + '22',
                    color: ACTION_COLOR[a.action] ?? 'var(--text-muted)',
                  }}>
                    {ACTION_LABEL[a.action] ?? a.action}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13.5 }}>
                  {a.actorNombre}
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{ROL_LABEL[a.actorRole] ?? a.actorRole}</div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>
                  {a.caseNumber ? (
                    <Link href={`/dashboard/casos/${a.caseId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{a.caseNumber}</Link>
                  ) : '—'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{detalle(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>{p * PER_PAGE + 1}–{Math.min((p + 1) * PER_PAGE, total)} de {total}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPage(p - 1)} disabled={p === 0} style={btn(p === 0)}>← Anterior</button>
            <button onClick={() => setPage(p + 1)} disabled={p >= pages - 1} style={btn(p >= pages - 1)}>Siguiente →</button>
          </div>
        </div>
      )}
    </div>
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

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 14,
}
