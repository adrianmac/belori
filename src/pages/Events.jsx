import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useSwipe } from '../hooks/useSwipe';
const EventPlanning = lazy(() => import('./EventPlanning'));
import { C, fmt, pct, SVC_LABELS, SVC_COLORS, EVT_TYPES, TYPE_SVCS,
  TYPE_DEFAULT_SVCS, COLOR_PRESETS, STYLE_OPTIONS } from '../lib/colors';
import { Avatar, Badge, Card, CardHead, Topbar, PrimaryBtn, GhostBtn, SvcTag,
  Countdown, EventTypeBadge, ProgressBar, StatusDot, AlertBanner, useToast,
  inputSt, LBL, SkeletonList } from '../lib/ui.jsx';
import { getPriorityAlert, getCountdownConfig, DRESS_TRANSITIONS,
  ALTERATION_TRANSITIONS } from '../lib/urgency';
import { useLayoutMode } from '../hooks/useLayoutMode.jsx';
import { useAuth } from '../context/AuthContext';
import { useBoutique } from '../hooks/useBoutique';
import { useEvents, useEvent } from '../hooks/useEvents';
import { usePackages } from '../hooks/usePackages';
import { useWaitlist } from '../hooks/useWaitlist';
import { useChecklistTemplates } from '../hooks/useChecklistTemplates';
import { supabase } from '../lib/supabase';

// ─── SMART TASK TEMPLATES ─────────────────────────────────────────────────
const SMART_TASKS = {
  base: [
    { text: 'Confirm event date and venue', category: 'coordination', alert: false },
    { text: 'Send contract to client', category: 'admin', alert: false },
    { text: 'Collect deposit payment', category: 'admin', alert: true },
    { text: 'Send final confirmation 1 week before', category: 'coordination', alert: true },
  ],
  dress_rental: [
    { text: 'Schedule dress fitting appointment', category: 'dress', alert: true },
    { text: 'Confirm dress pickup date with client', category: 'dress', alert: false },
    { text: 'Inspect dress condition before pickup', category: 'dress', alert: false },
    { text: 'Confirm return date after event', category: 'dress', alert: true },
  ],
  alterations: [
    { text: 'Take client measurements', category: 'alterations', alert: true },
    { text: 'Schedule alteration work with seamstress', category: 'alterations', alert: false },
    { text: 'Schedule fitting check appointment', category: 'alterations', alert: true },
    { text: 'Final alteration check 2 weeks before event', category: 'alterations', alert: true },
  ],
  decoration: [
    { text: 'Confirm decoration package and color scheme', category: 'decoration', alert: false },
    { text: 'Create decoration inventory checklist', category: 'decoration', alert: false },
    { text: 'Schedule venue walkthrough', category: 'decoration', alert: false },
    { text: 'Prepare and pack decoration items 2 days before', category: 'decoration', alert: true },
  ],
  photography: [
    { text: 'Confirm photography coverage details', category: 'coordination', alert: false },
    { text: 'Send shot list to photographer', category: 'coordination', alert: false },
  ],
  dj: [
    { text: 'Confirm music playlist and special requests with client', category: 'coordination', alert: false },
    { text: 'Coordinate DJ setup time with venue', category: 'coordination', alert: false },
  ],
  wedding: [
    { text: 'Coordinate ceremony timeline with officiant', category: 'coordination', alert: false },
    { text: 'Confirm reception venue setup time', category: 'coordination', alert: true },
  ],
  quince: [
    { text: 'Confirm waltz choreography details', category: 'coordination', alert: false },
    { text: 'Coordinate court of honor schedule', category: 'coordination', alert: false },
  ],
}

