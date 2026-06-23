import React, { useState } from 'react';
import { C, fmt } from '../../lib/colors';
import { PrimaryBtn, GhostBtn, inputSt, LBL } from '../../lib/ui.jsx';
import { useModules } from '../../hooks/useModules.jsx';

// Ordered from best to worst so we can compare degradation
const CONDITION_RANK = { new: 0, excellent: 1, good: 2, fair: 3, needs_repair: 4 };

function daysLate(d) {
  const due = d.returnDate || d.return_date;
  if (!due) return 0;
  const diff = Math.floor((new Date() - new Date(due)) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export const DressReturnModal = ({ dress, onClose, onUpdate }) => {
  const { getModuleConfig } = useModules();
  const LATE_FEE_PER_DAY = getModuleConfig('dress_rental')?.late_fee_per_day ?? 25;

  const prevCondition = dress.condition || null;
  const defaultCondition = prevCondition && CONDITION_RANK[prevCondition] !== undefined ? prevCondition : 'excellent';

  const [step, setStep] = useState(2);
  const [condition, setCondition] = useState(defaultCondition);
  const [returnNotes, setReturnNotes] = useState('');
  const [damageDescription, setDamageDescription] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [damageFee, setDamageFee] = useState(0);
  const [lateFeeWaive, setLateFeeWaive] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [payCollected, setPayCollected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendClean, setSendClean] = useState(null);

  const late = daysLate(dress);
  const lateFee = lateFeeWaive ? 0 : Math.min(late * LATE_FEE_PER_DAY, 750);
  const totalDue = (dress.price || 0) + (damageFee || 0) + lateFee - (dress.deposit || 0);

  // Check if condition degraded compared to when dress went out
  const conditionDegraded = prevCondition && CONDITION_RANK[condition] !== undefined && CONDITION_RANK[prevCondition] !== undefined
    ? CONDITION_RANK[condition] > CONDITION_RANK[prevCondition]
    : false;

  const condOpts = [
    { id: 'new',          label: '✨ New',           desc: 'Pristine, unworn condition',          suggestFee: 0  },
    { id: 'excellent',    label: '✓ Excellent',      desc: 'No visible wear, ready for cleaning', suggestFee: 0  },
    { id: 'good',         label: 'Good',             desc: 'Minor wear, cleaning will resolve',    suggestFee: 0  },
    { id: 'fair',         label: '⚠ Fair',           desc: 'Noticeable wear or light soiling',     suggestFee: 0  },
    { id: 'needs_repair', label: '🚨 Needs repair',  desc: 'Torn seam, missing button, damage',    suggestFee: 50 },
  ];

  if (sendClean !== null) {
    return (
      <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: C.white, borderRadius: 16, width: 380, padding: 32, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Return logged!</div>
          <div style={{ fontSize: 13, color: C.gray, marginBottom: 20 }}>#{dress.sku} · {dress.name}</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 16 }}>Send dress to cleaning?</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <GhostBtn label="Later" onClick={onClose} />
            <PrimaryBtn label="Yes, send to cleaning" colorScheme="info" onClick={async () => { await onUpdate(dress.id, { status: 'cleaning' }); onClose(); }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dress-return-title" style={{ background: C.white, borderRadius: 16, width: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div id="dress-return-title" style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>Log return</div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>Step {step - 1} of 2</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {[2, 3].map(s => <div key={s} style={{ width: 8, height: 8, borderRadius: '50%', background: step >= s ? C.rosa : C.border }} />)}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.gray, cursor: 'pointer' }} aria-label="Close"><span aria-hidden="true">×</span></button>
          </div>
        </div>

        {step === 2 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: C.ivory, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{dress.name} <span style={{ color: C.gray }}>#{dress.sku}</span></div>
              <div style={{ fontSize: 11, color: C.gray }}>Rented to {dress.client?.name || dress.client || '—'}{late > 0 && <span style={{ color: C.red, fontWeight: 600 }}> · {late} day{late !== 1 ? 's' : ''} overdue</span>}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, letterSpacing: '0.08em' }}>CONDITION ON RETURN</div>
            {prevCondition && CONDITION_RANK[prevCondition] !== undefined && (
              <div style={{ fontSize: 12, color: C.gray, background: C.ivory, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}` }}>
                Condition when rented out: <strong style={{ color: C.ink, textTransform: 'capitalize' }}>{prevCondition.replace(/_/g, ' ')}</strong>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {condOpts.map(o => (
                <button key={o.id} onClick={() => { setCondition(o.id); setDamageFee(o.suggestFee); }} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${condition === o.id ? C.rosa : C.border}`, background: condition === o.id ? C.rosaPale : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: condition === o.id ? C.rosaText : C.ink }}>{o.label}</div>
                    <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{o.desc}</div>
                  </div>
                  {condition === o.id && <span style={{ fontSize: 14, color: C.rosaText }}>✓</span>}
                </button>
              ))}
            </div>
            {conditionDegraded && (
              <div style={{ fontSize: 12, color: 'var(--text-warning)', background: 'var(--bg-warning)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-warning)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ flexShrink: 0 }}>⚠</span>
                <span>Condition is worse than when rented out (<strong>{prevCondition.replace(/_/g, ' ')}</strong> → <strong>{condition.replace(/_/g, ' ')}</strong>). Please document the issue in the return notes.</span>
              </div>
            )}
            <div>
              <label htmlFor="return-dress-notes" style={LBL}>Return notes{condition === 'needs_repair' ? ' (required)' : conditionDegraded ? ' (recommended)' : ' (optional)'}</label>
              <textarea id="return-dress-notes" value={returnNotes} onChange={e => setReturnNotes(e.target.value)} onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} rows={2} placeholder="Describe any issues, damage, or wear…" style={{ ...inputSt, resize: 'vertical' }} />
            </div>
            {/* Task 2: Extra damage fields when condition is needs_repair or fair */}
            {(condition === 'needs_repair' || condition === 'fair') && (
              <div style={{ background: '#FFF8F8', border: '1px solid #FCA5A5', borderRadius: 10, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', letterSpacing: '0.06em' }}>DAMAGE ASSESSMENT</div>
                <div>
                  <label htmlFor="return-dress-damage-desc" style={LBL}>Damage description</label>
                  <textarea
                    id="return-dress-damage-desc"
                    value={damageDescription}
                    onChange={e => setDamageDescription(e.target.value)}
                    onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    rows={2}
                    placeholder="e.g. Torn hem on left side, missing button at waist…"
                    style={{ ...inputSt, resize: 'vertical', borderColor: '#FCA5A5' }}
                  />
                </div>
                <div>
                  <label htmlFor="return-dress-repair-cost" style={LBL}>Estimated repair cost ($)</label>
                  <input
                    id="return-dress-repair-cost"
                    type="number"
                    min="0"
                    value={repairCost}
                    onChange={e => { setRepairCost(e.target.value); setDamageFee(Math.max(0, Number(e.target.value))); }}
                    placeholder="0.00"
                    style={{ ...inputSt, borderColor: '#FCA5A5' }}
                  />
                </div>
                <div style={{ fontSize: 11, color: '#B91C1C', fontStyle: 'italic' }}>
                  A damage note will be appended to this dress's records upon confirmation.
                </div>
              </div>
            )}
            {condition === 'needs_repair' && !returnNotes.trim() && <div style={{ fontSize: 11, color: 'var(--text-danger)' }}>Please describe the damage before continuing</div>}
          </div>
        )}

        {step === 3 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, letterSpacing: '0.08em' }}>FINANCIAL SETTLEMENT</div>
            <div style={{ background: C.ivory, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: C.gray }}>Rental fee</span><span style={{ color: C.ink, fontWeight: 500 }}>{fmt(dress.price || 0)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: C.gray }}>Deposit paid</span><span style={{ color: 'var(--text-success)' }}>-{fmt(dress.deposit || 0)}</span></div>
              {late > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-danger)' }}>Late fee ({late}d × ${LATE_FEE_PER_DAY})</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text-danger)', fontWeight: 500 }}>{lateFeeWaive ? <s>{fmt(late * LATE_FEE_PER_DAY)}</s> : fmt(lateFee)}</span>
                    <button onClick={() => setLateFeeWaive(!lateFeeWaive)} style={{ fontSize: 10, color: C.rosaText, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{lateFeeWaive ? 'Apply' : 'Waive'}</button>
                  </div>
                </div>
              )}
              {damageFee > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: 'var(--text-danger)' }}>Damage fee</span><span style={{ color: 'var(--text-danger)', fontWeight: 500 }}>{fmt(damageFee)}</span></div>}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}>
                <span>Total due</span><span style={{ color: totalDue > 0 ? C.ink : 'var(--color-success)' }}>{totalDue > 0 ? fmt(totalDue) : '$0 (paid)'}</span>
              </div>
            </div>
            {condition === 'needs_repair' && (
              <div><label htmlFor="return-dress-damage-fee" style={LBL}>Damage fee ($)</label><input id="return-dress-damage-fee" type="number" value={damageFee} onChange={e => setDamageFee(Math.max(0, Number(e.target.value)))} style={inputSt} /></div>
            )}
            <div>
              <div id="drm-pay-method-label" style={LBL}>Payment method</div>
              <div role="group" aria-labelledby="drm-pay-method-label" style={{ display: 'flex', gap: 6 }}>
                {['cash', 'card', 'zelle', 'other'].map(m => (
                  <button key={m} onClick={() => setPayMethod(m)} style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1.5px solid ${payMethod === m ? C.rosa : C.border}`, background: payMethod === m ? C.rosaPale : 'transparent', color: payMethod === m ? C.rosaText : C.gray, cursor: 'pointer', fontSize: 12, fontWeight: payMethod === m ? 500 : 400, textTransform: 'capitalize' }}>{m}</button>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: C.ink }}>
              <input type="checkbox" checked={payCollected} onChange={e => setPayCollected(e.target.checked)} style={{ accentColor: 'var(--color-success)' }} />
              Payment collected
            </label>
          </div>
        )}

        <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
          {step === 2 ? (
            <>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose} />
              <PrimaryBtn label="Next → Settlement" onClick={() => {
                if (condition === 'needs_repair' && !returnNotes.trim()) return;
                setStep(3);
              }} />
            </>
          ) : (
            <>
              <GhostBtn label="← Back" onClick={() => setStep(2)} />
              <PrimaryBtn label={saving ? 'Saving…' : 'Confirm return'} colorScheme="success" onClick={async () => {
                setSaving(true);
                // Build damage note to append to dress notes
                let notesValue = returnNotes.trim() || null;
                if ((condition === 'needs_repair' || condition === 'fair') && damageDescription.trim()) {
                  const dateStr = new Date().toISOString().split('T')[0];
                  const dmgNote = `[DAMAGE ${dateStr}] ${damageDescription.trim()}${repairCost ? ` - Est. repair: $${parseFloat(repairCost).toFixed(2)}` : ''}`;
                  notesValue = notesValue ? `${notesValue}\n${dmgNote}` : dmgNote;
                }
                await onUpdate(dress.id, {
                  status: 'returned',
                  condition,
                  notes: notesValue,
                  return_date_confirmed: new Date().toISOString().slice(0, 10),
                  damageFee,
                  lateFee,
                  payCollected,
                  payMethod
                });
                setSaving(false);
                setSendClean(true);
              }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DressReturnModal;
