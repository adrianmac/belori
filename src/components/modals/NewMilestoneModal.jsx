import React, { useState } from 'react';
import { C, fmt } from '../../lib/colors';
import { PrimaryBtn, GhostBtn, useToast, inputSt, LBL } from '../../lib/ui.jsx';

const NewMilestoneModal = ({ liveEvent, createMilestone, onClose }) => {
  const toast = useToast();
  const [newMs, setNewMs] = useState({ label: '', amount: '', due: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newMs.label.trim() || !newMs.amount) {
      toast('Label and amount required', 'warn');
      return;
    }
    
    if (createMilestone && liveEvent?.id) {
      setSaving(true);
      const { error } = await createMilestone({
        event_id: liveEvent.id,
        label: newMs.label.trim(),
        amount: Number(newMs.amount),
        due_date: newMs.due || null,
        status: 'pending'
      });
      setSaving(false);
      
      if (error) {
        toast('Failed to add milestone', 'warn');
        return;
      }
    }
    
    onClose();
    toast('Milestone added ✓');
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, width: 420, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>Add payment milestone</span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>×</button>
        </div>
        
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ ...LBL }}>Label</div>
            <input value={newMs.label} onChange={e => setNewMs(m => ({ ...m, label: e.target.value }))} placeholder="e.g. Final balance" style={{ ...inputSt }} />
          </div>
          {(() => {
            const remaining = Number(liveEvent?.total || 0) - Number(liveEvent?.paid || 0);
            return remaining > 0 ? (
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#1E40AF' }}>Remaining balance: <strong>{fmt(remaining)}</strong></span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setNewMs(m => ({ ...m, amount: String(remaining.toFixed(2)) }))}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #BFDBFE', background: '#DBEAFE', color: '#1E40AF', cursor: 'pointer', fontWeight: 500 }}>
                    Full balance
                  </button>
                  <button type="button" onClick={() => setNewMs(m => ({ ...m, amount: String((remaining / 2).toFixed(2)) }))}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #BFDBFE', background: '#DBEAFE', color: '#1E40AF', cursor: 'pointer', fontWeight: 500 }}>
                    Split in half
                  </button>
                </div>
              </div>
            ) : null;
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ ...LBL }}>Amount ($)</div>
              <input type="number" value={newMs.amount} onChange={e => setNewMs(m => ({ ...m, amount: e.target.value }))} placeholder="0.00" style={{ ...inputSt }} />
            </div>
            <div>
              <div style={{ ...LBL }}>Due date</div>
              <input type="date" value={newMs.due} onChange={e => setNewMs(m => ({ ...m, due: e.target.value }))} style={{ ...inputSt }} />
            </div>
          </div>
        </div>
        
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose} />
          <PrimaryBtn label={saving ? 'Saving…' : 'Add milestone'} onClick={handleSave} />
        </div>
      </div>
    </div>
  );
};

export default NewMilestoneModal;
