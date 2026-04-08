/**
 * Belori — push-notify Edge Function
 *
 * Called from the Settings "Send test notification" button and from automations.
 * Uses npm:web-push for proper VAPID JWT signing + AES-GCM payload encryption.
 *
 * Required secrets:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto-injected)
 */

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function initVapid(): boolean {
  const pub  = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  const subj = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@belori.app'
  if (!pub || !priv) {
    console.warn('[push-notify] VAPID keys not configured')
    return false
  }
  webpush.setVapidDetails(subj, pub, priv)
  return true
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { boutique_id, user_id, title, body: msgBody, url, icon, tag } = body as {
    boutique_id?: string
    user_id?: string
    title?: string
    body?: string
    url?: string
    icon?: string
    tag?: string
  }

  if (!title) {
    return new Response(JSON.stringify({ error: 'title is required' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (!boutique_id && !user_id) {
    return new Response(JSON.stringify({ error: 'boutique_id or user_id required' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const vapidReady = initVapid()
  if (!vapidReady) {
    return new Response(JSON.stringify({ sent: 0, reason: 'VAPID not configured' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Fetch subscriptions
  let query = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth')
  if (user_id) {
    query = query.eq('user_id', user_id)
  } else {
    query = query.eq('boutique_id', boutique_id!)
  }

  const { data: subs } = await query
  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const payload = JSON.stringify({
    title,
    body: msgBody || '',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: tag || 'belori',
    data: { url: url || '/' },
  })

  let sent = 0
  let failed = 0
  const expired: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 410 || statusCode === 404) expired.push(sub.id)
        failed++
      }
    })
  )

  // Remove expired subscriptions
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
    console.log(`[push-notify] removed ${expired.length} expired subscription(s)`)
  }

  return new Response(JSON.stringify({ sent, failed, total: subs.length }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
