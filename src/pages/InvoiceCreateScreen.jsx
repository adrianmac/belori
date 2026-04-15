import React, { useState, useRef } from 'react';
import { C } from '../lib/colors';
import { PrimaryBtn, GhostBtn, inputSt, LBL, useToast } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import ClientPhoneLookup from '../components/clients/ClientPhoneLookup';
import {
  INVOICE_ITEMS,
  ITEM_CATEGORIES,
  RENTAL_ITEM_IDS,
  CREDIT_CARD_FEE_PCT,
  CREDIT_CARD_FEE_LABEL,
  CREDIT_CARD_FEE_LABEL_ES,
  dollarsToCents,
  centsToDollars,
  fmtCents,
} from '../lib/invoiceItems';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 0, label: 'Find client / Buscar cliente' },
  { n: 1, label: 'Add items / Agregar artículos' },
  { n: 2, label: 'Payment / Pago' },
  { n: 3, label: 'Card on file / Tarjeta' },
  { n: 4, label: 'Attach form / Adjuntar formulario' },
  { n: 5, label: 'Review + Send / Revisar' },
];

const CARD_BRANDS = ['Visa', 'Mastercard', 'Amex', 'Discover', 'Other'];

// ─── STEP 1: ADD ITEMS ────────────────────────────────────────────────────────

