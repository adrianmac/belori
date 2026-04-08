import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@^14.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    const { data: boutique } = await supabaseClient
      .from('boutiques')
      .select('id, stripe_customer_id, plan_tier')
      .eq('owner_id', user.id)
      .single()

    if (!boutique) throw new Error('Boutique not found')

    const body = await req.json()
    const { plan } = body

    const planPrices = {
      starter: Deno.env.get('STRIPE_PRICE_STARTER'),
      growth: Deno.env.get('STRIPE_PRICE_GROWTH'),
      pro: Deno.env.get('STRIPE_PRICE_PRO'),
    }

    const priceId = planPrices[plan]
    if (!priceId) throw new Error('Invalid plan selected')

    let customerId = boutique.stripe_customer_id

    if (!customerId) {
        // Create a new Customer in Stripe
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
                boutique_id: boutique.id
            }
        });
        customerId = customer.id;
        
        // Save to Supabase (using service role to bypass RLS)
        const supabaseServiceRole = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabaseServiceRole.from('boutiques').update({ stripe_customer_id: customerId }).eq('id', boutique.id);
    }

    const origin = req.headers.get('origin') || 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/settings?checkout=success`,
      cancel_url: `${origin}/settings?checkout=cancelled`,
      metadata: {
        boutique_id: boutique.id,
        plan
      }
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
