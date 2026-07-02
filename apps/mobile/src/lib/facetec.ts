// ============================================================
// FaceTec — interfaz del liveness facial certificado (3D FaceMap)
// ============================================================
// Puente al NativeModule FacetecModule (ios/Arraigo/Facetec/).
// SDK v10.1.5 · Milestone 2: los blobs viajan vía facetec-proxy
// (Edge Function) que registra el veredicto SERVER-SIDE en
// facetec_sessions. process-checkin lee de la BD — lo que la app
// reporta es solo informativo.
// ============================================================
import { NativeModules } from 'react-native'
import { supabase } from './supabase'

const { FacetecModule } = NativeModules

// Credenciales FaceTec (app-embedded, no son secretos de servidor)
export const FACETEC_DEVICE_KEY = 'dTCCKq4bZ9mHJrkhc0dL2bCZuzAjMAF1'

const PROXY_ENDPOINT = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/facetec-proxy`

// Disponible solo si el native module está compilado (build nativo con el SDK)
export const FACETEC_AVAILABLE = !!FacetecModule

export interface FacetecEnrollResult {
  success: boolean
  sessionStatus: string
}

export interface FacetecAuthResult {
  sessionId: string
  livenessPassed: boolean
  matchScore: number // 0-100 (informativo — el veredicto real está server-side)
}

let initialized = false

async function authToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sesión expirada — vuelve a iniciar sesión.')
  return session.access_token
}

async function ensureInit(): Promise<void> {
  if (!FacetecModule) throw new Error('FaceTec no disponible (falta build nativo con el SDK).')
  if (initialized) return
  await FacetecModule.initialize(FACETEC_DEVICE_KEY, PROXY_ENDPOINT, await authToken())
  initialized = true
}

// Enrolamiento: captura el FaceMap 3D de referencia del imputado (paso del técnico)
export async function facetecEnroll(userId: string): Promise<FacetecEnrollResult> {
  await ensureInit()
  const info = await FacetecModule.enroll({
    refID: userId,
    endpoint: PROXY_ENDPOINT,
    authToken: await authToken(),
  })
  return { success: !!info?.success, sessionStatus: String(info?.sessionStatus ?? '') }
}

// Autenticación: liveness + matching 3D:3D contra la referencia (paso del check-in)
export async function facetecAuthenticate(userId: string, checkinId?: string): Promise<FacetecAuthResult> {
  await ensureInit()
  const info = await FacetecModule.authenticate({
    refID: userId,
    endpoint: PROXY_ENDPOINT,
    authToken: await authToken(),
    checkinId: checkinId ?? null,
  })
  const livenessPassed = !!info?.success
  return {
    sessionId: userId,
    livenessPassed,
    matchScore: livenessPassed ? 100 : 0,
  }
}
