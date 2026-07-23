'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function ResolverAlerta({ alertId }: { alertId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function resolver() {
    setLoading(true)
    setError(false)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('alerts')
      .update({ is_resolved: true, resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
      .eq('id', alertId)
    setLoading(false)
    if (error) { setError(true); return }
    router.refresh()
  }

  return (
    <button
      onClick={resolver}
      disabled={loading}
      style={{
        padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
        border: error ? '1px solid var(--danger)' : '1px solid var(--border)',
        background: 'transparent', color: error ? 'var(--danger)' : 'var(--text)',
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? 'Resolviendo…' : error ? 'Error, reintentar' : '✓ Marcar resuelta'}
    </button>
  )
}
