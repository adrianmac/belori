/**
 * Belori — inngest-send
 *
 * Receives frontend events and forwards them to the automations runner.
 * Currently handles: belori/boutique.created → onboarding welcome email
 *
 * Auth: no JWT required (called right at signup before confirmation).
 */

const AUTOMATIONS_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/inngest`
const AUTOMATION_KEY  = Deno.env.get('AUTOMATION_SECRET_KEY') ?? ''

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    const { name, data } = body

    if (!name || typeof name !== 'string') {
      return new Response('Missing event name', { status: 400 })
    }

    // Map event names to automation types
    // Shared headers for all calls to the automations runner
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const autoHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(serviceKey ? { 'Authorization': `Bearer ${serviceKey}` } : {}),
    }
    if (AUTOMATION_KEY) autoHeaders['x-automation-key'] = AUTOMATION_KEY

    if (name === 'belori/boutique.created') {
      // Fire onboarding welcome email via automations runner
      const res = await fetch(`${AUTOMATIONS_URL}?type=onboarding`, {
        method: 'POST',
        headers: autoHeaders,
        body: JSON.stringify(data ?? {}),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error('[inngest-send] automations error:', res.status, text)
        return new Response('Failed to send onboarding email', { status: 502 })
      }
    }
    if (name === 'belori/staff.invited') {
      const res = await fetch(`${AUTOMATIONS_URL}?type=staffInvite`, {
        method: 'POST',
        headers: autoHeaders,
        body: JSON.stringify(data ?? {}),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error('[inngest-send] staffInvite error:', res.status, text)
        return new Response('Failed to send invite email', { status: 502 })
      }
    }
    // Add more event mappings here as needed

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('[inngest-send]', err)
    return new Response(String(err), { status: 500 })
  }
})
