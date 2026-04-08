import React, { useState } from 'react';
import { C, fmt } from '../lib/colors';
import { inputSt, LBL, useToast } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useDamageReports } from '../hooks/useDamageReports';

// ─── Condition options ───────────────────────────────────────────────────────
const CONDITIONS = [
  {
    key: 'perfect',
    icon: '✅',
    label: 'Perfect',
    desc: 'No damage — full deposit refund',
    bg: '#F0FDF4',
    border: '#86EFAC',
    col: '#15803D',
    defaultFee: 0,
  },
  {
    key: 'minor_soiling',
    icon: '🟡',
    label: 'Minor soiling',
    desc: 'Needs cleaning — partial deposit refund',
    bg: '#FFFBEB',
    border: '#FDE68A',
    col: '#B45309',
    defaultFee: 50,
  },
  {
    key: 'needs_repair',
    icon: '🔧',
    label: 'Needs repair',
    desc: 'Torn seam or similar — partial deposit refund',
    bg: '#FFF7ED',
    border: '#FED7AA',
    col: '#C2410C',
    defaultFee: 150,
  },
  {
    key: 'damaged',
    icon: '💥',
    label: 'Damaged',
    desc: 'Significant damage — no deposit refund',
    bg: '#FEF2F2',
    border: '#FCA5A5',
    col: '#B91C1C',
    defaultFee: null, // uses dress.price
  },
];

// ─── SeverityBadge (kept for DamageHistorySection backward compat) ───────────
const SEV_BADGE = {
  minor:      { bg: '#FEF3C7', col: '#B45309', label: 'Minor' },
  moderate:   { bg: '#FEF3C7', col: '#C2410C', label: 'Moderate' },
  severe:     { bg: '#FEE2E2', col: '#B91C1C', label: 'Severe' },
  total_loss: { bg: '#F3F4F6', col: '#111827', label: 'Total loss' },
  // condition keys
  perfect:      { bg: '#DCFCE7', col: '#15803D', label: 'Perfect' },
  minor_soiling:{ bg: '#FEF3C7', col: '#B45309', label: 'Minor soiling' },
  needs_repair: { bg: '#FEE2E2', col: '#B91C1C', label: 'Needs repair' },
  damaged:      { bg: '#FEE2E2', col: '#B91C1C', label: 'Damaged' },
};

export const SeverityBadge = ({ severity }) => {
  const s = SEV_BADGE[severity] || { bg: C.grayBg, col: C.gray, label: severity };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: s.bg, color: s.col }}>
      {s.label}
    </span>
  );
};

/**
 * DamageAssessmentModal
 *
 * Props:
 *   dress        – inventory row (.name, .deposit, .price, .id, .client_id)
 *   clientName   – display name string (optional)
 *   eventId      – uuid (optional)
 *   clientId     – uuid (optional)
 *   onClose      – fn
 *   onSaved      – fn() called after save
 *   proceedReturn – fn (optional) — called instead of onClose after save
 */
