'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { dangerColor, dangerLabel } from '@/lib/danger'

type Caso = {
  id: string
  case_number: string
  status: string
  department: string
  city: string
  imputado: string
  danger_level: number
  lat: number | null
  lng: number | null
  cumplimiento: { label: string; color: string }
}

// Centro aproximado de Colombia — fallback cuando no hay casos con ubicación.
const CENTRO_COLOMBIA: [number, number] = [4.5709, -74.2973]

export default function MapaCasos({ casos }: { casos: Caso[] }) {
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [nivel, setNivel] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const departamentos = useMemo(
    () => Array.from(new Set(casos.map(c => c.department).filter(Boolean))).sort(),
    [casos]
  )
  const municipios = useMemo(
    () => Array.from(new Set(
      casos.filter(c => !departamento || c.department === departamento).map(c => c.city).filter(Boolean)
    )).sort(),
    [casos, departamento]
  )

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return casos.filter(c => {
      if (departamento && c.department !== departamento) return false
      if (municipio && c.city !== municipio) return false
      if (nivel && String(c.danger_level) !== nivel) return false
      if (q && !c.imputado.toLowerCase().includes(q) && !c.case_number.toLowerCase().includes(q)) return false
      return true
    })
  }, [casos, departamento, municipio, nivel, busqueda])

  const conUbicacion = filtrados.filter(c => c.lat != null && c.lng != null)
  const center: [number, number] = conUbicacion.length > 0
    ? [conUbicacion[0].lat!, conUbicacion[0].lng!]
    : CENTRO_COLOMBIA

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={departamento}
          onChange={(e) => { setDepartamento(e.target.value); setMunicipio('') }}
          style={selectStyle}
        >
          <option value="">Todos los departamentos</option>
          {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={municipio}
          onChange={(e) => setMunicipio(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todos los municipios</option>
          {municipios.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={nivel} onChange={(e) => setNivel(e.target.value)} style={selectStyle}>
          <option value="">Todos los niveles de peligrosidad</option>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} · {dangerLabel(n)}</option>)}
        </select>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o expediente…"
          style={{ ...selectStyle, flex: 1, minWidth: 200 }}
        />
      </div>

      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer center={center} zoom={conUbicacion.length > 0 ? 12 : 6} style={{ height: 520, width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {conUbicacion.map(c => (
            <CircleMarker
              key={c.id}
              center={[c.lat!, c.lng!]}
              radius={6 + c.danger_level * 1.4}
              pathOptions={{ color: dangerColor(c.danger_level), fillColor: c.cumplimiento.color, fillOpacity: 0.85, weight: 3 }}
            >
              <Tooltip direction="top" offset={[0, -8]}>{c.imputado} · peligrosidad {c.danger_level}/5</Tooltip>
              <Popup>
                <div style={{ fontSize: 13, minWidth: 160 }}>
                  <strong>{c.imputado}</strong><br />
                  Exp. {c.case_number}<br />
                  {c.city}, {c.department}<br />
                  <span style={{ color: c.cumplimiento.color, fontWeight: 600 }}>{c.cumplimiento.label}</span>
                  {' · '}
                  <span style={{ color: dangerColor(c.danger_level), fontWeight: 600 }}>Peligrosidad {c.danger_level}/5</span><br />
                  <Link href={`/dashboard/casos/${c.id}`} style={{ color: '#2563eb' }}>Ver caso →</Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div style={{ display: 'flex', gap: 20, padding: '12px 4px', fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>{filtrados.length} caso{filtrados.length !== 1 ? 's' : ''} filtrado{filtrados.length !== 1 ? 's' : ''}</span>
        <span>Anillo = nivel de peligrosidad · relleno = estado de cumplimiento</span>
        {filtrados.length !== conUbicacion.length && (
          <span>({filtrados.length - conUbicacion.length} sin ubicación registrada, no aparece{filtrados.length - conUbicacion.length !== 1 ? 'n' : ''} en el mapa)</span>
        )}
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 14,
}
