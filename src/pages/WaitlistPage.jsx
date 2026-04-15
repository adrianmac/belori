import React, { useState, useMemo } from 'react'
import { C } from '../lib/colors'
import {
  Topbar, PrimaryBtn, GhostBtn, Badge, Card, inputSt, LBL, useToast,
} from '../lib/ui'
import { useWaitlist } from '../hooks/useWaitlist'

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  waiting:   { label: 'Waiting',   bg: '#FEF3C7', color: '#92400E' },
  contacted: { label: 'Contacted', bg: '#DBEAFE', color: '#1E40AF' },
  booked:    { label: 'Booked',    bg: '#D1FAE5', color: '#065F46' },
  removed:   { label: 'Removed',   bg: '#F3F4F6', color: '#6B7280' },
}

const EVENT_TYPES = [
  { value: 'quince',        label: 'Quinceañera' },
  { value: 'wedding',       label: 'Wedding' },
  { value: 'bridal_shower', label: 'Bridal Shower' },
  { value: 'other',         label: 'Other' },
]

const SOURCES = [
  { value: 'manual',       label: 'Manual entry' },
  { value: 'phone',        label: 'Phone call' },
  { value: 'booking_form', label: 'Booking form' },
]

const FILTER_TABS = ['All', 'Waiting', 'Contacted', 'Booked']

// ─── HELPERS ──────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  if (mins < 1)    return 'Just now'
  if (mins < 60)   return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days === 1)  return '1 day ago'
  if (days < 7)    return `${days} days ago`
  if (weeks === 1) return '1 week ago'
  if (weeks < 5)   return `${weeks} weeks ago`
  if (months === 1) return '1 month ago'
  return `${months} months ago`
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function eventTypeLabel(val) {
  return EVENT_TYPES.find(e => e.value === val)?.label || val || '—'
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────

function EmptyState({ filter, onAdd }) {
  const msgs = {
    All:       { title: 'No one on the waitlist yet', sub: 'Add your first waitlist entry to get started.' },
    Waiting:   { title: 'No one waiting right now',   sub: 'Everyone has been contacted or booked.' },
    Contacted: { title: 'No contacted entries',       sub: 'Mark entries as "Contacted" once you reach out.' },
    Booked:    { title: 'No bookings from waitlist',  sub: 'Booked entries will appear here.' },
  }
  const { title, sub } = msgs[filter] || msgs.All
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px', color: C.gray }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
      <div style={{ fontWeight: 600, fontSize: 15, color: C.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, marginBottom: 20 }}>{sub}</div>
      {filter === 'All' && (
        <PrimaryBtn label="+ Add to waitlist" onClick={onAdd} />
      )}
    </div>
  )
}

// ─── STAT CARD ────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '16px 20px',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || C.ink }}>{value}</div>
      <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── ENTRY CARD ───────────────────────────────────────────────────────────

