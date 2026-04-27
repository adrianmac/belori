// Sample data seeders for first-run empty states.
//
// Each function inserts a small, scannable example into the *user's own*
// boutique so they can see the app in action without typing real data.
// Every row is tagged with the magic string SAMPLE_TAG so it's trivial
// to identify (and delete) later — owners who decide to keep the app
// can clear samples in one click via "Clear samples" or just delete
// row-by-row through the normal UI.
//
// IMPORTANT: these only run when the user clicks "Try with sample".
// They never auto-fire on signup, so no boutique has unexpected rows.

import { supabase } from './supabase';

export const SAMPLE_TAG = '[sample]';

const today = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// ─── Sample CLIENT ─────────────────────────────────────────────────────────
// Inserts one example client. Returns { data, error }.
export async function seedSampleClient(boutiqueId) {
  const { data, error } = await supabase.from('clients').insert({
    boutique_id: boutiqueId,
    name:  `Sofia Garcia ${SAMPLE_TAG}`,
    phone: '+15555550100',
    email: 'sofia.sample@belori.test',
    flower_prefs: 'Loves white roses + eucalyptus, allergic to lilies.',
    partner_name: 'Marco Garcia',
  }).select().single();
  return { data, error };
}

// ─── Sample EVENT (with milestones + tasks + appointment) ──────────────────
// Creates a complete-looking event so the user can see Payments, Tasks,
// and Appointments tabs populated. Reuses an existing client if any
// already exist; otherwise creates a sample client first.
export async function seedSampleEvent(boutiqueId) {
  // 1. Find or create the client
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('boutique_id', boutiqueId)
    .limit(1);

  let clientId = existingClients?.[0]?.id;
  let clientName = existingClients?.[0]?.name;
  if (!clientId) {
    const r = await seedSampleClient(boutiqueId);
    if (r.error) return { error: r.error };
    clientId = r.data.id;
    clientName = r.data.name;
  }

  // 2. The event itself — wedding, 90 days out, $15k total
  const { data: event, error: evErr } = await supabase.from('events').insert({
    boutique_id: boutiqueId,
    client_id:   clientId,
    type: 'wedding',
    event_date: daysFromNow(90),
    venue:  `The Sample Atelier ${SAMPLE_TAG}`,
    guests: 120,
    status: 'active',
    total: 15000,
    paid:  5000,
  }).select().single();
  if (evErr) return { error: evErr };

  // 3. Two milestones — paid deposit + pending balance
  await supabase.from('payment_milestones').insert([
    {
      boutique_id: boutiqueId,
      event_id:    event.id,
      label:       'Deposit',
      amount:      5000,
      status:      'paid',
      paid_date:   daysFromNow(-25),
      due_date:    daysFromNow(-30),
    },
    {
      boutique_id: boutiqueId,
      event_id:    event.id,
      label:       'Final balance',
      amount:      10000,
      status:      'pending',
      due_date:    daysFromNow(60),
    },
  ]);

  // 4. A few tasks
  await supabase.from('tasks').insert([
    { boutique_id: boutiqueId, event_id: event.id, text: 'Confirm florist delivery window', category: 'Vendor' },
    { boutique_id: boutiqueId, event_id: event.id, text: 'Send seating chart to client',     category: 'Planning' },
    { boutique_id: boutiqueId, event_id: event.id, text: 'Final fitting reminder',           category: 'Fitting', alert: true },
  ]);

  // 5. An appointment 14 days out
  await supabase.from('appointments').insert({
    boutique_id: boutiqueId,
    event_id:    event.id,
    client_id:   clientId,
    client_name: clientName,
    type:  'final_fitting',
    date:  daysFromNow(14),
    time:  '15:00',
    status: 'scheduled',
    note:  `Sample appointment — ${SAMPLE_TAG}`,
  });

  return { data: event, error: null };
}
