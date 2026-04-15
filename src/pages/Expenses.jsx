import React, { useState, useMemo } from 'react'
import { C } from '../lib/colors'
import { Topbar, inputSt, LBL, ConfirmModal } from '../lib/ui.jsx'
import { useExpenses } from '../hooks/useExpenses'

// ─── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const EXPENSE_CATS = {
  dress_purchase: { label: 'Dress purchase',  emoji: '👗', color: '#9D174D', bg: '#FDF2F8' },
  alterations:    { label: 'Alterations',     emoji: '🧵', color: '#1D4ED8', bg: '#EFF6FF' },
  decoration:     { label: 'Decoration',      emoji: '🌸', color: '#15803D', bg: '#F0FDF4' },
  marketing:      { label: 'Marketing',       emoji: '📣', color: C.rosaText, bg: C.rosaPale },
  utilities:      { label: 'Utilities',       emoji: '💡', color: '#374151', bg: '#F9FAFB' },
  payroll:        { label: 'Payroll',         emoji: '💼', color: '#0891B2', bg: '#ECFEFF' },
  maintenance:    { label: 'Maintenance',     emoji: '🔧', color: '#92400E', bg: '#FEF3C7' },
  other:          { label: 'Other',           emoji: '📦', color: '#6B7280', bg: '#F3F4F6' },
}

const today = () => new Date().toISOString().split('T')[0]

const fmtAmt = (n) =>
  '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── CATEGORY BADGE ────────────────────────────────────────────────────────────
const CatBadge = ({ cat }) => {
  const c = EXPENSE_CATS[cat] || EXPENSE_CATS.other
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
      background: c.bg, color: c.color, whiteSpace: 'nowrap',
    }}>
      {c.emoji} {c.label}
    </span>
  )
}

// ─── DATE RANGE HELPERS ────────────────────────────────────────────────────────
const DATE_RANGES = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_year',  label: 'This year'  },
  { key: 'all_time',   label: 'All time'   },
]

function filterByRange(expenses, range) {
  const now = new Date()
  if (range === 'all_time') return expenses
  return expenses.filter(e => {
    const d = new Date(e.date + 'T12:00:00')
    if (range === 'this_month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    if (range === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth()
    }
    if (range === 'this_year') return d.getFullYear() === now.getFullYear()
    return true
  })
}

// ─── LOG EXPENSE MODAL ─────────────────────────────────────────────────────────
const BLANK_FORM = { date: today(), category: 'dress_purchase', description: '', vendor: '', amount: '', event_id: '' }

