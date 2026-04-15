import React, { useState, useEffect } from 'react'
import { C, EVT_TYPES, pct } from '../lib/colors'
import { PrimaryBtn, GhostBtn, useToast } from '../lib/ui.jsx'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fmtCents } from '../lib/invoiceItems'
import InvoiceDetailScreen from './InvoiceDetailScreen'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtShortDate(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtMoney(n) {
  const v = Number(n) || 0
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map(w => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ─── Status configs ────────────────────────────────────────────────────────────
const INV_STATUS = {
  draft:          { bg: C.grayBg,   color: C.gray,   label: 'Draft' },
  sent:           { bg: C.blueBg,   color: C.blue,   label: 'Sent' },
  partially_paid: { bg: C.amberBg,  color: C.amber,  label: 'Partial' },
  paid:           { bg: C.greenBg,  color: C.green,  label: 'Paid' },
  cancelled:      { bg: C.redBg,    color: C.red,    label: 'Cancelled' },
}

const QUOTE_STATUS = {
  draft:    { bg: C.grayBg,  color: C.gray,   label: 'Draft' },
  sent:     { bg: C.blueBg,  color: C.blue,   label: 'Sent' },
  accepted: { bg: C.greenBg, color: C.green,  label: 'Accepted' },
  declined: { bg: C.redBg,   color: C.red,    label: 'Declined' },
  expired:  { bg: C.amberBg, color: C.amber,  label: 'Expired' },
}

const INV_FILTERS = [
  { key: 'all',           label: 'All' },
  { key: 'draft',         label: 'Draft' },
  { key: 'sent',          label: 'Sent' },
  { key: 'partially_paid', label: 'Partial' },
  { key: 'paid',          label: 'Paid' },
  { key: 'cancelled',     label: 'Cancelled' },
]

const QUOTE_FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'draft',    label: 'Draft' },
  { key: 'sent',     label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
  { key: 'expired',  label: 'Expired' },
]

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function StatusBadge({ status, cfg }) {
  const s = cfg[status] || { bg: C.grayBg, color: C.gray, label: status }
  return (
    <span style={{
      fontSize: 10, padding: '3px 8px', borderRadius: 999,
      background: s.bg, color: s.color, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function FilterPill({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: active ? 600 : 400,
        background: active ? C.ink : 'transparent',
        color: active ? C.white : C.gray,
        border: 'none', cursor: 'pointer',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      {label}
    </button>
  )
}

function MiniAvatar({ name }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      background: C.rosaPale, color: C.rosaText,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700,
    }}>
      {initials(name)}
    </div>
  )
}

// ─── Column header row ────────────────────────────────────────────────────────
function ColHeader({ cols }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols.template,
      padding: '7px 16px', background: C.grayBg,
      borderBottom: `1px solid ${C.border}`,
      position: 'sticky', top: 0, zIndex: 1,
    }}>
      {cols.labels.map(lbl => (
        <span key={lbl} style={{
          fontSize: 10, color: C.gray, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {lbl}
        </span>
      ))}
    </div>
  )
}

// ─── Invoice row ──────────────────────────────────────────────────────────────
function InvoiceRow({ inv, onClick }) {
  const [hovered, setHovered] = useState(false)
  const clientName = inv.client?.name || 'Unknown'
  const paidPct = pct(inv.paid_cents || 0, inv.total_cents || 1)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.2fr 90px 110px 100px',
        padding: '12px 16px',
        borderBottom: `1px solid ${C.border}`,
        background: hovered ? C.grayBg : C.white,
        cursor: 'pointer',
        alignItems: 'center',
        transition: 'background 0.12s',
      }}
    >
      {/* CLIENT */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <MiniAvatar name={clientName} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {clientName}
          </div>
          {inv.client?.phone && (
            <div style={{ fontSize: 11, color: C.gray }}>{inv.client.phone}</div>
          )}
        </div>
      </div>

      {/* INVOICE # */}
      <div style={{ fontSize: 12, color: C.gray }}>
        {inv.invoice_number || `INV-${inv.id?.slice(0, 8)}`}
      </div>

      {/* DATE */}
      <div style={{ fontSize: 12, color: C.gray }}>
        {fmtShortDate(inv.created_at)}
      </div>

      {/* AMOUNT */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
          {fmtCents(inv.total_cents || 0)}
        </div>
        {(inv.paid_cents > 0) && (
          <div style={{ fontSize: 11, color: C.green }}>
            {fmtCents(inv.paid_cents)} paid
          </div>
        )}
        <div style={{ height: 3, background: C.grayBg, borderRadius: 2, overflow: 'hidden', marginTop: 3, width: 80 }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, paidPct)}%`,
            background: C.green, borderRadius: 2,
          }} />
        </div>
      </div>

      {/* STATUS */}
      <div>
        <StatusBadge status={inv.status} cfg={INV_STATUS} />
      </div>
    </div>
  )
}

// ─── Quote row ────────────────────────────────────────────────────────────────
function QuoteRow({ q, onClick }) {
  const [hovered, setHovered] = useState(false)
  const evtCfg = q.event_type ? (EVT_TYPES[q.event_type] || null) : null
  const isExpired = q.expires_at && new Date(q.expires_at) < new Date()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.2fr 110px 110px 100px 90px',
        padding: '12px 16px',
        borderBottom: `1px solid ${C.border}`,
        background: hovered ? C.grayBg : C.white,
        cursor: 'pointer',
        alignItems: 'center',
        transition: 'background 0.12s',
      }}
    >
      {/* CLIENT */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <MiniAvatar name={q.client_name} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {q.client_name || 'Unknown'}
            </span>
            {evtCfg && (
              <span style={{
                fontSize: 9, padding: '2px 5px', borderRadius: 4,
                background: evtCfg.bg || C.grayBg, color: evtCfg.col || C.gray,
                fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                {evtCfg.icon} {evtCfg.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* QUOTE # */}
      <div style={{ fontSize: 12, color: C.gray }}>
        {q.quote_number || `Q-${q.id?.slice(0, 8)}`}
      </div>

      {/* EVENT DATE */}
      <div style={{ fontSize: 12, color: C.gray }}>
        {q.event_date ? fmtShortDate(q.event_date + 'T00:00:00') : '—'}
      </div>

      {/* EXPIRES */}
      <div style={{ fontSize: 12, color: isExpired ? C.red : C.gray }}>
        {q.expires_at ? fmtShortDate(q.expires_at + 'T00:00:00') : '—'}
      </div>

      {/* TOTAL */}
      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
        {fmtMoney(q.total)}
      </div>

      {/* STATUS */}
      <div>
        <StatusBadge status={q.status} cfg={QUOTE_STATUS} />
      </div>
    </div>
  )
}

// ─── Quote detail (inline read-only summary) ──────────────────────────────────
function QuoteDetail({ quoteId, onBack, setScreen }) {
  const [q, setQ] = useState(null)
  const [loading, setLoading] = useState(true)
  const { boutique } = useAuth()

  useEffect(() => {
    if (!quoteId) return
    setLoading(true)
    supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single()
      .then(({ data }) => { setQ(data); setLoading(false) })
  }, [quoteId])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray }}>
        Loading…
      </div>
    )
  }
  if (!q) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray }}>
        Quote not found.
      </div>
    )
  }

  const evtCfg = q.event_type ? (EVT_TYPES[q.event_type] || null) : null
  const lineItems = Array.isArray(q.line_items) ? q.line_items : []
  const subtotal = lineItems.reduce((s, li) => s + (Number(li.qty) || 1) * (Number(li.unit_price) || 0), 0)
  const total = Number(q.total) || subtotal
  const isExpired = q.expires_at && new Date(q.expires_at) < new Date()

  function fmtLong(iso) {
    if (!iso) return '—'
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.ivory }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between',
        padding: '14px 20px', background: C.white, borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>
            {q.quote_number || `Q-${q.id?.slice(0, 8)}`}
          </div>
          <StatusBadge status={q.status} cfg={QUOTE_STATUS} />
        </div>
        <PrimaryBtn
          label="Edit quote"
          onClick={() => {
            // Store the quoteId so QuoteBuilderPage can pre-fill the form for editing
            sessionStorage.setItem('belori_edit_quote_id', quoteId)
            setScreen('quote_builder')
          }}
          style={{ fontSize: 12, padding: '7px 14px' }}
        />
      </div>

      {/* Body */}
      <div className="page-scroll" style={{ flex: 1, overflow: 'auto', padding: '20px 16px 60px' }}>
        {/* Client + event card */}
        <div style={{
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: 16, marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <MiniAvatar name={q.client_name} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{q.client_name || 'Unknown client'}</div>
              {evtCfg && (
                <span style={{
                  fontSize: 11, padding: '2px 7px', borderRadius: 6,
                  background: evtCfg.bg || C.grayBg, color: evtCfg.col || C.gray,
                  fontWeight: 500, display: 'inline-block', marginTop: 3,
                }}>
                  {evtCfg.icon} {evtCfg.label}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12, color: C.gray, marginTop: 6 }}>
            {q.venue && <div><strong style={{ color: C.ink }}>Venue:</strong> {q.venue}</div>}
            {q.event_date && <div><strong style={{ color: C.ink }}>Event date:</strong> {fmtLong(q.event_date)}</div>}
            {q.expires_at && (
              <div style={{ color: isExpired ? C.red : C.gray }}>
                <strong style={{ color: isExpired ? C.red : C.ink }}>Expires:</strong> {fmtLong(q.expires_at)}
                {isExpired && ' (expired)'}
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        {lineItems.length > 0 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>Items</span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px',
              padding: '7px 16px', background: C.grayBg, borderBottom: `1px solid ${C.border}`,
            }}>
              {['Description', 'Qty', 'Unit price', 'Total'].map(h => (
                <span key={h} style={{ fontSize: 10, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {lineItems.map((li, idx) => {
              const lineTotal = (Number(li.qty) || 1) * (Number(li.unit_price) || 0)
              return (
                <div key={li.id || idx} style={{
                  display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px',
                  padding: '10px 16px',
                  borderBottom: idx < lineItems.length - 1 ? `1px solid ${C.border}` : 'none',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, color: C.ink }}>{li.description || '—'}</span>
                  <span style={{ fontSize: 13, color: C.ink }}>{li.qty ?? 1}</span>
                  <span style={{ fontSize: 13, color: C.ink }}>{fmtMoney(li.unit_price || 0)}</span>
                  <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{fmtMoney(lineTotal)}</span>
                </div>
              )
            })}
            {/* Total footer */}
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Total</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{fmtMoney(total)}</span>
            </div>
          </div>
        )}

        {/* Notes */}
        {q.notes && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: C.ink, marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6 }}>{q.notes}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function BillingScreen({ setScreen }) {
  const { boutique } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('invoices')
  const [detail, setDetail] = useState(null) // { type: 'invoice'|'quote', id: string } | null

  // ── Invoice state ─────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState([])
  const [invLoading, setInvLoading] = useState(true)
  const [invSearch, setInvSearch] = useState('')
  const [invStatus, setInvStatus] = useState('all')

  useEffect(() => {
    if (!boutique?.id || tab !== 'invoices') return
    setInvLoading(true)
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total_cents, paid_cents, created_at, sent_at, client:clients(id, name, phone), event:events(id, type)')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast('Failed to load invoices', 'error')
        setInvoices(data || [])
        setInvLoading(false)
      })
  }, [boutique?.id, tab])

  // ── Quote state ───────────────────────────────────────────────────────────
  const [quotes, setQuotes] = useState([])
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [quoteSearch, setQuoteSearch] = useState('')
  const [quoteStatus, setQuoteStatus] = useState('all')

  useEffect(() => {
    if (!boutique?.id || tab !== 'quotes') return
    setQuotesLoading(true)
    supabase
      .from('quotes')
      .select('id, quote_number, status, total, expires_at, created_at, client_name, event_type, event_date')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast('Failed to load quotes', 'error')
        setQuotes(data || [])
        setQuotesLoading(false)
      })
  }, [boutique?.id, tab])

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredInvoices = invoices.filter(inv => {
    const q = invSearch.toLowerCase()
    const matchSearch = !q ||
      (inv.client?.name || '').toLowerCase().includes(q) ||
      (inv.invoice_number || '').toLowerCase().includes(q)
    const matchStatus = invStatus === 'all' || inv.status === invStatus
    return matchSearch && matchStatus
  })

  const filteredQuotes = quotes.filter(q => {
    const s = quoteSearch.toLowerCase()
    const matchSearch = !s ||
      (q.client_name || '').toLowerCase().includes(s) ||
      (q.quote_number || '').toLowerCase().includes(s)
    const matchStatus = quoteStatus === 'all' || q.status === quoteStatus
    return matchSearch && matchStatus
  })

  // ─── Render detail view ────────────────────────────────────────────────────
  if (detail) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Back bar */}
        <div style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0, background: C.white,
        }}>
          <button
            onClick={() => setDetail(null)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.rosaText, fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4, padding: 0,
            }}
          >
            ← {detail.type === 'invoice' ? 'Invoices' : 'Quotes'}
          </button>
        </div>

        {detail.type === 'invoice' && (
          <InvoiceDetailScreen
            invoiceId={detail.id}
            setScreen={setScreen}
            onBack={() => setDetail(null)}
          />
        )}
        {detail.type === 'quote' && (
          <QuoteDetail
            quoteId={detail.id}
            onBack={() => setDetail(null)}
            setScreen={setScreen}
          />
        )}
      </div>
    )
  }

  // ─── List view ────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.ivory }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', background: C.white, borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink }}>Billing</h1>
        <PrimaryBtn
          label={tab === 'invoices' ? '+ New invoice' : '+ New quote'}
          onClick={() => setScreen(tab === 'invoices' ? 'invoice_create' : 'quote_builder')}
        />
      </div>

      {/* ── Tab strip ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, padding: '10px 16px 0',
        background: C.white, borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        {[
          { key: 'invoices', label: 'Invoices' },
          { key: 'quotes',   label: 'Quotes' },
        ].map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? C.ink : C.gray,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: active ? `2px solid ${C.ink}` : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.12s, border-color 0.12s',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 16px', background: C.white, borderBottom: `1px solid ${C.border}`,
        flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <input
          type="text"
          placeholder={tab === 'invoices'
            ? 'Search by client name or invoice #'
            : 'Search by client name or quote #'}
          value={tab === 'invoices' ? invSearch : quoteSearch}
          onChange={e => tab === 'invoices' ? setInvSearch(e.target.value) : setQuoteSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${C.border}`, fontSize: 13, color: C.ink,
            boxSizing: 'border-box', outline: 'none', background: C.white,
          }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(tab === 'invoices' ? INV_FILTERS : QUOTE_FILTERS).map(f => (
            <FilterPill
              key={f.key}
              label={f.label}
              active={(tab === 'invoices' ? invStatus : quoteStatus) === f.key}
              onClick={() => tab === 'invoices' ? setInvStatus(f.key) : setQuoteStatus(f.key)}
            />
          ))}
        </div>
      </div>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      <div className="page-scroll" style={{ flex: 1, overflow: 'auto', background: C.white }}>
        {tab === 'invoices' ? (
          invLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: C.gray, fontSize: 13 }}>
              Loading…
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32 }}>🧾</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
                {invoices.length === 0 ? 'No invoices yet' : 'No results'}
              </div>
              <div style={{ fontSize: 12, color: C.gray }}>
                {invoices.length === 0 ? 'Create your first invoice to get started.' : 'Try adjusting your search or filters.'}
              </div>
              {invoices.length === 0 && (
                <PrimaryBtn label="+ New invoice" onClick={() => setScreen('invoice_create')} />
              )}
            </div>
          ) : (
            <>
              <ColHeader cols={{
                template: '2fr 1.2fr 90px 110px 100px',
                labels: ['Client', 'Invoice #', 'Date', 'Amount', 'Status'],
              }} />
              {filteredInvoices.map(inv => (
                <InvoiceRow
                  key={inv.id}
                  inv={inv}
                  onClick={() => setDetail({ type: 'invoice', id: inv.id })}
                />
              ))}
            </>
          )
        ) : (
          quotesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: C.gray, fontSize: 13 }}>
              Loading…
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
                {quotes.length === 0 ? 'No quotes yet' : 'No results'}
              </div>
              <div style={{ fontSize: 12, color: C.gray }}>
                {quotes.length === 0 ? 'Create a quote to send to a client.' : 'Try adjusting your search or filters.'}
              </div>
              {quotes.length === 0 && (
                <PrimaryBtn label="+ New quote" onClick={() => setScreen('quote_builder')} />
              )}
            </div>
          ) : (
            <>
              <ColHeader cols={{
                template: '2fr 1.2fr 110px 110px 100px 90px',
                labels: ['Client', 'Quote #', 'Event', 'Expires', 'Total', 'Status'],
              }} />
              {filteredQuotes.map(q => (
                <QuoteRow
                  key={q.id}
                  q={q}
                  onClick={() => setDetail({ type: 'quote', id: q.id })}
                />
              ))}
            </>
          )
        )}
      </div>
    </div>
  )
}
