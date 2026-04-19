import React, { useState } from 'react';
import { C } from '../../lib/colors';
import { PrimaryBtn, GhostBtn, inputSt, LBL } from '../../lib/ui.jsx';
import { DRESS_TRANSITIONS } from '../../lib/urgency';
import DressPickupModal from './DressPickupModal';
import DressReturnModal from './DressReturnModal';

export const DressLifecycleModal = ({dress, onClose, onUpdate}) => {
  const next=DRESS_TRANSITIONS[dress.status]?.next;
  const [notes,setNotes]=useState('');
  const [condition,setCondition]=useState('perfect');
  const [saving,setSaving]=useState(false);

  const TITLES={
    available:'Reserve for event',
    reserved:'Mark dress as picked up',
    picked_up:'Log dress return',
    rented:'Log dress return',
    returned:'Send to cleaning',
    cleaning:'Mark cleaning complete & available'
  };

  const DESCS={
    available:`Mark gown #${dress.sku} as reserved for a client. Ensure you link it to the correct event.`,
    reserved:`Confirm the client picked up gown #${dress.sku}. The dress will be marked as rented.`,
    picked_up:'Record the dress return and inspect the condition.',
    rented:'Record the dress return and inspect the condition.',
    returned:`Send gown #${dress.sku} to the cleaner. It will be marked as "In cleaning".`,
    cleaning:`Mark gown #${dress.sku} as cleaned and available to rent again.`,
  };

  const confirm=async()=>{
    if(!next)return;
    setSaving(true);
    await onUpdate(dress.id,{status:next,...((dress.status==='rented'||dress.status==='picked_up')?{condition_on_return:condition}:{})});
    setSaving(false);
    onClose();
  };

  if (dress.status === 'reserved') {
    return <DressPickupModal dress={dress} onClose={onClose} onUpdate={onUpdate} />;
  }

  if (dress.status === 'picked_up' || dress.status === 'rented' || dress.status === 'overdue') {
    return <DressReturnModal dress={dress} onClose={onClose} onUpdate={onUpdate} />;
  }

  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{background:C.white,borderRadius:16,width:440,display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'20px 24px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:600,fontSize:16,color:C.ink}}>{TITLES[dress.status]||'Update status'}</div>
          <button onClick={onClose} aria-label="Close" style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:24,display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:C.ivory,borderRadius:8,padding:'12px 14px'}}>
            <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{dress.name}</div>
            <div style={{fontSize:12,color:C.gray,marginTop:2}}>#{dress.sku} · Size {dress.size||'—'} · {dress.color||'—'} · {dress.cat||dress.category||''}</div>
          </div>
          <div style={{fontSize:13,color:C.gray}}>{DESCS[dress.status]||''}</div>
          {(dress.status==='rented'||dress.status==='picked_up')&&(
            <div>
              <div style={{...LBL,marginBottom:8}}>Condition on return</div>
              {[['perfect','✓ Perfect — no issues, ready for cleaning'],['minor_soiling','Minor soiling — normal wear, cleaning will resolve'],['needs_repair','⚠ Needs repair — torn seam, missing button, etc.'],['damaged','🚨 Damaged — significant damage, client may be charged']].map(([v,l])=>(
                <button key={v} onClick={()=>setCondition(v)} style={{display:'block',width:'100%',textAlign:'left',padding:'8px 12px',marginBottom:4,borderRadius:7,border:`1.5px solid ${condition===v?C.rosa:C.border}`,background:condition===v?C.rosaPale:'transparent',color:condition===v?C.rosaText:C.ink,cursor:'pointer',fontSize:12}}>{l}</button>
              ))}
            </div>
          )}
          <div><label htmlFor="dlm-notes" style={LBL}>Notes (optional)</label><textarea id="dlm-notes" value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Any notes..." style={{...inputSt,resize:'vertical'}}/></div>
        </div>
        <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/><PrimaryBtn label={saving?'Updating…':(DRESS_TRANSITIONS[dress.status]?.label||'Confirm')} onClick={confirm}/>
        </div>
      </div>
    </div>
  );
};

export default DressLifecycleModal;