const LogExpenseModal = ({ onClose, onSave, saving, events, editExpense }) => {
  const [form, setForm] = useState(editExpense
    ? {
        date: editExpense.date || today(),
        category: editExpense.category || 'dress_purchase',
        description: editExpense.description || '',
        vendor: editExpense.vendor || '',
        amount: editExpense.amount != null ? String(editExpense.amount) : '',
        event_id: editExpense.event_id || '',
      }
    : BLANK_FORM
  )

  const valid = form.description.trim() && form.amount && Number(form.amount) > 0

  const handleSubmit = () => {
    if (!valid) return
    onSave({
      date: form.date,
      category: form.category,
      description: form.description.trim(),
      vendor: form.vendor.trim() || null,
      amount: parseFloat(form.amount),
      event_id: form.event_id || null,
    })
  }

  const field = { ...inputSt }
  const lbl = { ...LBL, display: 'block', marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, width: 520, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>{editExpense ? 'Edit expense' : 'Log expense'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Row 1: Date + Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={field} />
            </div>
            <div>
              <label style={lbl}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={field}>
                {Object.entries(EXPENSE_CATS).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>Description <span style={{ color: C.rosaText }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. Monthly storefront rent"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={field}
            />
          </div>

          {/* Row 2: Vendor + Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Vendor <span style={{ color: C.gray, fontWeight: 400 }}>(optional)</span></label>
              <input
                type="text"
                placeholder="Vendor or supplier name"
                value={form.vendor}
                onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                style={field}
              />
            </div>
            <div>
              <label style={lbl}>Amount <span style={{ color: C.rosaText }}>*</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                style={field}
              />
            </div>
          </div>

          {/* Link to event */}
          {events.length > 0 && (
            <div>
              <label style={lbl}>Link to event <span style={{ color: C.gray, fontWeight: 400 }}>(optional)</span></label>
              <select value={form.event_id} onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))} style={field}>
                <option value="">— No event —</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.client?.name || ev.client_id || 'Client'} — {ev.type} {ev.event_date ? new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', color: C.gray, border: `1px solid ${C.border}`, padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !valid}
            style={{
              background: valid ? C.rosa : C.border, color: C.white, border: 'none',
              padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: saving || !valid ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving…' : editExpense ? 'Save changes' : 'Log expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function Expenses({ events = [], setScreen, setSelectedEvent }) {
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useExpenses()
  const [range, setRange] = useState('this_month')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // expense id | null
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  // ── Filtered + sorted expenses ────────────────────────────────────────────
  const filtered = useMemo(() => filterByRange(expenses, range), [expenses, range])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av, bv
      if (sortCol === 'date')     { av = a.date;        bv = b.date }
      if (sortCol === 'category') { av = a.category;    bv = b.category }
      if (sortCol === 'description') { av = a.description; bv = b.description }
      if (sortCol === 'vendor')   { av = a.vendor || ''; bv = b.vendor || '' }
      if (sortCol === 'amount')   { av = Number(a.amount); bv = Number(b.amount) }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortCol, sortDir])

  // ── Summary stats ─────────────────────────────────────────────────────────
  const total = useMemo(() => filtered.reduce((s, e) => s + Number(e.amount), 0), [filtered])

  const topCat = useMemo(() => {
    const totals = {}
    filtered.forEach(e => { totals[e.category] = (totals[e.category] || 0) + Number(e.amount) })
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
    return sorted[0] || null
  }, [filtered])

  const avgPerEvent = useMemo(() => {
    const eventIds = new Set(filtered.filter(e => e.event_id).map(e => e.event_id))
    return eventIds.size > 0 ? total / eventIds.size : null
  }, [filtered, total])

  // ── Category breakdown data ───────────────────────────────────────────────
  const catBreakdown = useMemo(() => {
    const totals = {}
    filtered.forEach(e => { totals[e.category] = (totals[e.category] || 0) + Number(e.amount) })
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({ cat, amt, pct: total > 0 ? (amt / total) * 100 : 0 }))
  }, [filtered, total])

  // ── Sort toggle ────────────────────────────────────────────────────────────
  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const SortArrow = ({ col }) => {
    if (sortCol !== col) return <span style={{ color: C.border, marginLeft: 3 }}>↕</span>
    return <span style={{ color: C.rosaText, marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Save handler ──────────────────────────────────────────────────────────
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

  const handleDelete = (id) => setDeleteConfirm(id)
  const confirmDelete = async () => {
    if (!deleteConfirm) return
    await deleteExpense(deleteConfirm)
    setDeleteConfirm(null)
  }

  const openEdit = (e) => { setEditTarget(e); setShowModal(true) }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const card = { background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }
  const colHdr = { fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }

  const rangeBtn = (r) => ({
    padding: '6px 14px', borderRadius: 20, border: `1px solid ${range === r ? C.rosa : C.border}`,
    background: range === r ? C.rosaPale : C.white, color: range === r ? C.rosaText : C.gray,
    fontSize: 12, fontWeight: range === r ? 600 : 400, cursor: 'pointer',
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.grayBg, overflow: 'hidden' }}>
      <Topbar
        title="Expenses"
        subtitle="Track boutique costs & vendor payments"
        actions={
          <button
            onClick={() => { setEditTarget(null); setShowModal(true) }}
            style={{ background: C.rosa, color: C.white, border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Log expense
          </button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Date range filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DATE_RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)} style={rangeBtn(r.key)}>{r.label}</button>
            ))}
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {/* Total */}
            <div style={{ ...card, padding: '18px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Total expenses
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.ink }}>{fmtAmt(total)}</div>
              <div style={{ fontSize: 12, color: C.gray, marginTop: 3 }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
            </div>

            {/* Top category */}
            <div style={{ ...card, padding: '18px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Top category
              </div>
              {topCat ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{EXPENSE_CATS[topCat[0]]?.emoji}</span>
                    <span style={{ fontSize: 16 }}>{EXPENSE_CATS[topCat[0]]?.label || topCat[0]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.gray, marginTop: 3 }}>{fmtAmt(topCat[1])} total</div>
                </>
              ) : (
                <div style={{ fontSize: 16, color: C.gray }}>—</div>
              )}
            </div>

            {/* Avg per event */}
            <div style={{ ...card, padding: '18px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Avg per event
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.ink }}>
                {avgPerEvent != null ? fmtAmt(avgPerEvent) : '—'}
              </div>
              {avgPerEvent != null && (
                <div style={{ fontSize: 12, color: C.gray, marginTop: 3 }}>
                  across {new Set(filtered.filter(e => e.event_id).map(e => e.event_id)).size} event{new Set(filtered.filter(e => e.event_id).map(e => e.event_id)).size !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Category breakdown bar chart */}
          {catBreakdown.length > 0 && (
            <div style={{ ...card, padding: '20px 24px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 14 }}>Category breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {catBreakdown.map(({ cat, amt, pct }) => {
                  const cfg = EXPENSE_CATS[cat] || EXPENSE_CATS.other
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Label */}
                      <div style={{ width: 140, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 14 }}>{cfg.emoji}</span>
                        <span style={{ fontSize: 12, color: C.ink, fontWeight: 500 }}>{cfg.label}</span>
                      </div>
                      {/* Bar */}
                      <div style={{ flex: 1, height: 10, background: C.border, borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`, background: cfg.color,
                          borderRadius: 5, transition: 'width 0.4s ease',
                          minWidth: pct > 0 ? 4 : 0,
                        }} />
                      </div>
                      {/* Amount + pct */}
                      <div style={{ width: 120, textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{fmtAmt(amt)}</span>
                        <span style={{ fontSize: 11, color: C.gray, marginLeft: 6 }}>{Math.round(pct)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Expenses table */}
          <div style={{ ...card, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>All expenses</div>
              <div style={{ fontSize: 12, color: C.gray }}>{sorted.length} record{sorted.length !== 1 ? 's' : ''}</div>
            </div>

            {loading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: C.gray, fontSize: 13 }}>Loading…</div>
            ) : sorted.length === 0 ? (
              /* Empty state */
              <div style={{ padding: '70px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 6 }}>No expenses logged yet</div>
                <div style={{ fontSize: 13, color: C.gray, marginBottom: 18 }}>Start tracking your boutique costs to see insights here.</div>
                <button
                  onClick={() => { setEditTarget(null); setShowModal(true) }}
                  style={{ background: 'none', border: 'none', color: C.rosaText, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  + Log your first expense →
                </button>
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 160px 1fr 160px 100px 110px 72px',
                  padding: '10px 20px',
                  background: '#FAFAFA',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={colHdr} onClick={() => toggleSort('date')}>Date <SortArrow col="date" /></div>
                  <div style={colHdr} onClick={() => toggleSort('category')}>Category <SortArrow col="category" /></div>
                  <div style={colHdr} onClick={() => toggleSort('description')}>Description <SortArrow col="description" /></div>
                  <div style={colHdr} onClick={() => toggleSort('vendor')}>Vendor <SortArrow col="vendor" /></div>
                  <div style={{ ...colHdr, textAlign: 'right' }} onClick={() => toggleSort('amount')}>Amount <SortArrow col="amount" /></div>
                  <div style={colHdr}>Event</div>
                  <div style={colHdr}></div>
                </div>

                {/* Rows */}
                {sorted.map((e, i) => {
                  const amt = Number(e.amount)
                  const amtColor = amt < 500 ? C.green : amt > 2000 ? C.red : C.ink
                  const linkedEvent = events.find(ev => ev.id === e.event_id)

                  return (
                    <div
                      key={e.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 160px 1fr 160px 100px 110px 72px',
                        padding: '0 20px',
                        borderBottom: i < sorted.length - 1 ? `1px solid ${C.border}` : 'none',
                        alignItems: 'center',
                        minHeight: 52,
                        background: i % 2 === 0 ? C.white : '#FAFAFA',
                      }}
                    >
                      {/* Date */}
                      <div style={{ fontSize: 13, color: C.gray }}>
                        {new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </div>

                      {/* Category */}
                      <div><CatBadge cat={e.category} /></div>

                      {/* Description */}
                      <div style={{ fontSize: 13, color: C.ink, fontWeight: 500, paddingRight: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description}
                      </div>

                      {/* Vendor */}
                      <div style={{ fontSize: 13, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.vendor || <span style={{ color: C.border }}>—</span>}
                      </div>

                      {/* Amount */}
                      <div style={{ fontSize: 14, fontWeight: 700, color: amtColor, textAlign: 'right' }}>
                        {fmtAmt(amt)}
                      </div>

                      {/* Event link */}
                      <div style={{ fontSize: 12 }}>
                        {linkedEvent ? (
                          <button
                            onClick={() => { if (setScreen && setSelectedEvent) { setSelectedEvent(linkedEvent.id); setScreen('event_detail') } }}
                            style={{ background: 'none', border: 'none', color: C.rosaText, cursor: 'pointer', fontSize: 12, fontWeight: 500, padding: 0, textDecoration: 'underline' }}
                          >
                            View event →
                          </button>
                        ) : (
                          <span style={{ color: C.border }}>—</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => openEdit(e)}
                          title="Edit"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: C.gray, fontSize: 14, lineHeight: 1 }}
                          onMouseEnter={ev => ev.currentTarget.style.background = C.grayBg}
                          onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          title="Delete"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: C.red, fontSize: 14, lineHeight: 1 }}
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
      </div>

      {/* Log / Edit modal */}
      {showModal && (
        <LogExpenseModal
          onClose={() => { setShowModal(false); setEditTarget(null) }}
          onSave={handleSave}
          saving={saving}
          events={events}
          editExpense={editTarget}
        />
      )}
      {deleteConfirm && (
        <ConfirmModal
          title="Delete this expense?"
          message="This cannot be undone."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
