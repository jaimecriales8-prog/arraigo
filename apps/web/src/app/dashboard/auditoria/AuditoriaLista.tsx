'use client'
import { useEffect, useState } from 'react'
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
  'work_location_change_approved': 'Cambio de sitio de trabajo aprobado',
  'organization.created': 'Organización creada',
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
  'work_location_change_approved': 'var(--success)',
  'organization.created': 'var(--success)',
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
    case 'organization.created':
      return `${p.name ?? ''}${p.city ? ` · ${p.city}` : ''}`
    default:
      return ''
  }
}

const PER_PAGE = 15

export default function AuditoriaLista({ entradasIniciales, totalInicial }: { entradasIniciales: Entrada[]; totalInicial: number }) {
  const [accion, setAccion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(0)
  const [entradas, setEntradas] = useState(entradasIniciales)
  const [total, setTotal] = useState(totalInicial)
  const [loading, setLoading] = useState(false)

  // La página 0 sin filtros ya viene del servidor (page.tsx) — evita un
  // fetch redundante en la primera carga.
  const esEstadoInicial = page === 0 && accion === '' && busqueda === ''

  useEffect(() => {
    if (esEstadoInicial) {
      setEntradas(entradasIniciales)
      setTotal(totalInicial)
      return
    }
    let cancelado = false
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (accion) params.set('accion', accion)
    if (busqueda.trim()) params.set('q', busqueda.trim())

    fetch(`/api/auditoria?${params}`)
      .then(res => res.json())
      .then(data => {
        if (cancelado) return
        setEntradas(data.entradas ?? [])
        setTotal(data.total ?? 0)
      })
      .finally(() => { if (!cancelado) setLoading(false) })

    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, accion, busqueda])

  // Debounce simple de la búsqueda: resetea a página 0 al cambiar filtros.
  function onAccion(v: string) { setAccion(v); setPage(0) }
  function onBusqueda(v: string) { setBusqueda(v); setPage(0) }

  const pages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={accion} onChange={(e) => onAccion(e.target.value)} style={selectStyle}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_LABEL).map(([a, label]) => <option key={a} value={a}>{label}</option>)}
        </select>
        <input
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder="Buscar por funcionario o expediente…"
          style={{ ...selectStyle, flex: 1, minWidth: 220 }}
        />
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', opacity: loading ? 0.6 : 1 }} className="table-scroll">
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
            {entradas.length === 0 && !loading && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados.</td></tr>
            )}
            {entradas.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: i < entradas.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
          <span style={{ color: 'var(--text-muted)' }}>{page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} de {total}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0 || loading} style={btn(page === 0 || loading)}>← Anterior</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= pages - 1 || loading} style={btn(page >= pages - 1 || loading)}>Siguiente →</button>
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
