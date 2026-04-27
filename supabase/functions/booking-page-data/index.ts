import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * booking-page-data — public endpoint, no JWT required
 * GET  ?slug=:slug  → returns safe boutique branding info
 * POST ?slug=:slug  → submit a booking request
 */

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  const url  = new URL(req.url);
  const slug = url.searchParams.get('slug')?.toLowerCase().trim();

  if (!slug) return json({ error: 'slug is required' }, 400);

  // ── GET: fetch boutique public profile ─────────────────────────────────────
  if (req.method === 'GET') {
    const { data: boutique, error } = await supabase
      .from('boutiques')
      .select('id, name, email, phone, address, instagram, booking_url, slug, primary_color, plan_tier')
      .eq('slug', slug)
      .single();

    if (error || !boutique) {
      return json({ error: 'Boutique not found' }, 404);
    }

    // Pull the modules the boutique has actually enabled — only services
    // backed by an enabled module make sense to offer in the wizard.
    const { data: enabledModules } = await supabase
      .from('boutique_modules')
      .select('module_id')
      .eq('boutique_id', boutique.id)
      .eq('enabled', true);
    const moduleIds = new Set((enabledModules || []).map(m => m.module_id));

    // Map module ids → public service ids that the wizard knows about.
    // Anything not gated by a module (planning, photography, hair_makeup
    // etc.) stays available to all boutiques. Decoration is the only one
    // we currently gate behind a module — the others are core capabilities.
    const SERVICE_MODULE_GATES: Record<string, string> = {
      dress_rental:   'dress_rental',
      alterations:    'alterations',
      decoration:     'decoration',
    };
    const offeredServices = ['dress_rental','alterations','decoration','event_planning','photography','hair_makeup']
      .filter(svc => {
        const gate = SERVICE_MODULE_GATES[svc];
        return !gate || moduleIds.has(gate);
      });

    // Only return safe public fields — no stripe IDs, no staff, no financials
    return json({
      id:            boutique.id,
      name:          boutique.name,
      email:         boutique.email,
      phone:         boutique.phone,
      address:       boutique.address,
      instagram:     boutique.instagram,
      booking_url:   boutique.booking_url,
      slug:          boutique.slug,
      primary_color: boutique.primary_color || null,
      offered_services: offeredServices,
    });
  }

  // ── POST: submit booking request ───────────────────────────────────────────
  if (req.method === 'POST') {
    // Resolve boutique_id from slug
    const { data: boutique } = await supabase
      .from('boutiques')
      .select('id, name, email')
      .eq('slug', slug)
      .single();

    if (!boutique) return json({ error: 'Boutique not found' }, 404);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { client_name, client_email, client_phone, event_type, event_date, guest_count, services, message } = body;

    if (!client_name || typeof client_name !== 'string' || !client_name.trim()) {
      return json({ error: 'client_name is required' }, 400);
    }

    // Use service-role client so anon can insert (bypasses RLS for server-side)
    const { data, error } = await supabase
      .from('booking_requests')
      .insert({
        boutique_id:  boutique.id,
        client_name:  client_name.trim().slice(0, 200),
        client_email: client_email?.trim().slice(0, 200) || null,
        client_phone: client_phone?.trim().slice(0, 50)  || null,
        event_type:   ['wedding','quinceanera','other'].includes(event_type) ? event_type : 'other',
        event_date:   event_date || null,
        guest_count:  guest_count ? Number(guest_count) : null,
        services:     Array.isArray(services) ? services : [],
        message:      message?.trim().slice(0, 2000) || null,
        status:       'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[booking-page-data] insert error:', error);
      return json({ error: 'Failed to submit booking request' }, 500);
    }

    console.log(`[booking-page-data] new booking request ${data.id} for boutique ${boutique.name}`);
    
    // Asynchronously notify boutique and client
    const emailPromises = [];
    emailPromises.push(supabase.functions.invoke('send-email', {
      body: {
        to: boutique.email || 'hello@belori.app', // Fallback
        subject: `New Lead: ${client_name.trim().slice(0, 50)}`,
        html: `<p>You have a new booking request from <strong>${client_name}</strong> for a ${event_type}.</p>
               <p>Check your Belori dashboard to view details and contact them!</p>`
      }
    }));

    if (client_email) {
      emailPromises.push(supabase.functions.invoke('send-email', {
        body: {
          to: client_email.trim(),
          subject: `Request received - ${boutique.name}`,
          html: `<p>Hi ${client_name.split(' ')[0]},</p>
                 <p>Thanks for reaching out! We have received your booking request and our team will get back to you shortly.</p>
                 <br/><p>- The team at ${boutique.name}</p>`
        }
      }));
    }

    await Promise.allSettled(emailPromises);

    return json({ ok: true, id: data.id });
  }

  return new Response('Method Not Allowed', { status: 405 });
});

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
