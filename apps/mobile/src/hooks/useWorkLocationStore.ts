import { create } from 'zustand'

// Store efímero — solo vive durante el flujo de registro del sitio de trabajo.
// El veredicto de la verificación facial se lee server-side en el edge
// function (facetec_sessions) cuando la org usa FaceTec; en modo acelerómetro
// (sin FaceTec) se sube el selfie como respaldo, igual que el check-in normal.
interface WorkLocationStore {
  faceVerified: boolean
  selfieBase64: string | null
  selfieUri: string | null
  gpsLat: number | null
  gpsLng: number | null
  gpsAccuracyM: number | null
  gpsIsMock: boolean
  sceneBase64: string | null
  sceneUri: string | null

  setFaceVerified: () => void
  setSelfie: (base64: string, uri: string) => void
  setGPS: (lat: number, lng: number, accuracyM: number, isMock: boolean) => void
  setScene: (base64: string, uri: string) => void
  reset: () => void
}

export const useWorkLocationStore = create<WorkLocationStore>((set) => ({
  faceVerified: false,
  selfieBase64: null,
  selfieUri: null,
  gpsLat: null,
  gpsLng: null,
  gpsAccuracyM: null,
  gpsIsMock: false,
  sceneBase64: null,
  sceneUri: null,

  setFaceVerified: () => set({ faceVerified: true }),
  setSelfie: (base64, uri) => set({ selfieBase64: base64, selfieUri: uri, faceVerified: true }),
  setGPS: (lat, lng, accuracyM, isMock) => set({ gpsLat: lat, gpsLng: lng, gpsAccuracyM: accuracyM, gpsIsMock: isMock }),
  setScene: (base64, uri) => set({ sceneBase64: base64, sceneUri: uri }),
  reset: () => set({
    faceVerified: false,
    selfieBase64: null, selfieUri: null,
    gpsLat: null, gpsLng: null, gpsAccuracyM: null, gpsIsMock: false,
    sceneBase64: null, sceneUri: null,
  }),
}))
