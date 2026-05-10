import React, { useState, useMemo, useRef } from 'react'
import { C, fmt } from '../lib/colors'
import { Topbar, PrimaryBtn, GhostBtn, useToast, inputSt, LBL } from '../lib/ui.jsx'
import { usePromoCodes } from '../hooks/usePromoCodes'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function isExpired(code) {
  if (!code.expires_at) return false
  return new Date(code.expires_at) < new Date(new Date().toDateString())
}

function discountLabel(code) {
  if (code.discount_type === 'percent') return `${Number(code.discount_value)}% OFF`
  return `${fmt(code.discount_value)} OFF`
}

function usageLabel(code) {
  const used = code.uses_count || 0
  if (code.max_uses == null) return `${used} / \u221e uses`
  return `${used} / ${code.max_uses} uses`
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '18px 22px', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 12, color: C.gray, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent || C.ink, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

// ─── TOGGLE SWITCH ───────────────────────────────────────────────────────────

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      aria-label={on ? 'Active' : 'Inactive'}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: on ? C.green : C.border,
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: C.white, transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

// ─── CREATE / EDIT MODAL ─────────────────────────────────────────────────────

function CodeModal({ existing, onSave, onClose }) {
  const [form, setForm] = useState({
    code: existing?.code || '',
    description: existing?.description || '',
    discount_type: existing?.discount_type || 'percent',
    discount_value: existing?.discount_value != null ? String(existing.discount_value) : '',
    max_uses: existing?.max_uses != null ? String(existing.max_uses) : '',
    expires_at: existing?.expires_at || '',
    active: existing?.active !== false,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const codeGenerated = useRef(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleCodeFocus() {
    if (!form.code && !codeGenerated.current) {
      codeGenerated.current = true
      set('code', randomCode())
    }
  }

  async function handleSave() {
    if (!form.code.trim()) { setErr('Code is required'); return }
    if (!form.discount_value || isNaN(Number(form.discount_value))) { setErr('Discount value is required'); return }
    if (Number(form.discount_value) <= 0) { setErr('Discount value must be greater than 0'); return }
    if (form.discount_type === 'percent' && Number(form.discount_value) > 100) {
      setErr('Percent discount cannot exceed 100%'); return
    }
    setSaving(true)
    setErr(null)
    const { error } = await onSave(form)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>{existing ? 'Edit Promo Code' : 'Create Promo Code'}</span>
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {err && (
            <div style={{ background: C.redBg, color: C.red, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{err}</div>
          )}

          {/* Code */}
          <div>
            <LBL>Code</LBL>
            <input
              style={{ ...inputSt, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}
              value={form.code}
              onChange={e => set('code', e.target.value.toUpperCase())}
              onFocus={handleCodeFocus}
              placeholder="E.g. SAVE15 — tap to auto-generate"
              maxLength={20}
            />
          </div>

          {/* Description */}
          <div>
            <LBL>Description (optional)</LBL>
            <input
              style={inputSt}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="E.g. Spring 2026 promotion"
            />
          </div>

          {/* Discount type + value */}
          <div>
            <LBL>Discount</LBL>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                {[['percent', '% Percent'], ['fixed', '$ Fixed']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => set('discount_type', val)}
                    style={{
                      padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      background: form.discount_type === val ? C.rosa : C.white,
                      color: form.discount_type === val ? C.white : C.ink,
                      transition: 'background 0.15s',
                    }}
                  >{label}</button>
                ))}
              </div>
              <input
                style={{ ...inputSt, flex: 1 }}
                type="number"
                min="0"
                step="0.01"
                value={form.discount_value}
                onChange={e => set('discount_value', e.target.value)}
                placeholder={form.discount_type === 'percent' ? '15' : '50.00'}
              />
            </div>
          </div>

          {/* Max uses + Expiry */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <LBL>Max uses (blank = unlimited)</LBL>
              <input
                style={inputSt}
                type="number"
                min="1"
                value={form.max_uses}
                onChange={e => set('max_uses', e.target.value)}
                placeholder="\u221e"
              />
            </div>
            <div style={{ flex: 1 }}>
              <LBL>Expiry date (optional)</LBL>
              <input
                style={inputSt}
                type="date"
                value={form.expires_at}
                onChange={e => set('expires_at', e.target.value)}
              />
            </div>
          </div>

          {/* Active toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle on={form.active} onChange={v => set('active', v)} />
            <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{form.active ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave} disabled={saving}>{saving ? 'Saving\u2026' : 'Save Code'}</PrimaryBtn>
        </div>
      </div>
    </div>
  )
}

// ─── APPLY CODE MODAL ────────────────────────────────────────────────────────

function ApplyModal({ code, onApply, onClose }) {
  const { boutique } = useAuth()
  const toast = useToast()
  const [events, setEvents] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState('')
  const [clientName, setClientName] = useState('')
  const [applying, setApplying] = useState(false)

  const selectedEvent = events.find(e => e.id === selectedEventId)

  const discountApplied = useMemo(() => {
    if (!selectedEvent) return null
    if (code.discount_type === 'percent') {
      return (Number(selectedEvent.total || 0) * Number(code.discount_value)) / 100
    }
    return Number(code.discount_value)
  }, [selectedEvent, code])

  React.useEffect(() => {
    async function loadEvents() {
      const { data } = await supabase
        .from('events')
        .select('id, type, event_date, total, client:clients(name)')
        .eq('boutique_id', boutique.id)
        .order('event_date', { ascending: false })
      setEvents(data || [])
      setLoadingEvents(false)
    }
    loadEvents()
  }, [boutique?.id])

  React.useEffect(() => {
    if (selectedEvent?.client?.name) setClientName(selectedEvent.client.name)
  }, [selectedEventId])

  async function handleApply() {
    if (!selectedEventId) { toast('Select an event first', 'error'); return }
    setApplying(true)
    const { error } = await onApply(code.id, selectedEventId, clientName || null, discountApplied)
    setApplying(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Code applied — ${fmt(discountApplied)} discount logged`)
    onClose()
  }

  function eventLabel(ev) {
    const clientN = ev.client?.name || 'Unknown'
    const dateStr = ev.event_date
      ? new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : ''
    const typeStr = ev.type ? ev.type.charAt(0).toUpperCase() + ev.type.slice(1) : ''
    return `${clientN} \u2014 ${typeStr} ${dateStr}`
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>Apply Code</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, background: C.grayBg, borderRadius: 6, padding: '2px 8px', color: C.rosaText }}>{code.code}</span>
          </div>
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Discount badge */}
          <div style={{ background: C.greenBg, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🏷️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.green }}>{discountLabel(code)}</div>
              <div style={{ fontSize: 12, color: C.gray }}>{code.description || 'No description'}</div>
            </div>
          </div>

          {/* Event select */}
          <div>
            <LBL>Select Event</LBL>
            {loadingEvents ? (
              <div style={{ fontSize: 13, color: C.gray, padding: '8px 0' }}>Loading events\u2026</div>
            ) : (
              <select style={inputSt} value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
                <option value="">\u2014 Choose an event \u2014</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{eventLabel(ev)}</option>
                ))}
              </select>
            )}
          </div>

          {/* Client name */}
          <div>
            <LBL>Client name (auto-filled from event)</LBL>
            <input
              style={inputSt}
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Client name"
            />
          </div>

          {/* Calculated discount */}
          {selectedEvent && discountApplied != null ? (
            <div style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: C.gray }}>Event total</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{fmt(selectedEvent.total || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 13, color: C.green, fontWeight: 500 }}>Discount applied</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.green }}>\u2212 {fmt(discountApplied)}</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.gray, textAlign: 'center' }}>
              Select an event to see the calculated discount
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleApply} disabled={applying || !selectedEventId}>
            {applying ? 'Applying\u2026' : 'Confirm & Log'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  )
}

