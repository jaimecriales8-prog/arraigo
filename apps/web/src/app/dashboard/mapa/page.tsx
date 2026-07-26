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

  const { data, error } = await supabase
    .from('cases')
    .select(`
      id, case_number, status, department, city, location,
      imputado:profiles!cases_imputado_id_fkey(full_name),
      checkins(id, status, overall_passed, created_at)
    `)
    .order('created_at', { ascending: false })

  if (error) console.error('[mapa] error:', error.message)
  return data ?? []
}

export default async function MapaPage() {
  const casosRaw = await getCasos()

  const casos = casosRaw.map((c: any) => {
    const coords = c.location?.coordinates as [number, number] | undefined
    const checkins = c.checkins ?? []
    const ultimo = checkins
      .slice()
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    const cumplimiento = (() => {
      if (c.status !== 'active') return { label: 'Inactivo', color: 'var(--text-muted)' }
      if (!ultimo) return { label: 'Sin check-ins', color: '#f59e0b' }
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const ultimoDate = new Date(ultimo.created_at)
      const aprobado = (ultimo.status === 'completed' || ultimo.status === 'passed') && ultimo.overall_passed
      if (ultimoDate >= hace24h && aprobado) return { label: 'Al día', color: '#16a34a' }
      if (ultimoDate >= hace24h && ultimo.status === 'pending') return { label: 'Pendiente', color: '#f59e0b' }
      if (ultimoDate >= hace24h) return { label: 'Verificación fallida', color: '#dc2626' }
      return { label: 'En mora', color: '#dc2626' }
    })()

    return {
      id: c.id,
      case_number: c.case_number,
      status: c.status,
      department: c.department ?? '',
      city: c.city ?? '',
      imputado: c.imputado?.full_name ?? 'Sin nombre',
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
