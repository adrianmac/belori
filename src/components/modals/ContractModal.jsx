import React, { useState, useEffect } from 'react';
import { C } from '../../lib/colors';
import { PrimaryBtn, GhostBtn, useToast } from '../../lib/ui.jsx';
import { supabase } from '../../lib/supabase';

const ContractModal = ({ liveEvent, onClose, onSuccess }) => {
  const toast = useToast();
  const [contractTitle, setContractTitle] = useState('');
  const [contractBody, setContractBody] = useState('');
  const [contractSaving, setContractSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Default contract template generator
  const defaultContractBody = (ev) => {
    const date = ev?.event_date
      ? new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : '[Date TBD]';
    const type = ev?.type === 'quince' ? 'Quinceañera' : 'Wedding';
    return `SERVICE AGREEMENT

This agreement is between the boutique and ${ev?.client || '[Client Name]'} for ${type} services on ${date}.

SERVICES INCLUDED:
${(ev?.services || []).join(', ') || 'To be specified'}

CONTRACT VALUE: $${ev?.total || 0}

PAYMENT TERMS:
- A deposit of 50% is required to reserve the date.
- The remaining balance is due 30 days before the event.
- Payments are non-refundable unless the boutique cancels.

CANCELLATION POLICY:
- Cancellations made 90+ days before the event: 50% deposit refunded.
- Cancellations made within 90 days: No refund.

By signing below, the client agrees to the terms of this agreement.`;
  };

  useEffect(() => {
    if (liveEvent) {
      setContractTitle(`${liveEvent.type === 'quince' ? 'Quinceañera' : 'Wedding'} Contract — ${liveEvent.client || 'Client'}`);
      setContractBody(defaultContractBody(liveEvent));
    }
  }, [liveEvent]);

  const handleCreate = async (sendEmail = false) => {
    if (!contractTitle.trim()) { toast('Title required', 'error'); return; }
    
    if (sendEmail && !liveEvent.clientData?.email) {
      toast('Client email is missing from their profile', 'error');
      return;
    }
    
    if (sendEmail) setSendingEmail(true);
    else setContractSaving(true);
    
    const { data, error } = await supabase.from('contracts').insert({
      boutique_id: liveEvent.boutique_id,
      event_id: liveEvent.id,
      client_id: liveEvent.clientData?.id || null,
      title: contractTitle.trim(),
      body_html: contractBody,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }).select().single();
    
    if (error) { 
      toast('Failed to create contract', 'error'); 
      setContractSaving(false); 
      setSendingEmail(false); 
      return; 
    }
    
    onSuccess(data); // Provide the new contract back to the parent to append to state
    
    const link = `${window.location.origin}/sign/${data.sign_token}`;
    
    if (sendEmail) {
      await supabase.functions.invoke('send-email', {
        body: {
          to: liveEvent.clientData.email,
          subject: `Contract for signature: ${contractTitle.trim()}`,
          html: `<p>Hi ${liveEvent.clientData?.name?.split(' ')[0] || 'there'},</p>
                 <p>Your contract for your upcoming event is ready to be signed. Please review and sign it electronically using the secure link below:</p>
                 <p><a href="${link}">${link}</a></p>
                 <br/><p>Thank you!</p>`
        }
      });
      toast('Contract created and emailed to client! ✓', 'success');
    } else {
      navigator.clipboard.writeText(link);
      toast('Contract created + link copied ✓');
    }
    
    setContractSaving(false);
    setSendingEmail(false);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, width: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>New contract</span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 11, color: '#15803D', lineHeight: 1.6 }}>
            A signing link will be generated automatically. Send it to your client — they can sign from any device, no login required.
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contract title</div>
            <input value={contractTitle} onChange={e => setContractTitle(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.ink }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contract body</div>
            <textarea value={contractBody} onChange={e => setContractBody(e.target.value)} rows={14}
              style={{ width: '100%', padding: '12px', borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 12, fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.7, color: C.ink }} />
            <div style={{ fontSize: 10, color: C.gray, marginTop: 4 }}>Customize the contract text above before sending. The client will see this on the signing page.</div>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose} />
          <div style={{ display: 'flex', gap: 8 }}>
            <GhostBtn label={sendingEmail ? 'Sending...' : '📧 Create & Email'} colorScheme="primary" onClick={() => handleCreate(true)} disabled={contractSaving || sendingEmail || !liveEvent.clientData?.email} />
            <PrimaryBtn label={contractSaving ? 'Creating…' : '🔗 Create & copy link'} colorScheme="success" onClick={() => handleCreate(false)} disabled={contractSaving || sendingEmail} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractModal;
