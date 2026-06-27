import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function SorpresaScreen() {
  const { verification_id, expires_at } = useLocalSearchParams<{ verification_id: string; expires_at: string }>()
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const expiresMs = new Date(expires_at).getTime()
    const update = () => {
      const diff = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000))
      setSecondsLeft(diff)
      if (diff === 0) setExpired(true)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [expires_at])

  useEffect(() => {
    if (!expired) return
    supabase
      .from('surprise_verifications')
      .update({ status: 'expired' })
      .eq('id', verification_id)
  }, [expired, verification_id])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  function startCheckin() {
    router.push({
      pathname: '/(imputado)/checkin/selfie',
      params: { surprise_id: verification_id }
    })
  }

  if (expired) {
    return (
      <View style={[styles.container, styles.expiredBg]}>
        <Text style={styles.icon}>🚨</Text>
        <Text style={styles.title}>Tiempo agotado</Text>
        <Text style={styles.subtitle}>
          No completaste la verificación a tiempo. El juzgado ha sido notificado.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>Verificación sorpresa</Text>
      <Text style={styles.subtitle}>
        El juzgado ha solicitado una verificación de tu presencia. Debes completarla antes de que venza el tiempo.
      </Text>

      <View style={styles.timer}>
        <Text style={styles.timerText}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </Text>
        <Text style={styles.timerLabel}>tiempo restante</Text>
      </View>

      <Pressable style={styles.btn} onPress={startCheckin}>
        <Text style={styles.btnText}>Iniciar verificación ahora</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  expiredBg: { backgroundColor: '#1a0a0a' },
  icon: { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#7a9bbf', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  timer: {
    backgroundColor: '#0f2236',
    borderRadius: 20,
    paddingHorizontal: 48,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  timerText: { fontSize: 56, fontWeight: '700', color: '#f59e0b', fontVariant: ['tabular-nums'] },
  timerLabel: { fontSize: 13, color: '#7a9bbf', marginTop: 4 },
  btn: {
    backgroundColor: '#1e90ff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
