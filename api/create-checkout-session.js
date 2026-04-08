import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const PLAN_PRICES = {
  growth: process.env.STRIPE_PRICE_GROWTH,
  pro:    process.env.STRIPE_PRICE_PRO,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  // Verify caller via their session token
  const anonClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  // Load boutique via membership (scoped to user)
  const { data: member } = await anonClient
    .from('boutique_members')
    .select('role, boutique:boutiques(id, name, email, stripe_customer_id, plan, trial_ends_at)')
    .eq('user_id', user.id)
    .single()

  if (!member?.boutique) return res.status(403).json({ error: 'No boutique found' })
  if (member.role !== 'owner') return res.status(403).json({ error: 'Only the owner can manage billing' })

  const { plan } = req.body
  const priceId = PLAN_PRICES[plan]
  if (!priceId) return res.status(400).json({ error: 'Invalid plan. Must be "growth" or "pro"' })

  const boutique = member.boutique
  const appUrl = process.env.VITE_APP_URL || 'https://belori.app'

  // Use service role for writes
  const adminClient = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Get or create Stripe customer
  let customerId = boutique.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: boutique.name,
      email: boutique.email || user.email,
      metadata: { boutique_id: boutique.id },
    })
    customerId = customer.id
    await adminClient.from('boutiques').update({ stripe_customer_id: customerId }).eq('id', boutique.id)
  }

  const isStillTrialing = boutique.trial_ends_at && new Date(boutique.trial_ends_at) > new Date()
  const trialDaysLeft = isStillTrialing
    ? Math.ceil((new Date(boutique.trial_ends_at) - Date.now()) / 86400000)
    : 0

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?tab=billing&result=success`,
    cancel_url:  `${appUrl}/settings?tab=billing`,
    subscription_data: {
      metadata: { boutique_id: boutique.id },
      ...(trialDaysLeft > 0 ? { trial_period_days: trialDaysLeft } : {}),
    },
  })

  return res.json({ url: session.url })
}
