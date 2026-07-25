import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SorpresaButton from '@/components/SorpresaButton'
import ReasignarTecnico from './ReasignarTecnico'
import HistorialTabla from './HistorialTabla'

// Conteos para las estadísticas (un check-in completed con overall_passed=false es FALLIDO).
const isPassed = (c: any) => (c.status === 'completed' || c.status === 'passed') && c.overall_passed
const isFailed = (c: any) => c.status === 'failed' || c.status === 'missed' ||
  ((c.status === 'completed' || c.status === 'passed') && c.overall_passed === false)

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
      technician_id, organization_id,
      imputado:profiles!cases_imputado_id_fkey(full_name),
      tecnico:profiles!cases_technician_id_fkey(full_name),
      checkins(id, status, overall_passed, created_at),
      surprise_verifications(id, status, created_at, expires_at, checkins(overall_passed))
    `)
    .eq('id', id)
    .single()

  if (!caso) return null

  // Rol del usuario actual + técnicos de la org (para reasignar)
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  const { data: me } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const puedeReasignar = ['judicial', 'super_admin'].includes(me?.role ?? '')

  const { data: tecnicos } = puedeReasignar
    ? await supabase.from('profiles').select('id, full_name')
        .in('role', ['tecnico', 'technician'])
        .eq('organization_id', (caso as any).organization_id).order('full_name')
    : { data: [] }

  return { ...caso, _tecnicos: tecnicos ?? [], _puedeReasignar: puedeReasignar }
}

export default async function CasoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caso = await getCaso(id)
  if (!caso) notFound()

  const checkins = (caso.checkins ?? []).sort((a: any, b: any) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const passed = checkins.filter(isPassed).length
  const failed = checkins.filter(isFailed).length

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/dashboard/casos" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>
          ← Volver a casos
        </Link>
      </div>

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Información del caso
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Expediente', caso.case_number],
              ['Imputado', (caso.imputado as any)?.full_name ?? '—'],
              ['Técnico', (caso as any).tecnico?.full_name ?? 'Sin asignar'],
              ['Dirección', `${(caso as any).address ?? '—'}, ${(caso as any).city ?? ''}`],
              ['Horarios', ((caso as any).checkin_times ?? []).join(' · ') || '—'],
              ['Radio permitido', `${(caso as any).geofence_radius_m ?? '—'}m`],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>
          {(caso as any)._puedeReasignar && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reasignar técnico
              </span>
              <ReasignarTecnico
                caseId={caso.id}
                tecnicos={(caso as any)._tecnicos}
                current={(caso as any).technician_id ?? null}
              />
            </div>
          )}
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
        <HistorialTabla kind="checkin" rows={checkins.map((c: any) => ({
          id: c.id, status: c.status, created_at: c.created_at, overall_passed: c.overall_passed,
        }))} />
      </div>

      {/* Verificaciones sorpresa */}
      {(() => {
        const sorpresas = ((caso as any).surprise_verifications ?? [])
          .slice()
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map((s: any) => ({
            id: s.id, status: s.status, created_at: s.created_at, expires_at: s.expires_at,
            checkin_overall_passed: s.checkins?.overall_passed ?? null,
          }))
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginTop: 20 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Verificaciones sorpresa</h2>
              <SorpresaButton caseId={caso.id} />
            </div>
            <HistorialTabla kind="surprise" rows={sorpresas} />
          </div>
        )
      })()}
    </div>
  )
}
