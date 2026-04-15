import React, { useState, useMemo } from 'react'
import { C } from '../lib/colors'
import { inputSt, ConfirmModal } from '../lib/ui.jsx'
import { useGuests } from '../hooks/useGuests'

// ── Constants ──────────────────────────────────────────────────────────────
const RSVP_CYCLE = ['invited', 'confirmed', 'declined', 'maybe']
const RSVP_META = {
  invited:   { label: 'Invited',   bg: '#F3F4F6', color: '#6B7280' },
  confirmed: { label: 'Confirmed', bg: C.greenBg,  color: C.green  },
  declined:  { label: 'Declined',  bg: C.redBg,    color: C.red    },
  maybe:     { label: 'Maybe',     bg: C.amberBg,  color: C.warningText  },
}
const MEAL_OPTIONS = ['none', 'chicken', 'fish', 'vegetarian', 'vegan', 'kids']
const MEAL_LABELS  = { none: 'None', chicken: 'Chicken', fish: 'Fish', vegetarian: 'Vegetarian', vegan: 'Vegan', kids: 'Kids' }
const RSVP_FILTER_OPTIONS = ['All', 'confirmed', 'declined', 'invited', 'maybe']

// ── Add/Edit Guest Modal ───────────────────────────────────────────────────
const EMPTY_FORM = { name: '', phone: '', email: '', rsvp_status: 'invited', meal_pref: 'none', table_number: '', plus_ones: 0, notes: '', invited_by: '' }

function GuestModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{initial ? 'Edit Guest' : 'Add Guest'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: C.gray, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Name *</label>
            <input style={inputSt} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Guest name" autoFocus />
          </div>
          {/* Phone + Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Phone</label>
              <input style={inputSt} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="555-000-0000" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Email</label>
              <input style={inputSt} value={form.email} onChange={e => set('email', e.target.value)} placeholder="guest@email.com" />
            </div>
          </div>
          {/* RSVP + Meal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>RSVP Status</label>
              <select style={inputSt} value={form.rsvp_status} onChange={e => set('rsvp_status', e.target.value)}>
                {RSVP_CYCLE.map(s => <option key={s} value={s}>{RSVP_META[s].label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Meal Preference</label>
              <select style={inputSt} value={form.meal_pref || 'none'} onChange={e => set('meal_pref', e.target.value)}>
                {MEAL_OPTIONS.map(m => <option key={m} value={m}>{MEAL_LABELS[m]}</option>)}
              </select>
            </div>
          </div>
          {/* Table + Plus-ones */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Table #</label>
              <input style={inputSt} value={form.table_number} onChange={e => set('table_number', e.target.value)} placeholder="e.g. 5" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>+1s</label>
              <input style={inputSt} type="number" min={0} max={10} value={form.plus_ones} onChange={e => set('plus_ones', Math.max(0, Math.min(10, Number(e.target.value))))} />
            </div>
          </div>
          {/* Invited by */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Invited By</label>
            <input style={inputSt} value={form.invited_by} onChange={e => set('invited_by', e.target.value)} placeholder="e.g. Bride's family" />
          </div>
          {/* Notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea style={{ ...inputSt, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any special notes…" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.gray, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: form.name.trim() ? C.rosa : C.border, color: C.white, fontSize: 13, cursor: form.name.trim() ? 'pointer' : 'not-allowed', fontWeight: 600 }}
          >{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ── RsvpBadge — cycles status on click ────────────────────────────────────
function RsvpBadge({ status, onChange }) {
  const meta = RSVP_META[status] || RSVP_META.invited
  function cycle() {
    const idx = RSVP_CYCLE.indexOf(status)
    const next = RSVP_CYCLE[(idx + 1) % RSVP_CYCLE.length]
    onChange(next)
  }
  return (
    <button
      onClick={cycle}
      title="Click to change status"
      style={{ padding: '2px 9px', borderRadius: 20, border: `1px solid ${meta.color}20`, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: '18px' }}
    >{meta.label}</button>
  )
}

// ── Main GuestList component ───────────────────────────────────────────────
export default function GuestList({ eventId }) {
  const { guests, loading, createGuest, updateGuest, deleteGuest, bulkUpdateRsvp } = useGuests(eventId)

  const [search, setSearch]         = useState('')
  const [rsvpFilter, setRsvpFilter] = useState('All')
  const [showModal, setShowModal]   = useState(false)
  const [editGuest, setEditGuest]   = useState(null)   // guest object to edit
  const [selected, setSelected]     = useState(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // guest id | null

  // ── Derived stats ──
  const totalHeads = useMemo(() => guests.reduce((sum, g) => sum + 1 + (g.plus_ones || 0), 0), [guests])
  const confirmed  = useMemo(() => guests.filter(g => g.rsvp_status === 'confirmed'), [guests])
  const declined   = useMemo(() => guests.filter(g => g.rsvp_status === 'declined'), [guests])
  const pending    = useMemo(() => guests.filter(g => g.rsvp_status === 'invited' || g.rsvp_status === 'maybe'), [guests])

  const mealCounts = useMemo(() => {
    const counts = {}
    guests.forEach(g => {
      if (g.meal_pref && g.meal_pref !== 'none') counts[g.meal_pref] = (counts[g.meal_pref] || 0) + 1
    })
    return counts
  }, [guests])
  const hasMealData = Object.keys(mealCounts).length > 0

  // ── Filtered list ──
  const filtered = useMemo(() => {
    let list = guests
    if (rsvpFilter !== 'All') list = list.filter(g => g.rsvp_status === rsvpFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(g => g.name.toLowerCase().includes(q))
    }
    return list
  }, [guests, rsvpFilter, search])

  // ── Handlers ──
  async function handleCreate(form) {
    await createGuest(form)
    setShowModal(false)
  }

  async function handleEdit(form) {
    await updateGuest(editGuest.id, form)
    setEditGuest(null)
  }

  const handleDelete = (id) => setDeleteConfirm(id)
  async function confirmDeleteGuest() {
    if (!deleteConfirm) return
    await deleteGuest(deleteConfirm)
    setSelected(prev => { const s = new Set(prev); s.delete(deleteConfirm); return s })
    setDeleteConfirm(null)
  }

  async function handleBulkRsvp(status) {
    setBulkSaving(true)
    await bulkUpdateRsvp([...selected], status)
    setSelected(new Set())
    setBulkSaving(false)
  }

  function toggleSelect(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(g => g.id)))
  }

  // ── Export CSV ──
  function exportCsv() {
    const headers = ['Name', 'Phone', 'Email', 'RSVP', 'Meal Pref', 'Table', '+1s', 'Notes', 'Invited By']
    const rows = guests.map(g => [
      g.name, g.phone || '', g.email || '', g.rsvp_status,
      g.meal_pref || '', g.table_number || '', g.plus_ones || 0,
      g.notes || '', g.invited_by || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'guests.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Stat chip ──
  const Chip = ({ icon, label, count, color, bg }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, background: bg || C.grayBg, border: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color || C.ink }}>{count}</span>
      <span style={{ fontSize: 11, color: C.gray }}>{label}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>👥 Guest List</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={exportCsv}
            disabled={guests.length === 0}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.gray, fontSize: 12, cursor: guests.length ? 'pointer' : 'not-allowed', fontWeight: 500 }}
          >Export CSV</button>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: C.rosa, color: C.white, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
          >+ Add Guest</button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Chip icon="👥" label="Total" count={totalHeads} />
        <Chip icon="✅" label="Confirmed" count={confirmed.reduce((s, g) => s + 1 + (g.plus_ones || 0), 0)} color={C.green} bg={C.greenBg} />
        <Chip icon="❌" label="Declined" count={declined.reduce((s, g) => s + 1 + (g.plus_ones || 0), 0)} color={C.red} bg={C.redBg} />
        <Chip icon="⏳" label="Pending" count={pending.reduce((s, g) => s + 1 + (g.plus_ones || 0), 0)} color={C.warningText} bg={C.amberBg} />
      </div>

      {/* ── Meal breakdown ── */}
      {hasMealData && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meals:</span>
          {Object.entries(mealCounts).map(([meal, count]) => (
            <span key={meal} style={{ padding: '2px 10px', borderRadius: 20, background: C.grayBg, border: `1px solid ${C.border}`, fontSize: 11, color: C.ink, fontWeight: 500 }}>
              {MEAL_LABELS[meal] || meal} {count}
            </span>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ ...inputSt, flex: 1, minWidth: 160, maxWidth: 280 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search guests…"
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {RSVP_FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setRsvpFilter(opt)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${rsvpFilter === opt ? C.rosa : C.border}`,
                background: rsvpFilter === opt ? C.rosaPale : C.white, color: rsvpFilter === opt ? C.rosaText : C.gray,
                fontSize: 11, fontWeight: rsvpFilter === opt ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{opt === 'All' ? 'All' : (RSVP_META[opt]?.label || opt)}</button>
          ))}
        </div>
      </div>

      {/* ── Bulk actions ── */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 14px', background: C.rosaPale, borderRadius: 10, border: `1px solid ${C.petal}` }}>
          <span style={{ fontSize: 12, color: C.inkMid, fontWeight: 600 }}>{selected.size} selected</span>
          <button
            onClick={() => handleBulkRsvp('confirmed')}
            disabled={bulkSaving}
            style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: C.greenBg, color: C.green, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >Mark Confirmed</button>
          <button
            onClick={() => handleBulkRsvp('declined')}
            disabled={bulkSaving}
            style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: C.redBg, color: C.red, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >Mark Declined</button>
          <button
            onClick={() => setSelected(new Set())}
            style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, color: C.gray, fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}
          >Clear</button>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: C.gray, fontSize: 13 }}>Loading guests…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: C.gray, fontSize: 13 }}>
          {guests.length === 0
            ? <><div style={{ fontSize: 32, marginBottom: 10 }}>👥</div><div style={{ fontWeight: 600, color: C.ink, marginBottom: 6 }}>No guests yet</div><div>Add your first guest to get started.</div></>
            : 'No guests match your filter.'}
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: C.white }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 110px 110px 80px 60px 40px 60px 64px', alignItems: 'center', padding: '8px 14px', background: C.grayBg, borderBottom: `1px solid ${C.border}`, gap: 8 }}>
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleAll}
              style={{ cursor: 'pointer' }}
            />
            {['Name', 'Phone', 'RSVP', 'Meal', 'Table', '+1s', 'Notes', ''].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</div>
            ))}
          </div>

          {/* Table rows */}
          {filtered.map((g, i) => (
            <div
              key={g.id}
              style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 110px 110px 80px 60px 40px 60px 64px',
                alignItems: 'center', padding: '9px 14px', gap: 8,
                borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                background: selected.has(g.id) ? C.rosaPale : C.white,
                transition: 'background 0.1s',
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(g.id)}
                onChange={() => toggleSelect(g.id)}
                style={{ cursor: 'pointer' }}
              />
              {/* Name */}
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.name}>{g.name}</div>
              {/* Phone */}
              <div style={{ fontSize: 12, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.phone || '—'}</div>
              {/* RSVP inline badge */}
              <RsvpBadge status={g.rsvp_status} onChange={status => updateGuest(g.id, { rsvp_status: status })} />
              {/* Meal */}
              <div style={{ fontSize: 11, color: C.gray }}>{g.meal_pref && g.meal_pref !== 'none' ? MEAL_LABELS[g.meal_pref] : '—'}</div>
              {/* Table */}
              <div style={{ fontSize: 12, color: C.gray }}>{g.table_number || '—'}</div>
              {/* +1s */}
              <div style={{ fontSize: 12, color: C.gray, textAlign: 'center' }}>{g.plus_ones || 0}</div>
              {/* Notes (truncated) */}
              <div style={{ fontSize: 11, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.notes || ''}>{g.notes || '—'}</div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setEditGuest(g)}
                  title="Edit"
                  style={{ padding: '3px 7px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, color: C.gray, fontSize: 13, cursor: 'pointer', lineHeight: 1 }}
                >✏️</button>
                <button
                  onClick={() => handleDelete(g.id)}
                  title="Remove"
                  style={{ padding: '3px 7px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, color: C.red, fontSize: 13, cursor: 'pointer', lineHeight: 1 }}
                >🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {showModal && <GuestModal onSave={handleCreate} onClose={() => setShowModal(false)} />}
      {editGuest  && <GuestModal initial={editGuest} onSave={handleEdit} onClose={() => setEditGuest(null)} />}
      {deleteConfirm && (
        <ConfirmModal title="Remove this guest?" confirmLabel="Remove"
          onConfirm={confirmDeleteGuest} onCancel={() => setDeleteConfirm(null)} />
      )}
    </div>
  )
}
