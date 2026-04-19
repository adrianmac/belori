import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://belori.app',
  'https://www.belori.app',
  ...(Deno.env.get('EXTRA_ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean),
]

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function verifyJwt(token: string) {
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  return user
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // Require a valid JWT — this endpoint calls the Anthropic API and must not be open
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
  const user = await verifyJwt(token)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  // Rate limit: max 20 AI requests per user per hour
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await adminClient
    .from('ai_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', oneHourAgo)

  if ((count ?? 0) >= 20) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 20 AI requests per hour.' }), {
      status: 429,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  // Log this request before processing
  await adminClient.from('ai_usage_log').insert({ user_id: user.id, created_at: new Date().toISOString() })

  try {
    const body = await req.json()
    const { type, eventType, clientName, eventDate, venue, guests, services, total, paid, daysUntil, overdueCount, prevOverdue, packages, deposit, boutiqueName, guestCount } = body
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    let prompt = ''

    if (type === 'event_description') {
      prompt = `You are a bridal boutique assistant. Generate a warm, professional event notes/description for a ${eventType} event.
Client: ${clientName}
Date: ${eventDate || 'TBD'}
Venue: ${venue || 'TBD'}
Guests: ${guests || 'unknown'} guests
Services: ${services?.join(', ') || 'TBD'}

Write 2-3 sentences of internal notes about this event that would help staff. Include any preparation reminders or talking points. Be concise and practical. No fluff.`
    } else if (type === 'task_suggestions') {
      prompt = `You are a bridal boutique operations expert. Suggest 5-8 specific tasks for a ${eventType} event happening on ${eventDate || 'an upcoming date'}.
Services included: ${services?.join(', ') || 'standard services'}
${guests ? `Guest count: ${guests}` : ''}

Return ONLY a JSON array of task objects like:
[{"text": "task description", "category": "category name", "alert": false}]

Categories: Dress, Alterations, Payment, Appointment, Admin, Vendor, Client
Set alert: true only for critical tasks that must not be missed.
Return valid JSON only, no other text.`
    } else if (type === 'payment_risk') {
      prompt = `You are a payment risk analyst for a bridal boutique. Analyze this event's payment risk.
Event type: ${eventType}
Total contract: $${total || 0}
Amount paid: $${paid || 0}
Days until event: ${daysUntil || 0}
Overdue milestones: ${overdueCount || 0}
Previous overdue count: ${prevOverdue || 0}

Return ONLY a JSON object:
{"risk": "low|medium|high", "reason": "one sentence explanation", "action": "one specific recommended action"}
Return valid JSON only.`
    } else if (type === 'price_suggestion') {
      const pkgList = (packages || []).map((p: { name: string; base_price: number; services: string[] }) =>
        `- ${p.name}: $${p.base_price} (${(p.services || []).join(', ')})`
      ).join('\n') || 'No packages on file'
      prompt = `You are a pricing expert for a bridal boutique. Suggest a fair contract price for this event.
Event type: ${eventType}
Services requested: ${(services || []).join(', ') || 'TBD'}
Guest count: ${guestCount || guests || 'unknown'}
Venue: ${venue || 'TBD'}

Available packages for reference:
${pkgList}

Based on the services, guest count, and event type, suggest a base price. Consider:
- Market rates for bridal services
- Complexity of the event
- Number of services included

Return ONLY a JSON object:
{"suggested_price": 3500, "reasoning": "one or two sentence explanation of how you arrived at this price", "confidence": "low|medium|high"}
Return valid JSON only, no other text.`
    } else if (type === 'contract_draft') {
      prompt = `You are a professional contract writer for a bridal boutique. Generate a complete, professional services contract.
Boutique: ${boutiqueName || 'The Boutique'}
Client name: ${clientName || 'Client'}
Event type: ${eventType}
Event date: ${eventDate || 'TBD'}
Venue: ${venue || 'TBD'}
Services: ${(services || []).join(', ') || 'TBD'}
Contract total: $${total || 0}
Deposit: $${deposit || 0}

Write a professional contract with these sections:
1. Parties & Agreement Overview
2. Services Included
3. Payment Terms (deposit, milestones, final balance)
4. Cancellation Policy (tiered by days before event)
5. Damage Liability (for rentals and boutique property)
6. Alteration Terms (if applicable)
7. Pickup & Return Dates (if dress rental included)
8. General Terms & Governing Law

Use professional but accessible language. Include blank lines for signatures at the end. Keep it concise — under 600 words.
Return ONLY the contract text, no preamble or JSON.`
    } else {
      return new Response(JSON.stringify({ error: 'Unknown request type' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: type === 'contract_draft' ? 2048 : 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    return new Response(JSON.stringify({ result: text }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
