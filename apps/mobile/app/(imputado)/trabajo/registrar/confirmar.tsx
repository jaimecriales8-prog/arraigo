import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase, ensureFreshSession } from '../../../../src/lib/supabase'
import { useWorkLocationStore } from '../../../../src/hooks/useWorkLocationStore'
import { useCase } from '../../../../src/hooks/useCase'
import { uploadPhoto } from '../../../../src/lib/storage'

type Status = 'submitting' | 'done' | 'error'

export default function TrabajoConfirmarScreen() {
  const router = useRouter()
  const store = useWorkLocationStore()
  const { caseData } = useCase()
  const [status, setStatus] = useState<Status>('submitting')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { if (caseData?.id) submit() }, [caseData?.id])

  async function submit() {
    setStatus('submitting')
    try {
      await ensureFreshSession()

      const photoUrl = await uploadPhoto(store.sceneBase64!, `work-locations/${caseData!.id}/scene.jpg`)
      // En modo acelerómetro (sin FaceTec) se sube el selfie como respaldo de
      // verificación; con FaceTec el veredicto ya quedó en facetec_sessions.
      const selfieUrl = store.selfieBase64
        ? await uploadPhoto(store.selfieBase64, `work-locations/${caseData!.id}/selfie.jpg`)
        : null

      const { error } = await supabase.functions.invoke('register-work-location', {
        body: {
          caseId: caseData!.id,
          photoUrl,
          gpsLat: store.gpsLat,
          gpsLng: store.gpsLng,
          gpsAccuracyM: store.gpsAccuracyM,
          gpsIsMock: store.gpsIsMock,
          selfieUrl,
        },
      })

      if (error) throw error

      store.reset()
      setStatus('done')
    } catch (e: any) {
      let detail = ''
      try {
        const body = await e?.context?.json?.()
        detail = body?.error || body?.detail || ''
      } catch { /* sin cuerpo JSON */ }
      setErrorMsg(detail || e?.message || 'Error desconocido')
      setStatus('error')
    }
  }

  return (
    <View style={styles.container}>
      {status === 'submitting' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.title}>Registrando sitio de trabajo…</Text>
        </View>
      )}

      {status === 'done' && (
        <View style={styles.center}>
          <View style={styles.iconCircle}><Text style={styles.icon}>✓</Text></View>
          <Text style={styles.title}>Sitio de trabajo registrado</Text>
          <Text style={styles.hint}>Ya puedes usarlo como ubicación válida en tus check-ins.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(imputado)/home')}>
            <Text style={styles.btnText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.center}>
          <View style={[styles.iconCircle, styles.iconCircleError]}><Text style={styles.icon}>✕</Text></View>
          <Text style={styles.title}>No se pudo registrar</Text>
          <Text style={styles.hint} selectable>{errorMsg}</Text>
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
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  iconCircleError: { backgroundColor: '#dc2626' },
  icon: { fontSize: 48, color: '#fff', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  hint: { fontSize: 14, color: '#7a9bbf', textAlign: 'center', lineHeight: 20 },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 40, paddingVertical: 16, marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12 },
  secondaryBtnText: { color: '#4a6a8a', fontSize: 15 },
})
