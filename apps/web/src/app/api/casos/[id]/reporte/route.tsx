import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer'
import { dangerLabel } from '@/lib/danger'

export const runtime = 'nodejs'

const ESTADO_LABEL: Record<string, string> = {
  onboarding: 'En configuración', active: 'Activo', suspended: 'Suspendido', closed: 'Cerrado', revoked: 'Revocado',
}
const CHECKIN_LABEL: Record<string, string> = {
  pending: 'Pendiente', missed: 'No realizada', excused: 'Excusada', failed: 'Fallido',
}
const ALERT_TYPE_LABEL: Record<string, string> = {
  gps_out: 'GPS fuera del domicilio', mock_gps: 'GPS simulado', face_fail: 'Verificación facial fallida',
  scene_fail: 'Escena no coincide', missed: 'Verificación no realizada', surprise_missed: 'Sorpresa no atendida',
  escalation: 'Escalamiento — 3 incumplimientos seguidos',
  device_silent: 'Dispositivo sin reportar actividad',
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : '—'

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a2e' },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: '#555', marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 8, borderBottom: '1 solid #ccc', paddingBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: '#555' },
  value: { fontWeight: 700 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 9, color: '#555', marginTop: 2 },
  table: { marginTop: 4 },
  th: { flexDirection: 'row', backgroundColor: '#f0f0f0', paddingVertical: 4, paddingHorizontal: 4, fontWeight: 700 },
  tr: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottom: '0.5 solid #eee' },
  colDate: { width: '18%' },
  colStatus: { width: '14%' },
  colReason: { width: '68%' },
  colAlertDate: { width: '16%' },
  colAlertType: { width: '28%' },
  colAlertMsg: { width: '40%' },
  colAlertResolved: { width: '16%' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 8, color: '#999', textAlign: 'center' },
  pageNumber: { position: 'absolute', bottom: 20, right: 36, fontSize: 8, color: '#999' },
})

const RANGO_LABEL: Record<string, string> = {
  day: 'Último día', week: 'Última semana', month: 'Último mes', all: 'Todo el historial',
}
const RANGO_MS: Record<string, number> = {
  day: 24 * 60 * 60 * 1000, week: 7 * 24 * 60 * 60 * 1000, month: 30 * 24 * 60 * 60 * 1000,
}

function checkinResultado(c: any): string {
  if (c.status === 'excused') return 'Excusada'
  if (c.status === 'missed' || c.status === 'failed') return CHECKIN_LABEL[c.status]
  if (c.status === 'pending') return 'Pendiente'
  return c.overall_passed ? 'Aprobado' : 'Fallido'
}

