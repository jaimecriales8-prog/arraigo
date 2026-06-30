import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Image, ScrollView,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter, useLocalSearchParams } from 'expo-router'

type Paso = 'frente' | 'reverso' | 'selfie' | 'procesando' | 'aprobado' | 'declinado'

interface Fotos {
  frente?: { uri: string; base64: string }
  reverso?: { uri: string; base64: string }
  selfie?: { uri: string; base64: string }
}

const PASOS_INFO = [
  { id: 'frente', label: 'Frente cédula' },
  { id: 'reverso', label: 'Reverso cédula' },
  { id: 'selfie', label: 'Selfie' },
]

// ── Cámara con captura ───────────────────────────────────────────────────────
function CamaraCaptura({
  instruccion,
  facing,
  onCaptura,
  guia,
}: {
  instruccion: string
  facing: 'back' | 'front'
  onCaptura: (foto: { uri: string; base64: string }) => void
  guia: 'documento' | 'rostro'
}) {
  const cameraRef = useRef<CameraView>(null)
  const [capturing, setCapturing] = useState(false)
  const [preview, setPreview] = useState<{ uri: string; base64: string } | null>(null)

  const capturar = async () => {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: true, exif: false })
      if (result?.base64) setPreview({ uri: result.uri, base64: result.base64 })
    } finally {
      setCapturing(false)
    }
  }

  if (preview) {
    return (
      <View style={cam.container}>
        <Text style={cam.instruccion}>{instruccion}</Text>
        <View style={cam.cameraBox}>
          <Image source={{ uri: preview.uri }} style={cam.camera} />
          <View style={cam.checkOverlay}>
            <View style={cam.checkCircle}>
              <Text style={cam.checkMark}>✓</Text>
            </View>
          </View>
        </View>
        <View style={cam.actions}>
          <TouchableOpacity style={cam.retakeBtn} onPress={() => setPreview(null)}>
            <Text style={cam.retakeBtnText}>Repetir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cam.useBtn} onPress={() => onCaptura(preview)}>
            <Text style={cam.useBtnText}>Usar esta foto</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={cam.container}>
      <Text style={cam.instruccion}>{instruccion}</Text>
      <View style={cam.cameraBox}>
        <CameraView ref={cameraRef} style={cam.camera} facing={facing} />
        {/* Guía visual */}
        {guia === 'documento' && (
          <View style={cam.guiaDoc}>
            <View style={[cam.corner, cam.tl]} />
            <View style={[cam.corner, cam.tr]} />
            <View style={[cam.corner, cam.bl]} />
            <View style={[cam.corner, cam.br]} />
          </View>
        )}
        {guia === 'rostro' && <View style={cam.guiaRostro} />}
      </View>
      <TouchableOpacity
        style={[cam.captureBtn, capturing && cam.captureBtnDisabled]}
        onPress={capturar}
        disabled={capturing}
      >
        {capturing
          ? <ActivityIndicator color="#fff" size="large" />
          : <View style={cam.captureInner} />
        }
      </TouchableOpacity>
      {guia === 'documento' && (
        <Text style={cam.hint}>Asegúrate que el texto sea legible y esté bien iluminado</Text>
      )}
      {guia === 'rostro' && (
        <Text style={cam.hint}>Mira directo a la cámara — cámara frontal</Text>
      )}
    </View>
  )
}

const cam = StyleSheet.create({
  container: { flex: 1, gap: 16 },
  instruccion: { color: '#7a9bbf', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  cameraBox: {
    flex: 1, borderRadius: 20, overflow: 'hidden',
    borderWidth: 2, borderColor: '#2563eb', position: 'relative',
  },
  camera: { flex: 1 },
  guiaDoc: {
    position: 'absolute', top: '15%', left: '8%', right: '8%', bottom: '15%',
  },
  corner: {
    position: 'absolute', width: 20, height: 20,
    borderColor: '#60a5fa', borderStyle: 'solid',
  },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
  guiaRostro: {
    position: 'absolute', top: '10%', left: '20%', right: '20%', bottom: '10%',
    borderRadius: 999, borderWidth: 2, borderColor: '#4ade80', borderStyle: 'dashed',
  },
  checkOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 32, fontWeight: '700' },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36, alignSelf: 'center',
    backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)',
  },
  captureBtnDisabled: { opacity: 0.6 },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  hint: { color: '#4a6a8a', fontSize: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12 },
  retakeBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#2563eb', alignItems: 'center',
  },
  retakeBtnText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  useBtn: {
    flex: 2, padding: 14, borderRadius: 12,
    backgroundColor: '#16a34a', alignItems: 'center',
  },
  useBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})

// ── Indicador de progreso ────────────────────────────────────────────────────
function IndicadorPasos({ paso }: { paso: Paso }) {
  const idx = PASOS_INFO.findIndex(p => p.id === paso)
  return (
    <View style={ind.row}>
      {PASOS_INFO.map((p, i) => {
        const completado = i < idx
        const activo = i === idx
        return (
          <View key={p.id} style={ind.item}>
            <View style={[
              ind.circle,
              completado && ind.circleOk,
              activo && ind.circleActive,
            ]}>
              <Text style={[ind.circleText, (completado || activo) && ind.circleTextActive]}>
                {completado ? '✓' : i + 1}
              </Text>
            </View>
            <Text style={[ind.label, activo && ind.labelActive, completado && ind.labelOk]}>
              {p.label}
            </Text>
            {i < PASOS_INFO.length - 1 && (
              <View style={[ind.line, completado && ind.lineOk]} />
            )}
          </View>
        )
      })}
    </View>
  )
}

