import React, { useState, useMemo, useCallback } from 'react';
import { C, fmt, EVT_TYPES } from '../lib/colors';
import { Topbar, PrimaryBtn, GhostBtn, useToast, inputSt, LBL } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../hooks/useEvents';
import { supabase } from '../lib/supabase';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function isoToday() {
  return new Date().toISOString().split('T')[0];
}
function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}
function fmtMoney(n) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EVENT_TYPE_OPTIONS = [
  { value: 'wedding',       label: 'Wedding' },
  { value: 'quince',        label: 'Quinceañera' },
  { value: 'baptism',       label: 'Baptism' },
  { value: 'birthday',      label: 'Birthday' },
  { value: 'anniversary',   label: 'Anniversary' },
  { value: 'graduation',    label: 'Graduation' },
  { value: 'baby_shower',   label: 'Baby Shower' },
  { value: 'bridal_shower', label: 'Bridal Shower' },
];

// ─── BLANK QUOTE STATE ────────────────────────────────────────────────────────
function blankQuote() {
  return {
    event_id: '',
    client_name: '',
    event_type: 'wedding',
    event_date: '',
    venue: '',
    expires_at: addDays(isoToday(), 30),
    line_items: [{ id: 1, description: '', qty: 1, unit_price: 0 }],
    milestones: [],
    discount_type: 'fixed',
    discount_value: 0,
    notes: '',
    _clientPhone: '',
  };
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ number, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: C.rosa, color: C.white,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>{number}</div>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{title}</span>
    </div>
  );
}

