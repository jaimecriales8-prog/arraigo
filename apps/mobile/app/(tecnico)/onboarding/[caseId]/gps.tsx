import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { getCurrentLocation, requestLocationPermission } from '../../../../src/lib/gps'

export default function OnboardingGPS() {
  const { caseId, selfieBase64 } = useLocalSearchParams<{ caseId: string; selfieBase64: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)

  async function capturarGPS() {
    setLoading(true)
    try {
      const granted = await requestLocationPermission()
      if (!granted) {
        Alert.alert('Permisos requeridos', 'Debes permitir el acceso a la ubicación para continuar.')
        return
      }
      const pos = await getCurrentLocation()
      setCoords({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracyM })
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación. Verifica los permisos de GPS.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Paso 1 de 4</Text>
        <Text style={styles.title}>Ubicación del domicilio</Text>
        <Text style={styles.subtitle}>
          Ubícate dentro del domicilio del imputado y captura el GPS.
          Esta será la posición de referencia para los check-ins.
        </Text>
      </View>

      <View style={styles.body}>
        {coords ? (
          <View style={styles.coordCard}>
            <Text style={styles.coordLabel}>Coordenadas capturadas</Text>
            <Text style={styles.coordValue}>Lat: {coords.lat.toFixed(6)}</Text>
            <Text style={styles.coordValue}>Lng: {coords.lng.toFixed(6)}</Text>
            <Text style={styles.coordAccuracy}>Precisión: ±{Math.round(coords.accuracy)}m</Text>
            {coords.accuracy > 20 && (
              <Text style={styles.warningText}>
                ⚠️ Precisión baja. Intenta en un lugar con mejor señal.
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📍</Text>
            <Text style={styles.placeholderText}>Toca el botón para capturar la ubicación exacta</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={capturarGPS}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{coords ? 'Recapturar' : 'Capturar GPS'}</Text>
          }
        </TouchableOpacity>

        {coords && (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => router.push({
              pathname: `/(tecnico)/onboarding/${caseId}/scan`,
              params: { lat: coords.lat, lng: coords.lng, selfieBase64 },
            })}
          >
            <Text style={styles.nextBtnText}>Continuar →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  header: { padding: 24, paddingTop: 60 },
  step: { fontSize: 12, color: '#2563eb', fontWeight: '700', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#7a9bbf', lineHeight: 20 },
  body: { flex: 1, padding: 24, gap: 16 },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  placeholderIcon: { fontSize: 56 },
  placeholderText: { color: '#7a9bbf', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  coordCard: {
    backgroundColor: '#1a3a5c', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#2563eb44', gap: 6,
  },
  coordLabel: { fontSize: 12, color: '#7a9bbf', fontWeight: '600', marginBottom: 4 },
  coordValue: { fontSize: 16, color: '#fff', fontFamily: 'monospace' },
  coordAccuracy: { fontSize: 13, color: '#7a9bbf', marginTop: 4 },
  warningText: { fontSize: 13, color: '#f97316', marginTop: 8, lineHeight: 18 },
  btn: {
    backgroundColor: '#2563eb', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  nextBtn: {
    backgroundColor: '#16a34a', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
