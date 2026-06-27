import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications(userId?: string) {
  const notificationListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()

  useEffect(() => {
    if (!userId) return

    registerForPushNotifications(userId)

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data
      if (data?.type === 'surprise') {
        router.push({
          pathname: '/(imputado)/checkin/sorpresa',
          params: { verification_id: data.verification_id, expires_at: data.expires_at }
        })
      }
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      if (data?.type === 'surprise') {
        router.push({
          pathname: '/(imputado)/checkin/sorpresa',
          params: { verification_id: data.verification_id, expires_at: data.expires_at }
        })
      }
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [userId])
}

async function registerForPushNotifications(userId: string) {
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return

  const token = (await Notifications.getExpoPushTokenAsync()).data
  await supabase.from('profiles').update({ push_token: token }).eq('id', userId)
}
