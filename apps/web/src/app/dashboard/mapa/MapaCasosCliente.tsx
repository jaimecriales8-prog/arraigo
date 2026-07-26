'use client'
import dynamic from 'next/dynamic'

const MapaCasos = dynamic(() => import('./MapaCasos'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 520, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      Cargando mapa…
    </div>
  ),
})

export default MapaCasos
