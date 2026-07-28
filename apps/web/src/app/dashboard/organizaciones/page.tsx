import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import CrearOrganizacionForm from './CrearOrganizacionForm'

export const dynamic = 'force-dynamic'

async function getOrganizaciones() {
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
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!me || me.role !== 'super_admin') redirect('/dashboard')

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, nit, contact_email, city, department, is_active, created_at')
    .order('created_at', { ascending: false })

  return orgs ?? []
}

export default async function OrganizacionesPage() {
  const orgs = await getOrganizaciones()

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Organizaciones</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
        Cada organización es una entidad judicial independiente (juzgado, fiscalía, etc.) con sus propios usuarios y casos, completamente aislados entre sí.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>{orgs.length} organización{orgs.length !== 1 ? 'es' : ''}</h2>
          </div>
          {orgs.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Sin organizaciones aún.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {orgs.map((o: any, i: number) => (
                  <tr key={o.id} style={{ borderBottom: i < orgs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{o.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {o.contact_email}{o.city ? ` · ${o.city}` : ''}{o.nit ? ` · NIT ${o.nit}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                        background: o.is_active ? 'var(--success)22' : 'var(--text-muted)22',
                        color: o.is_active ? 'var(--success)' : 'var(--text-muted)',
                      }}>
                        {o.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Nueva organización</h2>
          <CrearOrganizacionForm />
        </div>
      </div>
    </div>
  )
}
