'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResolverAlerta({ alertId }: { alertId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function resolver() {
    setLoading(true)
    setError(false)
    const res = await fetch('/api/alertas/resolver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    })
    setLoading(false)
    if (!res.ok) { setError(true); return }
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
