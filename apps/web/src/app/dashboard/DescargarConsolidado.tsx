'use client'
import { useState } from 'react'

const RANGOS = [
  { value: 'all', label: 'Todo el historial' },
  { value: 'day', label: 'Último día' },
  { value: 'month', label: 'Último mes' },
  { value: 'year', label: 'Último año' },
]

export default function DescargarConsolidado() {
  const [rango, setRango] = useState('all')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <select
        value={rango}
        onChange={(e) => setRango(e.target.value)}
        style={{
          padding: '8px 10px', borderRadius: 8, fontSize: 13,
          border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)',
        }}
      >
        {RANGOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <a
        href={`/api/reportes/consolidado?rango=${rango}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        📄 Reporte consolidado
      </a>
    </div>
  )
}
