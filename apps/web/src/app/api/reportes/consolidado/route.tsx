import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { dangerLabel } from '@/lib/danger'

export const runtime = 'nodejs'

const ESTADO_LABEL: Record<string, string> = {
  onboarding: 'En configuración', active: 'Activo', suspended: 'Suspendido', closed: 'Cerrado', revoked: 'Revocado',
}
const RANGO_LABEL: Record<string, string> = {
  day: 'Último día', month: 'Último mes', year: 'Último año', all: 'Todo el historial',
}
const RANGO_MS: Record<string, number> = {
  day: 24 * 60 * 60 * 1000, month: 30 * 24 * 60 * 60 * 1000, year: 365 * 24 * 60 * 60 * 1000,
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : '—'

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1a1a2e' },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: '#555', marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 8, borderBottom: '1 solid #ccc', paddingBottom: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12, flexWrap: 'wrap' },
  statBox: { alignItems: 'center', minWidth: 80, marginVertical: 4 },
  statValue: { fontSize: 20, fontWeight: 700 },
  statLabel: { fontSize: 8.5, color: '#555', marginTop: 2, textAlign: 'center' },
  table: { marginTop: 4 },
  th: { flexDirection: 'row', backgroundColor: '#f0f0f0', paddingVertical: 4, paddingHorizontal: 4, fontWeight: 700 },
  tr: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottom: '0.5 solid #eee' },
  colExp: { width: '16%' },
  colImp: { width: '20%' },
  colUbi: { width: '18%' },
  colPel: { width: '10%' },
  colEst: { width: '12%' },
  colChk: { width: '10%' },
  colCump: { width: '14%' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 8, color: '#999', textAlign: 'center' },
  pageNumber: { position: 'absolute', bottom: 20, right: 36, fontSize: 8, color: '#999' },
})

