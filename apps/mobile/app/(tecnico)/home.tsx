import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/hooks/useAuth'
import { supabase } from '../../src/lib/supabase'

interface Case {
  id: string
  case_number: string
  status: string
  address: string
  city: string
  onboarding_done_at: string | null
  imputado_id: string | null
}

const STATUS_LABEL: Record<string, string> = {
  onboarding: 'Pendiente onboarding',
  active: 'Activo',
  suspended: 'Suspendido',
  closed: 'Cerrado',
}
const STATUS_COLOR: Record<string, string> = {
  onboarding: '#f97316',
  active: '#22c55e',
  suspended: '#eab308',
  closed: '#6b7280',
}

export default function TecnicoHome() {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile) loadCases() }, [profile])

  async function loadCases() {
    setLoading(true)
    const { data } = await supabase
      .from('cases')
      .select('id, case_number, status, address, city, onboarding_done_at, imputado_id')
      .eq('technician_id', profile!.id)
      .order('created_at', { ascending: false })
    setCases(data ?? [])
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {profile?.full_name?.split(' ')[0]}</Text>
          <Text style={styles.subtitle}>Casos asignados</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2563eb" size="large" />
        </View>
      ) : cases.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No tienes casos asignados aún.</Text>
        </View>
      ) : (
        <FlatList
          data={cases}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(tecnico)/onboarding/${item.id}/identidad`)}
              disabled={item.status !== 'onboarding'}
            >
              <View style={styles.cardTop}>
                <Text style={styles.caseNumber}>{item.case_number}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.name}>Caso {item.case_number}</Text>
              <Text style={styles.address}>{item.address}, {item.city}</Text>
              {item.status === 'onboarding' && (
                <View style={styles.actionRow}>
                  <Text style={styles.actionText}>Iniciar onboarding →</Text>
                </View>
              )}
              {item.onboarding_done_at && (
                <Text style={styles.doneText}>
                  Completado {new Date(item.onboarding_done_at).toLocaleDateString('es-CO')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 24, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#1a3a5c',
  },
  greeting: { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 13, color: '#7a9bbf', marginTop: 2 },
  logoutBtn: { padding: 8 },
  logoutText: { color: '#4a6a8a', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#7a9bbf', fontSize: 15 },
  card: {
    backgroundColor: '#1a3a5c', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#2563eb22',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  caseNumber: { fontSize: 13, fontFamily: 'monospace', color: '#7a9bbf' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 4 },
  address: { fontSize: 13, color: '#7a9bbf', marginBottom: 8 },
  actionRow: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#2563eb33', paddingTop: 10 },
  actionText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  doneText: { color: '#22c55e', fontSize: 12, marginTop: 4 },
})
