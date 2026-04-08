import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { boutique_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Load boutique credentials
    const { data: boutique } = await supabase
      .from('boutiques')
      .select('klaviyo_api_key, klaviyo_list_id')
      .eq('id', boutique_id)
      .single()

    if (!boutique?.klaviyo_api_key || !boutique?.klaviyo_list_id) {
      return new Response(
        JSON.stringify({ error: 'Klaviyo not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch all clients with emails
    const { data: clients } = await supabase
      .from('clients')
      .select('name, email, phone')
      .eq('boutique_id', boutique_id)
      .not('email', 'is', null)

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Klaviyo v2 — subscribe members to a list
    // POST /api/v2/list/{list_id}/members
    const profiles = clients.map((c) => {
      const parts = (c.name || '').split(' ')
      return {
        email: c.email,
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || '',
        phone_number: c.phone || undefined,
      }
    })

    const klaviyoRes = await fetch(
      `https://a.klaviyo.com/api/v2/list/${boutique.klaviyo_list_id}/members`,
      {
        method: 'POST',
        headers: {
          'Api-Key': boutique.klaviyo_api_key,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ profiles }),
      }
    )

    if (!klaviyoRes.ok) {
      const errBody = await klaviyoRes.text()
      return new Response(
        JSON.stringify({ error: `Klaviyo error ${klaviyoRes.status}: ${errBody.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await klaviyoRes.json()
    // Klaviyo returns the list of profiles that were added
    const synced = Array.isArray(result) ? result.length : clients.length

    return new Response(
      JSON.stringify({ synced, total: clients.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
