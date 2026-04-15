import React, { useState } from 'react'
import { C } from '../../lib/colors'
import { PrimaryBtn, GhostBtn, inputSt, LBL, useToast } from '../../lib/ui.jsx'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtCents } from '../../lib/invoiceItems'

// ─── PAYMENT METHOD CONFIG ──────────────────────────────────────────────────
const METHODS = [
  {
    id: 'card',
    icon: '💳',
    label: 'Credit / Debit Card',
    labelEs: 'Tarjeta de crédito / débito',
    sub: 'Swipe or insert card',
    color: '#6B46B0',
    bgColor: '#F5F3FF',
  },
  {
    id: 'zelle',
    icon: '⚡',
    label: 'Zelle',
    labelEs: 'Zelle',
    sub: 'Record Zelle transfer',
    color: '#1D4ED8',
    bgColor: '#DBEAFE',
  },
  {
    id: 'cash',
    icon: '💵',
    label: 'Cash',
    labelEs: 'Efectivo',
    sub: 'Enter amount received',
    color: '#0B8562',
    bgColor: '#F0FDF4',
  },
]

// ─── STEP DOTS ───────────────────────────────────────────────────────────────
function StepDots({ step, total = 3 }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i + 1 === step ? 16 : 7,
            height: 7,
            borderRadius: 4,
            background: i + 1 === step ? C.rosa : C.border,
            transition: 'all 0.2s',
          }}
        />
      ))}
    </div>
  )
}

