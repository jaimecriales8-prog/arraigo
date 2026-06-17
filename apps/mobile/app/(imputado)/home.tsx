import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/hooks/useAuth'
import { useCase } from '../../src/hooks/useCase'

export default function HomeScreen() {
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const { caseData, pendingCheckin, loading, reload } = useCase()

  const now = new Date()
  const windowOpen = pendingCheckin
    ? new Date(pendingCheckin.scheduled_at) <= now &&
      new Date(pendingCheckin.window_closes_at) >= now
    : false

  // Próximo check-in programado (aunque no esté en ventana aún)
  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor="#7a9bbf" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola,</Text>
          <Text style={styles.name}>{profile?.full_name?.split(' ')[0]}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Estado del caso */}
      {caseData && (
        <View style={styles.caseCard}>
          <Text style={styles.caseLabel}>Caso #{caseData.case_number}</Text>
          <Text style={styles.caseAddress}>{caseData.address}</Text>
          <Text style={styles.caseCity}>{caseData.city}</Text>
          <View style={[styles.statusBadge, { backgroundColor: '#16a34a22' }]}>
            <Text style={[styles.statusText, { color: '#16a34a' }]}>● Monitoreo activo</Text>
          </View>
        </View>
      )}

      {/* Check-in */}
      {!caseData && !loading && (
        <View style={styles.noCase}>
          <Text style={styles.noCaseText}>No tienes un caso activo asignado.</Text>
          <Text style={styles.noCaseSubtext}>Contacta a tu funcionario.</Text>
        </View>
      )}

      {caseData && (
        <View style={styles.checkinSection}>
          <Text style={styles.sectionTitle}>Verificación</Text>

          {windowOpen && pendingCheckin ? (
            // VENTANA ABIERTA — mostrar botón de check-in
            <View style={styles.checkinCard}>
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>🔔 Verificación pendiente</Text>
              </View>
              <Text style={styles.checkinTime}>
                Cierra a las {formatTime(pendingCheckin.window_closes_at)}
              </Text>
              <Text style={styles.checkinSubtext}>
                Debes verificar tu presencia ahora
              </Text>
              <TouchableOpacity
                style={styles.checkinBtn}
                onPress={() => router.push({
                  pathname: '/(imputado)/checkin/selfie',
                  params: { checkinId: pendingCheckin.id },
                })}
              >
                <Text style={styles.checkinBtnText}>Iniciar verificación →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // SIN VENTANA ABIERTA — mostrar próximos horarios
            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleTitle}>Horarios de verificación</Text>
              {(caseData.checkin_times as string[]).map((time) => (
                <View key={time} style={styles.scheduleRow}>
                  <Text style={styles.scheduleIcon}>🕐</Text>
                  <Text style={styles.scheduleTime}>{time}</Text>
                </View>
              ))}
              <Text style={styles.scheduleNote}>
                Recibirás una notificación 5 minutos antes de cada verificación.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Instrucciones */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>¿Qué pasa en la verificación?</Text>
        <Text style={styles.infoStep}>📸  Tomamos una foto de tu cara</Text>
        <Text style={styles.infoStep}>📍  Verificamos tu ubicación GPS</Text>
        <Text style={styles.infoStep}>🏠  Confirmamos que estás en tu domicilio</Text>
        <Text style={styles.infoNote}>
          El proceso toma menos de 60 segundos.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  greeting: { fontSize: 16, color: '#7a9bbf' },
  name: { fontSize: 26, fontWeight: '700', color: '#fff' },
  logoutBtn: { padding: 8 },
  logoutText: { color: '#4a6a8a', fontSize: 14 },

  caseCard: {
    backgroundColor: '#1a3a5c', borderRadius: 16, padding: 20, marginBottom: 24,
  },
  caseLabel: { fontSize: 12, color: '#7a9bbf', marginBottom: 4 },
  caseAddress: { fontSize: 16, color: '#fff', fontWeight: '600' },
  caseCity: { fontSize: 14, color: '#7a9bbf', marginBottom: 12 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },

  noCase: { alignItems: 'center', padding: 40 },
  noCaseText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  noCaseSubtext: { color: '#7a9bbf', fontSize: 14, marginTop: 8 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12 },
  checkinSection: { marginBottom: 24 },

  checkinCard: {
    backgroundColor: '#1e3a5f', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#2563eb',
  },
  urgentBadge: {
    backgroundColor: '#2563eb22', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 16,
  },
  urgentText: { color: '#60a5fa', fontSize: 13, fontWeight: '600' },
  checkinTime: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  checkinSubtext: { fontSize: 14, color: '#7a9bbf', marginBottom: 24 },
  checkinBtn: {
    backgroundColor: '#2563eb', borderRadius: 12, padding: 18, alignItems: 'center',
  },
  checkinBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  scheduleCard: { backgroundColor: '#1a3a5c', borderRadius: 16, padding: 20 },
  scheduleTitle: { fontSize: 15, color: '#7a9bbf', marginBottom: 16 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  scheduleIcon: { fontSize: 18, marginRight: 12 },
  scheduleTime: { fontSize: 18, color: '#fff', fontWeight: '600' },
  scheduleNote: { fontSize: 12, color: '#4a6a8a', marginTop: 12 },

  infoCard: { backgroundColor: '#1a3a5c', borderRadius: 16, padding: 20 },
  infoTitle: { fontSize: 15, color: '#7a9bbf', marginBottom: 16 },
  infoStep: { fontSize: 14, color: '#cbd5e1', marginBottom: 10 },
  infoNote: { fontSize: 12, color: '#4a6a8a', marginTop: 8 },
})
