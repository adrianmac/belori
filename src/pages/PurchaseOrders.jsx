import React, { useState, useMemo } from 'react'
import { C, fmt } from '../lib/colors'
import { Topbar, inputSt, LBL, useToast } from '../lib/ui.jsx'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import { useVendors } from '../hooks/useVendors'
import { useInventory } from '../hooks/useInventory'

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:      { label: 'Draft',      bg: C.grayBg,   color: C.gray },
  sent:       { label: 'Sent',       bg: C.blueBg,   color: C.blue },
  partial:    { label: 'Partial',    bg: C.amberBg,  color: C.amber },
  received:   { label: 'Received',   bg: C.greenBg,  color: C.green },
  cancelled:  { label: 'Cancelled',  bg: '#FEE2E2',  color: C.red },
}

const STATUS_TABS = ['all', 'draft', 'sent', 'partial', 'received', 'cancelled']

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <span style={{
      fontSize: 11, padding: '3px 9px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  )
}

// ─── AUTO-GENERATE PO NUMBER ──────────────────────────────────────────────────
function genPONumber() {
  const d = new Date()
  const ymd = d.toISOString().slice(0, 10)
  const rnd = String(Math.floor(Math.random() * 900) + 100)
  return `PO-${ymd}-${rnd}`
}

// ─── CREATE PO MODAL ──────────────────────────────────────────────────────────
const BLANK_ITEM = { item_name: '', sku: '', inventory_id: '', quantity_ordered: 1, unit_cost: '', notes: '' }

function CreatePOModal({ vendors, inventory, onSave, onClose }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [vendorId, setVendorId] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [poNumber] = useState(genPONumber)
  const [expectedDate, setExpectedDate] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ ...BLANK_ITEM }])

  const total = items.reduce((s, it) =>
    s + (Number(it.quantity_ordered || 1) * Number(it.unit_cost || 0)), 0)

  function setItem(idx, key, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  }

  function addItem() { setItems(prev => [...prev, { ...BLANK_ITEM }]) }
  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  function handleInventoryLink(idx, invId) {
    const inv = inventory.find(i => i.id === invId)
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      inventory_id: invId,
      item_name: invId ? (inv?.name || it.item_name) : it.item_name,
      sku: invId ? (inv?.sku || it.sku) : it.sku,
    } : it))
  }

  function handleVendorChange(vid) {
    setVendorId(vid)
    const v = vendors.find(v => v.id === vid)
    setVendorName(v?.name || '')
  }

  async function handleSave(asDraft) {
    const validItems = items.filter(it => it.item_name.trim())
    if (!validItems.length) { toast('Add at least one line item'); return }
    setSaving(true)
    const { error } = await onSave({
      vendor_id: vendorId || null,
      vendor_name: vendorName || null,
      po_number: poNumber,
      expected_date: expectedDate || null,
      order_date: orderDate,
      notes: notes || null,
      items: validItems,
    })
    setSaving(false)
    if (error) { toast('Failed to create PO'); return }
    toast(asDraft ? 'PO saved as draft' : 'PO created and marked sent')
    onClose()
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.white, borderRadius: 16, width: '100%', maxWidth: 700,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>New Purchase Order</div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>PO# {poNumber}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Row 1: Vendor + Order date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={LBL}>Vendor</label>
              <select value={vendorId} onChange={e => handleVendorChange(e.target.value)} style={inputSt}>
                <option value="">-- Select vendor --</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Order date</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} style={inputSt} />
            </div>
          </div>

          {/* Row 2: Expected delivery + Vendor name override */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={LBL}>Expected delivery date</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={LBL}>Vendor name (override)</label>
              <input value={vendorName} onChange={e => setVendorName(e.target.value)}
                placeholder="Custom vendor name…" style={inputSt} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 10 }}>Line items</div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 100px 100px 90px 80px 32px',
                gap: 8, padding: '8px 12px', background: C.grayBg,
                fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <span>Item</span>
                <span>SKU</span>
                <span>Link inv.</span>
                <span>Qty</span>
                <span>Unit cost</span>
                <span></span>
              </div>

              {items.map((it, idx) => (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: '2fr 100px 100px 90px 80px 32px',
                  gap: 8, padding: '8px 12px', alignItems: 'center',
                  borderTop: idx > 0 ? `1px solid ${C.border}` : 'none',
                }}>
                  <input
                    value={it.item_name}
                    onChange={e => setItem(idx, 'item_name', e.target.value)}
                    placeholder="Item name *"
                    style={{ ...inputSt, padding: '6px 8px', fontSize: 12 }}
                  />
                  <input
                    value={it.sku}
                    onChange={e => setItem(idx, 'sku', e.target.value)}
                    placeholder="SKU"
                    style={{ ...inputSt, padding: '6px 8px', fontSize: 12 }}
                  />
                  <select
                    value={it.inventory_id}
                    onChange={e => handleInventoryLink(idx, e.target.value)}
                    style={{ ...inputSt, padding: '6px 8px', fontSize: 11, cursor: 'pointer' }}
                  >
                    <option value="">None</option>
                    {inventory.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.name}</option>
                    ))}
                  </select>
                  <input
                    type="number" min="1" step="1"
                    value={it.quantity_ordered}
                    onChange={e => setItem(idx, 'quantity_ordered', e.target.value)}
                    style={{ ...inputSt, padding: '6px 8px', fontSize: 12 }}
                  />
                  <input
                    type="number" min="0" step="0.01"
                    value={it.unit_cost}
                    onChange={e => setItem(idx, 'unit_cost', e.target.value)}
                    placeholder="0.00"
                    style={{ ...inputSt, padding: '6px 8px', fontSize: 12 }}
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    style={{ background: 'none', border: 'none', color: C.gray, cursor: items.length === 1 ? 'default' : 'pointer', fontSize: 18, lineHeight: 1, padding: 0, opacity: items.length === 1 ? 0.3 : 1 }}
                  >×</button>
                </div>
              ))}

              {/* Add row + total */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderTop: `1px solid ${C.border}`, background: C.ivory }}>
                <button onClick={addItem}
                  style={{ fontSize: 12, fontWeight: 600, color: C.rosa, background: 'none', border: `1px solid ${C.rosa}`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}>
                  + Add item
                </button>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                  Total: <span style={{ color: C.green }}>{fmt(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={LBL}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Delivery instructions, special requests…"
              rows={3}
              style={{ ...inputSt, resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, background: 'none', border: `1px solid ${C.border}`, color: C.gray, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            style={{ padding: '8px 18px', borderRadius: 8, background: C.grayBg, border: `1px solid ${C.border}`, color: C.ink, fontSize: 13, fontWeight: 500, cursor: saving ? 'default' : 'pointer' }}>
            Save as draft
          </button>
          <button onClick={() => handleSave(false)} disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 8, background: C.rosa, border: 'none', color: C.white, fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving…' : 'Send to vendor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PO DETAIL PANEL ─────────────────────────────────────────────────────────
function PODetailPanel({ po, onClose, onUpdatePO, onReceivePO, onDeletePO }) {
  const toast = useToast()
  const [receiveMode, setReceiveMode] = useState(false)
  const [receivedQtys, setReceivedQtys] = useState({})
  const [saving, setSaving] = useState(false)

  const cfg = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft

  function initReceive() {
    const init = {}
    po.items.forEach(it => { init[it.id] = it.quantity_received || 0 })
    setReceivedQtys(init)
    setReceiveMode(true)
  }

  async function confirmReceipt() {
    const receivedItems = po.items.map(it => ({
      itemId: it.id,
      quantityReceived: Number(receivedQtys[it.id] || 0),
    }))
    setSaving(true)
    const { error } = await onReceivePO(po.id, receivedItems)
    setSaving(false)
    if (error) { toast('Failed to receive items'); return }
    toast('Items received — stock updated')
    setReceiveMode(false)
  }

  async function handleMarkSent() {
    setSaving(true)
    const { error } = await onUpdatePO(po.id, { status: 'sent' })
    setSaving(false)
    if (error) { toast('Failed to update status'); return }
    toast('PO marked as sent')
  }

  async function handleCancel() {
    if (!window.confirm('Cancel this purchase order?')) return
    setSaving(true)
    const { error } = await onUpdatePO(po.id, { status: 'cancelled' })
    setSaving(false)
    if (error) { toast('Failed to cancel PO'); return }
    toast('PO cancelled')
  }

  async function handleDelete() {
    if (!window.confirm('Delete this purchase order permanently?')) return
    setSaving(true)
    const { error } = await onDeletePO(po.id)
    setSaving(false)
    if (error) { toast('Failed to delete PO'); return }
    toast('PO deleted')
    onClose()
  }

  // Stock impact preview
  const stockImpact = receiveMode
    ? po.items.filter(it => it.inventory_id).map(it => ({
        name: it.item_name,
        delta: Number(receivedQtys[it.id] || 0) - Number(it.quantity_received || 0),
      })).filter(x => x.delta > 0)
    : []

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 480, background: C.white, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
      display: 'flex', flexDirection: 'column', zIndex: 900,
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{po.po_number || 'PO (no number)'}</div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
              {po.vendor_name || 'Unknown vendor'} &middot; {po.order_date ? new Date(po.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        {/* Dates + badge row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StatusBadge status={po.status} />
          {po.expected_date && (
            <span style={{ fontSize: 11, color: C.gray }}>
              Expected: {new Date(po.expected_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {po.received_date && (
            <span style={{ fontSize: 11, color: C.green }}>
              Received: {new Date(po.received_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Action buttons */}
        {po.status !== 'cancelled' && po.status !== 'received' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {po.status === 'draft' && (
              <button onClick={handleMarkSent} disabled={saving}
                style={{ padding: '6px 14px', borderRadius: 7, background: C.blueBg, color: C.blue, border: `1px solid ${C.blue}`, fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                Mark Sent
              </button>
            )}
            {(po.status === 'sent' || po.status === 'partial') && !receiveMode && (
              <button onClick={initReceive}
                style={{ padding: '6px 14px', borderRadius: 7, background: C.greenBg, color: C.green, border: `1px solid ${C.green}`, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Receive Items
              </button>
            )}
            {!receiveMode && (
              <button onClick={handleCancel} disabled={saving}
                style={{ padding: '6px 14px', borderRadius: 7, background: '#FEE2E2', color: C.red, border: `1px solid ${C.red}`, fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Line items table */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Line items ({po.items.length})</div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: receiveMode ? '2fr 70px 70px 80px' : '2fr 70px 70px',
              gap: 8, padding: '7px 12px', background: C.grayBg,
              fontSize: 10, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span>Item</span>
              <span>Ordered</span>
              <span>Received</span>
              {receiveMode && <span>Receive now</span>}
            </div>

            {po.items.map((it, idx) => {
              const fullyReceived = Number(it.quantity_received || 0) >= Number(it.quantity_ordered)
              return (
                <div key={it.id} style={{
                  display: 'grid', gridTemplateColumns: receiveMode ? '2fr 70px 70px 80px' : '2fr 70px 70px',
                  gap: 8, padding: '9px 12px', alignItems: 'center',
                  borderTop: idx > 0 ? `1px solid ${C.border}` : 'none',
                  background: fullyReceived && !receiveMode ? '#F0FDF4' : 'transparent',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.item_name}</div>
                    {it.sku && <div style={{ fontSize: 10, color: C.gray }}>SKU: {it.sku}</div>}
                    <div style={{ fontSize: 11, color: C.gray }}>{fmt(it.unit_cost)} / unit</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{it.quantity_ordered}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: fullyReceived ? C.green : C.amber }}>
                    {it.quantity_received || 0}
                  </div>
                  {receiveMode && (
                    <input
                      type="number" min="0" max={it.quantity_ordered} step="1"
                      value={receivedQtys[it.id] ?? it.quantity_received ?? 0}
                      onChange={e => setReceivedQtys(q => ({ ...q, [it.id]: e.target.value }))}
                      style={{ ...inputSt, padding: '5px 7px', fontSize: 12, maxWidth: 70 }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Stock impact preview */}
        {receiveMode && stockImpact.length > 0 && (
          <div style={{ background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 6 }}>Stock impact preview</div>
            {stockImpact.map((x, i) => (
              <div key={i} style={{ fontSize: 12, color: C.green }}>
                {x.name}: inventory will increase by +{x.delta}
              </div>
            ))}
          </div>
        )}

        {/* Receive confirm button */}
        {receiveMode && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setReceiveMode(false)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, background: 'none', border: `1px solid ${C.border}`, color: C.gray, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={confirmReceipt} disabled={saving}
              style={{ flex: 2, padding: '9px 0', borderRadius: 8, background: C.green, color: C.white, border: 'none', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Updating…' : 'Confirm Receipt'}
            </button>
          </div>
        )}

        {/* Notes */}
        {po.notes && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 13, color: C.gray, background: C.ivory, borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>{po.notes}</div>
          </div>
        )}

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Total amount</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{fmt(po.total_amount)}</span>
        </div>
      </div>

      {/* Delete footer */}
      <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleDelete} disabled={saving}
          style={{ padding: '7px 14px', borderRadius: 7, background: 'none', border: `1px solid ${C.border}`, color: C.gray, fontSize: 12, cursor: saving ? 'default' : 'pointer' }}>
          Delete PO
        </button>
      </div>
    </div>
  )
}

// ─── PO CARD ─────────────────────────────────────────────────────────────────
function POCard({ po, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
            {po.po_number || 'Untitled PO'}
          </div>
          <div style={{ fontSize: 12, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {po.vendor_name || 'No vendor'}
          </div>
        </div>
        <StatusBadge status={po.status} />
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: C.gray }}>
          Ordered: {po.order_date ? new Date(po.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
        {po.expected_date && (
          <span style={{ fontSize: 11, color: C.gray }}>
            Expected: {new Date(po.expected_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        <span style={{ fontSize: 11, color: C.gray }}>{po.items?.length || 0} item{po.items?.length !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.green, marginLeft: 'auto' }}>{fmt(po.total_amount)}</span>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function PurchaseOrders({ filterVendorId, goScreen }) {
  const { pos, loading, createPO, updatePO, receivePO, deletePO } = usePurchaseOrders()
  const { vendors } = useVendors()
  const { inventory } = useInventory()
  const [statusFilter, setStatusFilter] = useState(filterVendorId ? 'all' : 'all')
  const [selectedPO, setSelectedPO] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    let list = pos
    if (filterVendorId) list = list.filter(p => p.vendor_id === filterVendorId)
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter)
    return list
  }, [pos, statusFilter, filterVendorId])

  // Counts for tab badges
  const counts = useMemo(() => {
    const c = {}
    STATUS_TABS.forEach(s => {
      c[s] = s === 'all' ? pos.length : pos.filter(p => p.status === s).length
    })
    return c
  }, [pos])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar
        title="Purchase Orders"
        subtitle={filterVendorId ? `Filtered by vendor` : `${pos.length} order${pos.length !== 1 ? 's' : ''}`}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '7px 16px', borderRadius: 8, background: C.rosa, color: C.white, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + New PO
          </button>
        }
      />

      {/* Status filter tabs */}
      <div style={{
        display: 'flex', gap: 2, padding: '10px 16px', background: C.white,
        borderBottom: `1px solid ${C.border}`, overflowX: 'auto', flexShrink: 0,
      }}>
        {STATUS_TABS.map(s => {
          const active = statusFilter === s
          const cfg = STATUS_CONFIG[s]
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '5px 13px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: active ? 600 : 400,
                background: active ? (cfg ? cfg.bg : C.rosaPale) : 'transparent',
                color: active ? (cfg ? cfg.color : C.rosa) : C.gray,
                whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.12s',
              }}
            >
              {s === 'all' ? 'All' : (cfg?.label || s)}
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 999,
                background: active ? 'rgba(0,0,0,0.1)' : C.grayBg, color: 'inherit', fontWeight: 600,
              }}>{counts[s] || 0}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.gray, fontSize: 13 }}>Loading purchase orders…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 40 }}>📦</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>No purchase orders</div>
            <div style={{ fontSize: 13, color: C.gray }}>
              {statusFilter !== 'all' ? 'No orders with this status.' : 'Create your first purchase order to get started.'}
            </div>
            {statusFilter === 'all' && (
              <button
                onClick={() => setShowCreate(true)}
                style={{ marginTop: 8, padding: '9px 20px', borderRadius: 8, background: C.rosa, color: C.white, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                + New PO
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 800 }}>
            {filtered.map(po => (
              <POCard
                key={po.id}
                po={po}
                onClick={() => setSelectedPO(po)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedPO && (() => {
        const livePO = pos.find(p => p.id === selectedPO.id) || selectedPO
        return (
          <PODetailPanel
            po={livePO}
            onClose={() => setSelectedPO(null)}
            onUpdatePO={updatePO}
            onReceivePO={receivePO}
            onDeletePO={deletePO}
          />
        )
      })()}

      {/* Backdrop for detail panel */}
      {selectedPO && (
        <div
          onClick={() => setSelectedPO(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 899 }}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreatePOModal
          vendors={vendors}
          inventory={inventory}
          onSave={createPO}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
