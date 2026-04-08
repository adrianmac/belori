import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { C, fmt, pct, EVT_TYPES } from '../lib/colors';
import { useAuth } from '../context/AuthContext';
import { Avatar, Badge, Card, CardHead, Topbar, PrimaryBtn, GhostBtn, SvcTag,
  Countdown, EventTypeBadge, ProgressBar, StatusDot, AlertBanner, useToast,
  inputSt, LBL } from '../lib/ui.jsx';
import { getPriorityAlert, getCountdownConfig, DRESS_TRANSITIONS } from '../lib/urgency';
import { useLayoutMode } from '../hooks/useLayoutMode.jsx';
import { useModules } from '../hooks/useModules.jsx';
import { logInventoryAudit, useInventoryAudit } from '../hooks/useInventoryAudit';

import ActiveRentalsTab from './dress-rentals/ActiveRentalsTab';
import HistoryTab from './dress-rentals/HistoryTab';
import DressPickupModal from '../components/modals/DressPickupModal';
import DressReturnModal from '../components/modals/DressReturnModal';
import AddDressModal from '../components/modals/AddDressModal';
import { usePayments } from '../hooks/usePayments';
import { supabase } from '../lib/supabase';
import DamageAssessmentModal from '../components/DamageAssessmentModal';
import BarcodeScanner from '../components/BarcodeScanner';


