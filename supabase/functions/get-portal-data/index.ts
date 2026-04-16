import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const token = new URL(req.url).searchParams.get('token');
  if (!token) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

  // Fetch the event by portal_token
  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('id, boutique_id, client_id, type, event_date, venue, guests, status, total, paid, inspiration_colors, inspiration_styles, inspiration_notes, inspiration_florals, portal_token_expires_at')
    .eq('portal_token', token)
    .single();

  if (evErr || !event) {
    return new Response(JSON.stringify({ error: 'Portal not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  // Check portal token expiry
  if (event.portal_token_expires_at && new Date(event.portal_token_expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'This portal link has expired. Please contact your boutique.' }), {
      status: 410, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // Fetch boutique (public info only)
  const { data: boutique } = await supabase
    .from('boutiques')
    .select('name, phone, email, address, instagram')
    .eq('id', event.boutique_id)
    .single();

  // Fetch client
  const { data: client } = await supabase
    .from('clients')
    .select('name, partner_name')
    .eq('id', event.client_id)
    .single();

  // Fetch payment milestones
  const { data: milestones } = await supabase
    .from('payment_milestones')
    .select('id, label, amount, due_date, status, paid_date')
    .eq('event_id', event.id)
    .order('due_date', { ascending: true });

  // Fetch appointments (upcoming + past)
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, type, date, status, note, time')
    .eq('event_id', event.id)
    .order('date', { ascending: true });

  // Fetch event services
  const { data: services } = await supabase
    .from('event_services')
    .select('service_type')
    .eq('event_id', event.id);

  // Fetch contracts (title, status, sign_token for unsigned)
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, title, status, signed_at, signed_by_name, sign_token')
    .eq('event_id', event.id)
    .neq('status', 'voided')
    .order('created_at', { ascending: false });

  // Sanitize contracts — only expose sign_token for unsigned contracts
  const safeContracts = (contracts || []).map(c => ({
    id: c.id,
    title: c.title,
    status: c.status,
    signed_at: c.signed_at,
    signed_by_name: c.signed_by_name,
    sign_token: c.status === 'signed' ? null : c.sign_token,
  }));

  return new Response(JSON.stringify({
    event: {
      type: event.type,
      event_date: event.event_date,
      venue: event.venue,
      guests: event.guests,
      status: event.status,
      total: event.total,
      paid: event.paid,
      inspiration_colors: event.inspiration_colors || [],
      inspiration_styles: event.inspiration_styles || [],
      inspiration_notes: event.inspiration_notes || null,
      inspiration_florals: event.inspiration_florals || null,
    },
    boutique,
    client,
    milestones: milestones || [],
    appointments: appointments || [],
    services: (services || []).map(s => s.service_type),
    contracts: safeContracts,
  }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
