import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { AppState } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Adaptador de SecureStore para persistir sesión de forma segura en el dispositivo
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// En React Native el auto-refresh solo debe correr con la app en primer plano.
// Sin esto, tras estar la app en segundo plano el token puede quedar expirado
// (causa de fallos intermitentes en check-ins a la hora programada).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})

// Garantiza un token válido antes de una operación autenticada.
// Refresca si el access token expira en < 60 s (o si ya expiró).
export async function ensureFreshSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const expiresAt = session.expires_at ?? 0 // epoch segundos
  const secondsLeft = expiresAt - Math.floor(Date.now() / 1000)
  if (secondsLeft < 60) {
    await supabase.auth.refreshSession()
  }
}
