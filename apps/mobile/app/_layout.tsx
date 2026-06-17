import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useAuth } from '../src/hooks/useAuth'

export default function RootLayout() {
  const { session, profile, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    const inAuth = segments[0] === '(auth)'

    if (!session && !inAuth) {
      router.replace('/(auth)/login')
    } else if (session && profile && inAuth) {
      if (profile.role === 'imputado') router.replace('/(imputado)/home')
      else router.replace('/(auth)/login') // otros roles usan el panel web
    }
  }, [session, profile, loading])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(imputado)" />
    </Stack>
  )
}