function ItemsStep({ lineItems, setLineItems, activeCat, setActiveCat, includeFee, setIncludeFee }) {
  const [itemPrices, setItemPrices] = useState(() => {
    const initial = {};
    INVOICE_ITEMS.forEach(item => { initial[item.id] = '0'; });
    return initial;
  });
  const [customName, setCustomName] = useState('');
  const [customNameEs, setCustomNameEs] = useState('');
  const [hoveredItem, setHoveredItem] = useState(null);
  const [showFeeConfirm, setShowFeeConfirm] = useState(false);

  const filteredItems = activeCat === 'all'
    ? INVOICE_ITEMS
    : INVOICE_ITEMS.filter(item => item.category === activeCat);

  function addItem(item) {
    const priceCents = dollarsToCents(itemPrices[item.id] || '0');
    const name = item.isCustom ? (customName || 'Custom Amount') : item.name;
    const nameEs = item.isCustom ? (customNameEs || item.name_es) : item.name_es;
    setLineItems(prev => {
      const existing = prev.findIndex(li => li.id === item.id && !item.isCustom);
      if (existing >= 0 && !item.isCustom) {
        return prev.map((li, i) =>
          i === existing ? { ...li, quantity: li.quantity + 1 } : li
        );
      }
      return [...prev, { id: item.id, name, name_es: nameEs, category: item.category, price_cents: priceCents, quantity: 1 }];
    });
    if (item.isCustom) {
      setCustomName('');
      setCustomNameEs('');
    }
    setItemPrices(prev => ({ ...prev, [item.id]: '0' }));
  }

  function removeItem(idx) {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateQty(idx, delta) {
    setLineItems(prev => prev.map((li, i) => {
      if (i !== idx) return li;
      const newQty = li.quantity + delta;
      return newQty < 1 ? li : { ...li, quantity: newQty };
    }));
  }

  function updateItemPrice(idx, val) {
    setLineItems(prev => prev.map((li, i) =>
      i === idx ? { ...li, price_cents: dollarsToCents(val) } : li
    ));
  }

  function handleFeeToggle() {
    if (includeFee) {
      setShowFeeConfirm(true);
    } else {
      setIncludeFee(true);
      setShowFeeConfirm(false);
    }
  }

  const subtotalCents = lineItems.reduce((sum, li) => sum + li.price_cents * li.quantity, 0);
  const feeCents = includeFee ? Math.round(subtotalCents * CREDIT_CARD_FEE_PCT) : 0;
  const totalCents = subtotalCents + feeCents;

  return (
    <div>
      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {ITEM_CATEGORIES.map(cat => {
          const active = activeCat === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              style={{
                background: active ? C.rosaSolid : C.grayBg,
                color: active ? C.white : C.gray,
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: 12,
                border: 'none',
                cursor: 'pointer',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Item grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 10,
        marginBottom: 20,
      }}>
        {filteredItems.map(item => {
          const hov = hoveredItem === item.id;
          return (
            <div
              key={item.id}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                background: hov ? C.grayBg : C.white,
                transition: 'background 0.15s',
              }}
            >
              {item.isCustom && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ ...LBL, marginBottom: 3 }}>Name / Nombre</div>
                  <input
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Custom item name"
                    style={{ ...inputSt, marginBottom: 4, fontSize: 12 }}
                  />
                  <input
                    value={customNameEs}
                    onChange={e => setCustomNameEs(e.target.value)}
                    placeholder="Nombre en español (opcional)"
                    style={{ ...inputSt, fontSize: 12 }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {item.name_es}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.gray, pointerEvents: 'none' }}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemPrices[item.id] ?? '0'}
                      onChange={e => setItemPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                      style={{ ...inputSt, width: 80, paddingLeft: 18, fontSize: 12 }}
                    />
                  </div>
                  <button
                    onClick={() => addItem(item)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: C.rosaSolid,
                      color: C.white,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    aria-label={`Add ${item.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', marginBottom: 16 }}>
        Items have prices. Services are for scheduling only. / Los artículos tienen precios. Los servicios son solo para citas.
      </div>

      {/* Cart */}
      {lineItems.length > 0 && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Cart header */}
          <div style={{ padding: '10px 14px', background: C.grayBg, borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 600, color: C.ink }}>
            Cart / Carrito ({lineItems.length} item{lineItems.length !== 1 ? 's' : ''})
          </div>

          {/* Line items */}
          {lineItems.map((li, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{li.name}</div>
                {li.name_es && <div style={{ fontSize: 11, color: C.gray }}>{li.name_es}</div>}
              </div>
              {/* Price editor */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.gray, pointerEvents: 'none' }}>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={centsToDollars(li.price_cents)}
                  onChange={e => updateItemPrice(idx, e.target.value)}
                  style={{ ...inputSt, width: 72, paddingLeft: 16, fontSize: 12 }}
                />
              </div>
              {/* Qty */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => updateQty(idx, -1)}
                  disabled={li.quantity <= 1}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, cursor: li.quantity <= 1 ? 'not-allowed' : 'pointer', fontSize: 14, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: li.quantity <= 1 ? 0.4 : 1 }}
                >
                  −
                </button>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, minWidth: 20, textAlign: 'center' }}>{li.quantity}</span>
                <button
                  onClick={() => updateQty(idx, 1)}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 14, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  +
                </button>
              </div>
              {/* Line total */}
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, minWidth: 70, textAlign: 'right', flexShrink: 0 }}>
                {fmtCents(li.price_cents * li.quantity)}
              </div>
              {/* Remove */}
              <button
                onClick={() => removeItem(idx)}
                aria-label="Remove item"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 16, padding: '0 2px', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}

          {/* Subtotal */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.gray }}>
            <span>Subtotal</span>
            <span>{fmtCents(subtotalCents)}</span>
          </div>

          {/* CC Fee toggle */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeFee}
                onChange={handleFeeToggle}
                style={{ accentColor: C.rosaSolid, width: 15, height: 15 }}
              />
              <span style={{ fontSize: 12, color: C.ink }}>
                {CREDIT_CARD_FEE_LABEL} / {CREDIT_CARD_FEE_LABEL_ES}
              </span>
              {includeFee && (
                <span style={{ fontSize: 12, color: C.gray, marginLeft: 'auto' }}>{fmtCents(feeCents)}</span>
              )}
            </label>

            {/* Confirm remove fee banner */}
            {showFeeConfirm && (
              <div style={{ marginTop: 10, background: C.amberBg, border: `1px solid #FCD34D`, borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: C.amber, marginBottom: 8, fontWeight: 500 }}>
                  Confirm: client is paying by cash or Zelle. Remove the 3% fee? / Confirmar: el cliente paga en efectivo o Zelle. ¿Eliminar el 3%?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setIncludeFee(false); setShowFeeConfirm(false); }}
                    style={{ fontSize: 12, fontWeight: 600, background: C.amber, color: C.white, border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer' }}
                  >
                    Yes, remove / Sí, eliminar
                  </button>
                  <button
                    onClick={() => setShowFeeConfirm(false)}
                    style={{ fontSize: 12, background: 'none', border: `1px solid ${C.amber}`, borderRadius: 6, padding: '5px 14px', cursor: 'pointer', color: C.amber }}
                  >
                    No, keep / No, mantener
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: C.rosaPale }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{fmtCents(totalCents)}</span>
          </div>
        </div>
      )}

      {lineItems.length === 0 && (
        <div style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: '24px 16px', textAlign: 'center', color: C.gray, fontSize: 13 }}>
          No items added yet / No se han agregado artículos
        </div>
      )}
    </div>
  );
}

// ─── STEP 2: PAYMENT SCHEDULE ────────────────────────────────────────────────

function PaymentScheduleStep({ useSchedule, setUseSchedule, depositCents, setDepositCents, balanceDueDate, setBalanceDueDate, totalCents }) {
  const balanceCents = totalCents - depositCents;

  return (
    <div>
      {/* Yes / No toggle cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { val: true, label: 'Yes, add schedule', labelEs: 'Sí, agregar plan', icon: '📅' },
          { val: false, label: 'No, pay in full', labelEs: 'No, pago completo', icon: '💵' },
        ].map(opt => {
          const active = useSchedule === opt.val;
          return (
            <button
              key={String(opt.val)}
              onClick={() => setUseSchedule(opt.val)}
              style={{
                border: `2px solid ${active ? C.rosaText : C.border}`,
                borderRadius: 12,
                padding: '18px 14px',
                background: active ? C.rosaPale : C.white,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.18s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{opt.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{opt.labelEs}</div>
            </button>
          );
        })}
      </div>

      {useSchedule && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Deposit */}
          <div>
            <label style={LBL}>Deposit / Depósito</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.gray, pointerEvents: 'none' }}>$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                max={centsToDollars(totalCents)}
                value={centsToDollars(depositCents)}
                onChange={e => setDepositCents(dollarsToCents(e.target.value))}
                style={{ ...inputSt, paddingLeft: 22 }}
              />
            </div>
          </div>

          {/* Balance display */}
          <div style={{ background: C.grayBg, borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: C.gray }}>Balance / Saldo</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: balanceCents < 0 ? C.red : C.ink, marginTop: 2 }}>
                {fmtCents(Math.max(0, balanceCents))}
              </div>
            </div>
            {balanceCents < 0 && (
              <div style={{ fontSize: 11, color: C.red, fontStyle: 'italic' }}>
                Deposit exceeds total / El depósito supera el total
              </div>
            )}
          </div>

          {/* Balance due date */}
          <div>
            <label style={LBL}>Balance due date / Fecha de vencimiento del saldo</label>
            <input
              type="date"
              value={balanceDueDate}
              onChange={e => setBalanceDueDate(e.target.value)}
              style={inputSt}
            />
            <div style={{ fontSize: 11, color: C.gray, marginTop: 5, fontStyle: 'italic' }}>
              Balance due date is usually the pickup or fitting date / La fecha de vencimiento del saldo suele ser la fecha de recogida o prueba
            </div>
          </div>
        </div>
      )}

      {!useSchedule && (
        <div style={{ background: C.grayBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>ℹ️</span>
          <span style={{ fontSize: 13, color: C.gray }}>
            Full balance due immediately / Saldo total vencido de inmediato
          </span>
        </div>
      )}
    </div>
  );
}

