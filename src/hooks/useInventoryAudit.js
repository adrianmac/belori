import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── Standalone helper (non-hook) — safe to call inside async functions ───────
// Call this after a successful supabase update/insert to log the action.
export async function logInventoryAudit(supabaseClient, {
  boutique_id,
  inventory_id,
  action,
  prev_status = null,
  new_status = null,
  user_name = 'Staff',
  event_id = null,
  client_name = null,
  notes = null,
}) {
  if (!boutique_id || !inventory_id || !action) return
  await supabaseClient.from('inventory_audit_log').insert({
    boutique_id,
    inventory_id,
    action,
    prev_status,
    new_status,
    user_name,
    event_id: event_id || null,
    client_name: client_name || null,
    notes: notes || null,
  })
}

// ─── Hook: single item audit log ─────────────────────────────────────────────
export function useInventoryAudit(inventoryId) {
  const { boutique } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!boutique?.id || !inventoryId) return
    fetchEntries()
  }, [boutique?.id, inventoryId])

  async function fetchEntries() {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory_audit_log')
      .select('*')
      .eq('boutique_id', boutique.id)
      .eq('inventory_id', inventoryId)
      .order('created_at', { ascending: false })
    if (!error && data) setEntries(data)
    setLoading(false)
  }

  return { entries, loading, refetch: fetchEntries }
}

// ─── Hook: boutique-wide audit log (last 200) ─────────────────────────────────
export function useInventoryAuditAll() {
  const { boutique } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!boutique?.id) return
    fetchAll()
  }, [boutique?.id])

  async function fetchAll() {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory_audit_log')
      .select('*, inventory:inventory(name, sku, category)')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })
      .limit(200)
    if (!error && data) setEntries(data)
    setLoading(false)
  }

  async function logAuditEntry({
    inventory_id,
    action,
    prev_status = null,
    new_status = null,
    user_name = 'Staff',
    event_id = null,
    client_name = null,
    notes = null,
  }) {
    if (!boutique?.id || !inventory_id || !action) return
    const { error } = await supabase.from('inventory_audit_log').insert({
      boutique_id: boutique.id,
      inventory_id,
      action,
      prev_status,
      new_status,
      user_name,
      event_id: event_id || null,
      client_name: client_name || null,
      notes: notes || null,
    })
    if (!error) await fetchAll()
  }

  return { entries, loading, logAuditEntry, refetch: fetchAll }
}
