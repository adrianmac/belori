import React, { useState } from 'react';
import { C } from '../../lib/colors';
import { PrimaryBtn, GhostBtn, inputSt, LBL } from '../../lib/ui.jsx';

export const DressPickupModal = ({ dress, onClose, onUpdate }) => {
  const [pickupDate, setPickDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnDate, setRetDate] = useState(dress.return_date || dress.returnDate || '');
  const [depositAmt, setDepositAmt] = useState(dress.deposit || 0);
  const [agreement, setAgreement] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const warn = !agreement || !idVerified;

  const handlePickup = async () => {
    setSaving(true);
    await onUpdate(dress.id, {
      status: 'picked_up',
      pickup_date: pickupDate,
      return_date: returnDate,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dress-pickup-title" style={{ background: C.white, borderRadius: 16, width: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div id="dress-pickup-title" style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>Mark picked up</div>
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.gray, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ background: C.ivory, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{dress.name}</div>
            <div style={{ fontSize: 11, color: C.gray }}>#{dress.sku} · {dress.color} · Size {dress.size} · {dress.client?.name || dress.client || 'Walk-in'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label htmlFor="dress-pickup-date" style={LBL}>Pickup date</label><input id="dress-pickup-date" type="date" value={pickupDate} onChange={e => setPickDate(e.target.value)} style={inputSt} /></div>
            <div><label htmlFor="dress-pickup-return-due" style={LBL}>Return due</label><input id="dress-pickup-return-due" type="date" value={returnDate} onChange={e => setRetDate(e.target.value)} style={inputSt} /></div>
          </div>
          <div><label htmlFor="dress-pickup-deposit" style={LBL}>Deposit collected ($)</label><input id="dress-pickup-deposit" type="number" value={depositAmt} onChange={e => setDepositAmt(Number(e.target.value))} style={inputSt} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: C.ink }}>
            <input type="checkbox" checked={agreement} onChange={e => setAgreement(e.target.checked)} style={{ accentColor: C.rosa }} />
            Client has signed the rental agreement
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: C.ink }}>
            <input type="checkbox" checked={idVerified} onChange={e => setIdVerified(e.target.checked)} style={{ accentColor: C.rosa }} />
            Photo ID verified and on file
          </label>
          {warn && <div style={{ fontSize: 11, color: 'var(--text-warning)', background: 'var(--bg-warning)', padding: '8px 12px', borderRadius: 7 }}>⚠ We recommend confirming ID and agreement before releasing the dress.</div>}
        </div>
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose} />
          <PrimaryBtn label={saving ? 'Saving…' : 'Confirm pickup'} colorScheme="success" onClick={handlePickup} />
        </div>
      </div>
    </div>
  );
};

export default DressPickupModal;
