'use client'
import { useMemo } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type Checkin = {
  id: string
  created_at: string
  gps_lat: number | null
  gps_lng: number | null
  gps_passed: boolean | null
  gps_distance_m: number | null
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })

export default function UbicacionMapa({
  homeLat, homeLng, radiusM, checkins,
}: { homeLat: number; homeLng: number; radiusM: number; checkins: Checkin[] }) {
  const puntos = useMemo(
    () => checkins.filter(c => c.gps_lat != null && c.gps_lng != null),
    [checkins]
  )

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapContainer
        center={[homeLat, homeLng]}
        zoom={16}
        style={{ height: 420, width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Geofence permitido */}
        <Circle
          center={[homeLat, homeLng]}
          radius={radiusM}
          pathOptions={{ color: 'var(--accent, #4f8cff)', fillColor: '#4f8cff', fillOpacity: 0.12, weight: 1.5 }}
        />
        <CircleMarker center={[homeLat, homeLng]} radius={7} pathOptions={{ color: '#fff', fillColor: '#4f8cff', fillOpacity: 1, weight: 2 }}>
          <Tooltip direction="top" offset={[0, -8]}>Domicilio autorizado</Tooltip>
        </CircleMarker>

        {/* Check-ins con GPS registrado */}
        {puntos.map((c) => {
          const color = c.gps_passed === false ? '#ef4444' : '#22c55e'
          return (
            <CircleMarker
              key={c.id}
              center={[c.gps_lat!, c.gps_lng!]}
              radius={6}
              pathOptions={{ color: '#fff', fillColor: color, fillOpacity: 0.9, weight: 1.5 }}
            >
              <Popup>
                <div style={{ fontSize: 13 }}>
                  <strong>{fmt(c.created_at)}</strong><br />
                  {c.gps_passed === false ? 'Fuera del domicilio' : 'Dentro del radio permitido'}
                  {c.gps_distance_m != null && <> — {Math.round(c.gps_distance_m)}m del centro</>}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      <div style={{ display: 'flex', gap: 20, padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-card)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4f8cff', display: 'inline-block' }} /> Domicilio
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Dentro del radio
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Fuera del radio
        </span>
        <span style={{ marginLeft: 'auto' }}>{puntos.length} {puntos.length === 1 ? 'ubicación registrada' : 'ubicaciones registradas'}</span>
      </div>
    </div>
  )
}
