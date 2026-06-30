import { Stack } from 'expo-router'

export default function TecnicoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="onboarding/[caseId]/identidad" />
      <Stack.Screen name="onboarding/[caseId]/gps" />
      <Stack.Screen name="onboarding/[caseId]/scan" />
      <Stack.Screen name="onboarding/[caseId]/confirmar" />
    </Stack>
  )
}
