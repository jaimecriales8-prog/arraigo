import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useCase } from '../../../src/hooks/useCase'
import { supabase, ensureFreshSession } from '../../../src/lib/supabase'

export default function TrabajoScreen() {
  const router = useRouter()
  const { caseData, loading, reload } = useCase()
  const [reason, setReason] = useState('')
  const [requesting, setRequesting] = useState(false)

  if (loading || !caseData) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  const { work_registered_at, work_change_requested_at, work_change_approved_at } = caseData

  async function solicitarCambio() {
    if (!reason.trim()) {
      Alert.alert('Motivo requerido', 'Explica brevemente por qué necesitas cambiar el sitio de trabajo.')
      return
    }
    setRequesting(true)
    try {
      await ensureFreshSession()
      const { error } = await supabase.functions.invoke('request-work-location-change', {
        body: { caseId: caseData!.id, reason: reason.trim() },
      })
      if (error) throw error
      setReason('')
      reload()
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo enviar la solicitud.')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sitio de trabajo</Text>
        <Text style={styles.subtitle}>Ubicación adicional autorizada para tus check-ins.</Text>
      </View>

      <View style={styles.body}>
        {!work_registered_at && (
          <View style={styles.card}>
            <Text style={styles.cardIcon}>🏢</Text>
            <Text style={styles.cardTitle}>Aún no tienes un sitio de trabajo registrado</Text>
            <Text style={styles.cardText}>
              Regístralo una sola vez con tu ubicación actual y una foto del lugar. Para cambiarlo después necesitarás autorización.
            </Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.push('/(imputado)/trabajo/registrar/selfie')}
            >
              <Text style={styles.btnText}>Registrar sitio de trabajo</Text>
            </TouchableOpacity>
          </View>
        )}

        {work_registered_at && work_change_approved_at && (
          <View style={styles.card}>
            <Text style={styles.cardIcon}>✅</Text>
            <Text style={styles.cardTitle}>Cambio autorizado</Text>
            <Text style={styles.cardText}>
              Un funcionario autorizó tu solicitud. Puedes volver a capturar tu sitio de trabajo.
            </Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.push('/(imputado)/trabajo/registrar/selfie')}
            >
              <Text style={styles.btnText}>Registrar nuevo sitio de trabajo</Text>
            </TouchableOpacity>
          </View>
        )}

        {work_registered_at && !work_change_approved_at && work_change_requested_at && (
          <View style={styles.card}>
            <Text style={styles.cardIcon}>⏳</Text>
            <Text style={styles.cardTitle}>Solicitud enviada</Text>
            <Text style={styles.cardText}>
              Pendiente de aprobación por tu funcionario judicial. Te avisaremos cuando esté lista.
            </Text>
          </View>
        )}

        {work_registered_at && !work_change_approved_at && !work_change_requested_at && (
          <View style={styles.card}>
            <Text style={styles.cardIcon}>🏢</Text>
            <Text style={styles.cardTitle}>Sitio de trabajo registrado</Text>
            <Text style={styles.cardText}>
              Registrado el {new Date(work_registered_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </Text>

            <Text style={styles.sectionLabel}>¿Necesitas cambiarlo?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Motivo del cambio…"
              placeholderTextColor="#4a6a8a"
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <TouchableOpacity
              style={[styles.btnSecondary, requesting && styles.btnDisabled]}
              onPress={solicitarCambio}
              disabled={requesting}
            >
              <Text style={styles.btnSecondaryText}>{requesting ? 'Enviando…' : 'Solicitar cambio'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(imputado)/home')}>
        <Text style={styles.backBtnText}>← Volver al inicio</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#7a9bbf', lineHeight: 20 },
  body: { flex: 1, padding: 24 },
  card: { backgroundColor: '#1a3a5c', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#2563eb22' },
  cardIcon: { fontSize: 40, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  cardText: { fontSize: 14, color: '#7a9bbf', lineHeight: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 12, color: '#7a9bbf', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 8 },
  textInput: { backgroundColor: '#0f2236', borderRadius: 10, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#2563eb33', fontSize: 14, minHeight: 60, textAlignVertical: 'top', marginBottom: 12 },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSecondary: { backgroundColor: '#2563eb22', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2563eb' },
  btnDisabled: { opacity: 0.6 },
  btnSecondaryText: { color: '#60a5fa', fontSize: 14, fontWeight: '700' },
  backBtn: { padding: 24, alignItems: 'center' },
  backBtnText: { color: '#4a6a8a', fontSize: 14 },
})
