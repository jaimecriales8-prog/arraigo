'use client'
import dynamic from 'next/dynamic'

const UbicacionMapa = dynamic(() => import('./UbicacionMapa'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 420, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      Cargando mapa…
    </div>
  ),
})

export default UbicacionMapa
