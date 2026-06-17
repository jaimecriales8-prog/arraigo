import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useCheckinStore } from '../../../src/hooks/useCheckinStore'

export default function SelfieScreen() {
  const router = useRouter()
  const { checkinId } = useLocalSearchParams<{ checkinId: string }>()
  const { setSelfie } = useCheckinStore()
  const [permission, requestPermission] = useCameraPermissions()
  const [capturing, setCapturing] = useState(false)
  const cameraRef = useRef<CameraView>(null)

  if (!permission) return <View style={styles.container} />

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>Necesitamos tu cámara</Text>
          <Text style={styles.subtitle}>
            Para verificar tu identidad, Arraigo necesita acceso a tu cámara frontal.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Permitir acceso</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  async function capture() {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: false,
      })
      if (photo?.base64) {
        setSelfie(photo.base64, photo.uri)
        router.push({
          pathname: '/(imputado)/checkin/gps',
          params: { checkinId },
        })
      }
    } catch {
      Alert.alert('Error', 'No se pudo tomar la foto. Intenta de nuevo.')
    } finally {
      setCapturing(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Instrucción */}
      <View style={styles.header}>
        <Text style={styles.step}>Paso 1 de 3</Text>
        <Text style={styles.title}>Verifica tu identidad</Text>
        <Text style={styles.subtitle}>
          Mira directamente a la cámara. Asegúrate de tener buena iluminación.
        </Text>
      </View>

      {/* Cámara */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        >
          {/* Guía oval */}
          <View style={styles.ovalGuide} />
        </CameraView>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  header: { padding: 24, paddingTop: 60 },
  step: { fontSize: 12, color: '#2563eb', fontWeight: '700', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#7a9bbf', lineHeight: 20 },
  cameraContainer: {
    flex: 1, margin: 24, borderRadius: 24, overflow: 'hidden',
    borderWidth: 2, borderColor: '#2563eb',
  },
  camera: { flex: 1 },
  ovalGuide: {
    position: 'absolute', alignSelf: 'center', top: '15%',
    width: 200, height: 260, borderRadius: 120,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    borderStyle: 'dashed',
  },
  footer: { alignItems: 'center', paddingBottom: 48 },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)',
  },
  captureBtnDisabled: { opacity: 0.6 },
  captureInner: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff',
  },
  hint: { color: '#4a6a8a', fontSize: 13, marginTop: 12 },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, marginTop: 24 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
