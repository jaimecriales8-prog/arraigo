import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Accelerometer } from 'expo-sensors'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useCheckinStore } from '../../../src/hooks/useCheckinStore'
import { useCase } from '../../../src/hooks/useCase'
import { useAuth } from '../../../src/hooks/useAuth'
import { facetecAuthenticate } from '../../../src/lib/facetec'

// El usuario debe inclinar el teléfono en el orden aleatorio indicado
// Una foto impresa no puede mover el teléfono
type TiltDir = 'left' | 'right'
type ChallengeStep = 'first' | 'second' | 'done'

const TILT_THRESHOLD = 0.4
const NEUTRAL_ZONE = 0.15

// Dispatcher: elige el método de liveness según el toggle (FaceTec vs acelerómetro)
export default function SelfieScreen() {
  const { facetecEnabled, loading } = useCase()

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return facetecEnabled ? <FacetecSelfie /> : <AccelerometerSelfie />
}

// ── Liveness con FaceTec (3D FaceMap certificado) ────────────────────────────
function FacetecSelfie() {
  const router = useRouter()
  const { checkinId } = useLocalSearchParams<{ checkinId: string }>()
  const { profile } = useAuth()
  const { setFacetecResult } = useCheckinStore()
  const [status, setStatus] = useState<'running' | 'failed'>('running')
  const [msg, setMsg] = useState('')
  const runningRef = useRef(false)

  const run = useCallback(async () => {
    if (runningRef.current || !profile?.id) return
    runningRef.current = true
    setStatus('running')
    try {
      const result = await facetecAuthenticate(profile.id, checkinId)
      // Si FaceTec no se completó (cancelado o no pasó el liveness), NO se avanza.
      // Cortamos aquí y ofrecemos reintentar — el check-in no continúa a GPS.
      if (!result.livenessPassed) {
        runningRef.current = false
        setMsg('No se completó la verificación facial. Debes mostrar tu rostro en vivo, sin foto ni video, para continuar.')
        setStatus('failed')
        return
      }
      setFacetecResult(result)
      router.push({ pathname: '/(imputado)/checkin/gps', params: { checkinId } })
    } catch (e: any) {
      runningRef.current = false
      setMsg(e?.message ?? 'No se pudo iniciar la verificación facial.')
      setStatus('failed')
    }
  }, [profile?.id, checkinId])

  useEffect(() => { run() }, [run])

  return (
    <View style={[styles.container, styles.center]}>
      {status === 'failed' ? (
        <>
          <Text style={styles.title}>Verificación facial</Text>
          <Text style={[styles.subtitle, { textAlign: 'center' }]}>{msg}</Text>
          <TouchableOpacity style={styles.btn} onPress={run}>
            <Text style={styles.btnText}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingVertical: 12, marginTop: 4 }} onPress={() => router.replace('/(imputado)/home')}>
            <Text style={{ color: '#4a6a8a', fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={[styles.subtitle, { marginTop: 16 }]}>Iniciando verificación facial…</Text>
        </>
      )}
    </View>
  )
}

