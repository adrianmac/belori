import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createWeddingPlan } from '../lib/weddingSetup';

export function useWeddingPlan(eventId, boutiqueId) {
  const [plan, setPlan] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [budget, setBudget] = useState([]);
  const [guests, setGuests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [runOfShow, setRunOfShow] = useState([]);
  const [music, setMusic] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [legalItems, setLegalItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    if (!eventId || !boutiqueId) { setLoading(false); return; }
    setLoading(true);

    const { data: planData } = await supabase
      .from('wedding_plans')
      .select('*')
      .eq('event_id', eventId)
      .eq('boutique_id', boutiqueId)
      .maybeSingle();

    if (!planData) { setPlan(null); setLoading(false); return; }

    setPlan(planData);
    const id = planData.id;

    const [chk, bud, gst, vnd, ros, mus, gif, leg] = await Promise.all([
      supabase.from('wedding_checklist_items').select('*').eq('plan_id', id).order('sort_order'),
      supabase.from('wedding_budget_items').select('*').eq('plan_id', id).order('sort_order'),
      supabase.from('wedding_guests').select('*').eq('plan_id', id).order('created_at'),
      supabase.from('wedding_vendors').select('*').eq('plan_id', id).order('category'),
      supabase.from('wedding_run_of_show').select('*').eq('plan_id', id).order('sort_order'),
      supabase.from('wedding_music').select('*').eq('plan_id', id).order('created_at'),
      supabase.from('wedding_gifts').select('*').eq('plan_id', id).order('created_at'),
      supabase.from('wedding_legal_items').select('*').eq('plan_id', id).order('sort_order'),
    ]);

    setChecklist(chk.data || []);
    setBudget((bud.data || []).map(i => ({ ...i, estimated_cost: (i.budgeted_cents || 0) / 100, actual_cost: i.actualized_cents != null ? i.actualized_cents / 100 : null })));
    setGuests(gst.data || []);
    setVendors(vnd.data || []);
    setRunOfShow(ros.data || []);
    setMusic(mus.data || []);
    setGifts(gif.data || []);
    setLegalItems(leg.data || []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, [eventId, boutiqueId]);

  // ── Plan ────────────────────────────────────────────────────────────────────
  async function initPlan(eventData) {
    const newPlan = await createWeddingPlan(eventId, boutiqueId, eventData);
    if (newPlan) await fetchAll();
    return newPlan;
  }

  async function updatePlan(updates) {
    if (!plan) return;
    const { error } = await supabase
      .from('wedding_plans')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', plan.id);
    if (!error) setPlan(p => ({ ...p, ...updates }));
    return { error };
  }

  // ── Checklist ───────────────────────────────────────────────────────────────
  async function toggleChecklist(id, done) {
    const { error } = await supabase
      .from('wedding_checklist_items')
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq('id', id);
    if (!error) setChecklist(list => list.map(i => i.id === id ? { ...i, done, done_at: done ? new Date().toISOString() : null } : i));
    return { error };
  }

  async function addChecklistItem(item) {
    const { data, error } = await supabase
      .from('wedding_checklist_items')
      .insert({ ...item, plan_id: plan.id, boutique_id: boutiqueId })
      .select().single();
    if (!error) setChecklist(list => [...list, data]);
    return { data, error };
  }

  // ── Budget ──────────────────────────────────────────────────────────────────
  async function updateBudgetItem(id, updates) {
    // Convert dollar values to cents for DB storage
    const dbUpdates = { ...updates };
    if ('estimated_cost' in dbUpdates) { dbUpdates.budgeted_cents = Math.round((dbUpdates.estimated_cost || 0) * 100); delete dbUpdates.estimated_cost; }
    if ('actual_cost' in dbUpdates) { dbUpdates.actualized_cents = dbUpdates.actual_cost != null ? Math.round(dbUpdates.actual_cost * 100) : null; delete dbUpdates.actual_cost; }
    const { error } = await supabase
      .from('wedding_budget_items')
      .update(dbUpdates)
      .eq('id', id);
    if (error) console.error('updateBudgetItem failed:', error);
    else setBudget(list => list.map(i => i.id === id ? { ...i, ...updates } : i));
    return { error };
  }

  async function addBudgetItem(item) {
    const dbItem = { ...item };
    if ('estimated_cost' in dbItem) { dbItem.budgeted_cents = Math.round((dbItem.estimated_cost || 0) * 100); delete dbItem.estimated_cost; }
    if ('actual_cost' in dbItem) { dbItem.actualized_cents = dbItem.actual_cost != null ? Math.round(dbItem.actual_cost * 100) : null; delete dbItem.actual_cost; }
    const { data, error } = await supabase
      .from('wedding_budget_items')
      .insert({ ...dbItem, plan_id: plan.id, boutique_id: boutiqueId })
      .select().single();
    if (!error && data) {
      // Normalize cents back to dollars for local state
      const normalized = { ...data, estimated_cost: (data.budgeted_cents || 0) / 100, actual_cost: data.actualized_cents != null ? data.actualized_cents / 100 : null };
      setBudget(list => [...list, normalized]);
    }
    return { data, error };
  }

  async function deleteBudgetItem(id) {
    const { error } = await supabase.from('wedding_budget_items').delete().eq('id', id);
    if (!error) setBudget(list => list.filter(i => i.id !== id));
    return { error };
  }

  // ── Guests ──────────────────────────────────────────────────────────────────
  async function addGuest(guest) {
    const { data, error } = await supabase
      .from('wedding_guests')
      .insert({ ...guest, plan_id: plan.id, boutique_id: boutiqueId })
      .select().single();
    if (!error) setGuests(list => [...list, data]);
    return { data, error };
  }

  async function updateGuest(id, updates) {
    const { error } = await supabase.from('wedding_guests').update(updates).eq('id', id);
    if (!error) setGuests(list => list.map(g => g.id === id ? { ...g, ...updates } : g));
    return { error };
  }

  async function deleteGuest(id) {
    const { error } = await supabase.from('wedding_guests').delete().eq('id', id);
    if (!error) setGuests(list => list.filter(g => g.id !== id));
    return { error };
  }

  // ── Vendors ─────────────────────────────────────────────────────────────────
  async function addVendor(vendor) {
    const { data, error } = await supabase
      .from('wedding_vendors')
      .insert({ ...vendor, plan_id: plan.id, boutique_id: boutiqueId })
      .select().single();
    if (!error) setVendors(list => [...list, data]);
    return { data, error };
  }

  async function updateVendor(id, updates) {
    const { error } = await supabase.from('wedding_vendors').update(updates).eq('id', id);
    if (!error) setVendors(list => list.map(v => v.id === id ? { ...v, ...updates } : v));
    return { error };
  }

  async function deleteVendor(id) {
    const { error } = await supabase.from('wedding_vendors').delete().eq('id', id);
    if (!error) setVendors(list => list.filter(v => v.id !== id));
    return { error };
  }

  // ── Run of Show ─────────────────────────────────────────────────────────────
  async function addRunItem(item) {
    const { data, error } = await supabase
      .from('wedding_run_of_show')
      .insert({ ...item, plan_id: plan.id, boutique_id: boutiqueId })
      .select().single();
    if (!error) setRunOfShow(list => [...list, data]);
    return { data, error };
  }

  async function updateRunItem(id, updates) {
    const { error } = await supabase.from('wedding_run_of_show').update(updates).eq('id', id);
    if (!error) setRunOfShow(list => list.map(r => r.id === id ? { ...r, ...updates } : r));
    return { error };
  }

  async function deleteRunItem(id) {
    const { error } = await supabase.from('wedding_run_of_show').delete().eq('id', id);
    if (!error) setRunOfShow(list => list.filter(r => r.id !== id));
    return { error };
  }

  // ── Music ───────────────────────────────────────────────────────────────────
  async function updateMusicItem(id, updates) {
    const { error } = await supabase.from('wedding_music').update(updates).eq('id', id);
    if (!error) setMusic(list => list.map(m => m.id === id ? { ...m, ...updates } : m));
    return { error };
  }

  async function addMusicItem(item) {
    const { data, error } = await supabase
      .from('wedding_music')
      .insert({ ...item, plan_id: plan.id, boutique_id: boutiqueId })
      .select().single();
    if (!error) setMusic(list => [...list, data]);
    return { data, error };
  }

  async function deleteMusicItem(id) {
    const { error } = await supabase.from('wedding_music').delete().eq('id', id);
    if (!error) setMusic(list => list.filter(m => m.id !== id));
    return { error };
  }

  // ── Gifts ───────────────────────────────────────────────────────────────────
  async function addGift(gift) {
    const { data, error } = await supabase
      .from('wedding_gifts')
      .insert({ ...gift, plan_id: plan.id, boutique_id: boutiqueId })
      .select().single();
    if (!error) setGifts(list => [...list, data]);
    return { data, error };
  }

  async function updateGift(id, updates) {
    const { error } = await supabase.from('wedding_gifts').update(updates).eq('id', id);
    if (!error) setGifts(list => list.map(g => g.id === id ? { ...g, ...updates } : g));
    return { error };
  }

  async function deleteGift(id) {
    const { error } = await supabase.from('wedding_gifts').delete().eq('id', id);
    if (!error) setGifts(list => list.filter(g => g.id !== id));
    return { error };
  }

  // ── Legal ───────────────────────────────────────────────────────────────────
  async function toggleLegalItem(id, done) {
    const { error } = await supabase
      .from('wedding_legal_items')
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq('id', id);
    if (!error) setLegalItems(list => list.map(i => i.id === id ? { ...i, done, done_at: done ? new Date().toISOString() : null } : i));
    return { error };
  }

  return {
    plan, checklist, budget, guests, vendors, runOfShow, music, gifts, legalItems,
    loading, refetch: fetchAll,
    // plan
    initPlan, updatePlan,
    // checklist
    toggleChecklist, addChecklistItem,
    // budget
    updateBudgetItem, addBudgetItem, deleteBudgetItem,
    // guests
    addGuest, updateGuest, deleteGuest,
    // vendors
    addVendor, updateVendor, deleteVendor,
    // run of show
    addRunItem, updateRunItem, deleteRunItem,
    // music
    updateMusicItem, addMusicItem, deleteMusicItem,
    // gifts
    addGift, updateGift, deleteGift,
    // legal
    toggleLegalItem,
  };
}
