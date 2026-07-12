import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  suspended: 'Suspendido',
  closed: 'Cerrado',
}
const STATUS_COLOR: Record<string, string> = {
  active: 'var(--success)',
  suspended: 'var(--warning)',
  closed: 'var(--text-muted)',
}

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
    .select('id, case_number, status, checkin_times, address, city, imputado:profiles!cases_imputado_id_fkey(full_name), checkins(id,status,created_at)')
    .order('created_at', { ascending: false })

  if (error) console.error('[casos] error:', error.message)
  return { casos: data ?? [], role: profile?.role ?? '' }
}

export default async function CasosPage() {
  const { casos, role } = await getCasos()
  const puedeCrear = ['judicial', 'super_admin'].includes(role)

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

      <div className="table-scroll" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Expediente', 'Imputado', 'Estado', 'Cumplimiento', 'Check-ins', 'Último check-in', 'Acciones'].map(h => (
                <th key={h} style={{
                  padding: '14px 20px', textAlign: 'left',
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {casos.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay casos registrados aún.
                </td>
              </tr>
            )}
            {casos.map((caso: any, i: number) => {
              const checkins = caso.checkins ?? []
              const ultimo = checkins
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

              // Calcular cumplimiento: ver si el checkin más reciente fue dentro de las últimas 24h
              const cumplimiento = (() => {
                if (caso.status !== 'active') return null
                if (!ultimo) return { label: 'Sin check-ins', color: 'var(--warning)' }
                const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
                const ultimoDate = new Date(ultimo.created_at)
                if (ultimoDate >= hace24h && (ultimo.status === 'completed' || ultimo.status === 'passed')) return { label: 'Al día', color: 'var(--success)' }
                if (ultimoDate >= hace24h && ultimo.status === 'pending') return { label: 'Pendiente', color: 'var(--warning)' }
                return { label: 'En mora', color: 'var(--danger)' }
              })()

              return (
                <tr key={caso.id} style={{
                  borderBottom: i < casos.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.15s',
                }}>
                  <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontSize: 13 }}>
                    {caso.case_number}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 14, fontWeight: 500 }}>
                    {caso.imputado?.full_name ?? '—'}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      background: STATUS_COLOR[caso.status] + '22',
                      color: STATUS_COLOR[caso.status],
                    }}>
                      {STATUS_LABEL[caso.status] ?? caso.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {cumplimiento ? (
                      <span style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: cumplimiento.color + '22', color: cumplimiento.color,
                      }}>{cumplimiento.label}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 14, color: 'var(--text-muted)' }}>
                    {checkins.length}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                    {ultimo ? new Date(ultimo.created_at).toLocaleString('es-CO', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota'
                    }) : '—'}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <Link href={`/dashboard/casos/${caso.id}`} style={{
                      padding: '6px 14px',
                      background: 'var(--bg-card2)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      color: 'var(--text)',
                      fontSize: 13,
                      textDecoration: 'none',
                    }}>
                      Ver →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
