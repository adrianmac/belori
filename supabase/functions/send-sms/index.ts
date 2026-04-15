/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  // Require a valid service-role key or user JWT
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const isServiceKey = token === serviceKey
  let callerUserId: string | null = null

  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }
  if (!isServiceKey) {
    // Verify as user JWT and capture user id for boutique scoping
    const { createClient: mkAnon } = await import('jsr:@supabase/supabase-js@2')
    const anon = mkAnon(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error } = await anon.auth.getUser(token)
    if (error || !user) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    callerUserId = user.id
  }

  try {
    const { client_id, message, channel } = await req.json()
    // channel: 'sms' (default) | 'whatsapp'
    const useWhatsApp = channel === 'whatsapp'

    if (!client_id || !message) {
      return new Response(
        JSON.stringify({ ok: false, error: 'client_id and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
    const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')!
    const whatsappFrom = Deno.env.get('TWILIO_WHATSAPP_FROM') || `whatsapp:${fromNumber}`

    const supabase = createClient(supabaseUrl, serviceKey)

    // When called by a user JWT, scope the client lookup to their boutique to
    // prevent cross-tenant phone number leakage. Service-role calls (from inngest)
    // are trusted and already pass the correct client_id.
    let clientQuery = supabase.from('clients').select('phone').eq('id', client_id)
    if (callerUserId) {
      const { data: member } = await supabase
        .from('boutique_members')
        .select('boutique_id')
        .eq('user_id', callerUserId)
        .limit(1)
        .single()
      if (!member?.boutique_id) {
        return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }
      clientQuery = clientQuery.eq('boutique_id', member.boutique_id)
    }

    const { data: client, error: clientError } = await clientQuery.single()

    if (clientError || !client?.phone) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Client not found or has no phone number' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send via Twilio — SMS or WhatsApp
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const formData = new URLSearchParams({
      From: useWhatsApp ? whatsappFrom : fromNumber,
      To:   useWhatsApp ? `whatsapp:${client.phone}` : client.phone,
      Body: message,
    })

    const credentials = btoa(`${accountSid}:${authToken}`)
    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const twilioData = await twilioRes.json()

    if (!twilioRes.ok) {
      console.error('[send-sms] Twilio error:', twilioData)
      return new Response(
        JSON.stringify({ ok: false, error: twilioData?.message || 'Twilio error' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, sid: twilioData.sid }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[send-sms]', err)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
