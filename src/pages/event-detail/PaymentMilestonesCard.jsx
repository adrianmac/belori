import React, { useState, useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { C, fmt } from '../../lib/colors';
import { Card, useToast } from '../../lib/ui.jsx';

// ─── PAYMENT PLAN MODAL ───────────────────────────────────────────────────────
const PaymentPlanModal = ({ ev, milestones, createMilestones, boutique, onClose }) => {
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0];
  const defaultFinal = ev?.event_date
    ? (() => {
        const d = new Date(ev.event_date + 'T12:00:00');
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
      })()
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
      })();

  const [total, setTotal] = useState(ev?.total ? String(ev.total) : '');
  const [depositPct, setDepositPct] = useState('30');
  const [installments, setInstallments] = useState('2');
  const [firstDue, setFirstDue] = useState(today);
  const [finalDue, setFinalDue] = useState(defaultFinal);
  const [generating, setGenerating] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  const totalNum = parseFloat(total) || 0;
  const depositPctNum = Math.min(100, Math.max(0, parseFloat(depositPct) || 0));
  const installmentCount = parseInt(installments, 10) || 1;

  const plan = useMemo(() => {
    if (totalNum <= 0) return [];
    const depositAmt = totalNum * (depositPctNum / 100);
    const remaining = totalNum - depositAmt;
    const installmentAmt = installmentCount > 0 ? Math.floor(remaining / installmentCount) : 0;
    // Deposit gets remainder so total is exact
    const depositFinal = totalNum - installmentAmt * installmentCount;

    const milestoneCount = 1 + installmentCount; // deposit + installments (last is "Final payment")
    const items = [];

    // Evenly space dates between firstDue and finalDue
    const start = new Date(firstDue + 'T12:00:00');
    const end = new Date(finalDue + 'T12:00:00');
    const totalMs = end - start;
    const intervals = milestoneCount - 1;

    for (let i = 0; i < milestoneCount; i++) {
      let label;
      if (i === 0) label = 'Deposit';
      else if (i === milestoneCount - 1) label = 'Final payment';
      else label = `Installment ${i}`;

      let amount;
      if (i === 0) amount = Math.round(depositFinal * 100) / 100;
      else amount = installmentAmt;

      let dueDate;
      if (milestoneCount === 1 || intervals === 0) {
        dueDate = firstDue;
      } else if (i === 0) {
        dueDate = firstDue;
      } else if (i === milestoneCount - 1) {
        dueDate = finalDue;
      } else {
        const ms = start.getTime() + (totalMs * i) / intervals;
        dueDate = new Date(ms).toISOString().split('T')[0];
      }

      items.push({ label, amount, due_date: dueDate });
    }

    return items;
  }, [totalNum, depositPctNum, installmentCount, firstDue, finalDue]);

  const planTotal = plan.reduce((s, m) => s + m.amount, 0);
  const planTotalExact = Math.round(planTotal * 100) === Math.round(totalNum * 100);

  const formatDateDisplay = (iso) => {
    if (!iso) return '';
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleGenerate = async () => {
    if (plan.length === 0) return;
    if (milestones.length > 0 && !confirmStep) {
      setConfirmStep(true);
      return;
    }
    setGenerating(true);
    try {
      const { error } = await createMilestones(plan.map(m => ({
        event_id: ev.id,
        boutique_id: boutique.id,
        label: m.label,
        amount: m.amount,
        due_date: m.due_date,
        status: 'pending',
      })));
      if (error) throw error;
      toast(`${plan.length} milestone${plan.length !== 1 ? 's' : ''} created`);
      onClose();
    } catch (err) {
      toast('Failed to create milestones', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1200, padding: 16,
  };
  const panelStyle = {
    background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
  };
  const headerStyle = {
    padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };
  const bodyStyle = { padding: 18, display: 'flex', flexDirection: 'column', gap: 14 };
  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4 };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const inputStyle = {
    padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 6,
    fontSize: 13, color: C.ink, outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const rowStyle = { display: 'flex', gap: 10 };
  const previewBoxStyle = {
    background: '#F9FAFB', borderRadius: 8, border: `1px solid ${C.border}`,
    padding: '10px 14px', fontSize: 12,
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>Payment Plan Auto-Generator</span>
          <span onClick={onClose} style={{ cursor: 'pointer', color: C.gray, fontSize: 18, lineHeight: 1 }}>×</span>
        </div>
        <div style={bodyStyle}>
          {/* Total */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Total amount</label>
            <input
              type="number" min="0" step="0.01"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              style={inputStyle}
              placeholder="e.g. 5000"
            />
          </div>

          {/* Deposit % + installments row */}
          <div style={rowStyle}>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>Deposit %</label>
              <input
                type="number" min="0" max="100" step="1"
                value={depositPct}
                onChange={(e) => setDepositPct(e.target.value)}
                style={inputStyle}
              />
              {totalNum > 0 && (
                <span style={{ fontSize: 11, color: C.gray }}>
                  = {fmt(totalNum * (depositPctNum / 100))}
                </span>
              )}
            </div>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>Installments after deposit</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                style={inputStyle}
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} ({n + 1} total)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates row */}
          <div style={rowStyle}>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>First payment due</label>
              <input
                type="date"
                value={firstDue}
                onChange={(e) => setFirstDue(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>Final payment due</label>
              <input
                type="date"
                value={finalDue}
                onChange={(e) => setFinalDue(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Preview */}
          {plan.length > 0 && (
            <div style={previewBoxStyle}>
              <div style={{ fontWeight: 600, fontSize: 11, color: C.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</div>
              {plan.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: i < plan.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ color: C.rosaText, fontSize: 10 }}>●</span>
                  <span style={{ flex: 1, color: C.ink, fontWeight: i === 0 || i === plan.length - 1 ? 600 : 400 }}>{m.label}</span>
                  <span style={{ color: C.ink, fontWeight: 500, minWidth: 70, textAlign: 'right' }}>{fmt(m.amount)}</span>
                  <span style={{ color: C.gray, fontSize: 11, minWidth: 90, textAlign: 'right' }}>Due {formatDateDisplay(m.due_date)}</span>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: C.gray }}>Total</span>
                <span style={{ fontWeight: 600, color: planTotalExact ? 'var(--text-success)' : 'var(--text-danger)' }}>
                  {fmt(planTotal)} {planTotalExact ? '✓' : `≠ ${fmt(totalNum)}`}
                </span>
              </div>
            </div>
          )}

          {/* Confirm warning */}
          {confirmStep && milestones.length > 0 && (
            <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
              This will add {plan.length} new milestone{plan.length !== 1 ? 's' : ''} to the existing {milestones.length}.
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ padding: '5px 12px', background: C.rosa, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {generating ? 'Creating…' : 'Yes, continue'}
                </button>
                <button
                  onClick={() => setConfirmStep(false)}
                  style={{ padding: '5px 12px', background: 'transparent', color: C.gray, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Footer buttons */}
          {!confirmStep && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <button
                onClick={onClose}
                style={{ padding: '7px 14px', background: 'transparent', color: C.gray, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={plan.length === 0 || totalNum <= 0 || generating}
                style={{
                  padding: '7px 16px', background: plan.length > 0 && totalNum > 0 ? C.rosa : C.border,
                  color: plan.length > 0 && totalNum > 0 ? '#fff' : C.gray,
                  border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  cursor: plan.length > 0 && totalNum > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                {generating ? 'Creating…' : 'Generate milestones →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── REFUND MODAL ────────────────────────────────────────────────────────────
const RefundModal = ({ milestone, eventId, logRefund, onClose }) => {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState(milestone ? String(milestone.amount) : '');
  const [reason, setReason] = useState('');
  const [refundedAt, setRefundedAt] = useState(today);
  const [voidMilestone, setVoidMilestone] = useState(!!milestone);
  const [saving, setSaving] = useState(false);

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1300, padding: 16,
  };
  const panelStyle = {
    background: '#fff', borderRadius: 12, width: '100%', maxWidth: 400,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
  };
  const headerStyle = {
    padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };
  const bodyStyle = { padding: 18, display: 'flex', flexDirection: 'column', gap: 14 };
  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4 };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const inputStyle = {
    padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 6,
    fontSize: 13, color: C.ink, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast('Enter a valid refund amount', 'error'); return; }
    if (milestone && amt > Number(milestone.amount)) { toast(`Refund cannot exceed ${fmt(milestone.amount)}`, 'error'); return; }
    setSaving(true);
    const { error } = await logRefund({
      event_id: eventId,
      milestone_id: milestone?.id || null,
      amount: amt,
      reason: reason.trim() || null,
      refunded_at: refundedAt,
      void_milestone: voidMilestone,
    });
    setSaving(false);
    if (error) { toast('Failed to log refund', 'error'); return; }
    toast(voidMilestone ? 'Refund logged & milestone voided ✓' : 'Refund logged ✓');
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{milestone ? 'Void / Refund' : 'Log Refund'}</span>
          <span onClick={onClose} style={{ cursor: 'pointer', color: C.gray, fontSize: 18, lineHeight: 1 }}>×</span>
        </div>
        <div style={bodyStyle}>
          {milestone && (
            <div style={{ fontSize: 12, color: C.gray }}>
              Refund for: <strong style={{ color: C.ink }}>{milestone.label}</strong> ({fmt(milestone.amount)})
            </div>
          )}
          <div style={fieldStyle}>
            <label style={labelStyle}>Refund amount</label>
            <input
              type="number" min="0.01" step="0.01"
              max={milestone ? milestone.amount : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
              placeholder="0.00"
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
              placeholder="e.g. Service cancelled, overpayment…"
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Refund date</label>
            <input
              type="date"
              value={refundedAt}
              onChange={(e) => setRefundedAt(e.target.value)}
              style={inputStyle}
            />
          </div>
          {milestone && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 12, color: C.ink, lineHeight: 1.4 }}>
              <input
                type="checkbox"
                checked={voidMilestone}
                onChange={(e) => setVoidMilestone(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--color-danger, #DC2626)', flexShrink: 0 }}
              />
              <span>
                <strong>Void this milestone</strong> — mark it as unpaid and deduct from the collected total
              </span>
            </label>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button
              onClick={onClose}
              style={{ padding: '7px 14px', background: 'transparent', color: C.gray, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '7px 16px', background: 'var(--color-danger, #DC2626)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : (voidMilestone ? '↩ Void & refund' : 'Log refund')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── TIP MODAL ────────────────────────────────────────────────────────────────
const TipModal = ({ eventId, onLogTip, onClose }) => {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1300, padding: 16,
  };
  const panelStyle = {
    background: '#fff', borderRadius: 12, width: '100%', maxWidth: 360,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
  };
  const headerStyle = {
    padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };
  const bodyStyle = { padding: 18, display: 'flex', flexDirection: 'column', gap: 14 };
  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4 };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const inputStyle = {
    padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 6,
    fontSize: 13, color: C.ink, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast('Enter a valid tip amount', 'error'); return; }
    setSaving(true);
    const { error } = await onLogTip({ event_id: eventId, amount: amt });
    setSaving(false);
    if (error) { toast('Failed to log tip', 'error'); return; }
    toast('Tip logged');
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>Log gratuity / tip</span>
          <span onClick={onClose} style={{ cursor: 'pointer', color: C.gray, fontSize: 18, lineHeight: 1 }}>×</span>
        </div>
        <div style={bodyStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Tip amount</label>
            <input
              type="number" min="0.01" step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={inputStyle}
              placeholder="e.g. Staff gratuity"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button
              onClick={onClose}
              style={{ padding: '7px 14px', background: 'transparent', color: C.gray, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '7px 16px', background: 'var(--color-success, #15803D)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : 'Save tip'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SORTABLE MILESTONE ROW ───────────────────────────────────────────────────
const SortableMilestone = ({ m, isLastInGroup, onMarkPaid, onRemind, onGeneratePayLink, copiedPayLinkId, onLogRefund }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.id });

  const dndStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const ms = m.status || (m.paid_date ? 'paid' : 'pending');
  const dueStr = m.due_date ? new Date(m.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (m.due || '');
  const paidStr = m.paid_date ? new Date(m.paid_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (m.paidDate || '');
  const dotCol = ms === 'paid' ? 'var(--color-success)' : ms === 'overdue' ? 'var(--color-danger)' : C.rosa;
  const textCol = ms === 'paid' ? 'var(--text-success)' : ms === 'overdue' ? 'var(--text-danger)' : C.ink;
  const stripeDashboardUrl = m.stripe_payment_link_id
    ? `https://dashboard.stripe.com/payment-links/${m.stripe_payment_link_id}`
    : 'https://dashboard.stripe.com/payment-links';

  const pill = (bg, color, border) => ({
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: bg, color, border: border || 'none', cursor: 'pointer',
    lineHeight: 1.3, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center',
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        ...dndStyle,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        borderBottom: !isLastInGroup ? `1px solid ${C.border}` : 'none',
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{ color: C.border, cursor: 'grab', flexShrink: 0, marginTop: 3, fontSize: 14, userSelect: 'none' }}
        title="Drag to reorder"
      >⠿</div>

      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotCol, marginTop: 5, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{m.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: textCol, flexShrink: 0 }}>
            {fmt(Number(m.amount))}
          </span>
        </div>
        <div style={{ fontSize: 11, color: ms === 'overdue' ? 'var(--text-danger)' : C.gray, marginTop: 2 }}>
          {ms === 'paid' ? `Paid ${paidStr}` : `Due ${dueStr}${m.daysLate ? ` · ${m.daysLate}d overdue` : ''}`}
          {m.stripe_payment_link_url && ms !== 'paid' && (
            <a href={stripeDashboardUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, fontSize: 10, color: '#635BFF', textDecoration: 'none', fontWeight: 500 }} title="View in Stripe dashboard">↗ Stripe</a>
          )}
        </div>
        {ms !== 'paid' && m.last_reminded_at && (
          <div style={{ fontSize: 10, color: C.gray, marginTop: 1, fontStyle: 'italic' }}>
            Reminded {new Date(m.last_reminded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
          {ms === 'overdue' && <>
            <button onClick={() => onMarkPaid(m)} style={pill(C.rosa, '#fff')}>✓ Mark paid</button>
            <button onClick={() => onRemind(m)} style={pill('transparent', C.gray, `1px solid ${C.border}`)}>Remind</button>
            {m.stripe_payment_link_url
              ? <a href={m.stripe_payment_link_url} target="_blank" rel="noopener noreferrer" style={{ ...pill('#D1FAE5', '#065F46'), textDecoration: 'none' }}>💳 Pay online</a>
              : onGeneratePayLink && <button onClick={() => onGeneratePayLink(m)} style={pill(copiedPayLinkId === m.id ? '#D1FAE5' : 'transparent', copiedPayLinkId === m.id ? '#065F46' : C.gray, `1px solid ${C.border}`)}>{copiedPayLinkId === m.id ? '✓ Copied' : 'Generate link'}</button>}
          </>}
          {ms === 'pending' && <>
            <button onClick={() => onMarkPaid(m)} style={pill(C.rosa + '20', C.rosa, `1px solid ${C.rosa}60`)}>✓ Mark paid</button>
            <button onClick={() => onRemind(m)} style={pill('transparent', C.gray, `1px solid ${C.border}`)}>Remind</button>
            {m.stripe_payment_link_url
              ? <a href={m.stripe_payment_link_url} target="_blank" rel="noopener noreferrer" style={{ ...pill('#D1FAE5', '#065F46'), textDecoration: 'none' }}>💳 Pay online</a>
              : onGeneratePayLink && <button onClick={() => onGeneratePayLink(m)} style={pill('transparent', C.gray, `1px solid ${C.border}`)}>{copiedPayLinkId === m.id ? '✓ Copied' : 'Generate link'}</button>}
          </>}
          {ms === 'paid' && <>
            {m.stripe_payment_link_url && (
              <a href={stripeDashboardUrl} target="_blank" rel="noopener noreferrer" style={{ ...pill('transparent', '#635BFF', '1px solid #635BFF40'), textDecoration: 'none' }}>↗ View in Stripe</a>
            )}
            {onLogRefund && <button onClick={() => onLogRefund(m)} style={pill('transparent', 'var(--color-danger, #DC2626)', '1px solid #DC262640')}>↩ Refund</button>}
          </>}
        </div>
      </div>
    </div>
  );
};

// ─── PAYMENT MILESTONES CARD ──────────────────────────────────────────────────
const PaymentMilestonesCard = ({
  ev,
  milestones,
  onAddMilestone,
  onMarkPaid,
  onRemind,
  onReorder,
  onGeneratePayLink,
  copiedPayLinkId,
  createMilestone,
  createMilestones,
  boutique,
  onLogRefund: onLogRefundProp,
  onLogTip,
  logRefund,
  refunds: allRefunds,
}) => {
  const sensors = useSensors(useSensor(PointerSensor));
  const [showAutoPlan, setShowAutoPlan] = useState(false);
  const [refundingMilestone, setRefundingMilestone] = useState(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const [paidExpanded, setPaidExpanded] = useState(false);

  const eventRefunds = (allRefunds || []).filter(r => r.event_id === ev.id);
  const totalRefunded = eventRefunds.reduce((s, r) => s + Number(r.amount), 0);
  const netCollected = Number(ev.paid) - totalRefunded;

  const { sorted, overdueMilestones, upcomingMilestones, paidMilestones, sortedIds } = useMemo(() => {
    const getStatus = m => m.status || (m.paid_date ? 'paid' : 'pending');
    const statusOrder = { overdue: 0, pending: 1, paid: 2 };
    const s = [...milestones].sort((a, b) => (statusOrder[getStatus(a)] ?? 9) - (statusOrder[getStatus(b)] ?? 9));
    return {
      sorted: s,
      overdueMilestones: s.filter(m => getStatus(m) === 'overdue'),
      upcomingMilestones: s.filter(m => getStatus(m) === 'pending'),
      paidMilestones: s.filter(m => getStatus(m) === 'paid'),
      sortedIds: s.map(m => m.id),
    };
  }, [milestones]);
  const showPaidRows = paidMilestones.length <= 2 || paidExpanded;

  const handleLogRefund = (m) => setRefundingMilestone(m);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex(m => m.id === active.id);
    const newIndex = sorted.findIndex(m => m.id === over.id);
    onReorder?.(arrayMove(sorted, oldIndex, newIndex));
  };

  const SectionHeader = ({ label, count, color, onClick, expandLabel }) => (
    <div
      onClick={onClick}
      style={{
        padding: '5px 14px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.07em', color, background: C.grayBg, borderTop: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span>{label} · {count}</span>
      {expandLabel && <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: C.gray }}>{expandLabel}</span>}
    </div>
  );

  return (
    <>
      <Card>
        <div className="card-header">
          <span style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>Payment milestones</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {createMilestone && boutique && (
              <button onClick={() => setShowAutoPlan(true)} className="card-header-action" style={{ fontSize: 11 }} title="Auto-generate a payment plan">⚡ Auto-plan</button>
            )}
            <button onClick={onAddMilestone} className="card-header-action">+ Add</button>
          </div>
        </div>

        {milestones.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: C.gray, marginBottom: 12 }}>No payment milestones yet</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={onAddMilestone} style={{ padding: '7px 16px', background: C.rosa, color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add milestone</button>
              {createMilestone && boutique && (
                <button onClick={() => setShowAutoPlan(true)} style={{ padding: '7px 16px', background: 'transparent', color: C.gray, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>⚡ Auto-generate plan</button>
              )}
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
              {overdueMilestones.length > 0 && <>
                <SectionHeader label="Overdue" count={overdueMilestones.length} color="var(--color-danger, #DC2626)" />
                {overdueMilestones.map((m, i) => (
                  <SortableMilestone key={m.id} m={m} isLastInGroup={i === overdueMilestones.length - 1} onMarkPaid={onMarkPaid} onRemind={onRemind} onGeneratePayLink={onGeneratePayLink} copiedPayLinkId={copiedPayLinkId} onLogRefund={logRefund ? handleLogRefund : undefined} />
                ))}
              </>}
              {upcomingMilestones.length > 0 && <>
                <SectionHeader label="Upcoming" count={upcomingMilestones.length} color={C.gray} />
                {upcomingMilestones.map((m, i) => (
                  <SortableMilestone key={m.id} m={m} isLastInGroup={i === upcomingMilestones.length - 1} onMarkPaid={onMarkPaid} onRemind={onRemind} onGeneratePayLink={onGeneratePayLink} copiedPayLinkId={copiedPayLinkId} onLogRefund={logRefund ? handleLogRefund : undefined} />
                ))}
              </>}
              {paidMilestones.length > 0 && <>
                <SectionHeader
                  label="Paid"
                  count={paidMilestones.length}
                  color="var(--color-success, #15803D)"
                  onClick={paidMilestones.length > 2 ? () => setPaidExpanded(x => !x) : undefined}
                  expandLabel={paidMilestones.length > 2 ? (paidExpanded ? '▲ Hide' : '▼ Show all') : undefined}
                />
                {showPaidRows && paidMilestones.map((m, i) => (
                  <SortableMilestone key={m.id} m={m} isLastInGroup={i === paidMilestones.length - 1} onMarkPaid={onMarkPaid} onRemind={onRemind} onGeneratePayLink={onGeneratePayLink} copiedPayLinkId={copiedPayLinkId} onLogRefund={logRefund ? handleLogRefund : undefined} />
                ))}
              </>}
            </SortableContext>
          </DndContext>
        )}

        <div style={{ padding: '9px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: C.gray, fontSize: 11 }}>{milestones.length} milestone{milestones.length !== 1 ? 's' : ''} · {paidMilestones.length} paid</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onLogTip && (
              <button onClick={() => setShowTipModal(true)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#D1FAE5', color: '#065F46', border: 'none', cursor: 'pointer' }}>+ Tip</button>
            )}
            <span style={{ fontSize: 11, fontWeight: 500, color: ev.overdue > 0 ? 'var(--text-danger)' : 'var(--text-success)' }}>
              {ev.overdue > 0 ? `${fmt(ev.overdue)} overdue` : 'Fully paid ✓'}
            </span>
          </div>
        </div>
        {totalRefunded > 0 && (
          <div style={{ padding: '7px 16px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: 'var(--color-danger, #DC2626)', display: 'flex', gap: 12 }}>
            <span>↩ {fmt(totalRefunded)} refunded</span>
            <span style={{ color: C.gray }}>· Net collected: <strong style={{ color: C.ink }}>{fmt(netCollected)}</strong></span>
          </div>
        )}
      </Card>

      {showAutoPlan && createMilestones && boutique && (
        <PaymentPlanModal ev={ev} milestones={milestones} createMilestones={createMilestones} boutique={boutique} onClose={() => setShowAutoPlan(false)} />
      )}
      {refundingMilestone && logRefund && (
        <RefundModal milestone={refundingMilestone} eventId={ev.id} logRefund={logRefund} onClose={() => setRefundingMilestone(null)} />
      )}
      {showTipModal && onLogTip && (
        <TipModal eventId={ev.id} onLogTip={onLogTip} onClose={() => setShowTipModal(false)} />
      )}
    </>
  );
};

export default PaymentMilestonesCard;
