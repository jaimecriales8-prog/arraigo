import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'

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
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data } = await supabase
    .from('cases')
    .select(`
      id, case_number, status, checkin_frequency_hours, home_lat, home_lng,
      imputado:profiles!cases_imputado_id_fkey(full_name),
      checkins(id, status, created_at)
    `)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function CasosPage() {
  const casos = await getCasos()

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Casos</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 14 }}>
        {casos.length} caso{casos.length !== 1 ? 's' : ''} registrado{casos.length !== 1 ? 's' : ''}
      </p>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Expediente', 'Imputado', 'Estado', 'Check-ins', 'Último check-in', 'Acciones'].map(h => (
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
              const ultimo = checkins.sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0]
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
                  <td style={{ padding: '16px 20px', fontSize: 14, color: 'var(--text-muted)' }}>
                    {checkins.length}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                    {ultimo ? new Date(ultimo.created_at).toLocaleString('es-CO', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
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
