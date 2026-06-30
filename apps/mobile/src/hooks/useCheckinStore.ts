import { create } from 'zustand'

// Store efímero — solo vive durante el flujo de un check-in
interface CheckinStore {
  selfieBase64: string | null
  selfieUri: string | null
  gpsLat: number | null
  gpsLng: number | null
  gpsAccuracyM: number | null
  gpsIsMock: boolean
  sceneBase64: string | null
  sceneUri: string | null
  sceneCheckpointId: string | null
  surpriseVerificationId: string | null

  setSelfie: (base64: string, uri: string) => void
  setGPS: (lat: number, lng: number, accuracyM: number, isMock: boolean) => void
  setScene: (base64: string, uri: string, checkpointId: string) => void
  setSurpriseVerificationId: (id: string) => void
  reset: () => void
}

export const useCheckinStore = create<CheckinStore>((set) => ({
  selfieBase64: null,
  selfieUri: null,
  gpsLat: null,
  gpsLng: null,
  gpsAccuracyM: null,
  gpsIsMock: false,
  sceneBase64: null,
  sceneUri: null,
  sceneCheckpointId: null,
  surpriseVerificationId: null,

  setSelfie: (base64, uri) => set({ selfieBase64: base64, selfieUri: uri }),
  setGPS: (lat, lng, accuracyM, isMock) => set({ gpsLat: lat, gpsLng: lng, gpsAccuracyM: accuracyM, gpsIsMock: isMock }),
  setScene: (base64, uri, checkpointId) => set({ sceneBase64: base64, sceneUri: uri, sceneCheckpointId: checkpointId }),
  setSurpriseVerificationId: (id) => set({ surpriseVerificationId: id }),
  reset: () => set({
    selfieBase64: null, selfieUri: null,
    gpsLat: null, gpsLng: null, gpsAccuracyM: null, gpsIsMock: false,
    sceneBase64: null, sceneUri: null, sceneCheckpointId: null,
    surpriseVerificationId: null,
  }),
}))
