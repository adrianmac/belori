import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logInventoryAudit } from './useInventoryAudit'

export function useInventory() {
  const { boutique } = useAuth()
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boutique) return
    fetchInventory()
  }, [boutique?.id])

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
          client_name: updates.client_id ? null : null, // client_name resolved in callers if needed
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

  const lowStockCount = inventory.filter(i =>
    i.track && i.currentStock != null && i.minStock > 0 && i.currentStock <= i.minStock
  ).length

  return { inventory, loading, lowStockCount, createDress, updateDress, refetch: fetchInventory }
}
