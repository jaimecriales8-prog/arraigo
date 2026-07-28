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
  page: { padding: 0, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1a1a2e' },
  body: { padding: '0 36 36 36' },
  headerBar: { backgroundColor: '#0a1628', paddingVertical: 14, paddingHorizontal: 36 },
  title: { fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 3 },
  subtitle: { fontSize: 9.5, color: '#9db2d0' },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 10, color: '#0a1628' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statCard: {
    width: '23%', borderRadius: 6, border: '1 solid #e2e5ea', backgroundColor: '#f8f9fb',
    paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center',
  },
  statValue: { fontSize: 19, fontWeight: 700 },
  statLabel: { fontSize: 7.5, color: '#666', marginTop: 3, textAlign: 'center' },
  table: { marginTop: 4, borderRadius: 6, overflow: 'hidden', border: '1 solid #e2e5ea' },
  th: { flexDirection: 'row', backgroundColor: '#0a1628', paddingVertical: 7, paddingHorizontal: 8 },
  thText: { color: '#fff', fontWeight: 700, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.3 },
  tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottom: '0.5 solid #e2e5ea' },
  trAlt: { backgroundColor: '#f8f9fb' },
  colExp: { width: '13%', paddingRight: 6, fontWeight: 700 },
  colImp: { width: '18%', paddingRight: 6 },
  colUbi: { width: '22%', paddingRight: 6 },
  colPel: { width: '13%', paddingRight: 6 },
  colEst: { width: '10%', paddingRight: 6 },
  colChk: { width: '11%', paddingRight: 6 },
  colCump: { width: '13%', fontWeight: 700 },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 8, color: '#999', textAlign: 'center' },
  pageNumber: { position: 'absolute', bottom: 20, right: 36, fontSize: 8, color: '#999' },
})

const cumplimientoColor = (pct: string) => {
  const n = parseInt(pct, 10)
  if (Number.isNaN(n)) return '#666'
  if (n >= 80) return '#16a34a'
  if (n >= 50) return '#d97706'
  return '#dc2626'
}

