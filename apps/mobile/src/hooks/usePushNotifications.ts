import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// Notificaciones LOCALES programadas según los horarios del caso.
// Repiten a diario en el dispositivo — funcionan con la app cerrada y sin servidor.
// (Push remoto APNS para sorpresas queda para Fase 2; hoy las sorpresas usan polling.)
export function useCheckinNotifications(checkinTimes: string[] | undefined, windowMin: number = 30) {
  const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined)
  const scheduledKey = useRef<string>('')

  useEffect(() => {
    const key = (checkinTimes ?? []).join(',') + `|${windowMin}`
    if (!checkinTimes?.length || scheduledKey.current === key) return
    scheduledKey.current = key

    scheduleAll(checkinTimes, windowMin)

    // Al tocar una notificación: sorpresa → directo al countdown; el resto → home
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined
      if (data?.type === 'surprise' && data.verification_id) {
        router.push({
          pathname: '/(imputado)/checkin/sorpresa',
          params: { verification_id: data.verification_id, expires_at: data.expires_at },
        })
      } else {
        router.push('/(imputado)/home')
      }
    })

    return () => { responseListener.current?.remove() }
  }, [checkinTimes?.join(','), windowMin])
}

// Push remoto (APNs) para verificaciones sorpresa con la app cerrada.
// Registra el token nativo del dispositivo en profiles.push_token;
// trigger-surprise lo usa para enviar directo a APNs.
// Si la capability de push no está activa o el permiso se niega, falla en
// silencio y las sorpresas siguen funcionando por polling.
export function useSurprisePush(userId: string | undefined) {
  const registeredFor = useRef<string | null>(null)

  useEffect(() => {
    if (!userId || registeredFor.current === userId) return
    registeredFor.current = userId

    ;(async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync()
        let finalStatus = existing
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync()
          finalStatus = status
        }
        if (finalStatus !== 'granted') return

        // Token APNs nativo (no Expo Push — no dependemos de EAS)
        const { data: token } = await Notifications.getDevicePushTokenAsync()
        if (token) {
          await supabase.from('profiles').update({ push_token: String(token) }).eq('id', userId)
        }
      } catch (e) {
        // Sin capability de push (build sin entitlement) — polling sigue cubriendo
        console.warn('[push] registro APNs falló:', e)
      }
    })()
  }, [userId])
}

async function scheduleAll(times: string[], windowMin: number) {
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return

  // Reprogramar desde cero para reflejar cambios de horario del caso
  await Notifications.cancelAllScheduledNotificationsAsync()

  for (const time of times) {
    const [hh, mm] = time.split(':').map(Number)
    if (isNaN(hh) || isNaN(mm)) continue

    // Aviso 5 minutos antes
    const pre = new Date(2000, 0, 1, hh, mm)
    pre.setMinutes(pre.getMinutes() - 5)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Verificación próxima',
        body: `Tu verificación de las ${time} inicia en 5 minutos. Prepárate.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: pre.getHours(),
        minute: pre.getMinutes(),
      },
    })

    // Aviso al abrir la ventana
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Verificación pendiente',
        body: `Tu ventana de verificación está abierta. Tienes ${windowMin} minutos para completarla.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hh,
        minute: mm,
      },
    })
  }
}
