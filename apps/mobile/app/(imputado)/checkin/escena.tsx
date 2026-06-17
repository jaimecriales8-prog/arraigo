import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { CameraView } from 'expo-camera'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useCheckinStore } from '../../../src/hooks/useCheckinStore'
import { useAuth } from '../../../src/hooks/useAuth'
import { supabase } from '../../../src/lib/supabase'

interface Checkpoint {
  id: string
  label: string
  description: string | null
}

export default function EscenaScreen() {
  const router = useRouter()
  const { checkinId } = useLocalSearchParams<{ checkinId: string }>()
  const { profile } = useAuth()
  const { setScene } = useCheckinStore()
  const cameraRef = useRef<CameraView>(null)
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null)
  const [loadingCheckpoint, setLoadingCheckpoint] = useState(true)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => { loadRandomCheckpoint() }, [])

  async function loadRandomCheckpoint() {
    setLoadingCheckpoint(true)

    // Obtener el case_id del check-in
    const { data: checkin } = await supabase
      .from('checkins')
      .select('case_id')
      .eq('id', checkinId)
      .single()

    if (!checkin) { setLoadingCheckpoint(false); return }

    // Obtener todos los checkpoints activos del caso y elegir uno al azar
    const { data: checkpoints } = await supabase
      .from('checkpoints')
      .select('id, label, description')
      .eq('case_id', checkin.case_id)
      .eq('is_active', true)

    if (checkpoints && checkpoints.length > 0) {
      const random = checkpoints[Math.floor(Math.random() * checkpoints.length)]
      setCheckpoint(random)
    }

    setLoadingCheckpoint(false)
  }

  async function capture() {
    if (!cameraRef.current || capturing || !checkpoint) return
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8, base64: true, exif: false,
      })
      if (photo?.base64) {
        setScene(photo.base64, photo.uri, checkpoint.id)
        router.push({ pathname: '/(imputado)/checkin/resultado', params: { checkinId } })
      }
    } catch {
      Alert.alert('Error', 'No se pudo tomar la foto. Intenta de nuevo.')
    } finally {
      setCapturing(false)
    }
  }

  if (loadingCheckpoint) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Preparando verificación…</Text>
      </View>
    )
  }

  if (!checkpoint) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>
          No hay puntos de referencia configurados.{'\n'}
          Contacta a tu funcionario.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Paso 3 de 3</Text>
        <Text style={styles.title}>Verifica tu domicilio</Text>
      </View>

      {/* Instrucción del checkpoint */}
      <View style={styles.instructionCard}>
        <Text style={styles.instructionLabel}>Apunta la cámara hacia:</Text>
        <Text style={styles.instructionText}>{checkpoint.label}</Text>
        {checkpoint.description && (
          <Text style={styles.instructionHint}>{checkpoint.description}</Text>
        )}
      </View>

      {/* Cámara */}
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      </View>

      {/* Botón captura */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={capture}
          disabled={capturing}
        >
          {capturing
            ? <ActivityIndicator color="#fff" size="large" />
            : <View style={styles.captureInner} />
          }
        </TouchableOpacity>
        <Text style={styles.hint}>Toca para capturar</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  header: { padding: 24, paddingTop: 60 },
  step: { fontSize: 12, color: '#2563eb', fontWeight: '700', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff' },
  instructionCard: {
    marginHorizontal: 24, backgroundColor: '#1a3a5c',
    borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#2563eb44',
  },
  instructionLabel: { fontSize: 12, color: '#7a9bbf', marginBottom: 4 },
  instructionText: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  instructionHint: { fontSize: 13, color: '#7a9bbf' },
  cameraContainer: {
    flex: 1, marginHorizontal: 24, borderRadius: 20, overflow: 'hidden',
    borderWidth: 2, borderColor: '#2563eb',
  },
  camera: { flex: 1 },
  footer: { alignItems: 'center', paddingBottom: 48, paddingTop: 16 },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)',
  },
  captureBtnDisabled: { opacity: 0.6 },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  hint: { color: '#4a6a8a', fontSize: 13, marginTop: 12 },
  loadingText: { color: '#7a9bbf', fontSize: 15 },
  errorText: { color: '#f87171', fontSize: 15, textAlign: 'center', lineHeight: 22 },
})
