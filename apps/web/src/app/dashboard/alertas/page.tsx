import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import ResolverAlerta from './ResolverAlerta'

export const dynamic = 'force-dynamic'

const SEV: Record<string, { label: string; color: string }> = {
  critical: { label: 'Crítica', color: 'var(--danger)' },
  warning: { label: 'Advertencia', color: 'var(--warning)' },
  info: { label: 'Info', color: 'var(--accent)' },
}
const TIPO: Record<string, string> = {
  gps_out: 'GPS fuera del domicilio',
  mock_gps: 'GPS simulado',
  face_fail: 'Verificación facial fallida',
  scene_fail: 'Escena no coincide',
  missed: 'Verificación no realizada',
  surprise_missed: 'Sorpresa no atendida',
}

async function getAlertas() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data } = await supabase
    .from('alerts')
    .select('id, severity, type, message, created_at, cases(id, case_number, imputado:profiles!cases_imputado_id_fkey(full_name))')
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })
    .limit(200)
  return data ?? []
}

export default async function AlertasPage() {
  const alertas = await getAlertas()

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Alertas</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
        {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} sin resolver
      </p>

      {alertas.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          ✓ No hay alertas pendientes.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alertas.map((a: any) => {
            const sev = SEV[a.severity] ?? { label: a.severity, color: 'var(--text-muted)' }
            const imputado = a.cases?.imputado?.full_name ?? '—'
            return (
              <div key={a.id} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderLeft: `3px solid ${sev.color}`, borderRadius: 12, padding: '16px 18px',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: sev.color + '22', color: sev.color, textTransform: 'uppercase', letterSpacing: '.04em',
                    }}>{sev.label}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{TIPO[a.type] ?? a.type}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text)', marginBottom: 4 }}>{a.message}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {a.cases?.case_number ? (
                      <>Exp. <Link href={`/dashboard/casos/${a.cases.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{a.cases.case_number}</Link> · {imputado} · </>
                    ) : null}
                    {new Date(a.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
                  </div>
                </div>
                <ResolverAlerta alertId={a.id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
