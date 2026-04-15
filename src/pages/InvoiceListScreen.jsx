import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { C, EVT_TYPES, pct } from '../lib/colors'
import { PrimaryBtn, Avatar } from '../lib/ui.jsx'
import { fmtCents } from '../lib/invoiceItems'
import { useAuth } from '../context/AuthContext'
import InvoiceDetailScreen from './InvoiceDetailScreen'

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  draft:          { bg: C.grayBg,  color: C.gray,  label: 'Draft' },
  sent:           { bg: C.blueBg,  color: C.blue,  label: 'Sent' },
  partially_paid: { bg: C.amberBg, color: C.amber, label: 'Partial' },
  paid:           { bg: C.greenBg, color: C.green, label: 'Paid' },
  cancelled:      { bg: C.redBg,   color: C.red,   label: 'Cancelled' },
}

const STATUS_FILTERS = [
  { key: 'all',           label: 'All' },
  { key: 'draft',         label: 'Draft' },
  { key: 'sent',          label: 'Sent' },
  { key: 'partially_paid', label: 'Partial' },
  { key: 'paid',          label: 'Paid' },
  { key: 'cancelled',     label: 'Cancelled' },
]

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { bg: C.grayBg, color: C.gray, label: status }
  return (
    <span style={{
      fontSize: 10, padding: '3px 8px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function InvoiceCard({ inv, onClick }) {
  const [hovered, setHovered] = useState(false)
  const clientName = inv.client?.name || 'Unknown'
  const clientPhone = inv.client?.phone || ''

  const initials = clientName
    .split(' ')
    .map(w => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const evtCfg = inv.event ? (EVT_TYPES[inv.event.type] || null) : null
  const paidPct = pct(inv.paid_cents || 0, inv.total_cents || 1)

  const createdDate = inv.created_at
    ? new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px',
        cursor: 'pointer', background: hovered ? C.grayBg : C.white,
        transition: 'background 0.15s',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      {/* Row 1: Invoice number + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>
          {inv.invoice_number || `INV-${inv.id?.slice(0, 8)}`}
        </span>
        <StatusBadge status={inv.status} />
      </div>

      {/* Row 2: Client avatar + name + phone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar initials={initials} size={26} bg={C.rosaPale} color={C.rosaText} />
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{clientName}</span>
          {clientPhone && (
            <span style={{ fontSize: 12, color: C.gray, marginLeft: 6 }}>{clientPhone}</span>
          )}
        </div>
      </div>

      {/* Row 3: Event badge */}
      {evtCfg && (
        <div>
          <span style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 6,
            background: evtCfg.bg || C.grayBg, color: evtCfg.col || C.gray,
            fontWeight: 500, display: 'inline-block',
          }}>
            {evtCfg.icon} {evtCfg.label}
          </span>
        </div>
      )}

      {/* Row 4: Amount breakdown + progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: C.green }}>
            {fmtCents(inv.paid_cents || 0)} paid
          </span>
          <span style={{ fontSize: 12, color: C.gray }}>
            {fmtCents(inv.total_cents || 0)} total
          </span>
        </div>
        <div style={{ height: 4, background: C.grayBg, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, paidPct)}%`,
            background: C.green,
            borderRadius: 2,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Created date */}
      <div style={{ fontSize: 11, color: C.gray }}>{createdDate}</div>
    </div>
  )
}

export default function InvoiceListScreen({ setScreen }) {
  const { boutique } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [phoneSearch, setPhoneSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total_cents, paid_cents, created_at, client:clients(id, name, phone), event:events(id, type)')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })
    setInvoices(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [boutique?.id])

  // If a specific invoice is selected, show its detail screen
  if (selectedInvoice) {
    return (
      <InvoiceDetailScreen
        invoiceId={selectedInvoice}
        setScreen={setScreen}
        onBack={() => setSelectedInvoice(null)}
      />
    )
  }

  // Filter logic
  const digits = phoneSearch.replace(/\D/g, '')
  const filtered = invoices.filter(inv => {
    const matchPhone = !digits || (inv.client?.phone || '').replace(/\D/g, '').includes(digits)
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter
    return matchPhone && matchStatus
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.ivory }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', background: C.white, borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink }}>
          Invoices / Facturas
        </h1>
        <PrimaryBtn
          label="+ New invoice / Nueva factura"
          onClick={() => setScreen('invoice_create')}
        />
      </div>

      {/* ── Search + filter bar ───────────────────────────────────────────── */}
      <div style={{
        padding: '12px 16px', background: C.white, borderBottom: `1px solid ${C.border}`,
        flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Phone search */}
        <input
          type="tel"
          placeholder="Search by phone / Buscar por teléfono"
          value={phoneSearch}
          onChange={e => setPhoneSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${C.border}`, fontSize: 13, color: C.ink,
            boxSizing: 'border-box', outline: 'none', background: C.white,
          }}
        />

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => {
            const active = statusFilter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                style={{
                  padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                  border: `1px solid ${active ? C.rosa : C.border}`,
                  background: active ? C.rosaPale : C.white,
                  color: active ? C.rosaText : C.gray,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Invoice list ──────────────────────────────────────────────────── */}
      <div className="page-scroll" style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: C.gray }}>
            Loading… / Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 24px', textAlign: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 40 }}>🧾</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>
              {invoices.length === 0
                ? 'No invoices yet / Aún no hay facturas'
                : 'No results / Sin resultados'}
            </div>
            {invoices.length === 0 && (
              <PrimaryBtn
                label="Create first invoice / Crear primera factura"
                onClick={() => setScreen('invoice_create')}
              />
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(inv => (
              <InvoiceCard
                key={inv.id}
                inv={inv}
                onClick={() => setSelectedInvoice(inv.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
