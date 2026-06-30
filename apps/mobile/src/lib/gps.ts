import * as Location from 'expo-location'
import * as Application from 'expo-application'

export interface GPSReading {
  lat: number
  lng: number
  accuracyM: number
  isMock: boolean
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  return status === 'granted'
}

export async function getCurrentLocation(): Promise<GPSReading> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  })

  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracyM: location.coords.accuracy ?? 999,
    // expo-location expone isMocked en Android cuando está disponible
    isMock: (location.coords as any).isMocked ?? false,
  }
}

// Calcula distancia en metros entre dos coordenadas (Haversine)
export function haversineDistanceM(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function getDeviceId(): Promise<string> {
  return Application.getAndroidId() ?? Application.applicationId ?? 'unknown'
}
