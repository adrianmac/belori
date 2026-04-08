import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(JSON.stringify({ error: 'token required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*, boutique:boutiques(name, address, phone, email)')
    .eq('sign_token', token)
    .single()

  if (error || !contract) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ contract }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
})
