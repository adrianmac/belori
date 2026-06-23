import React, { useState } from 'react';
import { C, EVT_TYPES, fmt } from '../../lib/colors';
import { Badge, PrimaryBtn, GhostBtn, inputSt, LBL } from '../../lib/ui.jsx';

export const RentDressModal = ({dress, events, clients, onClose, onRent}) => {
  const [step,setStep]=useState(1);
  const [query,setQuery]=useState('');
  const [selEv,setSelEv]=useState(null);       // selected event (optional)
  const [selClient,setSelClient]=useState(null); // selected client (no event)
  const [newClient,setNewClient]=useState({name:'',phone:'',email:''});
  const [newMode,setNewMode]=useState(false);   // creating new client inline
  const [pickupDate,setPickupDate]=useState('');
  const [returnDate,setReturnDate]=useState('');
  const [depositOk,setDepositOk]=useState(false);
  const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');

  const q=query.toLowerCase();
  const upcoming=(events||[]).filter(e=>e.status!=='cancelled'&&(e.daysUntil==null||e.daysUntil>-60));
  const filteredEvs=q?upcoming.filter(e=>(e.client||'').toLowerCase().includes(q)||(e.name||'').toLowerCase().includes(q)):upcoming.slice(0,8);
  const filteredClients=q?(clients||[]).filter(c=>(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q)):(clients||[]).slice(0,6);

  const autoFillDates=evDate=>{
    if(!evDate)return;
    const d=new Date(evDate+'T12:00:00');
    const pick=new Date(d); pick.setDate(d.getDate()-1);
    const ret=new Date(d);  ret.setDate(d.getDate()+2);
    setPickupDate(pick.toISOString().split('T')[0]);
    setReturnDate(ret.toISOString().split('T')[0]);
  };

  const pickEvent=ev=>{setSelEv(ev);setSelClient(null);setNewMode(false);autoFillDates(ev.event_date||ev.eventDate);setStep(2);};
  const pickClient=cl=>{setSelClient(cl);setSelEv(null);setNewMode(false);setStep(2);};
  const skipToWalkin=()=>{setSelEv(null);setSelClient(null);setNewMode(true);setStep(2);};

  // resolved display name for step 2
  const clientLabel=selEv?.client||selClient?.name||(newMode&&newClient.name)||'Walk-in';

  const confirm=async()=>{
    if(!pickupDate)return setErr('Pickup date is required');
    if(!returnDate)return setErr('Return date is required');
    if(newMode&&!newClient.name.trim())return setErr('Client name is required');
    setSaving(true);setErr('');
    const retLabel=returnDate?new Date(returnDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
    const res=await onRent(dress.id,{
      status:'reserved',
      client_id:selEv?.client_id||selClient?.id||null,
      event_id:selEv?.id||null,
      pickup_date:pickupDate,
      return_date:returnDate,
      notes,
    });
    if(res?.error)setErr(res.error.message||'Could not save rental');
    else onClose();
    setSaving(false);
  };

  const rentalDays=pickupDate&&returnDate?Math.max(1,Math.ceil((new Date(returnDate)-new Date(pickupDate))/(1000*60*60*24))):null;

  return(
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div role="dialog" aria-modal="true" aria-labelledby="rent-dress-title" style={{background:C.white,borderRadius:16,width:490,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        {/* Header */}
        <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div id="rent-dress-title" style={{fontSize:16,fontWeight:600,color:C.ink}}>Rent dress</div>
            <div style={{fontSize:12,color:C.gray,marginTop:2}}>#{dress.sku} · {dress.name} · Size {dress.size} · {dress.color}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{display:'flex',gap:5}}>
              {[1,2].map(s=><div key={s} style={{width:8,height:8,borderRadius:'50%',background:step>=s?C.rosa:C.border,transition:'background 0.2s'}}/>)}
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.gray,cursor:'pointer',lineHeight:1}} aria-label="Close">×</button>
          </div>
        </div>

        {/* ── Step 1 — Client / Event search ── */}
        {step===1&&(
          <>
            <div style={{flex:1,overflowY:'auto',padding:'16px 24px'}}>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search client name, event, or phone…" autoFocus style={{...inputSt,marginBottom:14}}/>

              {/* Events section */}
              {filteredEvs.length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>LINK TO EVENT</div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {filteredEvs.map(ev=>{
                      const t=EVT_TYPES[ev.type]||{bg:C.grayBg,col:C.gray,label:ev.type||'Event',icon:'📅'};
                      return(
                        <button key={ev.id} onClick={()=>pickEvent(ev)}
                          style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:9,border:`1.5px solid ${C.border}`,background:C.white,cursor:'pointer',textAlign:'left',width:'100%'}}
                          onMouseEnter={e=>e.currentTarget.style.borderColor=C.rosa}
                          onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                          <div style={{width:32,height:32,borderRadius:7,background:t.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{t.icon}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:500,color:C.ink,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ev.client||'(no client)'}</div>
                            <div style={{fontSize:11,color:C.gray}}>{t.label} · {ev.date||ev.event_date}</div>
                          </div>
                          {ev.services?.includes('dress_rental')&&<Badge text="Dress rental" bg={C.rosaPale} color={C.rosaText}/>}
                          <span style={{color:C.gray,fontSize:13}}>›</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Clients section */}
              {filteredClients.length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>CLIENT (NO EVENT)</div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {filteredClients.map(cl=>(
                      <button key={cl.id} onClick={()=>pickClient(cl)}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:9,border:`1.5px solid ${C.border}`,background:C.white,cursor:'pointer',textAlign:'left',width:'100%'}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=C.rosa}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                        <div style={{width:32,height:32,borderRadius:'50%',background:C.rosaPale,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,color:C.rosaText,flexShrink:0}}>{(cl.name||'?')[0].toUpperCase()}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{cl.name}</div>
                          {cl.phone&&<div style={{fontSize:11,color:C.gray}}>{cl.phone}</div>}
                        </div>
                        <span style={{color:C.gray,fontSize:13}}>›</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No results — offer new client */}
              {query&&filteredEvs.length===0&&filteredClients.length===0&&(
                <div style={{padding:'14px',textAlign:'center',color:C.gray,fontSize:13,background:C.ivory,borderRadius:10,marginBottom:12}}>
                  No matches for "{query}"
                </div>
              )}

              {/* New client inline or walk-in */}
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,display:'flex',flexDirection:'column',gap:6}}>
                {query&&(
                  <button onClick={()=>{setNewClient({name:query,phone:'',email:''});skipToWalkin();}}
                    style={{padding:'10px 14px',borderRadius:9,border:`1.5px dashed ${C.rosa}`,background:C.rosaPale,color:C.rosaText,cursor:'pointer',fontSize:13,fontWeight:500,textAlign:'left',width:'100%'}}>
                    + New client "{query}" →
                  </button>
                )}
                <button onClick={skipToWalkin}
                  style={{padding:'10px 14px',borderRadius:9,border:`1.5px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:12,textAlign:'left',width:'100%'}}>
                  Walk-in rental (no client on file) →
                </button>
              </div>
            </div>
            <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>
            </div>
          </>
        )}

        {/* ── Step 2 — Rental Details ── */}
        {step===2&&(
          <>
            <div style={{flex:1,overflowY:'auto',padding:'16px 24px',display:'flex',flexDirection:'column',gap:14}}>

              {/* Summary: dress + client/event */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div style={{background:C.ivory,borderRadius:10,padding:12}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:5}}>DRESS</div>
                  <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{dress.name}</div>
                  <div style={{fontSize:11,color:C.gray}}>{dress.color} · Size {dress.size}</div>
                  <div style={{fontSize:12,fontWeight:500,color:C.rosaText,marginTop:4}}>{fmt(dress.price||0)}/rental</div>
                </div>
                <div style={{background:C.ivory,borderRadius:10,padding:12}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:5}}>{selEv?'EVENT':'CLIENT'}</div>
                  {selEv?(
                    <>
                      <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{selEv.client}</div>
                      <div style={{fontSize:11,color:C.gray}}>{EVT_TYPES[selEv.type]?.label||selEv.type}</div>
                      <div style={{fontSize:11,color:C.gray}}>{selEv.date||selEv.event_date}</div>
                    </>
                  ):selClient?(
                    <>
                      <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{selClient.name}</div>
                      {selClient.phone&&<div style={{fontSize:11,color:C.gray}}>{selClient.phone}</div>}
                      <div style={{fontSize:11,color:C.gray,marginTop:2}}>No event linked</div>
                    </>
                  ):(
                    // New client fields
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      <input value={newClient.name} onChange={e=>setNewClient(p=>({...p,name:e.target.value}))} placeholder="Full name *" style={{...inputSt,fontSize:12,padding:'5px 8px'}}/>
                      <input value={newClient.phone} onChange={e=>setNewClient(p=>({...p,phone:e.target.value}))} placeholder="Phone" style={{...inputSt,fontSize:12,padding:'5px 8px'}}/>
                      <input value={newClient.email} onChange={e=>setNewClient(p=>({...p,email:e.target.value}))} placeholder="Email" style={{...inputSt,fontSize:12,padding:'5px 8px'}}/>
                    </div>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div>
                  <label htmlFor="rent-dress-pickup-date" style={LBL}>Pickup date *</label>
                  <input id="rent-dress-pickup-date" type="date" value={pickupDate} onChange={e=>setPickupDate(e.target.value)} style={inputSt}/>
                </div>
                <div>
                  <label htmlFor="rent-dress-return-date" style={LBL}>Return date *</label>
                  <input id="rent-dress-return-date" type="date" value={returnDate} onChange={e=>setReturnDate(e.target.value)} style={inputSt}/>
                </div>
              </div>
              {rentalDays&&<div style={{fontSize:11,color:C.gray,marginTop:-8}}>Rental period: {rentalDays} day{rentalDays!==1?'s':''}</div>}

              {/* Deposit */}
              <div style={{background:'var(--bg-success)',borderRadius:10,padding:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text-success)',marginBottom:2}}>Deposit due at pickup</div>
                  <div style={{fontSize:22,fontWeight:700,color:'var(--text-success)',lineHeight:1}}>{fmt(dress.deposit||0)}</div>
                </div>
                <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                  <input type="checkbox" checked={depositOk} onChange={e=>setDepositOk(e.target.checked)} style={{width:16,height:16,accentColor:'var(--color-success)'}}/>
                  <span style={{fontSize:12,color:'var(--text-success)',fontWeight:500}}>Collected</span>
                </label>
              </div>

              <div>
                <label htmlFor="rent-dress-notes" style={LBL}>Notes (optional)</label>
                <textarea id="rent-dress-notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Alterations needed, special care instructions…" style={{...inputSt,minHeight:52,resize:'vertical'}}/>
              </div>
              {err&&<div style={{fontSize:12,color:'var(--text-danger)'}}>{err}</div>}
            </div>
            <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,justifyContent:'space-between'}}>
              <GhostBtn label="← Back" onClick={()=>setStep(1)}/>
              <PrimaryBtn label={saving?'Saving…':'Confirm rental'} colorScheme="success" onClick={confirm}/>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RentDressModal;