// ─── STEP 3: CARD ON FILE ────────────────────────────────────────────────────

function CardOnFileStep({ cardLastFour, setCardLastFour, cardBrand, setCardBrand, onSkip }) {
  return (
    <div>
      {/* Info banner */}
      <div style={{ background: C.infoBg, border: `1px solid ${C.infoBorder}`, borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.infoText, lineHeight: 1.5 }}>
          Adding a card on file protects the boutique in case of damage or late return. Highly recommended for all rentals.
        </div>
        <div style={{ fontSize: 11, color: C.infoText, marginTop: 4, opacity: 0.85 }}>
          Agregar una tarjeta en archivo protege a la boutique en caso de daños o devolución tardía. Muy recomendado para todos los alquileres.
        </div>
      </div>

      {/* Card inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={LBL}>Last 4 digits / Últimos 4 dígitos</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]{4}"
            placeholder="1234"
            value={cardLastFour}
            onChange={e => setCardLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
            style={inputSt}
          />
        </div>

        <div>
          <label style={LBL}>Card brand / Tipo de tarjeta</label>
          <select value={cardBrand} onChange={e => setCardBrand(e.target.value)} style={inputSt}>
            <option value="">Select brand / Seleccionar tipo</option>
            {CARD_BRANDS.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Skip link */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          onClick={onSkip}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 13, textDecoration: 'underline' }}
        >
          Skip / Omitir
        </button>
      </div>
    </div>
  );
}

