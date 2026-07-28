import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useCase } from '../../../src/hooks/useCase'
import { supabase, ensureFreshSession } from '../../../src/lib/supabase'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

export default function CitasScreen() {
  const router = useRouter()
  const { caseData, loading } = useCase()
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  if (loading || !caseData) return <View style={styles.container} />

  async function reportar() {
    if (!DATE_RE.test(date)) {
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD, por ejemplo 2026-08-15.')
      return
    }
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      Alert.alert('Hora inválida', 'Usa el formato HH:MM, por ejemplo 09:30.')
      return
    }
    if (end <= start) {
      Alert.alert('Ventana inválida', 'La hora de fin debe ser posterior a la de inicio.')
      return
    }
    setSending(true)
    try {
      await ensureFreshSession()
      const { error } = await supabase.functions.invoke('report-medical-appointment', {
        body: { caseId: caseData!.id, appointmentDate: date, startTime: start, endTime: end, reason: reason.trim() || undefined },
      })
      if (error) throw error
      setDone(true)
      setDate(''); setStart(''); setEnd(''); setReason('')
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo reportar la cita.')
    } finally {
      setSending(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Cita médica</Text>
        <Text style={styles.subtitle}>
          Avisa con anticipación si tienes una cita médica que coincida con un check-in — queda registrado para tu funcionario.
        </Text>
      </View>

      <View style={styles.body}>
        {done && (
          <View style={[styles.card, { borderColor: '#16a34a55' }]}>
            <Text style={styles.cardIcon}>✅</Text>
            <Text style={styles.cardTitle}>Cita reportada</Text>
            <Text style={styles.cardText}>Tu funcionario puede ver este reporte en tu caso.</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Fecha (AAAA-MM-DD)</Text>
          <TextInput
            style={styles.textInput} placeholder="2026-08-15" placeholderTextColor="#4a6a8a"
            value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation"
          />
          <Text style={styles.sectionLabel}>Hora de inicio (HH:MM)</Text>
          <TextInput
            style={styles.textInput} placeholder="09:00" placeholderTextColor="#4a6a8a"
            value={start} onChangeText={setStart} keyboardType="numbers-and-punctuation"
          />
          <Text style={styles.sectionLabel}>Hora de fin (HH:MM)</Text>
          <TextInput
            style={styles.textInput} placeholder="11:00" placeholderTextColor="#4a6a8a"
            value={end} onChangeText={setEnd} keyboardType="numbers-and-punctuation"
          />
          <Text style={styles.sectionLabel}>Motivo (opcional)</Text>
          <TextInput
            style={[styles.textInput, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Cita con cardiólogo…" placeholderTextColor="#4a6a8a"
            value={reason} onChangeText={setReason} multiline
          />

          <TouchableOpacity style={[styles.btn, sending && styles.btnDisabled]} onPress={reportar} disabled={sending}>
            <Text style={styles.btnText}>{sending ? 'Enviando…' : 'Reportar cita'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(imputado)/home')}>
        <Text style={styles.backBtnText}>← Volver al inicio</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  header: { padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#7a9bbf', lineHeight: 20 },
  body: { padding: 24, gap: 16 },
  card: { backgroundColor: '#1a3a5c', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#2563eb22' },
  cardIcon: { fontSize: 40, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  cardText: { fontSize: 14, color: '#7a9bbf', lineHeight: 20 },
  sectionLabel: { fontSize: 12, color: '#7a9bbf', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 8 },
  textInput: { backgroundColor: '#0f2236', borderRadius: 10, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#2563eb33', fontSize: 14, marginBottom: 4 },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backBtn: { padding: 24, alignItems: 'center' },
  backBtnText: { color: '#4a6a8a', fontSize: 14 },
})
