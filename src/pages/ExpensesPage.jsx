import React, { useState, useMemo } from 'react'
import { C, fmt, EVT_TYPES } from '../lib/colors'
import { Topbar, inputSt, LBL } from '../lib/ui.jsx'
import { useExpenses } from '../hooks/useExpenses'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'supplies',    label: 'Supplies',    color: C.blue,    bg: C.blueBg   },
  { key: 'marketing',  label: 'Marketing',   color: C.purple,  bg: C.purpleBg },
  { key: 'staff',      label: 'Staff',       color: '#0891B2', bg: '#ECFEFF'  },
  { key: 'rent',       label: 'Rent',        color: C.gray,    bg: C.grayBg   },
  { key: 'utilities',  label: 'Utilities',   color: '#C2410C', bg: '#FFF7ED'  },
  { key: 'flowers',    label: 'Flowers',     color: '#9D174D', bg: '#FDF2F8'  },
  { key: 'alterations',label: 'Alterations', color: C.amber,   bg: C.amberBg  },
  { key: 'other',      label: 'Other',       color: C.gray,    bg: C.grayBg   },
]
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]))

const DATE_RANGES = [
  { key: 'this_month',    label: 'This month'    },
  { key: 'last_3_months', label: 'Last 3 months' },
  { key: 'this_year',     label: 'This year'     },
  { key: 'all_time',      label: 'All time'      },
]

