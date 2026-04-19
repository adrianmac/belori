import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@^14.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Auth header')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Resolve boutique via boutique_members — boutiques has no owner_id column
    const { data: member } = await supabaseClient
      .from('boutique_members')
      .select('boutique_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!member) throw new Error('No boutique membership found for user')

    const { data: boutique } = await supabaseClient
      .from('boutiques')
      .select('id, stripe_customer_id')
      .eq('id', member.boutique_id)
      .single()

    if (!boutique || !boutique.stripe_customer_id) {
        throw new Error('No active subscription found')
    }

    const origin = req.headers.get('origin') || 'http://localhost:5173'

    const session = await stripe.billingPortal.sessions.create({
      customer: boutique.stripe_customer_id,
      return_url: `${origin}/settings`,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