// ─── CREATE EVENT MODAL (3-step) ───────────────────────────────────────────
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function isoDate(d){return d.toISOString().split('T')[0];}
function genMilestones(type,svcs,total,eventDate){
  const today=new Date(),ev=new Date(eventDate+'T12:00:00');
  const mid=new Date((today.getTime()+ev.getTime())/2);
  const ms=type==='wedding'
    ?[{label:'Booking deposit',amount:Math.round(total*.25),due:isoDate(addDays(today,3))},
      {label:'Mid-point payment',amount:Math.round(total*.50),due:isoDate(mid)},
      {label:'Final balance',amount:Math.round(total*.25),due:isoDate(addDays(ev,-14))}]
    :[{label:'Booking deposit',amount:Math.round(total*.25),due:isoDate(addDays(today,3))},
      {label:'2nd installment',amount:Math.round(total*.25),due:isoDate(addDays(ev,-60))},
      {label:'Final balance',amount:Math.round(total*.50),due:isoDate(addDays(ev,-14))}];
  if(svcs.includes('decoration'))ms.push({label:'Decoration deposit',amount:500,due:isoDate(addDays(ev,-30))});
  return ms.map((m,i)=>({...m,id:i+1}));
}
const CreateEventModal = ({onClose,onSave,clients,inventory,defaultDate=''}) => {
  const {getStaff}=useBoutique();
  const { boutique } = useAuth();
  const { packages: allPackages } = usePackages();
  const { templates: checklistTemplates } = useChecklistTemplates();
  const [step,setStep]=useState(1);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');
  const [staff,setStaff]=useState([]);
  useEffect(()=>{getStaff().then(({data})=>{if(data?.length)setStaff(data);});},[]);
  // Step 1 — Client & event
  const [clientId,setClientId]=useState('');
  const [search,setSearch]=useState('');
  const [newMode,setNewMode]=useState(false);
  const [newCl,setNewCl]=useState({name:'',phone:'',email:''});
  const [evType,setEvType]=useState('wedding');
  const [evName,setEvName]=useState('');
  const [evDate,setEvDate]=useState(defaultDate);
  const [venue,setVenue]=useState('');
  const [guests,setGuests]=useState('');
  const [coordId,setCoordId]=useState('');
  const [autoAssigning,setAutoAssigning]=useState(false);
  // Step 4 — Inspiration & vision
  const [inspoColors,setInspoColors]=useState([]);
  const [inspoStyles,setInspoStyles]=useState([]);
  const [visionNotes,setVisionNotes]=useState('');
  const [quinceTheme,setQuinceTheme]=useState('');
  const [quinceDamas,setQuinceDamas]=useState('');
  const [quinceChamb,setQuinceChamb]=useState('');
  const [quinceWaltz,setQuinceWaltz]=useState('');
  // Step 2 — Services
  const [selectedPkgId,setSelectedPkgId]=useState(null);
  const [selectedChecklistId,setSelectedChecklistId]=useState('');
  const [svcs,setSvcs]=useState(['dress_rental','alterations','planning','decoration']);
  const [milestones,setMilestones]=useState([]);
  const [dressId,setDressId]=useState('');
  const [dressMode,setDressMode]=useState('now');
  const [altStaff,setAltStaff]=useState('');
  const [altDesc,setAltDesc]=useState('');
  const [altItems,setAltItems]=useState([]);
  const [altPrice,setAltPrice]=useState('');
  const [floralType,setFloralType]=useState('');
  // AI task suggestions
  const [aiSuggestedTasks,setAiSuggestedTasks]=useState([]);
  const [aiTasksLoading,setAiTasksLoading]=useState(false);
  const [aiTasksChecked,setAiTasksChecked]=useState({});
  const [aiTasksError,setAiTasksError]=useState(null);
  // Smart tasks (non-AI, service-based)
  const [suggestedTasks,setSuggestedTasks]=useState([]);
  const [selectedTasks,setSelectedTasks]=useState(new Set());
  const [tasksGenerated,setTasksGenerated]=useState(false);
  // Step 3 — Pricing / Quote builder
  const [lineItems,setLineItems]=useState([]);
  const [discount,setDiscount]=useState({type:'fixed',value:''});
  const [quoteExpiry,setQuoteExpiry]=useState(()=>{const d=new Date();d.setDate(d.getDate()+30);return d.toISOString().split('T')[0];});
  // AI price suggestion state
  const [aiPriceLoading,setAiPriceLoading]=useState(false);
  const [aiPriceSuggestion,setAiPriceSuggestion]=useState(null);
  // Step 5 — Venue & inventory
  const [vp,setVpRaw]=useState({tableCount:'',tableShape:'round',roundTables:'',rectTables:'',sweetheart:false,sweetheartSize:'small',chairSource:'venue',chairCount:'',chairStyle:'',clothSource:'venue',clothColor:'',clothStyle:'plain',coverSource:'venue',coverColor:'',sashes:false,sashColor:'',sashStyle:'satin',centerpieces:false,cpStyle:'',cpQty:'',arch:false,archType:'',archPlacement:'',notes:''});
  const sv=(k,v)=>setVpRaw(s=>({...s,[k]:v}));

  // Computed
  const selClient=clients.find(c=>c.id===clientId);
  const clientName=newMode?newCl.name:(selClient?.name||'');
  const searchResults=search.length>1?clients.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())).slice(0,5):[];
  const availDresses=(inventory||[]).filter(d=>d.status==='available'&&(evType==='wedding'?d.category==='bridal_gown':d.category==='quince_gown'));
  const seamstresses=staff.filter(s=>['seamstress','owner','Seamstress','Owner'].includes(s.role));
  const coordinators=staff.filter(s=>['owner','coordinator','Owner','Coordinator'].includes(s.role));
  const milestoneSum=milestones.reduce((s,m)=>s+Number(m.amount||0),0);
  // Computed quote totals
  const subtotal=lineItems.reduce((s,li)=>s+(Number(li.qty)||1)*(Number(li.unitPrice)||0),0);
  const discountAmt=discount.type==='percent'?subtotal*(Number(discount.value)||0)/100:Math.min(Number(discount.value)||0,subtotal);
  const computedTotal=Math.max(0,subtotal-discountAmt);
  const mismatch=milestones.length>0&&Math.abs(milestoneSum-computedTotal)>1;
  const dateWarn=evDate&&Math.ceil((new Date(evDate+'T12:00:00')-new Date())/86400000)<30?'⚠ Event coming up soon — schedule services right away.':null;
  const hasDeco=svcs.includes('decoration');
  const stepList=[1,2,3,4,...(hasDeco?[5]:[]),6];
  const totalSteps=stepList.length;
  const stepIdx=stepList.indexOf(step);
  const STEP_LABELS={1:'Client & event details',2:'Services',3:'Pricing & quote',4:'Inspiration & vision',5:'Venue & inventory needs',6:'Review & confirm'};

  // Effects
  useEffect(()=>{if(clientName)setEvName(clientName);},[clientId,newCl.name,evType]);
  useEffect(()=>{setSvcs(TYPE_DEFAULT_SVCS[evType]||['planning','decoration']);setFloralType('');setSelectedPkgId(null);},[evType]);
  // Line items auto-sync from selected services
  const SVC_DEFAULT_LABELS={dress_rental:'Dress rental',alterations:'Alterations & tailoring',decoration:'Decoration & florals',photography:'Photography & video',dj:'DJ / Music',planning:'Event planning'};
  useEffect(()=>{
    setLineItems(prev=>{
      const kept=prev.filter(li=>!li._svc||svcs.includes(li._svc));
      const existingSvcKeys=kept.filter(li=>li._svc).map(li=>li._svc);
      const toAdd=svcs.filter(s=>!existingSvcKeys.includes(s));
      const newLines=toAdd.map(s=>({id:Date.now()+Math.random(),_svc:s,description:SVC_DEFAULT_LABELS[s]||SVC_LABELS[s]||s,qty:1,unitPrice:''}));
      return [...kept,...newLines];
    });
  },[svcs]);
  useEffect(()=>{if(!computedTotal||!evDate||computedTotal<=0)return;setMilestones(genMilestones(evType,svcs,computedTotal,evDate));},[computedTotal,evDate,evType]);
  useEffect(()=>{
    if(!computedTotal||!evDate||!milestones.length)return;
    setMilestones(ms=>{
      const hd=svcs.includes('decoration'),has=ms.some(m=>m.label==='Decoration deposit');
      if(hd&&!has)return[...ms,{id:Date.now(),label:'Decoration deposit',amount:500,due:isoDate(addDays(new Date(evDate+'T12:00:00'),-30))}];
      if(!hd&&has)return ms.filter(m=>m.label!=='Decoration deposit');
      return ms;
    });
  },[svcs]);
  useEffect(()=>{
    if(!floralType||!milestones.length)return;
    setMilestones(ms=>ms.map(m=>m.label==='Decoration deposit'?{...m,amount:floralType==='real'?800:500}:m));
  },[floralType]);
  useEffect(()=>{if(guests&&!vp.chairCount)sv('chairCount',guests);},[guests]);
  useEffect(()=>{if(vp.tableCount&&!vp.cpQty)sv('cpQty',vp.tableCount);},[vp.tableCount]);

  const toggleSvc=s=>{setSvcs(ss=>ss.includes(s)?ss.filter(x=>x!==s):[...ss,s]);if(s==='decoration')setFloralType('');};
  const setMs=(i,k,v)=>setMilestones(ms=>ms.map((m,j)=>j===i?{...m,[k]:v}:m));

  async function autoAssignCoordinator(){
    if(!boutique?.id)return;
    setAutoAssigning(true);
    try{
      const{data:members}=await supabase.from('boutique_members').select('id,user_id,name,role').eq('boutique_id',boutique.id).in('role',['owner','coordinator','Owner','Coordinator']);
      if(!members?.length){setAutoAssigning(false);return;}
      const{data:upcomingEvents}=await supabase.from('events').select('coordinator_id').eq('boutique_id',boutique.id).in('status',['active','planning']);
      const workload={};
      for(const m of members)workload[m.user_id]=0;
      for(const ev of upcomingEvents||[]){if(ev.coordinator_id&&workload[ev.coordinator_id]!==undefined)workload[ev.coordinator_id]++;}
      const sorted=[...members].sort((a,b)=>(workload[a.user_id]||0)-(workload[b.user_id]||0));
      const best=sorted[0];
      if(best){setCoordId(best.id);setErr('');}
    }catch{/* ignore */}
    setAutoAssigning(false);
  }

  async function getAISuggestedTasks(){
    setAiTasksLoading(true);setAiTasksError(null);setAiSuggestedTasks([]);
    try{
      const{data,error}=await supabase.functions.invoke('ai-suggest',{
        body:{type:'task_suggestions',eventType:evType,clientName:clientName,eventDate:evDate,venue,services:svcs,guests:Number(guests)||0},
      });
      if(error||data?.error==='AI not configured'){setAiTasksError('AI features require setup — add ANTHROPIC_API_KEY to Supabase secrets.');setAiTasksLoading(false);return;}
      if(data?.result){
        try{
          const raw=data.result.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
          const parsed=JSON.parse(raw);
          if(Array.isArray(parsed)){
            setAiSuggestedTasks(parsed);
            const init={};parsed.forEach((_,i)=>{init[i]=true;});setAiTasksChecked(init);
          }else{setAiTasksError('AI returned unexpected format.');}
        }catch{setAiTasksError('AI returned unexpected format.');}
      }
    }catch{setAiTasksError('Could not reach AI service.');}
    setAiTasksLoading(false);
  }
  async function getAIPriceSuggestion(){
    if(!boutique?.plan||!['pro','enterprise'].includes(boutique.plan))return;
    setAiPriceLoading(true);setAiPriceSuggestion(null);
    try{
      const{data,error}=await supabase.functions.invoke('ai-suggest',{
        body:{type:'price_suggestion',eventType:evType,services:svcs,guestCount:Number(guests)||0,venue,packages:allPackages.filter(p=>p.active)},
      });
      if(error||data?.error){setAiPriceLoading(false);return;}
      if(data?.result){
        try{
          const raw=data.result.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
          const parsed=JSON.parse(raw);
          if(parsed?.suggested_price)setAiPriceSuggestion(parsed);
        }catch{/* ignore */}
      }
    }catch{/* ignore */}
    setAiPriceLoading(false);
  }

  function generateSmartTasks() {
    const tasks = [...SMART_TASKS.base]
    svcs.forEach(svc => { if (SMART_TASKS[svc]) tasks.push(...SMART_TASKS[svc]) })
    if (SMART_TASKS[evType]) tasks.push(...SMART_TASKS[evType])
    const unique = tasks.filter((t, i, arr) => arr.findIndex(x => x.text === t.text) === i)
    setSuggestedTasks(unique)
    setSelectedTasks(new Set(unique.map((_, i) => i)))
    setTasksGenerated(true)
  }

  const toggleStyle=s=>setInspoStyles(ss=>ss.includes(s)?ss.filter(x=>x!==s):ss.length>=3?ss:[...ss,s]);
  const removeColor=i=>setInspoColors(c=>c.filter((_,j)=>j!==i));

  // Validation
  function v1(){
    if(!clientId&&!newMode)return'Please select or create a client';
    if(newMode&&!newCl.name.trim())return'Client name is required';
    if(!evName.trim())return'Event name is required';
    if(!evDate)return'Event date is required';
    if(new Date(evDate+'T12:00:00')<new Date())return'Event date cannot be in the past';
    if(!coordId)return'Please assign a coordinator';
    return null;
  }
  function v2(){
    if(!svcs.length)return'Select at least one service';
    if(svcs.includes('decoration')&&!floralType)return'Select a floral arrangement type';
    return null;
  }
  function v3(){
    if(computedTotal<=0)return'Add at least one service with a price, or enter a custom line item';
    return null;
  }
  function v5(){if(hasDeco&&!vp.tableCount)return'Please enter the number of tables';return null;}

  function goNext(){
    let e=null;
    if(step===1)e=v1();else if(step===2)e=v2();else if(step===3)e=v3();else if(step===5)e=v5();
    if(e){setErr(e);return;}
    setErr('');
    const ni=stepIdx+1;if(ni<stepList.length)setStep(stepList[ni]);
  }
  function goBack(){setErr('');const pi=stepIdx-1;if(pi>=0)setStep(stepList[pi]);else onClose();}
  const isLast=stepIdx===totalSteps-1;

  async function confirm(){
    setSaving(true);
    const checkedAiTasks=aiSuggestedTasks.filter((_,i)=>aiTasksChecked[i]);
    const{error,data:createdEvent}=await onSave({client_id:newMode?null:clientId,isNewClient:newMode,newClientData:newMode?newCl:null,type:evType,event_name:evName,event_date:evDate,venue,guests:Number(guests)||0,coordinator_id:coordId||null,total:computedTotal,paid:0,status:'active',services:svcs,milestones,dress_id:dressMode==='now'?dressId:null,alterationData:svcs.includes('alterations')?{seamstress_id:altStaff,garment:altDesc,items:altItems,price:Number(altPrice)||0}:null,inspiration_colors:inspoColors,inspiration_styles:inspoStyles,inspiration_notes:visionNotes||null,quince_theme:quinceTheme||null,quince_waltz_song:quinceWaltz||null,quince_cort_size_damas:quinceDamas?Number(quinceDamas):null,quince_cort_size_chambelanes:quinceChamb?Number(quinceChamb):null,venue_plan:hasDeco?vp:null,package_id:selectedPkgId||null,aiTasks:checkedAiTasks.length>0?checkedAiTasks:undefined});
    if(!error&&createdEvent?.id){
      await supabase.from('quotes').insert({boutique_id:boutique.id,event_id:createdEvent.id,client_name:clientName,event_type:evType,event_date:evDate,venue:venue||null,expires_at:quoteExpiry||null,line_items:lineItems.map(li=>({description:li.description,qty:Number(li.qty)||1,unit_price:Number(li.unitPrice)||0})),milestones:milestones.map(m=>({label:m.label,amount:Number(m.amount)||0,due_date:m.due})),discount_type:discount.type,discount_value:Number(discount.value)||0,total:computedTotal,status:'draft'}).catch(()=>{});
    }
    if(!error&&createdEvent?.id&&selectedChecklistId){
      const tmpl=checklistTemplates.find(t=>t.id===selectedChecklistId);
      if(tmpl?.items?.length){
        const rows=tmpl.items.filter(it=>it.text?.trim()).map(it=>({
          boutique_id:boutique.id,
          event_id:createdEvent.id,
          text:it.text,
          category:it.category||'General',
          alert:it.is_alert||false,
          done:false,
        }));
        if(rows.length)await supabase.from('tasks').insert(rows).catch(()=>{});
      }
    }
    if(!error&&createdEvent?.id&&tasksGenerated&&selectedTasks.size>0){
      const tasksToInsert=suggestedTasks
        .filter((_,i)=>selectedTasks.has(i))
        .map(t=>({boutique_id:boutique.id,event_id:createdEvent.id,text:t.text,category:t.category,alert:t.alert,done:false}));
      if(tasksToInsert.length)await supabase.from('tasks').insert(tasksToInsert).catch(()=>{});
    }
    setSaving(false);if(!error)onClose();else setErr(error.message||'Failed to create event');
  }

  // Shared chip style helper
  const chip=(sel)=>({padding:'5px 10px',borderRadius:999,border:`1px solid ${sel?C.rosa:C.border}`,background:sel?C.rosaPale:C.white,color:sel?C.rosa:C.gray,cursor:'pointer',fontSize:11,minHeight:'unset',transition:'all 0.15s'});
  const radioRow={display:'flex',alignItems:'center',gap:6,marginBottom:4,cursor:'pointer',fontSize:12,color:C.ink};
  const sectionBox={border:`1px solid ${C.border}`,borderRadius:10,padding:14};

  return(
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:C.white,borderRadius:16,width:'100%',maxWidth:640,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 60px rgba(0,0,0,0.18)'}}>
        {/* Header + stepper */}
        <div style={{padding:'16px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:500,color:C.ink}}>New event</span>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            {stepList.map((s,i)=><div key={s} style={{height:8,borderRadius:4,background:i<stepIdx?'var(--color-success)':s===step?'var(--color-primary)':C.border,width:s===step?28:8,transition:'all 0.2s'}}/>)}
            <span style={{fontSize:11,color:C.gray,marginLeft:4}}>Step {stepIdx+1} of {totalSteps}</span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:22,lineHeight:1,padding:2,minHeight:'unset',minWidth:'unset'}}>×</button>
        </div>
        <div style={{padding:'7px 24px',background:C.ivory,borderBottom:`1px solid ${C.border}`,fontSize:12,color:C.gray,flexShrink:0}}>
          {STEP_LABELS[step]}
        </div>
        {err&&<div style={{padding:'8px 24px',background:'var(--bg-danger)',color:'var(--color-danger)',fontSize:13,flexShrink:0}}>{err}</div>}

        {/* ══════ STEP 1 — Client & Event ══════ */}
        {step===1&&(
          <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <div style={LBL}>Client *</div>
              {selClient?(
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderRadius:8,border:`1px solid ${C.rosa}`,background:C.rosaPale}}>
                  <div><span style={{fontWeight:500,color:C.ink}}>{selClient.name}</span>{selClient.phone&&<span style={{fontSize:12,color:C.gray,marginLeft:8}}>{selClient.phone}</span>}</div>
                  <button onClick={()=>{setClientId('');setSearch('');}} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:6,padding:'3px 8px',fontSize:11,cursor:'pointer',color:C.gray,minHeight:'unset'}}>Change</button>
                </div>
              ):newMode?(
                <div style={{border:`1px solid ${C.border}`,borderRadius:8,padding:12,display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.gray}}>New client</div>
                  <input value={newCl.name} onChange={e=>setNewCl(n=>({...n,name:e.target.value}))} placeholder="Full name *" style={inputSt}/>
                  <input value={newCl.phone} onChange={e=>setNewCl(n=>({...n,phone:e.target.value}))} placeholder="Phone" style={inputSt}/>
                  <input value={newCl.email} onChange={e=>setNewCl(n=>({...n,email:e.target.value}))} placeholder="Email (optional)" style={inputSt}/>
                  <button onClick={()=>setNewMode(false)} style={{background:'none',border:'none',color:C.gray,fontSize:12,cursor:'pointer',textAlign:'left',padding:0,minHeight:'unset'}}>← Back to search</button>
                </div>
              ):(
                <div style={{position:'relative'}}>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search existing clients…" style={inputSt}/>
                  {searchResults.length>0&&(
                    <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:'0 4px 12px rgba(0,0,0,0.08)',zIndex:10}}>
                      {searchResults.map(cl=>(
                        <div key={cl.id} onClick={()=>{setClientId(cl.id);setSearch('');}} style={{padding:'10px 14px',cursor:'pointer',display:'flex',justifyContent:'space-between'}} onMouseEnter={e=>e.currentTarget.style.background=C.ivory} onMouseLeave={e=>e.currentTarget.style.background=''}>
                          <span style={{fontWeight:500,color:C.ink}}>{cl.name}</span><span style={{fontSize:12,color:C.gray}}>{cl.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {search.length>1&&!searchResults.length&&(
                    <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',zIndex:10}}>
                      <div style={{fontSize:13,color:C.gray,marginBottom:6}}>No client found</div>
                      <button onClick={()=>{setNewMode(true);setNewCl({name:search,phone:'',email:''});setSearch('');}} style={{color:'var(--color-primary)',background:'none',border:'none',cursor:'pointer',fontWeight:500,fontSize:13,padding:0,minHeight:'unset'}}>+ Create "{search}" as new client</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <div style={LBL}>Event type</div>
              <div className="type-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                {Object.entries(EVT_TYPES).map(([v,t])=>(
                  <button key={v} onClick={()=>setEvType(v)} style={{padding:'10px 4px',borderRadius:8,border:`2px solid ${evType===v?t.col:C.border}`,background:evType===v?t.bg:C.white,color:evType===v?t.col:C.gray,cursor:'pointer',fontWeight:evType===v?600:400,fontSize:11,minHeight:56,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,transition:'all 0.15s'}}>
                    <span style={{fontSize:18,lineHeight:1}}>{t.icon}</span>
                    <span style={{textAlign:'center',lineHeight:1.2}}>{t.label}</span>
                  </button>
                ))}
              </div>
              <div style={{marginTop:8,padding:'8px 12px',background:EVT_TYPES[evType]?.bg||C.grayBg,borderRadius:8,display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:11,color:C.gray,flexShrink:0}}>Services suggested:</span>
                {(TYPE_DEFAULT_SVCS[evType]||[]).map(s=>(
                  <span key={s} style={{fontSize:11,fontWeight:500,color:EVT_TYPES[evType]?.col||C.ink,background:'rgba(255,255,255,0.7)',padding:'2px 8px',borderRadius:999}}>{SVC_LABELS[s]||s}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={LBL}>Event name *</div>
              <input value={evName} onChange={e=>setEvName(e.target.value)} placeholder="e.g. Sophia & Rafael Rodriguez" style={inputSt} maxLength={80}/>
            </div>
            <div>
              <div style={LBL}>Event date *</div>
              <input type="date" value={evDate} onChange={e=>setEvDate(e.target.value)} style={inputSt}/>
              {dateWarn&&<div style={{fontSize:12,color:'var(--color-warning)',marginTop:4}}>{dateWarn}</div>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 90px',gap:12}}>
              <div><div style={LBL}>Venue / location</div><input value={venue} onChange={e=>setVenue(e.target.value)} placeholder="e.g. St. Anthony's Chapel" style={inputSt}/></div>
              <div><div style={LBL}>Guests</div><input type="number" value={guests} onChange={e=>setGuests(e.target.value)} placeholder="0" min="1" max="2000" style={inputSt}/></div>
            </div>
            <div>
              <div style={LBL}>Assigned coordinator *</div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <select value={coordId} onChange={e=>setCoordId(e.target.value)} style={{...inputSt,flex:1}}>
                  <option value="">Select coordinator…</option>
                  {coordinators.map(s=><option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
                </select>
                <button
                  type="button"
                  onClick={autoAssignCoordinator}
                  disabled={autoAssigning}
                  title="Auto-assign least-busy coordinator"
                  style={{flexShrink:0,padding:'0 12px',height:38,borderRadius:8,border:`1px solid ${C.border}`,background:C.grayBg,color:C.gray,fontSize:11,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',minHeight:'unset',opacity:autoAssigning?0.6:1}}
                >
                  {autoAssigning?'…':'Auto-assign'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ STEP 2 — Services ══════ */}
        {step===2&&(
          <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:20}}>

            {/* ── Services with inline config ── */}
            <div>
              <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:4}}>
                <div style={LBL}>Services</div>
                <span style={{fontSize:11,color:C.gray}}>Tap to toggle · details expand when included</span>
              </div>
              {[['dress_rental','👗','Dress rental','Reserve a gown from inventory'],['alterations','✂️','Alterations','Hem, bustle, seamstress work'],['decoration','🌸','Decoration','Setup, florals, venue styling'],['photography','📷','Photography','Photo & video coverage'],['dj','🎵','DJ / Music','Sound system & entertainment']]
                .filter(([id])=>(TYPE_SVCS[evType]||Object.keys(SVC_LABELS)).includes(id))
                .map(([id,icon,lbl,desc])=>{
                  const isOn=svcs.includes(id);
                  const expandBorder=`2px solid ${C.rosa}`;
                  return (
                    <div key={id} style={{marginBottom:8}}>
                      <button onClick={()=>toggleSvc(id)} style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'11px 14px',borderRadius:isOn?'10px 10px 0 0':10,border:`2px solid ${isOn?C.rosa:C.border}`,background:isOn?C.rosaPale:C.white,cursor:'pointer',textAlign:'left',transition:'all 0.15s',minHeight:'unset'}}>
                        <span style={{fontSize:18,flexShrink:0,opacity:isOn?1:0.5}}>{icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:500,color:isOn?C.rosa:C.ink}}>{lbl}</div>
                          <div style={{fontSize:11,color:C.gray,marginTop:1}}>{desc}</div>
                        </div>
                        <div style={{width:20,height:20,borderRadius:'50%',background:isOn?C.rosa:C.white,border:`2px solid ${isOn?C.rosa:C.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
                          {isOn&&<span style={{color:'#fff',fontSize:11,fontWeight:700,lineHeight:1}}>✓</span>}
                        </div>
                      </button>
                      {isOn&&id==='dress_rental'&&(
                        <div style={{border:expandBorder,borderTop:'none',borderRadius:'0 0 10px 10px',padding:'12px 14px',background:'rgba(253,245,246,0.6)',display:'flex',flexDirection:'column',gap:8}}>
                          <div style={{fontSize:11,color:C.rosa,fontWeight:500}}>Dress reservation</div>
                          <div style={{display:'flex',gap:6}}>
                            {[['now','Reserve now'],['later','Reserve later']].map(([v,l])=>(
                              <button key={v} onClick={()=>setDressMode(v)} style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${dressMode===v?C.rosa:C.border}`,background:dressMode===v?C.rosaPale:'transparent',color:dressMode===v?C.rosa:C.gray,cursor:'pointer',fontSize:12,minHeight:'unset'}}>{l}</button>
                            ))}
                          </div>
                          {dressMode==='now'?(availDresses.length===0
                            ?<div style={{fontSize:12,color:'var(--color-warning)'}}>No {evType==='wedding'?'bridal':'quinceañera'} gowns available — a task will be created to reserve later.</div>
                            :<select value={dressId} onChange={e=>setDressId(e.target.value)} style={inputSt}>
                              <option value="">Select available dress…</option>
                              {availDresses.map(d=><option key={d.id} value={d.id}>#{d.sku} · {d.name} · Size {d.size} · {d.color} · {fmt(d.price)}/rental</option>)}
                            </select>
                          ):<div style={{fontSize:12,color:C.gray,padding:'6px 0'}}>✓ Task auto-created: "Reserve dress for {clientName||'client'}"</div>}
                        </div>
                      )}
                      {isOn&&id==='alterations'&&(
                        <div style={{border:expandBorder,borderTop:'none',borderRadius:'0 0 10px 10px',padding:'12px 14px',background:'rgba(253,245,246,0.6)',display:'flex',flexDirection:'column',gap:8}}>
                          <div style={{fontSize:11,color:C.rosa,fontWeight:500}}>Alteration details <span style={{color:C.gray,fontWeight:400}}>(all optional — can fill in later)</span></div>
                          <select value={altStaff} onChange={e=>setAltStaff(e.target.value)} style={inputSt}>
                            <option value="">Assign seamstress…</option>
                            {seamstresses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <input value={altDesc} onChange={e=>setAltDesc(e.target.value)} placeholder="Garment (e.g. Bridal gown + 2 bridesmaid dresses)" style={inputSt}/>
                          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                            {['Hem','Bustle','Waist take-in','Let out waist','Custom beading','Sleeves','Other'].map(item=>(
                              <button key={item} onClick={()=>setAltItems(ai=>ai.includes(item)?ai.filter(x=>x!==item):[...ai,item])} style={chip(altItems.includes(item))}>{item}</button>
                            ))}
                          </div>
                          <input type="number" value={altPrice} onChange={e=>setAltPrice(e.target.value)} placeholder="Estimated price ($)" style={inputSt}/>
                        </div>
                      )}
                      {isOn&&id==='decoration'&&(
                        <div style={{border:expandBorder,borderTop:'none',borderRadius:'0 0 10px 10px',padding:'12px 14px',background:'rgba(253,245,246,0.6)',display:'flex',flexDirection:'column',gap:8}}>
                          <div style={{fontSize:11,color:C.rosa,fontWeight:500}}>Floral arrangement <span style={{color:C.gray,fontWeight:400}}>· affects deposit amount</span></div>
                          {[['real','🌸 Real flowers','Natural blooms, seasonal · Deposit $800'],['silk','🎀 Silk / artificial','Always available, no wilt · Deposit $500']].map(([v,l,d])=>(
                            <button key={v} onClick={()=>setFloralType(v)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,border:`1.5px solid ${floralType===v?C.rosa:C.border}`,background:floralType===v?C.rosaPale:C.white,cursor:'pointer',textAlign:'left',transition:'all 0.15s',minHeight:'unset'}}>
                              <div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${floralType===v?C.rosa:C.borderDark}`,background:floralType===v?C.rosa:'transparent',flexShrink:0,transition:'all 0.15s'}}/>
                              <div>
                                <div style={{fontSize:12,fontWeight:floralType===v?500:400,color:floralType===v?C.rosa:C.ink}}>{l}</div>
                                <div style={{fontSize:10,color:C.gray,marginTop:1}}>{d}</div>
                              </div>
                            </button>
                          ))}
                          {!floralType&&<div style={{fontSize:11,color:C.amber}}>⚠ Select a floral type to confirm the deposit amount</div>}
                          <div style={{padding:'7px 10px',background:'var(--bg-warning)',borderRadius:6,fontSize:11,color:'var(--color-warning)'}}>
                            Venue & linen details collected in step 5
                          </div>
                          {inspoColors.length>0&&(
                            <div style={{padding:'7px 10px',background:'var(--bg-primary)',borderRadius:6,fontSize:11,color:'var(--color-primary)'}}>
                              {inspoColors.map(c=>c.label).join(', ')} palette detected — matching linens will be suggested
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              }
              {/* Wedding Planner — locked add-on teaser */}
              <div style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'11px 14px',borderRadius:10,border:`2px dashed ${C.border}`,background:C.grayBg,opacity:0.8}}>
                <span style={{fontSize:18,flexShrink:0,opacity:0.4}}>📋</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:C.gray}}>Wedding Planner</div>
                  <div style={{fontSize:11,color:C.gray,marginTop:1}}>Full timeline, vendors & run-of-show — coming soon</div>
                </div>
                <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:999,background:'#F3F4F6',color:C.gray,whiteSpace:'nowrap',letterSpacing:'0.03em'}}>Add-on</span>
              </div>
            </div>

            {/* ── Package picker + Checklist ── */}
            {(()=>{
              const pkgs=allPackages.filter(p=>p.active&&(p.event_type==='both'||p.event_type===evType));
              const clTmpls=checklistTemplates.filter(t=>t.event_type==='both'||t.event_type===evType);
              if(!pkgs.length&&!clTmpls.length) return null;
              return (
                <div style={{padding:14,borderRadius:10,border:`1px solid ${C.border}`,background:C.grayBg,display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.gray,letterSpacing:'0.05em',textTransform:'uppercase'}}>Optional</div>
                  {pkgs.length>0&&(
                    <div>
                      <div style={{fontSize:12,color:C.inkMid,marginBottom:8,fontWeight:500}}>Start from a package</div>
                      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4,scrollbarWidth:'none'}}>
                        {pkgs.map(pkg=>{
                          const sel=selectedPkgId===pkg.id;
                          return (
                            <button key={pkg.id} onClick={()=>{
                              if(sel){setSelectedPkgId(null);}
                              else{setSelectedPkgId(pkg.id);setSvcs(pkg.services||[]);setFloralType('');}
                            }} style={{flexShrink:0,padding:'10px 14px',borderRadius:10,border:`2px solid ${sel?C.rosa:C.border}`,background:sel?C.rosaPale:C.white,cursor:'pointer',textAlign:'left',minWidth:150,maxWidth:190,transition:'all 0.15s',minHeight:'unset'}}>
                              <div style={{fontSize:12,fontWeight:600,color:sel?C.rosa:C.ink,marginBottom:2}}>{pkg.name}</div>
                              <div style={{fontSize:13,fontWeight:700,color:sel?C.rosa:'#16a34a',marginBottom:5}}>{fmt(pkg.base_price)}</div>
                              <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                                {(pkg.services||[]).map(s=><span key={s} style={{fontSize:10,padding:'2px 5px',borderRadius:999,background:sel?'rgba(201,105,122,0.15)':C.border,color:sel?C.rosa:C.gray}}>{SVC_LABELS[s]||s}</span>)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {selectedPkgId&&<div style={{fontSize:11,color:C.rosa,marginTop:4}}>✓ Package applied — services pre-filled</div>}
                    </div>
                  )}
                  {clTmpls.length>0&&(
                    <div>
                      <div style={{fontSize:12,color:C.inkMid,marginBottom:6,fontWeight:500}}>Checklist template</div>
                      <select value={selectedChecklistId} onChange={e=>setSelectedChecklistId(e.target.value)} style={inputSt}>
                        <option value="">None — skip</option>
                        {clTmpls.map(t=>(
                          <option key={t.id} value={t.id}>{t.name} ({(t.items||[]).length} items)</option>
                        ))}
                      </select>
                      {selectedChecklistId&&<div style={{fontSize:11,color:C.rosa,marginTop:4}}>✓ Checklist tasks will be added on creation</div>}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════ STEP 3 — Pricing & Quote ══════ */}
        {step===3&&(
          <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:20}}>

            {/* Quote expiry */}
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{flex:1}}>
                <div style={LBL}>Quote valid until</div>
                <input type="date" value={quoteExpiry} onChange={e=>setQuoteExpiry(e.target.value)} style={inputSt}/>
              </div>
            </div>

            {/* Line items table */}
            <div>
              <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8}}>
                <div style={LBL}>Services & pricing</div>
                <span style={{fontSize:11,color:C.gray}}>Edit descriptions and enter prices for each service</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 60px 110px 28px',gap:5,marginBottom:4}}>
                <span style={{fontSize:11,color:C.gray,fontWeight:600}}>Description</span>
                <span style={{fontSize:11,color:C.gray,fontWeight:600}}>Qty</span>
                <span style={{fontSize:11,color:C.gray,fontWeight:600}}>Unit price</span>
                <span/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {lineItems.map((li,i)=>(
                  <div key={li.id} style={{display:'grid',gridTemplateColumns:'1fr 60px 110px 28px',gap:5,alignItems:'center'}}>
                    <div style={{position:'relative'}}>
                      <input
                        value={li.description}
                        onChange={e=>setLineItems(prev=>prev.map((x,j)=>j===i?{...x,description:e.target.value}:x))}
                        placeholder="Description…"
                        style={{...inputSt,fontSize:12,paddingLeft:li._svc?22:undefined}}
                      />
                      {li._svc&&(
                        <span style={{position:'absolute',left:7,top:'50%',transform:'translateY(-50%)',fontSize:11}}>
                          {li._svc==='dress_rental'?'👗':li._svc==='alterations'?'✂️':li._svc==='decoration'?'🌸':li._svc==='photography'?'📷':li._svc==='dj'?'🎵':'•'}
                        </span>
                      )}
                    </div>
                    <input type="number" value={li.qty} min="1" onChange={e=>setLineItems(prev=>prev.map((x,j)=>j===i?{...x,qty:e.target.value}:x))} style={{...inputSt,fontSize:12}}/>
                    <input type="number" value={li.unitPrice} placeholder="0.00" min="0" step="0.01" onChange={e=>setLineItems(prev=>prev.map((x,j)=>j===i?{...x,unitPrice:e.target.value}:x))} style={{...inputSt,fontSize:12}}/>
                    <button onClick={()=>setLineItems(prev=>prev.filter((_,j)=>j!==i))} disabled={lineItems.length<=1} aria-label="Remove line" style={{background:'none',border:'none',color:C.gray,cursor:'pointer',fontSize:16,padding:0,minHeight:'unset',minWidth:'unset',opacity:lineItems.length<=1?0.3:1}}>×</button>
                  </div>
                ))}
              </div>
              <button onClick={()=>setLineItems(prev=>[...prev,{id:Date.now(),description:'',qty:1,unitPrice:''}])} style={{marginTop:8,fontSize:12,color:C.rosa,background:'none',border:'none',cursor:'pointer',fontWeight:500,padding:0,minHeight:'unset'}}>+ Add custom line item</button>
            </div>

            {/* Totals */}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14}}>
              {/* Discount */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <span style={{fontSize:12,color:C.gray,flex:1}}>Discount</span>
                <div style={{display:'flex',gap:4}}>
                  {[['fixed','$'],['percent','%']].map(([v,l])=>(
                    <button key={v} onClick={()=>setDiscount(d=>({...d,type:v}))}
                      style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${discount.type===v?C.rosa:C.border}`,background:discount.type===v?C.rosaPale:C.white,color:discount.type===v?C.rosa:C.gray,cursor:'pointer',fontSize:12,minHeight:'unset'}}>
                      {l}
                    </button>
                  ))}
                </div>
                <input type="number" value={discount.value} onChange={e=>setDiscount(d=>({...d,value:e.target.value}))} placeholder="0" min="0" style={{...inputSt,width:90,fontSize:12}}/>
              </div>
              {/* Summary */}
              <div style={{display:'flex',flexDirection:'column',gap:4,background:C.grayBg,borderRadius:8,padding:'10px 14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.gray}}>
                  <span>Subtotal</span><span>{fmt(subtotal)}</span>
                </div>
                {discountAmt>0&&(
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.amber}}>
                    <span>Discount{discount.type==='percent'?` (${discount.value}%)`:''}</span>
                    <span>− {fmt(discountAmt)}</span>
                  </div>
                )}
                <div style={{display:'flex',justifyContent:'space-between',fontSize:15,fontWeight:700,color:C.ink,borderTop:`1px solid ${C.border}`,paddingTop:6,marginTop:4}}>
                  <span>Total</span><span>{fmt(computedTotal)}</span>
                </div>
              </div>
              {/* AI price suggestion */}
              {boutique?.plan&&['pro','enterprise'].includes(boutique.plan)&&(
                <button type="button" onClick={getAIPriceSuggestion} disabled={aiPriceLoading||!svcs.length}
                  style={{marginTop:10,fontSize:11,padding:'4px 12px',borderRadius:6,border:`1px solid ${C.rosa}`,background:C.rosaPale,color:C.rosa,cursor:'pointer',fontWeight:500,minHeight:'unset',opacity:aiPriceLoading||!svcs.length?0.6:1}}>
                  {aiPriceLoading?'✨ Thinking…':'✨ AI price suggestion'}
                </button>
              )}
              {aiPriceSuggestion&&(
                <div style={{marginTop:8,padding:'12px 14px',borderRadius:10,border:`1px solid ${C.rosa}`,background:C.rosaPale,display:'flex',flexDirection:'column',gap:6}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    <span style={{fontSize:20,fontWeight:600,color:C.ink}}>${aiPriceSuggestion.suggested_price?.toLocaleString()}</span>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:999,background:{high:'#D1FAE5',medium:'#FEF3C7',low:'#FEE2E2'}[aiPriceSuggestion.confidence]||C.grayBg,color:{high:'#065F46',medium:'#92400E',low:'#991B1B'}[aiPriceSuggestion.confidence]||C.gray,fontWeight:600}}>{aiPriceSuggestion.confidence}</span>
                  </div>
                  <div style={{fontSize:12,color:C.inkMid}}>{aiPriceSuggestion.reasoning}</div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>{
                      const suggested=aiPriceSuggestion.suggested_price;
                      const n=lineItems.length;
                      if(n===1){setLineItems(prev=>prev.map((li,i)=>i===0?{...li,unitPrice:String(suggested)}:li));}
                      else{const perItem=Math.round(suggested/n);setLineItems(prev=>prev.map(li=>({...li,unitPrice:String(perItem)})));}
                      setAiPriceSuggestion(null);
                    }} style={{fontSize:12,padding:'5px 12px',borderRadius:7,border:'none',background:C.rosa,color:C.white,cursor:'pointer',fontWeight:600,minHeight:'unset'}}>Apply →</button>
                    <button onClick={()=>setAiPriceSuggestion(null)} style={{fontSize:12,padding:'5px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.gray,cursor:'pointer',minHeight:'unset'}}>Dismiss</button>
                  </div>
                </div>
              )}
            </div>

            {/* Payment milestones */}
            {milestones.length>0&&(
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontSize:12,color:C.gray,fontWeight:500}}>Payment milestones</div>
                  <button onClick={()=>setMilestones(genMilestones(evType,svcs,computedTotal,evDate))}
                    style={{fontSize:11,color:C.rosa,background:'none',border:'none',cursor:'pointer',minHeight:'unset'}}>↺ Recalculate</button>
                </div>
                {mismatch&&<div style={{fontSize:12,color:C.amber,background:C.amberBg,padding:'6px 10px',borderRadius:6,marginBottom:8}}>Milestones total {fmt(milestoneSum)} — should equal {fmt(computedTotal)}</div>}
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {milestones.map((m,i)=>(
                    <div key={m.id||i} style={{display:'grid',gridTemplateColumns:'1fr 90px 130px 28px',gap:5,alignItems:'center'}}>
                      <input value={m.label} onChange={e=>setMs(i,'label',e.target.value)} style={{...inputSt,fontSize:12}}/>
                      <input type="number" value={m.amount} onChange={e=>setMs(i,'amount',e.target.value)} placeholder="$0" style={{...inputSt,fontSize:12}}/>
                      <input type="date" value={m.due} onChange={e=>setMs(i,'due',e.target.value)} style={{...inputSt,fontSize:12}}/>
                      <button onClick={()=>setMilestones(ms=>ms.filter((_,j)=>j!==i))} disabled={milestones.length<=1}
                        style={{background:'none',border:'none',color:C.gray,cursor:'pointer',fontSize:16,padding:0,minHeight:'unset',minWidth:'unset',opacity:milestones.length<=1?0.3:1}}>×</button>
                    </div>
                  ))}
                  <button onClick={()=>setMilestones(ms=>[...ms,{id:Date.now(),label:'',amount:'',due:''}])}
                    style={{alignSelf:'flex-start',fontSize:12,color:C.rosa,background:'none',border:'none',cursor:'pointer',fontWeight:500,padding:0,minHeight:'unset'}}>+ Add milestone</button>
                </div>
              </div>
            )}
            {computedTotal>0&&milestones.length===0&&evDate&&(
              <button onClick={()=>setMilestones(genMilestones(evType,svcs,computedTotal,evDate))}
                style={{alignSelf:'flex-start',fontSize:12,color:C.rosa,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',fontWeight:500,minHeight:'unset'}}>
                Generate payment milestones
              </button>
            )}

            {/* Smart task checklist */}
            <div style={{marginTop:4,borderTop:`1px solid ${C.border}`,paddingTop:16}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.ink}}>✨ Smart Checklist</div>
                  <div style={{fontSize:11,color:C.gray,marginTop:1}}>Auto-generated tasks based on your services</div>
                </div>
                {!tasksGenerated
                  ?<button onClick={generateSmartTasks} style={{fontSize:12,padding:'6px 14px',borderRadius:8,border:`1px solid ${C.rosa}`,background:C.rosaPale,color:C.rosa,cursor:'pointer',fontWeight:500,minHeight:'unset'}}>Generate tasks</button>
                  :<button onClick={()=>{setTasksGenerated(false);setSuggestedTasks([]);}} style={{fontSize:11,color:C.gray,background:'none',border:'none',cursor:'pointer',minHeight:'unset'}}>Reset</button>
                }
              </div>
              {tasksGenerated&&suggestedTasks.length>0&&(
                <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:200,overflowY:'auto'}}>
                  {suggestedTasks.map((task,i)=>(
                    <label key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,background:selectedTasks.has(i)?C.rosaPale:'transparent',border:`1px solid ${selectedTasks.has(i)?C.petal:C.border}`,cursor:'pointer'}}>
                      <input type="checkbox" checked={selectedTasks.has(i)} onChange={e=>{
                        setSelectedTasks(prev=>{const n=new Set(prev);e.target.checked?n.add(i):n.delete(i);return n;});
                      }} style={{accentColor:C.rosa,flexShrink:0}}/>
                      <span style={{fontSize:12,color:C.ink,flex:1}}>{task.text}</span>
                      {task.alert&&<span style={{fontSize:9,padding:'2px 6px',borderRadius:999,background:C.redBg,color:C.red,fontWeight:600}}>ALERT</span>}
                    </label>
                  ))}
                  <div style={{fontSize:11,color:C.gray,paddingTop:4}}>{selectedTasks.size} of {suggestedTasks.length} tasks selected</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ STEP 4 — Inspiration & Vision ══════ */}
        {step===4&&(
          <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:16}}>
            <div style={{fontSize:13,color:C.inkMid}}>Tell us about {clientName||'the client'}'s vision</div>
            <div style={{fontSize:11,color:C.gray,marginTop:-10}}>This helps your team stay aligned on the look and feel of the event.</div>

            {/* Color palette */}
            <div>
              <div style={LBL}>Event color palette <span style={{fontWeight:400}}>(up to 6)</span></div>
              {inspoColors.length>0&&(
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                  {inspoColors.map((c,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:4,background:C.grayBg,borderRadius:999,padding:'4px 10px 4px 4px'}}>
                      <div style={{width:20,height:20,borderRadius:'50%',background:c.hex,border:'1px solid rgba(0,0,0,0.1)',flexShrink:0}}/>
                      <span style={{fontSize:11,color:C.ink}}>{c.label}</span>
                      <button onClick={()=>removeColor(i)} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:C.gray,padding:0,marginLeft:2,minHeight:'unset',minWidth:'unset',lineHeight:1}}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{fontSize:11,color:C.gray,marginBottom:6}}>Quick presets:</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {COLOR_PRESETS.map(p=>(
                  <button key={p.name} onClick={()=>setInspoColors(p.colors.slice(0,6))} style={{padding:'5px 10px',borderRadius:999,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontSize:11,color:C.ink,minHeight:'unset',display:'flex',alignItems:'center',gap:4}}>
                    {p.colors.slice(0,3).map((c,i)=><div key={i} style={{width:10,height:10,borderRadius:'50%',background:c.hex,border:'0.5px solid rgba(0,0,0,0.15)'}}/>)}
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Style chips */}
            <div>
              <div style={LBL}>Event style <span style={{fontWeight:400}}>(up to 3)</span></div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {STYLE_OPTIONS.map(s=>(
                  <button key={s} onClick={()=>toggleStyle(s)} style={chip(inspoStyles.includes(s))}>{s}</button>
                ))}
              </div>
            </div>

            {/* Vision notes */}
            <div>
              <div style={LBL}>Vision notes <span style={{fontWeight:400}}>(optional)</span></div>
              <textarea value={visionNotes} onChange={e=>setVisionNotes(e.target.value)} placeholder="Anything about the client's vision — specific flowers, must-have moments, things to avoid, special traditions…" maxLength={500} style={{...inputSt,minHeight:80,resize:'vertical',fontFamily:'inherit'}}/>
              <div style={{fontSize:11,color:C.gray,textAlign:'right'}}>{visionNotes.length}/500</div>
            </div>

            {/* Quinceañera-specific */}
            {evType==='quince'&&(
              <div style={{border:`1px solid var(--color-accent)`,borderRadius:10,padding:14,background:'var(--bg-accent)'}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--color-accent)',marginBottom:10}}>Quinceañera details</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <input value={quinceTheme} onChange={e=>setQuinceTheme(e.target.value)} placeholder='Theme — e.g. "Under the stars", "Enchanted garden"' style={inputSt}/>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div><div style={{fontSize:11,color:C.gray,marginBottom:3}}>Chambelanes</div><input type="number" value={quinceChamb} onChange={e=>setQuinceChamb(e.target.value)} placeholder="0" min="0" style={inputSt}/></div>
                    <div><div style={{fontSize:11,color:C.gray,marginBottom:3}}>Damas</div><input type="number" value={quinceDamas} onChange={e=>setQuinceDamas(e.target.value)} placeholder="0" min="0" style={inputSt}/></div>
                  </div>
                  <input value={quinceWaltz} onChange={e=>setQuinceWaltz(e.target.value)} placeholder='Waltz song — e.g. "A Thousand Years" by Christina Perri' style={inputSt}/>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ STEP 5 — Venue & Inventory Needs ══════ */}
        {step===5&&(
          <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
            <div style={{fontSize:13,color:C.inkMid}}>Let's figure out what you'll need</div>
            <div style={{fontSize:11,color:C.gray,marginTop:-8}}>Answer a few questions about the venue and we'll calculate exactly how many items to pull from inventory.</div>

            {/* Tables */}
            <div style={sectionBox}>
              <div style={{...LBL,marginBottom:8}}>Table setup *</div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:12,color:C.gray,whiteSpace:'nowrap'}}>Number of tables:</span>
                <input type="number" value={vp.tableCount} onChange={e=>sv('tableCount',e.target.value)} placeholder="0" min="0" style={{...inputSt,maxWidth:90}}/>
              </div>
              <div style={{fontSize:12,color:C.gray,marginBottom:4}}>Table shapes:</div>
              {[['round','All round'],['rect','All rectangular'],['mix','Mix (round + rectangular)']].map(([v,lbl])=>(
                <label key={v} style={radioRow}><input type="radio" name="tShape" checked={vp.tableShape===v} onChange={()=>sv('tableShape',v)} style={{accentColor:C.rosa}}/>{lbl}</label>
              ))}
              {vp.tableShape==='mix'&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4,marginLeft:22}}>
                  <div><span style={{fontSize:11,color:C.gray}}>Round:</span><input type="number" value={vp.roundTables} onChange={e=>sv('roundTables',e.target.value)} style={{...inputSt,marginTop:2}}/></div>
                  <div><span style={{fontSize:11,color:C.gray}}>Rectangular:</span><input type="number" value={vp.rectTables} onChange={e=>sv('rectTables',e.target.value)} style={{...inputSt,marginTop:2}}/></div>
                </div>
              )}
              <label style={{...radioRow,marginTop:8}}><input type="checkbox" checked={vp.sweetheart} onChange={e=>sv('sweetheart',e.target.checked)} style={{accentColor:C.rosa}}/>Include sweetheart / head table</label>
            </div>

            {/* Chairs */}
            <div style={sectionBox}>
              <div style={{...LBL,marginBottom:8}}>Chairs</div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:12,color:C.gray,whiteSpace:'nowrap'}}>Total chairs:</span>
                <input type="number" value={vp.chairCount} onChange={e=>sv('chairCount',e.target.value)} placeholder={guests||'0'} style={{...inputSt,maxWidth:90}}/>
              </div>
              {[['venue','Venue is providing chairs'],['us','We are providing / renting chairs']].map(([v,lbl])=>(
                <label key={v} style={radioRow}><input type="radio" name="cSrc" checked={vp.chairSource===v} onChange={()=>sv('chairSource',v)} style={{accentColor:C.rosa}}/>{lbl}</label>
              ))}
              {vp.chairSource==='us'&&(
                <div style={{marginLeft:22,marginTop:6}}>
                  <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Chair style preference:</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {['Chiavari (gold)','Chiavari (silver)','Ghost chair','Cross-back','No preference'].map(s=>(
                      <button key={s} onClick={()=>sv('chairStyle',vp.chairStyle===s?'':s)} style={chip(vp.chairStyle===s)}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tablecloths */}
            <div style={sectionBox}>
              <div style={{...LBL,marginBottom:8}}>Tablecloths</div>
              {[['venue','Venue is providing — we don\'t need to supply them'],['us','We are providing — pull from our inventory'],['client','Client is bringing their own']].map(([v,lbl])=>(
                <label key={v} style={radioRow}><input type="radio" name="clSrc" checked={vp.clothSource===v} onChange={()=>sv('clothSource',v)} style={{accentColor:C.rosa}}/>{lbl}</label>
              ))}
              {vp.clothSource==='us'&&(
                <div style={{marginLeft:22,marginTop:6,display:'flex',flexDirection:'column',gap:6}}>
                  <div>
                    <span style={{fontSize:11,color:C.gray}}>Color:</span>
                    <select value={vp.clothColor} onChange={e=>sv('clothColor',e.target.value)} style={{...inputSt,marginTop:2}}>
                      <option value="">Select color…</option>
                      {[...inspoColors.map(c=>c.label),'White','Ivory','Blush','Navy','Burgundy'].filter((v,i,a)=>a.indexOf(v)===i).map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={{fontSize:11,color:C.gray}}>Style:</span>
                    <div style={{display:'flex',gap:6,marginTop:4}}>
                      {[['plain','Plain / solid'],['lace','Lace overlay'],['sequin','Sequin / glitter']].map(([v,lbl])=>(
                        <button key={v} onClick={()=>sv('clothStyle',v)} style={chip(vp.clothStyle===v)}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                  {vp.tableCount&&<div style={{fontSize:12,color:C.green,marginTop:4}}>Auto-calculated: {Number(vp.tableCount)+(vp.sweetheart?1:0)} tablecloth{(Number(vp.tableCount)+(vp.sweetheart?1:0))>1?'s':''}</div>}
                </div>
              )}
            </div>

            {/* Chair covers + sashes */}
            <div style={sectionBox}>
              <div style={{...LBL,marginBottom:8}}>Chair covers</div>
              {[['venue','Venue is providing'],['none','No covers needed'],['us','We are providing — pull from inventory'],['client','Client bringing own']].map(([v,lbl])=>(
                <label key={v} style={radioRow}><input type="radio" name="cvSrc" checked={vp.coverSource===v} onChange={()=>sv('coverSource',v)} style={{accentColor:C.rosa}}/>{lbl}</label>
              ))}
              {vp.coverSource==='us'&&(
                <div style={{marginLeft:22,marginTop:6}}>
                  <span style={{fontSize:11,color:C.gray}}>Color:</span>
                  <select value={vp.coverColor} onChange={e=>sv('coverColor',e.target.value)} style={{...inputSt,marginTop:2}}>
                    <option value="">Select…</option>
                    {[...inspoColors.map(c=>c.label),'White','Ivory'].filter((v,i,a)=>a.indexOf(v)===i).map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  {vp.chairCount&&<div style={{fontSize:12,color:C.green,marginTop:4}}>Need: {vp.chairCount} chair covers</div>}
                </div>
              )}
              <label style={{...radioRow,marginTop:10,fontWeight:500}}><input type="checkbox" checked={vp.sashes} onChange={e=>sv('sashes',e.target.checked)} style={{accentColor:C.rosa}}/>Add chair sashes / bows</label>
              {vp.sashes&&(
                <div style={{marginLeft:22,marginTop:4,display:'flex',gap:8,flexWrap:'wrap'}}>
                  <div style={{flex:'1 1 120px'}}><span style={{fontSize:11,color:C.gray}}>Color:</span><input value={vp.sashColor} onChange={e=>sv('sashColor',e.target.value)} placeholder="e.g. Gold" style={{...inputSt,marginTop:2}}/></div>
                  <div>
                    <span style={{fontSize:11,color:C.gray}}>Style:</span>
                    <div style={{display:'flex',gap:4,marginTop:4}}>
                      {[['satin','Satin bow'],['organza','Organza sash'],['burlap','Burlap tie']].map(([v,lbl])=>(
                        <button key={v} onClick={()=>sv('sashStyle',v)} style={chip(vp.sashStyle===v)}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Centerpieces */}
            <div style={sectionBox}>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,fontWeight:500,color:C.ink}}>
                <input type="checkbox" checked={vp.centerpieces} onChange={e=>sv('centerpieces',e.target.checked)} style={{accentColor:C.rosa}}/>Include centerpieces from inventory
              </label>
              {vp.centerpieces&&(
                <div style={{marginTop:8,marginLeft:22}}>
                  <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Style:</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                    {['Tall centerpiece','Low / garden','Candelabra','Lantern'].map(s=>(
                      <button key={s} onClick={()=>sv('cpStyle',vp.cpStyle===s?'':s)} style={chip(vp.cpStyle===s)}>{s}</button>
                    ))}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:12,color:C.gray}}>Quantity:</span>
                    <input type="number" value={vp.cpQty} onChange={e=>sv('cpQty',e.target.value)} placeholder={vp.tableCount||'0'} style={{...inputSt,maxWidth:80}}/>
                  </div>
                </div>
              )}
            </div>

            {/* Arch */}
            <div style={sectionBox}>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,fontWeight:500,color:C.ink}}>
                <input type="checkbox" checked={vp.arch} onChange={e=>sv('arch',e.target.checked)} style={{accentColor:C.rosa}}/>Include arch or backdrop
              </label>
              {vp.arch&&(
                <div style={{marginTop:8,marginLeft:22,display:'flex',flexDirection:'column',gap:6}}>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {['Floral arch (gold frame)','Metal arch (geometric)','Balloon arch frame','Backdrop stand + curtain'].map(s=>(
                      <button key={s} onClick={()=>sv('archType',vp.archType===s?'':s)} style={chip(vp.archType===s)}>{s}</button>
                    ))}
                  </div>
                  <input value={vp.archPlacement} onChange={e=>sv('archPlacement',e.target.value)} placeholder="Placement — e.g. Ceremony altar, Photo backdrop" style={inputSt}/>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <div style={LBL}>Other decoration needs</div>
              <textarea value={vp.notes} onChange={e=>sv('notes',e.target.value)} placeholder="Fairy lights on ceiling, specific floral arrangements, photo booth props…" style={{...inputSt,minHeight:60,resize:'vertical',fontFamily:'inherit'}}/>
            </div>

            {/* Live summary */}
            {(vp.tableCount||vp.chairSource==='us'||vp.centerpieces||vp.arch)&&(
              <div style={{background:'var(--bg-success)',borderRadius:10,padding:14}}>
                <div style={{fontSize:10,fontWeight:600,color:'var(--color-success)',letterSpacing:'0.08em',marginBottom:8}}>ITEMS TO RESERVE FROM INVENTORY</div>
                {vp.clothSource==='us'&&vp.tableCount&&<div style={{fontSize:12,color:'var(--color-success)',marginBottom:3}}>✓ {vp.clothColor||'—'} {vp.clothStyle!=='plain'?vp.clothStyle+' ':''} tablecloths × {Number(vp.tableCount)+(vp.sweetheart?1:0)}</div>}
                {vp.coverSource==='us'&&vp.chairCount&&<div style={{fontSize:12,color:'var(--color-success)',marginBottom:3}}>✓ {vp.coverColor||'—'} chair covers × {vp.chairCount}</div>}
                {vp.sashes&&vp.chairCount&&<div style={{fontSize:12,color:'var(--color-success)',marginBottom:3}}>✓ {vp.sashColor||'—'} {vp.sashStyle} chair sashes × {vp.chairCount}</div>}
                {vp.chairSource==='us'&&vp.chairCount&&<div style={{fontSize:12,color:'var(--color-success)',marginBottom:3}}>✓ {vp.chairStyle||'Chairs'} × {vp.chairCount}</div>}
                {vp.centerpieces&&vp.cpQty&&<div style={{fontSize:12,color:'var(--color-success)',marginBottom:3}}>✓ {vp.cpStyle||'Centerpiece'} sets × {vp.cpQty}</div>}
                {vp.arch&&vp.archType&&<div style={{fontSize:12,color:'var(--color-success)',marginBottom:3}}>✓ {vp.archType} × 1</div>}
                <div style={{fontSize:11,color:'var(--color-success)',marginTop:6,borderTop:`1px solid rgba(var(--color-success-rgb), 0.2)`,paddingTop:6}}>All items will be reserved on save.</div>
              </div>
            )}
          </div>
        )}

        {/* ══════ STEP 6 — Review & Confirm ══════ */}
        {step===6&&(
          <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:12}}>
            {[
              ['CLIENT',<>{newMode?newCl.name:selClient?.name}{(newMode?newCl.phone:selClient?.phone)&&<div style={{fontSize:12,color:C.gray}}>{newMode?newCl.phone:selClient?.phone}</div>}{(newMode?newCl.email:selClient?.email)&&<div style={{fontSize:12,color:C.gray}}>{newMode?newCl.email:selClient?.email}</div>}</>],
              ['EVENT',<><span style={{fontWeight:500}}>{evName}</span><div style={{fontSize:12,color:C.gray}}>{EVT_TYPES[evType]?.label||evType} · {evDate?new Date(evDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''}{venue&&' · '+venue}{guests&&' · ~'+guests+' guests'}</div>{coordId&&<div style={{fontSize:12,color:C.gray}}>Coordinator: {coordinators.find(s=>s.id===coordId)?.name}</div>}</>],
            ].map(([title,content])=>(
              <div key={title} style={{background:C.ivory,borderRadius:10,padding:14}}>
                <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>{title}</div>
                {content}
              </div>
            ))}

            {/* Inspiration summary */}
            {(inspoColors.length>0||inspoStyles.length>0||visionNotes)&&(
              <div style={{background:C.ivory,borderRadius:10,padding:14}}>
                <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>INSPIRATION</div>
                {inspoColors.length>0&&(
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    <span style={{fontSize:12,color:C.gray}}>Colors:</span>
                    {inspoColors.map((c,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:3}}>
                        <div style={{width:14,height:14,borderRadius:'50%',background:c.hex,border:'1px solid rgba(0,0,0,0.1)'}}/>
                        <span style={{fontSize:12,color:C.ink}}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {inspoStyles.length>0&&<div style={{fontSize:12,color:C.ink,marginBottom:4}}>Style: {inspoStyles.join(' · ')}</div>}
                {visionNotes&&<div style={{fontSize:12,color:C.gray,fontStyle:'italic'}}>"{visionNotes}"</div>}
                {evType==='quince'&&quinceTheme&&<div style={{fontSize:12,color:C.purple,marginTop:4}}>Theme: {quinceTheme}</div>}
              </div>
            )}

            {/* Services */}
            <div style={{background:C.ivory,borderRadius:10,padding:14}}>
              <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>SERVICES</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{svcs.map(s=><SvcTag key={s} svc={s}/>)}</div>
            </div>

            {/* Quote summary */}
            <div style={{background:C.ivory,borderRadius:10,padding:14}}>
              <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>QUOTE SUMMARY</div>
              {lineItems.filter(li=>li.description).map((li,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                  <span style={{color:C.ink}}>{li.description}{Number(li.qty)>1?` × ${li.qty}`:''}</span>
                  <span style={{color:C.gray}}>{fmt((Number(li.qty)||1)*(Number(li.unitPrice)||0))}</span>
                </div>
              ))}
              {discountAmt>0&&(
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.amber,marginTop:4,paddingTop:4,borderTop:`1px solid ${C.border}`}}>
                  <span>Discount{discount.type==='percent'?` (${discount.value}%)`:''}</span>
                  <span>− {fmt(discountAmt)}</span>
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',fontSize:15,fontWeight:700,color:C.ink,borderTop:`1px solid ${C.border}`,paddingTop:8,marginTop:4}}>
                <span>Total</span><span>{fmt(computedTotal)}</span>
              </div>
              {quoteExpiry&&(
                <div style={{fontSize:11,color:C.gray,marginTop:6}}>Quote valid until {new Date(quoteExpiry+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
              )}
            </div>

            {/* Venue & linen plan */}
            {hasDeco&&vp.tableCount&&(
              <div style={{background:C.ivory,borderRadius:10,padding:14}}>
                <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>VENUE & LINEN PLAN</div>
                <div style={{fontSize:12,color:C.ink,marginBottom:3}}>Tables: {vp.tableCount} ({vp.tableShape==='mix'?`${vp.roundTables} round + ${vp.rectTables} rect`:vp.tableShape}){vp.sweetheart?' + sweetheart':''}</div>
                <div style={{fontSize:12,color:C.ink,marginBottom:3}}>Chairs: {vp.chairSource==='venue'?'Venue providing':`We provide ${vp.chairCount}${vp.chairStyle?' '+vp.chairStyle:''}`}</div>
                {vp.clothSource==='us'&&<div style={{fontSize:12,color:C.ink,marginBottom:3}}>Tablecloths: Boutique — {Number(vp.tableCount)+(vp.sweetheart?1:0)} {vp.clothColor||''} {vp.clothStyle!=='plain'?vp.clothStyle:''}</div>}
                {vp.coverSource==='us'&&<div style={{fontSize:12,color:C.ink,marginBottom:3}}>Chair covers: Boutique — {vp.chairCount} {vp.coverColor||''}</div>}
                {vp.sashes&&<div style={{fontSize:12,color:C.ink,marginBottom:3}}>Chair sashes: {vp.chairCount} {vp.sashColor} {vp.sashStyle}</div>}
                {vp.centerpieces&&<div style={{fontSize:12,color:C.ink,marginBottom:3}}>Centerpieces: {vp.cpQty} {vp.cpStyle||''} sets</div>}
                {vp.arch&&<div style={{fontSize:12,color:C.ink,marginBottom:3}}>Arch: {vp.archType}{vp.archPlacement?' — '+vp.archPlacement:''}</div>}
              </div>
            )}

            {milestones.length>0&&(
              <div style={{background:C.ivory,borderRadius:10,padding:14}}>
                <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>PAYMENT MILESTONES</div>
                {milestones.map((m,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                    <span style={{color:C.ink}}>{m.label}</span>
                    <span style={{color:C.gray}}>{fmt(Number(m.amount))} · {m.due?new Date(m.due+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):''}</span>
                  </div>
                ))}
                {mismatch&&<div style={{fontSize:11,color:C.amber,marginTop:6}}>⚠ Milestones total {fmt(milestoneSum)} vs {fmt(computedTotal)} — adjust after creation.</div>}
              </div>
            )}
            {svcs.includes('dress_rental')&&(
              <div style={{background:C.ivory,borderRadius:10,padding:14}}>
                <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>DRESS RESERVATION</div>
                {dressMode==='now'&&dressId?(()=>{const d=(inventory||[]).find(x=>x.id===dressId);return<span style={{fontSize:13,color:C.ink}}>{d?`#${d.sku} · ${d.name} · Size ${d.size} · ${fmt(d.price)}/rental`:'—'}</span>})():<span style={{fontSize:12,color:C.gray}}>Reserve later — task created automatically</span>}
              </div>
            )}
            {svcs.includes('alterations')&&(altDesc||altItems.length>0)&&(
              <div style={{background:C.ivory,borderRadius:10,padding:14}}>
                <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>ALTERATIONS</div>
                {altStaff&&<div style={{fontSize:13,color:C.ink}}>{seamstresses.find(s=>s.id===altStaff)?.name}</div>}
                {altDesc&&<div style={{fontSize:12,color:C.gray}}>{altDesc}</div>}
                {altItems.length>0&&<div style={{fontSize:12,color:C.gray}}>{altItems.join(', ')}</div>}
                {altPrice&&<div style={{fontSize:12,color:C.gray}}>Est. {fmt(Number(altPrice))}</div>}
              </div>
            )}
            {svcs.includes('decoration')&&floralType&&(
              <div style={{background:C.ivory,borderRadius:10,padding:14}}>
                <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:8}}>FLORAL ARRANGEMENT</div>
                <div style={{fontSize:13,color:C.ink}}>{floralType==='real'?'🌸 Real flowers':'🎀 Silk / artificial'}</div>
                <div style={{fontSize:12,color:C.gray,marginTop:2}}>Decoration deposit: {fmt(floralType==='real'?800:500)}</div>
              </div>
            )}
            <div style={{background:'var(--bg-success)',borderRadius:10,padding:14}}>
              <div style={{fontSize:10,fontWeight:600,color:'var(--color-success)',letterSpacing:'0.08em',marginBottom:8}}>AUTOMATIONS THAT WILL ENROLL</div>
              {['Appointment reminders (SMS 24h + 2h)','Payment milestone reminders','Dress return reminder','Post-event review request'].map(a=>(
                <div key={a} style={{fontSize:12,color:'var(--color-success)',marginBottom:3}}>✓ {a}</div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',gap:8,flexShrink:0}}>
          <GhostBtn label={step===1?'Cancel':'← Back'} onClick={()=>step===1?onClose():goBack()}/>
          {!isLast?<PrimaryBtn label="Continue →" onClick={goNext}/>:<PrimaryBtn label={saving?'Creating…':'Create event & save quote'} colorScheme="success" onClick={confirm}/>}
        </div>
      </div>
    </div>
  );
};
// ─── CALENDAR VIEW (rebuilt) ────────────────────────────────────────────────
function evDate(ev) {
  if (ev.event_date) {
    const [y,m,d] = ev.event_date.split('T')[0].split('-').map(Number);
    return new Date(y, m-1, d);
  }
  const t = new Date(); t.setDate(t.getDate()+(ev.daysUntil||0)); return t;
}
const CAL_TYPES={
  wedding:      {bg:'#FCE7F3',col:'#BE185D',icon:'💍'},
  quince:       {bg:'var(--bg-accent)',col:'var(--color-accent)',icon:'👑'},
  baptism:      {bg:'#DBEAFE',col:'#1D4ED8',icon:'🕊'},
  birthday:     {bg:'var(--bg-warning)',col:'var(--color-warning)',icon:'🎂'},
  anniversary:  {bg:'#FCE7F3',col:'#BE185D',icon:'💕'},
  graduation:   {bg:'var(--bg-success)',col:'var(--color-success)',icon:'🎓'},
  baby_shower:  {bg:'#E0F2FE',col:'#0369A1',icon:'🍼'},
  bridal_shower:{bg:'#FDF2F8',col:'#9D174D',icon:'💐'},
  pickup:       {bg:'#FEF3C7',col:'#B45309',icon:'📦'},
  return:       {bg:'#DBEAFE',col:'#1D4ED8',icon:'↩'},
  alteration:   {bg:'#DCFCE7',col:'#15803D',icon:'✂'},
};
const APPT_CAL={
  measurements:      {bg:'#E0F2FE',col:'#0369A1',icon:'📏'},
  venue_walkthrough: {bg:'#F0FDF4',col:'#15803D',icon:'🏛'},
  fitting:           {bg:'#EDE9FE',col:'#6D28D9',icon:'👗'},
  consultation:      {bg:'#FDF4FF',col:'#A21CAF',icon:'💬'},
  pickup:            {bg:'#FEF3C7',col:'#B45309',icon:'📦'},
  return:            {bg:'#DBEAFE',col:'#1D4ED8',icon:'↩'},
  try_on:            {bg:'#FCE7F3',col:'#BE185D',icon:'✨'},
  alteration_check:  {bg:'#DCFCE7',col:'#15803D',icon:'✂'},
  final_review:      {bg:'#F0FDF4',col:'#16A34A',icon:'✅'},
  other:             {bg:'#F3F4F6',col:'#6B7280',icon:'📅'},
};

const CalendarView = ({events, inventory, alterations, setScreen, setSelectedEvent, onAddEvent, boutique}) => {
  const now = new Date();
  const [month,setMonth]=useState(new Date(now.getFullYear(),now.getMonth(),1));
  const yr=month.getFullYear(), mo=month.getMonth();
  const firstDow=new Date(yr,mo,1).getDay();
  const daysInMo=new Date(yr,mo+1,0).getDate();
  const todayKey=`${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  // appointments
  const [appointments,setAppointments]=useState([]);
  useEffect(()=>{
    if(!boutique?.id)return;
    const start=`${yr}-${String(mo+1).padStart(2,'0')}-01`;
    const end=`${yr}-${String(mo+1).padStart(2,'0')}-${String(daysInMo).padStart(2,'0')}`;
    supabase.from('appointments')
      .select('*, event:events(client:clients(name))')
      .eq('boutique_id',boutique.id)
      .gte('date',start).lte('date',end)
      .then(({data})=>setAppointments(data||[]));
  },[boutique?.id,yr,mo]);

  // filters
  const [showEvents,setShowEvents]=useState(true);
  const [showAppts,setShowAppts]=useState(true);
  const [showDress,setShowDress]=useState(true);
  const [evType,setEvType]=useState('all');
  const [selectedDay,setSelectedDay]=useState(null);

  const toKey=ds=>{
    if(!ds)return null;
    const d=new Date(ds+'T12:00:00');
    if(isNaN(d))return null;
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const keyToISO=k=>{
    const [y,m,d]=k.split('-').map(Number);
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  };

  // build entry map
  const byDate={};
  const addEntry=(key,entry)=>{ if(key&&key.startsWith(`${yr}-${mo}-`))(byDate[key]||(byDate[key]=[])).push(entry); };

  // 1. Events
  if(showEvents){
    const evs=(events||[]).filter(ev=>
      evType==='all'||
      (evType==='wedding'&&ev.type==='wedding')||
      (evType==='quince'&&ev.type==='quince')||
      (evType==='other'&&!['wedding','quince'].includes(ev.type))
    );
    evs.forEach(ev=>{
      const d=evDate(ev);
      if(d.getFullYear()===yr&&d.getMonth()===mo){
        const k=`${yr}-${mo}-${d.getDate()}`;
        const t=CAL_TYPES[ev.type]||{bg:C.rosaPale,col:C.rosa,icon:'📅'};
        addEntry(k,{id:`ev-${ev.id}`,kind:'event',bg:t.bg,col:t.col,icon:t.icon,
          label:ev.client?.split(' ')[0]||'Event',
          sub:EVT_TYPES[ev.type]?.label||ev.type,
          overdue:ev.overdue>0,
          onClick:()=>{setSelectedEvent(ev.id);setScreen('event_detail');}
        });
      }
    });
  }

  // 2. Appointments
  if(showAppts){
    appointments.forEach(a=>{
      const k=toKey(a.date);
      const cfg=APPT_CAL[a.type]||APPT_CAL.other;
      const clientName=a.event?.client?.name?.split(' ')[0]||'';
      addEntry(k,{id:`appt-${a.id}`,kind:'appointment',bg:cfg.bg,col:cfg.col,icon:cfg.icon,
        label:clientName||(a.type?.replace(/_/g,' ')||'Appt'),
        sub:a.time?a.time.slice(0,5):(a.type?.replace(/_/g,' ')||''),
      });
    });
  }

  // 3. Dress pickups & returns
  if(showDress){
    (inventory||[]).forEach(d=>{
      if(!['reserved','rented','picked_up'].includes(d.status))return;
      const lbl=(d.client?.name||d.client||'').split(' ')[0]||d.sku;
      if(d.pickup_date) addEntry(toKey(d.pickup_date),{id:`pick-${d.id}`,kind:'pickup',bg:CAL_TYPES.pickup.bg,col:CAL_TYPES.pickup.col,icon:'📦',label:lbl,sub:`Pickup #${d.sku}`});
      if(d.return_date) addEntry(toKey(d.return_date),{id:`ret-${d.id}`,kind:'return',bg:CAL_TYPES.return.bg,col:CAL_TYPES.return.col,icon:'↩',label:lbl,sub:`Return #${d.sku}`});
    });
    (alterations||[]).forEach(a=>{
      if(a.status==='complete')return;
      let ds=a.fitting_date||a.due_date;
      if(!ds&&a.daysUntil!=null){const e=new Date(now);e.setDate(now.getDate()+a.daysUntil-1);ds=e.toISOString().split('T')[0];}
      if(!ds)return;
      const isU=(a.daysUntil??99)<=7;
      addEntry(toKey(ds),{id:`alt-${a.id}`,kind:'alteration',bg:isU?C.redBg:CAL_TYPES.alteration.bg,col:isU?C.red:CAL_TYPES.alteration.col,icon:'✂',label:a.client?.split(' ')[0]||'Alt',sub:(a.work||[]).slice(0,2).join(', ')||a.status});
    });
  }

  const cells=[];
  for(let i=0;i<firstDow;i++) cells.push(null);
  for(let d=1;d<=daysInMo;d++) cells.push(d);
  while(cells.length%7!==0) cells.push(null);

  const totalEntries=Object.values(byDate).reduce((s,a)=>s+a.length,0);
  const selEntries=selectedDay?(byDate[selectedDay]||[]):[];

  const FiltBtn=({active,onClick,color,label})=>(
    <button onClick={onClick} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:999,border:`1px solid ${active?color:C.border}`,background:active?`${color}18`:'transparent',color:active?color:C.gray,fontSize:11,fontWeight:active?600:400,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap'}}>
      <span style={{width:8,height:8,borderRadius:'50%',background:active?color:C.border,flexShrink:0,transition:'background 0.15s'}}/>
      {label}
    </button>
  );

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#F9FAFB'}}>

      {/* ── Toolbar ── */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:C.white,borderBottom:`1px solid ${C.border}`,flexShrink:0,flexWrap:'wrap'}}>
        {/* Month nav */}
        <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
          <button onClick={()=>setMonth(new Date(yr,mo-1,1))} style={{border:`1px solid ${C.border}`,background:'transparent',borderRadius:7,width:28,height:28,cursor:'pointer',fontSize:15,color:C.gray,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
          <span style={{fontSize:14,fontWeight:600,color:C.ink,minWidth:148,textAlign:'center'}}>{month.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span>
          <button onClick={()=>setMonth(new Date(yr,mo+1,1))} style={{border:`1px solid ${C.border}`,background:'transparent',borderRadius:7,width:28,height:28,cursor:'pointer',fontSize:15,color:C.gray,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
          <button onClick={()=>setMonth(new Date(now.getFullYear(),now.getMonth(),1))} style={{border:`1px solid ${C.border}`,background:'transparent',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:11,color:C.gray,marginLeft:4}}>Today</button>
        </div>

        <div style={{width:1,height:20,background:C.border,flexShrink:0,margin:'0 4px'}}/>

        {/* Content toggles */}
        <FiltBtn active={showEvents} onClick={()=>setShowEvents(v=>!v)} color={C.rosa} label="Events"/>
        <FiltBtn active={showAppts} onClick={()=>setShowAppts(v=>!v)} color="#0369A1" label="Appointments"/>
        <FiltBtn active={showDress} onClick={()=>setShowDress(v=>!v)} color="#B45309" label="Dress & alterations"/>

        {/* Event type sub-filter (only when events shown) */}
        {showEvents&&(<>
          <div style={{width:1,height:20,background:C.border,flexShrink:0,margin:'0 4px'}}/>
          <div style={{display:'flex',gap:3}}>
            {[['all','All types'],['wedding','💍 Weddings'],['quince','👑 Quinceañeras'],['other','Other']].map(([v,l])=>(
              <button key={v} onClick={()=>setEvType(v)} style={{padding:'4px 10px',borderRadius:999,border:`1px solid ${evType===v?C.rosa:C.border}`,background:evType===v?C.rosaPale:'transparent',color:evType===v?C.rosa:C.gray,fontSize:11,fontWeight:evType===v?500:400,cursor:'pointer',whiteSpace:'nowrap'}}>{l}</button>
            ))}
          </div>
        </>)}

        <div style={{marginLeft:'auto',fontSize:11,color:C.gray,flexShrink:0}}>{totalEntries} entries</div>
      </div>

      {/* ── Calendar + optional day panel ── */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* Grid area */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* Day headers */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:C.white,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
              <div key={d} style={{padding:'8px 0',textAlign:'center',fontSize:10,fontWeight:700,color:C.gray,letterSpacing:'0.06em',textTransform:'uppercase'}}>{d}</div>
            ))}
          </div>
          {/* Cells */}
          <div style={{flex:1,overflowY:'auto'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gridAutoRows:'minmax(110px,auto)'}}>
              {cells.map((day,i)=>{
                if(!day) return <div key={`x${i}`} style={{background:'#F3F4F6',borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}/>;
                const k=`${yr}-${mo}-${day}`;
                const isToday=k===todayKey;
                const isSel=selectedDay===k;
                const entries=byDate[k]||[];
                const apptCount=entries.filter(e=>e.kind==='appointment').length;
                const isoDate=keyToISO(k);
                return (
                  <div key={k} onClick={()=>setSelectedDay(isSel?null:k)}
                    style={{borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,padding:'5px 6px',background:isSel?C.rosaPale:isToday?'#FFF5F7':C.white,transition:'background 0.1s',minHeight:110,cursor:'pointer',position:'relative'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                      <div style={{width:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:isToday?700:400,background:isToday?C.rosa:'transparent',color:isToday?C.white:isSel?C.rosa:C.inkMid,flexShrink:0}}>{day}</div>
                      {apptCount>0&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:999,background:'#DBEAFE',color:'#1D4ED8',fontWeight:600}}>{apptCount}a</span>}
                    </div>
                    {entries.slice(0,3).map(entry=>(
                      <div key={entry.id}
                        onClick={e=>{e.stopPropagation();entry.onClick?.();}}
                        style={{display:'flex',alignItems:'center',gap:3,fontSize:9,padding:'2px 5px',borderRadius:4,marginBottom:2,cursor:entry.onClick?'pointer':'default',background:entry.bg,color:entry.col,overflow:'hidden',userSelect:'none',whiteSpace:'nowrap',outline:entry.overdue?`1px solid ${C.red}`:undefined}}
                        title={`${entry.label} — ${entry.sub}`}>
                        <span style={{flexShrink:0}}>{entry.icon}</span>
                        <span style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis'}}>{entry.label}</span>
                        <span style={{opacity:0.7,overflow:'hidden',textOverflow:'ellipsis',marginLeft:1}}>{entry.sub}</span>
                      </div>
                    ))}
                    {entries.length>3&&<div style={{fontSize:9,color:C.gray,paddingLeft:2}}>+{entries.length-3} more</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Day detail side panel */}
        {selectedDay&&(
          <div style={{width:252,borderLeft:`1px solid ${C.border}`,background:C.white,display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
            <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.ink}}>
                  {new Date(keyToISO(selectedDay)+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                </div>
                <div style={{fontSize:11,color:C.gray,marginTop:1}}>{selEntries.length} {selEntries.length===1?'entry':'entries'}</div>
              </div>
              <button onClick={()=>setSelectedDay(null)} style={{border:'none',background:'none',cursor:'pointer',color:C.gray,fontSize:18,padding:0,lineHeight:1}}>×</button>
            </div>
            {selEntries.length===0
              ?(
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,padding:20,textAlign:'center'}}>
                  <div style={{fontSize:32,opacity:0.4}}>📅</div>
                  <div style={{fontSize:12,color:C.gray}}>Nothing scheduled</div>
                  {onAddEvent&&<button onClick={()=>onAddEvent(keyToISO(selectedDay))} style={{fontSize:12,color:C.rosa,background:'none',border:`1px solid ${C.petal}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',fontWeight:500}}>+ New event</button>}
                </div>
              )
              :(
                <div style={{flex:1,overflowY:'auto',padding:10,display:'flex',flexDirection:'column',gap:6}}>
                  {selEntries.map(entry=>(
                    <div key={entry.id} onClick={entry.onClick}
                      style={{padding:'9px 12px',borderRadius:10,border:`1px solid ${entry.bg}`,background:entry.bg,cursor:entry.onClick?'pointer':'default',transition:'opacity 0.1s'}}
                      onMouseEnter={e=>{if(entry.onClick)e.currentTarget.style.opacity='0.8';}}
                      onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:15}}>{entry.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:entry.col,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{entry.label}</div>
                          <div style={{fontSize:10,color:entry.col,opacity:0.75,marginTop:1}}>{entry.sub}</div>
                        </div>
                        {entry.time&&<span style={{fontSize:10,color:entry.col,opacity:0.8,flexShrink:0}}>{entry.time.slice(0,5)}</span>}
                      </div>
                    </div>
                  ))}
                  {onAddEvent&&(
                    <button onClick={()=>onAddEvent(keyToISO(selectedDay))} style={{marginTop:2,fontSize:11,color:C.rosa,background:'none',border:`1px dashed ${C.petal}`,borderRadius:8,padding:'7px',cursor:'pointer',width:'100%',fontWeight:500}}>+ New event this day</button>
                  )}
                </div>
              )
            }
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{display:'flex',gap:8,padding:'7px 16px',background:C.white,borderTop:`1px solid ${C.border}`,flexShrink:0,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontSize:10,fontWeight:700,color:C.gray,letterSpacing:'0.05em',textTransform:'uppercase',marginRight:2}}>Legend</span>
        {showEvents&&[['💍','#FCE7F3','#BE185D','Wedding'],['👑',C.purpleBg,C.purple,'Quinceañera'],['📅',C.grayBg,C.gray,'Other event']].map(([icon,bg,col,lbl])=>(
          <div key={lbl} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:C.gray}}><div style={{width:10,height:10,borderRadius:2,background:bg,border:`1px solid ${col}`,flexShrink:0}}/>{icon} {lbl}</div>
        ))}
        {showAppts&&<div style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:C.gray}}><div style={{width:10,height:10,borderRadius:2,background:'#E0F2FE',border:'1px solid #0369A1',flexShrink:0}}/>📋 Appointment</div>}
        {showDress&&[['📦','#FEF3C7','#B45309','Pickup'],['↩','#DBEAFE','#1D4ED8','Return'],['✂','#DCFCE7','#15803D','Alteration']].map(([icon,bg,col,lbl])=>(
          <div key={lbl} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:C.gray}}><div style={{width:10,height:10,borderRadius:2,background:bg,border:`1px solid ${col}`,flexShrink:0}}/>{icon} {lbl}</div>
        ))}
      </div>
    </div>
  );
};
// ─── WAITLIST ──────────────────────────────────────────────────────────────

const EVT_TYPE_OPTS = [
  {val:'wedding',    label:'Wedding'},
  {val:'quince',     label:'Quinceañera'},
  {val:'party',      label:'Party'},
  {val:'other',      label:'Other'},
];

function daysSince(isoStr) {
  const ms = Date.now() - new Date(isoStr).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function contactedThisMonth(list) {
  const now = new Date();
  return list.filter(e => {
    if (!e.contacted_at) return false;
    const d = new Date(e.contacted_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

// ── Add-to-waitlist modal ──
const AddWaitlistModal = ({ onClose, onSave }) => {
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [evType, setEvType]       = useState('');
  const [prefDate, setPrefDate]   = useState('');
  const [flexible, setFlexible]   = useState(false);
  const [source, setSource]       = useState('manual');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  async function handleSave() {
    if (!name.trim()) { setErr('Name is required'); return; }
    setSaving(true); setErr('');
    const { error } = await onSave({
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      event_type: evType || null,
      preferred_date: prefDate || null,
      flexible_dates: flexible,
      source,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { setErr(error.message || 'Failed to add'); return; }
    onClose();
  }

  const selSt = { ...inputSt, appearance: 'none', backgroundImage: 'none' };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{background:C.white,borderRadius:16,width:'100%',maxWidth:480,boxShadow:'0 24px 60px rgba(0,0,0,0.18)',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:16,fontWeight:500,color:C.ink}}>Add to waitlist</span>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:22,lineHeight:1,padding:2,minHeight:'unset',minWidth:'unset'}}>×</button>
        </div>
        {err && <div style={{padding:'8px 24px',background:'var(--bg-danger)',color:'var(--color-danger)',fontSize:13}}>{err}</div>}
        <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:12,overflowY:'auto',maxHeight:'70vh'}}>
          <div>
            <div style={LBL}>Name *</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" style={inputSt}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <div style={LBL}>Phone</div>
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(555) 000-0000" style={inputSt}/>
            </div>
            <div>
              <div style={LBL}>Email</div>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" style={inputSt}/>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <div style={LBL}>Event type</div>
              <select value={evType} onChange={e=>setEvType(e.target.value)} style={selSt}>
                <option value=''>-- select --</option>
                {EVT_TYPE_OPTS.map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <div style={LBL}>Source</div>
              <select value={source} onChange={e=>setSource(e.target.value)} style={selSt}>
                <option value='manual'>Manual entry</option>
                <option value='phone'>Phone call</option>
              </select>
            </div>
          </div>
          <div>
            <div style={LBL}>Preferred date</div>
            <input type='date' value={prefDate} onChange={e=>setPrefDate(e.target.value)} style={inputSt}/>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:C.ink}}>
            <input type='checkbox' checked={flexible} onChange={e=>setFlexible(e.target.checked)} style={{accentColor:C.rosa,width:16,height:16}}/>
            Flexible on dates
          </label>
          <div>
            <div style={LBL}>Notes</div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any details…" style={{...inputSt,minHeight:72,resize:'vertical',fontFamily:'inherit'}}/>
          </div>
        </div>
        <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'flex-end',gap:8}}>
          <GhostBtn label='Cancel' onClick={onClose}/>
          <PrimaryBtn label={saving?'Saving…':'Add to waitlist'} onClick={handleSave}/>
        </div>
      </div>
    </div>
  );
};

// ── Mark-booked modal ──
const MarkBookedModal = ({ entry, onClose, onJustMark, onCreateEvent }) => (
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1010,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{background:C.white,borderRadius:16,width:'100%',maxWidth:400,boxShadow:'0 24px 60px rgba(0,0,0,0.18)',padding:28}}>
      <div style={{fontSize:16,fontWeight:600,color:C.ink,marginBottom:8}}>Convert to event?</div>
      <div style={{fontSize:13,color:C.gray,marginBottom:20}}>
        Mark <strong style={{color:C.ink}}>{entry.name}</strong> as booked.
        Would you like to create a new event for them?
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        <button
          onClick={onCreateEvent}
          style={{padding:'12px 18px',borderRadius:10,border:`1.5px solid ${C.rosa}`,background:C.rosaPale,color:C.rosa,fontSize:14,fontWeight:600,cursor:'pointer',textAlign:'left'}}>
          Yes, create a new event →
        </button>
        <button
          onClick={onJustMark}
          style={{padding:'12px 18px',borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:14,cursor:'pointer',textAlign:'left'}}>
          Just mark as booked (no event)
        </button>
        <button
          onClick={onClose}
          style={{padding:'10px 18px',borderRadius:10,border:'none',background:'none',color:C.gray,fontSize:13,cursor:'pointer',textAlign:'center'}}>
          Cancel
        </button>
      </div>
    </div>
  </div>
);

// ── Main waitlist view ──
const WaitlistView = ({ setScreen, setSelectedEvent }) => {
  const toast = useToast();
  const { waitlist, loading, addToWaitlist, markContacted, markBooked, removeFromWaitlist } = useWaitlist();
  const [showAdd, setShowAdd]         = useState(false);
  const [bookingEntry, setBookingEntry] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});

  const waiting   = waitlist.filter(e => e.status === 'waiting');
  const contacted = waitlist.filter(e => e.status === 'contacted');
  const sorted    = [...waiting, ...contacted];
  const contactedCount = contactedThisMonth(waitlist);

  function toggleNotes(id) {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleMarkContacted(id) {
    const { error } = await markContacted(id);
    if (error) toast('Failed to update', 'error');
    else toast('Marked as contacted', 'success');
  }

  async function handleRemove(id) {
    const { error } = await removeFromWaitlist(id);
    if (error) toast('Failed to remove', 'error');
    else toast('Removed from waitlist', 'success');
  }

  async function handleJustMark(id) {
    const { error } = await markBooked(id, null);
    setBookingEntry(null);
    if (error) toast('Failed to update', 'error');
    else toast('Marked as booked', 'success');
  }

  function handleCreateEvent(entry) {
    setBookingEntry(null);
    // Pre-fill info via sessionStorage so CreateEventModal can pick it up
    sessionStorage.setItem('belori_autoopen', 'new_event');
    sessionStorage.setItem('belori_waitlist_prefill', JSON.stringify({
      name: entry.name,
      phone: entry.phone || '',
      email: entry.email || '',
      event_type: entry.event_type || '',
      event_date: entry.preferred_date || '',
    }));
    // Mark as booked without event (event_id will be linked manually)
    markBooked(entry.id, null);
    // The sessionStorage flag will auto-open the create modal when the list view re-renders
    toast('Opening new event form…', 'success');
  }

  const statusDot = (status) => ({
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: status === 'contacted' ? 'var(--color-info)' : C.amber,
    marginTop: 2,
  });

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'14px 20px',background:C.white,borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <span style={{fontSize:16,fontWeight:600,color:C.ink}}>Waitlist</span>
          <span style={{fontSize:12,color:C.gray,marginLeft:8}}>
            {waiting.length} waiting · {contactedCount} contacted this month
          </span>
        </div>
        <PrimaryBtn label='+ Add to waitlist' onClick={() => setShowAdd(true)}/>
      </div>

      {/* List */}
      <div className='page-scroll' style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:10}}>
        {loading && (
          <div style={{textAlign:'center',padding:40,color:C.gray,fontSize:13}}>Loading…</div>
        )}
        {!loading && sorted.length === 0 && (
          <div style={{textAlign:'center',padding:48,color:C.amber}}>
            <div style={{fontSize:32,marginBottom:10}}>✨</div>
            <div style={{fontSize:15,fontWeight:500,color:C.ink}}>No one on the waitlist — all caught up!</div>
            <div style={{fontSize:13,color:C.gray,marginTop:6}}>Add someone manually or they can join via the booking form.</div>
          </div>
        )}
        {!loading && sorted.map(entry => {
          const days = daysSince(entry.created_at);
          const evLabel = EVT_TYPE_OPTS.find(o => o.val === entry.event_type)?.label || entry.event_type || '';
          const hasNotes = !!entry.notes;
          const notesOpen = expandedNotes[entry.id];
          return (
            <div key={entry.id} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 18px',transition:'border-color 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.rosa}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
              <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                {/* Status dot */}
                <div style={{paddingTop:4}}>
                  <div style={statusDot(entry.status)} title={entry.status}/>
                </div>
                {/* Main info */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:600,color:C.ink}}>{entry.name}</span>
                    {entry.status === 'contacted' && (
                      <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:999,background:'var(--bg-info)',color:'var(--color-info)'}}>Contacted</span>
                    )}
                    {evLabel && (
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:999,background:C.rosaPale,color:C.rosa,fontWeight:500}}>{evLabel}</span>
                    )}
                    {entry.source === 'booking_form' && (
                      <span style={{fontSize:10,padding:'2px 7px',borderRadius:999,background:C.ivory,color:C.gray,border:`1px solid ${C.border}`}}>Booking form</span>
                    )}
                    {entry.source === 'phone' && (
                      <span style={{fontSize:10,padding:'2px 7px',borderRadius:999,background:C.ivory,color:C.gray,border:`1px solid ${C.border}`}}>Phone</span>
                    )}
                  </div>
                  <div style={{fontSize:12,color:C.gray,display:'flex',flexWrap:'wrap',gap:12,marginBottom:6}}>
                    {entry.phone && <span>📞 {entry.phone}</span>}
                    {entry.email && <span>✉ {entry.email}</span>}
                    {entry.preferred_date && (
                      <span>🗓 {new Date(entry.preferred_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}{entry.flexible_dates && ' · 📅 Flexible'}</span>
                    )}
                    {!entry.preferred_date && entry.flexible_dates && <span>📅 Flexible dates</span>}
                    <span style={{color:days > 14 ? C.amber : C.gray}}>Waiting {days} day{days !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Notes toggle */}
                  {hasNotes && (
                    <div>
                      <button onClick={() => toggleNotes(entry.id)}
                        style={{background:'none',border:'none',padding:0,cursor:'pointer',fontSize:12,color:C.rosa,textDecoration:'underline'}}>
                        {notesOpen ? 'Hide notes' : 'Show notes'}
                      </button>
                      {notesOpen && (
                        <div style={{marginTop:6,padding:'8px 12px',background:C.ivory,borderRadius:8,fontSize:12,color:C.ink,lineHeight:1.5}}>
                          {entry.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Actions */}
                <div style={{display:'flex',gap:6,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
                  {entry.status === 'waiting' && (
                    <button
                      onClick={() => handleMarkContacted(entry.id)}
                      style={{fontSize:11,padding:'5px 10px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.gray,cursor:'pointer',whiteSpace:'nowrap'}}>
                      📞 Mark contacted
                    </button>
                  )}
                  <button
                    onClick={() => setBookingEntry(entry)}
                    style={{fontSize:11,padding:'5px 10px',borderRadius:8,border:`1px solid ${'var(--color-success)'}`,background:'var(--bg-success)',color:'var(--color-success)',cursor:'pointer',whiteSpace:'nowrap'}}>
                    ✅ Mark booked
                  </button>
                  <button
                    onClick={() => handleRemove(entry.id)}
                    style={{fontSize:11,padding:'5px 10px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.gray,cursor:'pointer'}}>
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <AddWaitlistModal
          onClose={() => setShowAdd(false)}
          onSave={addToWaitlist}
        />
      )}
      {bookingEntry && (
        <MarkBookedModal
          entry={bookingEntry}
          onClose={() => setBookingEntry(null)}
          onJustMark={() => handleJustMark(bookingEntry.id)}
          onCreateEvent={() => handleCreateEvent(bookingEntry)}
        />
      )}
    </div>
  );
};

// ─── CSV EXPORT HELPER ─────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  if (!rows || rows.length === 0) return;
  const header = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// ─── EVENT ROW (with swipe gestures) ──────────────────────────────────────
function EventRow({ev,swipedId,setSwipedId,setSelectedEvent,setScreen,duplicateEvent,duplicating,setDuplicating,toast,isSelected,onToggleSelect,anySelected}) {
  const openDetail = useCallback(() => { setSelectedEvent(ev.id); setScreen('event_detail'); }, [ev.id,setSelectedEvent,setScreen]);
  const [showDupConfirm,setShowDupConfirm]=useState(false);
  const swipe = useSwipe({
    onSwipeLeft: openDetail,
    onSwipeRight: () => setSwipedId(id => id === ev.id ? null : ev.id),
  });
  return (
    <div style={{position:'relative',borderRadius:12,overflow:'hidden',display:'flex',alignItems:'stretch',gap:0}}>
      {/* Checkbox column */}
      <div
        style={{display:'flex',alignItems:'center',justifyContent:'center',width:36,flexShrink:0,opacity:anySelected||isSelected?1:0,transition:'opacity 0.15s'}}
        className="evt-chk-col"
        onClick={e=>{e.stopPropagation();onToggleSelect(ev.id);}}
      >
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={e=>{e.stopPropagation();onToggleSelect(ev.id);}}
          onClick={e=>e.stopPropagation()}
          style={{width:16,height:16,cursor:'pointer',accentColor:C.rosa,flexShrink:0}}
        />
      </div>
      {/* Main card */}
      {(()=>{
        // Derive card status for left-border accent
        const isOverdue = ev.overdue > 0;
        const isFullyPaid = Number(ev.paid) >= Number(ev.total) && Number(ev.total) > 0;
        const isSoon = !isOverdue && ev.daysUntil >= 0 && ev.daysUntil <= 14;
        const isPast = ev.daysUntil < 0 && !isOverdue;
        const accentColor = isSelected ? C.rosa
          : isOverdue   ? '#EF4444'
          : isSoon      ? '#F59E0B'
          : isFullyPaid ? '#10B981'
          : isPast      ? '#9CA3AF'
          : C.borderDark;
        return (
      <div
        {...swipe}
        onClick={openDetail}
        style={{background:C.white,border:`1px solid ${isSelected?C.rosa:isOverdue?'#FCA5A5':C.border}`,borderLeft:`4px solid ${accentColor}`,borderRadius:12,paddingTop:14,paddingBottom:14,paddingLeft:14,paddingRight:18,cursor:'pointer',transition:'border-color 0.15s',position:'relative',flex:1}}
        onMouseEnter={e=>{e.currentTarget.parentElement.querySelector('.evt-chk-col').style.opacity='1';e.currentTarget.style.borderColor=isSelected?C.rosa:isOverdue?'#F87171':C.rosa;e.currentTarget.style.borderLeftColor=accentColor;}}
        onMouseLeave={e=>{if(!anySelected&&!isSelected)e.currentTarget.parentElement.querySelector('.evt-chk-col').style.opacity='0';e.currentTarget.style.borderColor=isSelected?C.rosa:isOverdue?'#FCA5A5':C.border;e.currentTarget.style.borderLeftColor=accentColor;}}
      >
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:12,flex:1,minWidth:0}}>
            <Avatar initials={ev.client.split(' ').map(w=>w[0]).slice(0,2).join('')} size={40} bg={ev.type==='wedding'?C.rosaPale:C.purpleBg} color={ev.type==='wedding'?C.rosa:C.purple}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                <span style={{fontSize:14,fontWeight:500,color:C.ink}}>{ev.client}</span>
                <EventTypeBadge type={ev.type}/>
                {ev.overdue>0&&<Badge text="Overdue payment" bg='var(--bg-danger)' color='var(--color-danger)'/>}
              </div>
              <div style={{fontSize:12,color:C.gray,marginBottom:8}}>{ev.venue} · {ev.guests} guests · {ev.date}</div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {ev.services.map(s=><SvcTag key={s} svc={s}/>)}
              </div>
            </div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontSize:15,fontWeight:500,color:C.ink}}>{fmt(ev.total)}</div>
            {ev.overdue>0
              ?<div style={{fontSize:12,color:'var(--color-danger)',marginTop:2}}>{fmt(ev.overdue)} overdue</div>
              :<div style={{fontSize:12,color:'var(--color-success)',marginTop:2}}>{pct(ev.paid,ev.total)}% paid</div>}
            <div style={{marginTop:6}}><Countdown days={ev.daysUntil}/></div>
            {duplicateEvent&&!showDupConfirm&&(
              <button
                onClick={e=>{e.stopPropagation();setShowDupConfirm(true);}}
                style={{marginTop:6,fontSize:11,padding:'3px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',display:'block',width:'100%'}}
                disabled={duplicating===ev.id}
              >📋 Duplicate</button>
            )}
            {duplicateEvent&&showDupConfirm&&(
              <div onClick={e=>e.stopPropagation()} style={{marginTop:6,background:C.rosaPale,border:`1px solid ${C.petal}`,borderRadius:8,padding:'8px 10px',fontSize:11,textAlign:'left'}}>
                <div style={{color:C.inkMid,marginBottom:6,lineHeight:1.4}}>Duplicate this event? A new draft will be created with the same type, services, and package.</div>
                <div style={{display:'flex',gap:6}}>
                  <button
                    onClick={async e=>{
                      e.stopPropagation();
                      setShowDupConfirm(false);
                      setDuplicating(ev.id);
                      const {data:copy,error}=await duplicateEvent(ev.id);
                      setDuplicating(null);
                      if(error){toast('Failed to duplicate event','error');return;}
                      toast('Event duplicated! Edit the details to complete it.','success');
                      setSelectedEvent(copy.id);
                      setScreen('event_detail');
                    }}
                    style={{flex:1,padding:'4px 0',borderRadius:6,border:'none',background:C.rosa,color:C.white,cursor:'pointer',fontSize:11,fontWeight:500}}
                    disabled={duplicating===ev.id}
                  >{duplicating===ev.id?'Duplicating…':'Confirm'}</button>
                  <button
                    onClick={e=>{e.stopPropagation();setShowDupConfirm(false);}}
                    style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:11}}
                  >Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
          <ProgressBar paid={ev.paid} total={ev.total} height={4}/>
        </div>
      </div>
        );
      })()}
      {/* Swipe-right action reveal */}
      {swipedId === ev.id && (
        <div style={{
          position:'absolute', right:0, top:0, bottom:0,
          display:'flex', alignItems:'stretch',
          borderRadius:'0 12px 12px 0', overflow:'hidden',
          boxShadow:'-2px 0 8px rgba(0,0,0,0.12)',
        }}>
          <button
            onClick={e=>{e.stopPropagation();openDetail();setSwipedId(null);}}
            style={{height:'100%',padding:'0 22px',background:'#7C3AED',color:'#fff',border:'none',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}
          >
            Open
          </button>
        </div>
      )}
    </div>
  );
}

// ─── EVENTS LIST ───────────────────────────────────────────────────────────
const EventsList = ({setScreen,setSelectedEvent,events,createEvent,duplicateEvent,clients=[],inventory=[],alterations=[]}) => {
  const toast = useToast();
  const { boutique } = useAuth();
  const [view,setView]=useState('calendar'); // calendar is default
  const [listFilter,setListFilter]=useState('all');
  const [duplicating,setDuplicating]=useState(null);
  const [showNew,setShowNew]=useState(false);
  const [newEventDate,setNewEventDate]=useState('');
  const [swipedId,setSwipedId]=useState(null);
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [bulkWorking,setBulkWorking]=useState(false);
  const [showStatusMenu,setShowStatusMenu]=useState(false);
  const [showCoordMenu,setShowCoordMenu]=useState(false);
  const [staff,setStaff]=useState([]);
  const { getStaff } = useBoutique();
  useEffect(()=>{getStaff().then(({data})=>{if(data?.length)setStaff(data);});},[]);
  const { waitlist: waitlistEntries } = useWaitlist();
  const waitlistCount = waitlistEntries.length;

  useEffect(()=>{
    const hint=sessionStorage.getItem('belori_autoopen');
    if(hint==='new_event'){sessionStorage.removeItem('belori_autoopen');setShowNew(true);}
  },[]);
  useEffect(()=>{
    const handler=()=>setShowNew(true);
    window.addEventListener('belori:new-event',handler);
    return ()=>window.removeEventListener('belori:new-event',handler);
  },[]);

  const isWaitlist = view==='list' && listFilter==='waitlist';
  const filtered = events.filter(e=>
    listFilter==='all'||
    (listFilter==='wedding'&&e.type==='wedding')||
    (listFilter==='quince'&&e.type==='quince')||
    (listFilter==='other'&&!['wedding','quince'].includes(e.type))
  );
  const anySelected = selectedIds.size > 0;
  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));

  const toggleSelect = (id) => setSelectedIds(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAll = () => setSelectedIds(allFilteredSelected ? new Set() : new Set(filtered.map(e=>e.id)));
  const clearSelection = () => { setSelectedIds(new Set()); setShowStatusMenu(false); setShowCoordMenu(false); };

  const bulkChangeStatus = async (status) => {
    if(!selectedIds.size||bulkWorking) return;
    setBulkWorking(true); setShowStatusMenu(false);
    const ids=[...selectedIds];
    const {error}=await supabase.from('events').update({status}).in('id',ids);
    if(error) toast('Failed to update status','error');
    else { toast(`${ids.length} event${ids.length!==1?'s':''} marked ${status} ✓`); clearSelection(); }
    setBulkWorking(false);
  };
  const bulkAssignCoordinator = async (userId) => {
    if(!selectedIds.size||bulkWorking) return;
    setBulkWorking(true); setShowCoordMenu(false);
    const ids=[...selectedIds];
    const {error}=await supabase.from('events').update({coordinator_id:userId}).in('id',ids);
    if(error) toast('Failed to assign coordinator','error');
    else { toast(`Coordinator assigned to ${ids.length} event${ids.length!==1?'s':''} ✓`); clearSelection(); }
    setBulkWorking(false);
  };
  const bulkExport = () => {
    const rows=filtered.filter(e=>selectedIds.has(e.id)).map(e=>({client:e.client||'',event_type:e.type||'',event_date:e.date||'',venue:e.venue||'',status:e.status||'',total:e.total||0,paid:e.paid||0}));
    downloadCSV(rows,'events-export.csv');
    toast(`${rows.length} events exported ✓`);
    clearSelection();
  };

  if (!events) return <SkeletonList count={5} style={{padding:'0 16px',marginTop:16}}/>;

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

      <Topbar title="Events"
        subtitle={`${events.length} active · ${events.filter(e=>e.type==='wedding').length} weddings · ${events.filter(e=>e.type==='quince').length} quinceañeras`}
        actions={<>
          {/* View toggle */}
          <div style={{display:'flex',border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden',flexShrink:0}}>
            <button onClick={()=>setView('calendar')} style={{padding:'6px 12px',border:'none',background:view==='calendar'?C.rosaPale:'transparent',color:view==='calendar'?C.rosa:C.gray,cursor:'pointer',fontSize:12,fontWeight:view==='calendar'?600:400,display:'flex',alignItems:'center',gap:4,transition:'all 0.15s'}}>
              📅 Calendar
            </button>
            <button onClick={()=>setView('list')} style={{padding:'6px 12px',border:'none',borderLeft:`1px solid ${C.border}`,background:view==='list'?C.rosaPale:'transparent',color:view==='list'?C.rosa:C.gray,cursor:'pointer',fontSize:12,fontWeight:view==='list'?600:400,display:'flex',alignItems:'center',gap:4,transition:'all 0.15s'}}>
              ☰ List
            </button>
          </div>
          <PrimaryBtn label="+ New event" onClick={()=>setShowNew(true)}/>
        </>}
      />

      {/* List-mode filter bar */}
      {view==='list'&&(
        <div style={{display:'flex',gap:8,padding:'10px 20px',background:C.white,borderBottom:`1px solid ${C.border}`,flexWrap:'wrap',alignItems:'center',position:'sticky',top:0,zIndex:10}}>
          {anySelected&&(
            <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',marginRight:4}}>
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} style={{width:16,height:16,cursor:'pointer',accentColor:C.rosa}}/>
              <span style={{fontSize:11,color:C.gray}}>All</span>
            </label>
          )}
          {[['all','All events'],['wedding','Weddings'],['quince','Quinceañeras'],['other','Other']].map(([f,lbl])=>(
            <button key={f} onClick={()=>setListFilter(f)} style={{fontSize:12,padding:'5px 14px',borderRadius:999,border:`1px solid ${listFilter===f?C.rosa:C.border}`,background:listFilter===f?C.rosaPale:'transparent',color:listFilter===f?C.rosa:C.gray,cursor:'pointer',fontWeight:listFilter===f?500:400}}>{lbl}</button>
          ))}
          <button onClick={()=>setListFilter('waitlist')} style={{fontSize:12,padding:'5px 14px',borderRadius:999,border:`1px solid ${listFilter==='waitlist'?C.amber:C.border}`,background:listFilter==='waitlist'?C.amberBg:'transparent',color:listFilter==='waitlist'?C.amber:C.gray,cursor:'pointer',fontWeight:listFilter==='waitlist'?500:400,display:'flex',alignItems:'center',gap:5}}>
            <span>Waitlist</span>
            {waitlistCount>0&&<span style={{minWidth:18,height:18,borderRadius:999,background:listFilter==='waitlist'?C.amber:'#9ca3af',color:'#fff',fontSize:10,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 5px'}}>{waitlistCount}</span>}
          </button>
        </div>
      )}

      {/* Calendar view */}
      {view==='calendar'&&(
        <CalendarView
          events={events} inventory={inventory} alterations={alterations}
          setScreen={setScreen} setSelectedEvent={setSelectedEvent}
          onAddEvent={(date)=>{setNewEventDate(date);setShowNew(true);}}
          boutique={boutique}
        />
      )}

      {/* List view */}
      {view==='list'&&isWaitlist&&<WaitlistView setScreen={setScreen} setSelectedEvent={setSelectedEvent}/>}
      {view==='list'&&!isWaitlist&&(
        <div className="page-scroll" style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:10}}>
          {filtered.length===0&&(
            listFilter==='all'&&events.length===0 ? (
              <div style={{textAlign:'center',padding:'60px 20px',color:C.gray,maxWidth:440,margin:'40px auto',background:C.white,borderRadius:16,border:`1px dashed ${C.border}`}}>
                <div style={{fontSize:48,marginBottom:16}}>💍</div>
                <div style={{fontSize:16,fontWeight:600,color:C.ink,marginBottom:6}}>No events yet</div>
                <div style={{fontSize:13,color:C.gray,marginBottom:24,lineHeight:1.6}}>Create your first event to get started tracking clients, milestones, and appointments.</div>
                <button onClick={()=>setShowNew(true)} style={{padding:'10px 24px',borderRadius:10,border:'none',background:C.rosa,color:C.white,fontSize:13,fontWeight:600,cursor:'pointer'}}>+ Create your first event</button>
              </div>
            ) : (
              <div style={{textAlign:'center',padding:'60px 20px',color:C.gray,maxWidth:400,margin:'40px auto'}}>
                <div style={{fontSize:36,marginBottom:8}}>🔍</div>
                <div style={{fontSize:14,fontWeight:500,color:C.ink,marginBottom:4}}>No events match your filters</div>
                <div style={{fontSize:12,marginBottom:20}}>Try a different filter or clear your selection.</div>
                <button onClick={()=>setListFilter('all')} style={{padding:'7px 18px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.gray,fontSize:12,cursor:'pointer',fontWeight:500}}>Clear filters</button>
              </div>
            )
          )}
          {filtered.map(ev=>(
            <EventRow key={ev.id} ev={ev} swipedId={swipedId} setSwipedId={setSwipedId}
              setSelectedEvent={setSelectedEvent} setScreen={setScreen}
              duplicateEvent={duplicateEvent} duplicating={duplicating} setDuplicating={setDuplicating}
              toast={toast} isSelected={selectedIds.has(ev.id)} onToggleSelect={toggleSelect} anySelected={anySelected}/>
          ))}
        </div>
      )}

      {showNew&&<CreateEventModal onClose={()=>{setShowNew(false);setNewEventDate('');}} onSave={async(payload)=>{const result=await(createEvent||((p)=>Promise.resolve({})))(payload);setShowNew(false);setNewEventDate('');if(result?.data?.id&&setSelectedEvent&&setScreen){setSelectedEvent(result.data.id);setScreen('event_detail');}return result;}} clients={clients} inventory={inventory} defaultDate={newEventDate}/>}

      {/* Bulk action bar (list only) */}
      {anySelected&&view==='list'&&(
        <div style={{position:'fixed',bottom:16,left:'50%',transform:'translateX(-50%)',zIndex:200,background:C.white,borderRadius:999,boxShadow:'0 4px 24px rgba(0,0,0,0.18)',padding:'10px 18px',display:'flex',alignItems:'center',gap:10,maxWidth:600,border:`1px solid ${C.border}`}}>
          <span style={{fontSize:13,fontWeight:600,color:C.rosa,whiteSpace:'nowrap'}}>✓ {selectedIds.size} selected</span>
          <div style={{position:'relative'}}>
            <button onClick={()=>{setShowStatusMenu(s=>!s);setShowCoordMenu(false);}} disabled={bulkWorking} style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>Change status ▾</button>
            {showStatusMenu&&(
              <div style={{position:'absolute',bottom:'calc(100% + 6px)',left:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',zIndex:10,minWidth:150,overflow:'hidden'}}>
                {[['active','Active'],['confirmed','Confirmed'],['completed','Completed'],['cancelled','Cancelled']].map(([val,lbl])=>(
                  <button key={val} onClick={()=>bulkChangeStatus(val)} style={{display:'block',width:'100%',padding:'9px 16px',border:'none',background:'none',textAlign:'left',fontSize:13,cursor:'pointer',color:C.ink}} onMouseEnter={e=>e.currentTarget.style.background=C.rosaPale} onMouseLeave={e=>e.currentTarget.style.background='none'}>{lbl}</button>
                ))}
              </div>
            )}
          </div>
          {staff.filter(s=>['owner','coordinator','Owner','Coordinator'].includes(s.role)).length>0&&(
            <div style={{position:'relative'}}>
              <button onClick={()=>{setShowCoordMenu(s=>!s);setShowStatusMenu(false);}} disabled={bulkWorking} style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>Assign coordinator ▾</button>
              {showCoordMenu&&(
                <div style={{position:'absolute',bottom:'calc(100% + 6px)',left:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',zIndex:10,minWidth:180,overflow:'hidden'}}>
                  {staff.filter(s=>['owner','coordinator','Owner','Coordinator'].includes(s.role)).map(s=>(
                    <button key={s.user_id} onClick={()=>bulkAssignCoordinator(s.user_id)} style={{display:'block',width:'100%',padding:'9px 16px',border:'none',background:'none',textAlign:'left',fontSize:13,cursor:'pointer',color:C.ink}} onMouseEnter={e=>e.currentTarget.style.background=C.rosaPale} onMouseLeave={e=>e.currentTarget.style.background='none'}>{s.name||s.email}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={bulkExport} disabled={bulkWorking} style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>Export CSV</button>
          <button onClick={clearSelection} style={{padding:'6px 10px',borderRadius:999,border:'none',background:'none',color:C.gray,fontSize:18,cursor:'pointer',lineHeight:1,marginLeft:4}}>×</button>
        </div>
      )}
    </div>
  );
};

export { EventsList };
export default EventsList;
