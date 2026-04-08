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

    const { data: boutique } = await supabase
      .from('boutiques')
      .select('qbo_access_token, qbo_realm_id, name')
      .eq('id', boutique_id)
      .single()

    if (!boutique?.qbo_access_token || !boutique?.qbo_realm_id) {
      return new Response(
        JSON.stringify({ error: 'QuickBooks not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch paid milestones from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const { data: milestones } = await supabase
      .from('payment_milestones')
      .select('id, label, amount, paid_date, events(client)')
      .eq('boutique_id', boutique_id)
      .eq('status', 'paid')
      .gte('paid_date', thirtyDaysAgo)

    let synced = 0
    const errors: string[] = []

    for (const m of milestones || []) {
      const receipt = {
        Line: [
          {
            Amount: m.amount,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: { ItemRef: { value: '1', name: 'Services' } },
          },
        ],
        CustomerRef: { name: (m.events as any)?.client || 'Unknown' },
        TxnDate: m.paid_date,
        PrivateNote: m.label,
      }

      const qboRes = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${boutique.qbo_realm_id}/salesreceipt`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${boutique.qbo_access_token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(receipt),
        }
      )

      if (qboRes.ok) {
        synced++
      } else {
        const errText = await qboRes.text()
        errors.push(`Milestone ${m.id}: ${qboRes.status} ${errText.slice(0, 100)}`)
      }
    }

    // Update last sync timestamp
    await supabase
      .from('boutiques')
      .update({ qbo_synced_at: new Date().toISOString() })
      .eq('id', boutique_id)

    return new Response(
      JSON.stringify({ synced, total: milestones?.length || 0, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
