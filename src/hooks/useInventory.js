import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logInventoryAudit } from './useInventoryAudit'

export function useInventory({ enabled = true } = {}) {
  const { boutique } = useAuth()
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boutique || !enabled) return
    fetchInventory()
  }, [boutique?.id, enabled])

  async function fetchInventory() {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory')
      .select(`*, client:clients(id, name)`)
      .eq('boutique_id', boutique.id)
      .limit(500)
      .order('sku', { ascending: true })

    if (!error && data) setInventory(data)
    setLoading(false)
  }

  async function createDress(payload) {
    const { data, error } = await supabase
      .from('inventory')
      .insert({ ...payload, boutique_id: boutique.id })
      .select()
      .single()

    if (!error && data) {
      await fetchInventory()
      await logInventoryAudit(supabase, {
        boutique_id: boutique.id,
        inventory_id: data.id,
        action: 'created',
        new_status: data.status || 'available',
        user_name: boutique?.name || 'Staff',
      })
    }
    return { data, error }
  }

  async function updateDress(id, updates) {
    // Capture prev status before mutation for audit trail
    const prevItem = inventory.find(i => i.id === id)
    const prevStatus = prevItem?.status || null

    const { error } = await supabase
      .from('inventory')
      .update(updates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)

    if (!error) {
      await fetchInventory()
      // Only log if the update includes a status change or notable action
      if (updates.status !== undefined) {
        const newStatus = updates.status
        let action = 'status_change'
        if (newStatus === 'picked_up' || newStatus === 'rented') {
          action = 'checked_out'
        } else if (newStatus === 'returned') {
          action = 'checked_in'
        } else if (newStatus === 'cleaning') {
          action = 'cleaned'
        } else if (newStatus === 'reserved') {
          action = 'reserved'
        } else if (newStatus === 'available' && (prevStatus === 'cleaning' || prevStatus === 'returned')) {
          action = 'cleaned'
        }
        await logInventoryAudit(supabase, {
          boutique_id: boutique.id,
          inventory_id: id,
          action,
          prev_status: prevStatus,
          new_status: newStatus,
          user_name: boutique?.name || 'Staff',
          client_name: updates.client_name || null,
        })
      } else if (Object.keys(updates).length > 0) {
        // Non-status update (metadata edit)
        await logInventoryAudit(supabase, {
          boutique_id: boutique.id,
          inventory_id: id,
          action: 'updated',
          user_name: boutique?.name || 'Staff',
        })
      }
    }
    return { error }
  }

  /**
   * Bulk update — single Postgres round-trip + one batched audit-log insert.
   *
   * The previous pattern of `for (const id of selectedIds) await updateDress(id, updates)`
   * fired N HTTP requests, N audit inserts, and N fetchInventory() calls.
   * For 30 items, that's ~90 sequential round-trips. This collapses to 3.
   *
   * @param {string[]} ids - inventory rows to update
   * @param {object}   updates - same shape as updateDress (e.g. { status: 'available' })
   * @param {object}   audit - { action, user_name, client_name, notes } applied to each row
   * @returns {Promise<{ error: any, updatedCount: number }>}
   */
  async function bulkUpdate(ids, updates, audit = {}) {
    if (!ids || ids.length === 0) return { error: null, updatedCount: 0 }

    // Snapshot prev statuses for the audit trail (so we can record the
    // before/after correctly even though all rows transition together).
    const prevById = new Map(inventory.map(i => [i.id, i.status || null]))

    // 1. Single UPDATE — RLS still enforces boutique scoping
    const { error } = await supabase
      .from('inventory')
      .update(updates)
      .in('id', ids)
      .eq('boutique_id', boutique.id)

    if (error) return { error, updatedCount: 0 }

    // 2. One bulk INSERT into the audit log (best-effort; never blocks success)
    if (audit.action) {
      const rows = ids.map(id => ({
        boutique_id: boutique.id,
        inventory_id: id,
        action: audit.action,
        prev_status: prevById.get(id) ?? null,
        new_status: updates.status ?? null,
        user_name: audit.user_name || boutique?.name || 'Staff',
        client_name: audit.client_name ?? null,
        notes: audit.notes ?? null,
      }))
      // Fire-and-forget — audit log failure should never block the user
      supabase.from('inventory_audit_log').insert(rows).then(() => {})
    }

    // 3. Single re-fetch (vs N inside the old loop)
    await fetchInventory()
    return { error: null, updatedCount: ids.length }
  }

  const lowStockCount = inventory.filter(i =>
    i.track && i.currentStock != null && i.minStock > 0 && i.currentStock <= i.minStock
  ).length

  return { inventory, loading, lowStockCount, createDress, updateDress, bulkUpdate, refetch: fetchInventory }
}
