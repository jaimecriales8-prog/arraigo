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
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/casos', label: 'Casos', icon: '📋' },
  { href: '/dashboard/usuarios', label: 'Usuarios', icon: '👥' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [roleLabel, setRoleLabel] = useState('Panel')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (data?.role) setRoleLabel(ROLE_LABEL[data.role] ?? data.role)
    })
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside style={{
      width: 220,
      minHeight: '100vh',
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--accent)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🏠</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Arraigo</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{roleLabel}</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {navItems.map(item => {
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

      <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
        <button onClick={logout} style={{
          width: '100%', padding: '10px 12px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text-muted)',
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
