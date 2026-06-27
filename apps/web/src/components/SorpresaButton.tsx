'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function SorpresaButton({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function trigger() {
    if (!confirm('¿Enviar verificación sorpresa? El imputado tendrá 15 minutos para completarla.')) return
    setLoading(true)
    setResult(null)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/trigger-surprise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ case_id: caseId }),
    })

    setLoading(false)
    setResult(res.ok ? 'success' : 'error')
    setTimeout(() => setResult(null), 4000)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={trigger}
        disabled={loading}
        style={{
          padding: '10px 20px',
          background: loading ? 'var(--border)' : '#f59e0b',
          color: '#000',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        ⚡ {loading ? 'Enviando...' : 'Verificación sorpresa'}
      </button>
      {result === 'success' && (
        <span style={{ color: 'var(--success)', fontSize: 13 }}>✓ Notificación enviada — 15 min</span>
      )}
      {result === 'error' && (
        <span style={{ color: 'var(--danger)', fontSize: 13 }}>Error al enviar</span>
      )}
    </div>
  )
}
