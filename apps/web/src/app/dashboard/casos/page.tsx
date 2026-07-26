import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import CasosLista from './CasosLista'

export const dynamic = 'force-dynamic'

async function getCasos() {
  const cookieStore = await cookies()
  // Anon client con sesión del usuario — RLS filtra por org automáticamente
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }

  const { data, error } = await supabase
    .from('cases')
    .select('id, case_number, status, danger_level, checkin_times, address, city, imputado:profiles!cases_imputado_id_fkey(full_name), checkins(id,status,overall_passed,created_at)')
    .order('created_at', { ascending: false })

  if (error) console.error('[casos] error:', error.message)
  return { casos: data ?? [], role: profile?.role ?? '' }
}

export default async function CasosPage() {
  const { casos: casosRaw, role } = await getCasos()
  const puedeCrear = ['judicial', 'super_admin'].includes(role)

  const casos = casosRaw.map((c: any) => {
    const checkins = c.checkins ?? []
    const ultimo = checkins
      .slice()
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null

    const cumplimiento = (() => {
      if (c.status !== 'active') return null
      if (!ultimo) return { label: 'Sin check-ins', color: 'var(--warning)' }
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const ultimoDate = new Date(ultimo.created_at)
      const aprobado = (ultimo.status === 'completed' || ultimo.status === 'passed') && ultimo.overall_passed
      if (ultimoDate >= hace24h && aprobado) return { label: 'Al día', color: 'var(--success)' }
      if (ultimoDate >= hace24h && ultimo.status === 'pending') return { label: 'Pendiente', color: 'var(--warning)' }
      if (ultimoDate >= hace24h) return { label: 'Verificación fallida', color: 'var(--danger)' }
      return { label: 'En mora', color: 'var(--danger)' }
    })()

    return {
      id: c.id,
      case_number: c.case_number,
      status: c.status,
      danger_level: c.danger_level ?? 3,
      imputado: c.imputado?.full_name ?? '—',
      checkinsCount: checkins.length,
      ultimo,
      cumplimiento,
    }
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Casos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {casos.length} caso{casos.length !== 1 ? 's' : ''} registrado{casos.length !== 1 ? 's' : ''}
          </p>
        </div>
        {puedeCrear && (
          <Link href="/dashboard/casos/nuevo" style={{
            padding: '10px 18px', background: 'var(--accent)', color: '#fff',
            borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            + Nuevo caso
          </Link>
        )}
      </div>

      <CasosLista casos={casos} />
    </div>
  )
}