const TODAY = new Date().toISOString().split('T')[0]

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtAmt(n) {
  const val = Number(n) || 0
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function filterByRange(expenses, range) {
  const now = new Date()
  if (range === 'all_time') return expenses
  return expenses.filter(e => {
    const d = new Date(e.date + 'T12:00:00')
    if (range === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }
    if (range === 'last_3_months') {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return d >= cutoff
    }
    if (range === 'this_year') return d.getFullYear() === now.getFullYear()
    return true
  })
}

function getThisMonthExpenses(expenses) {
  const now = new Date()
  return expenses.filter(e => {
    const d = new Date(e.date + 'T12:00:00')
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
}

function getThisYearExpenses(expenses) {
  const now = new Date()
  return expenses.filter(e => new Date(e.date + 'T12:00:00').getFullYear() === now.getFullYear())
}

// ─── CATEGORY BADGE ────────────────────────────────────────────────────────────
function CatBadge({ cat }) {
  const cfg = CAT_MAP[cat] || CAT_MAP.other
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

// ─── STAT CARD ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12,
      border: `1px solid ${C.border}`, padding: '18px 22px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── ADD/EDIT MODAL ────────────────────────────────────────────────────────────
const BLANK = { description: '', amount: '', date: TODAY, category: 'supplies', event_id: '', notes: '' }

function ExpenseModal({ editExpense, events, onSave, onClose, saving }) {
  const [form, setForm] = useState(editExpense ? {
    description: editExpense.description || '',
    amount: editExpense.amount != null ? String(editExpense.amount) : '',
    date: editExpense.date || TODAY,
    category: editExpense.category || 'supplies',
    event_id: editExpense.event_id || '',
    notes: editExpense.notes || '',
  } : BLANK)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const valid = form.description.trim() && form.amount && Number(form.amount) > 0 && form.date

  const handleSave = () => {
    if (!valid) return
    onSave({
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      date: form.date,
      category: form.category,
      event_id: form.event_id || null,
      notes: form.notes.trim() || null,
    })
  }

  const fld = { ...inputSt }
  const lbl = { fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, width: 520, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>
            {editExpense ? 'Edit Expense' : 'Add Expense'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Description */}
          <div>
            <label style={lbl}>Description <span style={{ color: C.rosa }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. Flower delivery for June wedding"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              style={fld}
              autoFocus
            />
          </div>

          {/* Amount + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Amount <span style={{ color: C.rosa }}>*</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                style={fld}
              />
            </div>
            <div>
              <label style={lbl}>Date <span style={{ color: C.rosa }}>*</span></label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                style={fld}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={lbl}>Category <span style={{ color: C.rosa }}>*</span></label>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={fld}>
              {CATEGORIES.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Event (optional) */}
          <div>
            <label style={lbl}>
              Event{' '}
              <span style={{ color: C.gray, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <select value={form.event_id} onChange={e => set('event_id', e.target.value)} style={fld}>
              <option value="">— No event linked —</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.client?.name || 'Client'} — {EVT_TYPES[ev.type]?.label || ev.type}
                  {ev.event_date ? ' · ' + fmtDate(ev.event_date) : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>
              Notes{' '}
              <span style={{ color: C.gray, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Any additional details…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              style={{ ...fld, resize: 'vertical', minHeight: 58 }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', color: C.gray, border: `1px solid ${C.border}`, padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !valid}
            style={{
              background: valid && !saving ? C.rosa : C.border,
              color: C.white, border: 'none',
              padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: saving || !valid ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : editExpense ? 'Save changes' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ALL TAB ───────────────────────────────────────────────────────────────────
function AllTab({ expenses, range, setRange, events, onEdit, onDelete, onAdd, setScreen, setSelectedEvent }) {
  const [catFilter, setCatFilter] = useState('all')

  const byRange = useMemo(() => filterByRange(expenses, range), [expenses, range])
  const filtered = useMemo(() => {
    if (catFilter === 'all') return byRange
    return byRange.filter(e => e.category === catFilter)
  }, [byRange, catFilter])

  const pillSt = (active) => ({
    padding: '5px 13px', borderRadius: 20, border: `1px solid ${active ? C.rosa : C.border}`,
    background: active ? C.rosaPale : C.white, color: active ? C.rosa : C.gray,
    fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
  })

  const card = { background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Category pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={pillSt(catFilter === 'all')} onClick={() => setCatFilter('all')}>All</button>
          {CATEGORIES.map(c => (
            <button key={c.key} style={pillSt(catFilter === c.key)} onClick={() => setCatFilter(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
        {/* Date range */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DATE_RANGES.map(r => (
            <button key={r.key} style={pillSt(range === r.key)} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '13px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
            {filtered.length} expense{filtered.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
            {fmtAmt(filtered.reduce((s, e) => s + Number(e.amount), 0))}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 6 }}>No expenses found</div>
            <div style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>Try adjusting your filters or add a new expense.</div>
            <button onClick={onAdd} style={{ background: 'none', border: 'none', color: C.rosa, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
              + Add Expense
            </button>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px 130px 1fr 150px 90px 60px',
              gap: 8,
              padding: '10px 20px',
              background: '#FAFAFA',
              borderBottom: `1px solid ${C.border}`,
            }}>
              {['Date', 'Category', 'Description', 'Event', 'Amount', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Amount' ? 'right' : 'left' }}>
                  {h}
                </div>
              ))}
            </div>

            {filtered.map((e, i) => {
              const linkedEvent = events.find(ev => ev.id === e.event_id)
              return (
                <div
                  key={e.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 130px 1fr 150px 90px 60px',
                    gap: 8,
                    padding: '0 20px',
                    borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                    alignItems: 'center',
                    minHeight: 50,
                    background: i % 2 === 0 ? C.white : '#FAFAFA',
                  }}
                >
                  {/* Date */}
                  <div style={{ fontSize: 12, color: C.gray }}>
                    {new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </div>

                  {/* Category */}
                  <div><CatBadge cat={e.category} /></div>

                  {/* Description */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.description}
                    </div>
                    {e.notes && (
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.notes}
                      </div>
                    )}
                  </div>

                  {/* Event link */}
                  <div style={{ fontSize: 12 }}>
                    {linkedEvent ? (
                      <button
                        onClick={() => { if (setScreen && setSelectedEvent) { setSelectedEvent(linkedEvent.id); setScreen('event_detail') } }}
                        style={{ background: 'none', border: 'none', color: C.rosa, cursor: 'pointer', fontSize: 12, fontWeight: 500, padding: 0, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block', textAlign: 'left' }}
                      >
                        {linkedEvent.client?.name || EVT_TYPES[linkedEvent.type]?.label || linkedEvent.type}
                      </button>
                    ) : (
                      <span style={{ color: C.border }}>—</span>
                    )}
                  </div>

                  {/* Amount */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, textAlign: 'right' }}>
                    {fmtAmt(e.amount)}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => onEdit(e)}
                      title="Edit"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 6, color: C.gray, fontSize: 13, lineHeight: 1 }}
                      onMouseEnter={ev => ev.currentTarget.style.background = C.grayBg}
                      onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete(e.id)}
                      title="Delete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 6, color: C.red, fontSize: 13, lineHeight: 1 }}
                      onMouseEnter={ev => ev.currentTarget.style.background = C.redBg}
                      onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

// ─── BY CATEGORY TAB ───────────────────────────────────────────────────────────
function ByCategoryTab({ expenses, range, setRange }) {
  const filtered = useMemo(() => filterByRange(expenses, range), [expenses, range])
  const total = useMemo(() => filtered.reduce((s, e) => s + Number(e.amount), 0), [filtered])

  const breakdown = useMemo(() => {
    const totals = {}
    const counts = {}
    filtered.forEach(e => {
      const k = e.category || 'other'
      totals[k] = (totals[k] || 0) + Number(e.amount)
      counts[k] = (counts[k] || 0) + 1
    })
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({
        cat,
        amt,
        count: counts[cat] || 0,
        pct: total > 0 ? (amt / total) * 100 : 0,
      }))
  }, [filtered, total])

  const maxAmt = breakdown[0]?.amt || 1

  const pillSt = (active) => ({
    padding: '5px 13px', borderRadius: 20, border: `1px solid ${active ? C.rosa : C.border}`,
    background: active ? C.rosaPale : C.white, color: active ? C.rosa : C.gray,
    fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
  })

  const card = { background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Range filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DATE_RANGES.map(r => (
          <button key={r.key} style={pillSt(range === r.key)} onClick={() => setRange(r.key)}>{r.label}</button>
        ))}
      </div>

      {breakdown.length === 0 ? (
        <div style={{ ...card, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>No expenses in this period</div>
        </div>
      ) : (
        <>
          {/* Horizontal bar chart */}
          <div style={{ ...card, padding: '22px 26px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 18 }}>Spending by category</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {breakdown.map(({ cat, amt, pct }) => {
                const cfg = CAT_MAP[cat] || CAT_MAP.other
                const barWidth = maxAmt > 0 ? (amt / maxAmt) * 100 : 0
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Label */}
                    <div style={{ width: 110, fontSize: 12, fontWeight: 500, color: C.ink, flexShrink: 0, textAlign: 'right' }}>
                      {cfg.label}
                    </div>
                    {/* Bar track */}
                    <div style={{ flex: 1, height: 12, background: C.border, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${barWidth}%`,
                        background: cfg.color,
                        borderRadius: 6,
                        transition: 'width 0.5s ease',
                        minWidth: barWidth > 0 ? 6 : 0,
                      }} />
                    </div>
                    {/* Amount + pct */}
                    <div style={{ width: 130, textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{fmtAmt(amt)}</span>
                      <span style={{ fontSize: 11, color: C.gray, marginLeft: 6 }}>{Math.round(pct)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary table */}
          <div style={{ ...card, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 130px 80px',
              padding: '10px 20px', background: '#FAFAFA',
              borderBottom: `1px solid ${C.border}`,
            }}>
              {['Category', 'Count', 'Total', '% of Total'].map((h, i) => (
                <div key={h} style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 0 ? 'left' : 'right' }}>
                  {h}
                </div>
              ))}
            </div>

            {breakdown.map(({ cat, amt, count, pct }, i) => {
              const cfg = CAT_MAP[cat] || CAT_MAP.other
              return (
                <div
                  key={cat}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 80px 130px 80px',
                    padding: '12px 20px',
                    borderBottom: i < breakdown.length - 1 ? `1px solid ${C.border}` : 'none',
                    alignItems: 'center',
                    background: i % 2 === 0 ? C.white : '#FAFAFA',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.gray, textAlign: 'right' }}>{count}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, textAlign: 'right' }}>{fmtAmt(amt)}</div>
                  <div style={{ fontSize: 13, color: C.gray, textAlign: 'right' }}>{Math.round(pct)}%</div>
                </div>
              )
            })}

            {/* Total row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 130px 80px',
              padding: '12px 20px',
              background: C.ivory,
              borderTop: `2px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Total</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, textAlign: 'right' }}>
                {breakdown.reduce((s, r) => s + r.count, 0)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, textAlign: 'right' }}>{fmtAmt(total)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, textAlign: 'right' }}>100%</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── BY EVENT TAB ──────────────────────────────────────────────────────────────
function ByEventTab({ expenses, events, range, setRange, setScreen, setSelectedEvent }) {
  const { boutique } = useAuth()
  const [milestones, setMilestones] = React.useState([])

  // Fetch paid milestones to calculate event revenue
  React.useEffect(() => {
    if (!boutique?.id) return
    supabase
      .from('payment_milestones')
      .select('event_id, amount')
      .eq('boutique_id', boutique.id)
      .eq('status', 'paid')
      .then(({ data }) => { if (data) setMilestones(data) })
  }, [boutique?.id])

  const filtered = useMemo(() => filterByRange(expenses, range), [expenses, range])

  // Group expenses by event_id (only linked ones)
  const eventExpenseMap = useMemo(() => {
    const map = {}
    filtered.filter(e => e.event_id).forEach(e => {
      if (!map[e.event_id]) map[e.event_id] = []
      map[e.event_id].push(e)
    })
    return map
  }, [filtered])

  // Group paid milestones by event_id
  const revenueMap = useMemo(() => {
    const map = {}
    milestones.forEach(m => {
      map[m.event_id] = (map[m.event_id] || 0) + Number(m.amount)
    })
    return map
  }, [milestones])

  const eventRows = useMemo(() => {
    return Object.entries(eventExpenseMap)
      .map(([eventId, exps]) => {
        const ev = events.find(e => e.id === eventId)
        const totalExpenses = exps.reduce((s, e) => s + Number(e.amount), 0)
        const revenue = revenueMap[eventId] || 0
        const profit = revenue - totalExpenses
        return { eventId, ev, exps, totalExpenses, revenue, profit }
      })
      .sort((a, b) => b.totalExpenses - a.totalExpenses)
  }, [eventExpenseMap, revenueMap, events])

  const pillSt = (active) => ({
    padding: '5px 13px', borderRadius: 20, border: `1px solid ${active ? C.rosa : C.border}`,
    background: active ? C.rosaPale : C.white, color: active ? C.rosa : C.gray,
    fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
  })

  const card = { background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Range filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DATE_RANGES.map(r => (
          <button key={r.key} style={pillSt(range === r.key)} onClick={() => setRange(r.key)}>{r.label}</button>
        ))}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 70px 120px 130px 150px',
          gap: 8,
          padding: '10px 20px',
          background: '#FAFAFA',
          borderBottom: `1px solid ${C.border}`,
        }}>
          {['Event', 'Exps.', 'Total Cost', 'Revenue (paid)', 'Profit / Margin'].map((h, i) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 0 ? 'left' : 'right' }}>
              {h}
            </div>
          ))}
        </div>

        {eventRows.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 6 }}>No events with expenses</div>
            <div style={{ fontSize: 13, color: C.gray }}>Link expenses to events when logging them to see profit analysis here.</div>
          </div>
        ) : (
          eventRows.map(({ eventId, ev, exps, totalExpenses, revenue, profit }, i) => {
            const profitPos = profit >= 0
            const profitColor = profitPos ? C.green : C.red
            const profitBg   = profitPos ? C.greenBg : C.redBg
            const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : null
            const clientName = ev?.client?.name || null
            const evTypeLabel = EVT_TYPES[ev?.type]?.label || ev?.type || 'Event'
            const eventLabel = clientName
              ? `${clientName} — ${evTypeLabel}`
              : ev ? evTypeLabel : `Event (${eventId.slice(0, 8)}…)`

            return (
              <div
                key={eventId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 70px 120px 130px 150px',
                  gap: 8,
                  padding: '14px 20px',
                  borderBottom: i < eventRows.length - 1 ? `1px solid ${C.border}` : 'none',
                  alignItems: 'center',
                  background: i % 2 === 0 ? C.white : '#FAFAFA',
                }}
              >
                {/* Event name */}
                <div>
                  {ev ? (
                    <>
                      <button
                        onClick={() => { if (setScreen && setSelectedEvent) { setSelectedEvent(ev.id); setScreen('event_detail') } }}
                        style={{ background: 'none', border: 'none', color: C.rosa, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, textDecoration: 'underline', textAlign: 'left' }}
                      >
                        {eventLabel}
                      </button>
                      {ev.event_date && (
                        <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{fmtDate(ev.event_date)}</div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 13, color: C.gray }}>{eventLabel}</span>
                  )}
                </div>

                {/* Count */}
                <div style={{ fontSize: 13, color: C.gray, textAlign: 'right' }}>{exps.length}</div>

                {/* Total expenses */}
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, textAlign: 'right' }}>{fmtAmt(totalExpenses)}</div>

                {/* Revenue */}
                <div style={{ fontSize: 13, fontWeight: 700, color: revenue > 0 ? C.green : C.gray, textAlign: 'right' }}>
                  {revenue > 0 ? fmtAmt(revenue) : '—'}
                </div>

                {/* Profit */}
                <div style={{ textAlign: 'right' }}>
                  {revenue > 0 ? (
                    <span style={{
                      display: 'inline-block', fontSize: 12, fontWeight: 700,
                      padding: '3px 10px', borderRadius: 999,
                      background: profitBg, color: profitColor,
                    }}>
                      {profitPos ? '+' : ''}{fmtAmt(profit)}
                      {margin !== null && (
                        <span style={{ fontWeight: 500, marginLeft: 4 }}>({margin}%)</span>
                      )}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: C.gray }}>No revenue logged</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ExpensesPage({ events = [], setScreen, setSelectedEvent }) {
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useExpenses()
  const [tab, setTab] = useState('all')
  const [range, setRange] = useState('this_month')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  // ── Stat computations ──────────────────────────────────────────────────────
  const thisMonth = useMemo(() => getThisMonthExpenses(expenses), [expenses])
  const thisYear  = useMemo(() => getThisYearExpenses(expenses),  [expenses])

  const thisMonthTotal = useMemo(() => thisMonth.reduce((s, e) => s + Number(e.amount), 0), [thisMonth])
  const thisYearTotal  = useMemo(() => thisYear.reduce((s, e)  => s + Number(e.amount), 0), [thisYear])

  const topCatThisMonth = useMemo(() => {
    const totals = {}
    thisMonth.forEach(e => { totals[e.category] = (totals[e.category] || 0) + Number(e.amount) })
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
    return sorted[0] || null
  }, [thisMonth])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSave = async (payload) => {
    setSaving(true)
    if (editTarget) {
      await updateExpense(editTarget.id, payload)
    } else {
      await createExpense(payload)
    }
    setSaving(false)
    setShowModal(false)
    setEditTarget(null)
  }

  const handleEdit = (e) => { setEditTarget(e); setShowModal(true) }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return
    await deleteExpense(id)
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const tabSt = (t) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: tab === t ? C.rosa : 'transparent',
    color: tab === t ? C.white : C.gray,
    fontSize: 13, fontWeight: tab === t ? 600 : 500, cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.grayBg, overflow: 'hidden' }}>
      <Topbar
        title="Expense Ledger"
        subtitle="Track boutique costs and event profitability"
        actions={
          <button
            onClick={() => { setEditTarget(null); setShowModal(true) }}
            style={{ background: C.rosa, color: C.white, border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Add Expense
          </button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── 4 Stats ── */}
          {loading ? (
            <div style={{ textAlign: 'center', color: C.gray, fontSize: 13, padding: '40px 0' }}>Loading…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <StatCard
                label="This month total"
                value={fmtAmt(thisMonthTotal)}
                sub={`${thisMonth.length} expense${thisMonth.length !== 1 ? 's' : ''}`}
              />
              <StatCard
                label="This year total"
                value={fmtAmt(thisYearTotal)}
                sub={`${thisYear.length} expense${thisYear.length !== 1 ? 's' : ''}`}
              />
              <StatCard
                label="Top category (month)"
                value={topCatThisMonth ? (CAT_MAP[topCatThisMonth[0]]?.label || topCatThisMonth[0]) : '—'}
                sub={topCatThisMonth ? fmtAmt(topCatThisMonth[1]) : 'No expenses yet'}
              />
              <StatCard
                label="# expenses this month"
                value={String(thisMonth.length)}
                sub={thisMonth.length > 0 ? `avg ${fmtAmt(thisMonthTotal / thisMonth.length)} each` : 'No expenses yet'}
              />
            </div>
          )}

          {/* ── View Tabs ── */}
          <div style={{ display: 'flex', gap: 4, background: C.white, borderRadius: 10, padding: 4, border: `1px solid ${C.border}`, width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <button style={tabSt('all')} onClick={() => setTab('all')}>All</button>
            <button style={tabSt('by_category')} onClick={() => setTab('by_category')}>By Category</button>
            <button style={tabSt('by_event')} onClick={() => setTab('by_event')}>By Event</button>
          </div>

          {/* ── Tab Content ── */}
          {!loading && tab === 'all' && (
            <AllTab
              expenses={expenses}
              range={range}
              setRange={setRange}
              events={events}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={() => { setEditTarget(null); setShowModal(true) }}
              setScreen={setScreen}
              setSelectedEvent={setSelectedEvent}
            />
          )}
          {!loading && tab === 'by_category' && (
            <ByCategoryTab
              expenses={expenses}
              range={range}
              setRange={setRange}
            />
          )}
          {!loading && tab === 'by_event' && (
            <ByEventTab
              expenses={expenses}
              events={events}
              range={range}
              setRange={setRange}
              setScreen={setScreen}
              setSelectedEvent={setSelectedEvent}
            />
          )}

        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <ExpenseModal
          editExpense={editTarget}
          events={events}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
          saving={saving}
        />
      )}
    </div>
  )
}
