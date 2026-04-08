import React, { useState } from 'react';
import { C } from '../../lib/colors';
import { PrimaryBtn, GhostBtn, inputSt, LBL, useToast } from '../../lib/ui.jsx';
import { HOW_FOUND_LABELS } from '../../pages/clients/clientConfigs';

const NewClientModal = ({ onClose, createClient, onSuccess }) => {
  const toast = useToast();
  const [newCl, setNewCl] = useState({ firstName: '', lastName: '', phone: '', email: '', partner: '', language: 'en', howFound: '', birthday: '', anniversary: '' });
  const [saving, setSaving] = useState(false);

  const handleNew = async () => {
    if (!newCl.firstName.trim()) { toast('First name is required', 'warn'); return; }
    if (!newCl.lastName.trim()) { toast('Last name is required', 'warn'); return; }
    if (!newCl.phone.trim()) { toast('Phone number is required', 'warn'); return; }

    setSaving(true);
    const { data, error } = await createClient({
      name: `${newCl.firstName.trim()} ${newCl.lastName.trim()}`,
      phone: newCl.phone.trim(),
      email: newCl.email.trim() || null,
      partner_name: newCl.partner.trim() || null,
      language_preference: newCl.language || null,
      referred_by: newCl.howFound.trim() || null,
      birthday: newCl.birthday || null,
      anniversary: newCl.anniversary || null,
    });
    setSaving(false);
    
    if (!error) {
      toast('Client added');
      onClose();
      if (onSuccess && data) onSuccess(data);
    } else {
      toast('Failed to add client', 'warn');
    }
  };

  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:C.white,borderRadius:16,width:520,maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 24px 48px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'24px 24px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start',background:C.grayBg}}>
          <div>
            <div style={{fontWeight:600,fontSize:18,color:C.ink,marginBottom:4}}>New client</div>
            <div style={{fontSize:13,color:C.gray}}>Enter contact details and preferences.</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div><div style={{...LBL}}>First name *</div><input value={newCl.firstName} onChange={e=>setNewCl(n=>({...n,firstName:e.target.value}))} placeholder="Sophia" style={{...inputSt}}/></div>
            <div><div style={{...LBL}}>Last name *</div><input value={newCl.lastName} onChange={e=>setNewCl(n=>({...n,lastName:e.target.value}))} placeholder="Rodriguez" style={{...inputSt}}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div><div style={{...LBL}}>Phone *</div><input value={newCl.phone} onChange={e=>setNewCl(n=>({...n,phone:e.target.value}))} placeholder="(956) 555-0123" style={{...inputSt}} type="tel"/></div>
            <div><div style={{...LBL}}>Email</div><input value={newCl.email} onChange={e=>setNewCl(n=>({...n,email:e.target.value}))} placeholder="email@example.com" style={{...inputSt}} type="email"/></div>
          </div>
          <div><div style={{...LBL}}>Partner / honoree name</div><input value={newCl.partner} onChange={e=>setNewCl(n=>({...n,partner:e.target.value}))} placeholder="Wedding: partner · Quinceañera: honoree" style={{...inputSt}}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div><div style={{...LBL}}>Preferred language</div><select value={newCl.language} onChange={e=>setNewCl(n=>({...n,language:e.target.value}))} style={{...inputSt}}><option value="en">English</option><option value="es">Spanish</option><option value="both">Both</option></select></div>
            <div><div style={{...LBL}}>How found us</div><select value={newCl.howFound} onChange={e=>setNewCl(n=>({...n,howFound:e.target.value}))} style={{...inputSt}}><option value="">Select…</option>{Object.entries(HOW_FOUND_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div><div style={{...LBL}}>Birthday <span style={{fontWeight:400,color:'#9CA3AF'}}>(optional)</span></div><input value={newCl.birthday} onChange={e=>setNewCl(n=>({...n,birthday:e.target.value}))} type="date" style={{...inputSt}}/></div>
            <div><div style={{...LBL}}>Anniversary <span style={{fontWeight:400,color:'#9CA3AF'}}>(optional)</span></div><input value={newCl.anniversary} onChange={e=>setNewCl(n=>({...n,anniversary:e.target.value}))} type="date" style={{...inputSt}}/></div>
          </div>
        </div>
        <div style={{padding:'16px 24px',borderTop:`1px solid ${C.border}`,background:C.grayBg,display:'flex',justifyContent:'flex-end',gap:12}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/><PrimaryBtn label={saving?'Saving…':'Add client'} colorScheme="success" onClick={handleNew}/>
        </div>
      </div>
    </div>
  );
};

export default NewClientModal;