// ── Liveness con acelerómetro (modo actual, sin FaceTec) ─────────────────────
function AccelerometerSelfie() {
  const router = useRouter()
  const { checkinId } = useLocalSearchParams<{ checkinId: string }>()
  const { setSelfie } = useCheckinStore()
  const [permission, requestPermission] = useCameraPermissions()
  const [capturing, setCapturing] = useState(false)
  const [step, setStep] = useState<ChallengeStep>('first')
  const [firstDone, setFirstDone] = useState(false)
  const [secondDone, setSecondDone] = useState(false)
  const cameraRef = useRef<CameraView>(null)
  const stepRef = useRef<ChallengeStep>('first')
  const neutralSeen = useRef(false)

  // Orden aleatorio decidido al montar — izquierda primero o derecha primero
  const orderRef = useRef<[TiltDir, TiltDir]>(
    Math.random() < 0.5 ? ['left', 'right'] : ['right', 'left']
  )
  const order = orderRef.current

  useEffect(() => {
    Accelerometer.setUpdateInterval(80)
    const sub = Accelerometer.addListener(({ x }) => {
      if (stepRef.current === 'done') return

      const currentDir = stepRef.current === 'first' ? order[0] : order[1]
      const isLeft = currentDir === 'left'

      if (stepRef.current === 'first') {
        const triggered = isLeft ? x < -TILT_THRESHOLD : x > TILT_THRESHOLD
        if (triggered) {
          setFirstDone(true)
          stepRef.current = 'second'
          setStep('second')
          neutralSeen.current = false
        }
        return
      }

      if (stepRef.current === 'second') {
        if (Math.abs(x) < NEUTRAL_ZONE) neutralSeen.current = true
        const triggered = isLeft ? x < -TILT_THRESHOLD : x > TILT_THRESHOLD
        if (neutralSeen.current && triggered) {
          setSecondDone(true)
          stepRef.current = 'done'
          setStep('done')
          capturePhoto()
        }
      }
    })
    return () => sub.remove()
  }, [])

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current) return
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: false,
      })
      if (photo?.base64) {
        setSelfie(photo.base64, photo.uri)
        router.push({ pathname: '/(imputado)/checkin/gps', params: { checkinId } })
      }
    } catch {
      Alert.alert('Error', 'No se pudo tomar la foto. Intenta de nuevo.')
      stepRef.current = 'first'
      neutralSeen.current = false
      setStep('first')
      setFirstDone(false)
      setSecondDone(false)
    } finally {
      setCapturing(false)
    }
  }, [checkinId])

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

  const instruction = () => {
    if (capturing || step === 'done') return { text: '✓ Capturando…', color: '#16a34a' }
    const currentDir = step === 'first' ? order[0] : order[1]
    const arrow = currentDir === 'left' ? '←' : '→'
    const side = currentDir === 'left' ? 'izquierda' : 'derecha'
    const prefix = step === 'second' ? 'Ahora inclínalo a la ' : 'Inclina el teléfono a la '
    return { text: `${prefix}${side} ${arrow}`, color: step === 'second' ? '#f59e0b' : '#7a9bbf' }
  }

  const { text, color } = instruction()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Paso 1 de 3</Text>
        <Text style={styles.title}>Verifica que eres tú</Text>
        <Text style={styles.subtitle}>
          Mira a la cámara e inclina el teléfono siguiendo las instrucciones.
        </Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        >
          <View style={styles.ovalGuide} />

          {/* Flechas en el orden aleatorio del challenge */}
          <View style={styles.arrowRow}>
            <Text style={[styles.arrow, firstDone ? styles.arrowDone : styles.arrowPending]}>
              {order[0] === 'left' ? '←' : '→'}
            </Text>
            <Text style={[styles.arrow, secondDone ? styles.arrowDone : styles.arrowPending]}>
              {order[1] === 'left' ? '←' : '→'}
            </Text>
          </View>
        </CameraView>
      </View>

      <View style={styles.footer}>
        {capturing && <ActivityIndicator color="#2563eb" size="small" style={{ marginBottom: 4 }} />}
        <Text style={[styles.instruction, { color }]}>{text}</Text>
        <Text style={styles.hint}>La captura es automática al completar el movimiento</Text>
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
    position: 'absolute', alignSelf: 'center', top: '10%',
    width: 200, height: 260, borderRadius: 120,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed',
  },
  arrowRow: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 40,
  },
  arrow: { fontSize: 32, fontWeight: '700' },
  arrowPending: { color: 'rgba(255,255,255,0.3)' },
  arrowDone: { color: '#16a34a' },
  footer: { alignItems: 'center', paddingBottom: 48, paddingTop: 16, gap: 6 },
  instruction: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  hint: { color: '#4a6a8a', fontSize: 12, textAlign: 'center' },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, marginTop: 24 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