function EntryCard({ entry, onMarkContacted, onMarkBooked, onRemove, onEdit }) {
  const sc = STATUS_CONFIG[entry.status] || STATUS_CONFIG.waiting
  const [confirmRemove, setConfirmRemove] = useState(false)

  function handleRemove() {
    if (confirmRemove) {
      onRemove(entry.id)
    } else {
      setConfirmRemove(true)
      setTimeout(() => setConfirmRemove(false), 3000)
    }
  }

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ padding: '14px 16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          {/* Left: name + contact */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{ fontWeight: 600, fontSize: 15, color: C.ink, cursor: 'pointer' }}
                onClick={() => onEdit(entry)}
              >
                {entry.name}
              </span>
              <Badge
                text={sc.label}
                bg={sc.bg}
                color={sc.color}
              />
              {entry.flexible_dates && (
                <Badge text="Flexible dates" bg={C.rosaPale} color={C.rosaText} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
              {entry.phone && (
                <a
                  href={`tel:${entry.phone}`}
                  style={{ fontSize: 12, color: C.rosaText, textDecoration: 'none' }}
                >
                  {entry.phone}
                </a>
              )}
              {entry.email && (
                <a
                  href={`mailto:${entry.email}`}
                  style={{ fontSize: 12, color: C.gray, textDecoration: 'none' }}
                >
                  {entry.email}
                </a>
              )}
            </div>
          </div>

          {/* Right: time ago */}
          <div style={{ fontSize: 11, color: C.gray, flexShrink: 0, paddingTop: 2 }}>
            {timeAgo(entry.created_at)}
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {entry.event_type && (
            <div style={{ fontSize: 12, color: C.gray }}>
              <span style={{ color: C.inkLight }}>Event: </span>
              <span style={{ color: C.ink, fontWeight: 500 }}>{eventTypeLabel(entry.event_type)}</span>
            </div>
          )}
          {entry.preferred_date && !entry.flexible_dates && (
            <div style={{ fontSize: 12, color: C.gray }}>
              <span style={{ color: C.inkLight }}>Preferred: </span>
              <span style={{ color: C.ink, fontWeight: 500 }}>{fmtDate(entry.preferred_date)}</span>
            </div>
          )}
          {entry.contacted_at && (
            <div style={{ fontSize: 12, color: C.gray }}>
              <span style={{ color: C.inkLight }}>Contacted: </span>
              <span style={{ color: C.ink }}>{timeAgo(entry.contacted_at)}</span>
            </div>
          )}
          {entry.source && entry.source !== 'manual' && (
            <div style={{ fontSize: 12, color: C.gray }}>
              <span style={{ color: C.inkLight }}>Via: </span>
              <span style={{ color: C.ink }}>{SOURCES.find(s => s.value === entry.source)?.label || entry.source}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {entry.notes && (
          <div style={{
            marginTop: 8,
            fontSize: 12,
            color: C.gray,
            background: C.ivory,
            borderRadius: 6,
            padding: '6px 10px',
            fontStyle: 'italic',
          }}>
            {entry.notes}
          </div>
        )}

        {/* Actions */}
        {entry.status !== 'removed' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {entry.status === 'waiting' && (
              <GhostBtn
                label="Mark Contacted"
                onClick={() => onMarkContacted(entry.id)}
                style={{ fontSize: 12, padding: '5px 12px' }}
              />
            )}
            {entry.status === 'contacted' && (
              <GhostBtn
                label="Mark Booked"
                onClick={() => onMarkBooked(entry.id)}
                style={{ fontSize: 12, padding: '5px 12px', color: '#065F46', borderColor: '#065F46' }}
              />
            )}
            <GhostBtn
              label="Edit"
              onClick={() => onEdit(entry)}
              style={{ fontSize: 12, padding: '5px 12px' }}
            />
            <button
              onClick={handleRemove}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: confirmRemove ? '#B91C1C' : C.gray,
                padding: '5px 8px',
                borderRadius: 6,
                fontWeight: confirmRemove ? 600 : 400,
                transition: 'color 0.15s',
              }}
            >
              {confirmRemove ? 'Confirm remove?' : '✕ Remove'}
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── ADD / EDIT MODAL ─────────────────────────────────────────────────────

const BLANK_FORM = {
  name: '',
  phone: '',
  email: '',
  event_type: 'quince',
  preferred_date: '',
  flexible_dates: false,
  notes: '',
  source: 'manual',
}

function WaitlistModal({ entry, onClose, onSave }) {
  const isEdit = Boolean(entry?.id)
  const [form, setForm] = useState(
    isEdit
      ? {
          name:           entry.name || '',
          phone:          entry.phone || '',
          email:          entry.email || '',
          event_type:     entry.event_type || 'quince',
          preferred_date: entry.preferred_date || '',
          flexible_dates: entry.flexible_dates || false,
          notes:          entry.notes || '',
          source:         entry.source || 'manual',
        }
      : { ...BLANK_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await onSave(form)
    setSaving(false)
    if (err) {
      setError(err.message || 'Something went wrong.')
    } else {
      onClose()
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(28,16,18,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: C.white,
        borderRadius: 14,
        width: '100%',
        maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: C.ink }}>
            {isEdit ? 'Edit waitlist entry' : 'Add to waitlist'}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: C.gray, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Name */}
          <div>
            <label htmlFor="wait-name" style={LBL}>Name <span style={{ color: C.rosaText }}>*</span></label>
            <input
              id="wait-name"
              style={inputSt}
              placeholder="Client name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {/* Phone + Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label htmlFor="wait-phone" style={LBL}>Phone</label>
              <input
                id="wait-phone"
                style={inputSt}
                placeholder="(555) 000-0000"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="wait-email" style={LBL}>Email</label>
              <input
                id="wait-email"
                style={inputSt}
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>
          </div>

          {/* Event type */}
          <div>
            <label htmlFor="wait-event-type" style={LBL}>Event type</label>
            <select
              id="wait-event-type"
              style={{ ...inputSt }}
              value={form.event_type}
              onChange={e => set('event_type', e.target.value)}
            >
              {EVENT_TYPES.map(et => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
          </div>

          {/* Preferred date + flexible */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label htmlFor="wait-preferred-date" style={LBL}>Preferred date</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.gray }}>
                <input
                  type="checkbox"
                  checked={form.flexible_dates}
                  onChange={e => set('flexible_dates', e.target.checked)}
                  style={{ accentColor: C.rosa, cursor: 'pointer' }}
                />
                Flexible dates
              </label>
            </div>
            <input
              id="wait-preferred-date"
              style={{ ...inputSt, opacity: form.flexible_dates ? 0.45 : 1 }}
              type="date"
              value={form.preferred_date}
              onChange={e => set('preferred_date', e.target.value)}
              disabled={form.flexible_dates}
            />
          </div>

          {/* Source */}
          <div>
            <label htmlFor="wait-source" style={LBL}>Source</label>
            <select
              id="wait-source"
              style={{ ...inputSt }}
              value={form.source}
              onChange={e => set('source', e.target.value)}
            >
              {SOURCES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="wait-notes" style={LBL}>Notes</label>
            <textarea
              id="wait-notes"
              style={{ ...inputSt, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
              placeholder="Any special requests or details…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#B91C1C', background: '#FEE2E2', borderRadius: 7, padding: '8px 12px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
        }}>
          <GhostBtn label="Cancel" onClick={onClose} />
          <PrimaryBtn
            label={saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add to waitlist'}
            onClick={handleSave}
            disabled={saving}
          />
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────

export default function WaitlistPage() {
  const { waitlist, loading, addToWaitlist, updateWaitlistEntry, markContacted, markBooked, removeFromWaitlist } = useWaitlist()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch]       = useState('')
  const [modal, setModal]         = useState(null) // null | 'add' | entry-object

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const waiting   = waitlist.filter(e => e.status === 'waiting').length
    const contacted = waitlist.filter(e => e.status === 'contacted').length
    const booked    = waitlist.filter(
      e => e.status === 'booked' && e.contacted_at && new Date(e.contacted_at) >= startOfMonth
    ).length
    return { waiting, contacted, booked }
  }, [waitlist])

  // ── Filtering ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...waitlist]
    if (activeTab !== 'All') {
      list = list.filter(e => e.status === activeTab.toLowerCase())
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.phone?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q)
      )
    }
    return list
  }, [waitlist, activeTab, search])

  // ── Handlers ───────────────────────────────────────────────────────────
  async function handleMarkContacted(id) {
    const { error } = await markContacted(id)
    if (error) toast('Failed to update status', 'error')
    else toast('Marked as contacted')
  }

  async function handleMarkBooked(id) {
    const { error } = await markBooked(id, null)
    if (error) toast('Failed to update status', 'error')
    else toast('Marked as booked')
  }

  async function handleRemove(id) {
    const { error } = await removeFromWaitlist(id)
    if (error) toast('Failed to remove entry', 'error')
    else toast('Entry removed')
  }

  async function handleSave(form) {
    if (modal && modal.id) {
      // Edit
      const { error } = await updateWaitlistEntry(modal.id, form)
      if (!error) toast('Entry updated')
      return { error }
    } else {
      // Add
      const { error } = await addToWaitlist(form)
      if (!error) toast('Added to waitlist')
      return { error }
    }
  }

  // ── Tab counts ─────────────────────────────────────────────────────────
  function tabCount(tab) {
    if (tab === 'All') return waitlist.length
    return waitlist.filter(e => e.status === tab.toLowerCase()).length
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.ivory, minHeight: 0 }}>
      <Topbar
        title="Waitlist"
        action={<PrimaryBtn label="+ Add to waitlist" onClick={() => setModal('add')} />}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px' }}>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard label="Waiting" value={stats.waiting} accent="#92400E" />
          <StatCard label="Contacted" value={stats.contacted} accent="#1E40AF" />
          <StatCard label="Booked this month" value={stats.booked} accent={C.green} />
        </div>

        {/* Controls: tabs + search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          {/* Filter tabs */}
          <div style={{
            display: 'flex',
            gap: 4,
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 3,
          }}>
            {FILTER_TABS.map(tab => {
              const isActive = activeTab === tab
              const count = tabCount(tab)
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: isActive ? C.rosa : 'none',
                    color: isActive ? C.white : C.gray,
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.15s',
                  }}
                >
                  {tab}
                  {count > 0 && (
                    <span style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : C.border,
                      color: isActive ? C.white : C.gray,
                      borderRadius: 999,
                      fontSize: 10,
                      padding: '1px 6px',
                      fontWeight: 600,
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search */}
          <input
            style={{
              ...inputSt,
              width: 220,
              flexShrink: 0,
              paddingLeft: 30,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: '9px center',
            }}
            placeholder="Search name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>
            Loading waitlist…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={activeTab} onAdd={() => setModal('add')} />
        ) : (
          <div>
            {filtered.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onMarkContacted={handleMarkContacted}
                onMarkBooked={handleMarkBooked}
                onRemove={handleRemove}
                onEdit={e => setModal(e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <WaitlistModal
          entry={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
