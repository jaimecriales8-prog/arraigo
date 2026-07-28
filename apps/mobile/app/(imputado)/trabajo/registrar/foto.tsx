import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useWorkLocationStore } from '../../../../src/hooks/useWorkLocationStore'

export default function TrabajoFotoScreen() {
  const router = useRouter()
  const { setScene } = useWorkLocationStore()
  const [permission, requestPermission] = useCameraPermissions()
  const [capturing, setCapturing] = useState(false)
  const cameraRef = useRef<CameraView>(null)

  async function capturar() {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: true, exif: false })
      if (result?.base64) {
        setScene(result.base64, result.uri)
        router.push('/(imputado)/trabajo/registrar/confirmar')
      }
    } catch {
      Alert.alert('Error', 'No se pudo tomar la foto.')
    } finally {
      setCapturing(false)
    }
  }

  if (!permission) return <View style={styles.container} />

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>Necesitamos tu cámara</Text>
          <Text style={styles.subtitle}>Arraigo necesita acceso a la cámara para fotografiar el sitio de trabajo.</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Permitir acceso</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Paso 3 de 3</Text>
        <Text style={styles.title}>Foto del sitio de trabajo</Text>
        <Text style={styles.subtitle}>Toma una foto del lugar. Esta será tu referencia para futuros check-ins desde ahí.</Text>
      </View>
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={capturar}
          disabled={capturing}
        >
          {capturing ? <ActivityIndicator color="#fff" size="large" /> : <View style={styles.captureInner} />}
        </TouchableOpacity>
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
  cameraContainer: { flex: 1, margin: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#2563eb' },
  camera: { flex: 1 },
  footer: { alignItems: 'center', paddingVertical: 24 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' },
  captureBtnDisabled: { opacity: 0.6 },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, marginTop: 24 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
