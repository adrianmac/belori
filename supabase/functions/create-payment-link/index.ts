import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { milestone_id } = await req.json();
  if (!milestone_id) {
    return new Response(JSON.stringify({ error: "milestone_id required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Fetch milestone + event + client
  const { data: milestone, error: mErr } = await supabase
    .from("payment_milestones")
    .select(`*, event:events(id, type, portal_token, boutique_id, client:clients(name, email))`)
    .eq("id", milestone_id)
    .single();

  if (mErr || !milestone) {
    return new Response(JSON.stringify({ error: "Milestone not found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
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
      headers: { ...cors, "Content-Type": "application/json" },
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
      headers: { ...cors, "Content-Type": "application/json" },
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
      headers: { ...cors, "Content-Type": "application/json" },
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
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
