/**
 * Belori — inngest-send
 *
 * Receives frontend events and forwards them to the automations runner.
 * Currently handles: belori/boutique.created → onboarding welcome email
 *
 * Auth: Requires a valid Supabase JWT in the Authorization header.
 * This prevents unauthenticated callers from triggering emails via Belori's
 * verified sender domain. The frontend always has a session by the time
 * these events are fired (signup flow creates a session before redirecting).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl     = Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const AUTOMATIONS_URL = `${supabaseUrl}/functions/v1/inngest`
const AUTOMATION_KEY  = Deno.env.get('AUTOMATION_SECRET_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/** Verify a Supabase JWT and return the authenticated user (or null). */
async function verifyJwt(token: string) {
  if (!token || !supabaseUrl || !serviceKey) return null
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  return user
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  // ── JWT guard ─────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const user = await verifyJwt(token)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const body = await req.json()
    const { name, data } = body

    if (!name || typeof name !== 'string') {
      return new Response('Missing event name', { status: 400, headers: corsHeaders })
    }

    // Shared headers for all calls to the automations runner
    const autoHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
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
        return new Response('Failed to send onboarding email', { status: 502, headers: corsHeaders })
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
        return new Response('Failed to send invite email', { status: 502, headers: corsHeaders })
      }
    }

    const KNOWN_EVENTS = ['belori/boutique.created', 'belori/staff.invited']
    const dispatched = KNOWN_EVENTS.includes(name)

    return new Response(JSON.stringify({ ok: true, dispatched, event: name }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    console.error('[inngest-send]', err)
    return new Response(String(err), { status: 500, headers: corsHeaders })
  }
})