const ind = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  circle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  circleOk: { backgroundColor: '#16a34a' },
  circleActive: { backgroundColor: '#2563eb' },
  circleText: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
  circleTextActive: { color: '#fff' },
  label: { color: '#4a6a8a', fontSize: 10, textAlign: 'center' },
  labelActive: { color: '#fff', fontWeight: '600' },
  labelOk: { color: '#4ade80' },
  line: {
    position: 'absolute', top: 15, left: '60%', right: '-60%',
    height: 1, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  lineOk: { backgroundColor: '#16a34a' },
})

// ── Pantalla principal ───────────────────────────────────────────────────────
export default function OnboardingIdentidad() {
  const { caseId } = useLocalSearchParams<{ caseId: string }>()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [paso, setPaso] = useState<Paso>('frente')
  const [fotos, setFotos] = useState<Fotos>({})

  useEffect(() => {
    if (permission && !permission.granted) requestPermission()
  }, [permission])

  const guardarFoto = (cual: 'frente' | 'reverso' | 'selfie', foto: { uri: string; base64: string }) => {
    const nuevasFotos = { ...fotos, [cual]: foto }
    setFotos(nuevasFotos)
    if (cual === 'frente') { setPaso('reverso'); return }
    if (cual === 'reverso') { setPaso('selfie'); return }
    if (cual === 'selfie') {
      setPaso('procesando')
      // Simulación: esperar 2s y aprobar
      setTimeout(() => setPaso('aprobado'), 2000)
    }
  }

  if (!permission?.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.permText}>Se necesita acceso a la cámara</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Permitir cámara</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepLabel}>Paso 0 de 4</Text>
        <Text style={styles.title}>Verificar identidad</Text>
        <Text style={styles.subtitle}>
          Fotografía la cédula del imputado (frente y reverso) y toma una selfie para confirmar su identidad.
        </Text>
      </View>

      {paso !== 'procesando' && paso !== 'aprobado' && paso !== 'declinado' && (
        <View style={styles.progreso}>
          <IndicadorPasos paso={paso} />
        </View>
      )}

      <View style={styles.body}>
        {paso === 'frente' && (
          <CamaraCaptura
            instruccion="Fotografía el FRENTE de la cédula del imputado"
            facing="back"
            guia="documento"
            onCaptura={(f) => guardarFoto('frente', f)}
          />
        )}

        {paso === 'reverso' && (
          <CamaraCaptura
            instruccion="Ahora fotografía el REVERSO de la cédula"
            facing="back"
            guia="documento"
            onCaptura={(f) => guardarFoto('reverso', f)}
          />
        )}

        {paso === 'selfie' && (
          <View style={{ flex: 1, gap: 12 }}>
            <View style={styles.checkBanner}>
              <Text style={styles.checkBannerText}>✓ Documento capturado — ahora toma la selfie del imputado</Text>
            </View>
            <CamaraCaptura
              instruccion="El imputado debe mirar directo a la cámara frontal"
              facing="front"
              guia="rostro"
              onCaptura={(f) => guardarFoto('selfie', f)}
            />
          </View>
        )}

        {paso === 'procesando' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.procesandoTitle}>Analizando identidad...</Text>
            {(['Verificando documento', 'Comparando rostro', 'Validando autenticidad'] as const).map((t, i) => (
              <View key={t} style={styles.procesandoRow}>
                <ActivityIndicator size="small" color="#60a5fa" />
                <Text style={styles.procesandoItem}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {paso === 'aprobado' && (
          <View style={styles.center}>
            <View style={styles.aprobadoCircle}>
              <Text style={styles.aprobadoIcon}>✓</Text>
            </View>
            <Text style={styles.aprobadoTitle}>Identidad verificada</Text>
            <Text style={styles.aprobadoSub}>La identidad del imputado ha sido confirmada.</Text>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => router.push({
                pathname: `/(tecnico)/onboarding/${caseId}/gps`,
                params: { selfieBase64: fotos.selfie?.base64 },
              })}
            >
              <Text style={styles.nextBtnText}>Continuar con GPS →</Text>
            </TouchableOpacity>
          </View>
        )}

        {paso === 'declinado' && (
          <View style={styles.center}>
            <Text style={styles.declinadoTitle}>No se pudo verificar</Text>
            <Text style={styles.declinadoSub}>Asegúrate de buena iluminación y documento legible.</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => { setPaso('frente'); setFotos({}) }}
            >
              <Text style={styles.retryBtnText}>Intentar de nuevo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  header: { padding: 24, paddingTop: 60, paddingBottom: 12 },
  stepLabel: { fontSize: 12, color: '#2563eb', fontWeight: '700', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#7a9bbf', lineHeight: 19 },
  progreso: { paddingHorizontal: 24, marginBottom: 8 },
  body: { flex: 1, paddingHorizontal: 24, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  checkBanner: {
    backgroundColor: '#16a34a22', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#16a34a44',
  },
  checkBannerText: { color: '#4ade80', fontSize: 12, textAlign: 'center' },
  procesandoTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 8 },
  procesandoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  procesandoItem: { color: '#7a9bbf', fontSize: 13 },
  aprobadoCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center',
  },
  aprobadoIcon: { fontSize: 48, color: '#fff', fontWeight: '700' },
  aprobadoTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  aprobadoSub: { fontSize: 14, color: '#7a9bbf', textAlign: 'center' },
  nextBtn: {
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingHorizontal: 40, paddingVertical: 16, marginTop: 8,
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  declinadoTitle: { fontSize: 20, fontWeight: '700', color: '#f87171' },
  declinadoSub: { fontSize: 13, color: '#7a9bbf', textAlign: 'center' },
  retryBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  permText: { color: '#7a9bbf', fontSize: 15, textAlign: 'center' },
  permBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  permBtnText: { color: '#fff', fontWeight: '700' },
})
