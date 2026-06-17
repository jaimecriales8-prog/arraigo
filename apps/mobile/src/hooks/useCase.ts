import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface CaseData {
  id: string
  case_number: string
  status: string
  address: string
  city: string
  checkin_times: string[]
  checkin_window_min: number
  timezone: string
  geofence_radius_m: number
  location: { coordinates: [number, number] } | null  // [lng, lat]
}

export interface PendingCheckin {
  id: string
  scheduled_at: string
  window_closes_at: string
  status: string
}

export function useCase() {
  const { profile } = useAuth()
  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [pendingCheckin, setPendingCheckin] = useState<PendingCheckin | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadCase()
  }, [profile])

  async function loadCase() {
    setLoading(true)

    const { data: caseRow } = await supabase
      .from('cases')
      .select('id, case_number, status, address, city, checkin_times, checkin_window_min, timezone, geofence_radius_m, location')
      .eq('imputado_id', profile!.id)
      .eq('status', 'active')
      .single()

    setCaseData(caseRow)

    if (caseRow) {
      // Buscar el check-in pendiente más próximo dentro de la ventana activa
      const now = new Date().toISOString()
      const { data: checkin } = await supabase
        .from('checkins')
        .select('id, scheduled_at, window_closes_at, status')
        .eq('case_id', caseRow.id)
        .eq('status', 'pending')
        .lte('scheduled_at', now)
        .gte('window_closes_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single()

      setPendingCheckin(checkin)
    }

    setLoading(false)
  }

  return { caseData, pendingCheckin, loading, reload: loadCase }
}
