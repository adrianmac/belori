import React, { useState, useEffect, useCallback } from 'react'
import { C } from '../lib/colors'
import { PrimaryBtn, GhostBtn, inputSt, LBL, useToast } from '../lib/ui.jsx'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import AppointmentScheduler from '../components/appointments/AppointmentScheduler'

// ─── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'greet',
    icon: '👋',
    en: 'Greet the client and fill out the order form',
    es: 'Saluda al cliente y completa el formulario de pedido',
  },
  {
    id: 'listen',
    icon: '👂',
    en: 'Listen to their needs — ask about their vision and color scheme',
    es: 'Escucha sus necesidades — pregunta sobre su visión y paleta de colores',
  },
  {
    id: 'tryon',
    icon: '👗',
    en: 'Have them try on 3–4 available dresses',
    es: 'Haz que prueben 3 a 4 vestidos disponibles',
  },
  {
    id: 'record_dress',
    icon: '📝',
    en: 'Write the chosen dress style on the order form',
    es: 'Anota el estilo del vestido elegido en el formulario de pedido',
  },
  {
    id: 'check_avail',
    icon: '🔍',
    en: 'Check dress availability in Belori',
    es: 'Verifica disponibilidad del vestido en Belori',
  },
  {
    id: 'create_invoice',
    icon: '🧾',
    en: 'Create an invoice',
    es: 'Crea una factura',
  },
  {
    id: 'take_deposit',
    icon: '💳',
    en: 'Take payment (deposit)',
    es: 'Toma el pago (depósito)',
  },
  {
    id: 'record_deposit',
    icon: '📋',
    en: 'Write the deposit amount on the hard copy order form',
    es: 'Anota el monto del depósito en el formulario físico',
  },
  {
    id: 'sched_fitting',
    icon: '✂️',
    en: 'Schedule the fitting — Monday of the event week',
    es: 'Programa la prueba — el lunes de la semana del evento',
  },
  {
    id: 'sched_pickup',
    icon: '📦',
    en: 'Schedule pickup — Thursday or Friday of the event week',
    es: 'Programa la recogida — el jueves o viernes de la semana del evento',
  },
  {
    id: 'sched_return',
    icon: '🔄',
    en: 'Schedule return — Monday after the event at 4:00 PM',
    es: 'Programa la devolución — el lunes después del evento a las 4:00 PM',
  },
  {
    id: 'review_request',
    icon: '⭐',
    en: 'Ask the client for a Google review before they leave',
    es: 'Pide al cliente una reseña de Google antes de que se vaya',
  },
]

// Services to mention checklist — in-session reference only
const MENTION_SERVICES = [
  { group: 'Dress Purchases', items: ['Quinceañera', 'Wedding', 'Mother of Bride', 'Bridesmaids', 'Court', 'Prom', 'Evening'] },
  { group: 'Rentals', items: ['Quinceañera', 'Wedding', 'Tuxedo'] },
  { group: 'Events', items: ['Design/décor', 'Fresh or silk florals'] },
  { group: 'Alterations', items: ['Evening wear', 'Custom garments', 'Casual wear'] },
  { group: 'Accessories', items: ['Custom sneakers', 'Crowns & veils', 'Bouquets'] },
  { group: 'Others', items: ['Photo booth', 'Day-of coordinating'] },
]

// ─── Progress tracker row ──────────────────────────────────────────────────────

function StepRow({ step, index, currentStep, completedSteps, onClick }) {
  const isCompleted = completedSteps.has(index)
  const isCurrent = index === currentStep
  const isFuture = !isCompleted && !isCurrent

  return (
    <button
      onClick={() => onClick(index)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        cursor: 'pointer',
        padding: '10px 12px',
        borderRadius: 8,
        border: 'none',
        borderLeft: isCurrent ? `3px solid ${C.rosaText}` : '3px solid transparent',
        background: isCurrent ? C.rosaPale : 'transparent',
        textAlign: 'left',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = C.grayBg }}
      onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Number circle */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        background: isCompleted ? C.green : isCurrent ? C.rosaText : C.grayBg,
        color: isCompleted || isCurrent ? '#fff' : C.gray,
        transition: 'background 0.2s ease',
      }}>
        {isCompleted ? '✓' : index + 1}
      </div>
      {/* Labels */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: isCurrent || isCompleted ? 600 : 400,
          color: isFuture ? C.gray : C.ink,
          lineHeight: 1.35,
          marginBottom: 2,
        }}>
          {step.icon} {step.en}
        </div>
        <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.3 }}>
          {step.es}
        </div>
      </div>
    </button>
  )
}

