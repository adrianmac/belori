import React, { useState, useMemo } from 'react';
import { C, fmt, pct, EVT_TYPES } from '../lib/colors';
import { Avatar, Badge, Card, CardHead, Topbar, PrimaryBtn, GhostBtn, StatusDot,
  SvcTag, useToast, inputSt, LBL, EmptyState, SkeletonList } from '../lib/ui.jsx';
import ConfirmModal from '../components/ConfirmModal';
import { useLayoutMode } from '../hooks/useLayoutMode.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generatePaymentPlan } from '../hooks/usePayments';

// ─── REMINDER MODAL ──────────────────────────────────────────────────────────
const ReminderModal = ({ payment, boutiqueName, boutique, logReminder, onClose }) => {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  const daysLate = payment.daysLate || 0;
  const smsText = [
    `Hi ${payment.clientFull || payment.client},`,
    daysLate > 0
      ? `this is a reminder that your payment of ${fmt(payment.amount)} for your event was due ${daysLate} day${daysLate !== 1 ? 's' : ''} ago.`
      : `this is a reminder that your payment of ${fmt(payment.amount)} for your event is coming up soon.`,
    payment.stripe_payment_link_url
      ? `Pay securely online: ${payment.stripe_payment_link_url}`
      : `Please contact us at your earliest convenience to arrange payment.`,
    boutiqueName ? `— ${boutiqueName}` : '',
  ].filter(Boolean).join(' ');

  const copy = async () => {
    await navigator.clipboard.writeText(smsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const log = async () => {
    setLogging(true);
    await logReminder(payment.id);
    setLogging(false);
    setLogged(true);
    toast('Reminder logged ✓');
    setTimeout(onClose, 800);
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{background:C.white,borderRadius:16,width:460,boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>
        <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Send payment reminder</span>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
          {/* Client info */}
          <div style={{display:'flex',gap:12,padding:'12px',background:C.ivory,borderRadius:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:C.ink}}>{payment.clientFull || payment.client}</div>
              <div style={{fontSize:12,color:C.gray,marginTop:2}}>{payment.event}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--color-danger)'}}>{fmt(payment.amount)}</div>
              <div style={{fontSize:11,color:'var(--color-danger)',marginTop:2}}>
                {daysLate > 0 ? `${daysLate} day${daysLate!==1?'s':''} overdue` : `Due ${payment.due}`}
              </div>
            </div>
          </div>

          {/* Phone */}
          {payment.clientPhone && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:11,color:C.gray}}>Phone:</span>
              <a href={`tel:${payment.clientPhone}`} style={{fontSize:13,fontWeight:500,color:C.rosa,textDecoration:'none'}}>{payment.clientPhone}</a>
            </div>
          )}

          {/* SMS template */}
          <div>
            <div style={{fontSize:11,fontWeight:500,color:C.gray,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Message template</div>
            <div style={{background:C.ivory,borderRadius:9,padding:'12px 14px',fontSize:13,color:C.ink,lineHeight:1.6,border:`1px solid ${C.border}`}}>
              {smsText}
            </div>
            {boutique?.whatsapp_number && (
              <a
                href={`https://wa.me/${(boutique.whatsapp_number||'').replace(/\D/g,'')}?text=${encodeURIComponent(smsText)}`}
                target="_blank" rel="noopener noreferrer"
                style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'10px 16px',background:'#25D366',color:'#fff',borderRadius:9,textDecoration:'none',fontSize:13,fontWeight:600,marginTop:8}}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Send via WhatsApp
              </a>
            )}
          </div>

          {/* Last reminded */}
          {payment.last_reminded_at && (
            <div style={{fontSize:11,color:C.gray}}>
              Last reminder sent: {new Date(payment.last_reminded_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            </div>
          )}
        </div>
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,justifyContent:'space-between'}}>
          <GhostBtn label="Cancel" onClick={onClose}/>
          <div style={{display:'flex',gap:8}}>
            <GhostBtn label={copied ? '✓ Copied!' : 'Copy message'} onClick={copy}/>
            <PrimaryBtn
              label={logged ? '✓ Logged' : logging ? 'Logging…' : 'Log reminder sent'}
              colorScheme="success"
              onClick={log}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── PAYMENT PLAN MODAL ───────────────────────────────────────────────────────
const FREQ_OPTIONS = [
  { label: 'Monthly',    days: 30 },
  { label: 'Bi-weekly',  days: 14 },
  { label: 'Weekly',     days: 7  },
];
const INSTALLMENT_OPTIONS = [2, 3, 4, 6, 12];

const PaymentPlanModal = ({ events, payments: allPayments, createMilestone, onClose }) => {
  const toast = useToast();
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [selectedEventId, setSelectedEventId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [installmentCount, setInstallmentCount] = useState(3);
  const [freqDays, setFreqDays] = useState(30);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  // Step 2 state
  const [saving, setSaving] = useState(false);

  // Unique events from all payments (deduplicated by event_id)
  const eventOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    for (const p of allPayments) {
      if (p.event_id && !seen.has(p.event_id)) {
        seen.add(p.event_id);
        opts.push({ id: p.event_id, label: `${p.clientFull || p.client} — ${p.event}` });
      }
    }
    // Also include from events prop if available
    if (events) {
      for (const e of events) {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          const evtLabel = EVT_TYPES[e.type]?.label || e.type;
          const dateStr = e.event_date ? new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          opts.push({ id: e.id, label: `${e.client_name || 'Unknown'} — ${evtLabel} ${dateStr}` });
        }
      }
    }
    return opts;
  }, [allPayments, events]);

  // Find selected event totals from payments
  const eventPayments = useMemo(() =>
    allPayments.filter(p => p.event_id === selectedEventId),
    [allPayments, selectedEventId]
  );

  // Try to derive total / already paid from first matching payment's event data
  const eventTotal = useMemo(() => {
    const evt = events?.find(e => e.id === selectedEventId);
    return evt ? Number(evt.total || 0) : 0;
  }, [events, selectedEventId]);

  const alreadyPaid = useMemo(() => {
    const evt = events?.find(e => e.id === selectedEventId);
    return evt ? Number(evt.paid || 0) : 0;
  }, [events, selectedEventId]);

  const remainingBalance = Math.max(0, eventTotal - alreadyPaid);

  // Default deposit to 30% of total when event is selected
  const effectiveDeposit = depositAmount !== '' ? Number(depositAmount) : Math.round(remainingBalance * 0.3 * 100) / 100;

  // Generate plan preview
  const planRows = useMemo(() => {
    if (!selectedEventId || remainingBalance <= 0) return [];
    return generatePaymentPlan({
      totalAmount: remainingBalance,
      depositAmount: effectiveDeposit,
      installmentCount,
      startDate,
      frequencyDays: freqDays,
    });
  }, [selectedEventId, remainingBalance, effectiveDeposit, installmentCount, startDate, freqDays]);

  const planTotal = planRows.reduce((s, r) => s + r.amount, 0);
  const roundingDiff = Math.abs(planTotal - remainingBalance);

  const canProceed = selectedEventId && remainingBalance > 0 && planRows.length > 0;

  const handleConfirm = async () => {
    setSaving(true);
    let hasError = false;
    for (const row of planRows) {
      const { error } = await createMilestone({
        event_id: selectedEventId,
        label: row.label,
        amount: row.amount,
        due_date: row.due_date,
        status: 'pending',
      });
      if (error) { hasError = true; break; }
    }
    setSaving(false);
    if (hasError) {
      toast('Failed to create some milestones', 'error');
    } else {
      toast(`Payment plan created — ${planRows.length} milestones added ✓`);
      onClose();
    }
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{background:C.white,borderRadius:16,width:540,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>
        {/* Header */}
        <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Create Payment Plan</span>
            <span style={{fontSize:12,color:C.gray,marginLeft:10}}>Step {step} of 2</span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:16}}>
          {step === 1 && (
            <>
              {/* Event selector */}
              <div>
                <div style={LBL}>Event</div>
                <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); setDepositAmount(''); }}
                  style={{...inputSt}}>
                  <option value="">Select an event…</option>
                  {eventOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Balance display */}
              {selectedEventId && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  {[
                    { label:'Total',           val: fmt(eventTotal) },
                    { label:'Already paid',    val: fmt(alreadyPaid) },
                    { label:'Remaining',       val: fmt(remainingBalance), bold:true },
                  ].map(s => (
                    <div key={s.label} style={{background:C.ivory,borderRadius:8,padding:'10px 12px'}}>
                      <div style={{fontSize:10,color:C.gray}}>{s.label}</div>
                      <div style={{fontSize:16,fontWeight:s.bold?600:400,color:s.bold?C.rosa:C.ink,marginTop:2}}>{s.val}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Deposit amount */}
              <div>
                <div style={LBL}>Deposit amount</div>
                <input
                  type="number" min="0" step="0.01"
                  placeholder={`${fmt(effectiveDeposit)} (30% default)`}
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  style={inputSt}
                />
              </div>

              {/* Installment count */}
              <div>
                <div style={LBL}>Number of installments</div>
                <div style={{display:'flex',gap:6}}>
                  {INSTALLMENT_OPTIONS.map(n => (
                    <button key={n} onClick={() => setInstallmentCount(n)}
                      style={{flex:1,padding:'8px 0',borderRadius:8,border:`1.5px solid ${installmentCount===n?C.rosa:C.border}`,
                        background:installmentCount===n?C.rosaPale:C.white,color:installmentCount===n?C.rosa:C.gray,
                        fontSize:13,fontWeight:installmentCount===n?600:400,cursor:'pointer'}}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <div style={LBL}>Frequency</div>
                <div style={{display:'flex',gap:6}}>
                  {FREQ_OPTIONS.map(f => (
                    <button key={f.days} onClick={() => setFreqDays(f.days)}
                      style={{flex:1,padding:'8px 0',borderRadius:8,border:`1.5px solid ${freqDays===f.days?C.rosa:C.border}`,
                        background:freqDays===f.days?C.rosaPale:C.white,color:freqDays===f.days?C.rosa:C.gray,
                        fontSize:12,fontWeight:freqDays===f.days?600:400,cursor:'pointer'}}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start date */}
              <div>
                <div style={LBL}>First payment date</div>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputSt}/>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{fontSize:13,fontWeight:500,color:C.ink}}>Review your payment plan</div>

              {/* Rounding warning */}
              {roundingDiff > 0.01 && (
                <div style={{padding:'10px 14px',background:C.amberBg,borderRadius:8,fontSize:12,color:C.amber}}>
                  Rounding difference of {fmt(roundingDiff)} — auto-adjusted in the final payment.
                </div>
              )}

              {/* Plan table */}
              <div style={{border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{background:C.ivory}}>
                      {['#','Label','Due Date','Amount'].map(h => (
                        <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:500,color:C.gray,borderBottom:`1px solid ${C.border}`}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {planRows.map((row, i) => (
                      <tr key={i} style={{borderBottom:i<planRows.length-1?`1px solid ${C.border}`:'none'}}>
                        <td style={{padding:'9px 12px',color:C.gray,fontWeight:500}}>{i+1}</td>
                        <td style={{padding:'9px 12px',color:C.ink,fontWeight:i===0?600:400}}>{row.label}</td>
                        <td style={{padding:'9px 12px',color:C.gray}}>
                          {new Date(row.due_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                        </td>
                        <td style={{padding:'9px 12px',color:C.ink,fontWeight:500}}>{fmt(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{background:C.ivory,borderTop:`2px solid ${C.border}`}}>
                      <td colSpan={3} style={{padding:'9px 12px',fontSize:12,fontWeight:600,color:C.ink}}>Total</td>
                      <td style={{padding:'9px 12px',fontWeight:700,color:C.rosa}}>{fmt(planTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,justifyContent:'space-between',flexShrink:0}}>
          <GhostBtn label={step===1?'Cancel':'← Back'} onClick={step===1?onClose:()=>setStep(1)}/>
          {step === 1 ? (
            <PrimaryBtn label="Preview plan →" disabled={!canProceed} onClick={() => setStep(2)}/>
          ) : (
            <PrimaryBtn
              label={saving ? 'Creating…' : `Confirm & Create ${planRows.length} Milestones`}
              colorScheme="success"
              disabled={saving}
              onClick={handleConfirm}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── CSV EXPORT HELPER ─────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  if (!rows || rows.length === 0) return;
  const header = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// ─── QUICK PAY MODAL ─────────────────────────────────────────────────────────
const PAYMENT_METHODS = ['Cash', 'Check', 'Zelle', 'Venmo', 'Card', 'Other'];

const QuickPayModal = ({ payments: allPayments, boutique, onClose, onSuccess }) => {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null); // { name, clientFull, client_id }
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Build unique client list from unpaid payments
  const clientOptions = useMemo(() => {
    const seen = new Map();
    for (const p of allPayments) {
      if (!p.client_id) continue;
      if (!seen.has(p.client_id)) {
        seen.set(p.client_id, {
          client_id: p.client_id,
          clientFull: p.clientFull || p.client || '',
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.clientFull.localeCompare(b.clientFull));
  }, [allPayments]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clientOptions;
    const q = clientSearch.toLowerCase();
    return clientOptions.filter(c => c.clientFull.toLowerCase().includes(q));
  }, [clientOptions, clientSearch]);

  // Unpaid milestones for selected client
  const clientMilestones = useMemo(() => {
    if (!selectedClient) return [];
    return allPayments.filter(
      p => p.client_id === selectedClient.client_id && p.status !== 'paid'
    );
  }, [allPayments, selectedClient]);

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearch(client.clientFull);
    setShowDropdown(false);
    setSelectedMilestone(null);
    setAmount('');
  };

  const handleSelectMilestone = (m) => {
    setSelectedMilestone(m);
    setAmount(String(m.amount));
  };

  const handleSave = async () => {
    if (!selectedMilestone) { toast('Select a milestone', 'warn'); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { toast('Enter a valid amount', 'warn'); return; }
    if (!date) { toast('Select a payment date', 'warn'); return; }

    setSaving(true);
    try {
      // Mark milestone paid
      const { error: milestoneError } = await supabase
        .from('payment_milestones')
        .update({ status: 'paid', paid_date: date })
        .eq('id', selectedMilestone.id)
        .eq('boutique_id', boutique.id);

      if (milestoneError) throw milestoneError;

      // Log client interaction
      const body = `${fmt(Number(amount))} received via ${method}${note ? ` — ${note}` : ''}`;
      await supabase.from('client_interactions').insert({
        boutique_id: boutique.id,
        client_id: selectedClient.client_id,
        type: 'payment',
        title: 'Payment received',
        body,
        occurred_at: date,
        is_editable: false,
        author_name: 'Staff',
      });

      toast('Payment recorded ✓');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('QuickPay error:', err);
      toast('Failed to record payment', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{maxWidth:440,width:'100%',background:C.white,borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,0.18)',overflow:'hidden',display:'flex',flexDirection:'column',maxHeight:'92vh'}}>
        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <span style={{fontWeight:600,fontSize:15,color:C.ink}}>⚡ Quick Pay</span>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'0 2px'}}>×</button>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:14}}>

          {/* Client search */}
          <div style={{position:'relative'}}>
            <div style={LBL}>Client</div>
            <input
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setShowDropdown(true); setSelectedClient(null); setSelectedMilestone(null); setAmount(''); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search client…"
              style={inputSt}
              autoComplete="off"
            />
            {showDropdown && filteredClients.length > 0 && (
              <div style={{position:'absolute',top:'100%',left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,0.10)',zIndex:10,maxHeight:200,overflowY:'auto',marginTop:2}}>
                {filteredClients.map(c => (
                  <div
                    key={c.client_id}
                    onMouseDown={() => handleSelectClient(c)}
                    style={{padding:'9px 12px',fontSize:13,color:C.ink,cursor:'pointer',borderBottom:`1px solid ${C.border}`}}
                    onMouseEnter={e => e.currentTarget.style.background = C.ivory}
                    onMouseLeave={e => e.currentTarget.style.background = C.white}
                  >
                    {c.clientFull}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Milestone selector */}
          {selectedClient && (
            <div>
              <div style={LBL}>Milestone</div>
              {clientMilestones.length === 0 ? (
                <div style={{padding:'10px 12px',background:C.grayBg,borderRadius:8,fontSize:13,color:C.gray}}>
                  No open milestones for this client.
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {clientMilestones.map(m => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMilestone(m)}
                      style={{
                        padding:'10px 12px',borderRadius:8,cursor:'pointer',fontSize:13,
                        border:`1.5px solid ${selectedMilestone?.id === m.id ? C.rosa : C.border}`,
                        background: selectedMilestone?.id === m.id ? C.rosaPale : C.white,
                        display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,
                      }}
                    >
                      <div>
                        <span style={{fontWeight:500,color:C.ink}}>{m.label}</span>
                        <span style={{fontSize:11,color:C.gray,marginLeft:8}}>{m.event}</span>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontWeight:600,color:m.status==='overdue'?'var(--color-danger)':C.ink}}>{fmt(m.amount)}</div>
                        <div style={{fontSize:10,color:m.status==='overdue'?'var(--color-danger)':C.gray}}>Due {m.due}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Amount */}
          <div>
            <div style={LBL}>Amount</div>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={inputSt}
            />
          </div>

          {/* Payment method */}
          <div>
            <div style={LBL}>Payment method</div>
            <select value={method} onChange={e => setMethod(e.target.value)} style={inputSt}>
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <div style={LBL}>Date</div>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={inputSt}
            />
          </div>

          {/* Note */}
          <div>
            <div style={LBL}>Note (optional)</div>
            <input
              type="text"
              placeholder="e.g. check #1042"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={inputSt}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,justifyContent:'space-between',flexShrink:0}}>
          <GhostBtn label="Cancel" onClick={onClose}/>
          <PrimaryBtn
            label={saving ? 'Saving…' : 'Record payment'}
            colorScheme="success"
            disabled={saving || !selectedMilestone || !amount || !date}
            onClick={handleSave}
          />
        </div>
      </div>
    </div>
  );
};

// ─── INVOICE DOWNLOAD ─────────────────────────────────────────────────────
const downloadInvoice = (eventId, clientName) => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf?type=receipt&event_id=${eventId}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${clientName?.replace(/\s+/g, '-') || eventId}.pdf`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// ─── PAYMENTS ──────────────────────────────────────────────────────────────
const Payments = ({payments: livePayments, markPaid, logReminder, deleteMilestone, createMilestone, setScreen, setSelectedEvent, events}) => {
  const toast = useToast();
  const { boutique, myRole } = useAuth();
  const allPayments = livePayments;
  const [tab, setTab] = useState('all');
  const [reminderPayment, setReminderPayment] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipEventId, setTipEventId] = useState(null);
  const [tipAmount, setTipAmount] = useState('');
  const [tipSaving, setTipSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, milestoneId: null });

  const filtered = tab === 'all' ? allPayments : allPayments.filter(p => p.status === tab);
  const totalOverdue = allPayments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);
  const totalPending = allPayments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    const selectable = filtered.filter(p => p.status !== 'paid').map(p => p.id);
    setSelected(s => s.size === selectable.length ? new Set() : new Set(selectable));
  };
  const selectedArr = filtered.filter(p => selected.has(p.id));

  const bulkMarkPaid = async () => {
    if (!selectedArr.length) return;
    setBulkWorking(true);
    for (const p of selectedArr) await markPaid?.(p.id);
    toast(`${selectedArr.length} payment${selectedArr.length!==1?'s':''} marked paid ✓`);
    setSelected(new Set());
    setBulkWorking(false);
  };

  const bulkRemind = async () => {
    const overdue = selectedArr.filter(p => p.status === 'overdue');
    if (!overdue.length) return;
    setBulkWorking(true);
    for (const p of overdue) await logReminder?.(p.id);
    toast(`Reminders logged for ${overdue.length} client${overdue.length!==1?'s':''} ✓`);
    setSelected(new Set());
    setBulkWorking(false);
  };

  const bulkExport = () => {
    const rows = selectedArr.map(p => ({
      event: p.event || '',
      client: p.clientFull || p.client || '',
      label: p.label || '',
      amount: p.amount || 0,
      due_date: p.due || '',
      status: p.status || '',
    }));
    downloadCSV(rows, 'payments-export.csv');
    toast(`${rows.length} payment${rows.length!==1?'s':''} exported ✓`);
    setSelected(new Set());
  };

  const sendAllReminders = async () => {
    const overdue = allPayments.filter(p => p.status === 'overdue');
    for (const p of overdue) await logReminder?.(p.id);
    toast(`Reminders logged for ${overdue.length} client${overdue.length !== 1 ? 's' : ''} ✓`);
  };

  const selectAllOverdue = () => {
    const overdueIds = allPayments.filter(p => p.status === 'overdue').map(p => p.id);
    setBulkSelected(new Set(overdueIds));
  };

  const handleBulkReminder = async () => {
    if (!bulkSelected.size) return;
    setBulkSending(true);
    const selectedMilestones = allPayments.filter(m => bulkSelected.has(m.id));
    let sent = 0;
    for (const m of selectedMilestones) {
      const eventData = events?.find(e => e.id === m.event_id);
      if (eventData?.client_id) {
        await supabase.from('client_interactions').insert({
          boutique_id: boutique.id,
          client_id: eventData.client_id,
          type: 'sms',
          title: `Payment reminder sent — ${m.label}`,
          body: `Reminder sent for ${fmt(Number(m.amount))} due ${m.due_date}`,
          occurred_at: new Date().toISOString(),
          is_editable: false,
          author_name: 'System',
        });
      }
      await supabase.from('payment_milestones')
        .update({ last_reminded_at: new Date().toISOString() })
        .eq('id', m.id)
        .eq('boutique_id', boutique.id);
      sent++;
    }
    setBulkSending(false);
    setBulkSelected(new Set());
    toast(`Reminders logged for ${sent} milestone${sent !== 1 ? 's' : ''}`);
  };

  // Group milestones by event_id to detect "payment plan" events (≥3 unpaid on same event)
  const planEventIds = useMemo(() => {
    const counts = {};
    for (const p of allPayments) {
      if (p.event_id && p.status !== 'paid') counts[p.event_id] = (counts[p.event_id] || 0) + 1;
    }
    return new Set(Object.entries(counts).filter(([, n]) => n >= 3).map(([id]) => id));
  }, [allPayments]);

  // Per-event plan progress (paid / total milestones)
  const planProgress = useMemo(() => {
    // We only have unpaid here, but we can infer from what we have
    const byEvent = {};
    for (const p of allPayments) {
      if (!p.event_id) continue;
      if (!byEvent[p.event_id]) byEvent[p.event_id] = { unpaid: 0 };
      byEvent[p.event_id].unpaid++;
    }
    return byEvent;
  }, [allPayments]);

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <Topbar title="Payments" subtitle="Milestone billing & collection"
        actions={<>
          <GhostBtn label="Send all reminders" className="topbar-hide" onClick={sendAllReminders}/>
          <GhostBtn label="⚡ Quick Pay" onClick={() => setShowQuickPay(true)}/>
          <GhostBtn label="📅 Payment Plan" onClick={() => setShowPlanModal(true)}/>
          <PrimaryBtn label="+ Create milestone" colorScheme="success" onClick={()=>{setScreen('events');toast('Select an event to add a milestone','warn');}}/>
        </>}
      />
      <div className="stat-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,padding:'16px 20px',background:C.white,borderBottom:`1px solid ${C.border}`}}>
        {[
          {label:'Outstanding balance', val:fmt(totalPending),          col:'var(--color-warning)'},
          {label:'Overdue',             val:fmt(totalOverdue),          col:'var(--color-danger)'},
          {label:'Overdue clients',     val:`${allPayments.filter(p=>p.status==='overdue').length}`, col:'var(--color-danger)'},
          {label:'Upcoming (30 days)',  val:`${allPayments.filter(p=>p.status==='pending').length}`, col:C.gray},
        ].map((s, i) => (
          <div key={i} style={{background:C.ivory,borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:11,color:C.gray}}>{s.label}</div>
            <div style={{fontSize:20,fontWeight:500,color:s.col,marginTop:2}}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:8,padding:'10px 20px',background:C.white,borderBottom:`1px solid ${C.border}`,alignItems:'center',flexWrap:'wrap',position:'sticky',top:0,zIndex:10}}>
        {['all','overdue','pending','paid','aging'].map(t => (
          <button key={t} onClick={()=>setTab(t)}
            style={{fontSize:12,padding:'5px 14px',borderRadius:999,border:`1px solid ${tab===t?C.rosa:C.border}`,background:tab===t?C.rosaPale:'transparent',color:tab===t?C.rosa:C.gray,cursor:'pointer',textTransform:'capitalize'}}>
            {t === 'all' ? 'All payments' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        {allPayments.some(p => p.status === 'overdue') && (
          <button
            onClick={selectAllOverdue}
            style={{marginLeft:'auto',fontSize:12,padding:'5px 14px',borderRadius:999,border:`1px solid ${C.rosa}`,background:C.rosaPale,color:C.rosa,cursor:'pointer',fontWeight:500,whiteSpace:'nowrap'}}>
            Select all overdue
          </button>
        )}
      </div>
      {/* ── Bulk reminder sticky bar ─────────────────────────────────── */}
      {bulkSelected.size > 0 && (
        <div style={{
          position:'sticky',top:0,zIndex:10,
          background:'#1C1012',color:C.white,
          padding:'10px 16px',
          display:'flex',alignItems:'center',justifyContent:'space-between',
          borderRadius:10,margin:'0 20px 0 20px',marginTop:8,
          boxShadow:'0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <span style={{fontSize:13}}>{bulkSelected.size} milestone{bulkSelected.size!==1?'s':''} selected</span>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setBulkSelected(new Set())} style={{background:'rgba(255,255,255,0.15)',border:'none',color:C.white,padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:12}}>Clear</button>
            <button onClick={handleBulkReminder} disabled={bulkSending} style={{background:C.rosa,border:'none',color:C.white,padding:'5px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500,opacity:bulkSending?0.7:1}}>
              {bulkSending?'Sending…':'📨 Send reminders'}
            </button>
          </div>
        </div>
      )}
      {/* (bulk mark-paid/export bar is the floating pill below) */}
      {/* ── Aging AR Breakdown (summary strip — hidden on Aging tab) ───── */}
      {tab !== 'aging' && (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdueMilestones = allPayments.filter(p => p.status === 'overdue' && p.due_date);
        const bucket1 = overdueMilestones.filter(p => { const d = Math.ceil((today - new Date(p.due_date)) / 86400000); return d >= 1 && d <= 30; });
        const bucket2 = overdueMilestones.filter(p => { const d = Math.ceil((today - new Date(p.due_date)) / 86400000); return d >= 31 && d <= 60; });
        const bucket3 = overdueMilestones.filter(p => { const d = Math.ceil((today - new Date(p.due_date)) / 86400000); return d > 60; });
        if (!overdueMilestones.length) return null;
        const buckets = [
          { label: '1–30 days', count: bucket1.length, amount: bucket1.reduce((s, p) => s + Number(p.amount || 0), 0), col: 'var(--color-warning)', bg: 'var(--bg-warning)' },
          { label: '31–60 days', count: bucket2.length, amount: bucket2.reduce((s, p) => s + Number(p.amount || 0), 0), col: '#B45309', bg: '#FEF3C7' },
          { label: '60+ days', count: bucket3.length, amount: bucket3.reduce((s, p) => s + Number(p.amount || 0), 0), col: 'var(--color-danger)', bg: 'var(--bg-danger)' },
        ];
        return (
          <div style={{padding:'12px 20px',background:C.white,borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Aging AR Breakdown</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
              {buckets.map(b => (
                <div key={b.label} style={{background:b.bg,borderRadius:9,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                  <div>
                    <div style={{fontSize:11,color:b.col,fontWeight:600}}>{b.label} overdue</div>
                    <div style={{fontSize:18,fontWeight:700,color:b.col,marginTop:2}}>{fmt(b.amount)}</div>
                  </div>
                  <div style={{fontSize:22,fontWeight:700,color:b.col,opacity:0.5}}>{b.count}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {tab === 'aging' && (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysOverdue = (m) => {
          if (m.status === 'paid') return 0;
          if (!m.due_date) return 0;
          const due = new Date(m.due_date);
          return Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));
        };

        // Current = unpaid but not yet due (days overdue === 0)
        const currentMilestones = allPayments.filter(p => p.status !== 'paid' && p.due_date && daysOverdue(p) === 0);
        const bucket1 = allPayments.filter(p => p.status !== 'paid' && p.due_date && daysOverdue(p) >= 1 && daysOverdue(p) <= 30);
        const bucket2 = allPayments.filter(p => p.status !== 'paid' && p.due_date && daysOverdue(p) >= 31 && daysOverdue(p) <= 60);
        const bucket3 = allPayments.filter(p => p.status !== 'paid' && p.due_date && daysOverdue(p) > 60);

        const sum = (arr) => arr.reduce((s, p) => s + Number(p.amount || 0), 0);

        const summaryCards = [
          { label: 'Current', sub: 'Not yet due', count: currentMilestones.length, amount: sum(currentMilestones), col: C.gray, bg: C.ivory, border: C.border },
          { label: '1–30 days', sub: 'Overdue', count: bucket1.length, amount: sum(bucket1), col: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
          { label: '31–60 days', sub: 'Overdue', count: bucket2.length, amount: sum(bucket2), col: '#C2410C', bg: '#FFF7ED', border: '#FDBA74' },
          { label: '60+ days', sub: 'Overdue', count: bucket3.length, amount: sum(bucket3), col: '#B91C1C', bg: '#FFF5F5', border: '#FECACA' },
        ];

        // All overdue rows sorted most overdue first, then current at end
        const agingRows = [
          ...bucket3.map(p => ({ ...p, _days: daysOverdue(p) })),
          ...bucket2.map(p => ({ ...p, _days: daysOverdue(p) })),
          ...bucket1.map(p => ({ ...p, _days: daysOverdue(p) })),
          ...currentMilestones.map(p => ({ ...p, _days: 0 })),
        ];

        const rowBg = (days) => {
          if (days === 0) return 'transparent';
          if (days <= 30) return '#FFFBEB';
          if (days <= 60) return '#FFF7ED';
          return '#FFF5F5';
        };
        const rowCol = (days) => {
          if (days === 0) return C.gray;
          if (days <= 30) return '#92400E';
          if (days <= 60) return '#C2410C';
          return '#B91C1C';
        };

        return (
          <div className="page-scroll" style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:16}}>
            {/* Summary cards */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              {summaryCards.map(c => (
                <div key={c.label} style={{background:c.bg,border:`1px solid ${c.border}`,borderRadius:10,padding:'14px 16px'}}>
                  <div style={{fontSize:11,fontWeight:600,color:c.col,textTransform:'uppercase',letterSpacing:'0.06em'}}>{c.label}</div>
                  <div style={{fontSize:11,color:c.col,opacity:0.7,marginBottom:6}}>{c.sub}</div>
                  <div style={{fontSize:22,fontWeight:700,color:c.col}}>{fmt(c.amount)}</div>
                  <div style={{fontSize:12,color:c.col,opacity:0.7,marginTop:2}}>{c.count} milestone{c.count !== 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>

            {/* Detail table */}
            <Card style={{overflowX:'auto'}}>
              {agingRows.length === 0 ? (
                <EmptyState
                  icon="💳"
                  title="No payment milestones"
                  subtitle="Add milestones to events to track deposits and final payments"
                />
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:780}}>
                  <thead>
                    <tr style={{background:C.ivory}}>
                      {['Client','Event','Milestone','Amount','Due date','Days overdue','Last reminded','Action'].map(h => (
                        <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:500,color:C.gray,borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agingRows.map((p, i) => (
                      <tr key={p.id || i} style={{borderBottom:i<agingRows.length-1?`1px solid ${C.border}`:'none',background:rowBg(p._days)}}>
                        <td style={{padding:'10px 14px',fontWeight:500,color:C.ink}}>{p.clientFull || p.client}</td>
                        <td style={{padding:'10px 14px',color:C.gray,fontSize:12}}>{p.event}</td>
                        <td style={{padding:'10px 14px',color:C.ink}}>{p.label}</td>
                        <td style={{padding:'10px 14px',fontWeight:500,color:p._days > 0 ? rowCol(p._days) : C.ink}}>{fmt(p.amount)}</td>
                        <td style={{padding:'10px 14px',color:p._days > 0 ? rowCol(p._days) : C.gray}}>{p.due}</td>
                        <td style={{padding:'10px 14px'}}>
                          {p._days > 0 ? (
                            <span style={{fontWeight:600,color:rowCol(p._days)}}>{p._days}d</span>
                          ) : (
                            <span style={{color:C.gray,fontSize:11}}>Current</span>
                          )}
                        </td>
                        <td style={{padding:'10px 14px',fontSize:11,color:C.gray}}>
                          {p.last_reminded_at
                            ? new Date(p.last_reminded_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})
                            : <span style={{color:C.border}}>—</span>}
                        </td>
                        <td style={{padding:'10px 14px'}}>
                          {p._days > 0 && (
                            <button
                              onClick={() => setReminderPayment(p)}
                              style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${C.rosa}`,background:C.rosaPale,color:C.rosa,fontSize:11,cursor:'pointer',fontWeight:500,whiteSpace:'nowrap'}}>
                              {p.last_reminded_at ? '↩ Re-remind' : 'Send reminder'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        );
      })()}
      {tab !== 'aging' && !livePayments && (
        <div style={{padding:20}}><SkeletonList count={5}/></div>
      )}
      {tab !== 'aging' && livePayments && <div className="page-scroll" style={{flex:1,overflowY:'auto',padding:20}}>
        <Card style={{overflowX:'auto'}}>
          <table className="pay-table" style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:620}}>
            <thead><tr style={{background:C.ivory}}>
              <th style={{padding:'10px 8px 10px 14px',textAlign:'left',borderBottom:`1px solid ${C.border}`}}>
                <input type="checkbox"
                  checked={filtered.filter(p=>p.status!=='paid').length>0 && selected.size===filtered.filter(p=>p.status!=='paid').length}
                  onChange={toggleAll}
                  style={{cursor:'pointer',width:14,height:14,accentColor:C.rosa}}/>
              </th>
              {['','Client & event','Milestone','Due date','Amount','Actions'].map((h, i) => (
                <th key={i} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:500,color:C.gray,borderBottom:`1px solid ${C.border}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{(() => {
              const seenEventIds = new Set();
              return filtered.map((p, i) => {
              const isPlan = planEventIds.has(p.event_id);
              const isFirstForEvent = p.event_id && !seenEventIds.has(p.event_id);
              if (p.event_id) seenEventIds.add(p.event_id);
              return (
              <tr key={i}
                style={{borderBottom:i<filtered.length-1?`1px solid ${C.border}`:'none',background:selected.has(p.id)?'#EFF6FF':p.status==='overdue'?'#FEF2F2':undefined,cursor:'pointer',height:'var(--row-min-height)'}}
                onMouseEnter={e=>{if(!selected.has(p.id))e.currentTarget.style.background=p.status==='overdue'?'#FEE2E2':C.ivory;}}
                onMouseLeave={e=>{if(!selected.has(p.id))e.currentTarget.style.background=p.status==='overdue'?'#FEF2F2':'transparent';}}>
                <td style={{padding:'var(--row-padding)',paddingRight:4}} onClick={e=>e.stopPropagation()}>
                  {p.status !== 'paid' && (
                    <input type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={()=>{
                        toggleSelect(p.id);
                        if (p.status === 'overdue' || p.status === 'pending') {
                          setBulkSelected(s => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; });
                        }
                      }}
                      style={{cursor:'pointer',width:14,height:14,accentColor:C.rosa}}/>
                  )}
                </td>
                <td className="col-dot"    style={{padding:'var(--row-padding)'}}><StatusDot status={p.status}/></td>
                <td className="col-client" style={{padding:'var(--row-padding)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontWeight:500,color:C.ink}}>{p.client}</span>
                    {isPlan && (
                      <span style={{fontSize:9,padding:'2px 6px',borderRadius:999,background:C.rosaPale,color:C.rosa,fontWeight:600,whiteSpace:'nowrap'}}>
                        Payment Plan
                      </span>
                    )}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                    <span style={{fontSize:11,color:C.gray}}>{p.event}</span>
                    {isFirstForEvent && p.event_id && (
                      <button
                        onClick={e=>{e.stopPropagation();downloadInvoice(p.event_id, p.clientFull||p.client);}}
                        title="Download invoice PDF"
                        style={{padding:'2px 7px',borderRadius:5,border:`1px solid ${C.border}`,background:C.ivory,color:C.gray,fontSize:10,cursor:'pointer',whiteSpace:'nowrap',lineHeight:1.4,flexShrink:0}}>
                        ⬇ Invoice
                      </button>
                    )}
                  </div>
                  {isPlan && (
                    <div style={{marginTop:4,width:80,height:3,background:C.border,borderRadius:2,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${Math.min(100,Math.round((1/(1+(planProgress[p.event_id]?.unpaid||1)))*100))}%`,background:C.rosa,borderRadius:2}}/>
                    </div>
                  )}
                </td>
                <td className="col-label"  style={{padding:'var(--row-padding)',color:C.ink}}>{p.label}</td>
                <td className="col-due"    style={{padding:'var(--row-padding)',color:p.status==='overdue'?'var(--color-danger)':C.gray}}>
                  {p.due}{p.daysLate ? <span style={{color:'var(--color-danger)'}}> · {p.daysLate}d late</span> : null}
                </td>
                <td className="col-amount" style={{padding:'var(--row-padding)',fontWeight:500,color:p.status==='overdue'?'var(--color-danger)':C.ink}}>{fmt(p.amount)}</td>
                <td className="col-action" style={{padding:'var(--row-padding)'}}>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    {p.status === 'overdue' && (
                      <button className="btn-sm"
                        onClick={()=>setReminderPayment(p)}
                        style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${C.rosa}`,background:C.rosaPale,color:C.rosa,fontSize:11,cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:4}}>
                        {p.last_reminded_at ? '↩ Re-remind' : 'Send reminder'}
                      </button>
                    )}
                    {p.status !== 'paid' && (
                      <button className="btn-sm"
                        onClick={()=>markPaid && p.id && markPaid(p.id)}
                        style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:11,cursor:'pointer'}}>
                        Mark paid
                      </button>
                    )}
                    {p.status === 'paid' && <span style={{fontSize:11,color:'var(--color-success)',fontWeight:500}}>✓ Paid</span>}
                    {isFirstForEvent && p.event_id && (
                      <button className="btn-sm"
                        onClick={e=>{e.stopPropagation();setTipEventId(p.event_id);setTipAmount('');setShowTipModal(true);}}
                        title="Add gratuity / tip"
                        style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:C.ivory,color:C.gray,fontSize:11,cursor:'pointer',whiteSpace:'nowrap'}}>
                        + Tip
                      </button>
                    )}
                    {myRole === 'owner' && deleteMilestone && (
                      <button className="btn-sm" onClick={()=>setConfirmDelete({ open: true, milestoneId: p.id })} title="Delete milestone" style={{padding:'4px 8px',borderRadius:6,border:`1px solid #FECACA`,background:'#FFF5F5',color:'#DC2626',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              );
              });
            })()}</tbody>
          </table>
        </Card>
      </div>}
      {reminderPayment && (
        <ReminderModal
          payment={reminderPayment}
          boutiqueName={boutique?.name || ''}
          boutique={boutique}
          logReminder={logReminder}
          onClose={()=>setReminderPayment(null)}
        />
      )}
      <ConfirmModal
        open={confirmDelete.open}
        title="Delete milestone"
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const id = confirmDelete.milestoneId;
          setConfirmDelete({ open: false, milestoneId: null });
          const { error } = await deleteMilestone(id);
          if (error) { toast(`Failed to delete: ${error.message}`, 'error'); return; }
          toast('Milestone deleted');
        }}
        onCancel={() => setConfirmDelete({ open: false, milestoneId: null })}
      />
      {showPlanModal && (
        <PaymentPlanModal
          events={events}
          payments={allPayments}
          createMilestone={createMilestone}
          onClose={() => setShowPlanModal(false)}
        />
      )}
      {showQuickPay && (
        <QuickPayModal
          payments={allPayments}
          boutique={boutique}
          onClose={() => setShowQuickPay(false)}
          onSuccess={() => {/* realtime subscription auto-refreshes via usePayments hook */}}
        />
      )}
      {showTipModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:340,boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Add gratuity / tip</span>
              <button onClick={()=>setShowTipModal(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {[10,15,20,25,50,100].map(amt=>(
                  <button key={amt} onClick={()=>setTipAmount(String(amt))}
                    style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${tipAmount===String(amt)?C.rosa:C.border}`,background:tipAmount===String(amt)?C.rosaPale:C.white,color:tipAmount===String(amt)?C.rosa:C.ink,cursor:'pointer',fontSize:13,fontWeight:tipAmount===String(amt)?600:400}}>
                    ${amt}
                  </button>
                ))}
              </div>
              <input type="number" value={tipAmount} onChange={e=>setTipAmount(e.target.value)}
                placeholder="Custom amount…" style={{...inputSt}}/>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" onClick={()=>setShowTipModal(false)}/>
              <PrimaryBtn label={tipSaving?'Saving…':'Add tip 🎁'} onClick={async()=>{
                if(!tipAmount||Number(tipAmount)<=0) return;
                setTipSaving(true);
                await supabase.from('payment_milestones').insert({
                  boutique_id: boutique.id,
                  event_id: tipEventId,
                  label: 'Gratuity / Tip',
                  amount: Number(tipAmount),
                  due_date: new Date().toISOString().slice(0,10),
                  status: 'paid',
                  paid_date: new Date().toISOString().slice(0,10),
                });
                setTipSaving(false);
                setShowTipModal(false);
                setTipAmount('');
                toast('Tip added ✓');
              }}/>
            </div>
          </div>
        </div>
      )}
      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div style={{position:'fixed',bottom:16,left:'50%',transform:'translateX(-50%)',zIndex:200,background:C.white,borderRadius:999,boxShadow:'0 4px 24px rgba(0,0,0,0.18)',padding:'10px 18px',display:'flex',alignItems:'center',gap:10,maxWidth:600,border:`1px solid ${C.border}`}}>
          <span style={{fontSize:13,fontWeight:600,color:C.rosa,whiteSpace:'nowrap'}}>✓ {selected.size} selected</span>
          <button onClick={bulkMarkPaid} disabled={bulkWorking}
            style={{padding:'6px 14px',borderRadius:999,border:'none',background:C.green,color:'#fff',fontSize:12,fontWeight:500,cursor:'pointer',opacity:bulkWorking?0.7:1,whiteSpace:'nowrap'}}>
            Mark paid
          </button>
          {selectedArr.some(p=>p.status==='overdue') && (
            <button onClick={bulkRemind} disabled={bulkWorking}
              style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',opacity:bulkWorking?0.7:1,whiteSpace:'nowrap'}}>
              Send reminder ({selectedArr.filter(p=>p.status==='overdue').length})
            </button>
          )}
          <button onClick={bulkExport} disabled={bulkWorking}
            style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>
            Export CSV
          </button>
          <button onClick={()=>setSelected(new Set())}
            style={{padding:'6px 10px',borderRadius:999,border:'none',background:'none',color:C.gray,fontSize:18,cursor:'pointer',lineHeight:1,marginLeft:4}}>
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default Payments;
