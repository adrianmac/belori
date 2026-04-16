/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CONFIRM_KEYWORDS  = ['yes', 'confirm', 'confirmed', 'si', 'sí', 'yeah', 'yep', 'ok', 'okay', '1']
const CANCEL_KEYWORDS   = ['no', 'cancel', 'cancelar', 'nope', 'stop', '2']

/** Send a TwiML SMS reply */
function twimlReply(msg: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } })
}

/**
 * Validate a Twilio webhook signature using HMAC-SHA1.
 * Algorithm: sort POST params alphabetically, append key+value to the full URL,
 * HMAC-SHA1 sign with auth token, base64-encode, compare to X-Twilio-Signature.
 */
async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  const sortedKeys = Object.keys(params).sort()
  let str = url
  for (const key of sortedKeys) {
    str += key + params[key]
  }
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(str))
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return computed === signature
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase    = createClient(supabaseUrl, serviceKey)

    // Twilio sends form-encoded data
    const contentType = req.headers.get('content-type') || ''
    let fromNumber = '', toNumber = '', body = '', messageSid = ''
    let allParams: Record<string, string> = {}

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const rawText = await req.text()
      const params = new URLSearchParams(rawText)
      fromNumber  = params.get('From') || ''
      toNumber    = params.get('To')   || ''
      body        = params.get('Body') || ''
      messageSid  = params.get('MessageSid') || ''
      for (const [k, v] of params.entries()) {
        allParams[k] = v
      }
    } else {
      const data  = await req.json()
      fromNumber  = data.From || ''
      toNumber    = data.To   || ''
      body        = data.Body || ''
      messageSid  = data.MessageSid || ''
      allParams   = data as Record<string, string>
    }

    // ── Twilio signature verification ───────────────────────────────────────
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    if (authToken) {
      const twilioSig = req.headers.get('x-twilio-signature') || ''
      const requestUrl = req.url
      const isValid = await validateTwilioSignature(authToken, twilioSig, requestUrl, allParams)
      if (!isValid) {
        console.warn('[sms-inbound] Invalid Twilio signature — request rejected')
        return new Response('Forbidden', { status: 403 })
      }
    } else {
      console.warn('[sms-inbound] TWILIO_AUTH_TOKEN not set — skipping signature verification (dev mode)')
    }

    if (!fromNumber || !body) {
      return new Response('<Response/>', { status: 400, headers: { 'Content-Type': 'text/xml' } })
    }

    // ── Resolve boutique ────────────────────────────────────────────────────
    let boutiqueId: string | null = null
    const { data: boutiqueByPhone } = await supabase
      .from('boutiques').select('id').eq('phone', toNumber).maybeSingle()
    if (boutiqueByPhone?.id) {
      boutiqueId = boutiqueByPhone.id
    } else {
      const { data: firstBoutique } = await supabase
        .from('boutiques').select('id').limit(1).single()
      boutiqueId = firstBoutique?.id || null
    }

    if (!boutiqueId) {
      console.error('[sms-inbound] No boutique found for To:', toNumber)
      return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
    }

    // ── Resolve client ──────────────────────────────────────────────────────
    const { data: client } = await supabase
      .from('clients').select('id, name')
      .eq('boutique_id', boutiqueId).eq('phone', fromNumber).maybeSingle()

    // ── Store inbound message ───────────────────────────────────────────────
    await supabase.from('sms_messages').insert({
      boutique_id: boutiqueId,
      client_id:   client?.id || null,
      direction:   'inbound',
      body,
      twilio_sid:  messageSid || null,
      status:      'received',
    })

    // ── Appointment confirmation / cancellation ─────────────────────────────
    const normalized = body.trim().toLowerCase().replace(/[^a-záéíóúñ\d]/g, '')

    const isConfirm = CONFIRM_KEYWORDS.some(k => normalized === k || normalized.startsWith(k + ' '))
    const isCancel  = CANCEL_KEYWORDS.some(k  => normalized === k || normalized.startsWith(k + ' '))

    if ((isConfirm || isCancel) && client?.id) {
      // Find the soonest future unconfirmed appointment for this client
      const today = new Date().toISOString().slice(0, 10)
      const { data: appt } = await supabase
        .from('appointments')
        .select('id, type, date, time, event:events(client:clients(name))')
        .eq('boutique_id', boutiqueId)
        .in('status', ['scheduled', 'pending', null as unknown as string])
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (appt) {
        const newStatus = isConfirm ? 'confirmed' : 'cancelled'
        await supabase
          .from('appointments')
          .update({ status: newStatus })
          .eq('id', appt.id)

        const typeLabel = (appt.type || 'appointment').replace(/_/g, ' ')
        const dateLabel = appt.date
          ? new Date(appt.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : ''

        if (isConfirm) {
          return twimlReply(
            `✅ Confirmed! We'll see you for your ${typeLabel}${dateLabel ? ` on ${dateLabel}` : ''}. Reply CANCEL if plans change.`
          )
        } else {
          return twimlReply(
            `Your ${typeLabel}${dateLabel ? ` on ${dateLabel}` : ''} has been cancelled. Please call us to reschedule. 💕`
          )
        }
      }
    }

    // ── Default: no auto-reply ──────────────────────────────────────────────
    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })

  } catch (err) {
    console.error('[sms-inbound]', err)
    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
  }
})
