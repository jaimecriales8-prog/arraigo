'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { dangerColor, dangerLabel } from '@/lib/danger'

const STATUS_LABEL: Record<string, string> = { active: 'Activo', suspended: 'Suspendido', closed: 'Cerrado' }
const STATUS_COLOR: Record<string, string> = { active: 'var(--success)', suspended: 'var(--warning)', closed: 'var(--text-muted)' }

type Caso = {
  id: string
  case_number: string
  status: string
  imputado: string
  danger_level: number
  checkinsCount: number
  ultimo: { created_at: string; status: string; overall_passed: boolean | null } | null
  cumplimiento: { label: string; color: string } | null
}

export default function CasosLista({ casos }: { casos: Caso[] }) {
  const [nivel, setNivel] = useState<string>('')
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return casos.filter(c => {
      if (nivel && String(c.danger_level) !== nivel) return false
      if (q && !c.imputado.toLowerCase().includes(q) && !c.case_number.toLowerCase().includes(q)) return false
      return true
    })
  }, [casos, nivel, busqueda])

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={nivel} onChange={e => setNivel(e.target.value)} style={selectStyle}>
          <option value="">Todos los niveles</option>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} · {dangerLabel(n)}</option>)}
        </select>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o expediente…"
          style={{ ...selectStyle, flex: 1, minWidth: 200 }}
        />
      </div>

      <div className="table-scroll" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Expediente', 'Imputado', 'Peligrosidad', 'Estado', 'Cumplimiento', 'Check-ins', 'Último check-in', 'Acciones'].map(h => (
                <th key={h} style={{
                  padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay casos que coincidan con el filtro.
                </td>
              </tr>
            )}
            {filtrados.map((caso, i) => (
              <tr key={caso.id} style={{ borderBottom: i < filtrados.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontSize: 13 }}>{caso.case_number}</td>
                <td style={{ padding: '16px 20px', fontSize: 14, fontWeight: 500 }}>{caso.imputado}</td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: dangerColor(caso.danger_level) + '22', color: dangerColor(caso.danger_level),
                  }}>
                    {caso.danger_level}/5
                  </span>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: STATUS_COLOR[caso.status] + '22', color: STATUS_COLOR[caso.status],
                  }}>
                    {STATUS_LABEL[caso.status] ?? caso.status}
                  </span>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  {caso.cumplimiento ? (
                    <span style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: caso.cumplimiento.color + '22', color: caso.cumplimiento.color,
                    }}>{caso.cumplimiento.label}</span>
                  ) : '—'}
                </td>
                <td style={{ padding: '16px 20px', fontSize: 14, color: 'var(--text-muted)' }}>{caso.checkinsCount}</td>
                <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                  {caso.ultimo ? fmt(caso.ultimo.created_at) : '—'}
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <Link href={`/dashboard/casos/${caso.id}`} style={{
                    padding: '6px 14px', background: 'var(--bg-card2)', border: '1px solid var(--border)',
                    borderRadius: 6, color: 'var(--text)', fontSize: 13, textDecoration: 'none',
                  }}>
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 14,
}
