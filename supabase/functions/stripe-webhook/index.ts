import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@^14.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const cryptoProvider = Stripe.createCryptoProvider()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const signature = req.headers.get('Stripe-Signature')
    if (!signature) throw new Error('No signature')

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) throw new Error('Webhook secret config missing')

    const body = await req.text()
    
    // Verify the webhook signature
    let event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        cryptoProvider
      )
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      if (session.metadata?.boutique_id) {
        // Retrieve subscription to check status
        const subId = session.subscription
        const subscription = await stripe.subscriptions.retrieve(subId as string)

        await supabaseServiceRole
          .from('boutiques')
          .update({
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            plan_tier: session.metadata.plan || 'growth',
            trial_ends_at: null
          })
          .eq('id', session.metadata.boutique_id)
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const customerId = subscription.customer

      let plan_tier = 'starter'
      // Try to determine the plan based on the price ID
      const priceId = subscription.items.data[0]?.price?.id
      if (priceId === Deno.env.get('STRIPE_PRICE_STARTER')) plan_tier = 'starter'
      else if (priceId === Deno.env.get('STRIPE_PRICE_GROWTH')) plan_tier = 'growth'
      else if (priceId === Deno.env.get('STRIPE_PRICE_PRO')) plan_tier = 'pro'

      await supabaseServiceRole
        .from('boutiques')
        .update({
          subscription_status: subscription.status,
          plan_tier,
          trial_ends_at: null
        })
        .eq('stripe_customer_id', customerId)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