// ─── CODE CARD ───────────────────────────────────────────────────────────────

function CodeCard({ code, uses, onToggleActive, onEdit, onDelete, onApply }) {
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const expired = isExpired(code)
  const exhausted = code.max_uses != null && code.uses_count >= code.max_uses
  const isEffectivelyActive = code.active && !expired && !exhausted
  const codeUses = uses.filter(u => u.promo_code_id === code.id)

  const statusLabel = expired ? 'Expired' : exhausted ? 'Exhausted' : code.active ? 'Active' : 'Inactive'

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code.code)
      toast('Code copied!')
    } catch {
      toast('Copy failed', 'error')
    }
  }

  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${isEffectivelyActive ? C.rosa : C.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      opacity: isEffectivelyActive ? 1 : 0.72,
    }}>
      {/* Main row */}
      <div
        style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Left: code info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 20, color: C.ink, letterSpacing: '0.08em' }}>
              {code.code}
            </span>
            <button
              onClick={e => { e.stopPropagation(); copyCode() }}
              title="Copy code"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '0 2px', color: C.gray, lineHeight: 1 }}
            >📋</button>
            <span style={{ background: C.greenBg, color: C.green, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
              {discountLabel(code)}
            </span>
            <span style={{
              background: isEffectivelyActive ? C.greenBg : C.grayBg,
              color: isEffectivelyActive ? C.green : C.gray,
              borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 600,
            }}>{statusLabel}</span>
          </div>
          {code.description && (
            <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>{code.description}</div>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: C.gray }}>{usageLabel(code)}</span>
            <span style={{ fontSize: 12, color: C.gray }}>
              {code.expires_at
                ? `Expires ${new Date(code.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'No expiry'}
            </span>
          </div>
        </div>

        {/* Right: controls */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, color: C.gray }}>{code.active ? 'On' : 'Off'}</span>
            <Toggle on={code.active} onChange={() => onToggleActive(code)} disabled={expired || exhausted} />
          </div>

          <button
            onClick={() => onApply(code)}
            style={{
              background: C.rosaPale, color: C.rosaText, border: 'none', borderRadius: 8,
              padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >+ Apply</button>

          <button
            onClick={() => onEdit(code)}
            title="Edit"
            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer', color: C.gray, lineHeight: 1 }}
          >✏️</button>

          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => onDelete(code.id)}
                style={{ background: C.red, color: C.white, border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >Delete</button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ background: C.grayBg, border: 'none', borderRadius: 7, padding: '5px 8px', fontSize: 12, cursor: 'pointer', color: C.gray }}
              >✕</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete"
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer', color: C.gray, lineHeight: 1 }}
            >🗑️</button>
          )}

          <span style={{
            color: C.gray, fontSize: 12, userSelect: 'none',
            display: 'inline-block', transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>▾</span>
        </div>
      </div>

      {/* Expanded: usage history */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, background: C.grayBg, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Usage history ({codeUses.length})
          </div>
          {codeUses.length === 0 ? (
            <div style={{ fontSize: 13, color: C.gray, fontStyle: 'italic' }}>No uses yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {codeUses.map(u => {
                const eventDate = u.event?.event_date
                  ? new Date(u.event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : null
                const usedDate = new Date(u.used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                return (
                  <div key={u.id} style={{
                    background: C.white, borderRadius: 8, border: `1px solid ${C.border}`,
                    padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{u.client_name || 'Unknown client'}</div>
                      {eventDate && (
                        <div style={{ fontSize: 12, color: C.gray }}>
                          {u.event?.type ? u.event.type.charAt(0).toUpperCase() + u.event.type.slice(1) : 'Event'} — {eventDate}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>Applied {usedDate}</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.green }}>\u2212 {fmt(u.discount_applied)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── FILTER TABS ─────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'expired', label: 'Expired' },
]

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function PromoCodesPage() {
  const toast = useToast()
  const { codes, uses, loading, stats, createCode, updateCode, deleteCode, applyCode } = usePromoCodes()

  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editingCode, setEditingCode] = useState(null)
  const [applyingCode, setApplyingCode] = useState(null)

  const filtered = useMemo(() => {
    return codes.filter(c => {
      const expired = isExpired(c)
      if (filter === 'active') return c.active && !expired
      if (filter === 'inactive') return !c.active
      if (filter === 'expired') return expired
      return true
    })
  }, [codes, filter])

  async function handleToggleActive(code) {
    const { error } = await updateCode(code.id, { active: !code.active })
    if (error) toast(error.message, 'error')
    else toast(code.active ? 'Code deactivated' : 'Code activated')
  }

  async function handleDelete(id) {
    const { error } = await deleteCode(id)
    if (error) toast(error.message, 'error')
    else toast('Code deleted')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.grayBg, minHeight: 0 }}>
      <Topbar title="Promo Codes">
        <PrimaryBtn onClick={() => setShowCreate(true)}>+ Create Code</PrimaryBtn>
      </Topbar>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 48px' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard label="Active codes" value={stats.activeCodes} accent={C.rosa} />
          <StatCard label="Total uses" value={stats.totalUses} />
          <StatCard label="Total savings given" value={fmt(stats.totalSavings)} accent={C.green} />
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '7px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                background: filter === f.key ? C.rosa : C.white,
                color: filter === f.key ? C.white : C.gray,
                boxShadow: filter === f.key ? 'none' : `0 0 0 1px ${C.border}`,
                transition: 'background 0.15s',
              }}
            >{f.label}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 13, color: C.gray }}>
            {filtered.length} code{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Code list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 88, background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, opacity: 0.4 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '48px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🏷️</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.ink, marginBottom: 6 }}>
              {filter === 'all' ? 'No promo codes yet' : `No ${filter} codes`}
            </div>
            <div style={{ fontSize: 14, color: C.gray, marginBottom: 20 }}>
              {filter === 'all'
                ? 'Create your first discount code to start offering promotions to clients.'
                : 'Try a different filter.'}
            </div>
            {filter === 'all' && (
              <PrimaryBtn onClick={() => setShowCreate(true)}>+ Create First Code</PrimaryBtn>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(code => (
              <CodeCard
                key={code.id}
                code={code}
                uses={uses}
                onToggleActive={handleToggleActive}
                onEdit={c => setEditingCode(c)}
                onDelete={handleDelete}
                onApply={c => setApplyingCode(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CodeModal
          onSave={form => createCode(form)}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editingCode && (
        <CodeModal
          existing={editingCode}
          onSave={form => updateCode(editingCode.id, form)}
          onClose={() => setEditingCode(null)}
        />
      )}
      {applyingCode && (
        <ApplyModal
          code={applyingCode}
          onApply={applyCode}
          onClose={() => setApplyingCode(null)}
        />
      )}
    </div>
  )
}
