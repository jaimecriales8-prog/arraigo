import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import CrearCasoForm from './CrearCasoForm'

export const dynamic = 'force-dynamic'

async function getData() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  // Solo judicial (o super_admin) registra casos
  if (!profile || !['judicial', 'super_admin'].includes(profile.role)) {
    redirect('/dashboard/casos')
  }

  // Imputados de la org SIN caso activo/en onboarding
  const { data: imputados } = await supabase
    .from('profiles')
    .select('id, full_name, cases:cases!cases_imputado_id_fkey(id, status)')
    .eq('role', 'imputado')
    .eq('organization_id', profile.organization_id)
    .order('full_name')

  const disponibles = (imputados ?? [])
    .filter((i: any) => !(i.cases ?? []).some((c: any) => ['onboarding', 'active'].includes(c.status)))
    .map((i: any) => ({ id: i.id, full_name: i.full_name }))

  const { data: tecnicosRows } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['tecnico', 'technician'])
    .eq('organization_id', profile.organization_id)
    .order('full_name')

  return { imputados: disponibles, tecnicos: tecnicosRows ?? [] }
}

export default async function NuevoCasoPage() {
  const { imputados, tecnicos } = await getData()

  return (
    <div>
      <Link href="/dashboard/casos" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>
        ← Casos
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 4px' }}>Registrar caso</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 14 }}>
        El caso queda en estado <strong>onboarding</strong> hasta que el técnico complete la visita domiciliaria.
      </p>
      <CrearCasoForm imputados={imputados} tecnicos={tecnicos} />
    </div>
  )
}