// ─── STEP 4: ATTACH ORDER FORM ────────────────────────────────────────────────

function AttachOrderFormStep({ boutique, attachmentUrl, setAttachmentUrl, attachmentFileName, setAttachmentFileName, onSkip }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr('');
    try {
      const path = `${boutique.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('invoice-attachments')
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('invoice-attachments').getPublicUrl(path);
      setAttachmentUrl(publicUrl);
      setAttachmentFileName(file.name);
    } catch (err) {
      setUploadErr(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const isImage = attachmentFileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(attachmentFileName);

  return (
    <div>
      {/* Upload area */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${C.border}`,
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          transition: 'background 0.15s',
          marginBottom: 16,
          background: attachmentUrl ? C.grayBg : C.white,
        }}
        onMouseEnter={e => { if (!attachmentUrl) e.currentTarget.style.background = C.grayBg; }}
        onMouseLeave={e => { if (!attachmentUrl) e.currentTarget.style.background = C.white; }}
      >
        {uploading ? (
          <div style={{ fontSize: 13, color: C.gray }}>Uploading... / Subiendo...</div>
        ) : attachmentUrl ? (
          <div>
            {isImage ? (
              <img
                src={attachmentUrl}
                alt="Attached order form"
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain', marginBottom: 8 }}
              />
            ) : (
              <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
            )}
            <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>Uploaded: {attachmentFileName}</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>Click to replace / Haz clic para reemplazar</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
              Take photo of order form / Tomar foto del formulario de pedido
            </div>
            <div style={{ fontSize: 12, color: C.gray }}>
              Tap to open camera or select a file / Toca para abrir la cámara o seleccionar un archivo
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {uploadErr && (
        <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{uploadErr}</div>
      )}

      {/* Skip link */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button
          onClick={onSkip}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 13, textDecoration: 'underline' }}
        >
          Skip / Omitir
        </button>
      </div>
    </div>
  );
}

// ─── STEP 5: REVIEW + SEND ───────────────────────────────────────────────────