// ─── SMS MODAL ────────────────────────────────────────────────────────────────
function SmsModal({ quoteData, boutique, pdfUrl, total, onClose }) {
  const toast = useToast();
  const [sending, setSending] = useState(false);

  const defaultMsg = [
    `Hi ${quoteData.client_name || 'there'}!`,
    ` Your quote from ${boutique?.name || 'us'} is ready`,
    pdfUrl ? `: ${pdfUrl}` : '.',
    ` Total: ${fmtMoney(total)}.`,
    quoteData.expires_at ? ` Valid until ${fmtDate(quoteData.expires_at)}.` : '',
    ' Reply YES to confirm or call us with questions! \u{1F495}',
  ].join('');

  const [msg, setMsg] = useState(defaultMsg);

  async function handleSend() {
    const phone = quoteData._clientPhone;
    if (!phone) {
      toast('No client phone number on file — copy the message manually', 'error');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-sms', {
        body: { to: phone, message: msg },
      });
      if (error) throw error;
      toast('SMS sent!');
      onClose();
    } catch (err) {
      toast('Failed to send SMS: ' + String(err), 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(msg);
    toast('Copied to clipboard');
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: C.white, borderRadius: 16, width: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>Send quote via SMS</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!quoteData._clientPhone && (
            <div style={{ background: C.amberBg, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.amber }}>
              No phone number on file for this client. Copy the message and send it manually.
            </div>
          )}
          {quoteData._clientPhone && (
            <div style={{ fontSize: 13, color: C.gray }}>
              Sending to: <strong style={{ color: C.ink }}>{quoteData._clientPhone}</strong>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Message
            </div>
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              rows={6}
              style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{msg.length} characters</div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <GhostBtn label="Copy" onClick={handleCopy} />
            <GhostBtn label="Cancel" onClick={onClose} />
            <PrimaryBtn
              label={sending ? 'Sending…' : 'Send SMS'}
              onClick={handleSend}
              disabled={sending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PREVIEW ROW ─────────────────────────────────────────────────────────────
function PreviewRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontFamily: 'sans-serif', fontSize: 12 }}>
      <span style={{ color: C.gray, minWidth: 80 }}>{label}:</span>
      <span style={{ color: C.ink, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── LIVE PREVIEW ─────────────────────────────────────────────────────────────
function QuotePreview({ quoteData, boutique, subtotal, discountAmt, total }) {
  const typeLabel = EVENT_TYPE_OPTIONS.find(o => o.value === quoteData.event_type)?.label || quoteData.event_type || '';
  const hasLineItems = quoteData.line_items.some(li => li.description);

  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 12, overflow: 'hidden',
      fontFamily: 'Georgia, serif',
      boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
    }}>
      {/* Header */}
      <div style={{ background: C.rosa, padding: '24px 28px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 4 }}>
          {boutique?.name || 'Your Boutique'}
        </div>
        {boutique?.phone && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontFamily: 'sans-serif' }}>{boutique.phone}</div>
        )}
        {boutique?.email && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontFamily: 'sans-serif' }}>{boutique.email}</div>
        )}
      </div>

      {/* Title block */}
      <div style={{ padding: '18px 28px', borderBottom: `2px solid ${C.rosaLight}` }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>
          Proposal / Quote
        </div>
        <div style={{ fontSize: 11, color: C.gray, marginTop: 4, fontFamily: 'sans-serif' }}>
          Prepared {fmtDate(isoToday())}
          {quoteData.expires_at && (
            <span style={{ marginLeft: 12, color: C.amber, fontWeight: 600 }}>
              Valid until {fmtDate(quoteData.expires_at)}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '18px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Client info */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.rosa, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'sans-serif' }}>
            Client Information
          </div>
          <PreviewRow label="Client" value={quoteData.client_name || '—'} />
          {typeLabel && <PreviewRow label="Event type" value={typeLabel} />}
          {quoteData.event_date && <PreviewRow label="Event date" value={fmtDate(quoteData.event_date)} />}
          {quoteData.venue && <PreviewRow label="Venue" value={quoteData.venue} />}
        </div>

        {/* Line items */}
        {hasLineItems && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.rosa, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'sans-serif' }}>
              Services &amp; Pricing
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'sans-serif' }}>
              <thead>
                <tr style={{ background: C.rosaPale }}>
                  <th style={{ textAlign: 'left', padding: '5px 7px', fontWeight: 600, color: C.ink }}>Description</th>
                  <th style={{ textAlign: 'center', padding: '5px 7px', fontWeight: 600, color: C.ink, width: 32 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '5px 7px', fontWeight: 600, color: C.ink, width: 70 }}>Unit</th>
                  <th style={{ textAlign: 'right', padding: '5px 7px', fontWeight: 600, color: C.ink, width: 72 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {quoteData.line_items.filter(li => li.description).map((li, i) => (
                  <tr key={li.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : C.ivory }}>
                    <td style={{ padding: '6px 7px', color: C.ink }}>{li.description}</td>
                    <td style={{ padding: '6px 7px', textAlign: 'center', color: C.gray }}>{li.qty}</td>
                    <td style={{ padding: '6px 7px', textAlign: 'right', color: C.gray }}>{fmtMoney(li.unit_price)}</td>
                    <td style={{ padding: '6px 7px', textAlign: 'right', color: C.ink, fontWeight: 500 }}>
                      {fmtMoney((li.qty || 1) * (li.unit_price || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', fontFamily: 'sans-serif', fontSize: 11 }}>
              <div style={{ display: 'flex', gap: 24, color: C.gray }}>
                <span>Subtotal</span><span>{fmtMoney(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div style={{ display: 'flex', gap: 24, color: C.green }}>
                  <span>Discount</span><span>− {fmtMoney(discountAmt)}</span>
                </div>
              )}
              <div style={{
                display: 'flex', gap: 24,
                fontWeight: 700, fontSize: 15, color: C.ink,
                borderTop: `2px solid ${C.rosa}`, paddingTop: 7, marginTop: 3,
              }}>
                <span>Total</span>
                <span style={{ color: C.rosa }}>{fmtMoney(total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment schedule */}
        {quoteData.milestones.length > 0 && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.rosa, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'sans-serif' }}>
              Payment Schedule
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'sans-serif' }}>
              <thead>
                <tr style={{ background: C.rosaPale }}>
                  <th style={{ textAlign: 'left', padding: '5px 7px', fontWeight: 600, color: C.ink }}>Milestone</th>
                  <th style={{ textAlign: 'right', padding: '5px 7px', fontWeight: 600, color: C.ink }}>Due</th>
                  <th style={{ textAlign: 'right', padding: '5px 7px', fontWeight: 600, color: C.ink }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {quoteData.milestones.map((m, i) => (
                  <tr key={m.id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '6px 7px', color: C.ink }}>{m.label || '—'}</td>
                    <td style={{ padding: '6px 7px', textAlign: 'right', color: C.gray }}>{m.due_date ? fmtDate(m.due_date) : '—'}</td>
                    <td style={{ padding: '6px 7px', textAlign: 'right', color: C.ink, fontWeight: 500 }}>{fmtMoney(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {quoteData.notes && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.rosa, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'sans-serif' }}>
              Notes &amp; Terms
            </div>
            <div style={{ fontSize: 11, color: C.inkLight, lineHeight: 1.65, fontFamily: 'sans-serif' }}>{quoteData.notes}</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 28px', background: C.rosaPale,
        borderTop: `1px solid ${C.border}`,
        fontFamily: 'sans-serif', fontSize: 10, color: C.gray,
        textAlign: 'center',
      }}>
        {quoteData.expires_at
          ? `Valid until ${fmtDate(quoteData.expires_at)} \u00b7 ${boutique?.name || 'Your Boutique'}`
          : boutique?.name || 'Your Boutique'}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function QuoteBuilderPage() {
  const { boutique } = useAuth();
  const toast = useToast();
  const { events, loading: eventsLoading } = useEvents();

  const [quoteData, setQuoteData] = useState(() => blankQuote());
  const [blankMode, setBlankMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [nextLineId, setNextLineId] = useState(2);
  const [nextMsId, setNextMsId] = useState(1);

  // ── Derived totals ──────────────────────────────────────────────────────────
  const subtotal = useMemo(() => {
    return quoteData.line_items.reduce(
      (s, li) => s + (Number(li.qty) || 1) * (Number(li.unit_price) || 0),
      0
    );
  }, [quoteData.line_items]);

  const discountAmt = useMemo(() => {
    if (!quoteData.discount_value) return 0;
    if (quoteData.discount_type === 'percent') {
      return subtotal * (Number(quoteData.discount_value) / 100);
    }
    return Math.min(Number(quoteData.discount_value), subtotal);
  }, [subtotal, quoteData.discount_type, quoteData.discount_value]);

  const total = Math.max(0, subtotal - discountAmt);

  // ── Field helper ────────────────────────────────────────────────────────────
  const set = useCallback((key, value) => {
    setQuoteData(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Select event ─────────────────────────────────────────────────────────────
  function handleSelectEvent(eventId) {
    if (!eventId) {
      setQuoteData(blankQuote());
      return;
    }
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;

    // Pre-fill line items from package/total if event has one
    const pkgItems = [];
    if (ev.total) {
      pkgItems.push({
        id: 1,
        description: ev.package_id ? 'Event package' : 'Event services',
        qty: 1,
        unit_price: Number(ev.total) || 0,
      });
    }

    // Pre-fill milestones from the event
    const evMilestones = (ev.milestones || []).map((m, i) => ({
      id: i + 1,
      label: m.label || '',
      due_date: m.due_date || '',
      amount: Number(m.amount) || 0,
    }));

    setNextLineId(pkgItems.length + 1);
    setNextMsId(evMilestones.length + 1);

    setQuoteData({
      event_id: eventId,
      client_name: ev.clientData?.name || ev.client || '',
      event_type: ev.type || 'wedding',
      event_date: ev.event_date || '',
      venue: ev.venue || '',
      expires_at: addDays(isoToday(), 30),
      line_items: pkgItems.length
        ? pkgItems
        : [{ id: 1, description: '', qty: 1, unit_price: 0 }],
      milestones: evMilestones,
      discount_type: 'fixed',
      discount_value: 0,
      notes: '',
      _clientPhone: ev.clientData?.phone || '',
    });
  }

  // ── Line items ───────────────────────────────────────────────────────────────
  function addLineItem() {
    const newId = nextLineId;
    setNextLineId(n => n + 1);
    setQuoteData(prev => ({
      ...prev,
      line_items: [...prev.line_items, { id: newId, description: '', qty: 1, unit_price: 0 }],
    }));
  }

  function updateLineItem(id, key, value) {
    setQuoteData(prev => ({
      ...prev,
      line_items: prev.line_items.map(li => li.id === id ? { ...li, [key]: value } : li),
    }));
  }

  function removeLineItem(id) {
    setQuoteData(prev => ({
      ...prev,
      line_items: prev.line_items.filter(li => li.id !== id),
    }));
  }

  // ── Milestones ───────────────────────────────────────────────────────────────
  function addMilestone() {
    const newId = nextMsId;
    setNextMsId(n => n + 1);
    setQuoteData(prev => ({
      ...prev,
      milestones: [...prev.milestones, { id: newId, label: '', due_date: '', amount: 0 }],
    }));
  }

  function updateMilestone(id, key, value) {
    setQuoteData(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => m.id === id ? { ...m, [key]: value } : m),
    }));
  }

  function removeMilestone(id) {
    setQuoteData(prev => ({
      ...prev,
      milestones: prev.milestones.filter(m => m.id !== id),
    }));
  }

  // ── Save quote ───────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!quoteData.client_name.trim()) {
      toast('Client name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        boutique_id: boutique.id,
        event_id: quoteData.event_id || null,
        client_name: quoteData.client_name.trim(),
        event_type: quoteData.event_type || null,
        event_date: quoteData.event_date || null,
        venue: quoteData.venue || null,
        expires_at: quoteData.expires_at || null,
        line_items: quoteData.line_items,
        milestones: quoteData.milestones,
        discount_type: quoteData.discount_type,
        discount_value: quoteData.discount_value || 0,
        notes: quoteData.notes || null,
        status: 'draft',
        pdf_url: pdfUrl || null,
        total,
      };
      const { error } = await supabase.from('quotes').insert(payload);
      if (error) throw error;
      toast('Quote saved!');
    } catch (err) {
      toast('Failed to save: ' + String(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Generate PDF ─────────────────────────────────────────────────────────────
  async function handleGeneratePdf() {
    if (!quoteData.client_name.trim()) {
      toast('Add a client name first', 'error');
      return;
    }
    setGeneratingPdf(true);
    try {
      const body = {
        type: 'quote',
        boutique: {
          name: boutique?.name || '',
          phone: boutique?.phone || '',
          email: boutique?.email || '',
          address: boutique?.address || '',
        },
        quote: {
          client_name: quoteData.client_name,
          event_type: EVENT_TYPE_OPTIONS.find(o => o.value === quoteData.event_type)?.label || quoteData.event_type,
          event_date: quoteData.event_date,
          venue: quoteData.venue,
          expires_at: quoteData.expires_at,
          line_items: quoteData.line_items,
          milestones: quoteData.milestones,
          discount_type: quoteData.discount_type,
          discount_value: quoteData.discount_value,
          subtotal,
          discount_amt: discountAmt,
          total,
          notes: quoteData.notes,
        },
      };

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('application/pdf')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        window.open(url, '_blank');
        toast('PDF generated!');
      } else {
        // HTML fallback — user can print to PDF
        const html = await res.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        window.open(url, '_blank');
        toast('Preview opened — use Print to save as PDF');
      }
    } catch (err) {
      toast('PDF generation failed: ' + String(err), 'error');
    } finally {
      setGeneratingPdf(false);
    }
  }

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const sectionCard = {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: '20px 22px',
    marginBottom: 16,
  };

  const fieldRow = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 12,
  };

  const toggleBtn = (active) => ({
    padding: '5px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 500,
    background: active ? C.rosa : C.grayBg,
    color: active ? C.white : C.gray,
    border: 'none',
    transition: 'background 0.15s, color 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.grayBg }}>
      <Topbar title="Quote / Proposal Builder" subtitle="Create and send professional proposals to clients" />

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)',
          gap: 24,
          alignItems: 'start',
          maxWidth: 1280,
          margin: '0 auto',
        }}>

          {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
          <div>

            {/* Step 1 — Select Event */}
            <div style={sectionCard}>
              <SectionHeader number={1} title="Select Event" />
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button style={toggleBtn(!blankMode)} onClick={() => setBlankMode(false)}>
                  Link to event
                </button>
                <button style={toggleBtn(blankMode)} onClick={() => { setBlankMode(true); setQuoteData(blankQuote()); }}>
                  Start blank
                </button>
              </div>

              {!blankMode && (
                <div>
                  <div style={LBL}>Choose an event</div>
                  <select
                    value={quoteData.event_id}
                    onChange={e => handleSelectEvent(e.target.value)}
                    style={inputSt}
                    disabled={eventsLoading}
                  >
                    <option value="">— Select event —</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.clientData?.name || ev.client || 'Unknown client'}{' '}
                        · {EVT_TYPES[ev.type]?.label || ev.type}{' '}
                        · {ev.event_date || 'No date'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Step 2 — Quote Details */}
            <div style={sectionCard}>
              <SectionHeader number={2} title="Quote Details" />
              <div style={{ marginBottom: 12 }}>
                <div style={LBL}>Client name *</div>
                <input
                  style={inputSt}
                  value={quoteData.client_name}
                  onChange={e => set('client_name', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div style={fieldRow}>
                <div>
                  <div style={LBL}>Event type</div>
                  <select style={inputSt} value={quoteData.event_type} onChange={e => set('event_type', e.target.value)}>
                    {EVENT_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={LBL}>Event date</div>
                  <input
                    type="date"
                    style={inputSt}
                    value={quoteData.event_date}
                    onChange={e => set('event_date', e.target.value)}
                  />
                </div>
              </div>
              <div style={fieldRow}>
                <div>
                  <div style={LBL}>Venue</div>
                  <input
                    style={inputSt}
                    value={quoteData.venue}
                    onChange={e => set('venue', e.target.value)}
                    placeholder="Venue name"
                  />
                </div>
                <div>
                  <div style={LBL}>Quote expires</div>
                  <input
                    type="date"
                    style={inputSt}
                    value={quoteData.expires_at}
                    onChange={e => set('expires_at', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Step 3 — Services & Pricing */}
            <div style={sectionCard}>
              <SectionHeader number={3} title="Services &amp; Pricing" />

              <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 420 }}>
                  <thead>
                    <tr style={{ background: C.rosaPale }}>
                      <th style={{ textAlign: 'left', padding: '7px 8px', fontWeight: 600, color: C.ink, fontSize: 11 }}>Description</th>
                      <th style={{ textAlign: 'center', padding: '7px 8px', fontWeight: 600, color: C.ink, fontSize: 11, width: 60 }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 600, color: C.ink, fontSize: 11, width: 108 }}>Unit price</th>
                      <th style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 600, color: C.ink, fontSize: 11, width: 90 }}>Total</th>
                      <th style={{ width: 30 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteData.line_items.map((li, i) => (
                      <tr key={li.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : C.ivory }}>
                        <td style={{ padding: '4px 4px' }}>
                          <input
                            style={{ ...inputSt, padding: '5px 7px', border: 'none', background: 'transparent' }}
                            value={li.description}
                            onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                            placeholder="Description"
                          />
                        </td>
                        <td style={{ padding: '4px 4px' }}>
                          <input
                            type="number"
                            min={1}
                            style={{ ...inputSt, padding: '5px 7px', textAlign: 'center', border: 'none', background: 'transparent' }}
                            value={li.qty}
                            onChange={e => updateLineItem(li.id, 'qty', Number(e.target.value))}
                          />
                        </td>
                        <td style={{ padding: '4px 4px' }}>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            style={{ ...inputSt, padding: '5px 7px', textAlign: 'right', border: 'none', background: 'transparent' }}
                            value={li.unit_price}
                            onChange={e => updateLineItem(li.id, 'unit_price', Number(e.target.value))}
                          />
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500, color: C.ink, fontSize: 13, whiteSpace: 'nowrap' }}>
                          {fmtMoney((li.qty || 1) * (li.unit_price || 0))}
                        </td>
                        <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                          {quoteData.line_items.length > 1 && (
                            <button
                              onClick={() => removeLineItem(li.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 17, lineHeight: 1, padding: 2 }}
                              title="Remove line"
                            >×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addLineItem}
                style={{
                  background: 'none', border: `1.5px dashed ${C.border}`,
                  borderRadius: 7, padding: '7px 14px', fontSize: 12,
                  color: C.rosa, cursor: 'pointer', width: '100%', marginBottom: 16,
                }}
              >+ Add line item</button>

              {/* Discount row */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <div style={LBL}>Discount type</div>
                  <select
                    style={{ ...inputSt, width: 120 }}
                    value={quoteData.discount_type}
                    onChange={e => set('discount_type', e.target.value)}
                  >
                    <option value="fixed">$ Fixed</option>
                    <option value="percent">% Percent</option>
                  </select>
                </div>
                <div>
                  <div style={LBL}>Discount value</div>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    style={{ ...inputSt, width: 110 }}
                    value={quoteData.discount_value}
                    onChange={e => set('discount_value', Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Subtotal / Total */}
              <div style={{
                marginTop: 16, padding: '12px 16px', background: C.rosaPale,
                borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end',
              }}>
                <div style={{ display: 'flex', gap: 40, fontSize: 13, color: C.gray }}>
                  <span>Subtotal</span><span>{fmtMoney(subtotal)}</span>
                </div>
                {discountAmt > 0 && (
                  <div style={{ display: 'flex', gap: 40, fontSize: 13, color: C.green }}>
                    <span>Discount</span><span>− {fmtMoney(discountAmt)}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex', gap: 40, fontSize: 16, fontWeight: 700, color: C.rosa,
                  borderTop: `1px solid ${C.rosaLight}`, paddingTop: 7, marginTop: 2,
                }}>
                  <span>Total</span><span>{fmtMoney(total)}</span>
                </div>
              </div>
            </div>

            {/* Step 4 — Payment Schedule */}
            <div style={sectionCard}>
              <SectionHeader number={4} title="Payment Schedule" />

              {quoteData.milestones.length === 0 && (
                <div style={{ fontSize: 13, color: C.gray, marginBottom: 12 }}>
                  No milestones yet. Add payment milestones below.
                </div>
              )}

              {quoteData.milestones.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {quoteData.milestones.map((m) => (
                    <div key={m.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 148px 110px 28px',
                      gap: 8, alignItems: 'center',
                      background: C.ivory, borderRadius: 8, padding: '8px 10px',
                    }}>
                      <input
                        style={{ ...inputSt, padding: '5px 8px' }}
                        value={m.label}
                        onChange={e => updateMilestone(m.id, 'label', e.target.value)}
                        placeholder="e.g. Deposit"
                      />
                      <input
                        type="date"
                        style={{ ...inputSt, padding: '5px 8px' }}
                        value={m.due_date}
                        onChange={e => updateMilestone(m.id, 'due_date', e.target.value)}
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        style={{ ...inputSt, padding: '5px 8px' }}
                        value={m.amount}
                        onChange={e => updateMilestone(m.id, 'amount', Number(e.target.value))}
                        placeholder="Amount"
                      />
                      <button
                        onClick={() => removeMilestone(m.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 17, lineHeight: 1 }}
                        title="Remove"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={addMilestone}
                style={{
                  background: 'none', border: `1.5px dashed ${C.border}`,
                  borderRadius: 7, padding: '7px 14px', fontSize: 12,
                  color: C.rosa, cursor: 'pointer', width: '100%',
                }}
              >+ Add milestone</button>
            </div>

            {/* Step 5 — Notes */}
            <div style={sectionCard}>
              <SectionHeader number={5} title="Notes &amp; Terms" />
              <textarea
                rows={4}
                style={{ ...inputSt, resize: 'vertical', lineHeight: 1.65 }}
                value={quoteData.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Additional terms, conditions, or notes for the client…"
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingBottom: 32 }}>
              <PrimaryBtn
                label={generatingPdf ? 'Generating…' : 'Generate PDF'}
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
              />
              <GhostBtn
                label="Send via SMS"
                onClick={() => setShowSmsModal(true)}
              />
              <GhostBtn
                label={saving ? 'Saving…' : 'Save Quote'}
                onClick={handleSave}
                disabled={saving}
              />
            </div>
          </div>

          {/* ── RIGHT PANEL: Live Preview ────────────────────────────────── */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: C.gray,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 10,
            }}>
              Live Preview
            </div>
            <QuotePreview
              quoteData={quoteData}
              boutique={boutique}
              subtotal={subtotal}
              discountAmt={discountAmt}
              total={total}
            />
          </div>

        </div>
      </div>

      {showSmsModal && (
        <SmsModal
          quoteData={quoteData}
          boutique={boutique}
          pdfUrl={pdfUrl}
          total={total}
          onClose={() => setShowSmsModal(false)}
        />
      )}
    </div>
  );
}
