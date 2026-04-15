import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { C, EVT_TYPES } from '../lib/colors'
import { PrimaryBtn, GhostBtn, Avatar, inputSt } from '../lib/ui.jsx'
import { fmtCents } from '../lib/invoiceItems'
import { useToast } from '../lib/ui.jsx'
import RecordPaymentModal from '../components/invoices/RecordPaymentModal'

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  draft:          { bg: C.grayBg,   color: C.gray,     label: 'Draft / Borrador' },
  sent:           { bg: C.blueBg,   color: C.blue,     label: 'Sent / Enviado' },
  partially_paid: { bg: C.amberBg,  color: C.amber,    label: 'Partially paid / Pago parcial' },
  paid:           { bg: C.greenBg,  color: C.green,    label: 'Paid / Pagado' },
  cancelled:      { bg: C.redBg,    color: C.red,      label: 'Cancelled / Cancelado' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { bg: C.grayBg, color: C.gray, label: status }
  return (
    <span style={{
      fontSize: 11, padding: '4px 10px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

// ─── Payment schedule pill ────────────────────────────────────────────────────
function SchedulePill({ status, due_date }) {
  const today = new Date()
  const due = due_date ? new Date(due_date) : null
  let bg = C.amberBg, color = C.amber, label = 'Pending / Pendiente'
  if (status === 'paid') { bg = C.greenBg; color = C.green; label = 'Paid / Pagado' }
  else if (due && due < today) { bg = C.redBg; color = C.red; label = 'Overdue / Vencido' }
  return (
    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: bg, color, fontWeight: 600 }}>
      {label}
    </span>
  )
}

// ─── Method icons ─────────────────────────────────────────────────────────────
function methodIcon(method) {
  if (!method) return '💵'
  const m = method.toLowerCase()
  if (m.includes('card') || m.includes('credit') || m.includes('debit')) return '💳'
  if (m.includes('cash')) return '💵'
  if (m.includes('zelle') || m.includes('venmo') || m.includes('paypal') || m.includes('transfer')) return '⚡'
  return '💵'
}

// ─── Separator ────────────────────────────────────────────────────────────────
const Divider = () => (
  <div style={{ borderTop: `1px solid ${C.border}`, margin: '0' }} />
)

// ─── Three-dot menu ───────────────────────────────────────────────────────────
function ThreeDotMenu({ onReminder, onCancel, onPrint }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="More options"
        style={{
          background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
          width: 36, height: 36, cursor: 'pointer', fontSize: 18, color: C.gray,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ⋯
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 42, right: 0, zIndex: 200,
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 220, overflow: 'hidden',
        }}>
          {[
            { label: 'Send reminder / Enviar recordatorio', onClick: () => { onReminder(); setOpen(false) } },
            { label: 'Cancel invoice / Cancelar factura', onClick: () => { onCancel(); setOpen(false) }, danger: true },
            { label: 'Print / Imprimir', onClick: () => { window.print(); setOpen(false) } },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.onClick}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '11px 16px', background: 'none', border: 'none',
                fontSize: 13, cursor: 'pointer', color: item.danger ? C.red : C.ink,
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Cancel confirm banner ────────────────────────────────────────────────────
function CancelConfirmBanner({ onConfirm, onDismiss, loading }) {
  return (
    <div style={{
      border: `1px solid ${C.red}`, borderRadius: 10, padding: '14px 16px',
      background: C.redBg, margin: '0 0 16px',
    }}>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: C.red, fontWeight: 500 }}>
        Cancel this invoice? / Cancelar esta factura?
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.red }}>
        This cannot be undone. / Esto no se puede deshacer.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <PrimaryBtn
          label={loading ? 'Cancelling…' : 'Yes, cancel / Sí, cancelar'}
          onClick={onConfirm}
          disabled={loading}
          style={{ background: C.red, fontSize: 12 }}
        />
        <GhostBtn label="No, keep / No, mantener" onClick={onDismiss} style={{ fontSize: 12 }} />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function InvoiceDetailScreen({ invoiceId, setScreen, onBack }) {
  const [inv, setInv] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const toast = useToast()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(id, name, phone, email),
        event:events(id, type, event_date),
        items:invoice_items(*),
        schedule:invoice_payment_schedule(*),
        payments:invoice_payments(*),
        attachments:invoice_attachments(*),
        card_on_file:client_cards_on_file(*)
      `)
      .eq('id', invoiceId)
      .single()
    setInv(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [invoiceId])

  async function sendReminder() {
    if (!inv?.client?.phone) { toast('No phone number on file'); return }
    const firstName = (inv.client.name || 'there').split(' ')[0]
    try {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: inv.client.phone,
          message: `Hola ${firstName}, aquí está el recordatorio de tu factura ${inv.invoice_number}. Saldo pendiente: ${fmtCents((inv.total_cents || 0) - (inv.paid_cents || 0))}. Reply STOP to opt out.`,
        },
      })
      toast('Reminder sent / Recordatorio enviado')
    } catch {
      toast('Failed to send reminder')
    }
  }

  async function cancelInvoice() {
    setCancelling(true)
    await supabase
      .from('invoices')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', inv.id)
    setShowCancelConfirm(false)
    setCancelling(false)
    load()
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray }}>
        Loading…
      </div>
    )
  }

  if (!inv) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray }}>
        Invoice not found.
      </div>
    )
  }

  const items = (inv.items || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const schedule = inv.schedule || []
  const payments = inv.payments || []
  const attachments = inv.attachments || []
  const cards = inv.card_on_file || []

  const subtotal = items.reduce((s, i) => s + (i.line_total_cents || 0), 0)
  const ccFee = inv.include_tax ? Math.round(subtotal * 0.03) : 0
  const total = inv.total_cents || 0
  const paid = inv.paid_cents || 0
  const balance = total - paid

  const clientInitials = (inv.client?.name || '?')
    .split(' ')
    .map(w => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const evtCfg = inv.event ? (EVT_TYPES[inv.event.type] || { label: inv.event.type, icon: '📅' }) : null
  const eventDate = inv.event?.event_date
    ? new Date(inv.event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const canPay = inv.status !== 'paid' && inv.status !== 'cancelled'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.ivory }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 20px', background: C.white, borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack || (() => setScreen('invoices'))}
          aria-label="Back to Invoices"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: C.rosaText, fontWeight: 500, padding: '4px 0',
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}
        >
          ← Invoices / Facturas
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15, color: C.ink }}>
          {inv.invoice_number || `INV-${inv.id?.slice(0, 8)}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <StatusBadge status={inv.status} />
          <ThreeDotMenu
            onReminder={sendReminder}
            onCancel={() => setShowCancelConfirm(true)}
            onPrint={() => window.print()}
          />
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────────── */}
      <div className="page-scroll" style={{ flex: 1, overflow: 'auto', padding: '20px 16px 120px' }}>

        {/* Cancel confirm banner */}
        {showCancelConfirm && (
          <CancelConfirmBanner
            onConfirm={cancelInvoice}
            onDismiss={() => setShowCancelConfirm(false)}
            loading={cancelling}
          />
        )}

        {/* ── Client + event card ──────────────────────────────────────────── */}
        <div style={{
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '16px', marginBottom: 12, display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <Avatar initials={clientInitials} size={48} bg={C.rosaPale} color={C.rosaText} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.ink, marginBottom: 2 }}>
              {inv.client?.name || 'Unknown client'}
            </div>
            {inv.client?.phone && (
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 1 }}>{inv.client.phone}</div>
            )}
            {inv.client?.email && (
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 4 }}>{inv.client.email}</div>
            )}
            {evtCfg && (
              <span style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 6,
                background: evtCfg.bg || C.grayBg, color: evtCfg.col || C.gray,
                fontWeight: 500, display: 'inline-block',
              }}>
                {evtCfg.icon} {evtCfg.label}{eventDate ? ` · ${eventDate}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Line items ───────────────────────────────────────────────────── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>Items / Artículos</span>
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 60px 80px 80px',
            padding: '8px 16px', background: C.grayBg,
            borderBottom: `1px solid ${C.border}`,
          }}>
            {['Item', 'Artículo', 'Qty', 'Price', 'Total'].map(h => (
              <span key={h} style={{ fontSize: 10, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {items.length === 0 && (
            <div style={{ padding: '16px', fontSize: 13, color: C.gray, textAlign: 'center' }}>
              No items / Sin artículos
            </div>
          )}
          {items.map((item, idx) => (
            <div key={item.id || idx} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 60px 80px 80px',
              padding: '10px 16px', borderBottom: idx < items.length - 1 ? `1px solid ${C.border}` : 'none',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{item.item_name || '—'}</span>
              <span style={{ fontSize: 12, color: C.gray }}>{item.item_name_es || '—'}</span>
              <span style={{ fontSize: 13, color: C.ink }}>{item.quantity ?? 1}</span>
              <span style={{ fontSize: 13, color: C.ink }}>{fmtCents(item.unit_price_cents || 0)}</span>
              <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{fmtCents(item.line_total_cents || 0)}</span>
            </div>
          ))}

          {/* Totals footer */}
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: C.gray }}>Subtotal</span>
              <span style={{ fontSize: 13, color: C.ink }}>{fmtCents(subtotal)}</span>
            </div>
            {inv.include_tax && ccFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>Credit card fee (3%) / Cargo tarjeta (3%)</span>
                <span style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>{fmtCents(ccFee)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Total</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{fmtCents(total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: C.green }}>Paid / Pagado</span>
              <span style={{ fontSize: 13, color: C.green }}>{fmtCents(paid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: balance > 0 ? C.rosaText : C.green }}>
                Balance due / Saldo pendiente
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: balance > 0 ? C.rosaText : C.green }}>
                {fmtCents(balance)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Payment schedule ─────────────────────────────────────────────── */}
        {schedule.length > 0 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>Payment Schedule / Plan de pagos</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {schedule.map((row, idx) => {
                const dueFormatted = row.due_date
                  ? new Date(row.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—'
                return (
                  <div key={row.id || idx} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 16px', borderBottom: idx < schedule.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{row.label || `Payment ${idx + 1}`}</div>
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{dueFormatted}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{fmtCents(row.amount_cents || 0)}</span>
                    <SchedulePill status={row.status} due_date={row.due_date} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Payment history ──────────────────────────────────────────────── */}
        {payments.length > 0 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>Payment History / Historial de pagos</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {payments.map((p, idx) => {
                const dateStr = p.recorded_at
                  ? new Date(p.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—'
                return (
                  <div key={p.id || idx} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 16px', borderBottom: idx < payments.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <span style={{ fontSize: 18 }}>{methodIcon(p.method)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>
                        {p.method || 'Payment'}
                      </div>
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
                        {dateStr}{p.recorded_by_name ? ` · ${p.recorded_by_name}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>{fmtCents(p.amount_cents || 0)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Attachments ──────────────────────────────────────────────────── */}
        {attachments.length > 0 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>Order form / Formulario de pedido</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {attachments.map((att, idx) => (
                <a
                  key={att.id || idx}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={att.file_name || `Attachment ${idx + 1}`}
                  style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}
                >
                  <img
                    src={att.url}
                    alt={att.file_name || `Attachment ${idx + 1}`}
                    style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Card on file ─────────────────────────────────────────────────── */}
        {cards.length > 0 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>Card on file / Tarjeta en archivo</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cards.map((card, idx) => (
                <div key={card.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>💳</span>
                  <span style={{ fontSize: 14, color: C.ink, fontWeight: 500, letterSpacing: '0.08em' }}>
                    {`•••• •••• •••• ${card.last_four || '????'}`}
                  </span>
                  {card.brand && (
                    <span style={{ fontSize: 12, color: C.gray, marginLeft: 4 }}>{card.brand}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky action bar ────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', bottom: 0, background: C.white,
        borderTop: `1px solid ${C.border}`, padding: '12px 16px',
        display: 'flex', gap: 10, flexShrink: 0,
      }}>
        <GhostBtn
          label="Send reminder / Recordatorio"
          onClick={sendReminder}
          style={{ flex: 1 }}
        />
        {canPay && (
          <PrimaryBtn
            label="Add payment / Agregar pago"
            onClick={() => setShowPaymentModal(true)}
            style={{ flex: 1 }}
          />
        )}
      </div>

      {/* ── RecordPaymentModal ───────────────────────────────────────────────── */}
      {showPaymentModal && (
        <RecordPaymentModal
          invoice={inv}
          onClose={() => setShowPaymentModal(false)}
          onPaymentRecorded={() => { setShowPaymentModal(false); load() }}
        />
      )}
    </div>
  )
}
