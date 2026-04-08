import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Disable body parsing — we need the raw body to verify Stripe's signature
export const config = { api: { bodyParser: false } }

function getPlan(priceId) {
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_GROWTH) return 'growth'
  return 'starter'
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig = req.headers['stripe-signature']
  const rawBody = await getRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  // Service role bypasses RLS — correct for webhook handlers
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription') {
          const sub = await stripe.subscriptions.retrieve(session.subscription)
          await supabase.from('boutiques').update({
            stripe_subscription_id: sub.id,
            plan: getPlan(sub.items.data[0].price.id),
            subscription_status: sub.status,
            trial_ends_at: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
          }).eq('stripe_customer_id', session.customer)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        await supabase.from('boutiques').update({
          plan: getPlan(sub.items.data[0].price.id),
          subscription_status: sub.status,
        }).eq('stripe_subscription_id', sub.id)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await supabase.from('boutiques').update({
          subscription_status: 'canceled',
          plan: 'starter',
        }).eq('stripe_subscription_id', sub.id)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        if (invoice.subscription) {
          await supabase.from('boutiques').update({
            subscription_status: 'past_due',
          }).eq('stripe_subscription_id', invoice.subscription)
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  return res.json({ received: true })
}
