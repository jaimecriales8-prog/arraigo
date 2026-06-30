import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../../src/lib/supabase'
import { uploadPhoto } from '../../../../src/lib/storage'

type Step = 'review' | 'saving' | 'done' | 'error'

export default function OnboardingConfirmar() {
  const { caseId, lat, lng, selfieBase64, checkpointsJson } = useLocalSearchParams<{
    caseId: string; lat: string; lng: string; selfieBase64: string; checkpointsJson: string
  }>()
  const router = useRouter()
  const [step, setStep] = useState<Step>('review')
  const [progress, setProgress] = useState('')

  const checkpoints: { label: string; base64: string }[] = checkpointsJson ? JSON.parse(checkpointsJson) : []

  async function guardar() {
    setStep('saving')
    try {
      // 1. Subir selfie de verificación de identidad como foto de referencia
      setProgress('Subiendo foto del imputado…')
      const fotoUrl = await uploadPhoto(selfieBase64, `onboarding/${caseId}/referencia.jpg`)

      // 2. Subir selfie + checkpoints en paralelo
      setProgress('Subiendo escaneo del domicilio…')
      const checkpointUrls = await Promise.all(
        checkpoints.map(async (cp, i) => {
          const url = await uploadPhoto(cp.base64, `onboarding/${caseId}/checkpoint_${i}.jpg`)
          return { label: cp.label, url }
        })
      )

      // 3. Actualizar el caso: location (PostGIS) + reference_photo_url + onboarding_done_at
      setProgress('Guardando datos del caso…')
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          location: `POINT(${lng} ${lat})`,
          onboarding_done_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', caseId)

      if (caseError) throw caseError

      // 4. Guardar referencia facial en el perfil del imputado
      // (se obtiene el imputado_id desde el caso)
      const { data: caso } = await supabase
        .from('cases')
        .select('imputado_id')
        .eq('id', caseId)
        .single()

      if (caso?.imputado_id) {
        await supabase
          .from('profiles')
          .update({ reference_photo_url: fotoUrl } as any)
          .eq('id', caso.imputado_id)
      }

      // 5. Insertar checkpoints
      setProgress('Guardando puntos de verificación…')
      const { data: { user } } = await supabase.auth.getUser()
      const { error: cpError } = await supabase
        .from('checkpoints')
        .insert(checkpointUrls.map(cp => ({
          case_id: caseId,
          label: cp.label,
          photo_url: cp.url,
          is_active: true,
          created_by: user!.id,
        })))

      if (cpError) throw cpError

      setStep('done')
    } catch (e: any) {
      console.error(e)
      setProgress(e?.message ?? 'Error desconocido')
      setStep('error')
    }
  }

  if (step === 'saving') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.progressText}>{progress}</Text>
      </View>
    )
  }

  if (step === 'done') {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.doneCircle}>
          <Text style={styles.doneIcon}>✓</Text>
        </View>
        <Text style={styles.doneTitle}>Onboarding completado</Text>
        <Text style={styles.doneSubtitle}>
          El caso está activo. El imputado puede comenzar a hacer check-ins.
        </Text>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tecnico)/home')}>
          <Text style={styles.homeBtnText}>Volver a mis casos</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (step === 'error') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorTitle}>Error al guardar</Text>
        <Text style={styles.errorMsg}>{progress}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={guardar}>
          <Text style={styles.retryBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 20 }}>
      <Text style={styles.step}>Paso 4 de 4</Text>
      <Text style={styles.title}>Confirmar onboarding</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Resumen</Text>
        <Row label="GPS capturado" value={`${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}`} />
        <Row label="Identidad verificada" value="✓ Cédula + selfie" ok />
        <Row label="Áreas escaneadas" value={`${checkpoints.length} punto${checkpoints.length !== 1 ? 's' : ''}`} />
        {checkpoints.map((cp, i) => (
          <Row key={i} label={`  ${i + 1}.`} value={cp.label} />
        ))}
      </View>

      <Text style={styles.warningText}>
        Una vez confirmado, el caso pasará a estado Activo y no se podrá modificar el GPS de referencia.
      </Text>

      <TouchableOpacity style={styles.confirmBtn} onPress={guardar}>
        <Text style={styles.confirmBtnText}>Confirmar y activar caso</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Volver atrás</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1a3a5c' }}>
      <Text style={{ color: '#7a9bbf', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: ok ? '#22c55e' : '#fff', fontSize: 13, fontWeight: '500' }}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  step: { fontSize: 12, color: '#2563eb', fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  summaryCard: { backgroundColor: '#1a3a5c', borderRadius: 16, padding: 20, gap: 2, borderWidth: 1, borderColor: '#2563eb22' },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 12 },
  warningText: { fontSize: 13, color: '#f97316', lineHeight: 18, backgroundColor: '#f9731611', borderRadius: 8, padding: 12 },
  confirmBtn: { backgroundColor: '#16a34a', borderRadius: 12, padding: 16, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backBtnText: { color: '#4a6a8a', fontSize: 14 },
  progressText: { color: '#7a9bbf', fontSize: 15, textAlign: 'center', marginTop: 16 },
  doneCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  doneIcon: { fontSize: 48, color: '#fff', fontWeight: '700' },
  doneTitle: { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center' },
  doneSubtitle: { fontSize: 14, color: '#7a9bbf', textAlign: 'center', lineHeight: 20 },
  homeBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 40, paddingVertical: 16, marginTop: 8 },
  homeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: '#f87171' },
  errorMsg: { fontSize: 13, color: '#7a9bbf', textAlign: 'center' },
  retryBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
})
