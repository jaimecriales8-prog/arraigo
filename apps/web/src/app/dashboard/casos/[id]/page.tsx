import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SorpresaButton from '@/components/SorpresaButton'

const STATUS_COLOR: Record<string, string> = {
  passed: 'var(--success)',
  failed: 'var(--danger)',
  pending: 'var(--warning)',
}
const STATUS_LABEL: Record<string, string> = {
  passed: 'Aprobado',
  failed: 'Fallido',
  pending: 'Pendiente',
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
      id, case_number, status, checkin_frequency_hours, home_lat, home_lng, home_radius_m,
      imputado:profiles!cases_imputado_id_fkey(full_name, email),
      checkins(id, status, gps_lat, gps_lng, gps_accuracy_m, gps_is_mock, face_score, scene_score, created_at)
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
  const passed = checkins.filter((c: any) => c.status === 'passed').length
  const failed = checkins.filter((c: any) => c.status === 'failed').length

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/dashboard/casos" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>
          ← Volver a casos
        </Link>
        <SorpresaButton caseId={caso.id} />
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
              ['Correo', (caso.imputado as any)?.email ?? '—'],
              ['Frecuencia', `Cada ${caso.checkin_frequency_hours}h`],
              ['Ubicación', caso.home_lat ? `${caso.home_lat.toFixed(4)}, ${caso.home_lng?.toFixed(4)}` : '—'],
              ['Radio permitido', `${caso.home_radius_m}m`],
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
              {['Fecha', 'Estado', 'GPS', 'Mock', 'Cara', 'Escena'].map(h => (
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
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Sin check-ins aún.</td></tr>
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
                <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text-muted)' }}>
                  {c.gps_lat ? `${c.gps_lat.toFixed(4)}, ${c.gps_lng?.toFixed(4)}` : '—'}
                  {c.gps_accuracy_m ? ` ±${Math.round(c.gps_accuracy_m)}m` : ''}
                </td>
                <td style={{ padding: '14px 20px', fontSize: 13 }}>
                  {c.gps_is_mock ? <span style={{ color: 'var(--danger)' }}>⚠️ Sí</span> : <span style={{ color: 'var(--success)' }}>No</span>}
                </td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: c.face_score >= 0.8 ? 'var(--success)' : 'var(--text-muted)' }}>
                  {c.face_score != null ? `${(c.face_score * 100).toFixed(0)}%` : '—'}
                </td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: c.scene_score >= 0.82 ? 'var(--success)' : 'var(--text-muted)' }}>
                  {c.scene_score != null ? `${(c.scene_score * 100).toFixed(0)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