// ─── Individual step panels ────────────────────────────────────────────────────

function StepGreet({ client, event, clientName, setClientName, clientPhone, setClientPhone, eventName, setEventName }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
        Welcome the client warmly and start filling out their information below.
        <br />
        <span style={{ fontSize: 11 }}>Bienvenida al cliente con calidez y comienza a completar su información.</span>
      </p>
      <div>
        <label htmlFor="cons-client-name" style={LBL}>Full name / Nombre completo</label>
        <input
          id="cons-client-name"
          style={inputSt}
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          placeholder="Client's full name"
        />
      </div>
      <div>
        <label htmlFor="cons-client-phone" style={LBL}>Phone / Teléfono</label>
        <input
          id="cons-client-phone"
          style={inputSt}
          value={clientPhone}
          onChange={e => setClientPhone(e.target.value)}
          placeholder="e.g. (555) 123-4567"
          type="tel"
        />
      </div>
      <div>
        <label htmlFor="cons-event-name" style={LBL}>Event name / Nombre del evento</label>
        <input
          id="cons-event-name"
          style={inputSt}
          value={eventName}
          onChange={e => setEventName(e.target.value)}
          placeholder="e.g. Quinceañera, Wedding…"
        />
      </div>
    </div>
  )
}

function StepListen({ listenNotes, setListenNotes }) {
  const prompts = [
    'Event day vision? / ¿Visión del día del evento?',
    'Color scheme? / ¿Paleta de colores?',
    'Style preferences? / ¿Preferencias de estilo?',
  ]

  function appendPrompt(text) {
    setListenNotes(prev => prev ? `${prev}\n\n${text}` : text)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
        Listen actively — take notes on their vision, preferences, and any details they share.
        <br />
        <span style={{ fontSize: 11 }}>Escucha activamente — toma notas sobre su visión y preferencias.</span>
      </p>
      <div>
        <label htmlFor="cons-listen-notes" style={LBL}>Notes from conversation / Notas de la conversación</label>
        <textarea
          id="cons-listen-notes"
          rows={5}
          style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }}
          value={listenNotes}
          onChange={e => setListenNotes(e.target.value)}
          placeholder="What did they share about their vision…"
        />
      </div>
      {/* Prompt chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Tap a question to add it as a prompt
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {prompts.map(p => (
            <button
              key={p}
              onClick={() => appendPrompt(p)}
              style={{
                background: C.rosaPale,
                border: `1px solid ${C.rosaLight}`,
                borderRadius: 20,
                padding: '5px 12px',
                fontSize: 12,
                color: C.rosaText,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepTryon({ triedSKUs, setTriedSKUs }) {
  const [skuInput, setSkuInput] = useState('')

  function handleKeyDown(e) {
    if ((e.key === 'Enter' || e.key === ',') && skuInput.trim()) {
      e.preventDefault()
      const sku = skuInput.trim().toUpperCase()
      if (!triedSKUs.includes(sku)) {
        setTriedSKUs(prev => [...prev, sku])
      }
      setSkuInput('')
    }
  }

  function removeSku(sku) {
    setTriedSKUs(prev => prev.filter(s => s !== sku))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: C.amberBg,
        border: `1px solid #FDE68A`,
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 13,
        color: C.amber,
        lineHeight: 1.5,
      }}>
        If they'd like to try more, schedule another appointment.
        <br />
        <span style={{ fontSize: 11 }}>Si desean probarse más, programa otra cita.</span>
      </div>
      <div>
        <label htmlFor="cons-sku-input" style={LBL}>Add dress SKU (press Enter) / Agregar SKU del vestido</label>
        <input
          id="cons-sku-input"
          style={inputSt}
          value={skuInput}
          onChange={e => setSkuInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. DR-001, press Enter to add"
        />
      </div>
      {triedSKUs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {triedSKUs.map(sku => (
            <span
              key={sku}
              style={{
                background: C.grayBg,
                border: `1px solid ${C.border}`,
                borderRadius: 20,
                padding: '3px 10px',
                fontSize: 12,
                color: C.ink,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {sku}
              <button
                onClick={() => removeSku(sku)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: C.gray,
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function StepRecordDress({ dressStyle, setDressStyle, priceQuote, setPriceQuote }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
        Record the chosen dress details on the order form below.
        <br />
        <span style={{ fontSize: 11 }}>Anota los detalles del vestido elegido en el formulario.</span>
      </p>
      <div>
        <label htmlFor="cons-dress-style" style={LBL}>Dress style / Estilo de vestido</label>
        <input
          id="cons-dress-style"
          style={inputSt}
          value={dressStyle}
          onChange={e => setDressStyle(e.target.value)}
          placeholder="e.g. Ball gown, A-line, style #XYZ…"
        />
      </div>
      <div>
        <label htmlFor="cons-price-quote" style={LBL}>Price quote / Precio cotizado</label>
        <input
          id="cons-price-quote"
          style={inputSt}
          value={priceQuote}
          onChange={e => setPriceQuote(e.target.value)}
          placeholder="0.00"
          type="number"
          min={0}
          step={0.01}
        />
      </div>
    </div>
  )
}

function StepCheckAvail({ boutique }) {
  const [availSku, setAvailSku] = useState('')
  const [availResult, setAvailResult] = useState(null)
  const [checking, setChecking] = useState(false)

  async function checkAvailability() {
    if (!availSku.trim()) return
    setChecking(true)
    setAvailResult(null)
    const { data, error } = await supabase
      .from('inventory')
      .select('id, name, status, client_id')
      .eq('sku', availSku.trim())
      .eq('boutique_id', boutique.id)
    setChecking(false)
    if (error || !data || data.length === 0) {
      setAvailResult({ found: false })
      return
    }
    const item = data[0]
    const isRented = item.status === 'rented' || item.client_id
    setAvailResult({ found: true, item, isRented })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
        Verify the dress is available in the system before finalizing.
        <br />
        <span style={{ fontSize: 11 }}>Verifica que el vestido esté disponible en el sistema antes de finalizar.</span>
      </p>
      <div>
        <label htmlFor="cons-avail-sku" style={LBL}>Dress SKU / SKU del vestido</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="cons-avail-sku"
            style={{ ...inputSt, flex: 1 }}
            value={availSku}
            onChange={e => setAvailSku(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && checkAvailability()}
            placeholder="Enter dress SKU"
          />
          <button
            onClick={checkAvailability}
            disabled={checking || !availSku.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 7,
              border: `1px solid ${C.rosaText}`,
              background: C.rosaText,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: checking || !availSku.trim() ? 'not-allowed' : 'pointer',
              opacity: checking || !availSku.trim() ? 0.6 : 1,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {checking ? 'Checking…' : 'Check / Verificar'}
          </button>
        </div>
      </div>

      {availResult && !availResult.found && (
        <div style={{
          background: C.amberBg,
          border: `1px solid #FDE68A`,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: C.amber,
        }}>
          SKU not found in inventory. Double-check the SKU and try again.
          <br />
          <span style={{ fontSize: 11 }}>SKU no encontrado. Verifica el SKU e intenta de nuevo.</span>
        </div>
      )}

      {availResult?.found && !availResult.isRented && (
        <div style={{
          background: C.greenBg,
          border: `1px solid #86EFAC`,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: C.green,
          fontWeight: 600,
        }}>
          Available ✓ — {availResult.item.name}
          <br />
          <span style={{ fontSize: 11, fontWeight: 400 }}>Disponible ✓ — listo para alquilar</span>
        </div>
      )}

      {availResult?.found && availResult.isRented && (
        <div style={{
          background: C.amberBg,
          border: `1px solid #FDE68A`,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: C.amber,
          fontWeight: 600,
        }}>
          ⚠ Already rented — check dates
          <br />
          <span style={{ fontSize: 11, fontWeight: 400 }}>⚠ Ya está alquilado — verifica las fechas disponibles</span>
        </div>
      )}
    </div>
  )
}

function StepCreateInvoice({ invoiceCreated, setInvoiceCreated, setScreen }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
        Create an invoice for the dress rental and any services booked.
        <br />
        <span style={{ fontSize: 11 }}>Crea una factura para el alquiler del vestido y los servicios reservados.</span>
      </p>
      <PrimaryBtn
        label="Create invoice now / Crear factura ahora"
        onClick={() => setScreen('invoice_create')}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
        <input
          type="checkbox"
          checked={invoiceCreated}
          onChange={e => setInvoiceCreated(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: C.green, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 13, color: C.ink }}>
          Invoice already created ✓ / Factura ya creada ✓
        </span>
      </label>
    </div>
  )
}

function StepTakeDeposit({ depositRecorded, setDepositRecorded }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: C.blueBg,
        border: `1px solid #BFDBFE`,
        borderRadius: 10,
        padding: '12px 14px',
        fontSize: 13,
        color: C.blue,
        lineHeight: 1.5,
      }}>
        Record the deposit payment received from the client.
        <br />
        <span style={{ fontSize: 11 }}>Registra el pago del depósito recibido del cliente.</span>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={depositRecorded}
          onChange={e => setDepositRecorded(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: C.green, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 13, color: C.ink }}>
          Deposit recorded ✓ / Depósito registrado ✓
        </span>
      </label>
    </div>
  )
}

function StepRecordDeposit({ depositOnForm, setDepositOnForm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
        Did you write the deposit amount on the hard copy order form?
        <br />
        <span style={{ fontSize: 11 }}>¿Anotaste el monto del depósito en el formulario físico?</span>
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={depositOnForm}
          onChange={e => setDepositOnForm(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: C.green, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 13, color: C.ink }}>
          Yes, recorded on order form / Sí, anotado en el formulario
        </span>
      </label>
    </div>
  )
}

function StepScheduler({
  titleEn,
  titleEs,
  hintEn,
  hintEs,
  scheduled,
  setScheduled,
  showScheduler,
  setShowScheduler,
  schedulerLabel,
  schedulerLabelEs,
  eventId,
  clientId,
  eventDate,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: C.rosaPale,
        border: `1px solid ${C.rosaLight}`,
        borderRadius: 10,
        padding: '12px 14px',
        fontSize: 13,
        color: C.rosaText,
        lineHeight: 1.5,
      }}>
        {hintEn}
        <br />
        <span style={{ fontSize: 11 }}>{hintEs}</span>
      </div>
      <PrimaryBtn
        label={`${schedulerLabel} / ${schedulerLabelEs}`}
        onClick={() => setShowScheduler(true)}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={scheduled}
          onChange={e => setScheduled(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: C.green, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 13, color: C.ink }}>
          {titleEn} ✓ / {titleEs} ✓
        </span>
      </label>
      {showScheduler && (
        <AppointmentScheduler
          eventId={eventId}
          clientId={clientId}
          eventDate={eventDate}
          onSave={() => { setScheduled(true); setShowScheduler(false) }}
          onClose={() => setShowScheduler(false)}
        />
      )}
    </div>
  )
}

function StepReviewRequest({
  reviewRequested,
  setReviewRequested,
  mentionedServices,
  setMentionedServices,
  boutique,
  client,
}) {
  const [showQR, setShowQR] = useState(false)

  function toggleService(key) {
    setMentionedServices(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function sendReviewLink() {
    if (!client?.phone) {
      toast('No phone number on file for this client / Sin número de teléfono', 'error')
      return
    }
    // Fire-and-forget via Supabase edge function (best effort)
    try {
      await supabase.functions.invoke('inngest-send', {
        body: {
          name: 'belori/sms.send',
          data: {
            boutique_id: boutique?.id,
            to: client.phone,
            body: 'Hola, ¡gracias por visitarnos! Nos ayudaría mucho si dejas una reseña en Google. Reply STOP to opt out.',
          },
        },
      })
    } catch {
      // Non-blocking — SMS may still have sent
    }
    setReviewRequested(true)
    toast('Review link sent! / ¡Enlace de reseña enviado!', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ margin: 0, fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
        Before the client leaves, ask for a Google review — it helps the boutique grow!
        <br />
        <span style={{ fontSize: 11 }}>Antes de que el cliente se vaya, pide una reseña en Google — ¡ayuda a crecer al boutique!</span>
      </p>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => setShowQR(q => !q)}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: showQR ? C.grayBg : C.white,
            cursor: 'pointer',
            fontSize: 13,
            color: C.ink,
            fontWeight: 500,
          }}
        >
          Show QR code / Mostrar código QR
        </button>
        <button
          onClick={sendReviewLink}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: `1px solid ${C.rosaText}`,
            background: C.rosaPale,
            cursor: 'pointer',
            fontSize: 13,
            color: C.rosaText,
            fontWeight: 500,
          }}
        >
          Send review link / Enviar enlace
        </button>
      </div>

      {/* QR placeholder */}
      {showQR && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '16px',
          background: C.grayBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: 120,
            height: 120,
            border: `2px solid ${C.ink}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: C.gray,
            textAlign: 'center',
            padding: 8,
            background: C.white,
          }}>
            Google review QR
          </div>
          <div style={{ fontSize: 11, color: C.gray }}>
            Configure the review URL in boutique settings / Configura la URL en ajustes del boutique
          </div>
        </div>
      )}

      {/* Review checkbox */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={reviewRequested}
          onChange={e => setReviewRequested(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: C.green, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 13, color: C.ink }}>
          Review requested ✓ / Reseña solicitada ✓
        </span>
      </label>

      {/* Services to mention checklist */}
      <div>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: C.ink,
          marginBottom: 10,
        }}>
          Before closing — mention these services / Antes de cerrar — menciona estos servicios
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MENTION_SERVICES.map(({ group, items }) => (
            <div key={group}>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {group}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {items.map(item => {
                  const key = `${group}:${item}`
                  const checked = mentionedServices.has(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleService(key)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: `1px solid ${checked ? '#86EFAC' : C.border}`,
                        background: checked ? C.greenBg : C.grayBg,
                        color: checked ? C.green : C.gray,
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: checked ? 600 : 400,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {checked ? '✓ ' : ''}{item}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ConsultationScreen({ eventId, clientId, eventDate, appointmentId, setScreen }) {
  const { boutique } = useAuth()
  const toast = useToast()

  // ── Responsive layout ──────────────────────────────────────────────────────
  const [wide, setWide] = useState(window.innerWidth > 800)
  useEffect(() => {
    function onResize() { setWide(window.innerWidth > 800) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Event / client data ───────────────────────────────────────────────────
  const [event, setEvent] = useState(null)
  const [client, setClient] = useState(null)

  useEffect(() => {
    if (!eventId) return
    supabase
      .from('events')
      .select('*, client:clients(*)')
      .eq('id', eventId)
      .single()
      .then(({ data }) => {
        setEvent(data)
        setClient(data?.client)
      })
  }, [eventId])

  // ── Step state ─────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(new Set())

  // ── Per-step data ──────────────────────────────────────────────────────────
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [eventName, setEventName] = useState('')

  // Sync greet fields when client/event loads
  useEffect(() => {
    if (client?.name) setClientName(client.name)
    if (client?.phone) setClientPhone(client.phone)
    if (event?.type) setEventName(event.type)
  }, [client, event])

  const [listenNotes, setListenNotes] = useState('')
  const [triedSKUs, setTriedSKUs] = useState([])
  const [dressStyle, setDressStyle] = useState('')
  const [priceQuote, setPriceQuote] = useState('')
  const [invoiceCreated, setInvoiceCreated] = useState(false)
  const [depositRecorded, setDepositRecorded] = useState(false)
  const [depositOnForm, setDepositOnForm] = useState(false)
  const [fittingScheduled, setFittingScheduled] = useState(false)
  const [showFittingScheduler, setShowFittingScheduler] = useState(false)
  const [pickupScheduled, setPickupScheduled] = useState(false)
  const [showPickupScheduler, setShowPickupScheduler] = useState(false)
  const [returnScheduled, setReturnScheduled] = useState(false)
  const [showReturnScheduler, setShowReturnScheduler] = useState(false)
  const [reviewRequested, setReviewRequested] = useState(false)
  const [mentionedServices, setMentionedServices] = useState(new Set())

  // ── Navigation helpers ─────────────────────────────────────────────────────
  function handleStepClick(index) {
    // Always allow backward navigation; forward only if target step is completed
    if (index < currentStep || completedSteps.has(index)) {
      setCurrentStep(index)
    } else if (index === currentStep + 1) {
      // Allow going one step ahead even if not explicitly completed (UX flexibility)
      setCurrentStep(index)
    }
  }

  function markCompleteAndAdvance() {
    setCompletedSteps(prev => {
      const next = new Set(prev)
      next.add(currentStep)
      return next
    })
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1)
    }
  }

  // ── Finish handler ─────────────────────────────────────────────────────────
  const handleFinish = useCallback(async () => {
    // Mark all steps complete
    setCompletedSteps(new Set(STEPS.map((_, i) => i)))

    // Save consultation note if we have an event
    if (eventId && boutique?.id) {
      const noteText = [
        'Consultation completed.',
        listenNotes ? `Notes: ${listenNotes}` : '',
        dressStyle ? `Chosen dress: ${dressStyle}` : '',
        priceQuote ? `Quoted price: $${priceQuote}` : '',
      ].filter(Boolean).join(' ')

      await supabase.from('notes').insert({
        boutique_id: boutique.id,
        event_id: eventId,
        text: noteText,
      })
    }

    // Mark appointment completed if appointmentId provided
    if (appointmentId) {
      await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointmentId)
    }

    toast('Consultation completed!')
    setScreen('events')
  }, [eventId, appointmentId, boutique, listenNotes, dressStyle, priceQuote, toast, setScreen])

  // ── Step panel renderer ────────────────────────────────────────────────────
  function renderStepPanel() {
    const step = STEPS[currentStep]
    switch (step.id) {
      case 'greet':
        return (
          <StepGreet
            client={client}
            event={event}
            clientName={clientName}
            setClientName={setClientName}
            clientPhone={clientPhone}
            setClientPhone={setClientPhone}
            eventName={eventName}
            setEventName={setEventName}
          />
        )
      case 'listen':
        return (
          <StepListen
            listenNotes={listenNotes}
            setListenNotes={setListenNotes}
          />
        )
      case 'tryon':
        return (
          <StepTryon
            triedSKUs={triedSKUs}
            setTriedSKUs={setTriedSKUs}
          />
        )
      case 'record_dress':
        return (
          <StepRecordDress
            dressStyle={dressStyle}
            setDressStyle={setDressStyle}
            priceQuote={priceQuote}
            setPriceQuote={setPriceQuote}
          />
        )
      case 'check_avail':
        return <StepCheckAvail boutique={boutique} />
      case 'create_invoice':
        return (
          <StepCreateInvoice
            invoiceCreated={invoiceCreated}
            setInvoiceCreated={setInvoiceCreated}
            setScreen={setScreen}
          />
        )
      case 'take_deposit':
        return (
          <StepTakeDeposit
            depositRecorded={depositRecorded}
            setDepositRecorded={setDepositRecorded}
          />
        )
      case 'record_deposit':
        return (
          <StepRecordDeposit
            depositOnForm={depositOnForm}
            setDepositOnForm={setDepositOnForm}
          />
        )
      case 'sched_fitting':
        return (
          <StepScheduler
            titleEn="Fitting already scheduled"
            titleEs="Prueba ya programada"
            hintEn="Fittings are on Monday of the event week."
            hintEs="Las pruebas son el lunes de la semana del evento."
            schedulerLabel="Schedule fitting"
            schedulerLabelEs="Programar prueba"
            scheduled={fittingScheduled}
            setScheduled={setFittingScheduled}
            showScheduler={showFittingScheduler}
            setShowScheduler={setShowFittingScheduler}
            eventId={eventId}
            clientId={clientId || client?.id}
            eventDate={eventDate || event?.event_date}
          />
        )
      case 'sched_pickup':
        return (
          <StepScheduler
            titleEn="Pickup already scheduled"
            titleEs="Recogida ya programada"
            hintEn="Pickup is on Thursday or Friday of the event week."
            hintEs="La recogida es el jueves o viernes de la semana del evento."
            schedulerLabel="Schedule pickup"
            schedulerLabelEs="Programar recogida"
            scheduled={pickupScheduled}
            setScheduled={setPickupScheduled}
            showScheduler={showPickupScheduler}
            setShowScheduler={setShowPickupScheduler}
            eventId={eventId}
            clientId={clientId || client?.id}
            eventDate={eventDate || event?.event_date}
          />
        )
      case 'sched_return':
        return (
          <StepScheduler
            titleEn="Return already scheduled"
            titleEs="Devolución ya programada"
            hintEn="Return is Monday after the event at 4:00 PM."
            hintEs="La devolución es el lunes después del evento a las 4:00 PM."
            schedulerLabel="Schedule return"
            schedulerLabelEs="Programar devolución"
            scheduled={returnScheduled}
            setScheduled={setReturnScheduled}
            showScheduler={showReturnScheduler}
            setShowScheduler={setShowReturnScheduler}
            eventId={eventId}
            clientId={clientId || client?.id}
            eventDate={eventDate || event?.event_date}
          />
        )
      case 'review_request':
        return (
          <StepReviewRequest
            reviewRequested={reviewRequested}
            setReviewRequested={setReviewRequested}
            mentionedServices={mentionedServices}
            setMentionedServices={setMentionedServices}
            boutique={boutique}
            client={client}
          />
        )
      default:
        return null
    }
  }

  const isFinalStep = currentStep === STEPS.length - 1

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: C.white,
      overflow: 'hidden',
    }}>
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.ink }}>
            Dress Rental Consultation
          </h1>
          <div style={{ fontSize: 12, color: C.gray }}>Consulta de alquiler de vestidos</div>
          {client && (
            <div style={{ fontSize: 12, color: C.rosaText, marginTop: 4 }}>
              Client: {client.name}
            </div>
          )}
        </div>
        <button
          onClick={() => setScreen('events')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: C.gray,
            padding: '6px 10px',
            borderRadius: 6,
          }}
        >
          ✕ Exit
        </button>
      </div>

      {/* ── Main body ────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: wide ? 'grid' : 'flex',
        gridTemplateColumns: wide ? '240px 1fr' : undefined,
        flexDirection: wide ? undefined : 'column',
        gap: wide ? 0 : 0,
        minHeight: 0,
      }}>
        {/* ── LEFT: Progress tracker ─────────────────────────────────────────── */}
        <div style={{
          borderRight: wide ? `1px solid ${C.border}` : 'none',
          borderBottom: wide ? 'none' : `1px solid ${C.border}`,
          overflowY: 'auto',
          padding: '8px 0',
          background: C.white,
          flexShrink: 0,
          ...(wide ? {} : { maxHeight: 180 }),
        }}>
          {STEPS.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              index={index}
              currentStep={currentStep}
              completedSteps={completedSteps}
              onClick={handleStepClick}
            />
          ))}
        </div>

        {/* ── RIGHT: Active step detail ──────────────────────────────────────── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          minHeight: 0,
        }}>
          {/* Step heading */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>{STEPS[currentStep].icon}</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
                  {STEPS[currentStep].en}
                </div>
                <div style={{ fontSize: 12, color: C.gray }}>
                  {STEPS[currentStep].es}
                </div>
              </div>
            </div>
            <div style={{ height: 2, background: C.grayBg, borderRadius: 2, marginTop: 12 }}>
              <div style={{
                height: 2,
                background: C.rosaText,
                borderRadius: 2,
                width: `${((currentStep + 1) / STEPS.length) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Step panel content */}
          <div style={{ flex: 1 }}>
            {renderStepPanel()}
          </div>

          {/* Mark complete / Finish button */}
          <div style={{ paddingTop: 8, borderTop: `1px solid ${C.grayBg}` }}>
            {isFinalStep ? (
              <PrimaryBtn
                label="Finish consultation / Finalizar consulta"
                onClick={handleFinish}
              />
            ) : (
              <PrimaryBtn
                label="Mark complete / Marcar completo"
                onClick={markCompleteAndAdvance}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom progress bar ───────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: C.white,
        borderTop: `1px solid ${C.border}`,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ fontSize: 13, color: C.gray, whiteSpace: 'nowrap' }}>
          Step {currentStep + 1} of 12 · {completedSteps.size} / 12 complete
        </div>
        {/* Progress bar */}
        <div style={{
          flex: 1,
          margin: '0 16px',
          height: 6,
          background: C.grayBg,
          borderRadius: 3,
        }}>
          <div style={{
            width: `${(completedSteps.size / 12) * 100}%`,
            height: 6,
            background: C.green,
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }} />
        </div>
        <GhostBtn
          label={`Finish${completedSteps.size < 12 ? ' early' : ''} / Finalizar`}
          onClick={handleFinish}
        />
      </div>
    </div>
  )
}
