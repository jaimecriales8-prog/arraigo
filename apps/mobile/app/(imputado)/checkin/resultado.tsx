import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Application from 'expo-application'
import { supabase, ensureFreshSession } from '../../../src/lib/supabase'
import { useCheckinStore } from '../../../src/hooks/useCheckinStore'
import { uploadPhoto } from '../../../src/lib/storage'

type ResultStatus = 'submitting' | 'passed' | 'failed' | 'error'

export default function ResultadoScreen() {
  const router = useRouter()
  const { checkinId } = useLocalSearchParams<{ checkinId: string }>()
  const store = useCheckinStore()
  const [status, setStatus] = useState<ResultStatus>('submitting')
  const [overallScore, setOverallScore] = useState<number | null>(null)
  const [failReason, setFailReason] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')

  useEffect(() => { submit() }, [])

  async function submit() {
    setStatus('submitting')
    try {
      // Asegurar token válido: la app pudo estar en segundo plano hasta la hora del check-in
      await ensureFreshSession()

      const isFacetec = store.livenessMethod === 'facetec'

      // 1. Subir fotos a Storage. En modo FaceTec no hay selfie que subir (el FaceMap lo procesa FaceTec).
      const selfieUrl = isFacetec
        ? null
        : await uploadPhoto(store.selfieBase64!, `checkins/${checkinId}/selfie.jpg`)
      const sceneUrl = await uploadPhoto(store.sceneBase64!, `checkins/${checkinId}/scene.jpg`)

      // 2. Llamar Edge Function que verifica y puntúa
      const { data, error } = await supabase.functions.invoke('process-checkin', {
        body: {
          checkinId,
          selfieUrl,
          sceneUrl,
          sceneCheckpointId: store.sceneCheckpointId,
          gpsLat: store.gpsLat,
          gpsLng: store.gpsLng,
          gpsAccuracyM: store.gpsAccuracyM,
          gpsIsMock: store.gpsIsMock,
          livenessMethod: store.livenessMethod,
          facetecLivenessPassed: store.facetecLivenessPassed,
          facetecMatchScore: store.facetecMatchScore,
          facetecSessionId: store.facetecSessionId,
          appVersion: Application.nativeApplicationVersion ?? '1.0.0',
          osVersion: `${Application.nativeBuildVersion}`,
          // La marca de sorpresa completada la hace el servidor (no el cliente)
          surpriseVerificationId: store.surpriseVerificationId ?? null,
        },
      })

      if (error) throw error

      setOverallScore(data.overall_score)
      setStatus(data.overall_passed ? 'passed' : 'failed')
      setFailReason(data.failure_reason ?? null)

      store.reset()
    } catch (e: any) {
      // Extraer el detalle real del cuerpo de la Edge Function (FunctionsHttpError)
      let detail = ''
      try {
        const body = await e?.context?.json?.()
        detail = body?.detail || body?.error || ''
      } catch { /* sin cuerpo JSON */ }
      const msg = detail || e?.message || e?.error || 'Error desconocido'
      console.error('[resultado] error:', msg)
      setErrorMsg(msg)
      setStatus('error')
    }
  }

  return (
    <View style={styles.container}>
      {status === 'submitting' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.submittingTitle}>Verificando…</Text>
          <Text style={styles.submittingHint}>Esto puede tomar unos segundos</Text>
        </View>
      )}

      {status === 'passed' && (
        <View style={styles.center}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>✓</Text>
          </View>
          <Text style={styles.passedTitle}>Verificación exitosa</Text>
          <Text style={styles.scoreText}>Puntuación: {Math.round(overallScore ?? 0)}/100</Text>
          <Text style={styles.passedHint}>
            Tu presencia en el domicilio ha sido registrada correctamente.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(imputado)/home')}>
            <Text style={styles.btnText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'failed' && (
        <View style={styles.center}>
          <View style={[styles.iconCircle, styles.iconCircleFail]}>
            <Text style={styles.icon}>!</Text>
          </View>
          <Text style={styles.failedTitle}>Verificación fallida</Text>
          {failReason && <Text style={styles.failReason}>{failReason}</Text>}
          <Text style={styles.failedHint}>
            Esta verificación ha sido registrada. Tu funcionario será notificado.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(imputado)/home')}>
            <Text style={styles.btnText}>Entendido</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.center}>
          <View style={[styles.iconCircle, styles.iconCircleError]}>
            <Text style={styles.icon}>✕</Text>
          </View>
          <Text style={styles.errorTitle}>Error de conexión</Text>
          <Text style={styles.errorHint} selectable={true}>
            {errorMsg || 'No se pudo enviar la verificación.'}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={submit}>
            <Text style={styles.btnText}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(imputado)/home')}>
            <Text style={styles.secondaryBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  iconCircleFail: { backgroundColor: '#d97706' },
  iconCircleError: { backgroundColor: '#dc2626' },
  icon: { fontSize: 48, color: '#fff', fontWeight: '700' },
  submittingTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  submittingHint: { fontSize: 14, color: '#7a9bbf' },
  passedTitle: { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center' },
  scoreText: { fontSize: 16, color: '#7a9bbf' },
  passedHint: { fontSize: 14, color: '#7a9bbf', textAlign: 'center', lineHeight: 20 },
  failedTitle: { fontSize: 24, fontWeight: '700', color: '#f97316', textAlign: 'center' },
  failReason: { fontSize: 14, color: '#fed7aa', textAlign: 'center' },
  failedHint: { fontSize: 14, color: '#7a9bbf', textAlign: 'center', lineHeight: 20 },
  errorTitle: { fontSize: 24, fontWeight: '700', color: '#f87171', textAlign: 'center' },
  errorHint: { fontSize: 14, color: '#7a9bbf', textAlign: 'center', lineHeight: 20 },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 40, paddingVertical: 16, marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12 },
  secondaryBtnText: { color: '#4a6a8a', fontSize: 15 },
})
