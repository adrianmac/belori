// src/lib/weddingSetup.js
// Auto-seed a new wedding plan with default data

import { supabase } from './supabase';
import {
  DEFAULT_CHECKLIST,
  DEFAULT_BUDGET_ITEMS,
  DEFAULT_RUN_OF_SHOW,
  DEFAULT_MUSIC_MOMENTS,
  DEFAULT_LEGAL_PRE_WEDDING,
  DEFAULT_LEGAL_NAME_CHANGE,
} from './weddingDefaults';

export async function createWeddingPlan(eventId, boutiqueId, eventData) {
  // 1. Fetch event to get client name if not already supplied
  let clientName = eventData?.client || eventData?.clientData?.name || '';
  let guestCount = Number(eventData?.guests) || 100;

  if (!clientName) {
    const { data: ev } = await supabase
      .from('events')
      .select('client_id, clients(name), guests')
      .eq('id', eventId)
      .single();
    clientName = ev?.clients?.name || '';
    if (!guestCount || guestCount === 100) guestCount = Number(ev?.guests) || 100;
  }

  // 2. Create plan
  const { data: plan, error } = await supabase
    .from('wedding_plans')
    .insert({
      boutique_id: boutiqueId,
      event_id: eventId,
      partner_1_name: clientName,
      partner_2_name: eventData?.partner_name || '',
      wedding_motto: '',
      nuclear_option: '',
      total_budget: 0,
      guest_count: guestCount,
      venue_budget_pct: 0.45,
      partner_1_priorities: [],
      partner_2_priorities: [],
      partner_1_not_important: [],
      partner_2_not_important: [],
    })
    .select()
    .single();

  if (error || !plan) {
    console.error('Failed to create wedding plan:', error);
    return null;
  }

  const planId = plan.id;

  // 3. Seed checklist
  await supabase.from('wedding_checklist_items').insert(
    DEFAULT_CHECKLIST.map(item => ({ ...item, plan_id: planId, boutique_id: boutiqueId }))
  );

  // 4. Seed budget items (schema uses budgeted_cents integer)
  await supabase.from('wedding_budget_items').insert(
    DEFAULT_BUDGET_ITEMS.map(item => ({
      plan_id: planId,
      boutique_id: boutiqueId,
      category: item.category,
      item_name: item.item_name,
      budgeted_cents: 0,
      actualized_cents: null,
      sort_order: item.sort_order,
    }))
  );

  // 5. Seed run of show (schema uses scheduled_time not start_time)
  await supabase.from('wedding_run_of_show').insert(
    DEFAULT_RUN_OF_SHOW.map(item => ({
      plan_id: planId,
      boutique_id: boutiqueId,
      phase: item.phase,
      action: item.action,
      scheduled_time: null,
      sort_order: item.sort_order,
    }))
  );

  // 6. Seed music special moments
  await supabase.from('wedding_music').insert(
    DEFAULT_MUSIC_MOMENTS.map(item => ({ ...item, plan_id: planId, boutique_id: boutiqueId }))
  );

  // 7. Seed legal items
  await supabase.from('wedding_legal_items').insert(
    [...DEFAULT_LEGAL_PRE_WEDDING, ...DEFAULT_LEGAL_NAME_CHANGE]
      .map(item => ({ ...item, plan_id: planId, boutique_id: boutiqueId }))
  );

  return plan;
}