function ReviewStep({ client, lineItems, includeFee, useSchedule, depositCents, balanceDueDate, cardLastFour, cardBrand, attachmentFileName, boutique }) {
  const subtotalCents = lineItems.reduce((sum, li) => sum + li.price_cents * li.quantity, 0);
  const feeCents = includeFee ? Math.round(subtotalCents * CREDIT_CARD_FEE_PCT) : 0;
  const totalCents = subtotalCents + feeCents;
  const balanceCents = totalCents - depositCents;

  function detailRow(label, value) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 12, color: C.gray, flexShrink: 0, marginRight: 12 }}>{label}</span>
        <span style={{ fontSize: 13, color: C.ink, fontWeight: 500, textAlign: 'right' }}>{value}</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: C.grayBg }}>
        {/* Client */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.white }}>
          <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Client / Cliente</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{client?.name}</div>
          {client?.phone && <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{client.phone}</div>}
        </div>

        {/* Items */}
        <div style={{ padding: '12px 16px', background: C.white, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Items</div>
          {lineItems.map((li, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.ink, marginBottom: 4 }}>
              <span>{li.name} {li.quantity > 1 ? `×${li.quantity}` : ''}</span>
              <span style={{ fontWeight: 600 }}>{fmtCents(li.price_cents * li.quantity)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ padding: '12px 16px', background: C.white, borderBottom: `1px solid ${C.border}` }}>
          {detailRow('Subtotal', fmtCents(subtotalCents))}
          {includeFee && detailRow(`CC fee (${Math.round(CREDIT_CARD_FEE_PCT * 100)}%) / Cargo tarjeta`, fmtCents(feeCents))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{fmtCents(totalCents)}</span>
          </div>
        </div>

        {/* Payment schedule */}
        {useSchedule && depositCents > 0 && (
          <div style={{ padding: '12px 16px', background: C.white, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Payment Schedule / Plan de Pago</div>
            {detailRow('Deposit / Depósito', fmtCents(depositCents))}
            {detailRow(`Balance${balanceDueDate ? ` due ${balanceDueDate}` : ''} / Saldo`, fmtCents(Math.max(0, balanceCents)))}
          </div>
        )}

        {/* Card on file */}
        {cardLastFour.length === 4 && (
          <div style={{ padding: '12px 16px', background: C.white, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Card on File / Tarjeta en Archivo</div>
            <div style={{ fontSize: 13, color: C.ink }}>{cardBrand || 'Card'} ending in {cardLastFour}</div>
          </div>
        )}

        {/* Attachment */}
        {attachmentFileName && (
          <div style={{ padding: '12px 16px', background: C.white }}>
            <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Attachment / Adjunto</div>
            <div style={{ fontSize: 13, color: C.green }}>📎 {attachmentFileName}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function InvoiceCreateScreen({ setScreen }) {
  const { boutique } = useAuth();
  const toast = useToast();

  // Step state
  const [step, setStep] = useState(0);

  // Step 0 — client
  const [client, setClient] = useState(null);

  // Step 1 — items
  const [lineItems, setLineItems] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [includeFee, setIncludeFee] = useState(true);

  // Step 2 — payment schedule
  const [useSchedule, setUseSchedule] = useState(false);
  const [depositCents, setDepositCents] = useState(0);
  const [balanceDueDate, setBalanceDueDate] = useState('');

  // Step 3 — card on file
  const [cardLastFour, setCardLastFour] = useState('');
  const [cardBrand, setCardBrand] = useState('');

  // Step 4 — attachment
  const [attachmentUrl, setAttachmentUrl] = useState(null);
  const [attachmentFileName, setAttachmentFileName] = useState('');

  // Saving
  const [saving, setSaving] = useState(false);

  // Derived
  const subtotalCents = lineItems.reduce((sum, li) => sum + li.price_cents * li.quantity, 0);
  const feeCents = includeFee ? Math.round(subtotalCents * CREDIT_CARD_FEE_PCT) : 0;
  const totalCents = subtotalCents + feeCents;
  const hasRentals = lineItems.some(li => RENTAL_ITEM_IDS.includes(li.id));

  // ── Navigation helpers ────────────────────────────────────────────────────

  function handleClientSelected(c) {
    setClient(c);
    setStep(1);
  }

  function back() {
    setStep(s => Math.max(0, s - 1));
  }

  function advance() {
    setStep(s => {
      const next = s + 1;
      // Auto-skip step 3 if no rentals
      if (next === 3 && !hasRentals) return 4;
      return next;
    });
  }

  function skipCardStep() {
    setCardLastFour('');
    setCardBrand('');
    setStep(4);
  }

  function skipAttachStep() {
    setStep(5);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(sendNow) {
    if (!client || lineItems.length === 0) return;
    setSaving(true);
    try {
      // 1. Generate invoice number
      const { data: invNum, error: rpcErr } = await supabase.rpc('generate_invoice_number', { boutique: boutique.id });
      if (rpcErr) throw rpcErr;

      // 2. Insert invoice
      const { data: inv, error: invErr } = await supabase.from('invoices').insert({
        boutique_id: boutique.id,
        client_id: client.id,
        invoice_number: invNum,
        status: sendNow ? 'sent' : 'draft',
        subtotal_cents: subtotalCents,
        tax_cents: feeCents,
        include_tax: includeFee,
        total_cents: totalCents,
        paid_cents: 0,
        sent_at: sendNow ? new Date().toISOString() : null,
      }).select().single();
      if (invErr) throw invErr;

      // 3. Insert line items
      const { error: itemsErr } = await supabase.from('invoice_items').insert(
        lineItems.map((item, idx) => ({
          boutique_id: boutique.id,
          invoice_id: inv.id,
          name: item.name,
          name_es: item.name_es || null,
          price_cents: item.price_cents,
          quantity: item.quantity,
          sort_order: idx,
        }))
      );
      if (itemsErr) throw itemsErr;

      // 4. Insert payment schedule
      if (useSchedule && depositCents > 0) {
        const balanceCents = totalCents - depositCents;
        const { error: schedErr } = await supabase.from('invoice_payment_schedule').insert([
          {
            boutique_id: boutique.id,
            invoice_id: inv.id,
            label: 'Deposit',
            label_es: 'Depósito',
            amount_cents: depositCents,
            status: 'pending',
            sort_order: 0,
          },
          {
            boutique_id: boutique.id,
            invoice_id: inv.id,
            label: 'Balance',
            label_es: 'Saldo',
            amount_cents: Math.max(0, balanceCents),
            due_date: balanceDueDate || null,
            status: 'pending',
            sort_order: 1,
          },
        ]);
        if (schedErr) throw schedErr;
      }

      // 5. Insert card on file
      if (cardLastFour.length === 4) {
        await supabase.from('client_cards_on_file').insert({
          boutique_id: boutique.id,
          client_id: client.id,
          last_four: cardLastFour,
          card_brand: cardBrand || null,
          added_for_invoice_id: inv.id,
        });
        // Non-fatal if this fails
      }

      // 6. Insert attachment
      if (attachmentUrl) {
        await supabase.from('invoice_attachments').insert({
          boutique_id: boutique.id,
          invoice_id: inv.id,
          file_url: attachmentUrl,
          file_name: attachmentFileName,
        });
      }

      // 7. Send SMS
      if (sendNow && client.phone) {
        const firstName = (client.name || 'there').split(' ')[0];
        supabase.functions.invoke('send-sms', {
          body: {
            to: client.phone,
            message: `Hola ${firstName}, tu factura de ${boutique.name} está lista. Número: ${invNum}. Total: ${fmtCents(totalCents)}. Reply STOP to opt out.`,
          },
        }).catch(() => {});
      }

      toast(sendNow ? 'Invoice sent! / ¡Factura enviada!' : 'Invoice saved as draft / Factura guardada como borrador');
      setScreen('invoices');
    } catch (err) {
      toast('Error saving invoice: ' + (err.message || 'Unknown error'));
      setSaving(false);
    }
  }

  // ── Breadcrumb data (skip step 3 label if no rentals) ────────────────────

  const visibleSteps = STEPS.filter(s => !(s.n === 3 && !hasRentals));

  // Map visible steps to progress indices
  const visibleStepNs = visibleSteps.map(s => s.n);
  const currentVisibleIdx = visibleStepNs.indexOf(step);
  const totalVisible = visibleSteps.length;

  // ── Step label for subheader ──────────────────────────────────────────────
  const currentStepLabel = STEPS.find(s => s.n === step)?.label || '';

  // ── Can advance? ─────────────────────────────────────────────────────────
  const canContinue = step === 0
    ? Boolean(client)
    : step === 1
    ? lineItems.length > 0
    : true;

  return (
    <div style={{
      minHeight: '100vh',
      background: C.ivory,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Page Header ── */}
      <div style={{
        background: C.white,
        borderBottom: `1px solid ${C.border}`,
        padding: '0 16px',
        flexShrink: 0,
      }}>
        {/* Title row */}
        <div style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '16px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>
              New Invoice / Nueva Factura
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
              {currentStepLabel}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Step dots */}
            <div style={{ display: 'flex', gap: 5 }}>
              {visibleSteps.map(({ n }, i) => (
                <div
                  key={n}
                  style={{
                    width: n === step ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i <= currentVisibleIdx ? C.rosaSolid : C.border,
                    transition: 'all 0.25s ease',
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.gray, whiteSpace: 'nowrap' }}>
              {currentVisibleIdx + 1} / {totalVisible}
            </div>
            <button
              onClick={() => setScreen('dashboard')}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                fontSize: 22,
                cursor: 'pointer',
                color: C.gray,
                padding: '0 2px',
                lineHeight: 1,
                marginLeft: 4,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '8px 0',
          display: 'flex',
          gap: 0,
          flexWrap: 'wrap',
        }}>
          {visibleSteps.map(({ n, label }, i) => (
            <React.Fragment key={n}>
              {i > 0 && (
                <span style={{ fontSize: 11, color: C.border, padding: '0 5px', alignSelf: 'center' }}>›</span>
              )}
              <span style={{
                fontSize: 11,
                fontWeight: n === step ? 600 : 400,
                color: visibleStepNs.indexOf(n) < currentVisibleIdx ? C.rosaText : n === step ? C.ink : C.gray,
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>

          {/* STEP 0 — Find client */}
          {step === 0 && (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: C.gray, lineHeight: 1.5 }}>
                Search by phone number to find or create a client profile.
                <br />
                <span style={{ fontSize: 11 }}>Busca por número de teléfono para encontrar o crear un perfil de cliente.</span>
              </p>
              <ClientPhoneLookup
                onClientSelected={handleClientSelected}
                boutiqueId={boutique?.id}
              />
            </div>
          )}

          {/* STEP 1 — Add items */}
          {step === 1 && (
            <ItemsStep
              lineItems={lineItems}
              setLineItems={setLineItems}
              activeCat={activeCat}
              setActiveCat={setActiveCat}
              includeFee={includeFee}
              setIncludeFee={setIncludeFee}
            />
          )}

          {/* STEP 2 — Payment schedule */}
          {step === 2 && (
            <PaymentScheduleStep
              useSchedule={useSchedule}
              setUseSchedule={setUseSchedule}
              depositCents={depositCents}
              setDepositCents={setDepositCents}
              balanceDueDate={balanceDueDate}
              setBalanceDueDate={setBalanceDueDate}
              totalCents={totalCents}
            />
          )}

          {/* STEP 3 — Card on file (rentals only) */}
          {step === 3 && (
            <CardOnFileStep
              cardLastFour={cardLastFour}
              setCardLastFour={setCardLastFour}
              cardBrand={cardBrand}
              setCardBrand={setCardBrand}
              onSkip={skipCardStep}
            />
          )}

          {/* STEP 4 — Attach order form */}
          {step === 4 && (
            <AttachOrderFormStep
              boutique={boutique}
              attachmentUrl={attachmentUrl}
              setAttachmentUrl={setAttachmentUrl}
              attachmentFileName={attachmentFileName}
              setAttachmentFileName={setAttachmentFileName}
              onSkip={skipAttachStep}
            />
          )}

          {/* STEP 5 — Review + send */}
          {step === 5 && (
            <ReviewStep
              client={client}
              lineItems={lineItems}
              includeFee={includeFee}
              useSchedule={useSchedule}
              depositCents={depositCents}
              balanceDueDate={balanceDueDate}
              cardLastFour={cardLastFour}
              cardBrand={cardBrand}
              attachmentFileName={attachmentFileName}
              boutique={boutique}
            />
          )}

        </div>
      </div>

      {/* ── Footer nav ── */}
      {step > 0 && step < 5 && (
        <div style={{
          background: C.white,
          borderTop: `1px solid ${C.border}`,
          padding: '14px 24px',
          flexShrink: 0,
        }}>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <GhostBtn
              label="Back / Atrás"
              onClick={back}
              style={{ minWidth: 120 }}
            />
            <PrimaryBtn
              label={step === 4 ? 'Review / Revisar' : 'Continue / Continuar'}
              onClick={advance}
              disabled={!canContinue}
              style={{ minWidth: 160 }}
            />
          </div>
        </div>
      )}

      {/* ── Step 5 footer — save/send actions ── */}
      {step === 5 && (
        <div style={{
          background: C.white,
          borderTop: `1px solid ${C.border}`,
          padding: '14px 24px',
          flexShrink: 0,
        }}>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <GhostBtn
              label="Back / Atrás"
              onClick={back}
              style={{ minWidth: 120 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <GhostBtn
                label={saving ? 'Saving...' : 'Save as Draft / Guardar como borrador'}
                onClick={() => handleSave(false)}
                disabled={saving}
                style={{ minWidth: 160 }}
              />
              <PrimaryBtn
                label={saving ? 'Sending...' : 'Send Invoice / Enviar Factura'}
                onClick={() => handleSave(true)}
                disabled={saving}
                style={{ minWidth: 160 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
