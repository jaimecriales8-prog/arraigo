import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import MapaCasos from './MapaCasosCliente'

export const dynamic = 'force-dynamic'

async function getCasos() {
  const cookieStore = await cookies()
  // Anon client con sesión del usuario — RLS filtra por org automáticamente
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  // mapa_casos: vista que ya trae el último check-in por caso (LATERAL join
  // en SQL) — antes se traía el historial completo de checkins anidado por
  // caso solo para calcular el más reciente en JS. Con 50k casos y meses de
  // historial, eso son millones de filas por request.
  const { data, error } = await supabase
    .from('mapa_casos')
    .select('*')
    .order('case_number', { ascending: true })

  if (error) console.error('[mapa] error:', error.message)
  return data ?? []
}

export default async function MapaPage() {
  const casosRaw = await getCasos()

  const casos = casosRaw.map((c: any) => {
    const coords = c.location?.coordinates as [number, number] | undefined

    const cumplimiento = (() => {
      if (c.status !== 'active') return { label: 'Inactivo', color: 'var(--text-muted)' }
      if (!c.ultimo_checkin_id) return { label: 'Sin check-ins', color: '#f59e0b' }
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const ultimoDate = new Date(c.ultimo_checkin_created_at)
      const aprobado = (c.ultimo_checkin_status === 'completed' || c.ultimo_checkin_status === 'passed') && c.ultimo_overall_passed
      if (ultimoDate >= hace24h && aprobado) return { label: 'Al día', color: '#16a34a' }
      if (ultimoDate >= hace24h && c.ultimo_checkin_status === 'pending') return { label: 'Pendiente', color: '#f59e0b' }
      if (ultimoDate >= hace24h) return { label: 'Verificación fallida', color: '#dc2626' }
      return { label: 'En mora', color: '#dc2626' }
    })()

    return {
      id: c.id,
      case_number: c.case_number,
      status: c.status,
      department: c.department ?? '',
      city: c.city ?? '',
      imputado: c.imputado_nombre ?? 'Sin nombre',
      danger_level: c.danger_level ?? 3,
      lat: coords ? coords[1] : null,
      lng: coords ? coords[0] : null,
      cumplimiento,
    }
  })

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Mapa de casos</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
        {casos.length} caso{casos.length !== 1 ? 's' : ''} registrado{casos.length !== 1 ? 's' : ''}
      </p>
      <MapaCasos casos={casos} />
    </div>
  )
}
