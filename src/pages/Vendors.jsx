import React, { useState, useMemo } from 'react'
import { C, fmt } from '../lib/colors'
import { Topbar, inputSt, LBL, useToast, EmptyState } from '../lib/ui.jsx'
import { useVendors } from '../hooks/useVendors'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ─── CATEGORY CONFIG ─────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'all',           label: 'All' },
  { value: 'florist',       label: 'Florist' },
  { value: 'photographer',  label: 'Photographer' },
  { value: 'dj',            label: 'DJ / Music' },
  { value: 'caterer',       label: 'Catering' },
  { value: 'venue',         label: 'Venue' },
  { value: 'seamstress',    label: 'Seamstress' },
  { value: 'transportation',label: 'Transportation' },
  { value: 'decor',         label: 'Decor' },
  { value: 'other',         label: 'Other' },
]

const CAT_COLORS = {
  florist:        { bg: '#DCFCE7', color: '#15803D' },
  photographer:   { bg: '#DBEAFE', color: '#1D4ED8' },
  dj:             { bg: '#EDE9FE', color: '#7C3AED' },
  caterer:        { bg: '#FEF3C7', color: '#B45309' },
  venue:          { bg: C.rosaPale, color: C.rosaText },
  seamstress:     { bg: '#FDF2F8', color: '#9D174D' },
  transportation: { bg: '#F0FDF4', color: '#166534' },
  decor:          { bg: '#FFF7ED', color: '#C2410C' },
  other:          { bg: C.grayBg, color: C.gray },
}

const CAT_LABELS = {
  florist: 'Florist', photographer: 'Photographer', dj: 'DJ / Music',
  caterer: 'Catering', venue: 'Venue', seamstress: 'Seamstress',
  transportation: 'Transportation', decor: 'Decor', other: 'Other',
}

function catStyle(cat) {
  return CAT_COLORS[cat] || { bg: C.grayBg, color: C.gray }
}

// ─── STAR RATING DISPLAY ─────────────────────────────────────────────────────
function StarDisplay({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ fontSize: 13, color: n <= rating ? '#F59E0B' : C.border }}>★</span>
      ))}
    </div>
  )
}

// ─── STAR RATING INPUT ───────────────────────────────────────────────────────
function StarInput({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => onChange(n === value ? 0 : n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          style={{
            fontSize: 22,
            cursor: 'pointer',
            color: n <= (hovered || value) ? '#F59E0B' : C.border,
            transition: 'color 0.1s',
            userSelect: 'none',
          }}
        >★</span>
      ))}
    </div>
  )
}

// ─── VENDOR MODAL ────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '', category: 'florist', contact_name: '', phone: '',
  email: '', website: '', notes: '', rating: 0,
}

