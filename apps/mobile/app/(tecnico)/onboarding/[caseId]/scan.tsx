import { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  ScrollView, Image, TextInput,
} from 'react-native'
import { CameraView } from 'expo-camera'
import { useRouter, useLocalSearchParams } from 'expo-router'

interface Checkpoint {
  label: string
  base64: string
  uri: string
}

const SUGERENCIAS = ['Sala principal', 'Cocina', 'Habitación', 'Entrada / puerta', 'Ventana principal', 'Baño']

export default function OnboardingScan() {
  const { caseId, lat, lng, selfieBase64, facetecEnrolled } = useLocalSearchParams<{
    caseId: string; lat: string; lng: string; selfieBase64: string; facetecEnrolled: string
  }>()
  const router = useRouter()
  const cameraRef = useRef<CameraView>(null)
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [capturing, setCapturing] = useState(false)
  const [labelInput, setLabelInput] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [pendingLabel, setPendingLabel] = useState('')

  function iniciarCaptura(label: string) {
    if (!label.trim()) return
    setPendingLabel(label.trim())
    setLabelInput('')
    setShowCamera(true)
  }

  async function capturar() {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: true, exif: false })
      if (result?.base64) {
        setCheckpoints(prev => [...prev, { label: pendingLabel, base64: result.base64!, uri: result.uri }])
        setShowCamera(false)
      }
    } catch {
      Alert.alert('Error', 'No se pudo tomar la foto.')
    } finally {
      setCapturing(false)
    }
  }

  if (showCamera) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.step}>Paso 3 de 4 — Escaneando</Text>
          <Text style={styles.title}>{pendingLabel}</Text>
          <Text style={styles.subtitle}>Encuadra bien el área. Esta imagen será la referencia.</Text>
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
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCamera(false)}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Paso 3 de 4</Text>
        <Text style={styles.title}>Escanear domicilio</Text>
        <Text style={styles.subtitle}>
          Captura al menos 2 áreas del domicilio. Estos serán los puntos de verificación del imputado.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Checkpoints capturados */}
        {checkpoints.map((cp, i) => (
          <View key={i} style={styles.cpCard}>
            <Image source={{ uri: cp.uri }} style={styles.cpImage} />
            <View style={styles.cpInfo}>
              <Text style={styles.cpLabel}>{cp.label}</Text>
              <TouchableOpacity onPress={() => setCheckpoints(prev => prev.filter((_, idx) => idx !== i))}>
                <Text style={styles.cpRemove}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Sugerencias rápidas */}
        <Text style={styles.sectionLabel}>Áreas sugeridas</Text>
        <View style={styles.sugerenciasGrid}>
          {SUGERENCIAS.filter(s => !checkpoints.find(c => c.label === s)).map(s => (
            <TouchableOpacity key={s} style={styles.sugerenciaBtn} onPress={() => iniciarCaptura(s)}>
              <Text style={styles.sugerenciaText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Área personalizada */}
        <Text style={styles.sectionLabel}>Área personalizada</Text>
        <View style={styles.customRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Ej: Terraza, Garaje..."
            placeholderTextColor="#4a6a8a"
            value={labelInput}
            onChangeText={setLabelInput}
          />
          <TouchableOpacity
            style={[styles.addBtn, !labelInput.trim() && styles.addBtnDisabled]}
            onPress={() => iniciarCaptura(labelInput)}
            disabled={!labelInput.trim()}
          >
            <Text style={styles.addBtnText}>Foto</Text>
          </TouchableOpacity>
        </View>

        {/* Continuar */}
        {checkpoints.length >= 2 && (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => router.push({
              pathname: `/(tecnico)/onboarding/${caseId}/confirmar`,
              params: {
                lat, lng,
                selfieBase64,
                facetecEnrolled,
                checkpointsJson: JSON.stringify(checkpoints.map(c => ({ label: c.label, base64: c.base64 }))),
              },
            })}
          >
            <Text style={styles.nextBtnText}>Continuar con {checkpoints.length} área{checkpoints.length !== 1 ? 's' : ''} →</Text>
          </TouchableOpacity>
        )}

        {checkpoints.length > 0 && checkpoints.length < 2 && (
          <Text style={styles.minWarning}>Captura al menos 2 áreas para continuar</Text>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  header: { padding: 24, paddingTop: 60 },
  step: { fontSize: 12, color: '#2563eb', fontWeight: '700', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#7a9bbf', lineHeight: 20 },
  cameraContainer: { flex: 1, marginHorizontal: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#2563eb' },
  camera: { flex: 1 },
  footer: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' },
  captureBtnDisabled: { opacity: 0.6 },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  cancelBtn: { paddingVertical: 8 },
  cancelBtnText: { color: '#4a6a8a', fontSize: 14 },
  cpCard: { flexDirection: 'row', backgroundColor: '#1a3a5c', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#2563eb22' },
  cpImage: { width: 80, height: 80 },
  cpInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cpLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  cpRemove: { fontSize: 12, color: '#f87171' },
  sectionLabel: { fontSize: 12, color: '#7a9bbf', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sugerenciasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sugerenciaBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#1a3a5c', borderRadius: 20, borderWidth: 1, borderColor: '#2563eb44' },
  sugerenciaText: { color: '#7a9bbf', fontSize: 13 },
  customRow: { flexDirection: 'row', gap: 10 },
  textInput: { flex: 1, backgroundColor: '#1a3a5c', borderRadius: 10, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#2563eb33', fontSize: 14 },
  addBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  nextBtn: { backgroundColor: '#16a34a', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  minWarning: { color: '#f97316', fontSize: 13, textAlign: 'center' },
})