// ─── AMOUNT CARD ─────────────────────────────────────────────────────────────
function AmountCard({ selected, onClick, children, style = {} }) {
  return (
    <div
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      style={{
        border: `2px solid ${selected ? C.rosaText : C.border}`,
        background: selected ? C.rosaPale : C.white,
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'all 0.15s',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── METHOD CARD ─────────────────────────────────────────────────────────────
function MethodCard({ method, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      style={{
        border: `2px solid ${selected ? method.color : C.border}`,
        background: selected ? method.bgColor : C.white,
        boxShadow: selected ? `0 4px 16px ${method.color}28` : 'none',
        borderRadius: 12,
        padding: '18px 14px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 8, lineHeight: 1 }}>{method.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: selected ? method.color : C.ink, marginBottom: 2 }}>
        {method.label}
      </div>
      <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.3 }}>{method.labelEs}</div>
      <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{method.sub}</div>
    </div>
  )
}

// ─── INFO BOX ────────────────────────────────────────────────────────────────
function InfoBox({ children, style = {} }) {
  return (
    <div
      style={{
        background: C.blueBg,
        border: `1px solid ${C.infoBorder || '#BFDBFE'}`,
        borderRadius: 10,
        padding: '12px 14px',
        fontSize: 13,
        color: C.infoText || '#1E40AF',
        lineHeight: 1.5,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function RecordPaymentModal({ invoice, onPaymentRecorded, onClose }) {
  const { boutique } = useAuth()
  const toast = useToast()

  const balance = invoice.total_cents - invoice.paid_cents

  const [step, setStep] = useState(1)
  const [amountCents, setAmountCents] = useState(balance)
  const [useCustomAmount, setUseCustomAmount] = useState(false)
  const [customAmountStr, setCustomAmountStr] = useState('')
  const [method, setMethod] = useState(null)
  const [zelleRef, setZelleRef] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // ── Derived ───────────────────────────────────────────────────────────────
  const parsedCash = cashReceived ? Math.round(parseFloat(cashReceived) * 100) : 0
  const changeDue = parsedCash - amountCents
  const selectedMethod = METHODS.find((m) => m.id === method)

  function handleCustomAmountChange(val) {
    setCustomAmountStr(val)
    const parsed = parseFloat(val.replace(/[^0-9.]/g, ''))
    setAmountCents(isNaN(parsed) ? 0 : Math.round(parsed * 100))
  }

  function handleSelectFullBalance() {
    setUseCustomAmount(false)
    setAmountCents(balance)
    setCustomAmountStr('')
  }

  function handleSelectCustom() {
    setUseCustomAmount(true)
    setAmountCents(0)
  }

  // ── Record payment ────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!method || amountCents <= 0) return
    setSaving(true)
    try {
      await supabase.from('invoice_payments').insert({
        boutique_id: boutique.id,
        invoice_id: invoice.id,
        amount_cents: amountCents,
        method,
        reference: method === 'zelle' ? zelleRef || null : null,
        recorded_by_name: null,
      })

      const { data: fresh } = await supabase
        .from('invoices')
        .select('paid_cents, total_cents')
        .eq('id', invoice.id)
        .single()

      const newPaid = (fresh.paid_cents || 0) + amountCents
      const newStatus = newPaid >= fresh.total_cents ? 'paid' : 'partially_paid'

      await supabase
        .from('invoices')
        .update({ paid_cents: newPaid, status: newStatus })
        .eq('id', invoice.id)

      setSuccess(true)
    } catch (err) {
      toast('Error recording payment — try again', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── SMS receipt ───────────────────────────────────────────────────────────
  async function handleSendReceipt() {
    if (!invoice.client?.phone) return
    supabase.functions
      .invoke('send-sms', {
        body: {
          to: invoice.client.phone,
          message: `Hola, recibimos tu pago de ${fmtCents(amountCents)} para tu factura. Gracias! Reply STOP to opt out.`,
        },
      })
      .catch(() => {})
    toast('Receipt SMS sent')
  }

  // ── Step 1 validity ───────────────────────────────────────────────────────
  const step1Valid = !useCustomAmount || amountCents > 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rpay-title"
        style={{
          background: C.white,
          borderRadius: 16,
          width: 460,
          maxWidth: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* ── HEADER ────────────────────────────────────────────────────── */}
        {!success && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: `1px solid ${C.border}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                id="rpay-title"
                style={{ fontWeight: 700, fontSize: 15, color: C.ink, lineHeight: 1 }}
              >
                Record payment{' '}
                <span style={{ color: C.gray, fontWeight: 400 }}>/ Registrar pago</span>
              </div>
              <StepDots step={step} />
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                fontSize: 20,
                color: C.gray,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* ── BODY ──────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>

          {/* ── SUCCESS STATE ─────────────────────────────────────────── */}
          {success && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
              {/* Checkmark */}
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: C.greenBg,
                  color: C.green,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                ✓
              </div>

              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
                  Payment recorded ✓
                </div>
                <div style={{ fontSize: 13, color: C.gray }}>Pago registrado ✓</div>
              </div>

              {/* Payment summary */}
              <div
                style={{
                  background: C.grayBg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 22 }}>{selectedMethod?.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>
                    {fmtCents(amountCents)}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray }}>
                    {selectedMethod?.label} / {selectedMethod?.labelEs}
                  </div>
                </div>
              </div>

              {/* SMS receipt button */}
              {invoice.client?.phone && (
                <GhostBtn
                  label="Send receipt via SMS / Enviar recibo por SMS"
                  onClick={handleSendReceipt}
                  style={{ width: '100%' }}
                />
              )}

              {/* Done button */}
              <PrimaryBtn
                label="Done / Listo"
                onClick={onPaymentRecorded}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* ── STEP 1: CHOOSE AMOUNT ──────────────────────────────────── */}
          {!success && step === 1 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
                How much to record?
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 20 }}>
                ¿Cuánto registrar?
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Card A — Full balance */}
                <AmountCard
                  selected={!useCustomAmount}
                  onClick={handleSelectFullBalance}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                        Pay full balance
                      </div>
                      <div style={{ fontSize: 12, color: C.gray }}>Saldo total</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: !useCustomAmount ? C.rosaText : C.ink }}>
                      {fmtCents(balance)}
                    </div>
                  </div>
                </AmountCard>

                {/* Card B — Custom amount */}
                <AmountCard
                  selected={useCustomAmount}
                  onClick={handleSelectCustom}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                      Custom amount
                    </div>
                    <div style={{ fontSize: 12, color: C.gray, marginBottom: useCustomAmount ? 12 : 0 }}>
                      Monto personalizado
                    </div>

                    {useCustomAmount && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <label htmlFor="rpm-custom-amount" style={LBL}>Amount / Monto</label>
                        <div style={{ position: 'relative' }}>
                          <span
                            style={{
                              position: 'absolute',
                              left: 10,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: 14,
                              color: C.gray,
                              pointerEvents: 'none',
                            }}
                          >
                            $
                          </span>
                          <input
                            id="rpm-custom-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={customAmountStr}
                            onChange={(e) => handleCustomAmountChange(e.target.value)}
                            autoFocus
                            style={{ ...inputSt, paddingLeft: 22, fontSize: 15, fontWeight: 600 }}
                          />
                        </div>
                        {amountCents > balance && (
                          <div style={{ fontSize: 11, color: C.amber, marginTop: 4 }}>
                            Exceeds remaining balance of {fmtCents(balance)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </AmountCard>
              </div>
            </div>
          )}

          {/* ── STEP 2: CHOOSE METHOD ──────────────────────────────────── */}
          {!success && step === 2 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
                How was payment made?
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 20 }}>
                ¿Cómo se realizó el pago?
              </div>

              <div
                role="radiogroup"
                aria-label="Payment method"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}
              >
                {METHODS.map((m) => (
                  <MethodCard
                    key={m.id}
                    method={m}
                    selected={method === m.id}
                    onClick={() => setMethod(m.id)}
                  />
                ))}
              </div>

              {/* Selected method summary */}
              {method && (
                <div
                  style={{
                    marginTop: 16,
                    padding: '10px 14px',
                    background: C.grayBg,
                    borderRadius: 8,
                    fontSize: 12,
                    color: C.gray,
                    textAlign: 'center',
                  }}
                >
                  Recording{' '}
                  <strong style={{ color: C.ink }}>{fmtCents(amountCents)}</strong>{' '}
                  via <strong style={{ color: C.ink }}>{selectedMethod?.label}</strong>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: CONFIRM ───────────────────────────────────────── */}
          {!success && step === 3 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
                Confirm payment details
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 20 }}>
                Confirmar detalles del pago
              </div>

              {/* Amount recap pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: C.grayBg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 20,
                }}
              >
                <span style={{ fontSize: 20 }}>{selectedMethod?.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>
                    {fmtCents(amountCents)}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray }}>
                    {selectedMethod?.label} / {selectedMethod?.labelEs}
                  </div>
                </div>
              </div>

              {/* ── CARD method ── */}
              {method === 'card' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <InfoBox>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Swipe card now on the terminal
                    </div>
                    <div style={{ fontSize: 12 }}>Deslice la tarjeta ahora en el terminal</div>
                  </InfoBox>
                  <div
                    style={{
                      background: C.grayBg,
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 12,
                      color: C.gray,
                      lineHeight: 1.5,
                    }}
                  >
                    Card processing happens on the Square terminal. This just records the payment in Belori.
                    <br />
                    <span style={{ fontSize: 11 }}>
                      El procesamiento ocurre en el terminal Square. Esto solo registra el pago en Belori.
                    </span>
                  </div>
                </div>
              )}

              {/* ── ZELLE method ── */}
              {method === 'zelle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {boutique?.zelle_handle && (
                    <InfoBox>
                      <div style={{ fontSize: 12 }}>
                        Boutique Zelle: <strong>{boutique.zelle_handle}</strong>
                      </div>
                    </InfoBox>
                  )}
                  <div>
                    <label htmlFor="rpm-zelle-ref" style={LBL}>
                      Zelle confirmation # (optional) / Confirmación Zelle (opcional)
                    </label>
                    <input
                      id="rpm-zelle-ref"
                      type="text"
                      placeholder="e.g. ZLL-8472819"
                      value={zelleRef}
                      onChange={(e) => setZelleRef(e.target.value)}
                      style={inputSt}
                    />
                  </div>
                </div>
              )}

              {/* ── CASH method ── */}
              {method === 'cash' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label htmlFor="rpm-cash-received" style={LBL}>Cash received / Efectivo recibido</label>
                    <div style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: 14,
                          color: C.gray,
                          pointerEvents: 'none',
                        }}
                      >
                        $
                      </span>
                      <input
                        id="rpm-cash-received"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        autoFocus
                        style={{ ...inputSt, paddingLeft: 22, fontSize: 15, fontWeight: 600 }}
                      />
                    </div>
                  </div>

                  {parsedCash > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: changeDue >= 0 ? C.greenBg : C.redBg,
                        border: `1px solid ${changeDue >= 0 ? '#BBF7D0' : '#FECACA'}`,
                        borderRadius: 8,
                        padding: '10px 14px',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: changeDue >= 0 ? C.green : C.red,
                            marginBottom: 2,
                          }}
                        >
                          {changeDue >= 0 ? 'Change due / Cambio' : 'Short / Falta'}
                        </div>
                        {changeDue < 0 && (
                          <div style={{ fontSize: 11, color: C.red }}>
                            Amount entered is less than payment
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: changeDue >= 0 ? C.green : C.red,
                        }}
                      >
                        {fmtCents(Math.abs(changeDue))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        {!success && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderTop: `1px solid ${C.border}`,
              flexShrink: 0,
              gap: 10,
            }}
          >
            {/* Back button — hidden on step 1 */}
            {step > 1 ? (
              <GhostBtn
                label="Back / Atrás"
                onClick={() => setStep((s) => s - 1)}
                disabled={saving}
              />
            ) : (
              <div /> /* spacer */
            )}

            {/* Step 1 → 2 */}
            {step === 1 && (
              <PrimaryBtn
                label="Continue / Continuar"
                onClick={() => setStep(2)}
                disabled={!step1Valid}
              />
            )}

            {/* Step 2 → 3 */}
            {step === 2 && (
              <PrimaryBtn
                label="Continue / Continuar"
                onClick={() => setStep(3)}
                disabled={!method}
              />
            )}

            {/* Step 3 → Confirm */}
            {step === 3 && method === 'card' && (
              <PrimaryBtn
                label={saving ? 'Recording…' : 'Payment received — Record / Pago recibido — Registrar'}
                onClick={handleConfirm}
                disabled={saving || amountCents <= 0}
              />
            )}

            {step === 3 && method === 'zelle' && (
              <PrimaryBtn
                label={saving ? 'Recording…' : 'Record Zelle payment / Registrar pago Zelle'}
                onClick={handleConfirm}
                disabled={saving || amountCents <= 0}
              />
            )}

            {step === 3 && method === 'cash' && (
              <PrimaryBtn
                label={saving ? 'Recording…' : 'Record cash payment / Registrar pago en efectivo'}
                onClick={handleConfirm}
                disabled={saving || amountCents <= 0}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
