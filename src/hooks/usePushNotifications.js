import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function usePushNotifications() {
  const { boutique, session } = useAuth()
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window)
    checkSubscription()
  }, [boutique?.id])

  async function checkSubscription() {
    if (!('serviceWorker' in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch { /* ignore */ }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null
    try {
      return await navigator.serviceWorker.register('/sw.js')
    } catch (e) {
      console.error('SW registration failed:', e)
      return null
    }
  }

  async function subscribe() {
    if (!boutique || !session) return
    setLoading(true)
    try {
      const reg = await registerServiceWorker()
      if (!reg) { setLoading(false); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY ? urlBase64ToUint8Array(VAPID_PUBLIC_KEY) : undefined,
      })

      const { endpoint, keys } = sub.toJSON()
      await supabase.from('push_subscriptions').upsert({
        boutique_id: boutique.id,
        user_id: session.user.id,
        endpoint,
        p256dh: keys?.p256dh || '',
        auth: keys?.auth || '',
      }, { onConflict: 'endpoint' })

      setSubscribed(true)
    } catch (e) {
      console.error('Push subscribe failed:', e)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (e) {
      console.error('Push unsubscribe failed:', e)
    } finally {
      setLoading(false)
    }
  }

  return { supported, subscribed, loading, subscribe, unsubscribe }
}
