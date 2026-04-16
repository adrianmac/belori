import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Vary': 'Origin',
  }
}

// Service-role client for DB lookups after auth is verified
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Anon client for JWT verification
const anonClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { auth: { persistSession: false } }
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });

  // ── Step 1: Verify JWT and resolve caller's boutique_id ────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Resolve caller's boutique membership
  const { data: member } = await supabase
    .from("boutique_members")
    .select("boutique_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response(JSON.stringify({ error: "Forbidden: no boutique membership" }), {
      status: 403,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const callerBoutiqueId = member.boutique_id;

  // ── Step 2: Parse body ──────────────────────────────────────────────────────
  const { milestone_id } = await req.json();
  if (!milestone_id) {
    return new Response(JSON.stringify({ error: "milestone_id required" }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // ── Step 3: Fetch milestone and verify boutique ownership ───────────────────
  const { data: milestone, error: mErr } = await supabase
    .from("payment_milestones")
    .select(`*, event:events(id, type, portal_token, boutique_id, client:clients(name, email))`)
    .eq("id", milestone_id)
    .single();

  if (mErr || !milestone) {
    return new Response(JSON.stringify({ error: "Milestone not found" }), {
      status: 404,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Enforce boutique ownership — caller must belong to the milestone's boutique
  if (milestone.event?.boutique_id !== callerBoutiqueId) {
    return new Response(JSON.stringify({ error: "Forbidden: milestone does not belong to your boutique" }), {
      status: 403,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Fetch boutique's Stripe secret key
  const { data: boutique } = await supabase
    .from("boutiques")
    .select("name, stripe_customer_id")
    .eq("id", milestone.event.boutique_id)
    .single();

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "Stripe not configured" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const amountCents = Math.round(Number(milestone.amount) * 100);
  const clientName = milestone.event?.client?.name || "Client";
  const description = `${milestone.label} — ${boutique?.name || "Belori"}`;

  // Create Stripe Price (inline) + Payment Link
  const priceRes = await fetch("https://api.stripe.com/v1/prices", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "unit_amount": String(amountCents),
      "currency": "usd",
      "product_data[name]": description,
    }),
  });

  const priceData = await priceRes.json();
  if (!priceData.id) {
    return new Response(JSON.stringify({ error: "Failed to create Stripe price", detail: priceData }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Build success URL (client portal if available)
  const portalToken = milestone.event?.portal_token;
  const origin = Deno.env.get("SITE_URL") || "https://novela-olive.vercel.app";
  const successUrl = portalToken
    ? `${origin}/portal/${portalToken}?paid=1`
    : `${origin}`;

  const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "line_items[0][price]": priceData.id,
      "line_items[0][quantity]": "1",
      "after_completion[type]": "redirect",
      "after_completion[redirect][url]": successUrl,
      "metadata[milestone_id]": milestone_id,
      "metadata[boutique_id]": milestone.event.boutique_id,
    }),
  });

  const linkData = await linkRes.json();
  if (!linkData.url) {
    return new Response(JSON.stringify({ error: "Failed to create payment link", detail: linkData }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Save link to milestone
  await supabase
    .from("payment_milestones")
    .update({
      stripe_payment_link_url: linkData.url,
      stripe_payment_link_id: linkData.id,
    })
    .eq("id", milestone_id);

  return new Response(JSON.stringify({ url: linkData.url, id: linkData.id }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});
