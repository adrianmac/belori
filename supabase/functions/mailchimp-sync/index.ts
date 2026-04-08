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
      .select('mailchimp_api_key, mailchimp_list_id')
      .eq('id', boutique_id)
      .single()

    if (!boutique?.mailchimp_api_key || !boutique?.mailchimp_list_id) {
      return new Response(
        JSON.stringify({ error: 'Mailchimp not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine datacenter from API key (format: key-dc, e.g. abc123-us6)
    const dc = boutique.mailchimp_api_key.split('-').pop() || 'us1'

    // Fetch all clients with emails
    const { data: clients } = await supabase
      .from('clients')
      .select('name, email')
      .eq('boutique_id', boutique_id)
      .not('email', 'is', null)

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const members = clients.map((c) => {
      const parts = (c.name || '').split(' ')
      return {
        email_address: c.email,
        status: 'subscribed',
        merge_fields: {
          FNAME: parts[0] || '',
          LNAME: parts.slice(1).join(' ') || '',
        },
      }
    })

    // Mailchimp batch subscribe
    const mcRes = await fetch(
      `https://${dc}.api.mailchimp.com/3.0/lists/${boutique.mailchimp_list_id}/members`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`anystring:${boutique.mailchimp_api_key}`)}`,
          'Content-Type': 'application/json',
        },
        // Mailchimp batch upsert — POST individual members; for bulk use /lists/{id}/batch
        body: JSON.stringify(members[0]), // single-member path; see batch note below
      }
    )

    // Use the batch endpoint instead for multiple contacts
    const batchRes = await fetch(
      `https://${dc}.api.mailchimp.com/3.0/lists/${boutique.mailchimp_list_id}/members/batch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`anystring:${boutique.mailchimp_api_key}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ members, update_existing: true }),
      }
    )

    if (!batchRes.ok) {
      const errBody = await batchRes.text()
      return new Response(
        JSON.stringify({ error: `Mailchimp error ${batchRes.status}: ${errBody.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await batchRes.json()
    const synced = (result.new_members?.length || 0) + (result.updated_members?.length || 0)

    // Update connected_at timestamp if first sync
    await supabase
      .from('boutiques')
      .update({ mailchimp_connected_at: new Date().toISOString() })
      .eq('id', boutique_id)
      .is('mailchimp_connected_at', null)

    return new Response(
      JSON.stringify({ synced, total: clients.length, errors: result.errors || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
