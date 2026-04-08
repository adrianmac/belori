import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    description: 'Perfect for boutiques just getting started',
    features: ['Up to 50 events/year', '1 staff account', 'Events, clients & payments', 'Dress rentals & alterations', 'Email support'],
    highlight: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 129,
    description: 'For growing boutiques managing multiple staff',
    features: ['Unlimited events', 'Up to 5 staff accounts', 'All Starter features', 'Event planning module', 'Decoration & inventory', 'Automation reminders', 'Priority support'],
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 299,
    description: 'For high-volume boutiques needing everything',
    features: ['Unlimited everything', 'Unlimited staff', 'All Growth features', 'Custom branding', 'API access', 'Dedicated onboarding', 'Phone support'],
    highlight: false,
  },
]

// Supabase Edge Function base URL
const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export function useBilling() {
  const { boutique } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const plan   = boutique?.plan_tier ?? 'starter'
  const status = boutique?.subscription_status ?? 'trialing'
  const trialEndsAt = boutique?.trial_ends_at
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt) - Date.now()) / 86400000))
    : null
  const isTrialing = status === 'trialing'
  const hasActiveSubscription = !!boutique?.stripe_customer_id

  async function startCheckout(planName) {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${FN_BASE}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planName }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      window.location.href = data.url
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  async function openBillingPortal() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${FN_BASE}/billing-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      window.location.href = data.url
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return {
    plan,
    status,
    trialDaysLeft,
    isTrialing,
    hasActiveSubscription,
    loading,
    error,
    startCheckout,
    openBillingPortal,
  }
}
