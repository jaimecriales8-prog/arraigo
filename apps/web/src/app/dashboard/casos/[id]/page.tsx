import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SorpresaButton from '@/components/SorpresaButton'

const STATUS_COLOR: Record<string, string> = {
  completed: 'var(--success)',
  passed: 'var(--success)',
  failed: 'var(--danger)',
  pending: 'var(--warning)',
}
const STATUS_LABEL: Record<string, string> = {
  completed: 'Aprobado',
  passed: 'Aprobado',
  failed: 'Fallido',
  pending: 'Pendiente',
}
const SORPRESA_COLOR: Record<string, string> = {
  pending: 'var(--warning)',
  completed: 'var(--success)',
  expired: 'var(--danger)',
}
const SORPRESA_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  completed: 'Completada',
  expired: 'Incumplida',
}

async function getCaso(id: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: caso } = await supabase
    .from('cases')
    .select(`
      id, case_number, status, checkin_times, geofence_radius_m, address, city,
      imputado:profiles!cases_imputado_id_fkey(full_name),
      checkins(id, status, created_at),
      surprise_verifications(id, status, created_at, expires_at)
    `)
    .eq('id', id)
    .single()
  return caso
}

export default async function CasoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caso = await getCaso(id)
  if (!caso) notFound()

  const checkins = (caso.checkins ?? []).sort((a: any, b: any) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const passed = checkins.filter((c: any) => c.status === 'completed' || c.status === 'passed').length
  const failed = checkins.filter((c: any) => c.status === 'failed').length

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/dashboard/casos" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>
          ← Volver a casos
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Información del caso
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Expediente', caso.case_number],
              ['Imputado', (caso.imputado as any)?.full_name ?? '—'],
              ['Dirección', `${(caso as any).address ?? '—'}, ${(caso as any).city ?? ''}`],
              ['Horarios', ((caso as any).checkin_times ?? []).join(' · ') || '—'],
              ['Radio permitido', `${(caso as any).geofence_radius_m ?? '—'}m`],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Estadísticas
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Total', value: checkins.length, color: 'var(--accent)' },
              { label: 'Aprobados', value: passed, color: 'var(--success)' },
              { label: 'Fallidos', value: failed, color: 'var(--danger)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Historial de check-ins</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Fecha', 'Estado'].map(h => (
                <th key={h} style={{
                  padding: '12px 20px', textAlign: 'left',
                  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checkins.length === 0 && (
              <tr><td colSpan={2} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Sin check-ins aún.</td></tr>
            )}
            {checkins.map((c: any, i: number) => (
              <tr key={c.id} style={{ borderBottom: i < checkins.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '14px 20px', fontSize: 13 }}>
                  {new Date(c.created_at).toLocaleString('es-CO', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: (STATUS_COLOR[c.status] ?? 'var(--text-muted)') + '22',
                    color: STATUS_COLOR[c.status] ?? 'var(--text-muted)',
                  }}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Verificaciones sorpresa */}
      {(() => {
        const sorpresas = ((caso as any).surprise_verifications ?? []).sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginTop: 20 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Verificaciones sorpresa</h2>
              <SorpresaButton caseId={caso.id} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Enviada', 'Expira', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorpresas.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Sin verificaciones sorpresa aún.</td></tr>
                )}
                {sorpresas.map((s: any, i: number) => (
                  <tr key={s.id} style={{ borderBottom: i < sorpresas.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '14px 20px', fontSize: 13 }}>
                      {new Date(s.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {new Date(s.expires_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: (SORPRESA_COLOR[s.status] ?? 'var(--text-muted)') + '22', color: SORPRESA_COLOR[s.status] ?? 'var(--text-muted)' }}>
                        {SORPRESA_LABEL[s.status] ?? s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })()}
    </div>
  )
}
