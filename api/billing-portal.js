import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const anonClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: member } = await anonClient
    .from('boutique_members')
    .select('boutique:boutiques(stripe_customer_id)')
    .eq('user_id', user.id)
    .single()

  const customerId = member?.boutique?.stripe_customer_id
  if (!customerId) return res.status(400).json({ error: 'No active subscription found' })

  const appUrl = process.env.VITE_APP_URL || 'https://belori.app'
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/settings?tab=billing`,
  })

  return res.json({ url: portalSession.url })
}
