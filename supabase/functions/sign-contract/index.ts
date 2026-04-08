import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
      }
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    })
  }

  const { token, signed_by_name, signature_data } = await req.json()

  if (!token || !signed_by_name || !signature_data) {
    return new Response(JSON.stringify({ error: 'token, signed_by_name, and signature_data are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Fetch contract by token
  const { data: contract, error: fetchError } = await supabase
    .from('contracts')
    .select('id, status, title, boutique:boutiques(name, email), client:clients(name, email)')
    .eq('sign_token', token)
    .single()

  if (fetchError || !contract) {
    return new Response(JSON.stringify({ error: 'contract not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }

  if (contract.status === 'signed') {
    return new Response(JSON.stringify({ error: 'already signed' }), {
      status: 409, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Mark as signed
  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signed_by_name: signed_by_name.trim(),
      signature_data,
    })
    .eq('id', contract.id)

  if (updateError) {
    return new Response(JSON.stringify({ error: 'failed to save signature' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Send notifications
  const emails = []
  
  if (contract.client?.email) {
    emails.push(supabase.functions.invoke('send-email', {
      body: {
        to: contract.client.email,
        subject: `Contract Signed: ${contract.title}`,
        html: `<p>Hi ${contract.client.name?.split(' ')[0] || 'there'},</p>
               <p>Thank you for signing the contract: <strong>${contract.title}</strong>.</p>
               <p>A copy is saved to your client portal.</p>
               <br/><p>- ${contract.boutique?.name || 'Your Boutique'}</p>`
      }
    }))
  }
  
  if (contract.boutique?.email) {
    emails.push(supabase.functions.invoke('send-email', {
      body: {
        to: contract.boutique.email,
        subject: `Contract Signed by ${signed_by_name}`,
        html: `<p>${signed_by_name} just signed the contract: <strong>${contract.title}</strong>.</p>
               <p>Log in to your Belori dashboard to view it.</p>`
      }
    }))
  }

  await Promise.allSettled(emails)

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
})
