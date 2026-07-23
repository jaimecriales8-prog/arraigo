'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  judicial: 'Panel Judicial',
  operador: 'Panel Operador',
  tecnico: 'Panel Técnico',
}

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: '📊' },
  { href: '/dashboard/casos', label: 'Casos', icon: '📋' },
  { href: '/dashboard/alertas', label: 'Alertas', icon: '🚨' },
  { href: '/dashboard/usuarios', label: 'Usuarios', icon: '👥', roles: ['judicial', 'super_admin', 'admin'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [roleLabel, setRoleLabel] = useState('Panel')
  const [role, setRole] = useState<string>('')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (data?.role) { setRoleLabel(ROLE_LABEL[data.role] ?? data.role); setRole(data.role) }
    })
  }, [])

  // Filtrar items según el rol (el operador no gestiona usuarios)
  const items = navItems.filter(i => !i.roles || i.roles.includes(role))

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="dash-sidebar">
      <div className="dash-sidebar-header" style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--accent)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>🏠</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Arraigo</div>
            <div className="dash-brand-sub" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{roleLabel}</div>
          </div>
        </div>
      </div>

      <nav className="dash-nav">
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              background: active ? 'var(--bg-card2)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: active ? 600 : 400,
              fontSize: 14,
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="dash-footer" style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
        <button onClick={logout} className="dash-logout" style={{
          width: '100%', padding: '10px 12px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text-muted)',
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
        }}>
          <span>🚪</span> <span className="dash-logout-text">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