function ReporteConsolidadoDocument({ orgNombre, rangoLabel, stats, casos }: any) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.title}>Informe Consolidado — Arraigo</Text>
        <Text style={styles.subtitle}>
          {orgNombre ? `${orgNombre} · ` : ''}Generado el {fmt(new Date().toISOString())} · Periodo: {rangoLabel}
        </Text>

        <Text style={styles.sectionTitle}>Resumen general</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statValue}>{stats.totalCasos}</Text><Text style={styles.statLabel}>Casos totales</Text></View>
          <View style={styles.statBox}><Text style={[styles.statValue, { color: '#16a34a' }]}>{stats.casosActivos}</Text><Text style={styles.statLabel}>Activos</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>{stats.totalCheckins}</Text><Text style={styles.statLabel}>Check-ins del periodo</Text></View>
          <View style={styles.statBox}><Text style={[styles.statValue, { color: '#16a34a' }]}>{stats.aprobados}</Text><Text style={styles.statLabel}>Aprobados</Text></View>
          <View style={styles.statBox}><Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.fallidos}</Text><Text style={styles.statLabel}>Fallidos</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>{stats.porcentaje}</Text><Text style={styles.statLabel}>% Cumplimiento</Text></View>
          <View style={styles.statBox}><Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.alertasCriticas}</Text><Text style={styles.statLabel}>Alertas críticas sin resolver</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>{stats.alertasTotal}</Text><Text style={styles.statLabel}>Alertas sin resolver</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Casos ({casos.length})</Text>
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={styles.colExp}>Expediente</Text>
            <Text style={styles.colImp}>Imputado</Text>
            <Text style={styles.colUbi}>Ubicación</Text>
            <Text style={styles.colPel}>Peligros.</Text>
            <Text style={styles.colEst}>Estado</Text>
            <Text style={styles.colChk}>Check-ins</Text>
            <Text style={styles.colCump}>Cumplimiento</Text>
          </View>
          {casos.map((c: any) => (
            <View style={styles.tr} key={c.id} wrap={false}>
              <Text style={styles.colExp}>{c.case_number}</Text>
              <Text style={styles.colImp}>{c.imputado}</Text>
              <Text style={styles.colUbi}>{c.city}{c.department ? `, ${c.department}` : ''}</Text>
              <Text style={styles.colPel}>{c.danger_level}/5 · {dangerLabel(c.danger_level)}</Text>
              <Text style={styles.colEst}>{ESTADO_LABEL[c.status] ?? c.status}</Text>
              <Text style={styles.colChk}>{c.totalCheckins} ({c.aprobados}/{c.fallidos})</Text>
              <Text style={styles.colCump}>{c.porcentaje}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>Documento generado automáticamente por el sistema Arraigo — para uso judicial.</Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

export async function GET(req: Request) {
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
  if (!me) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let casosQuery = supabase
    .from('cases')
    .select(`
      id, case_number, status, department, city, danger_level, organization_id,
      imputado:profiles!cases_imputado_id_fkey(full_name)
    `)
    .order('case_number', { ascending: true })
  if (me.role !== 'super_admin') casosQuery = casosQuery.eq('organization_id', me.organization_id)
  const { data: casosRaw } = await casosQuery

  const orgNombre: string | null = null

  const casoIds = (casosRaw ?? []).map((c: any) => c.id)

  let checkinsQuery = supabase
    .from('checkins')
    .select('id, case_id, status, overall_passed, created_at')
    .in('case_id', casoIds.length > 0 ? casoIds : ['00000000-0000-0000-0000-000000000000'])
  if (desde) checkinsQuery = checkinsQuery.gte('created_at', desde.toISOString())
  const { data: checkinsRaw } = await checkinsQuery

  let alertasQuery = supabase
    .from('alerts')
    .select('id, case_id, severity, is_resolved')
    .in('case_id', casoIds.length > 0 ? casoIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('is_resolved', false)
  const { data: alertasRaw } = await alertasQuery

  const isPassed = (c: any) => (c.status === 'completed' || c.status === 'passed') && c.overall_passed
  const isFailed = (c: any) => c.status === 'failed' || c.status === 'missed' ||
    ((c.status === 'completed' || c.status === 'passed') && c.overall_passed === false)
  const isExcused = (c: any) => c.status === 'excused'

  const checkinsPorCaso = new Map<string, any[]>()
  for (const chk of checkinsRaw ?? []) {
    if (!checkinsPorCaso.has(chk.case_id)) checkinsPorCaso.set(chk.case_id, [])
    checkinsPorCaso.get(chk.case_id)!.push(chk)
  }
  const alertasPorCaso = new Map<string, any[]>()
  for (const a of alertasRaw ?? []) {
    if (!alertasPorCaso.has(a.case_id)) alertasPorCaso.set(a.case_id, [])
    alertasPorCaso.get(a.case_id)!.push(a)
  }

  const casos = (casosRaw ?? []).map((c: any) => {
    const chks = checkinsPorCaso.get(c.id) ?? []
    const total = chks.length
    const aprobados = chks.filter(isPassed).length
    const fallidos = chks.filter(isFailed).length
    const excusados = chks.filter(isExcused).length
    const denom = total - excusados
    const porcentaje = denom > 0 ? `${Math.round((aprobados / denom) * 100)}%` : 'N/A'
    return {
      id: c.id,
      case_number: c.case_number,
      status: c.status,
      department: c.department ?? '',
      city: c.city ?? '—',
      danger_level: c.danger_level ?? 3,
      imputado: c.imputado?.full_name ?? 'Sin nombre',
      totalCheckins: total,
      aprobados,
      fallidos,
      porcentaje,
    }
  })

  const totalCasos = casos.length
  const casosActivos = casos.filter(c => c.status === 'active').length
  const totalCheckins = casos.reduce((s, c) => s + c.totalCheckins, 0)
  const aprobados = casos.reduce((s, c) => s + c.aprobados, 0)
  const fallidos = casos.reduce((s, c) => s + c.fallidos, 0)
  const excusadosTotal = (checkinsRaw ?? []).filter(isExcused).length
  const denomTotal = totalCheckins - excusadosTotal
  const porcentaje = denomTotal > 0 ? `${Math.round((aprobados / denomTotal) * 100)}%` : 'N/A'
  const alertasTotal = (alertasRaw ?? []).length
  const alertasCriticas = (alertasRaw ?? []).filter((a: any) => a.severity === 'critical').length

  const pdfBuffer = await renderToBuffer(
    <ReporteConsolidadoDocument
      orgNombre={orgNombre}
      rangoLabel={RANGO_LABEL[rango] ?? RANGO_LABEL.all}
      stats={{ totalCasos, casosActivos, totalCheckins, aprobados, fallidos, porcentaje, alertasTotal, alertasCriticas }}
      casos={casos}
    />
  )

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-consolidado-${rango}.pdf"`,
    },
  })
}
