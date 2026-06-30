import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import CrearUsuarioForm from './CrearUsuarioForm'

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  judicial: 'Entidad Judicial',
  tecnico: 'Técnico',
  imputado: 'Imputado',
}
const ROL_COLOR: Record<string, string> = {
  admin: 'var(--accent)',
  judicial: 'var(--success)',
  tecnico: 'var(--warning)',
  imputado: 'var(--text-muted)',
}

async function getUsuarios() {
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
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const currentRole = currentProfile?.role ?? 'judicial'

  const [{ data: profiles }, { data: authData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .neq('role', 'imputado')
      .order('created_at', { ascending: false }),
    supabase.auth.admin.listUsers(),
  ])

  const emailMap = new Map((authData?.users ?? []).map(u => [u.id, u.email]))

  return {
    usuarios: (profiles ?? []).map(p => ({ ...p, email: emailMap.get(p.id) ?? '' })),
    currentRole,
  }
}

export default async function UsuariosPage() {
  const { usuarios, currentRole } = await getUsuarios()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Usuarios</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} en la organización
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
        {/* Lista */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nombre', 'Correo', 'Rol', 'Creado'].map(h => (
                  <th key={h} style={{
                    padding: '14px 20px', textAlign: 'left',
                    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay usuarios aún. Crea el primero.
                </td></tr>
              )}
              {usuarios.map((u: any, i: number) => (
                <tr key={u.id} style={{ borderBottom: i < usuarios.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 500, fontSize: 14 }}>{u.full_name}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{u.email}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: (ROL_COLOR[u.role] ?? 'var(--text-muted)') + '22',
                      color: ROL_COLOR[u.role] ?? 'var(--text-muted)',
                    }}>
                      {ROL_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(u.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Formulario */}
        <CrearUsuarioForm currentRole={currentRole} />
      </div>
    </div>
  )
}