function VendorModal({ vendor, onSave, onClose, saving }) {
  const [form, setForm] = useState(vendor ? {
    name: vendor.name || '',
    category: vendor.category || 'florist',
    contact_name: vendor.contact_name || '',
    phone: vendor.phone || '',
    email: vendor.email || '',
    website: vendor.website || '',
    notes: vendor.notes || '',
    rating: vendor.rating || 0,
  } : { ...EMPTY_FORM })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 16, width: '100%', maxWidth: 520,
          maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>
            {vendor ? 'Edit Vendor' : 'Add Vendor'}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray, lineHeight: 1 }}
           aria-label="Close">×</button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name */}
          <div>
            <label style={LBL}>Vendor / Business name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Petal & Bloom Florals"
              required
              style={inputSt}
            />
          </div>

          {/* Category */}
          <div>
            <label style={LBL}>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={inputSt}>
              {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Contact name */}
          <div>
            <label style={LBL}>Contact name</label>
            <input
              value={form.contact_name}
              onChange={e => set('contact_name', e.target.value)}
              placeholder="e.g. Maria Gonzalez"
              style={inputSt}
            />
          </div>

          {/* Phone + Email row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LBL}>Phone</label>
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+1 (555) 000-0000"
                type="tel"
                style={inputSt}
              />
            </div>
            <div>
              <label style={LBL}>Email</label>
              <input
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="hello@vendor.com"
                type="email"
                style={inputSt}
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label style={LBL}>Website</label>
            <input
              value={form.website}
              onChange={e => set('website', e.target.value)}
              placeholder="https://vendor.com"
              style={inputSt}
            />
          </div>

          {/* Rating */}
          <div>
            <label style={{ ...LBL, marginBottom: 8, display: 'block' }}>Rating</label>
            <StarInput value={form.rating} onChange={v => set('rating', v)} />
          </div>

          {/* Notes */}
          <div>
            <label style={LBL}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Pricing notes, special requirements, preferred contact times…"
              rows={3}
              style={{ ...inputSt, resize: 'vertical' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px', borderRadius: 8, background: 'none',
                border: `1px solid ${C.border}`, color: C.gray, fontSize: 13,
                fontWeight: 500, cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: saving ? C.gray : C.rosa,
                color: C.white, border: 'none', fontSize: 13,
                fontWeight: 500, cursor: saving ? 'default' : 'pointer',
              }}
            >{saving ? 'Saving…' : vendor ? 'Save changes' : 'Add vendor'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── VENDOR PAYMENTS MODAL ───────────────────────────────────────────────────
const PAYMENT_METHODS = ['bank_transfer', 'check', 'cash', 'card']
const PAYMENT_METHOD_LABELS = { bank_transfer: 'Bank transfer', check: 'Check', cash: 'Cash', card: 'Card' }

function VendorPaymentsModal({ vendor, payments, events, logVendorPayment, onClose }) {
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    amount: '', description: '', paid_date: new Date().toISOString().slice(0, 10),
    payment_method: 'bank_transfer', event_id: '', receipt_url: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const vendorPayments = payments.filter(p => p.vendor_id === vendor.id)
  const totalPaid = vendorPayments.reduce((s, p) => s + Number(p.amount || 0), 0)

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) return toast('Enter a valid amount')
    setSaving(true)
    const { error } = await logVendorPayment({
      vendor_id: vendor.id,
      amount: form.amount,
      description: form.description,
      paid_date: form.paid_date,
      payment_method: form.payment_method,
      event_id: form.event_id || null,
      receipt_url: form.receipt_url || null,
    })
    setSaving(false)
    if (error) { toast('Failed to log payment'); return }
    toast(`Payment of ${fmt(Number(form.amount))} logged`)
    setShowForm(false)
    setForm({ amount: '', description: '', paid_date: new Date().toISOString().slice(0, 10), payment_method: 'bank_transfer', event_id: '', receipt_url: '' })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 2 }}>💳 Payments — {vendor.name}</div>
            <div style={{ fontSize: 13, color: C.gray }}>Track money paid to this vendor</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray, lineHeight: 1 }} aria-label="Close">×</button>
        </div>

        {/* Total paid summary */}
        <div style={{ padding: '14px 24px', background: C.ivory, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total paid</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: totalPaid > 0 ? 'var(--color-success)' : C.gray }}>{fmt(totalPaid)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payments</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.ink }}>{vendorPayments.length}</div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Log payment button / form */}
          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              style={{ padding: '9px 16px', borderRadius: 8, background: C.rosa, color: C.white, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
              + Log payment
            </button>
          ) : (
            <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>New payment</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ ...LBL, display: 'block', marginBottom: 4 }}>Amount ($) *</label>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)}
                    placeholder="0.00" style={{ ...inputSt, padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ ...LBL, display: 'block', marginBottom: 4 }}>Paid date</label>
                  <input type="date" value={form.paid_date} onChange={e => set('paid_date', e.target.value)}
                    style={{ ...inputSt, padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
                </div>
              </div>
              <div>
                <label style={{ ...LBL, display: 'block', marginBottom: 4 }}>Description</label>
                <input value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="e.g. Deposit for June 14 wedding flowers"
                  style={{ ...inputSt, padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ ...LBL, display: 'block', marginBottom: 4 }}>Payment method</label>
                  <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)}
                    style={{ ...inputSt, padding: '8px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...LBL, display: 'block', marginBottom: 4 }}>Linked event (optional)</label>
                  <select value={form.event_id} onChange={e => set('event_id', e.target.value)}
                    style={{ ...inputSt, padding: '8px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                    <option value="">None</option>
                    {(events || []).map(ev => <option key={ev.id} value={ev.id}>{ev.type === 'wedding' ? 'Wedding' : 'Quinceañera'} · {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ ...LBL, display: 'block', marginBottom: 4 }}>Receipt URL (optional)</label>
                <input value={form.receipt_url} onChange={e => set('receipt_url', e.target.value)}
                  placeholder="https://…"
                  style={{ ...inputSt, padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setShowForm(false)}
                  style={{ padding: '7px 14px', borderRadius: 8, background: 'none', border: `1px solid ${C.border}`, color: C.gray, fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: '7px 16px', borderRadius: 8, background: saving ? C.gray : C.rosa, color: C.white, border: 'none', fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Save payment'}
                </button>
              </div>
            </div>
          )}

          {/* Payment history */}
          {vendorPayments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: C.gray, fontSize: 13 }}>No payments logged yet.</div>
          ) : (
            vendorPayments.map(p => (
              <div key={p.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-success)' }}>{fmt(Number(p.amount))}</span>
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, background: C.grayBg, color: C.gray, fontWeight: 500 }}>
                      {PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}
                    </span>
                  </div>
                  {p.description && <div style={{ fontSize: 12, color: C.ink, marginBottom: 2 }}>{p.description}</div>}
                  <div style={{ fontSize: 11, color: C.gray }}>{new Date(p.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.rosaText, textDecoration: 'none', fontWeight: 500 }}>View receipt →</a>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', background: C.ivory, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, background: 'none', border: `1px solid ${C.border}`, color: C.gray, fontSize: 13, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── VENDOR CARD ─────────────────────────────────────────────────────────────
function VendorCard({ vendor, onEdit, onDelete, onViewPayments, onViewPOs, paymentCount }) {
  const cs = catStyle(vendor.category)
  const digits = (vendor.phone || '').replace(/\D/g, '')
  const websiteHref = vendor.website
    ? (vendor.website.startsWith('http') ? vendor.website : 'https://' + vendor.website)
    : null

  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Card header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 8,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vendor.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: cs.bg, color: cs.color,
            }}>
              {CAT_LABELS[vendor.category] || vendor.category}
            </span>
            {Number(vendor.total_paid) > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-success)', fontWeight: 500 }}>
                {fmt(Number(vendor.total_paid))} paid
              </span>
            )}
            {paymentCount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: '#DCFCE7', color: '#15803D' }}>
                {paymentCount} payment{paymentCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => onViewPayments(vendor)}
            title="View payments"
            style={{
              width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`,
              background: C.white, cursor: 'pointer', fontSize: 13, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#15803D',
            }}
          >💳</button>
          {onViewPOs && (
            <button
              onClick={() => onViewPOs(vendor)}
              title="View purchase orders"
              style={{
                width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`,
                background: C.white, cursor: 'pointer', fontSize: 13, display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: C.blue,
              }}
            >📦</button>
          )}
          <button
            onClick={() => onEdit(vendor)}
            title="Edit vendor"
            style={{
              width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`,
              background: C.white, cursor: 'pointer', fontSize: 13, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: C.gray,
            }}
          >✏</button>
          <button
            onClick={() => onDelete(vendor)}
            title="Delete vendor"
            style={{
              width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`,
              background: C.white, cursor: 'pointer', fontSize: 13, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: C.red,
            }}
          >🗑</button>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {vendor.contact_name && (
          <div style={{ fontSize: 12, color: C.inkLight, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11 }}>👤</span>
            <span>{vendor.contact_name}</span>
          </div>
        )}

        {vendor.phone && (
          <div style={{ fontSize: 12, color: C.inkLight, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11 }}>📞</span>
            <a href={`tel:${vendor.phone}`} style={{ color: C.rosaText, textDecoration: 'none', fontWeight: 500 }}>
              {vendor.phone}
            </a>
            {digits.length >= 10 && (
              <>
                <span style={{ color: C.border }}>·</span>
                <a
                  href={`https://wa.me/${digits}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: '#25D366', fontWeight: 600, textDecoration: 'none' }}
                >WhatsApp</a>
              </>
            )}
          </div>
        )}

        {vendor.email && (
          <div style={{ fontSize: 12, color: C.inkLight, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <span style={{ fontSize: 11 }}>✉️</span>
            <a href={`mailto:${vendor.email}`} style={{ color: C.blue, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {vendor.email}
            </a>
          </div>
        )}

        {websiteHref && (
          <div style={{ fontSize: 12, color: C.inkLight, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11 }}>🌐</span>
            <a href={websiteHref} target="_blank" rel="noreferrer" style={{ color: C.rosaText, textDecoration: 'none', fontWeight: 500 }}>
              Visit website
            </a>
          </div>
        )}

        {vendor.rating > 0 && (
          <div style={{ marginTop: 2 }}>
            <StarDisplay rating={vendor.rating} />
          </div>
        )}

        {vendor.notes && (
          <div style={{
            fontSize: 12, color: C.gray, fontStyle: 'italic', marginTop: 2,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {vendor.notes}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DELETE CONFIRM DIALOG ───────────────────────────────────────────────────
function DeleteConfirm({ vendor, onConfirm, onCancel, deleting }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 14, padding: 28, maxWidth: 360,
          width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗑</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Remove vendor?</div>
        <div style={{ fontSize: 13, color: C.gray, marginBottom: 24 }}>
          "<strong>{vendor.name}</strong>" will be permanently removed from your contact book.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px', borderRadius: 8, background: 'none',
              border: `1px solid ${C.border}`, color: C.gray,
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              padding: '8px 20px', borderRadius: 8,
              background: deleting ? C.gray : C.red, color: C.white,
              border: 'none', fontSize: 13, fontWeight: 500,
              cursor: deleting ? 'default' : 'pointer',
            }}
          >{deleting ? 'Removing…' : 'Remove'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Vendors({ goScreen }) {
  const { vendors, loading, createVendor, updateVendor, deleteVendor, vendorPayments, logVendorPayment } = useVendors()
  const { boutique } = useAuth()
  const [catFilter, setCatFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('default') // 'default' | 'total_paid'
  const [modal, setModal] = useState(null)   // null | { mode: 'add' | 'edit', vendor?: obj }
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [paymentsVendor, setPaymentsVendor] = useState(null) // vendor to show payments for
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [events, setEvents] = useState([])

  // Fetch events for payment linking
  React.useEffect(() => {
    if (!boutique?.id) return
    supabase.from('events').select('id, type, event_date').eq('boutique_id', boutique.id).order('event_date', { ascending: false })
      .then(({ data }) => { if (data) setEvents(data) })
  }, [boutique?.id])

  // Payment count per vendor
  const paymentCountByVendor = useMemo(() => {
    const map = {}
    vendorPayments.forEach(p => { map[p.vendor_id] = (map[p.vendor_id] || 0) + 1 })
    return map
  }, [vendorPayments])

  const filtered = useMemo(() => {
    let list = vendors.filter(v => {
      if (catFilter !== 'all' && v.category !== catFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          v.name?.toLowerCase().includes(q) ||
          v.contact_name?.toLowerCase().includes(q) ||
          v.phone?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q)
        )
      }
      return true
    })
    if (sortBy === 'total_paid') {
      list = [...list].sort((a, b) => Number(b.total_paid || 0) - Number(a.total_paid || 0))
    }
    return list
  }, [vendors, catFilter, search, sortBy])

  async function handleSave(form) {
    setSaving(true)
    if (modal?.mode === 'edit' && modal.vendor) {
      await updateVendor(modal.vendor.id, form)
    } else {
      await createVendor(form)
    }
    setSaving(false)
    setModal(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await deleteVendor(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.grayBg, overflow: 'hidden' }}>
      {/* Topbar */}
      <Topbar
        title="Vendors"
        subtitle={`${vendors.length} contact${vendors.length !== 1 ? 's' : ''} in your book`}
        actions={
          <button
            onClick={() => setModal({ mode: 'add' })}
            style={{
              padding: '8px 16px', borderRadius: 8, background: C.rosa,
              color: C.white, border: 'none', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >+ Add vendor</button>
        }
      />

      {/* Filter bar */}
      <div style={{
        background: C.white, borderBottom: `1px solid ${C.border}`,
        padding: '12px 24px', display: 'flex', gap: 12, alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, contact, phone, email…"
          style={{
            padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
            fontSize: 13, outline: 'none', width: 260, color: C.ink, background: C.white,
          }}
        />

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCatFilter(c.value)}
              style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                border: `1px solid ${catFilter === c.value ? C.rosa : C.border}`,
                background: catFilter === c.value ? C.rosaPale : C.white,
                color: catFilter === c.value ? C.rosaText : C.gray,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{c.label}</button>
          ))}
        </div>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.gray, background: C.white, cursor: 'pointer', outline: 'none' }}>
          <option value="default">Sort: Default</option>
          <option value="total_paid">Sort: By total paid</option>
        </select>

        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.gray, flexShrink: 0 }}>
          {filtered.length} vendor{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.gray, fontSize: 13 }}>
            Loading vendors…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🏪"
            title={search || catFilter !== 'all' ? 'No vendors match your filters' : 'No vendors yet'}
            subtitle={search || catFilter !== 'all'
              ? 'Try adjusting your search or category filter.'
              : 'Add your florists, photographers, DJs, and other go-to contacts.'}
            action={!search && catFilter === 'all' ? () => setModal({ mode: 'add' }) : undefined}
            actionLabel={!search && catFilter === 'all' ? '+ Add your first vendor' : undefined}
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {filtered.map(v => (
              <VendorCard
                key={v.id}
                vendor={v}
                onEdit={v => setModal({ mode: 'edit', vendor: v })}
                onDelete={v => setDeleteTarget(v)}
                onViewPayments={v => setPaymentsVendor(v)}
                onViewPOs={goScreen ? () => goScreen('purchase_orders') : null}
                paymentCount={paymentCountByVendor[v.id] || 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <VendorModal
          vendor={modal.vendor}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirm
          vendor={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* Vendor payments modal */}
      {paymentsVendor && (
        <VendorPaymentsModal
          vendor={paymentsVendor}
          payments={vendorPayments}
          events={events}
          logVendorPayment={async (payload) => {
            const result = await logVendorPayment(payload)
            // Also insert to expenses table so it appears in Expenses page
            if (!result.error) {
              await supabase.from('expenses').insert({
                boutique_id: boutique.id,
                amount: Number(payload.amount),
                description: `${paymentsVendor.name}: ${payload.description || ''}`.trim(),
                category: 'vendor',
                date: payload.paid_date,
                vendor: paymentsVendor.name,
                event_id: payload.event_id || null,
              })
            }
            return result
          }}
          onClose={() => setPaymentsVendor(null)}
        />
      )}
    </div>
  )
}
