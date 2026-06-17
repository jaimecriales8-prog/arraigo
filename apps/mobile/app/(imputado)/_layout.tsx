import { Stack } from 'expo-router'

export default function ImputadoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="checkin/selfie" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="checkin/gps" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="checkin/escena" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="checkin/resultado" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  )
}
