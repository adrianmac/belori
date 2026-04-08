import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { C, fmt, EVT_TYPES } from '../lib/colors'
import { useToast, inputSt, Badge, EventTypeBadge, PrimaryBtn, GhostBtn } from '../lib/ui.jsx'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtDate(str) {
  if (!str) return '—'
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function thisMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start, end }
}

function isThisMonth(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T12:00:00')
  const { start, end } = thisMonthRange()
  return d >= start && d <= end
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

function MilestoneStatusBadge({ status }) {
  const cfg = {
    paid:    { text: '✓ Paid',    bg: C.greenBg,  color: C.green },
    overdue: { text: 'Overdue',   bg: C.redBg,    color: C.red },
    pending: { text: 'Pending',   bg: C.amberBg,  color: C.amber },
  }
  const c = cfg[status] || { text: status, bg: C.grayBg, color: C.gray }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
      background: c.bg, color: c.color, whiteSpace: 'nowrap',
    }}>
      {c.text}
    </span>
  )
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '16px 20px', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: C.gray, fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || C.ink, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ─── MILESTONE ROW ────────────────────────────────────────────────────────────

function MilestoneRow({ milestone, onGenerate, generating }) {
  const toast = useToast()
  const isPaid = milestone.status === 'paid'
  const hasLink = !!milestone.stripe_payment_link_id
  const linkUrl = milestone.stripe_payment_link_url ||
    (milestone.stripe_payment_link_id ? `https://buy.stripe.com/${milestone.stripe_payment_link_id}` : null)

  async function handleCopy() {
    if (!linkUrl) return
    try {
      await navigator.clipboard.writeText(linkUrl)
      toast('Link copied to clipboard', 'success')
    } catch {
      toast('Could not copy — try manually', 'warn')
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      borderBottom: `1px solid ${C.border}`,
    }}>
      {/* Label + due date */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{milestone.label}</div>
        <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>Due {fmtDate(milestone.due_date)}</div>
      </div>

      {/* Amount */}
      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', minWidth: 64, textAlign: 'right' }}>
        {fmt(milestone.amount)}
      </div>

      {/* Status */}
      <div style={{ minWidth: 72 }}>
        <MilestoneStatusBadge status={milestone.status} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 200, justifyContent: 'flex-end' }}>
        {isPaid && !hasLink && (
          <span style={{ fontSize: 11, color: C.gray }}>—</span>
        )}

        {isPaid && hasLink && (
          <>
            <button
              onClick={handleCopy}
              style={{
                fontSize: 12, padding: '5px 10px', borderRadius: 7,
                border: `1px solid ${C.border}`, background: C.white,
                cursor: 'pointer', color: C.ink, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              📋 Copy Link
            </button>
            <a
              href={linkUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11, color: C.blue, textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Open in Stripe ↗
            </a>
          </>
        )}

        {!isPaid && !hasLink && (
          <button
            onClick={() => onGenerate(milestone.id)}
            disabled={generating === milestone.id}
            style={{
              fontSize: 12, padding: '6px 12px', borderRadius: 7,
              background: generating === milestone.id ? C.border : C.rosa,
              color: generating === milestone.id ? C.gray : C.white,
              border: 'none', cursor: generating === milestone.id ? 'default' : 'pointer',
              fontWeight: 500, whiteSpace: 'nowrap',
            }}
          >
            {generating === milestone.id ? 'Generating…' : 'Generate Link'}
          </button>
        )}

        {!isPaid && hasLink && (
          <>
            <button
              onClick={handleCopy}
              style={{
                fontSize: 12, padding: '5px 10px', borderRadius: 7,
                border: `1px solid ${C.rosa}`, background: C.white,
                cursor: 'pointer', color: C.rosa, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              📋 Copy Link
            </button>
            <a
              href={linkUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11, color: C.blue, textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Open in Stripe ↗
            </a>
          </>
        )}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function OnlinePaymentsPage() {
  const { boutique } = useAuth()
  const toast = useToast()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState(null) // milestone id currently being generated

  // ── Fetch events with milestones ──────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    if (!boutique) return
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('*, client:clients(name, email, phone), milestones:payment_milestones(*)')
      .eq('boutique_id', boutique.id)
      .not('status', 'in', '("completed","cancelled")')
      .order('event_date', { ascending: true })
    if (!error && data) {
      setEvents(data)
      // Auto-select first event with unpaid milestones
      if (!selectedEventId) {
        const first = data.find(e =>
          (e.milestones || []).some(m => m.status !== 'paid')
        )
        if (first) setSelectedEventId(first.id)
      }
    }
    setLoading(false)
  }, [boutique?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // ── Derived data ──────────────────────────────────────────────────────────

  // Events that have at least one unpaid milestone
  const eventsWithBalances = useMemo(() => {
    return events.filter(e => {
      const ms = e.milestones || []
      return ms.some(m => m.status !== 'paid')
    })
  }, [events])

  const filteredEvents = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return eventsWithBalances
    return eventsWithBalances.filter(e =>
      (e.client?.name || '').toLowerCase().includes(q) ||
      (e.type || '').toLowerCase().includes(q)
    )
  }, [eventsWithBalances, search])

  const selectedEvent = useMemo(
    () => events.find(e => e.id === selectedEventId) || null,
    [events, selectedEventId]
  )

  // Stats
  const stats = useMemo(() => {
    let totalValue = 0
    let linksSent = 0
    let collected = 0

    for (const ev of events) {
      for (const m of (ev.milestones || [])) {
        const createdThisMonth = isThisMonth(m.created_at)
        if (m.stripe_payment_link_id) {
          // Count all-time links toward "links sent"
          linksSent++
          totalValue += Number(m.amount) || 0
          if (m.status === 'paid') collected++
        }
      }
    }
    // For total link value generated this month, re-filter
    let monthlyValue = 0
    for (const ev of events) {
      for (const m of (ev.milestones || [])) {
        if (m.stripe_payment_link_id && isThisMonth(m.created_at)) {
          monthlyValue += Number(m.amount) || 0
        }
      }
    }
    return { monthlyValue, linksSent, collected }
  }, [events])

  // Milestone balance helpers for selected event
  const eventBalance = useMemo(() => {
    if (!selectedEvent) return { total: 0, paid: 0, balance: 0 }
    const ms = selectedEvent.milestones || []
    const total = ms.reduce((s, m) => s + (Number(m.amount) || 0), 0)
    const paid = ms.filter(m => m.status === 'paid').reduce((s, m) => s + (Number(m.amount) || 0), 0)
    return { total, paid, balance: total - paid }
  }, [selectedEvent])

  // ── Generate link ─────────────────────────────────────────────────────────
  async function handleGenerateLink(milestoneId) {
    setGenerating(milestoneId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: { milestone_id: milestoneId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (error) throw error
      if (!data?.url) throw new Error('No URL returned')

      toast('Payment link generated!', 'success')
      // Copy to clipboard automatically
      try {
        await navigator.clipboard.writeText(data.url)
        toast('Link copied to clipboard', 'success')
      } catch {
        // clipboard not available — that's ok
      }
      await fetchEvents()
    } catch (err) {
      console.error('create-payment-link error:', err)
      toast(`Failed: ${err.message || 'Unknown error'}`, 'error')
    } finally {
      setGenerating(null)
    }
  }

  // ── Balance indicator for event list row ─────────────────────────────────
  function getRowBalance(ev) {
    const ms = ev.milestones || []
    const total = ms.reduce((s, m) => s + (Number(m.amount) || 0), 0)
    const paid = ms.filter(m => m.status === 'paid').reduce((s, m) => s + (Number(m.amount) || 0), 0)
    return total - paid
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: C.grayBg }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{
        background: C.white, borderBottom: `1px solid ${C.border}`,
        padding: '16px 24px',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>Online Payment Links</div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
          Generate Stripe payment links for client milestones
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, padding: '16px 24px 0', flexWrap: 'wrap' }}>
        <StatCard
          label="Link value generated (this month)"
          value={fmt(stats.monthlyValue)}
          sub="Total amount across generated links"
          accent={C.rosa}
        />
        <StatCard
          label="Links sent"
          value={stats.linksSent}
          sub="Milestones with a payment link"
        />
        <StatCard
          label="Collected via links"
          value={stats.collected}
          sub="Links that resulted in payment"
          accent={C.green}
        />
      </div>

      {/* ── Two-panel body ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', gap: 0, minHeight: 0,
        margin: '16px 24px 24px',
        background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden',
      }}>

        {/* Left panel — event list */}
        <div style={{
          width: 300, flexShrink: 0, borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Search */}
          <div style={{ padding: '12px 12px 8px' }}>
            <input
              style={{ ...inputSt, fontSize: 12 }}
              placeholder="Search client or event type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredEvents.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: C.gray, fontSize: 13 }}>
                {search ? 'No matching events.' : 'No events with outstanding balances.'}
              </div>
            ) : (
              filteredEvents.map(ev => {
                const isSelected = ev.id === selectedEventId
                const balance = getRowBalance(ev)
                const unpaidCount = (ev.milestones || []).filter(m => m.status !== 'paid').length
                return (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '12px 14px', border: 'none', cursor: 'pointer',
                      borderBottom: `1px solid ${C.border}`,
                      background: isSelected ? C.rosaPale : C.white,
                      borderLeft: isSelected ? `3px solid ${C.rosa}` : '3px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.client?.name || 'Unknown client'}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.red, whiteSpace: 'nowrap' }}>
                        {fmt(balance)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <EventTypeBadge type={ev.type} />
                      <span style={{ fontSize: 11, color: C.gray }}>{fmtDate(ev.event_date)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.amber, marginTop: 3 }}>
                      {unpaidCount} unpaid milestone{unpaidCount !== 1 ? 's' : ''}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right panel — milestone detail */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {!selectedEvent ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>
              {eventsWithBalances.length === 0
                ? 'No events with outstanding balances.'
                : 'Select an event to view milestones.'}
            </div>
          ) : (
            <>
              {/* Event header */}
              <div style={{
                padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
                background: C.rosaPale,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>
                    {selectedEvent.client?.name || 'Unknown client'}
                  </div>
                  <EventTypeBadge type={selectedEvent.type} />
                </div>
                <div style={{ fontSize: 12, color: C.inkLight, marginBottom: 10 }}>
                  {fmtDate(selectedEvent.event_date)}
                  {selectedEvent.venue ? ` · ${selectedEvent.venue}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{fmt(eventBalance.total)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5 }}>Paid</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>{fmt(eventBalance.paid)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5 }}>Balance</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: eventBalance.balance > 0 ? C.red : C.green }}>
                      {fmt(eventBalance.balance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Column headers */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
                background: C.grayBg, borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5 }}>Milestone</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 64, textAlign: 'right' }}>Amount</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 72 }}>Status</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 200, textAlign: 'right' }}>Action</div>
              </div>

              {/* Milestone rows */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {(selectedEvent.milestones || []).length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: C.gray, fontSize: 13 }}>
                    No milestones for this event.
                  </div>
                ) : (
                  [...(selectedEvent.milestones || [])]
                    .sort((a, b) => {
                      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
                      return 0
                    })
                    .map(m => (
                      <MilestoneRow
                        key={m.id}
                        milestone={m}
                        onGenerate={handleGenerateLink}
                        generating={generating}
                      />
                    ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