// ─── DRESS RENTALS (4-tab page) ─────────────────────────────────────────────
const GOWN_COLORS={Ivory:'#F5F0E0',White:'#F0F0F0',Champagne:'#D4AF91',Blush:'#F9BFCF','Rose quartz':'#F4A3B8',Magenta:'#E879A0','Royal blue':'#4169E1',Gold:'#D4AF37',Lavender:'#C8A2C8',Coral:'#FF7F6B','Off-white':'#F5F0E0'};
const COND_BADGE={perfect:{bg:'#DCFCE7',col:'#15803D',label:'Perfect'},minor_soiling:{bg:'#FEF3C7',col:'#B45309',label:'Minor soiling'},needs_repair:{bg:'#FEE2E2',col:'#B91C1C',label:'Needs repair'},damaged:{bg:'#FEE2E2',col:'#B91C1C',label:'Damaged'},pending:{bg:'#F3F4F6',col:'#6B7280',label:'Pending'}};
const DressRentals = ({inventory: liveInventory, updateDress, createDress, createJob, events, clients, staff=[], setScreen, setSelectedEvent}) => {
  const toast=useToast();
  const { boutique } = useAuth();
  const { getModuleConfig } = useModules();
  const { createMilestone, markPaid } = usePayments();
  const LATE_FEE_PER_DAY = getModuleConfig('dress_rental')?.late_fee_per_day ?? 25;
  const [tab,setTab]=useState('catalog');
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const [catFilter,setCatFilter]=useState('all');
  const [rentDress,setRentDress]=useState(null);
  const [lifecycleDress,setLifecycleDress]=useState(null);
  const [returnDress,setReturnDress]=useState(null);
  const [pickupDress,setPickupDress]=useState(null);
  const [qrOpen,setQrOpen]=useState(false);
  const [detailDress,setDetailDress]=useState(null);
  const [historyFilter,setHistoryFilter]=useState('all');
  const [newRentalOpen,setNewRentalOpen]=useState(false);
  const [scannerOpen,setScannerOpen]=useState(false);
  const [newRentalInitDress,setNewRentalInitDress]=useState(null);
  const [successRental,setSuccessRental]=useState(null);
  const [returnSearchOpen,setReturnSearchOpen]=useState(false);
  const [showAddDress,setShowAddDress]=useState(false);
  const [catalogView,setCatalogView]=useState('grid'); // 'grid' | 'list'
  const [damageAssessDress,setDamageAssessDress]=useState(null); // dress to assess damage for
  const [historyDress,setHistoryDress]=useState(null); // dress to show audit history for
  const [catalogPage,setCatalogPage]=useState(1);
  const CATALOG_PAGE_SIZE=40;
  const [showSimilar,setShowSimilar]=useState(false);
  const [similarForDress,setSimilarForDress]=useState(null);
  const [lateFeeConfirm,setLateFeeConfirm]=useState(null); // {itemId, daysLate, feeAmount, item}

  // Auto-open new rental modal via FAB custom event
  useEffect(()=>{
    const handler=()=>{setNewRentalInitDress(null);setNewRentalOpen(true);};
    window.addEventListener('belori:new-rental',handler);
    return ()=>window.removeEventListener('belori:new-rental',handler);
  },[]);

  // Only gowns (bridal + quince)
  const allGowns=liveInventory.filter(d=>{
    const cat=(d.category||d.cat||'').toLowerCase();
    return cat.includes('bridal')||cat.includes('quince')||cat.includes('quinceañera')||cat==='bridal_gown'||cat==='quince_gown';
  }).map(d=>({...d,cat:d.category||d.cat||'bridal_gown'}));

  // Status counts
  const counts={available:0,reserved:0,rented:0,cleaning:0,overdue:0};
  allGowns.forEach(d=>{
    if(d.status==='available')counts.available++;
    else if(d.status==='reserved')counts.reserved++;
    else if(d.status==='rented'||d.status==='picked_up'){
      const due=d.returnDate||d.return_date;
      const isOverdue=due&&new Date(due)<new Date(new Date().toDateString());
      if(isOverdue||d.status==='overdue')counts.overdue++;
      else counts.rented++;
    }
    else if(d.status==='cleaning')counts.cleaning++;
    else if(d.status==='overdue')counts.overdue++;
  });
  const totalGowns=allGowns.length;
  const dueThisWeek=allGowns.filter(d=>{
    if(d.status!=='rented'&&d.status!=='picked_up')return false;
    const due=d.returnDate||d.return_date;
    if(!due)return false;
    const dueD=new Date(due);
    const now=new Date();
    const weekEnd=new Date(now);weekEnd.setDate(now.getDate()+7);
    return dueD>=now&&dueD<=weekEnd;
  }).length;

  // Catalog filtering
  const catalogDresses=allGowns.filter(d=>{
    const q=search.toLowerCase();
    const matchQ=!q||(d.name+' '+d.sku+' '+(d.color||'')+' '+(d.size||'')+' '+(d.client?.name||d.client||'')).toLowerCase().includes(q);
    const matchStatus=statusFilter==='all'||d.status===statusFilter||(statusFilter==='overdue'&&(d.status==='rented'||d.status==='picked_up')&&isOverdue(d));
    const matchCat=catFilter==='all'||(catFilter==='bridal'&&(d.cat||'').toLowerCase().includes('bridal'))||(catFilter==='quince'&&((d.cat||'').toLowerCase().includes('quince')));
    return matchQ&&matchStatus&&matchCat;
  });

  // Reset pagination when catalog filters change
  useEffect(()=>{setCatalogPage(1);},[search,statusFilter,catFilter]);
  const paginatedCatalog=catalogDresses.slice(0,catalogPage*CATALOG_PAGE_SIZE);

  function isOverdue(d){
    const due=d.returnDate||d.return_date;
    if(!due)return false;
    return new Date(due)<new Date(new Date().toDateString());
  }
  function daysLate(d){
    const due=d.returnDate||d.return_date;
    if(!due)return 0;
    const diff=Math.floor((new Date()-new Date(due))/(1000*60*60*24));
    return Math.max(0,diff);
  }
  function daysUntilReturn(d){
    const due=d.returnDate||d.return_date;
    if(!due)return 999;
    return Math.ceil((new Date(due)-new Date())/(1000*60*60*24));
  }

  // Similar dress finder
  const findSimilarDresses=(dress,allDresses)=>{
    if(!dress)return[];
    const sizes=['0','2','4','6','8','10','12','14','16','18','20','22','24'];
    return allDresses
      .filter(d=>{
        if(d.id===dress.id)return false;
        if(d.status!=='available')return false;
        const sameCategory=d.category===dress.category||(d.cat||'')===(dress.cat||'');
        const dressIdx=sizes.indexOf(String(dress.size||''));
        const candidateIdx=sizes.indexOf(String(d.size||''));
        const similarSize=dress.size===d.size||(dressIdx>=0&&candidateIdx>=0&&Math.abs(dressIdx-candidateIdx)<=2);
        let score=0;
        if(sameCategory)score+=3;
        if(d.size===dress.size)score+=2;
        else if(similarSize)score+=1;
        if(d.color===dress.color)score+=2;
        return sameCategory&&score>=3;
      })
      .sort((a,b)=>{
        const scoreOf=d=>{let s=0;if(d.color===dress.color)s+=2;if(d.size===dress.size)s+=2;return s;};
        return scoreOf(b)-scoreOf(a);
      })
      .slice(0,4);
  };

  // useMemo: find similar dresses whenever the selected dress changes (Task 3)
  const similarDresses = useMemo(() => {
    if (!detailDress || detailDress.status === 'available') return [];
    return findSimilarDresses(detailDress, allGowns);
  }, [detailDress, allGowns]);

  const handleDressSelect=(dress)=>{
    setDetailDress(dress);
    if(!['available'].includes(dress.status)){
      setShowSimilar(true);
      setSimilarForDress(dress.id);
    } else {
      setShowSimilar(false);
      setSimilarForDress(null);
    }
  };

  // Active rentals sections
  const rented=allGowns.filter(d=>d.status==='rented'||d.status==='picked_up');
  const overdueItems=rented.filter(d=>isOverdue(d)).sort((a,b)=>daysLate(b)-daysLate(a));
  const onTimeItems=rented.filter(d=>!isOverdue(d)).sort((a,b)=>daysUntilReturn(a)-daysUntilReturn(b));
  const cleaningItems=allGowns.filter(d=>d.status==='cleaning').sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const reservedItems=allGowns.filter(d=>d.status==='reserved').sort((a,b)=>{
    const aD=a.pickup_date||a.pickupDate||'';
    const bD=b.pickup_date||b.pickupDate||'';
    return aD.localeCompare(bD);
  });

  // Returns due sections
  const allDue=[...overdueItems,...onTimeItems];
  const dueToday=allDue.filter(d=>daysUntilReturn(d)===0&&!isOverdue(d));
  const dueThisWeekArr=allDue.filter(d=>{const days=daysUntilReturn(d);return days>0&&days<=7;});
  const dueLater=allDue.filter(d=>daysUntilReturn(d)>7);

  const gownFill=color=>GOWN_COLORS[color]||GOWN_COLORS.Ivory;

  const GownSilhouette=({color,size=48})=>(
    <svg viewBox="0 0 60 80" style={{width:size,height:size*1.33,opacity:0.6}}>
      <path d="M30 2c-4 0-10 3-10 10v8l-12 48h44L40 20V12C40 5 34 2 30 2Z" fill={gownFill(color)}/>
      <ellipse cx="30" cy="12" rx="8" ry="6" fill={gownFill(color)} opacity="0.7"/>
    </svg>
  );

  // ── Stat tap handler
  const tapStat=(stat)=>{
    if(stat==='overdue'){setTab('returns');return;}
    if(stat==='rented'){setTab('active');return;}
    if(stat==='reserved'){setTab('active');return;}
    setTab('catalog');setStatusFilter(stat);
  };

  // ── Action handlers
  const handleLogReturn=async(d,data)=>{
    const nowConfirmed=new Date().toISOString().slice(0,10);
    const prevStatus=d.status;
    await updateDress?.(d.id,{
      status:'cleaning',
      condition:data.condition||null,
      notes:data.notes||null,
      return_date_confirmed:nowConfirmed,
    });

    // Log audit entry for check-in
    if(boutique?.id){
      const clientName=d.client?.name||d.client||null;
      const activeEvent=events?.find(e=>e.client_id===d.client_id);
      await logInventoryAudit(supabase,{
        boutique_id:boutique.id,
        inventory_id:d.id,
        action:'checked_in',
        prev_status:prevStatus,
        new_status:'cleaning',
        user_name:boutique.name||'Staff',
        event_id:activeEvent?.id||null,
        client_name:clientName,
        notes:data.notes||null,
      });
    }

    // Fee handling
    if (data.damageFee > 0 || data.lateFee > 0) {
      const activeEvent = events?.find(e => e.client_id === d.client_id);
      const feeAmount = (data.damageFee || 0) + (data.lateFee || 0);
      let labels = [];
      if (data.lateFee > 0) labels.push('Late fee');
      if (data.damageFee > 0) labels.push('Damage fee');

      const payload = {
        label: `${labels.join(' & ')} - ${d.name}`,
        amount: feeAmount,
        due_date: nowConfirmed,
        status: data.payCollected ? 'paid' : 'pending',
        event_id: activeEvent?.id || null,
      };

      const { data: ms } = await createMilestone(payload);
      if (data.payCollected && ms?.id) {
        await markPaid(ms.id, { payment_method: data.payMethod, paid_date: nowConfirmed });
      }
    }

    toast('Return logged for #'+d.sku+' — now in cleaning');
    setReturnDress(null);
  };
  const handlePickup=async(d,data)=>{
    const prevStatus=d.status;
    await updateDress?.(d.id,{status:'picked_up',...data});

    // Log audit entry for checkout
    if(boutique?.id){
      const clientName=d.client?.name||d.client||null;
      const activeEvent=events?.find(e=>e.client_id===d.client_id);
      await logInventoryAudit(supabase,{
        boutique_id:boutique.id,
        inventory_id:d.id,
        action:'checked_out',
        prev_status:prevStatus,
        new_status:'picked_up',
        user_name:boutique.name||'Staff',
        event_id:activeEvent?.id||null,
        client_name:clientName,
        notes:null,
      });
    }

    toast('Dress #'+d.sku+' marked as picked up');
    setPickupDress(null);
  };
  const handleMarkCleaned=async(d)=>{
    await updateDress?.(d.id,{status:'available'});
    toast('Dress #'+d.sku+' is now available');
  };

  const handleReturnReminder=async(item)=>{
    const boutiqueName=boutique?.name||'Your boutique';
    const returnDate=item.return_date
      ?new Date(item.return_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})
      :'soon';
    const msg=`Hi! This is a reminder that your dress rental from ${boutiqueName} is due for return on ${returnDate}. Please contact us if you need to make arrangements. Thank you! 💕`;
    try{await navigator.clipboard.writeText(msg);}catch{}
    if(item.client_id&&boutique?.id){
      await supabase.from('client_interactions').insert({
        boutique_id:boutique.id,
        client_id:item.client_id,
        type:'sms',
        title:'Return reminder sent',
        body:msg,
        occurred_at:new Date().toISOString(),
        is_editable:false,
        author_name:'Staff',
      });
    }
    toast('Reminder copied to clipboard ✓');
  };

  const handleMarkAvailable=async(itemId)=>{
    await updateDress?.(itemId,{status:'available',last_cleaned:new Date().toISOString().slice(0,10)});
    toast('Marked as available ✓');
  };

  // ── Task 1: Charge late fee → insert payment_milestone
  const handleChargeLaterFee=async(item)=>{
    const dl=Math.max(1,Math.floor((Date.now()-new Date(item.return_date))/(86400000)));
    const feeAmount=dl*LATE_FEE_PER_DAY;
    setLateFeeConfirm({item,daysLate:dl,feeAmount});
  };
  const confirmChargeLaterFee=async()=>{
    if(!lateFeeConfirm)return;
    const {item,daysLate:dl,feeAmount}=lateFeeConfirm;
    const activeEvent=events?.find(e=>e.client_id===item.client_id);
    const {error}=await supabase.from('payment_milestones').insert({
      boutique_id:boutique.id,
      event_id:activeEvent?.id||null,
      label:`Late return fee (${dl} day${dl!==1?'s':''})`,
      amount:feeAmount,
      due_date:new Date().toISOString().split('T')[0],
      status:'pending',
    });
    if(error){toast('Failed to charge fee: '+error.message,'error');}
    else{toast(`Late fee of ${fmt(feeAmount)} charged`);}
    setLateFeeConfirm(null);
  };

  // ── Item Audit History Modal ─────────────────────────────────────────────
  const ITEM_ACTION_STYLE={
    checked_out: {bg:C.amberBg, col:C.amber,  label:'Checked out'},
    checked_in:  {bg:C.greenBg, col:C.green,  label:'Checked in' },
    status_change:{bg:C.blueBg, col:C.blue,   label:'Status change'},
    created:     {bg:'#CCFBF1', col:'#0F766E',label:'Created'    },
    updated:     {bg:C.grayBg,  col:C.gray,   label:'Updated'    },
    cleaned:     {bg:C.purpleBg,col:C.purple, label:'Cleaned'    },
    damaged:     {bg:C.redBg,   col:C.red,    label:'Damaged'    },
    reserved:    {bg:'#FEF9C3', col:'#A16207',label:'Reserved'   },
  };
  const ItemHistoryModal=({dress,onClose})=>{
    const {entries,loading}=useInventoryAudit(dress?.id);
    return(
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1010,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.white,borderRadius:16,width:520,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
          <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
            <div>
              <div style={{fontSize:15,fontWeight:600,color:C.ink}}>Audit history</div>
              <div style={{fontSize:11,color:C.gray,marginTop:2}}>{dress.name} · #{dress.sku}</div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.gray,cursor:'pointer'}}>×</button>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'4px 0',boxShadow:'inset 0 -8px 8px -8px rgba(0,0,0,0.15)'}}>
            {loading&&<div style={{textAlign:'center',padding:32,color:C.gray,fontSize:12}}>Loading…</div>}
            {!loading&&entries.length===0&&(
              <div style={{textAlign:'center',padding:40,color:C.gray}}>
                <div style={{fontSize:28,marginBottom:8}}>📋</div>
                <div style={{fontSize:13,color:C.ink,fontWeight:500}}>No history yet</div>
                <div style={{fontSize:11,marginTop:4}}>Audit entries are created when the dress is checked out, returned, or updated.</div>
              </div>
            )}
            {!loading&&entries.map((e,idx)=>{
              const as=ITEM_ACTION_STYLE[e.action]||{bg:C.grayBg,col:C.gray,label:e.action};
              const ts=e.created_at?new Date(e.created_at).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'';
              return(
                <div key={e.id} style={{display:'flex',gap:12,padding:'12px 20px',borderBottom:idx<entries.length-1?`1px solid ${C.border}`:'none',alignItems:'flex-start'}}>
                  <span style={{padding:'3px 9px',borderRadius:999,fontSize:10,fontWeight:600,background:as.bg,color:as.col,flexShrink:0,marginTop:1,whiteSpace:'nowrap'}}>{as.label}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:11,color:C.ink,marginBottom:e.notes?4:0}}>
                      {(e.prev_status||e.new_status)&&(
                        <span>
                          {e.prev_status&&<span style={{color:C.gray,textTransform:'capitalize'}}>{e.prev_status.replace(/_/g,' ')}</span>}
                          {e.prev_status&&e.new_status&&<span style={{color:C.gray}}> → </span>}
                          {e.new_status&&<span style={{fontWeight:500,textTransform:'capitalize'}}>{e.new_status.replace(/_/g,' ')}</span>}
                        </span>
                      )}
                      {e.client_name&&<span style={{color:C.gray}}>· {e.client_name}</span>}
                    </div>
                    {e.notes&&<div style={{fontSize:11,color:C.gray,lineHeight:1.4}}>{e.notes}</div>}
                    <div style={{fontSize:10,color:C.inkLight,marginTop:3,display:'flex',gap:8}}>
                      <span>{ts}</span>
                      {e.user_name&&<span>by {e.user_name}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,flexShrink:0}}>
            <button onClick={onClose} style={{width:'100%',padding:'8px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:12}}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Catalog Dress Card
  const DressCard=({d})=>{
    const over=isOverdue(d);
    const late=daysLate(d);
    const SC={available:{bg:'var(--bg-success)',col:'var(--color-success)',label:'Available'},reserved:{bg:'var(--bg-warning)',col:'var(--color-warning)',label:'Reserved'},rented:{bg:'var(--bg-info)',col:'var(--color-info)',label:'Rented'},picked_up:{bg:'var(--bg-info)',col:'var(--color-info)',label:'Rented'},cleaning:{bg:'var(--bg-primary)',col:'var(--color-primary)',label:'Cleaning'},overdue:{bg:'var(--bg-danger)',col:'var(--color-danger)',label:'Overdue'},returned:{bg:'var(--bg-primary)',col:'var(--color-primary)',label:'Returned'}};
    const s=over?{bg:'var(--bg-danger)',col:'var(--color-danger)',label:`${late}d overdue`}:(SC[d.status]||{bg:C.grayBg,col:C.gray,label:d.status});
    const clientName=d.client?.name||d.client||'';
    const dueLabel=d.returnDate||d.return_date||'';

    // Status-dependent line
    let statusLine=null;
    if(d.status==='available')statusLine=d.lastCleaned?<span style={{color:C.gray}}>Last cleaned {d.lastCleaned}</span>:null;
    else if(d.status==='reserved')statusLine=<span style={{color:C.amber,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>{d.is_walk_in&&<span style={{background:'#F3E8FF',color:'#7C3AED',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:3}}>Walk-in</span>}Reserved: {clientName}{dueLabel?` · Pickup ${dueLabel}`:''}</span>;
    else if(over)statusLine=<span style={{color:C.red,fontWeight:600}}>⚠ {clientName} · Due {dueLabel} · {late} day{late!==1?'s':''} late</span>;
    else if(d.status==='rented'||d.status==='picked_up')statusLine=<span style={{color:'#DC6B7A'}}>Rented to {clientName}{dueLabel?` · Returns ${dueLabel}`:''}</span>;
    else if(d.status==='cleaning')statusLine=<span style={{color:C.blue}}>At cleaner</span>;

    // Action button
    let actionBtn=null;
    if(d.status==='available')actionBtn=<button onClick={e=>{e.stopPropagation();setNewRentalInitDress(d);setNewRentalOpen(true);}} style={{width:'100%',padding:'8px',borderRadius:7,border:`1px solid ${C.rosa}`,background:'transparent',color:C.rosa,fontSize:11,fontWeight:500,cursor:'pointer'}}>Reserve for event</button>;
    else if(d.status==='reserved')actionBtn=<button onClick={e=>{e.stopPropagation();setPickupDress(d);}} style={{width:'100%',padding:'8px',borderRadius:7,border:`1px solid var(--color-primary)`,background:'transparent',color:'var(--color-primary)',fontSize:11,fontWeight:500,cursor:'pointer'}}>Mark picked up</button>;
    else if(over)actionBtn=<button onClick={e=>{e.stopPropagation();setReturnDress(d);}} style={{width:'100%',padding:'8px',borderRadius:7,border:`1px solid var(--color-danger)`,background:'transparent',color:'var(--color-danger)',fontSize:11,fontWeight:600,cursor:'pointer'}}>Log return — OVERDUE</button>;
    else if(d.status==='rented'||d.status==='picked_up')actionBtn=<button onClick={e=>{e.stopPropagation();setReturnDress(d);}} style={{width:'100%',padding:'8px',borderRadius:7,border:`1px solid var(--color-success)`,background:'transparent',color:'var(--color-success)',fontSize:11,fontWeight:500,cursor:'pointer'}}>Log return</button>;
    else if(d.status==='cleaning')actionBtn=<button onClick={e=>{e.stopPropagation();handleMarkCleaned(d);}} style={{width:'100%',padding:'8px',borderRadius:7,border:`1px solid var(--color-primary)`,background:'transparent',color:'var(--color-primary)',fontSize:11,fontWeight:500,cursor:'pointer'}}>Mark cleaned</button>;

    return(
      <div onClick={()=>handleDressSelect(d)} style={{background:C.white,border:`1px solid ${over?'#FCA5A5':C.border}`,borderRadius:12,overflow:'hidden',cursor:'pointer',transition:'border-color 0.15s'}} onMouseEnter={e=>{if(!over)e.currentTarget.style.borderColor=C.rosa;}} onMouseLeave={e=>e.currentTarget.style.borderColor=over?'#FCA5A5':C.border}>
        <div style={{height:110,background:C.ivory,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
          {d.image_url
            ?<img src={d.image_url} alt={d.name} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
            :<GownSilhouette color={d.color} size={48}/>}
          <div style={{position:'absolute',top:8,left:8}}><Badge text={'#'+d.sku} bg="rgba(0,0,0,0.55)" color="#fff"/></div>
          <div style={{position:'absolute',top:8,right:8}}><Badge text={s.label} bg={s.bg} color={s.col}/></div>
        </div>
        <div style={{padding:'10px 12px'}}>
          <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:2}}>{d.name}</div>
          <div style={{fontSize:10,color:C.gray,marginBottom:6}}>{[d.color,d.size?`Size ${d.size}`:'',d.cat?.includes('quince')?'Quinceañera':'Bridal'].filter(Boolean).join(' · ')}</div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
            <span style={{fontWeight:500,color:C.ink}}>{fmt(d.price||0)}<span style={{color:C.gray,fontWeight:400}}>/rental</span></span>
            {d.deposit>0&&<span style={{color:C.gray,fontSize:11}}>Dep: {fmt(d.deposit)}</span>}
          </div>
          {statusLine&&<div style={{fontSize:11,marginBottom:6,lineHeight:1.4}}>{statusLine}</div>}
          {(d.status==='rented'||d.status==='picked_up')?(
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {actionBtn}
              <button onClick={e=>{e.stopPropagation();setDamageAssessDress(d);}} style={{width:'100%',padding:'6px',borderRadius:7,border:`1px solid ${C.red}`,background:C.redBg,color:C.red,fontSize:10,fontWeight:600,cursor:'pointer'}}>
                Assess damage
              </button>
            </div>
          ):(actionBtn||<div style={{height:32}}/>)}
        </div>
      </div>
    );
  };

  // ── Catalog List Row (for list view)
  const DressListRow=({d})=>{
    const over=isOverdue(d);
    const SC={available:{bg:'var(--bg-success)',col:'var(--color-success)',label:'Available'},reserved:{bg:'var(--bg-warning)',col:'var(--color-warning)',label:'Reserved'},rented:{bg:'var(--bg-info)',col:'var(--color-info)',label:'Rented'},picked_up:{bg:'var(--bg-info)',col:'var(--color-info)',label:'Rented'},cleaning:{bg:'var(--bg-primary)',col:'var(--color-primary)',label:'Cleaning'},overdue:{bg:'var(--bg-danger)',col:'var(--color-danger)',label:'Overdue'},returned:{bg:'var(--bg-primary)',col:'var(--color-primary)',label:'Returned'}};
    const late=daysLate(d);
    const s=over?{bg:'var(--bg-danger)',col:'var(--color-danger)',label:`${late}d overdue`}:(SC[d.status]||{bg:C.grayBg,col:C.gray,label:d.status});
    const clientName=d.client?.name||d.client||'';
    const dueLabel=d.returnDate||d.return_date||'';

    let actionBtn=null;
    if(d.status==='available')actionBtn=<button onClick={e=>{e.stopPropagation();setNewRentalInitDress(d);setNewRentalOpen(true);}} style={{padding:'5px 12px',borderRadius:7,border:`1px solid ${C.rosa}`,background:'transparent',color:C.rosa,fontSize:11,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>Reserve</button>;
    else if(d.status==='reserved')actionBtn=<button onClick={e=>{e.stopPropagation();setPickupDress(d);}} style={{padding:'5px 12px',borderRadius:7,border:`1px solid var(--color-primary)`,background:'transparent',color:'var(--color-primary)',fontSize:11,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>Mark picked up</button>;
    else if(over)actionBtn=<button onClick={e=>{e.stopPropagation();setReturnDress(d);}} style={{padding:'5px 12px',borderRadius:7,border:`1px solid var(--color-danger)`,background:'transparent',color:'var(--color-danger)',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>Log return</button>;
    else if(d.status==='rented'||d.status==='picked_up')actionBtn=<button onClick={e=>{e.stopPropagation();setReturnDress(d);}} style={{padding:'5px 12px',borderRadius:7,border:`1px solid var(--color-success)`,background:'transparent',color:'var(--color-success)',fontSize:11,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>Log return</button>;
    else if(d.status==='cleaning')actionBtn=<button onClick={e=>{e.stopPropagation();handleMarkCleaned(d);}} style={{padding:'5px 12px',borderRadius:7,border:`1px solid var(--color-primary)`,background:'transparent',color:'var(--color-primary)',fontSize:11,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>Mark cleaned</button>;

    return(
      <div onClick={()=>handleDressSelect(d)}
        style={{display:'grid',gridTemplateColumns:'52px 1fr 1fr 100px 80px 100px auto',gap:12,alignItems:'center',padding:'10px 16px',background:C.white,borderBottom:`1px solid ${over?'#FCA5A5':C.border}`,cursor:'pointer',transition:'background 0.1s'}}
        onMouseEnter={e=>e.currentTarget.style.background=C.ivory}
        onMouseLeave={e=>e.currentTarget.style.background=C.white}>
        {/* Thumbnail */}
        <div style={{width:48,height:56,borderRadius:6,overflow:'hidden',background:C.ivory,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          {d.image_url
            ?<img src={d.image_url} alt={d.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            :<GownSilhouette color={d.color} size={24}/>}
        </div>
        {/* Name + SKU */}
        <div style={{minWidth:0}}>
          <div style={{fontSize:13,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</div>
          <div style={{fontSize:11,color:C.gray,fontFamily:'monospace'}}>#{d.sku}</div>
        </div>
        {/* Color / size / type */}
        <div style={{fontSize:12,color:C.gray}}>
          {[d.color,d.size?`Sz ${d.size}`:'',d.cat?.includes('quince')?'Quinceañera':'Bridal'].filter(Boolean).join(' · ')}
        </div>
        {/* Status badge */}
        <div>
          <span style={{padding:'3px 8px',borderRadius:999,fontSize:11,fontWeight:600,background:s.bg,color:s.col,whiteSpace:'nowrap'}}>{s.label}</span>
        </div>
        {/* Pricing */}
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:13,fontWeight:600,color:C.ink}}>${(d.price||0).toFixed(0)}</div>
          {d.deposit>0&&<div style={{fontSize:10,color:C.gray}}>dep ${d.deposit}</div>}
        </div>
        {/* Client/due */}
        <div style={{fontSize:11,color:over?'var(--color-danger)':C.gray,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {clientName&&<div style={{fontWeight:500}}>{clientName}</div>}
          {dueLabel&&<div>{over?`${late}d overdue`:`Due ${dueLabel}`}</div>}
        </div>
        {/* Action */}
        <div onClick={e=>e.stopPropagation()} style={{display:'flex',gap:4,alignItems:'center'}}>
          {actionBtn}
          {(d.status==='rented'||d.status==='picked_up')&&(
            <button onClick={e=>{e.stopPropagation();setDamageAssessDress(d);}} style={{padding:'5px 8px',borderRadius:7,border:`1px solid ${C.red}`,background:C.redBg,color:C.red,fontSize:10,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}} title="Assess damage">Damage</button>
          )}
        </div>
      </div>
    );
  };

  // ── Active Rentals Row
  const RentalRow=({d,section})=>{
    const over=isOverdue(d);
    const late=daysLate(d);
    const daysLeft=daysUntilReturn(d);
    const clientName=d.client?.name||d.client||'';
    const clientPhone=d.client?.phone||'';
    const dueLabel=d.returnDate||d.return_date||'';

    // Progress bar for on-time rentals
    const pickupD=d.pickup_date||d.pickedUpAt;
    let progress=0;
    if(pickupD&&dueLabel){
      const total=Math.max(1,(new Date(dueLabel)-new Date(pickupD))/(1000*60*60*24));
      const elapsed=(new Date()-new Date(pickupD))/(1000*60*60*24);
      progress=Math.min(100,Math.round((elapsed/total)*100));
    }
    const barColor=over?'var(--color-danger)':daysLeft<=2?'var(--color-warning)':'var(--color-success)';

    return(
      <div onClick={()=>setDetailDress(d)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',minHeight:72,background:over?'#FFF8F8':C.white,borderBottom:`1px solid ${over?'#FCA5A5':C.border}`,cursor:'pointer',transition:'background 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background=over?'#FFF0F0':C.ivory} onMouseLeave={e=>e.currentTarget.style.background=over?'#FFF8F8':C.white}>
        {/* Gown mini */}
        <div style={{width:40,height:50,background:C.ivory,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <GownSilhouette color={d.color} size={24}/>
        </div>
        {/* Info */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{d.name} <span style={{fontSize:11,color:C.gray,fontFamily:'monospace'}}>#{d.sku}</span></div>
          <div style={{fontSize:12,color:over?'var(--color-danger)':C.gray,marginTop:2}}>
            {clientName}{clientPhone?` · ${clientPhone}`:''}
            {section==='overdue'&&<span style={{fontWeight:600}}> · {late} day{late!==1?'s':''} late</span>}
          </div>
        </div>
        {/* Progress / countdown */}
        {section==='rented'&&(
          <div style={{width:100,flexShrink:0}}>
            <div style={{height:4,background:C.grayBg,borderRadius:999,overflow:'hidden',marginBottom:4}}>
              <div style={{height:'100%',width:`${progress}%`,background:barColor,borderRadius:999,transition:'width 0.3s'}}/>
            </div>
            <div style={{fontSize:10,color:barColor,textAlign:'center',fontWeight:500}}>{daysLeft<=0?'Due today':`${daysLeft}d left`}</div>
          </div>
        )}
        {section==='overdue'&&(
          <div style={{background:'var(--bg-danger)',borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:600,color:'var(--color-danger)',flexShrink:0}}>
            {late}d late · {fmt(Math.min(late*LATE_FEE_PER_DAY,750))} fee
          </div>
        )}
        {section==='reserved'&&(
          <div style={{fontSize:11,color:C.amber,fontWeight:500,flexShrink:0}}>
            Pickup {d.pickup_date||d.pickupDate||'TBD'}
          </div>
        )}
        {dueLabel&&section!=='reserved'&&(
          <div style={{fontSize:11,color:C.gray,flexShrink:0,minWidth:70,textAlign:'right'}}>Due {dueLabel}</div>
        )}
        {/* Actions */}
        <div style={{display:'flex',gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
          {(section==='overdue'||section==='rented')&&(
            <button onClick={()=>setReturnDress(d)} style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${over?'var(--color-danger)':'var(--color-success)'}`,background:'transparent',color:over?'var(--color-danger)':'var(--color-success)',fontSize:11,fontWeight:500,cursor:'pointer'}}>Log return</button>
          )}
          {(section==='overdue'||section==='rented')&&(
            <button onClick={()=>handleReturnReminder(d)} style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:11,cursor:'pointer'}} title="Copy SMS reminder to clipboard">📨 Remind</button>
          )}
          {(section==='overdue'||section==='rented')&&(
            <button onClick={()=>setDamageAssessDress(d)} style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${C.red}`,background:C.redBg,color:C.red,fontSize:11,fontWeight:600,cursor:'pointer'}}>⚠ Damage</button>
          )}
          {section==='overdue'&&(
            <button onClick={()=>handleChargeLaterFee(d)} style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${C.amber}`,background:C.amberBg,color:C.amber,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>💰 Charge late fee</button>
          )}
          {section==='overdue'&&clientPhone&&(
            <button onClick={()=>{if(/Mobi|Android/i.test(navigator.userAgent))window.location.href=`tel:${clientPhone}`;else{navigator.clipboard.writeText(clientPhone);toast('Phone copied: '+clientPhone);}}} style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:11,cursor:'pointer'}}>📞 Call</button>
          )}
          {section==='reserved'&&(
            <button onClick={()=>setPickupDress(d)} style={{padding:'6px 12px',borderRadius:6,border:`1px solid var(--color-primary)`,background:'transparent',color:'var(--color-primary)',fontSize:11,fontWeight:500,cursor:'pointer'}}>Mark picked up</button>
          )}
          <button onClick={()=>setHistoryDress(d)} title="View audit history" style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:11,cursor:'pointer'}}>📋 History</button>
        </div>
      </div>
    );
  };

  // ── Returns Due Row
  const ReturnRow=({d,urgency})=>{
    const over=urgency==='overdue';
    const today=urgency==='today';
    const late=daysLate(d);
    const daysLeft=daysUntilReturn(d);
    const clientName=d.client?.name||d.client||'';
    const clientPhone=d.client?.phone||'';
    const dueLabel=d.returnDate||d.return_date||'';
    const bg=over?'#FFF8F8':today?'#FFFBEB':C.white;
    const borderCol=over?'#FCA5A5':today?'#FDE68A':C.border;

    return(
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',minHeight:64,background:bg,borderBottom:`1px solid ${borderCol}`}}>
        <div style={{width:36,height:44,background:C.ivory,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <GownSilhouette color={d.color} size={20}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{d.name} <span style={{color:C.gray,fontFamily:'monospace',fontSize:11}}>#{d.sku}</span></div>
          <div style={{fontSize:12,color:over?C.red:C.gray,marginTop:2}}>
            {clientName}{clientPhone&&<span> · <a href={`tel:${clientPhone}`} style={{color:'inherit'}}>{clientPhone}</a></span>}
          </div>
        </div>
        <div style={{textAlign:'right',flexShrink:0,minWidth:80}}>
          <div style={{fontSize:12,fontWeight:over?700:500,color:over?'var(--color-danger)':today?'var(--color-warning)':C.gray}}>
            {over?`${late}d overdue`:today?'Due today':`${daysLeft}d left`}
          </div>
          <div style={{fontSize:11,color:C.gray}}>Due {dueLabel}</div>
          {over&&<div style={{fontSize:10,color:'var(--color-danger)',marginTop:2}}>Fee: {fmt(Math.min(late*LATE_FEE_PER_DAY,750))}</div>}
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <button onClick={()=>setReturnDress(d)} style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${over?'var(--color-danger)':'var(--color-success)'}`,background:'transparent',color:over?'var(--color-danger)':'var(--color-success)',fontSize:11,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>✅ Return clean</button>
          <button onClick={e=>{e.stopPropagation();setDamageAssessDress(d);}} style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${C.red}`,background:C.redBg,color:C.red,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>⚠ Damage</button>
          {over&&(
            <button onClick={()=>handleChargeLaterFee(d)} style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${C.amber}`,background:C.amberBg,color:C.amber,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>💰 Charge fee</button>
          )}
          {over&&clientPhone&&(
            <button onClick={()=>{if(/Mobi|Android/i.test(navigator.userAgent))window.location.href=`tel:${clientPhone}`;else{navigator.clipboard.writeText(clientPhone);toast('Phone copied');}}} style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:11,cursor:'pointer'}}>📞</button>
          )}
          {(today||urgency==='week')&&(
            <button onClick={()=>toast('Reminder sent to '+clientName)} style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:11,cursor:'pointer'}}>Send reminder</button>
          )}
        </div>
      </div>
    );
  };

  // ── Modals extracted ─────────────────────────────────

  // ── QR Scan Modal
  const QRScanModal=({onClose})=>{
    const [manualSku,setManualSku]=useState('');
    const found=manualSku?allGowns.find(d=>d.sku.toLowerCase()===manualSku.toLowerCase()):null;
    return(
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.white,borderRadius:16,width:400,padding:0,boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>
          <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:16,fontWeight:600,color:C.ink}}>Scan QR / Enter SKU</div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.gray,cursor:'pointer'}}>×</button>
          </div>
          <div style={{padding:24,textAlign:'center'}}>
            <div style={{width:120,height:120,margin:'0 auto 16px',background:C.ivory,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:48}}>📷</div>
            <div style={{fontSize:13,color:C.gray,marginBottom:16}}>Point camera at dress label</div>
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
              <div style={{fontSize:11,color:C.gray,marginBottom:8}}>Or enter SKU manually</div>
              <input value={manualSku} onChange={e=>setManualSku(e.target.value.toUpperCase())} placeholder="BB-047" style={{...inputSt,textAlign:'center',fontFamily:'monospace',fontSize:16,letterSpacing:'0.1em'}}/>
              {found&&(
                <div style={{marginTop:12,background:C.ivory,borderRadius:10,padding:12,textAlign:'left'}}>
                  <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{found.name}</div>
                  <div style={{fontSize:11,color:C.gray}}>{found.color} · Size {found.size} · {found.status}</div>
                  <button onClick={()=>{setDetailDress(found);onClose();}} style={{marginTop:8,padding:'6px 16px',borderRadius:6,border:`1px solid ${C.rosa}`,background:C.rosa,color:C.white,fontSize:12,cursor:'pointer'}}>View dress →</button>
                </div>
              )}
              {manualSku.length>=3&&!found&&<div style={{fontSize:12,color:'var(--color-danger)',marginTop:8}}>No dress found with SKU "{manualSku}"</div>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── New Rental 4-Step Modal
  const NewRentalModal4Step=({initialDress,onClose,onSuccess})=>{
    const [step,setStep]=useState(initialDress?2:1);
    const [selDress,setSelDress]=useState(initialDress||null);
    const [s1Query,setS1Query]=useState('');
    const [s1Cat,setS1Cat]=useState('all');
    const [linkMode,setLinkMode]=useState('event');
    const [s2Query,setS2Query]=useState('');
    const [selEvent,setSelEvent]=useState(null);
    const [wiName,setWiName]=useState('');
    const [wiPhone,setWiPhone]=useState('');
    const [wiPurpose,setWiPurpose]=useState('');
    const [pickupDate,setPickupDate]=useState('');
    const [returnDate,setReturnDate]=useState('');
    const [fee,setFee]=useState(String(initialDress?.price||0));
    const [dep,setDep]=useState(String(initialDress?.deposit||0));
    const [notes,setNotes]=useState('');
    const [saving,setSaving]=useState(false);
    const [err,setErr]=useState('');
    const availDresses=allGowns.filter(d=>{
      if(d.status!=='available')return false;
      const q=s1Query.toLowerCase();
      const matchQ=!q||(d.name+' '+d.sku+' '+(d.color||'')+(d.size?` sz${d.size}`:'')).toLowerCase().includes(q);
      const matchCat=s1Cat==='all'||(s1Cat==='bridal'&&(d.cat||'').toLowerCase().includes('bridal'))||(s1Cat==='quince'&&(d.cat||'').toLowerCase().includes('quince'));
      return matchQ&&matchCat;
    });
    const pickDress=d=>{setSelDress(d);setFee(String(d.price||0));setDep(String(d.deposit||0));setStep(2);};
    const autoFillDates=evDate=>{
      if(!evDate)return;
      const d=new Date(evDate+'T12:00:00');
      const pick=new Date(d);pick.setDate(d.getDate()-1);
      const ret=new Date(d);ret.setDate(d.getDate()+2);
      setPickupDate(pick.toISOString().split('T')[0]);
      setReturnDate(ret.toISOString().split('T')[0]);
    };
    const upcoming=(events||[]).filter(e=>e.status!=='cancelled');
    const filtEvs=s2Query?upcoming.filter(e=>(e.client||'').toLowerCase().includes(s2Query.toLowerCase())):upcoming.slice(0,8);
    const clientLabel=selEvent?.client||(linkMode==='walkin'?wiName:'Walk-in');
    const rentalDays=pickupDate&&returnDate?Math.max(1,Math.ceil((new Date(returnDate)-new Date(pickupDate))/(1000*60*60*24))):null;
    const confirm=async()=>{
      if(!pickupDate||!returnDate)return setErr('Pickup and return dates are required');
      if(linkMode==='walkin'&&!wiName.trim())return setErr('Client name is required for walk-in rentals');
      setSaving(true);setErr('');
      const retLabel=returnDate?new Date(returnDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
      // Fire success immediately (optimistic) — updateDress runs in background
      // This prevents the inventory refetch from unmounting this modal mid-flight
      onSuccess({dress:selDress,client:clientLabel,pickupDate,returnDate:retLabel,fee:Number(fee),deposit:Number(dep),event:selEvent?.type||'',eventDate:selEvent?.event_date||'',event_id:selEvent?.id||null,client_id:selEvent?.client_id||null});
      updateDress?.(selDress.id,{
        status:'reserved',
        client_id:selEvent?.client_id||null,
        pickup_date:pickupDate,
        return_date:returnDate,
      });
    };
    const STEPS=['Select dress','Link to event','Pricing','Confirm'];
    return(
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.white,borderRadius:16,width:540,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
          {/* Header + progress */}
          <div style={{padding:'18px 24px 12px',borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontSize:16,fontWeight:600,color:C.ink}}>New rental</div>
              <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.gray,cursor:'pointer'}}>×</button>
            </div>
            <div style={{display:'flex',alignItems:'center'}}>
              {STEPS.map((s,i)=>(
                <React.Fragment key={s}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,flexShrink:0}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:step>i+1||step===i+1?C.rosa:'#E5E7EB'}}/>
                    <div style={{fontSize:9,color:step===i+1?C.rosa:C.gray,fontWeight:step===i+1?600:400,whiteSpace:'nowrap'}}>{s}</div>
                  </div>
                  {i<STEPS.length-1&&<div style={{flex:1,height:1,background:step>i+1?C.rosa:'#E5E7EB',margin:'0 4px',marginBottom:12}}/>}
                </React.Fragment>
              ))}
            </div>
          </div>
          {/* Step 1 — Select dress */}
          {step===1&&(<>
            <div style={{flex:1,overflowY:'auto',padding:'14px 24px',boxShadow:'inset 0 -8px 8px -8px rgba(0,0,0,0.15)'}}>
              <div style={{display:'flex',gap:6,marginBottom:10}}>
                <input value={s1Query} onChange={e=>setS1Query(e.target.value)} placeholder="Search name, color, size…" autoFocus style={{...inputSt,flex:1,margin:0}}/>
                <select value={s1Cat} onChange={e=>setS1Cat(e.target.value)} style={{...inputSt,margin:0,width:'auto'}}>
                  <option value="all">All</option><option value="bridal">Bridal</option><option value="quince">Quinceañera</option>
                </select>
              </div>
              {availDresses.length===0
                ?<div style={{textAlign:'center',padding:40,color:C.gray,fontSize:13}}>No available dresses{s1Query?' matching your search':''}</div>
                :<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {availDresses.map(d=>(
                    <div key={d.id} onClick={()=>setSelDress(selDress?.id===d.id?null:d)} style={{border:`2px solid ${selDress?.id===d.id?C.rosa:C.border}`,borderRadius:10,overflow:'hidden',cursor:'pointer',background:selDress?.id===d.id?C.rosaPale:C.white,transition:'all 0.15s'}}>
                      <div style={{height:80,background:C.ivory,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                        <GownSilhouette color={d.color} size={34}/>
                        <div style={{position:'absolute',top:5,left:5,fontSize:9,fontFamily:'monospace',background:'rgba(0,0,0,0.08)',padding:'2px 5px',borderRadius:3,color:C.ink}}>#{d.sku}</div>
                      </div>
                      <div style={{padding:'8px 10px'}}>
                        <div style={{fontSize:11,fontWeight:500,color:C.ink,marginBottom:1}}>{d.name}</div>
                        <div style={{fontSize:9,color:C.gray}}>{d.color}{d.size?` · Sz ${d.size}`:''}</div>
                        <div style={{fontSize:12,fontWeight:600,color:selDress?.id===d.id?C.rosa:C.ink,marginTop:4}}>{fmt(d.price||0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              }
              {err&&<div style={{marginTop:10,fontSize:12,color:'var(--color-danger)'}}>{err}</div>}
            </div>
            <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>
              <PrimaryBtn label="Next →" onClick={()=>{if(!selDress)return setErr('Please select a dress');setErr('');pickDress(selDress);}}/>
            </div>
          </>)}
          {/* Step 2 — Link to event */}
          {step===2&&(<>
            <div style={{flex:1,overflowY:'auto',padding:'14px 24px',boxShadow:'inset 0 -8px 8px -8px rgba(0,0,0,0.15)'}}>
              {selDress&&<div style={{background:C.ivory,borderRadius:8,padding:'8px 12px',display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <GownSilhouette color={selDress.color} size={20}/>
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:500,color:C.ink}}>{selDress.name}</div><div style={{fontSize:10,color:C.gray}}>#{selDress.sku} · {selDress.color} · Sz {selDress.size}</div></div>
                {!initialDress&&<button onClick={()=>setStep(1)} style={{fontSize:11,color:C.rosa,background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Change</button>}
              </div>}
              <div style={{display:'flex',gap:6,marginBottom:14}}>
                {[['event','Link to event'],['walkin','Walk-in rental']].map(([id,l])=>(
                  <button key={id} onClick={()=>setLinkMode(id)} style={{flex:1,padding:'8px',borderRadius:8,border:`1.5px solid ${linkMode===id?C.rosa:C.border}`,background:linkMode===id?C.rosaPale:'transparent',color:linkMode===id?C.rosa:C.gray,cursor:'pointer',fontSize:12,fontWeight:linkMode===id?500:400}}>{l}</button>
                ))}
              </div>
              {linkMode==='event'?(
                <div style={{marginBottom:14}}>
                  <input value={s2Query} onChange={e=>setS2Query(e.target.value)} placeholder="Search client or event…" style={{...inputSt,marginBottom:8}}/>
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {filtEvs.map(ev=>{const t=EVT_TYPES[ev.type]||{bg:C.grayBg,col:C.gray,icon:'📅'};return(
                      <button key={ev.id} onClick={()=>{setSelEvent(selEvent?.id===ev.id?null:ev);autoFillDates(ev.event_date||ev.eventDate);}} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,border:`1.5px solid ${selEvent?.id===ev.id?C.rosa:C.border}`,background:selEvent?.id===ev.id?C.rosaPale:C.white,cursor:'pointer',textAlign:'left'}}>
                        <div style={{width:26,height:26,borderRadius:6,background:t.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{t.icon}</div>
                        <div><div style={{fontSize:12,fontWeight:500,color:selEvent?.id===ev.id?C.rosa:C.ink}}>{ev.client||'(no client)'}</div><div style={{fontSize:10,color:C.gray}}>{EVT_TYPES[ev.type]?.label||ev.type} · {ev.event_date||ev.date}</div></div>
                      </button>
                    );})}
                    {filtEvs.length===0&&s2Query&&<div style={{fontSize:12,color:C.gray,padding:'8px 0',textAlign:'center'}}>No events found for "{s2Query}"</div>}
                  </div>
                </div>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
                  <div><div style={LBL}>Client name *</div><input value={wiName} onChange={e=>setWiName(e.target.value)} placeholder="Full name" style={inputSt}/></div>
                  <div><div style={LBL}>Phone</div><input value={wiPhone} onChange={e=>setWiPhone(e.target.value)} placeholder="+1 555 000-0000" style={inputSt}/></div>
                  <div><div style={{...LBL,marginBottom:6}}>Purpose</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {['Prom','Photo shoot','Party','Themed event','Other'].map(p=>(
                        <button key={p} onClick={()=>setWiPurpose(wiPurpose===p?'':p)} style={{padding:'4px 10px',borderRadius:999,border:`1px solid ${wiPurpose===p?C.rosa:C.border}`,background:wiPurpose===p?C.rosaPale:'transparent',color:wiPurpose===p?C.rosa:C.gray,cursor:'pointer',fontSize:11}}>{p}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div><div style={LBL}>Pickup date *</div><input type="date" value={pickupDate} onChange={e=>{
                  const val=e.target.value;
                  setPickupDate(val);
                  if(val){const d=new Date(val+'T12:00:00');d.setDate(d.getDate()+3);setReturnDate(d.toISOString().split('T')[0]);}
                }} style={inputSt}/></div>
                <div><div style={LBL}>Return due *</div><input type="date" value={returnDate} onChange={e=>setReturnDate(e.target.value)} style={inputSt}/></div>
              </div>
              {rentalDays&&<div style={{fontSize:11,color:C.gray,marginTop:4}}>{rentalDays} day rental period</div>}
              {err&&<div style={{marginTop:8,fontSize:12,color:'var(--color-danger)'}}>{err}</div>}
            </div>
            <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              {!initialDress?<GhostBtn label="← Back" onClick={()=>setStep(1)}/>:<GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>}
              <PrimaryBtn label="Next →" onClick={()=>{
                if(!pickupDate||!returnDate)return setErr('Pickup and return dates required');
                if(linkMode==='walkin'&&!wiName.trim())return setErr('Client name required for walk-in');
                setErr('');setStep(3);
              }}/>
            </div>
          </>)}
          {/* Step 3 — Pricing */}
          {step===3&&(<>
            <div style={{flex:1,overflowY:'auto',padding:'14px 24px',display:'flex',flexDirection:'column',gap:12,boxShadow:'inset 0 -8px 8px -8px rgba(0,0,0,0.15)'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div style={{background:C.ivory,borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:9,fontWeight:700,color:C.gray,letterSpacing:'0.06em',marginBottom:4}}>DRESS</div>
                  <div style={{fontSize:12,fontWeight:500,color:C.ink}}>{selDress?.name}</div>
                  <div style={{fontSize:10,color:C.gray}}>#{selDress?.sku} · Sz {selDress?.size}</div>
                </div>
                <div style={{background:C.ivory,borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:9,fontWeight:700,color:C.gray,letterSpacing:'0.06em',marginBottom:4}}>{linkMode==='walkin'?'WALK-IN':'CLIENT'}</div>
                  <div style={{fontSize:12,fontWeight:500,color:C.ink}}>{clientLabel||'—'}</div>
                  {selEvent&&<div style={{fontSize:10,color:C.gray}}>{EVT_TYPES[selEvent.type]?.label} · {selEvent.event_date||selEvent.date}</div>}
                  {linkMode==='walkin'&&<span style={{background:'#F3E8FF',color:'#7C3AED',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:3}}>Walk-in</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:16,fontSize:11,color:C.gray}}>
                <span>Pickup: <strong style={{color:C.ink}}>{pickupDate}</strong></span>
                <span>Return: <strong style={{color:C.ink}}>{returnDate}</strong></span>
                {rentalDays&&<span style={{color:C.rosa}}>{rentalDays}d rental</span>}
              </div>
              <div><div style={LBL}>Rental fee ($)</div><input type="number" value={fee} onChange={e=>setFee(e.target.value)} style={inputSt}/></div>
              <div><div style={LBL}>Security deposit ($)</div><input type="number" value={dep} onChange={e=>setDep(e.target.value)} style={inputSt}/></div>
              <div style={{background:C.ivory,borderRadius:8,padding:'10px 14px',display:'flex',flexDirection:'column',gap:5}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:C.gray}}>Rental fee</span><span style={{fontWeight:500}}>{fmt(Number(fee)||0)}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:C.gray}}>Security deposit</span><span style={{fontWeight:500}}>{fmt(Number(dep)||0)}</span></div>
                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:5,display:'flex',justifyContent:'space-between',fontSize:13,fontWeight:700}}><span>Total due</span><span style={{color:C.rosa}}>{fmt((Number(fee)||0)+(Number(dep)||0))}</span></div>
              </div>
              <div><div style={LBL}>Notes (optional)</div><textarea value={notes} onChange={e=>setNotes(e.target.value)} onInput={e=>{e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px';}} rows={2} placeholder="Alterations needed, special instructions…" style={{...inputSt,resize:'vertical'}}/></div>
            </div>
            <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="← Back" onClick={()=>setStep(2)}/>
              <PrimaryBtn label="Review →" onClick={()=>setStep(4)}/>
            </div>
          </>)}
          {/* Step 4 — Confirm */}
          {step===4&&(<>
            <div style={{flex:1,overflowY:'auto',padding:'14px 24px',display:'flex',flexDirection:'column',gap:12,boxShadow:'inset 0 -8px 8px -8px rgba(0,0,0,0.15)'}}>
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{margin:'0 auto 10px'}}><GownSilhouette color={selDress?.color} size={44}/></div>
                <div style={{fontSize:15,fontWeight:600,color:C.ink}}>{selDress?.name}</div>
                <div style={{fontSize:11,color:C.gray}}>#{selDress?.sku} · {selDress?.color} · Size {selDress?.size}</div>
              </div>
              <div style={{background:C.ivory,borderRadius:10,padding:14,display:'flex',flexDirection:'column',gap:7}}>
                {[
                  ['Client',clientLabel],
                  selEvent?['Event',`${EVT_TYPES[selEvent.type]?.label||selEvent.type} · ${selEvent.event_date||selEvent.date}`]:null,
                  linkMode==='walkin'&&wiPhone?['Phone',wiPhone]:null,
                  linkMode==='walkin'&&wiPurpose?['Purpose',wiPurpose]:null,
                  ['Pickup date',pickupDate],
                  ['Return due',returnDate],
                  rentalDays?['Duration',`${rentalDays} days`]:null,
                  ['Rental fee',fmt(Number(fee)||0)],
                  ['Security deposit',fmt(Number(dep)||0)],
                  notes?['Notes',notes]:null,
                ].filter(Boolean).map(([k,v])=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                    <span style={{color:C.gray,flexShrink:0}}>{k}</span>
                    <span style={{color:C.ink,fontWeight:500,textAlign:'right',maxWidth:'65%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</span>
                  </div>
                ))}
                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:7,display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:700}}>
                  <span>Total due</span><span style={{color:C.rosa}}>{fmt((Number(fee)||0)+(Number(dep)||0))}</span>
                </div>
              </div>
              {err&&<div style={{fontSize:12,color:'var(--color-danger)',background:'var(--bg-danger)',padding:'8px 12px',borderRadius:7}}>{err}</div>}
            </div>
            <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="← Back" onClick={()=>setStep(3)}/>
              <PrimaryBtn label={saving?'Reserving…':'Reserve dress'} colorScheme="info" onClick={confirm}/>
            </div>
          </>)}
        </div>
      </div>
    );
  };

  // ── Create Invoice Modal (from rental)
  const CreateInvoiceModal=({rental,onClose})=>{
    const [inclAlt,setInclAlt]=useState(false);
    const [inclTerms,setInclTerms]=useState(true);
    const [bilingual,setBilingual]=useState(false);
    const [email,setEmail]=useState('');
    const [sent,setSent]=useState(false);
    const invNum='INV-'+new Date().getFullYear()+'-'+String(Math.floor(Math.random()*9000)+1000);
    const fee=parseFloat(rental.fee)||0;
    const dep=parseFloat(rental.deposit)||0;
    const altEst=inclAlt?280:0;
    const subtotal=fee+(inclAlt?altEst:0);
    const total=subtotal+dep;
    const lineItems=[
      {label:'Dress rental',desc:`${rental.dress.name} (#${rental.dress.sku||'—'}) · Pickup ${rental.pickupDate} · Return ${rental.returnDate}`,amt:fee,type:'rental'},
      {label:'Security deposit',desc:'Refundable upon return in good condition',amt:dep,type:'deposit'},
      ...(inclAlt?[{label:'Alterations',desc:'Hem · Bustle · Waist take-in · TBD seamstress',amt:altEst,type:'alteration'}]:[]),
    ];
    if(sent) return(
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1002,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.white,borderRadius:20,width:460,padding:32,textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
          <div style={{width:52,height:52,borderRadius:'50%',background:'var(--bg-success)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 16px'}}>✓</div>
          <div style={{fontSize:16,fontWeight:700,color:C.ink,marginBottom:8}}>Invoice sent!</div>
          <div style={{fontSize:12,color:C.gray,marginBottom:4}}>{invNum} sent to <strong>{email||rental.clientEmail||'client'}</strong></div>
          <div style={{fontSize:11,color:C.gray,marginBottom:24}}>Total: ${total.toFixed(2)}</div>
          <button onClick={onClose} style={{padding:'10px 28px',borderRadius:8,background:C.rosa,color:C.white,border:'none',cursor:'pointer',fontSize:13,fontWeight:600}}>Done</button>
        </div>
      </div>
    );
    return(
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1002,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.white,borderRadius:20,width:520,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
          <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:C.ink}}>Create invoice</div>
              <div style={{fontSize:11,color:C.gray,marginTop:2}}>{invNum} · {rental.client}</div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.gray,cursor:'pointer'}}>×</button>
          </div>
          {/* Line items */}
          <div style={{padding:'16px 24px'}}>
            <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Line items</div>
            <div style={{border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
              {lineItems.map((li,i)=>(
                <div key={li.label+i} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'11px 14px',borderBottom:i<lineItems.length-1?`1px solid ${C.border}`:'none',background:li.type==='deposit'?C.grayBg:C.white}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.ink}}>{li.label}</div>
                    <div style={{fontSize:10,color:C.gray,marginTop:2,lineHeight:1.4}}>{li.desc}</div>
                  </div>
                  <div style={{fontSize:12,fontWeight:600,color:li.type==='deposit'?C.gray:C.ink,marginLeft:12,flexShrink:0}}>${li.amt.toFixed(2)}{li.type==='deposit'&&<span style={{fontSize:9,color:C.gray,fontWeight:400}}> refund.</span>}</div>
                </div>
              ))}
              <div style={{padding:'10px 14px',background:'#F8F4F0',display:'flex',justifyContent:'space-between',borderTop:`1px solid ${C.border}`}}>
                <div>
                  <div style={{fontSize:10,color:C.gray}}>Subtotal (services) <span style={{color:C.ink,fontWeight:500}}>${subtotal.toFixed(2)}</span></div>
                  <div style={{fontSize:10,color:C.gray}}>Security deposit <span style={{color:C.ink,fontWeight:500}}>+${dep.toFixed(2)}</span></div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,color:C.gray,textTransform:'uppercase',letterSpacing:'0.5px'}}>Total due</div>
                  <div style={{fontSize:16,fontWeight:700,color:C.ink}}>${total.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
          {/* Options */}
          <div style={{padding:'0 24px 16px'}}>
            <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Options</div>
            {[
              {key:'alt',label:'Include alteration details',val:inclAlt,set:setInclAlt},
              {key:'terms',label:'Include terms & conditions',val:inclTerms,set:setInclTerms},
              {key:'bi',label:'Bilingual EN/ES',val:bilingual,set:setBilingual},
            ].map(o=>(
              <label key={o.key} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,cursor:'pointer'}}>
                <input type="checkbox" checked={o.val} onChange={e=>o.set(e.target.checked)} style={{width:15,height:15,accentColor:C.rosa}}/>
                <span style={{fontSize:13,color:C.ink}}>{o.label}</span>
              </label>
            ))}
          </div>
          {/* Send */}
          <div style={{padding:'0 24px 24px'}}>
            <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Send to</div>
            <div style={{display:'flex',gap:8}}>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="client@email.com" style={{...inputSt,margin:0,flex:1,fontSize:13}}/>
              <button onClick={()=>{if(!email.trim()){toast('Please enter a valid email address','warn');return;}setSent(true);}} style={{padding:'9px 18px',borderRadius:8,background:C.rosa,color:C.white,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,flexShrink:0}}>Send</button>
            </div>
            <button onClick={()=>{toast('Invoice #'+invNum+' created — PDF generating…','info');onClose();}} style={{width:'100%',marginTop:10,padding:'9px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:12}}>
              Save invoice (don't send yet)
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Print Receipt Modal (3 formats)
  const PrintReceiptModal=({rental,onClose})=>{
    const {boutique:bq}=useAuth();
    const [fmt,setFmt]=useState('thermal');
    const fee=parseFloat(rental.fee)||0;
    const dep=parseFloat(rental.deposit)||0;
    const total=fee+dep;
    const tabs=[{k:'thermal',label:'Thermal 80mm'},{k:'letter',label:'Letter 8.5×11'},{k:'label',label:'Hanger label'}];
    const ThermalPreview=()=>(
      <div style={{fontFamily:'monospace',fontSize:11,color:C.ink,background:'#FFFEF0',border:`1px dashed ${C.border}`,borderRadius:8,padding:16,maxWidth:280,margin:'0 auto',lineHeight:1.7}}>
        <div style={{textAlign:'center',fontWeight:700,fontSize:13,marginBottom:2}}>{(bq?.name||'Boutique').toUpperCase()}</div>
        <div style={{textAlign:'center',fontSize:9,color:C.gray,marginBottom:8}}>{[bq?.address,bq?.phone].filter(Boolean).join(' · ')}</div>
        <div style={{borderTop:'1px dashed #ccc',marginBottom:8}}/>
        <div>Client: {rental.client}</div>
        <div>Event: {rental.event||'Wedding'} · {rental.eventDate||rental.pickupDate}</div>
        <div style={{borderTop:'1px dashed #ccc',margin:'8px 0'}}/>
        <div style={{display:'flex',justifyContent:'space-between'}}><span>Dress rental</span><span>${fee.toFixed(2)}</span></div>
        <div style={{fontSize:9,color:C.gray,marginLeft:2,marginBottom:4}}>{rental.dress.name} #{rental.dress.sku||'—'}</div>
        <div style={{display:'flex',justifyContent:'space-between'}}><span>Security deposit</span><span>${dep.toFixed(2)}</span></div>
        <div style={{fontSize:9,color:C.gray,marginLeft:2,marginBottom:4}}>Refundable</div>
        <div style={{borderTop:'1px dashed #ccc',margin:'8px 0'}}/>
        <div style={{display:'flex',justifyContent:'space-between',fontWeight:700}}><span>TOTAL</span><span>${total.toFixed(2)}</span></div>
        <div style={{borderTop:'1px dashed #ccc',margin:'8px 0'}}/>
        <div style={{fontSize:9,color:C.gray}}>Pickup: {rental.pickupDate}</div>
        <div style={{fontSize:9,color:C.gray}}>Return due: {rental.returnDate}</div>
        <div style={{fontSize:9,color:'var(--color-danger)',marginTop:2}}>Late fee: $25/day after return date</div>
        <div style={{borderTop:'1px dashed #ccc',margin:'8px 0'}}/>
        <div style={{fontSize:9,color:C.gray,marginBottom:16}}>Client signature: ___________________</div>
        <div style={{textAlign:'center',fontSize:8,color:C.gray}}>belori.app</div>
      </div>
    );
    const LetterPreview=()=>(
      <div style={{fontFamily:'serif',fontSize:11,color:C.ink,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:24,lineHeight:1.7}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16,paddingBottom:12,borderBottom:`2px solid ${C.rosa}`}}>
          <div><div style={{fontSize:16,fontWeight:700,color:C.rosa}}>{(bq?.name||'Boutique').toUpperCase()}</div><div style={{fontSize:9,color:C.gray}}>{bq?.address||''}{bq?.phone?<><br/>{bq.phone}</>:''}{bq?.email?<> · {bq.email}</>:''}</div></div>
          <div style={{textAlign:'right'}}><div style={{fontSize:11,fontWeight:600}}>RENTAL AGREEMENT</div><div style={{fontSize:9,color:C.gray}}>Date: {new Date().toLocaleDateString()}</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:12}}>
          <div><div style={{fontSize:9,fontWeight:600,color:C.gray,textTransform:'uppercase'}}>Client</div><div style={{fontSize:11}}>{rental.client}</div></div>
          <div><div style={{fontSize:9,fontWeight:600,color:C.gray,textTransform:'uppercase'}}>Event</div><div style={{fontSize:11}}>{rental.event||'Wedding'} · {rental.eventDate||rental.pickupDate}</div></div>
          <div><div style={{fontSize:9,fontWeight:600,color:C.gray,textTransform:'uppercase'}}>Dress</div><div style={{fontSize:11}}>{rental.dress.name}</div></div>
          <div><div style={{fontSize:9,fontWeight:600,color:C.gray,textTransform:'uppercase'}}>Return due</div><div style={{fontSize:11,color:'var(--color-danger)'}}>{rental.returnDate}</div></div>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,marginBottom:12}}>
          <thead><tr style={{background:C.grayBg}}><th style={{textAlign:'left',padding:'6px 8px',borderBottom:`1px solid ${C.border}`}}>Item</th><th style={{textAlign:'right',padding:'6px 8px',borderBottom:`1px solid ${C.border}`}}>Amount</th></tr></thead>
          <tbody>
            <tr><td style={{padding:'6px 8px',borderBottom:`1px solid ${C.border}`}}>Dress rental — {rental.dress.name} #{rental.dress.sku||'—'}</td><td style={{textAlign:'right',padding:'6px 8px',borderBottom:`1px solid ${C.border}`}}>${fee.toFixed(2)}</td></tr>
            <tr style={{background:C.grayBg}}><td style={{padding:'6px 8px'}}>Security deposit (refundable)</td><td style={{textAlign:'right',padding:'6px 8px'}}>${dep.toFixed(2)}</td></tr>
          </tbody>
          <tfoot><tr style={{fontWeight:700}}><td style={{padding:'8px',borderTop:`2px solid ${C.ink}`}}>TOTAL DUE</td><td style={{textAlign:'right',padding:'8px',borderTop:`2px solid ${C.ink}`}}>${total.toFixed(2)}</td></tr></tfoot>
        </table>
        <div style={{fontSize:9,color:C.gray,marginBottom:16,lineHeight:1.5}}>Late fee: $25.00 per day after return date, maximum $750. Security deposit refunded within 3 business days of return in original condition.</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
          <div><div style={{fontSize:9,color:C.gray,marginBottom:20}}>Client signature</div><div style={{borderTop:`1px solid ${C.ink}`,paddingTop:4,fontSize:9,color:C.gray}}>Date ___________</div></div>
          <div><div style={{fontSize:9,color:C.gray,marginBottom:20}}>Staff signature</div><div style={{borderTop:`1px solid ${C.ink}`,paddingTop:4,fontSize:9,color:C.gray}}>Date ___________</div></div>
        </div>
      </div>
    );
    const LabelPreview=()=>(
      <div style={{width:160,height:160,border:`2px solid ${C.ink}`,borderRadius:8,padding:10,display:'flex',flexDirection:'column',justifyContent:'space-between',margin:'0 auto',background:C.white}}>
        <div style={{fontSize:7,color:C.gray,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>{bq?.name||'Boutique'}</div>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'monospace',fontSize:18,fontWeight:700,color:C.ink}}>#{rental.dress.sku||'—'}</div>
          <div style={{fontSize:9,color:C.ink,lineHeight:1.3,marginTop:2}}>{rental.dress.name}</div>
          <div style={{fontSize:10,fontWeight:600,color:C.rosa,marginTop:4}}>{rental.client}</div>
          <div style={{fontSize:8,color:C.gray,marginTop:2}}>Event: {rental.eventDate||rental.pickupDate}</div>
          <div style={{fontSize:8,color:'var(--color-danger)',fontWeight:600,marginTop:2}}>Return: {rental.returnDate}</div>
        </div>
        <div style={{textAlign:'center',fontSize:6,color:C.gray,letterSpacing:'1px',textTransform:'uppercase'}}>BELORI</div>
      </div>
    );
    return(
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1002,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.white,borderRadius:20,width:520,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
          <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:15,fontWeight:700,color:C.ink}}>Print receipt</div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.gray,cursor:'pointer'}}>×</button>
          </div>
          {/* Format tabs */}
          <div style={{display:'flex',gap:0,borderBottom:`1px solid ${C.border}`}}>
            {tabs.map(t=>(
              <button key={t.k} onClick={()=>setFmt(t.k)} style={{flex:1,padding:'10px 8px',border:'none',background:fmt===t.k?C.rosaPale:C.white,color:fmt===t.k?C.rosa:C.gray,fontWeight:fmt===t.k?600:400,fontSize:12,cursor:'pointer',borderBottom:fmt===t.k?`2px solid ${C.rosa}`:'2px solid transparent',transition:'all 0.15s'}}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{padding:20}}>
            {fmt==='thermal'&&<ThermalPreview/>}
            {fmt==='letter'&&<LetterPreview/>}
            {fmt==='label'&&<LabelPreview/>}
          </div>
          <div style={{padding:'0 20px 20px',display:'flex',gap:10}}>
            <button onClick={()=>{window.print();}} style={{flex:1,padding:'10px',borderRadius:8,background:C.rosa,color:C.white,border:'none',cursor:'pointer',fontSize:13,fontWeight:600}}>🖨 Print now</button>
            <button onClick={onClose} style={{padding:'10px 18px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>Done</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Add Alterations from Rental Modal
  const ALTERATION_WORK_ITEMS=[
    {key:'hem',label:'Hem',est:70},
    {key:'bustle',label:'Bustle',est:100},
    {key:'waist_in',label:'Waist take-in',est:80},
    {key:'waist_out',label:'Let out waist',est:80},
    {key:'sleeves',label:'Sleeves',est:60},
    {key:'straps',label:'Straps',est:40},
    {key:'beading',label:'Custom beading',est:200},
    {key:'lining',label:'Lining',est:90},
    {key:'neckline',label:'Neckline',est:80},
    {key:'train',label:'Train',est:80},
    {key:'zipper',label:'Zipper',est:50},
  ];
  const AddAlterationFromRentalModal=({rental,onClose})=>{
    const [selected,setSelected]=useState([]);
    const [seamstress_id,setSeamstressId]=useState('');
    const [notes,setNotes]=useState('');
    const [quotedPrice,setQuotedPrice]=useState('');
    const [saved,setSaved]=useState(false);
    // auto-deadline: event date - 5 days (demo: today + 17 days)
    const autoDeadline=(()=>{const d=new Date();d.setDate(d.getDate()+17);return d.toISOString().slice(0,10);})();
    const [deadline,setDeadline]=useState(autoDeadline);
    const toggleItem=key=>setSelected(s=>s.includes(key)?s.filter(k=>k!==key):[...s,key]);
    const estTotal=selected.reduce((sum,k)=>{const item=ALTERATION_WORK_ITEMS.find(i=>i.key===k);return sum+(item?item.est:0);},0);
    useEffect(()=>{if(estTotal>0&&!quotedPrice)setQuotedPrice(String(estTotal));},[selected]);
    if(saved) return(
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1002,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.white,borderRadius:20,width:440,padding:32,textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
          <div style={{width:52,height:52,borderRadius:'50%',background:'#EDE9FE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 16px'}}>✂️</div>
          <div style={{fontSize:16,fontWeight:700,color:C.ink,marginBottom:8}}>Alteration job created</div>
          <div style={{fontSize:12,color:C.gray,marginBottom:4}}>{selected.map(k=>ALTERATION_WORK_ITEMS.find(i=>i.key===k)?.label).join(' · ')}</div>
          <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Seamstress: {staff.find(s=>s.id===seamstress_id)?.name||'Unassigned'} · Due: {deadline}</div>
          <div style={{fontSize:13,fontWeight:600,color:C.ink,marginBottom:24}}>Quoted: ${parseFloat(quotedPrice||0).toFixed(2)}</div>
          <button onClick={onClose} style={{padding:'10px 28px',borderRadius:8,background:C.rosa,color:C.white,border:'none',cursor:'pointer',fontSize:13,fontWeight:600}}>Done</button>
        </div>
      </div>
    );
    return(
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1002,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.white,borderRadius:20,width:500,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
          <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:15,fontWeight:700,color:C.ink}}>Add alteration job</div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.gray,cursor:'pointer'}}>×</button>
          </div>
          <div style={{padding:'16px 24px',display:'flex',flexDirection:'column',gap:14}}>
            {/* Pre-filled context */}
            <div style={{background:C.grayBg,borderRadius:10,padding:'10px 14px',display:'flex',flexDirection:'column',gap:6}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:10,fontWeight:600,color:C.gray,width:48,flexShrink:0}}>Dress</span>
                <span style={{fontSize:12,color:C.ink}}>{rental.dress.name} <span style={{fontFamily:'monospace',color:C.gray}}>#{rental.dress.sku||'—'}</span></span>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:10,fontWeight:600,color:C.gray,width:48,flexShrink:0}}>Event</span>
                <span style={{fontSize:12,color:C.ink}}>{rental.client} · {rental.event||'Rental'} {rental.eventDate||rental.returnDate}</span>
              </div>
            </div>
            {/* Work items */}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Work needed</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {ALTERATION_WORK_ITEMS.map(item=>{
                  const on=selected.includes(item.key);
                  return(
                    <button key={item.key} onClick={()=>toggleItem(item.key)}
                      style={{padding:'6px 12px',borderRadius:20,border:`1.5px solid ${on?C.rosa:C.border}`,background:on?C.rosaPale:C.white,color:on?C.rosa:C.gray,fontSize:12,cursor:'pointer',fontWeight:on?600:400,transition:'all 0.15s'}}>
                      {on&&'✓ '}{item.label} <span style={{fontSize:10,opacity:0.7}}>${item.est}</span>
                    </button>
                  );
                })}
              </div>
              {estTotal>0&&<div style={{fontSize:11,color:C.gray,marginTop:8}}>Estimated total: <strong style={{color:C.ink}}>${estTotal}</strong></div>}
            </div>
            {/* Seamstress */}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Seamstress</div>
              <select value={seamstress_id} onChange={e=>setSeamstressId(e.target.value)} style={{...inputSt,margin:0,fontSize:13}}>
                <option value="">Unassigned</option>
                {staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {/* Deadline */}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Must be done by</div>
              <input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} style={{...inputSt,margin:0,fontSize:13}}/>
              <div style={{fontSize:10,color:C.gray,marginTop:4}}>Auto-set to 5 days before event date</div>
            </div>
            {/* Notes */}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Work notes</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} onInput={e=>{e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px';}} placeholder="e.g. Take in waist 1.5 inches. Hem to floor." rows={3} style={{...inputSt,margin:0,fontSize:12,resize:'vertical',height:72}}/>
            </div>
            {/* Quoted price */}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Quoted price</div>
              <div style={{display:'flex',alignItems:'center',gap:0}}>
                <span style={{padding:'9px 10px',background:C.grayBg,border:`1px solid ${C.border}`,borderRight:'none',borderRadius:'8px 0 0 8px',fontSize:13,color:C.gray}}>$</span>
                <input type="number" value={quotedPrice} onChange={e=>setQuotedPrice(e.target.value)} placeholder="0.00" style={{...inputSt,margin:0,fontSize:13,borderRadius:'0 8px 8px 0',borderLeft:'none',flex:1}}/>
              </div>
            </div>
            {/* Save */}
            <button onClick={async()=>{
              if(selected.length===0){toast('Select at least one work item','warn');return;}
              if(!quotedPrice||parseFloat(quotedPrice)<=0){toast('Please enter a price estimate','warn');return;}
              if(createJob){
                const workDescs=selected.map(k=>ALTERATION_WORK_ITEMS.find(i=>i.key===k)?.label).filter(Boolean);
                await createJob({
                  event_id:rental.event_id||null,
                  client_id:rental.client_id||null,
                  garment:rental.dress?.name||'',
                  work_items:workDescs,
                  seamstress_id:seamstress_id||null,
                  deadline:deadline||null,
                  price:parseFloat(quotedPrice)||null,
                  notes:notes||null,
                  status:'measurement_needed',
                });
              }
              setSaved(true);
            }} style={{padding:'12px',borderRadius:10,background:C.rosa,color:C.white,border:'none',cursor:'pointer',fontSize:14,fontWeight:600,marginTop:4}}>
              Create alteration job
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Post-rental success screen
  const PostRentalSuccessScreen=({rental,onClose})=>{
    const [sub,setSub]=useState(null); // 'invoice'|'print'|'alteration'
    return(
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1001,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.white,borderRadius:20,width:500,padding:32,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
          <div style={{textAlign:'center',marginBottom:24}}>
            <div style={{width:52,height:52,borderRadius:'50%',background:C.greenBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 12px'}}>✓</div>
            <div style={{fontSize:17,fontWeight:700,color:C.ink,marginBottom:6}}>Rental reserved successfully</div>
            <div style={{fontSize:12,color:C.gray,lineHeight:1.7}}>
              <strong>{rental.dress.name}</strong> is now reserved for <strong>{rental.client}</strong>.<br/>
              Pickup: {rental.pickupDate} · Return due: {rental.returnDate}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
            {[
              {icon:'📄',title:'Create invoice',desc:'Email to client',key:'invoice'},
              {icon:'🖨',title:'Print receipt',desc:'For client to sign',key:'print'},
              {icon:'✂️',title:'Add alterations',desc:'Hem, bustle, etc.',key:'alteration'},
            ].map(a=>(
              <button key={a.key} onClick={()=>setSub(a.key)}
                style={{padding:'14px 8px',borderRadius:12,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',textAlign:'center',transition:'all 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.rosa;e.currentTarget.style.background=C.rosaPale;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.white;}}>
                <div style={{fontSize:26,marginBottom:6}}>{a.icon}</div>
                <div style={{fontSize:11,fontWeight:600,color:C.ink,marginBottom:2}}>{a.title}</div>
                <div style={{fontSize:10,color:C.gray}}>{a.desc}</div>
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{width:'100%',padding:'10px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:12}}>
            Done — go to rental record
          </button>
        </div>
        {sub==='invoice'&&<CreateInvoiceModal rental={rental} onClose={()=>setSub(null)}/>}
        {sub==='print'&&<PrintReceiptModal rental={rental} onClose={()=>setSub(null)}/>}
        {sub==='alteration'&&<AddAlterationFromRentalModal rental={rental} onClose={()=>setSub(null)}/>}
      </div>
    );
  };

  // ── Log Return search (topbar, multiple rented)
  const LogReturnSearchModal=({onClose})=>{
    const [q,setQ]=useState('');
    const all=[...overdueItems,...onTimeItems];
    const filtered=q?all.filter(d=>(d.name+' '+d.sku+' '+(d.client?.name||d.client||'')).toLowerCase().includes(q.toLowerCase())):all;
    return(
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:C.white,borderRadius:16,width:440,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
          <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:15,fontWeight:600,color:C.ink}}>Select dress to return</div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.gray,cursor:'pointer'}}>×</button>
          </div>
          <div style={{padding:'12px 20px 8px'}}><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search dress or client…" autoFocus style={{...inputSt,margin:0}}/></div>
          <div style={{flex:1,overflowY:'auto'}}>
            {filtered.map(d=>{
              const over=isOverdue(d);const late=daysLate(d);
              const clientName=d.client?.name||d.client||'';
              return(
                <div key={d.id} onClick={()=>{setReturnDress(d);onClose();}} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 20px',borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:over?'#FFF8F8':C.white}} onMouseEnter={e=>e.currentTarget.style.background=over?'#FFF0F0':C.ivory} onMouseLeave={e=>e.currentTarget.style.background=over?'#FFF8F8':C.white}>
                  <div style={{width:34,height:42,background:C.ivory,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><GownSilhouette color={d.color} size={18}/></div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{d.name} <span style={{fontSize:10,color:C.gray,fontFamily:'monospace'}}>#{d.sku}</span></div>
                    <div style={{fontSize:11,color:over?C.red:C.gray}}>{clientName}{over&&<span style={{fontWeight:600}}> · {late}d overdue</span>}</div>
                  </div>
                  {over&&<Badge text={`${late}d late`} bg={C.redBg} color={C.red}/>}
                  <span style={{color:C.gray}}>›</span>
                </div>
              );
            })}
            {filtered.length===0&&<div style={{textAlign:'center',padding:32,color:C.gray,fontSize:13}}>No rented dresses found</div>}
          </div>
        </div>
      </div>
    );
  };

  // ── Detail slide-over
  const DetailPanel=({dress,onClose})=>{
    const over=isOverdue(dress);
    const late=daysLate(dress);
    const clientName=dress.client?.name||dress.client||'Walk-in';
    const dueLabel=dress.returnDate||dress.return_date||'';
    const stages=['Reserved','Deposit paid','Picked up','Return due','Returned','Cleaning','Available'];
    const stageIdx=dress.status==='available'?6:dress.status==='cleaning'?5:dress.status==='returned'?4:(dress.status==='rented'||dress.status==='picked_up')?3:dress.status==='reserved'?0:0;

    return(
      <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',justifyContent:'flex-end'}} onClick={onClose}>
        <div style={{width:400,height:'100%',background:C.white,boxShadow:'-4px 0 20px rgba(0,0,0,0.1)',display:'flex',flexDirection:'column',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
          {/* Image header */}
          {dress.image_url?(
            <div style={{position:'relative',height:200,overflow:'hidden',flexShrink:0}}>
              <img src={dress.image_url} alt={dress.name} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
              <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,0.0) 50%,rgba(0,0,0,0.5) 100%)'}}/>
              <button onClick={onClose} style={{position:'absolute',top:12,right:12,background:'rgba(0,0,0,0.45)',border:'none',borderRadius:'50%',width:28,height:28,color:'#fff',fontSize:18,cursor:'pointer',lineHeight:'28px',textAlign:'center'}}>×</button>
              <div style={{position:'absolute',bottom:12,left:16,right:48}}>
                <div style={{fontSize:16,fontWeight:600,color:'#fff'}}>{dress.name}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.8)'}}>#{dress.sku} · {clientName}</div>
              </div>
            </div>
          ):(
            <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontSize:16,fontWeight:600,color:C.ink}}>{dress.name}</div>
                <div style={{fontSize:12,color:C.gray}}>#{dress.sku} · {clientName}</div>
              </div>
              <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:C.gray,cursor:'pointer'}}>×</button>
            </div>
          )}

          {/* Timeline */}
          <div style={{padding:'20px 24px'}}>
            <div style={{fontSize:11,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:14}}>RENTAL TIMELINE</div>
            {stages.map((stage,i)=>{
              const done=i<=stageIdx;
              const isOverdueStep=i===3&&over;
              return(
                <div key={stage} style={{display:'flex',gap:12,marginBottom:i<stages.length-1?0:0}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:16}}>
                    <div style={{width:12,height:12,borderRadius:'50%',background:done?(isOverdueStep?C.red:C.rosa):'#E5E7EB',border:isOverdueStep?'2px solid '+C.red:'none',flexShrink:0}}/>
                    {i<stages.length-1&&<div style={{width:2,height:24,background:done?C.rosaPale:'#E5E7EB'}}/>}
                  </div>
                  <div style={{paddingBottom:i<stages.length-1?12:0}}>
                    <div style={{fontSize:12,fontWeight:done?500:400,color:done?(isOverdueStep?C.red:C.ink):C.gray}}>{stage}</div>
                    {isOverdueStep&&<div style={{fontSize:10,color:C.red,fontWeight:600}}>{late} days overdue · {fmt(Math.min(late*LATE_FEE_PER_DAY,750))} fee accruing</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Details */}
          <div style={{padding:'0 24px 20px'}}>
            <div style={{fontSize:11,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:10}}>DETAILS</div>
            <div style={{background:C.ivory,borderRadius:10,padding:14,display:'flex',flexDirection:'column',gap:8}}>
              {[
                ['Rental fee',fmt(dress.price||0)],
                ['Deposit',fmt(dress.deposit||0)],
                dueLabel?['Return due',dueLabel+(over?` (${late}d overdue)`:'')]:null,
                ['Color',dress.color||'—'],
                ['Size',dress.size||'—'],
                ['Category',(dress.cat||'').includes('quince')?'Quinceañera':'Bridal'],
              ].filter(Boolean).map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                  <span style={{color:C.gray}}>{k}</span>
                  <span style={{color:k==='Return due'&&over?C.red:C.ink,fontWeight:k==='Return due'&&over?600:400}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{padding:'0 24px 16px',display:'flex',flexDirection:'column',gap:8}}>
            {(dress.status==='rented'||dress.status==='picked_up')&&<PrimaryBtn label={over?"Log return — OVERDUE":"Log return"} colorScheme={over?"danger":"success"} onClick={()=>{setReturnDress(dress);onClose();}}/>}
            {dress.status==='reserved'&&<PrimaryBtn label="Mark picked up" colorScheme="success" onClick={()=>{setPickupDress(dress);onClose();}}/>}
            {dress.status==='available'&&<PrimaryBtn label="Reserve for event" colorScheme="info" onClick={()=>{setNewRentalInitDress(dress);setNewRentalOpen(true);onClose();}}/>}
            {dress.status==='cleaning'&&<PrimaryBtn label="Mark cleaned" colorScheme="success" onClick={()=>{handleMarkCleaned(dress);onClose();}}/>}
            {(dress.status==='rented'||dress.status==='picked_up')&&<GhostBtn label="Send reminder" onClick={()=>toast('Reminder sent')}/>}
          </div>

          {/* Similar dresses — shown when this dress is unavailable */}
          {showSimilar&&similarForDress===dress.id&&similarDresses.length>0&&(
            <div style={{padding:'0 24px 16px'}}>
              <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:12,fontWeight:600,color:'#1E40AF',marginBottom:10}}>
                  This dress is not available — here are similar options:
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                  {similarDresses.map(d=>(
                    <div key={d.id} onClick={()=>{setShowSimilar(false);setSimilarForDress(null);setDetailDress(d);}}
                      style={{background:C.white,borderRadius:8,padding:'10px 12px',cursor:'pointer',border:`1px solid ${C.border}`,transition:'border-color 0.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=C.rosa}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                      <div style={{fontSize:13,fontWeight:500,color:C.ink,marginBottom:2}}>{d.name}</div>
                      <div style={{fontSize:11,color:C.gray}}>Size {d.size} · {d.color}</div>
                      <div style={{fontSize:11,color:'#10B981',marginTop:4,fontWeight:500}}>Available</div>
                      {d.price>0&&<div style={{fontSize:11,color:C.gray}}>{fmt(d.price)}/rental</div>}
                    </div>
                  ))}
                </div>
                <button onClick={()=>{setShowSimilar(false);setSimilarForDress(null);}} style={{marginTop:10,fontSize:11,color:C.gray,background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Dismiss</button>
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{borderTop:`1px solid ${C.border}`,margin:'0 24px 0'}}/>

          {/* Maintenance Log */}
          <MaintenanceLog dress={dress}/>
        </div>
      </div>
    );
  };

  // ── Availability Calendar Tab ─────────────────────────────────────────────
  const AvailabilityTab=()=>{
    const [avSearch,setAvSearch]=useState('');
    const [avCat,setAvCat]=useState('all');
    const [tooltip,setTooltip]=useState(null); // {x,y,text}

    const today=new Date();
    today.setHours(0,0,0,0);

    // Build array of 28 day objects starting today
    const days=Array.from({length:28},(_,i)=>{
      const d=new Date(today);
      d.setDate(today.getDate()+i);
      return d;
    });

    // Filter dresses for the calendar
    const calDresses=allGowns.filter(d=>{
      const cat=(d.category||d.cat||'').toLowerCase();
      const matchCat=avCat==='all'
        ||(avCat==='bridal'&&(cat.includes('bridal')))
        ||(avCat==='quince'&&(cat.includes('quince')))
        ||(avCat==='veil'&&(cat.includes('veil')));
      const q=avSearch.toLowerCase();
      const matchQ=!q||(d.name+' '+d.sku+' '+(d.color||'')).toLowerCase().includes(q);
      return matchCat&&matchQ;
    });

    const isSameDay=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
    const isWeekend=d=>d.getDay()===0||d.getDay()===6;

    // Check if a day falls within the dress rental window
    const isRented=(dress,day)=>{
      const pickup=dress.pickup_date||dress.pickupDate;
      const ret=dress.return_date||dress.returnDate;
      if(!pickup||!ret)return false;
      const pD=new Date(pickup+'T00:00:00');
      const rD=new Date(ret+'T00:00:00');
      return day>=pD&&day<=rD;
    };

    // For bar continuity: is the first rented day?
    const isRentalStart=(dress,day,i)=>{
      if(!isRented(dress,day))return false;
      if(i===0)return true;
      const prev=days[i-1];
      return !isRented(dress,prev);
    };
    const isRentalEnd=(dress,day,i)=>{
      if(!isRented(dress,day))return false;
      if(i===days.length-1)return true;
      const next=days[i+1];
      return !isRented(dress,next);
    };

    const clientName=(dress)=>dress.client?.name||dress.client||'Client';
    const shortDate=(d)=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});

    const MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Group days by month for the header
    let monthGroups=[];
    days.forEach((d,i)=>{
      const m=d.getMonth();
      if(monthGroups.length===0||monthGroups[monthGroups.length-1].month!==m){
        monthGroups.push({month:m,label:MONTH_NAMES[m],start:i,count:1});
      } else {
        monthGroups[monthGroups.length-1].count++;
      }
    });

    const COL_W=32; // px per day column
    const ROW_H=38;
    const LABEL_W=140;

    return(
      <div style={{padding:20}}>
        {/* Filters */}
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{flex:1,position:'relative',minWidth:180}}>
            <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.gray,pointerEvents:'none',fontSize:13}}>🔍</span>
            <input value={avSearch} onChange={e=>setAvSearch(e.target.value)} placeholder="Search dress name…" style={{...inputSt,paddingLeft:30,margin:0,width:'100%'}}/>
          </div>
          <div style={{display:'flex',gap:4}}>
            {[['all','All'],['bridal','Bridal'],['quince','Quinceañera'],['veil','Veil']].map(([id,l])=>(
              <button key={id} onClick={()=>setAvCat(id)} style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${avCat===id?C.rosa:C.border}`,background:avCat===id?C.rosaPale:'transparent',color:avCat===id?C.rosa:C.gray,fontSize:11,fontWeight:avCat===id?500:400,cursor:'pointer'}}>{l}</button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{display:'flex',gap:16,marginBottom:12,fontSize:11,color:C.gray,alignItems:'center'}}>
          <span style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:16,height:12,borderRadius:3,background:`rgba(201,105,122,0.7)`,display:'inline-block'}}/>
            Rented out
          </span>
          <span style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:16,height:12,borderRadius:3,background:'#F5F0E0',border:`1px solid ${C.border}`,display:'inline-block'}}/>
            Available
          </span>
          <span style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:3,height:14,background:C.rosa,display:'inline-block',borderRadius:1}}/>
            Today
          </span>
        </div>

        {calDresses.length===0&&(
          <div style={{textAlign:'center',padding:60,color:C.gray}}>
            <div style={{fontSize:36,marginBottom:8}}>📅</div>
            <div style={{fontSize:14,fontWeight:500,color:C.ink}}>No dresses to display</div>
            <div style={{fontSize:12,marginTop:4}}>Adjust your search or category filter</div>
          </div>
        )}

        {calDresses.length>0&&(
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:'auto'}}>
            {/* Month header */}
            <div style={{display:'flex',borderBottom:`1px solid ${C.border}`}}>
              <div style={{width:LABEL_W,flexShrink:0}}/>
              {monthGroups.map((mg,mi)=>(
                <div key={mi} style={{width:mg.count*COL_W,flexShrink:0,padding:'6px 4px',fontSize:10,fontWeight:700,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',borderLeft:`1px solid ${C.border}`}}>
                  {mg.label}
                </div>
              ))}
            </div>

            {/* Day-number header */}
            <div style={{display:'flex',borderBottom:`2px solid ${C.border}`,background:C.grayBg}}>
              <div style={{width:LABEL_W,flexShrink:0,padding:'4px 12px',fontSize:10,fontWeight:600,color:C.gray,display:'flex',alignItems:'center'}}>DRESS</div>
              {days.map((d,i)=>{
                const isToday=isSameDay(d,today);
                const weekend=isWeekend(d);
                return(
                  <div key={i} style={{
                    width:COL_W,flexShrink:0,padding:'4px 0',textAlign:'center',
                    fontSize:10,fontWeight:isToday?700:400,
                    color:isToday?C.rosa:weekend?C.inkLight:C.gray,
                    background:isToday?C.rosaPale:weekend?'#F5F4F3':'transparent',
                    borderLeft:`1px solid ${isToday?C.rosa:C.border}`,
                    position:'relative',
                  }}>
                    {d.getDate()}
                    {isToday&&<div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',width:3,height:3,borderRadius:'50%',background:C.rosa}}/>}
                  </div>
                );
              })}
            </div>

            {/* Dress rows */}
            {calDresses.map((dress,ri)=>(
              <div key={dress.id} style={{display:'flex',borderBottom:ri<calDresses.length-1?`1px solid ${C.border}`:'none',background:ri%2===0?C.white:C.grayBg}}>
                {/* Dress label */}
                <div style={{
                  width:LABEL_W,flexShrink:0,padding:'6px 12px',display:'flex',flexDirection:'column',
                  justifyContent:'center',borderRight:`1px solid ${C.border}`,minHeight:ROW_H,
                }}>
                  <div style={{fontSize:11,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{dress.name}</div>
                  <div style={{fontSize:9,color:C.gray,fontFamily:'monospace'}}>#{dress.sku}</div>
                </div>

                {/* Day cells */}
                {days.map((day,ci)=>{
                  const rented=isRented(dress,day);
                  const start=isRentalStart(dress,day,ci);
                  const end=isRentalEnd(dress,day,ci);
                  const isToday=isSameDay(day,today);
                  const weekend=isWeekend(day);

                  return(
                    <div
                      key={ci}
                      style={{
                        width:COL_W,flexShrink:0,height:ROW_H,position:'relative',
                        background:isToday?'rgba(201,105,122,0.04)':weekend?'rgba(0,0,0,0.01)':'transparent',
                        borderLeft:`1px solid ${isToday?C.rosa:C.border}`,
                        cursor:rented?'pointer':'default',
                      }}
                      onMouseEnter={rented?e=>{
                        const rect=e.currentTarget.getBoundingClientRect();
                        const pickup=dress.pickup_date||dress.pickupDate||'?';
                        const ret=dress.return_date||dress.returnDate||'?';
                        setTooltip({x:rect.left+rect.width/2,y:rect.top-8,text:`${clientName(dress)}\n${pickup} → ${ret}`});
                      }:undefined}
                      onMouseLeave={rented?()=>setTooltip(null):undefined}
                    >
                      {rented&&(
                        <div style={{
                          position:'absolute',
                          top:'50%',transform:'translateY(-50%)',
                          left:start?4:0,
                          right:end?4:0,
                          height:18,
                          background:`rgba(201,105,122,0.72)`,
                          borderRadius:start&&end?8:start?'8px 0 0 8px':end?'0 8px 8px 0':0,
                        }}/>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Tooltip */}
        {tooltip&&(
          <div style={{
            position:'fixed',
            left:tooltip.x,top:tooltip.y,
            transform:'translate(-50%,-100%)',
            background:C.ink,color:C.white,
            fontSize:11,
            padding:'6px 10px',borderRadius:7,
            pointerEvents:'none',zIndex:9999,
            whiteSpace:'pre',lineHeight:1.5,
            boxShadow:'0 4px 12px rgba(0,0,0,0.25)',
          }}>
            {tooltip.text}
          </div>
        )}
      </div>
    );
  };

  // ── Maintenance Log (used inside DetailPanel) ─────────────────────────────
  const MaintenanceLog=({dress})=>{
    const {boutique}=useAuth();
    const [records,setRecords]=useState([]);
    const [loading,setLoading]=useState(true);
    const [tableExists,setTableExists]=useState(true);
    const [showForm,setShowForm]=useState(false);
    const [saving,setSaving]=useState(false);
    const [form,setForm]=useState({type:'cleaning',notes:'',performed_by:'',performed_at:new Date().toISOString().slice(0,10),cost:''});
    const toast2=useToast();

    useEffect(()=>{
      if(!dress?.id||!boutique?.id)return;
      setLoading(true);
      supabase
        .from('inventory_maintenance')
        .select('*')
        .eq('boutique_id',boutique.id)
        .eq('inventory_id',dress.id)
        .order('performed_at',{ascending:false})
        .then(({data,error})=>{
          if(error&&(error.code==='42P01'||error.message?.includes('does not exist'))){
            setTableExists(false);
          } else if(!error){
            setRecords(data||[]);
          }
          setLoading(false);
        });
    },[dress?.id,boutique?.id,showForm]);

    const handleSave=async()=>{
      if(!form.performed_at){toast2('Date is required','warn');return;}
      setSaving(true);
      const payload={
        boutique_id:boutique.id,
        inventory_id:dress.id,
        type:form.type,
        notes:form.notes||null,
        performed_by:form.performed_by||null,
        performed_at:form.performed_at,
        cost:form.cost?parseFloat(form.cost):null,
      };
      const {error}=await supabase.from('inventory_maintenance').insert(payload);
      if(error){toast2('Could not save: '+error.message,'error');setSaving(false);return;}
      // If cleaning, also update last_cleaned on inventory
      if(form.type==='cleaning'){
        await supabase.from('inventory').update({last_cleaned:form.performed_at}).eq('id',dress.id);
      }
      toast2('Maintenance record saved');
      setShowForm(false);
      setForm({type:'cleaning',notes:'',performed_by:'',performed_at:new Date().toISOString().slice(0,10),cost:''});
      setSaving(false);
    };

    const TYPE_LABELS={cleaning:'Cleaning',repair:'Repair',inspection:'Inspection',alteration:'Alteration'};
    const TYPE_COLORS={
      cleaning:{bg:C.blueBg,col:C.blue},
      repair:{bg:C.amberBg,col:C.amber},
      inspection:{bg:C.greenBg,col:C.green},
      alteration:{bg:'#EDE9FE',col:'#7C3AED'},
    };

    return(
      <div style={{padding:'0 24px 20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:600,color:C.gray,letterSpacing:'0.08em'}}>MAINTENANCE LOG</div>
          {tableExists&&!showForm&&(
            <button onClick={()=>setShowForm(true)} style={{padding:'4px 12px',borderRadius:6,border:`1px solid ${C.rosa}`,background:'transparent',color:C.rosa,fontSize:11,fontWeight:500,cursor:'pointer'}}>+ Log entry</button>
          )}
        </div>

        {!tableExists&&(
          <div style={{fontSize:12,color:C.gray,background:C.grayBg,borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
            Maintenance log table not found.<br/>
            <span style={{fontSize:11}}>Run the migration to enable this feature.</span>
          </div>
        )}

        {tableExists&&showForm&&(
          <div style={{background:C.ivory,borderRadius:10,padding:14,marginBottom:12,display:'flex',flexDirection:'column',gap:10}}>
            <div style={{fontSize:12,fontWeight:600,color:C.ink}}>New maintenance entry</div>
            <div>
              <div style={LBL}>Type</div>
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{...inputSt,margin:0}}>
                {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div>
                <div style={LBL}>Date</div>
                <input type="date" value={form.performed_at} onChange={e=>setForm(f=>({...f,performed_at:e.target.value}))} style={{...inputSt,margin:0}}/>
              </div>
              <div>
                <div style={LBL}>Cost ($)</div>
                <input type="number" placeholder="0.00" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} style={{...inputSt,margin:0}}/>
              </div>
            </div>
            <div>
              <div style={LBL}>Performed by</div>
              <input placeholder="Staff name" value={form.performed_by} onChange={e=>setForm(f=>({...f,performed_by:e.target.value}))} style={{...inputSt,margin:0}}/>
            </div>
            <div>
              <div style={LBL}>Notes</div>
              <textarea rows={2} placeholder="Details about the work done…" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} onInput={e=>{e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px';}} style={{...inputSt,margin:0,resize:'vertical'}}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={handleSave} disabled={saving} style={{flex:1,padding:'8px',borderRadius:8,background:C.rosa,color:C.white,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,opacity:saving?0.7:1}}>{saving?'Saving…':'Save entry'}</button>
              <button onClick={()=>setShowForm(false)} style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:12}}>Cancel</button>
            </div>
          </div>
        )}

        {tableExists&&loading&&<div style={{fontSize:12,color:C.gray,textAlign:'center',padding:12}}>Loading…</div>}

        {tableExists&&!loading&&records.length===0&&!showForm&&(
          <div style={{fontSize:12,color:C.gray,textAlign:'center',padding:'12px 0'}}>No maintenance records yet</div>
        )}

        {tableExists&&records.map(r=>{
          const tc=TYPE_COLORS[r.type]||{bg:C.grayBg,col:C.gray};
          return(
            <div key={r.id} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'9px 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:600,background:tc.bg,color:tc.col,flexShrink:0,marginTop:1}}>{TYPE_LABELS[r.type]||r.type}</span>
              <div style={{flex:1,minWidth:0}}>
                {r.notes&&<div style={{fontSize:12,color:C.ink,lineHeight:1.4}}>{r.notes}</div>}
                <div style={{fontSize:10,color:C.gray,marginTop:2,display:'flex',gap:8,flexWrap:'wrap'}}>
                  <span>{r.performed_at}</span>
                  {r.performed_by&&<span>by {r.performed_by}</span>}
                  {r.cost!=null&&<span style={{color:C.ink,fontWeight:500}}>${parseFloat(r.cost).toFixed(2)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ────────────── RENDER ──────────────
  const activeCount=rented.length+reservedItems.length;
  const returnsDueCount=allDue.length;
  const hasOverdue=overdueItems.length>0;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <Topbar title="Dress rentals" subtitle={`${totalGowns} gowns · ${counts.rented+counts.overdue} rented · ${dueThisWeek} due back this week`}
        actions={<>
          <GhostBtn label="📷 Scan QR" onClick={()=>setQrOpen(true)}/>
          <GhostBtn label="↩ Log return" onClick={()=>{const allRented=[...overdueItems,...onTimeItems];if(allRented.length===1){setReturnDress(allRented[0]);}else if(allRented.length>1){setReturnSearchOpen(true);}else toast('No dresses currently rented');}}/>
          <GhostBtn label="+ Add dress" onClick={()=>setShowAddDress(true)}/>
          <PrimaryBtn label="+ New rental" onClick={()=>{setNewRentalInitDress(null);setNewRentalOpen(true);}}/>
        </>}/>

      {/* Stats bar */}
      <div style={{padding:'10px 20px',background:C.white,borderBottom:`1px solid ${C.border}`,display:'flex',gap:8,flexWrap:'wrap'}}>
        {[
          {key:'available',label:'Available',count:counts.available,col:C.green,bg:C.greenBg},
          {key:'reserved',label:'Reserved',count:counts.reserved,col:C.amber,bg:C.amberBg},
          {key:'rented',label:'Rented',count:counts.rented,col:'#DC6B7A',bg:C.redBg},
          {key:'cleaning',label:'Cleaning',count:counts.cleaning,col:C.blue,bg:C.blueBg},
          {key:'overdue',label:'Overdue',count:counts.overdue,col:C.red,bg:C.redBg},
        ].map(s=>(
          <button key={s.key} onClick={()=>tapStat(s.key)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,border:`1px solid ${s.key==='overdue'&&s.count>0?'#FCA5A5':C.border}`,background:s.count>0?s.bg:'transparent',cursor:'pointer',transition:'all 0.15s'}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.rosa} onMouseLeave={e=>e.currentTarget.style.borderColor=s.key==='overdue'&&s.count>0?'#FCA5A5':C.border}>
            <span style={{fontSize:18,fontWeight:700,color:s.count>0?s.col:C.gray}}>{s.count}</span>
            <span style={{fontSize:11,color:s.count>0?s.col:C.gray,fontWeight:s.key==='overdue'&&s.count>0?700:400}}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{padding:'0 20px',background:C.white,borderBottom:`1px solid ${C.border}`,display:'flex',gap:0}}>
        {[
          {id:'catalog',label:'Catalog'},
          {id:'active',label:'Active rentals',badge:activeCount},
          {id:'returns',label:'Returns due',badge:returnsDueCount,badgeRed:hasOverdue},
          {id:'availability',label:'📅 Availability'},
          {id:'history',label:'History'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 16px',border:'none',borderBottom:`2px solid ${tab===t.id?C.rosa:'transparent'}`,background:'transparent',color:tab===t.id?C.rosa:C.gray,fontSize:13,fontWeight:tab===t.id?600:400,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            {t.label}
            {t.badge>0&&<span style={{background:t.badgeRed?C.red:C.grayBg,color:t.badgeRed?C.white:C.gray,fontSize:10,fontWeight:600,padding:'1px 7px',borderRadius:999}}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ══════ TAB CONTENT ══════ */}
      <div className="page-scroll" style={{flex:1,overflowY:'auto'}}>

        {/* ── Catalog ── */}
        {tab==='catalog'&&(
          <div style={{padding:20}}>
            {/* Filter bar */}
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{flex:1,position:'relative',minWidth:200}}>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.gray,pointerEvents:'none',fontSize:13}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, SKU, color, size, client…" style={{...inputSt,paddingLeft:30,margin:0,width:'100%'}}/>
              </div>
              <div style={{display:'flex',gap:4}}>
                {[['all','All'],['available','Available'],['cleaning','Cleaning']].map(([s,l])=>(
                  <button key={s} onClick={()=>setStatusFilter(s)} style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${statusFilter===s?C.rosa:C.border}`,background:statusFilter===s?C.rosaPale:'transparent',color:statusFilter===s?C.rosa:C.gray,fontSize:11,fontWeight:statusFilter===s?500:400,cursor:'pointer'}}>{l}</button>
                ))}
              </div>
              <div style={{display:'flex',gap:4}}>
                {[['all','All'],['bridal','Bridal'],['quince','Quinceañera']].map(([id,l])=>(
                  <button key={id} onClick={()=>setCatFilter(id)} style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${catFilter===id?C.rosa:C.border}`,background:catFilter===id?C.rosaPale:'transparent',color:catFilter===id?C.rosa:C.gray,fontSize:11,fontWeight:catFilter===id?500:400,cursor:'pointer'}}>{l}</button>
                ))}
              </div>
              {/* View toggle */}
              <div style={{display:'flex',border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden',flexShrink:0}}>
                <button onClick={()=>setCatalogView('grid')} title="Grid view" style={{padding:'5px 10px',border:'none',background:catalogView==='grid'?C.rosaPale:'transparent',color:catalogView==='grid'?C.rosa:C.gray,cursor:'pointer',fontSize:14,lineHeight:1}}>⊞</button>
                <button onClick={()=>setCatalogView('list')} title="List view" style={{padding:'5px 10px',border:'none',borderLeft:`1px solid ${C.border}`,background:catalogView==='list'?C.rosaPale:'transparent',color:catalogView==='list'?C.rosa:C.gray,cursor:'pointer',fontSize:14,lineHeight:1}}>☰</button>
              </div>
            </div>

            {/* Nudge: rented/reserved dresses are in the Active tab */}
            {(counts.rented>0||counts.reserved>0)&&(
              <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:8,background:C.grayBg,marginBottom:12,fontSize:12,color:C.gray}}>
                <span>👗</span>
                <span>{counts.rented+counts.reserved} dress{counts.rented+counts.reserved!==1?'es':''} currently rented or reserved — view them in</span>
                <button onClick={()=>setTab('active')} style={{padding:0,border:'none',background:'none',color:C.rosa,fontWeight:600,fontSize:12,cursor:'pointer',textDecoration:'underline'}}>Active rentals →</button>
              </div>
            )}

            {/* List view header */}
            {catalogView==='list'&&catalogDresses.length>0&&(
              <div style={{display:'grid',gridTemplateColumns:'52px 1fr 1fr 100px 80px 100px auto',gap:12,padding:'6px 16px',fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>
                <div/>
                <div>Dress</div>
                <div>Details</div>
                <div>Status</div>
                <div style={{textAlign:'right'}}>Price</div>
                <div>Client / Due</div>
                <div/>
              </div>
            )}

            {/* Grid or List */}
            {catalogView==='grid'?(
              <>
                <div className="inv-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                  {paginatedCatalog.map(d=><DressCard key={d.id} d={d}/>)}
                </div>
                {catalogDresses.length>catalogPage*CATALOG_PAGE_SIZE&&(
                  <div style={{padding:'20px 0 4px',display:'flex',justifyContent:'center'}}>
                    <button onClick={()=>setCatalogPage(p=>p+1)} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 24px',background:C.white,cursor:'pointer',fontSize:13,color:C.gray}}>
                      Showing {paginatedCatalog.length} of {catalogDresses.length} dresses · Load more
                    </button>
                  </div>
                )}
              </>
            ):(
              <>
                <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden'}}>
                  {paginatedCatalog.map(d=><DressListRow key={d.id} d={d}/>)}
                </div>
                {catalogDresses.length>catalogPage*CATALOG_PAGE_SIZE&&(
                  <div style={{padding:'20px 0 4px',display:'flex',justifyContent:'center'}}>
                    <button onClick={()=>setCatalogPage(p=>p+1)} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 24px',background:C.white,cursor:'pointer',fontSize:13,color:C.gray}}>
                      Showing {paginatedCatalog.length} of {catalogDresses.length} dresses · Load more
                    </button>
                  </div>
                )}
              </>
            )}

            {catalogDresses.length===0&&(
              <div style={{textAlign:'center',padding:60,color:C.gray}}>
                <div style={{fontSize:36,marginBottom:8}}>👗</div>
                <div style={{fontSize:14,fontWeight:500,color:C.ink}}>No dresses found</div>
                <div style={{fontSize:12,marginTop:4}}>Try a different search or filter</div>
              </div>
            )}
          </div>
        )}

        {/* ── Active Rentals ── */}
        {tab==='active'&&(
          <ActiveRentalsTab
            overdueItems={overdueItems}
            onTimeItems={onTimeItems}
            reservedItems={reservedItems}
            cleaningItems={cleaningItems}
            handleMarkAvailable={handleMarkAvailable}
            RentalRow={RentalRow}
          />
        )}

        {/* ── Returns Due ── */}
        {tab==='returns'&&(
          <div>
            {/* Scanner trigger */}
            <div style={{padding:'12px 20px 0',display:'flex',justifyContent:'flex-end'}}>
              <button onClick={()=>setScannerOpen(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer'}}>
                📷 Scan to Return
              </button>
            </div>
            {allDue.length===0&&(
              <div style={{textAlign:'center',padding:60,color:C.gray}}>
                <div style={{fontSize:36,marginBottom:8}}>✓</div>
                <div style={{fontSize:14,fontWeight:500,color:C.ink}}>No returns due</div>
                <div style={{fontSize:12,marginTop:4}}>All rented dresses are still within their rental period</div>
              </div>
            )}
            {/* Overdue alert banner */}
            {overdueItems.length>0&&(
              <div style={{padding:'12px 20px',background:'#FEF2F2',border:'1px solid #FCA5A5',margin:'16px 20px 0',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:C.red}}>⚠ {overdueItems.length} overdue dress{overdueItems.length!==1?'es':''}</div>
                  <div style={{fontSize:11,color:'#B91C1C',marginTop:2}}>{overdueItems.map(d=>`${d.name} (${d.client?.name||d.client})`).join(' · ')}</div>
                </div>
                <button onClick={()=>{overdueItems.forEach(d=>toast(`Reminder sent to ${d.client?.name||d.client}`));}} style={{padding:'6px 14px',borderRadius:7,border:'1px solid #FCA5A5',background:C.white,color:C.red,fontSize:11,fontWeight:500,cursor:'pointer',flexShrink:0}}>Send all reminders</button>
              </div>
            )}
            {/* Sections */}
            <div style={{padding:'16px 0'}}>
              {overdueItems.length>0&&(
                <div style={{marginBottom:4}}>
                  <div style={{padding:'8px 20px',fontSize:11,fontWeight:700,color:C.red,letterSpacing:'0.08em'}}>OVERDUE</div>
                  {overdueItems.map(d=><ReturnRow key={d.id} d={d} urgency="overdue"/>)}
                </div>
              )}
              {dueToday.length>0&&(
                <div style={{marginBottom:4}}>
                  <div style={{padding:'8px 20px',fontSize:11,fontWeight:700,color:C.amber,letterSpacing:'0.08em'}}>DUE TODAY</div>
                  {dueToday.map(d=><ReturnRow key={d.id} d={d} urgency="today"/>)}
                </div>
              )}
              {dueThisWeekArr.length>0&&(
                <div style={{marginBottom:4}}>
                  <div style={{padding:'8px 20px',fontSize:11,fontWeight:700,color:C.ink,letterSpacing:'0.08em'}}>DUE THIS WEEK</div>
                  {dueThisWeekArr.map(d=><ReturnRow key={d.id} d={d} urgency="week"/>)}
                </div>
              )}
              {dueLater.length>0&&(
                <div>
                  <div style={{padding:'8px 20px',fontSize:11,fontWeight:700,color:C.gray,letterSpacing:'0.08em'}}>LATER</div>
                  {dueLater.map(d=><ReturnRow key={d.id} d={d} urgency="later"/>)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Availability ── */}
        {tab==='availability'&&<AvailabilityTab/>}

        {/* ── History ── */}
        {tab==='history'&&(
          <HistoryTab
            liveInventory={liveInventory}
            search={search}
            setSearch={setSearch}
            historyFilter={historyFilter}
            setHistoryFilter={setHistoryFilter}
            toast={toast}
          />
        )}
      </div>

      {/* Modals */}
      {newRentalOpen&&<NewRentalModal4Step initialDress={newRentalInitDress} onClose={()=>{setNewRentalOpen(false);setNewRentalInitDress(null);}} onSuccess={r=>{setNewRentalOpen(false);setNewRentalInitDress(null);setSuccessRental(r);}}/>}
      {successRental&&<PostRentalSuccessScreen rental={successRental} onClose={()=>setSuccessRental(null)}/>}
      {returnSearchOpen&&<LogReturnSearchModal onClose={()=>setReturnSearchOpen(false)}/>}
      {pickupDress&&<DressPickupModal dress={pickupDress} onClose={()=>setPickupDress(null)} onUpdate={(id,data)=>handlePickup(pickupDress,data)}/>}
      {returnDress&&<DressReturnModal dress={returnDress} onClose={()=>setReturnDress(null)} onUpdate={(id,data)=>handleLogReturn(returnDress,data)}/>}
      {scannerOpen&&(
        <BarcodeScanner
          onScan={(sku) => {
            setScannerOpen(false);
            const match = liveInventory.find(d =>
              d.sku === sku || d.id === sku || (d.name||'').toLowerCase() === sku.toLowerCase()
            );
            if (match) {
              if (match.status === 'rented' || match.status === 'picked_up') {
                setReturnDress(match);
              } else {
                toast(`${match.name} is not currently rented`, 'warn');
              }
            } else {
              toast(`No dress found for SKU: ${sku}`, 'warn');
            }
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
      {qrOpen&&<QRScanModal onClose={()=>setQrOpen(false)}/>}
      {detailDress&&<DetailPanel dress={detailDress} onClose={()=>{setDetailDress(null);setShowSimilar(false);setSimilarForDress(null);}}/>}
      {historyDress&&<ItemHistoryModal dress={historyDress} onClose={()=>setHistoryDress(null)}/>}
      {showAddDress&&<AddDressModal onClose={()=>setShowAddDress(false)} onCreate={async(data)=>{const res=await createDress(data);if(!res?.error){setShowAddDress(false);toast('Dress added ✓');}return res;}}/>}
      {/* Late fee inline confirm modal (Task 1) */}
      {lateFeeConfirm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1010,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:C.white,borderRadius:14,width:360,padding:24,boxShadow:'0 20px 60px rgba(0,0,0,0.18)',textAlign:'center'}}>
            <div style={{fontSize:28,marginBottom:10}}>💰</div>
            <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:6}}>Charge late return fee?</div>
            <div style={{fontSize:13,color:C.gray,marginBottom:4}}>
              {fmt(lateFeeConfirm.feeAmount)} for {lateFeeConfirm.daysLate} day{lateFeeConfirm.daysLate!==1?'s':''} late
            </div>
            <div style={{fontSize:12,color:C.gray,marginBottom:20}}>{lateFeeConfirm.item.name} — {lateFeeConfirm.item.client?.name||lateFeeConfirm.item.client||'Client'}</div>
            <div style={{display:'flex',gap:8,justifyContent:'center'}}>
              <button onClick={()=>setLateFeeConfirm(null)} style={{flex:1,padding:'9px 0',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>No</button>
              <button onClick={confirmChargeLaterFee} style={{flex:1,padding:'9px 0',borderRadius:8,border:`1px solid ${C.amber}`,background:C.amber,color:C.white,cursor:'pointer',fontSize:13,fontWeight:600}}>Yes, charge {fmt(lateFeeConfirm.feeAmount)}</button>
            </div>
          </div>
        </div>
      )}
      {damageAssessDress&&(
        <DamageAssessmentModal
          dress={damageAssessDress}
          clientName={damageAssessDress.client?.name||damageAssessDress.client||''}
          clientId={damageAssessDress.client_id||null}
          eventId={events?.find(e=>e.client_id===damageAssessDress.client_id)?.id||null}
          onClose={()=>setDamageAssessDress(null)}
          onSaved={()=>{}}
          proceedReturn={()=>{
            const d=damageAssessDress;
            setDamageAssessDress(null);
            setReturnDress(d);
          }}
        />
      )}
    </div>
  );
};


export default DressRentals;
