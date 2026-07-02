import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'

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

    // Al tocar la notificación, llevar directo al inicio (donde está el botón de verificación)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(imputado)/home')
    })

    return () => { responseListener.current?.remove() }
  }, [checkinTimes?.join(','), windowMin])
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
