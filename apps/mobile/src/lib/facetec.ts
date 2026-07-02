// ============================================================
// FaceTec — interfaz del liveness facial certificado (3D FaceMap)
// ============================================================
// Puente al NativeModule FacetecModule (ios/Arraigo/Facetec/).
// SDK v10.1.5, modo Managed Testing (api.facetec.com).
//
// NOTA DE SEGURIDAD: en Managed Testing la app lee el resultado del servidor.
// En producción el veredicto de match debe verificarlo el middleware/FaceTec
// Server (no confiar en el cliente). Ver process-checkin.
// ============================================================
import { NativeModules } from 'react-native'

const { FacetecModule } = NativeModules

// Credenciales FaceTec (app-embedded, no son secretos de servidor)
export const FACETEC_DEVICE_KEY = 'dTCCKq4bZ9mHJrkhc0dL2bCZuzAjMAF1'

// Disponible solo si el native module está compilado (build nativo con el SDK)
export const FACETEC_AVAILABLE = !!FacetecModule

export interface FacetecEnrollResult {
  success: boolean
  sessionStatus: string
}

export interface FacetecAuthResult {
  sessionId: string
  livenessPassed: boolean
  matchScore: number // 0-100
}

let initialized = false

async function ensureInit(): Promise<void> {
  if (!FacetecModule) throw new Error('FaceTec no disponible (falta build nativo con el SDK).')
  if (initialized) return
  await FacetecModule.initialize(FACETEC_DEVICE_KEY)
  initialized = true
}

// Enrolamiento: captura el FaceMap 3D de referencia del imputado (paso del técnico)
export async function facetecEnroll(userId: string): Promise<FacetecEnrollResult> {
  await ensureInit()
  const info = await FacetecModule.enroll(userId)
  return { success: !!info?.success, sessionStatus: String(info?.sessionStatus ?? '') }
}

// Autenticación: liveness + matching 3D:3D contra la referencia (paso del check-in)
export async function facetecAuthenticate(userId: string): Promise<FacetecAuthResult> {
  await ensureInit()
  const info = await FacetecModule.authenticate(userId)
  // Milestone 1 (Managed Testing, sin Server Key): success = liveness confirmado.
  // El veredicto de match 3D:3D real se verificará server-side en Milestone 2.
  const livenessPassed = !!info?.success
  return {
    sessionId: userId,
    livenessPassed,
    matchScore: livenessPassed ? 100 : 0,
  }
}
