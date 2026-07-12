import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getStats() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const [{ count: totalCasos }, { count: checkinHoy }, { count: alertas }] = await Promise.all([
    supabase.from('cases').select('*', { count: 'exact', head: true }),
    supabase.from('checkins').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0]),
    supabase.from('checkins').select('*', { count: 'exact', head: true })
      .eq('status', 'failed'),
  ])
  return { totalCasos: totalCasos ?? 0, checkinHoy: checkinHoy ?? 0, alertas: alertas ?? 0 }
}

export default async function DashboardPage() {
  const stats = await getStats()

  const cards = [
    { label: 'Casos activos', value: stats.totalCasos, icon: '📋', color: 'var(--accent)' },
    { label: 'Check-ins hoy', value: stats.checkinHoy, icon: '✅', color: 'var(--success)' },
    { label: 'Alertas pendientes', value: stats.alertas, icon: '🚨', color: 'var(--danger)' },
  ]

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Dashboard</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 14 }}>
        Resumen operativo — {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 40 }}>
        {cards.map(card => (
          <div key={card.label} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>{card.label}</p>
                <p style={{ fontSize: 36, fontWeight: 700, color: card.color }}>{card.value}</p>
              </div>
              <span style={{ fontSize: 28 }}>{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Actividad reciente</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Ve a <strong style={{ color: 'var(--text)' }}>Casos</strong> para ver los check-ins detallados por imputado.
        </p>
      </div>
    </div>
  )
}