export default function DamageAssessmentModal({ dress, clientName, eventId, clientId, onClose, onSaved, proceedReturn }) {
  const { boutique } = useAuth();
  const toast = useToast();

  const deposit = Number(dress?.deposit || 0);
  const dressPrice = Number(dress?.price || 0);

  const [condition, setCondition] = useState(null);
  const [damageFee, setDamageFee] = useState('');
  const [createMilestone, setCreateMilestone] = useState(true);
  const [saving, setSaving] = useState(false);

  // When a condition card is selected, default the fee
  const handleSelectCondition = (key) => {
    setCondition(key);
    const opt = CONDITIONS.find(c => c.key === key);
    if (!opt) return;
    const fee = opt.defaultFee !== null ? opt.defaultFee : dressPrice || 500;
    setDamageFee(String(fee));
  };

  const damageFeeNum = Math.max(0, parseFloat(damageFee) || 0);
  const refundAmount = Math.max(0, deposit - damageFeeNum);

  const handleConfirm = async () => {
    if (!condition) { toast('Please select a condition', 'warn'); return; }
    setSaving(true);

    const today = new Date().toISOString().slice(0, 10);
    const boutiqueId = boutique?.id;

    // 1. Update inventory item
    await supabase
      .from('inventory')
      .update({
        status: 'available',
        condition,
        return_date_confirmed: today,
      })
      .eq('id', dress?.id);

    // 2. Create payment milestone if damage fee > 0 and checkbox checked
    if (damageFeeNum > 0 && createMilestone) {
      const activeEventId = eventId || null;
      if (activeEventId && boutiqueId) {
        await supabase.from('payment_milestones').insert({
          boutique_id: boutiqueId,
          event_id: activeEventId,
          label: `Damage fee – ${dress?.name || 'Dress'}`,
          amount: damageFeeNum,
          due_date: today,
          status: 'pending',
        });
      }
    }

    // 3. Log to client_interactions if we have client context
    const cid = clientId || dress?.client_id;
    if (cid && boutiqueId) {
      const condOpt = CONDITIONS.find(c => c.key === condition);
      await supabase.from('client_interactions').insert({
        boutique_id: boutiqueId,
        client_id: cid,
        type: 'note',
        title: `Dress returned — ${dress?.name || 'Dress'}`,
        body: `Condition: ${condOpt?.label || condition}. ${damageFeeNum > 0 ? `Damage fee: ${fmt(damageFeeNum)}.` : 'Full deposit refund.'} ${refundAmount > 0 ? `Deposit refund: ${fmt(refundAmount)}.` : ''}`.trim(),
        occurred_at: new Date().toISOString(),
        is_editable: false,
        author_name: boutique?.name || 'Staff',
        related_event_id: eventId || null,
      });
    }

    // 4. Toast
    if (damageFeeNum > 0 && createMilestone) {
      toast('Return processed. Damage milestone created.');
    } else {
      toast('Return processed. Full deposit refund.');
    }

    setSaving(false);
    onSaved?.();

    if (proceedReturn) {
      proceedReturn();
    } else {
      onClose();
    }
  };

  const selectedOpt = CONDITIONS.find(c => c.key === condition);

  return (
    <div
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: C.white, borderRadius: 20, width: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>Damage Assessment</div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
              {dress?.name || 'Dress'}{clientName ? ` · ${clientName}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: C.gray, cursor: 'pointer', lineHeight: 1, padding: 0, marginTop: 2 }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Condition cards */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Condition on return</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              {CONDITIONS.map(opt => {
                const sel = condition === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectCondition(opt.key)}
                    style={{
                      padding: '14px 14px',
                      borderRadius: 12,
                      border: `2px solid ${sel ? opt.border : C.border}`,
                      background: sel ? opt.bg : C.white,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{opt.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: sel ? opt.col : C.ink, marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.4 }}>{opt.desc}</div>
                    {sel && (
                      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: opt.col }}>
                        {opt.defaultFee === 0 ? 'No fee' : `Suggested fee: ${fmt(opt.defaultFee !== null ? opt.defaultFee : dressPrice || 500)}`}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fee summary — show after condition is selected */}
          {condition && (
            <div style={{ background: C.grayBg, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Fee summary</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: C.gray }}>Deposit paid</span>
                <span style={{ fontWeight: 600, color: C.ink }}>{fmt(deposit)}</span>
              </div>

              {/* Editable damage fee */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13, color: C.gray, flexShrink: 0 }}>Damage fee</span>
                <div style={{ display: 'flex', alignItems: 'center', maxWidth: 140 }}>
                  <span style={{ padding: '7px 9px', background: C.white, border: `1px solid ${C.border}`, borderRight: 'none', borderRadius: '7px 0 0 7px', fontSize: 13, color: C.gray }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={damageFee}
                    onChange={e => setDamageFee(e.target.value)}
                    style={{ ...inputSt, margin: 0, borderRadius: '0 7px 7px 0', borderLeft: 'none', fontSize: 13, width: 90, padding: '7px 10px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <span style={{ color: refundAmount > 0 ? C.green : C.red }}>
                  {refundAmount > 0 ? 'Amount to refund' : 'No deposit refund'}
                </span>
                <span style={{ color: refundAmount > 0 ? C.green : C.red }}>{fmt(refundAmount)}</span>
              </div>

              {/* Create milestone checkbox */}
              {damageFeeNum > 0 && eventId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.ink, marginTop: 2 }}>
                  <input
                    type="checkbox"
                    checked={createMilestone}
                    onChange={e => setCreateMilestone(e.target.checked)}
                    style={{ accentColor: C.rosa, width: 15, height: 15 }}
                  />
                  Create invoice milestone for damage fee
                </label>
              )}
              {damageFeeNum > 0 && !eventId && (
                <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic' }}>
                  Link this dress to an event to create a milestone automatically.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.gray, fontSize: 13, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !condition}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 8,
              background: saving || !condition ? C.grayBg : (selectedOpt?.col || C.rosa),
              color: saving || !condition ? C.gray : C.white,
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving || !condition ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving…' : proceedReturn ? 'Save & Proceed to return' : 'Confirm return'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * DamageHistorySection — used inside Inventory ItemDetailPanel
 * Shows a list of damage reports for an item + "+ Report Damage" button
 */
export function DamageHistorySection({ item, onOpenModal }) {
  const { reports, loading, tableExists } = useDamageReports(item?.id);

  const STATUS_BADGE = {
    open:        { bg: C.redBg,    col: C.red,    label: 'Open' },
    repaired:    { bg: C.greenBg,  col: C.green,  label: 'Repaired' },
    written_off: { bg: '#F3F4F6',  col: '#374151',label: 'Written off' },
    disputed:    { bg: C.amberBg,  col: C.amber,  label: 'Disputed' },
  };

  if (!tableExists) return null;

  return (
    <div style={{ padding: '0 20px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Damage history</div>
        <button
          onClick={onOpenModal}
          style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.red}`, background: 'transparent', color: C.red, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
        >
          + Report damage
        </button>
      </div>
      {loading && <div style={{ fontSize: 12, color: C.gray }}>Loading…</div>}
      {!loading && reports.length === 0 && (
        <div style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>No damage reports on file</div>
      )}
      {!loading && reports.map(r => {
        const st = STATUS_BADGE[r.status] || { bg: C.grayBg, col: C.gray, label: r.status };
        return (
          <div key={r.id} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <SeverityBadge severity={r.severity || r.condition}/>
                <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: st.bg, color: st.col }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 11, color: C.gray }}>{r.reported_at ? new Date(r.reported_at).toLocaleDateString() : ''}</div>
            </div>
            {r.description && <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.4, marginBottom: 4 }}>{r.description}</div>}
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.gray }}>
              {r.repair_cost > 0 && <span>Repair: <strong style={{ color: C.ink }}>{fmt(r.repair_cost)}</strong></span>}
              {r.deposit_deduction > 0 && <span>Deducted: <strong style={{ color: C.ink }}>{fmt(r.deposit_deduction)}</strong></span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