function ReporteDocument({ caso, checkins, alertas, stats, rangoLabel }: any) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.title}>Informe de Cumplimiento — Arraigo</Text>
        <Text style={styles.subtitle}>Generado el {fmt(new Date().toISOString())} · Periodo: {rangoLabel}</Text>

        <Text style={styles.sectionTitle}>Información del caso</Text>
        {[
          ['Expediente', caso.case_number],
          ['Imputado', caso.imputado_nombre ?? '—'],
          ['Técnico asignado', caso.tecnico_nombre ?? 'Sin asignar'],
          ['Dirección', `${caso.address ?? '—'}, ${caso.city ?? ''}`],
          ['Estado del caso', ESTADO_LABEL[caso.status] ?? caso.status],
          ['Nivel de peligrosidad', `${caso.danger_level ?? 3}/5 · ${dangerLabel(caso.danger_level ?? 3)}`],
          ['Horarios de verificación', (caso.checkin_times ?? []).join(' · ') || '—'],
          ['Radio permitido', `${caso.geofence_radius_m ?? '—'} metros`],
          ['Fecha de inicio', caso.start_date ? fmt(caso.start_date) : '—'],
          ['Última actividad del dispositivo', caso.imputado_last_seen_at ? fmt(caso.imputado_last_seen_at) : 'Sin reportar aún'],
        ].map(([label, value]) => (
          <View style={styles.row} key={label}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Resumen de cumplimiento</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statValue}>{stats.total}</Text><Text style={styles.statLabel}>Total check-ins</Text></View>
          <View style={styles.statBox}><Text style={[styles.statValue, { color: '#16a34a' }]}>{stats.aprobados}</Text><Text style={styles.statLabel}>Aprobados</Text></View>
          <View style={styles.statBox}><Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.fallidos}</Text><Text style={styles.statLabel}>Fallidos</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>{stats.excusados}</Text><Text style={styles.statLabel}>Excusados</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>{stats.porcentaje}</Text><Text style={styles.statLabel}>% Cumplimiento</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Incidentes registrados ({alertas.length})</Text>
        {alertas.length === 0 ? (
          <Text>Sin incidentes registrados.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.th}>
              <Text style={styles.colAlertDate}>Fecha</Text>
              <Text style={styles.colAlertType}>Tipo</Text>
              <Text style={styles.colAlertMsg}>Detalle</Text>
              <Text style={styles.colAlertResolved}>Estado</Text>
            </View>
            {alertas.map((a: any) => (
              <View style={styles.tr} key={a.id} wrap={false}>
                <Text style={styles.colAlertDate}>{fmt(a.created_at)}</Text>
                <Text style={styles.colAlertType}>{ALERT_TYPE_LABEL[a.type] ?? a.type}</Text>
                <Text style={styles.colAlertMsg}>{a.message}</Text>
                <Text style={styles.colAlertResolved}>{a.is_resolved ? 'Resuelta' : 'Pendiente'}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Historial de check-ins ({checkins.length})</Text>
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={styles.colDate}>Fecha</Text>
            <Text style={styles.colStatus}>Resultado</Text>
            <Text style={styles.colReason}>Motivo / nota</Text>
          </View>
          {checkins.map((c: any) => (
            <View style={styles.tr} key={c.id} wrap={false}>
              <Text style={styles.colDate}>{fmt(c.created_at)}</Text>
              <Text style={styles.colStatus}>{checkinResultado(c)}</Text>
              <Text style={styles.colReason}>{c.status === 'excused' ? (c.excused_reason ?? '—') : (c.failure_reason ?? '—')}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>Documento generado automáticamente por el sistema Arraigo — para uso judicial.</Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const rango = searchParams.get('rango') ?? 'all'
  const desde = RANGO_MS[rango] ? new Date(Date.now() - RANGO_MS[rango]) : null
  const cookieStore = await cookies()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles').select('role, organization_id').eq('id', user.id).single()
  if (!me || !['judicial', 'operador', 'super_admin'].includes(me.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: caso } = await supabase
    .from('cases')
    .select(`
      id, case_number, status, danger_level, checkin_times, geofence_radius_m, address, city, start_date, organization_id,
      imputado:profiles!cases_imputado_id_fkey(full_name, last_seen_at),
      tecnico:profiles!cases_technician_id_fkey(full_name)
    `)
    .eq('id', id)
    .single()

  if (!caso) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  if (me.role !== 'super_admin' && (caso as any).organization_id !== me.organization_id) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  let checkinsQuery = supabase
    .from('checkins')
    .select('id, status, overall_passed, created_at, failure_reason, excused_reason')
    .eq('case_id', id)
    .order('created_at', { ascending: false })
  if (desde) checkinsQuery = checkinsQuery.gte('created_at', desde.toISOString())
  const { data: checkins } = await checkinsQuery

  let alertasQuery = supabase
    .from('alerts')
    .select('id, severity, type, message, created_at, is_resolved')
    .eq('case_id', id)
    .order('created_at', { ascending: false })
  if (desde) alertasQuery = alertasQuery.gte('created_at', desde.toISOString())
  const { data: alertas } = await alertasQuery

  const rows = checkins ?? []
  const isPassed = (c: any) => c.status === 'completed' && c.overall_passed
  const isFailed = (c: any) => c.status === 'failed' || c.status === 'missed' || (c.status === 'completed' && c.overall_passed === false)
  const isExcused = (c: any) => c.status === 'excused'

  const total = rows.length
  const aprobados = rows.filter(isPassed).length
  const fallidos = rows.filter(isFailed).length
  const excusados = rows.filter(isExcused).length
  const denom = total - excusados
  const porcentaje = denom > 0 ? `${Math.round((aprobados / denom) * 100)}%` : 'N/A'

  const casoPlano = {
    ...caso,
    imputado_nombre: (caso as any).imputado?.full_name,
    imputado_last_seen_at: (caso as any).imputado?.last_seen_at,
    tecnico_nombre: (caso as any).tecnico?.full_name,
  }

  const pdfBuffer = await renderToBuffer(
    <ReporteDocument
      caso={casoPlano}
      checkins={rows}
      alertas={alertas ?? []}
      stats={{ total, aprobados, fallidos, excusados, porcentaje }}
      rangoLabel={RANGO_LABEL[rango] ?? RANGO_LABEL.all}
    />
  )

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-${caso.case_number}-${rango}.pdf"`,
    },
  })
}
