import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Belori <onboarding@resend.dev>'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...getCorsHeaders(req), 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
  }

  // Require service-role key or valid user JWT
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('apikey') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const isServiceRole = token === serviceKey

  let user: { id: string } | null = null

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  if (!isServiceRole) {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data, error } = await anon.auth.getUser(token)
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }
    user = data.user
  }

  try {
    const { to, subject, html } = await req.json()

    // Recipient validation — only required for user JWTs (service-role callers are trusted)
    if (!isServiceRole && user) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey!)

      // Resolve the caller's boutique
      const { data: member } = await admin
        .from('boutique_members')
        .select('boutique_id')
        .eq('user_id', user.id)
        .single()

      if (!member) {
        return new Response(JSON.stringify({ error: 'Forbidden: no boutique membership' }), {
          status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
        })
      }

      // Normalise to a single address for the check (Resend accepts string or array)
      const recipientEmail = (Array.isArray(to) ? to[0] : to) as string

      // Accept if recipient is a client of the boutique
      const { data: clientMatch } = await admin
        .from('clients')
        .select('id')
        .eq('boutique_id', member.boutique_id)
        .eq('email', recipientEmail)
        .maybeSingle()

      // Or a staff member of the boutique.
      // boutique_members has no email column — emails live in auth.users.
      // Get all user_ids for this boutique, then check auth.users by email.
      let memberMatch: { id: string } | null = null
      if (!clientMatch) {
        const { data: boutiqueMembers } = await admin
          .from('boutique_members')
          .select('user_id')
          .eq('boutique_id', member.boutique_id)

        const userIds = (boutiqueMembers ?? []).map((m: any) => m.user_id as string)

        if (userIds.length > 0) {
          const { data: authUser } = await admin
            .schema('auth')
            .from('users')
            .select('id')
            .eq('email', recipientEmail)
            .in('id', userIds)
            .maybeSingle() as any

          memberMatch = authUser ?? null
        }
      }

      if (!clientMatch && !memberMatch) {
        return new Response(JSON.stringify({ error: 'Forbidden: recipient is not a client or member of your boutique' }), {
          status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
        })
      }
    }

    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY. Add it to the Supabase Secrets.")
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html
      })
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
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
