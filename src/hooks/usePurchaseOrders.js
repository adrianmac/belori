import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function usePurchaseOrders() {
  const { boutique } = useAuth()
  const [pos, setPos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boutique) return
    fetchAll()
  }, [boutique?.id])

  useEffect(() => {
    if (!boutique) return
    const channel = supabase
      .channel('boutique-pos-rt-' + boutique.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders', filter: 'boutique_id=eq.' + boutique.id }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_order_items', filter: 'boutique_id=eq.' + boutique.id }, () => fetchAll())
      .subscribe()
    return () => { channel.unsubscribe(); supabase.removeChannel(channel); }
  }, [boutique?.id])

  async function fetchAll() {
    if (!boutique) return
    setLoading(true)
    const { data: poData, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })

    if (error || !poData) { setLoading(false); return }

    // Fetch all items for these POs
    const poIds = poData.map(p => p.id)
    let items = []
    if (poIds.length > 0) {
      const { data: itemData } = await supabase
        .from('purchase_order_items')
        .select('*')
        .in('po_id', poIds)
      items = itemData || []
    }

    // Attach items to each PO
    const enriched = poData.map(p => ({
      ...p,
      items: items.filter(i => i.po_id === p.id),
    }))
    setPos(enriched)
    setLoading(false)
  }

  async function createPO({ vendor_id, vendor_name, po_number, expected_date, order_date, notes, items = [] }) {
    if (!boutique) return { error: new Error('Not authenticated') }

    // Insert the PO header
    const total = items.reduce((s, it) => s + (Number(it.quantity_ordered || 1) * Number(it.unit_cost || 0)), 0)
    const { data: poRow, error: poErr } = await supabase
      .from('purchase_orders')
      .insert({
        boutique_id: boutique.id,
        vendor_id: vendor_id || null,
        vendor_name: vendor_name || null,
        po_number: po_number || null,
        status: 'draft',
        order_date: order_date || new Date().toISOString().slice(0, 10),
        expected_date: expected_date || null,
        notes: notes || null,
        total_amount: total,
      })
      .select()
      .single()

    if (poErr) return { error: poErr }

    // Insert line items
    if (items.length > 0) {
      const rows = items.map(it => ({
        boutique_id: boutique.id,
        po_id: poRow.id,
        inventory_id: it.inventory_id || null,
        item_name: it.item_name,
        sku: it.sku || null,
        quantity_ordered: Number(it.quantity_ordered) || 1,
        quantity_received: 0,
        unit_cost: Number(it.unit_cost) || 0,
        notes: it.notes || null,
      }))
      const { error: itemErr } = await supabase.from('purchase_order_items').insert(rows)
      if (itemErr) return { error: itemErr }
    }

    await fetchAll()
    return { data: poRow }
  }

  async function updatePO(id, changes) {
    if (!boutique) return { error: new Error('Not authenticated') }
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('boutique_id', boutique.id)
      .select()
      .single()
    if (!error) await fetchAll()
    return { data, error }
  }

  async function updatePOItem(itemId, changes) {
    if (!boutique) return { error: new Error('Not authenticated') }
    const { data, error } = await supabase
      .from('purchase_order_items')
      .update(changes)
      .eq('id', itemId)
      .eq('boutique_id', boutique.id)
      .select()
      .single()
    if (!error) await fetchAll()
    return { data, error }
  }

  // receivePO: marks PO received, updates quantity_received on each item,
  // and increments inventory.currentStock + availQty for matched inventory_id items
  async function receivePO(poId, receivedItems) {
    if (!boutique) return { error: new Error('Not authenticated') }

    // Batch-update all item quantity_received in parallel
    await Promise.all(
      receivedItems.map(({ itemId, quantityReceived }) =>
        supabase
          .from('purchase_order_items')
          .update({ quantity_received: Number(quantityReceived) || 0 })
          .eq('id', itemId)
          .eq('boutique_id', boutique.id)
      )
    )

    // Update inventory stock for items that have an inventory_id
    const po = pos.find(p => p.id === poId)
    if (po) {
      // Collect inventory_ids with their deltas upfront, then batch-fetch
      const invUpdates = receivedItems
        .map(({ itemId, quantityReceived }) => {
          const poItem = po.items.find(i => i.id === itemId)
          if (!poItem?.inventory_id || Number(quantityReceived) <= 0) return null
          const delta = Number(quantityReceived) - Number(poItem.quantity_received || 0)
          return delta > 0 ? { inventory_id: poItem.inventory_id, delta } : null
        })
        .filter(Boolean)

      if (invUpdates.length > 0) {
        const invIds = invUpdates.map(u => u.inventory_id)
        const { data: invItems } = await supabase
          .from('inventory')
          .select('id, currentStock, availQty')
          .in('id', invIds)
          .eq('boutique_id', boutique.id)

        if (invItems?.length) {
          await Promise.all(
            invUpdates.map(({ inventory_id, delta }) => {
              const invItem = invItems.find(i => i.id === inventory_id)
              if (!invItem) return Promise.resolve()
              return supabase
                .from('inventory')
                .update({
                  currentStock: (invItem.currentStock || 0) + delta,
                  availQty: (invItem.availQty || 0) + delta,
                })
                .eq('id', inventory_id)
                .eq('boutique_id', boutique.id)
            })
          )
        }
      }
    }

    // Determine new status: check if all items fully received
    const allReceived = receivedItems.every(ri => {
      const poItem = po?.items.find(i => i.id === ri.itemId)
      return Number(ri.quantityReceived) >= Number(poItem?.quantity_ordered || 1)
    })
    const newStatus = allReceived ? 'received' : 'partial'

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: newStatus,
        received_date: newStatus === 'received' ? new Date().toISOString().slice(0, 10) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .eq('boutique_id', boutique.id)
      .select()
      .single()

    await fetchAll()
    return { data, error }
  }

  async function deletePO(id) {
    if (!boutique) return { error: new Error('Not authenticated') }
    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!error) await fetchAll()
    return { error }
  }

  return { pos, loading, createPO, updatePO, updatePOItem, receivePO, deletePO, refresh: fetchAll }
}
