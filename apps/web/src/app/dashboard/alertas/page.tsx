import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import AlertasLista from './AlertasLista'

export const dynamic = 'force-dynamic'

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
    .limit(500)
  return (data ?? []).map((a: any) => ({
    id: a.id,
    severity: a.severity,
    type: a.type,
    message: a.message,
    created_at: a.created_at,
    caseId: a.cases?.id ?? null,
    caseNumber: a.cases?.case_number ?? null,
    imputado: a.cases?.imputado?.full_name ?? null,
  }))
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
        <AlertasLista alertas={alertas} />
      )}
    </div>
  )
}