function ReporteConsolidadoDocument({ orgNombre, rangoLabel, stats, casos }: any) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.headerBar}>
          <Text style={styles.title}>Informe Consolidado — Arraigo</Text>
          <Text style={styles.subtitle}>
            {orgNombre ? `${orgNombre} · ` : ''}Generado el {fmt(new Date().toISOString())} · Periodo: {rangoLabel}
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Resumen general</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}><Text style={styles.statValue}>{stats.totalCasos}</Text><Text style={styles.statLabel}>CASOS TOTALES</Text></View>
            <View style={styles.statCard}><Text style={[styles.statValue, { color: '#16a34a' }]}>{stats.casosActivos}</Text><Text style={styles.statLabel}>ACTIVOS</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{stats.totalCheckins}</Text><Text style={styles.statLabel}>CHECK-INS DEL PERIODO</Text></View>
            <View style={styles.statCard}><Text style={[styles.statValue, { color: cumplimientoColor(stats.porcentaje) }]}>{stats.porcentaje}</Text><Text style={styles.statLabel}>% CUMPLIMIENTO</Text></View>
            <View style={styles.statCard}><Text style={[styles.statValue, { color: '#16a34a' }]}>{stats.aprobados}</Text><Text style={styles.statLabel}>APROBADOS</Text></View>
            <View style={styles.statCard}><Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.fallidos}</Text><Text style={styles.statLabel}>FALLIDOS</Text></View>
            <View style={styles.statCard}><Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.alertasCriticas}</Text><Text style={styles.statLabel}>ALERTAS CRÍTICAS</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{stats.alertasTotal}</Text><Text style={styles.statLabel}>ALERTAS SIN RESOLVER</Text></View>
          </View>

          <Text style={styles.sectionTitle}>Casos ({casos.length})</Text>
          <View style={styles.table}>
            <View style={styles.th} fixed>
              <Text style={[styles.colExp, styles.thText]}>Expediente</Text>
              <Text style={[styles.colImp, styles.thText]}>Imputado</Text>
              <Text style={[styles.colUbi, styles.thText]}>Ubicación</Text>
              <Text style={[styles.colPel, styles.thText]}>Peligros.</Text>
              <Text style={[styles.colEst, styles.thText]}>Estado</Text>
              <Text style={[styles.colChk, styles.thText]}>Check-ins</Text>
              <Text style={[styles.colCump, styles.thText]}>Cumplim.</Text>
            </View>
            {casos.map((c: any, i: number) => (
              <View style={[styles.tr, ...(i % 2 === 1 ? [styles.trAlt] : [])]} key={c.id} wrap={false}>
                <Text style={styles.colExp}>{c.case_number}</Text>
                <Text style={styles.colImp}>{c.imputado}</Text>
                <Text style={styles.colUbi}>{c.city}{c.department ? `, ${c.department}` : ''}</Text>
                <Text style={styles.colPel}>{c.danger_level}/5 · {dangerLabel(c.danger_level)}</Text>
                <Text style={styles.colEst}>{ESTADO_LABEL[c.status] ?? c.status}</Text>
                <Text style={styles.colChk}>{c.totalCheckins} ({c.aprobados}/{c.fallidos})</Text>
                <Text style={[styles.colCump, { color: cumplimientoColor(c.porcentaje) }]}>{c.porcentaje}</Text>
              </View>
            ))}
          </View>
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
  if (!me || !['judicial', 'operador', 'super_admin'].includes(me.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  let casosQuery = supabase
    .from('cases')
    .select(`
      id, case_number, status, department, city, danger_level, organization_id,
      imputado:profiles!cases_imputado_id_fkey(full_name)
    `)
    .order('case_number', { ascending: true })
  if (me.role !== 'super_admin') casosQuery = casosQuery.eq('organization_id', me.organization_id)
  const { data: casosRaw } = await casosQuery

  let orgNombre: string | null = null
  if (me.role !== 'super_admin') {
    const { data: org } = await supabase
      .from('organizations').select('name').eq('id', me.organization_id).single()
    orgNombre = org?.name ?? null
  }

  // Agregación en SQL (reporte_consolidado_stats) — antes se traía cada
  // check-in y cada alerta cruda de todos los casos de la org al servidor
  // de Next.js para sumarlos en JS. Con 50k casos y meses de historial,
  // eso son millones de filas por request; ahora Postgres devuelve una
  // fila resumen por caso.
  const { data: statsRaw } = await supabase.rpc('reporte_consolidado_stats', {
    p_organization_id: me.role === 'super_admin' ? null : me.organization_id,
    p_desde: desde ? desde.toISOString() : null,
  })
  const statsPorCaso = new Map((statsRaw ?? []).map((s: any) => [s.case_id, s]))

  const casos = (casosRaw ?? []).map((c: any) => {
    const s: any = statsPorCaso.get(c.id) ?? {}
    const total = Number(s.total_checkins ?? 0)
    const aprobados = Number(s.aprobados ?? 0)
    const fallidos = Number(s.fallidos ?? 0)
    const excusados = Number(s.excusados ?? 0)
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
      alertasTotal: Number(s.alertas_total ?? 0),
      alertasCriticas: Number(s.alertas_criticas ?? 0),
    }
  })

  const totalCasos = casos.length
  const casosActivos = casos.filter(c => c.status === 'active').length
  const totalCheckins = casos.reduce((s, c) => s + c.totalCheckins, 0)
  const aprobados = casos.reduce((s, c) => s + c.aprobados, 0)
  const fallidos = casos.reduce((s, c) => s + c.fallidos, 0)
  const excusadosTotal = Array.from(statsPorCaso.values())
    .reduce((s: number, x: any) => s + Number(x.excusados ?? 0), 0)
  const denomTotal = totalCheckins - excusadosTotal
  const porcentaje = denomTotal > 0 ? `${Math.round((aprobados / denomTotal) * 100)}%` : 'N/A'
  const alertasTotal = casos.reduce((s, c) => s + c.alertasTotal, 0)
  const alertasCriticas = casos.reduce((s, c) => s + c.alertasCriticas, 0)

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
