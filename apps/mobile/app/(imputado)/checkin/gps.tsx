import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { getCurrentLocation, requestLocationPermission } from '../../../src/lib/gps'
import { useCheckinStore } from '../../../src/hooks/useCheckinStore'

export default function GPSScreen() {
  const router = useRouter()
  const { checkinId } = useLocalSearchParams<{ checkinId: string }>()
  const { setGPS } = useCheckinStore()
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'mock'>('idle')
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)

  useEffect(() => { capture() }, [])

  async function capture() {
    setStatus('loading')
    const hasPermission = await requestLocationPermission()
    if (!hasPermission) {
      Alert.alert('Permiso requerido', 'Activa el GPS para continuar.')
      setStatus('error')
      return
    }
    try {
      const loc = await getCurrentLocation()

      if (loc.isMock) {
        // GPS falso detectado — registramos pero marcamos
        setGPS(loc.lat, loc.lng, loc.accuracyM, true)
        setStatus('mock')
        return
      }

      setGPS(loc.lat, loc.lng, loc.accuracyM, false)
      setCoords({ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracyM })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  function continuar() {
    router.push({ pathname: '/(imputado)/checkin/escena', params: { checkinId } })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Paso 2 de 3</Text>
        <Text style={styles.title}>Verificando ubicación</Text>
        <Text style={styles.subtitle}>
          Confirmamos que te encuentras en tu domicilio registrado.
        </Text>
      </View>

      <View style={styles.body}>
        {status === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Obteniendo ubicación GPS…</Text>
            <Text style={styles.loadingHint}>Mantén el teléfono quieto unos segundos</Text>
          </View>
        )}

        {status === 'done' && coords && (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>📍</Text>
            <Text style={styles.successTitle}>Ubicación obtenida</Text>
            <Text style={styles.coord}>
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </Text>
            <Text style={styles.accuracy}>Precisión: ±{Math.round(coords.accuracy)} m</Text>
            <View style={styles.okBadge}>
              <Text style={styles.okText}>✓ GPS verificado</Text>
            </View>
          </View>
        )}

        {status === 'mock' && (
          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningTitle}>GPS simulado detectado</Text>
            <Text style={styles.warningText}>
              Se detectó que estás usando una ubicación simulada. Esto quedará registrado en tu expediente.
            </Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>❌</Text>
            <Text style={styles.errorTitle}>No se pudo obtener el GPS</Text>
            <Text style={styles.errorText}>
              Asegúrate de tener el GPS activado y permisos otorgados.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={capture}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {(status === 'done' || status === 'mock') && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={continuar}>
            <Text style={styles.btnText}>Continuar →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  header: { padding: 24, paddingTop: 60 },
  step: { fontSize: 12, color: '#2563eb', fontWeight: '700', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#7a9bbf', lineHeight: 20 },
  body: { flex: 1, padding: 24, justifyContent: 'center' },
  center: { alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 16, color: '#fff', marginTop: 8 },
  loadingHint: { fontSize: 13, color: '#4a6a8a' },
  successCard: {
    backgroundColor: '#1a3a5c', borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: '#16a34a44',
  },
  successIcon: { fontSize: 48, marginBottom: 12 },
  successTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  coord: { fontSize: 13, color: '#7a9bbf', fontFamily: 'monospace', marginBottom: 4 },
  accuracy: { fontSize: 13, color: '#7a9bbf', marginBottom: 16 },
  okBadge: {
    backgroundColor: '#16a34a22', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20,
  },
  okText: { color: '#16a34a', fontWeight: '700', fontSize: 14 },
  warningCard: {
    backgroundColor: '#2d1f0a', borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: '#d9770644',
  },
  warningIcon: { fontSize: 48, marginBottom: 12 },
  warningTitle: { fontSize: 18, fontWeight: '700', color: '#f97316', marginBottom: 8 },
  warningText: { fontSize: 14, color: '#fed7aa', textAlign: 'center', lineHeight: 20 },
  errorCard: {
    backgroundColor: '#1f0f0f', borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: '#dc262644',
  },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#f87171', marginBottom: 8 },
  errorText: { fontSize: 14, color: '#fca5a5', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#fff', fontWeight: '700' },
  footer: { padding: 24, paddingBottom: 48 },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 18, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
