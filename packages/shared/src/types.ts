// Tipos compartidos entre app móvil y web

export type UserRole =
  | 'super_admin'
  | 'org_admin'
  | 'officer'
  | 'technician'
  | 'supervisor'
  | 'imputado'

export type CaseStatus =
  | 'onboarding'
  | 'active'
  | 'suspended'
  | 'closed'
  | 'revoked'

export type CheckinStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'missed'
  | 'excused'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export type AlertType =
  | 'missed_checkin'
  | 'gps_out_of_range'
  | 'face_verification_failed'
  | 'scene_verification_failed'
  | 'mock_gps_detected'
  | 'multiple_failures'
  | 'case_expiring'

export interface CheckinResult {
  face: { passed: boolean; score: number }
  gps: { passed: boolean; distanceM: number; isMock: boolean }
  scene: { passed: boolean; score: number; checkpointId: string }
  overall: { passed: boolean; score: number }
}

// Respuesta del API de check-in desde la app
export interface CheckinPayload {
  caseId: string
  scheduledCheckinId: string
  facePhotoBase64: string
  gpsLat: number
  gpsLng: number
  gpsAccuracyM: number
  gpsIsMock: boolean
  sceneCheckpointId: string
  scenePhotoBase64: string
  deviceId: string
  appVersion: string
  osVersion: string
}
