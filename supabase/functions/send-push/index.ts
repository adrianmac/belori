/**
 * Belori — send-push Edge Function
 *
 * Sends Web Push notifications to boutique staff/owner via VAPID.
 *
 * POST body: { boutique_id?, user_id?, title, body, url?, icon?, tag? }
 *   - If user_id provided: send only to that user's subscriptions
 *   - If only boutique_id: send to all subscriptions for that boutique
 *
 * Required secrets:
 *   VAPID_PUBLIC_KEY   — base64url-encoded uncompressed P-256 public key
 *   VAPID_PRIVATE_KEY  — base64url-encoded raw P-256 private key (32 bytes)
 *   VAPID_SUBJECT      — mailto: or https: identifier (e.g. mailto:hello@belori.app)
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — injected automatically
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
    console.warn('[send-push] VAPID keys not configured — skipping')
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
    return new Response(JSON.stringify({ error: 'boutique_id or user_id is required' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Check VAPID configuration
  const vapidReady = initVapid()
  if (!vapidReady) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, reason: 'VAPID not configured' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Fetch subscriptions
  let query = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth')
  if (user_id) {
    query = query.eq('user_id', user_id)
  } else if (boutique_id) {
    query = query.eq('boutique_id', boutique_id)
  }

  const { data: subs, error: fetchErr } = await query
  if (fetchErr) {
    console.error('[send-push] fetch error:', fetchErr)
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, reason: 'no subscriptions' }), {
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
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }
      try {
        await webpush.sendNotification(pushSub, payload)
        sent++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired or gone — remove it
          expired.push(sub.id)
        } else {
          console.error('[send-push] delivery error:', (err as Error)?.message, 'endpoint:', sub.endpoint.slice(0, 60))
        }
        failed++
      }
    })
  )

  // Clean up expired subscriptions
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
    console.log(`[send-push] removed ${expired.length} expired subscription(s)`)
  }

  return new Response(JSON.stringify({ sent, failed, total: subs.length }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
