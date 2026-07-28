'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfigCitasMedicas({
  organizationId, autoExcusar, maxPorMes,
}: { organizationId: string; autoExcusar: boolean; maxPorMes: number }) {
  const router = useRouter()
  const [auto, setAuto] = useState(autoExcusar)
  const [limite, setLimite] = useState(String(maxPorMes))
  const [saving, setSaving] = useState(false)

  async function guardar(nextAuto: boolean, nextLimite: string) {
    setSaving(true)
    const res = await fetch('/api/organizaciones/config-citas-medicas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        auto_excusar_citas_medicas: nextAuto,
        max_citas_medicas_mes: Number(nextLimite),
      }),
    })
    setSaving(false)
    if (res.ok) router.refresh()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-muted)' }}>
        <input
          type="checkbox"
          checked={auto}
          disabled={saving}
          onChange={e => { setAuto(e.target.checked); guardar(e.target.checked, limite) }}
        />
        Excusa automática por cita médica
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
        Máx./mes
        <input
          type="number" min={0} max={31} value={limite} disabled={saving}
          onChange={e => setLimite(e.target.value)}
          onBlur={() => guardar(auto, limite)}
          style={{
            width: 48, padding: '4px 6px', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12.5,
          }}
        />
      </label>
    </div>
  )
}
