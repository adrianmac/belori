import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { C, fmt } from '../../lib/colors';
import { Avatar, Badge, Card, PrimaryBtn, GhostBtn, SvcTag, useToast, inputSt, LBL } from '../../lib/ui.jsx';
import { useClientInteractions, useClientTasks, usePipeline, useClientTagsData, useClientEvents, useLoyaltyTransactions } from '../../hooks/useClients';
import { useSmsMessages } from '../../hooks/useSmsMessages';
import { useMeasurements } from '../../hooks/useMeasurements';
import { TIER_CFG, TIER_THRESHOLDS, HOW_FOUND_LABELS, INTERACTION_CFG, PIPELINE_STAGES, TAG_CAT_COLORS } from './clientConfigs';
import { getTier, getNextTier, tierMedal, DEFAULT_LOYALTY_TIERS } from '../../lib/loyalty';

// ── Direct SMS Modal ─────────────────────────────────────────────────────────
function DirectSMSModal({ client, boutique, onClose, toast }) {
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const phone = client?.phone;

  const send = async () => {
    if (!text.trim() || !phone) return;
    setSending(true);
    const { error } = await supabase.from('client_interactions').insert({
      boutique_id: boutique.id,
      client_id: client.id,
      type: 'sms',
      title: 'SMS sent',
      body: text.trim(),
      occurred_at: new Date().toISOString(),
      is_editable: false,
      author_name: 'Staff',
    });
    try { await navigator.clipboard.writeText(text.trim()); } catch {}
    setSending(false);
    if (!error) {
      toast('SMS logged & copied to clipboard ✓');
      onClose();
    } else {
      toast('Failed to log SMS', 'error');
    }
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1200,padding:16}}>
      <div style={{background:C.white,borderRadius:16,width:420,boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontWeight:600,fontSize:15,color:C.ink}}>Send SMS</div>
            <div style={{fontSize:12,color:C.gray,marginTop:1}}>To: {client?.name} · {phone}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray}}>×</button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
          <textarea
            value={text}
            onChange={e=>setText(e.target.value)}
            placeholder={`Hi ${client?.name?.split(' ')[0]||'there'}! …`}
            rows={4}
            autoFocus
            style={{...inputSt,resize:'vertical',fontFamily:'inherit',lineHeight:1.5}}
          />
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:11,color:text.length>160?'#DC2626':C.gray}}>{text.length}/160 chars</span>
            <div style={{display:'flex',gap:8}}>
              <GhostBtn label="Cancel" onClick={onClose}/>
              <PrimaryBtn label={sending?'Sending…':'📨 Send & log'} onClick={send}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dress recommendation engine ──────────────────────────────────────────────
function getDressRecommendations(cl, inventory) {
  const gowns = (inventory || []).filter(d =>
    ['bridal_gown', 'quince_gown'].includes(d.category) &&
    d.status !== 'rented' &&
    (d.availQty === undefined || d.availQty === null || d.availQty > 0)
  );
  return gowns.map(dress => {
    let score = 0;
    const reasons = [];
    // Size match from latest measurements passed inline (cl.measurements = latest row)
    const latestMeas = cl._latestMeas;
    const bust = latestMeas ? parseFloat(latestMeas.bust) : null;
    if (bust && dress.size) {
      const sizeNum = parseInt(dress.size);
      const expectedSize = bust < 34 ? 2 : bust < 36 ? 4 : bust < 38 ? 6 : bust < 40 ? 8 : bust < 42 ? 10 : bust < 44 ? 12 : 14;
      if (Math.abs(sizeNum - expectedSize) <= 1) { score += 30; reasons.push('Size match'); }
      else if (Math.abs(sizeNum - expectedSize) <= 2) { score += 15; reasons.push('Close size'); }
    }
    // Style match from client style_themes
    const clientStyles = cl.style_themes || [];
    if (dress.notes) {
      for (const style of clientStyles) {
        if (dress.notes.toLowerCase().includes(style.toLowerCase())) {
          score += 20; reasons.push(style + ' style');
        }
      }
    }
    // Color match from comm_prefs.favoriteColors
    const clientColors = cl.comm_prefs?.favoriteColors || [];
    if (dress.color && clientColors.some(c => dress.color.toLowerCase().includes(c.toLowerCase()))) {
      score += 15; reasons.push('Color match');
    }
    // If no signals matched at all, give a small base score so at least some gowns surface
    // when measurements exist but exact size/color data is thin
    if (score === 0 && latestMeas) { score += 3; reasons.push(dress.category === 'quince_gown' ? 'Quince gown' : 'Bridal gown'); }
    return { ...dress, score, reasons };
  })
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

const ClientDetail = ({ cl, onBack, setSelectedEvent, setScreen, updateClient, adjustLoyaltyPoints, redeemPoints, adjustPoints, inventory }) => {
  const toast=useToast();
  const {boutique}=useAuth();
  const tier=cl.tier||'new';
  const tc=TIER_CFG[tier]||TIER_CFG.new;
  const initials=(cl.name||'').split(' ').map(w=>w[0]).slice(0,2).join('');
  const [tab,setTab]=useState('overview');
  const {interactions,addInteraction}=useClientInteractions(cl.id);
  const {clientTasks,addClientTask,toggleClientTask}=useClientTasks(cl.id);
  const {pipeline,addLead,moveLead}=usePipeline();
  const {tagDefs,clientTagIds,toggleTag,addTagDef}=useClientTagsData(cl.id);
  const {clientEvents,markMilestonePaid}=useClientEvents(cl.id);
  const {messages:smsMessages,loading:smsLoading,sendSms}=useSmsMessages(cl.id);
  const {measurements,loading:measLoading,createMeasurement,updateMeasurement,deleteMeasurement}=useMeasurements(cl.id);
  const [clientAppts,setClientAppts]=useState([]);
  const [clientMilestones,setClientMilestones]=useState([]);
  useEffect(()=>{
    if(!cl?.id||!boutique?.id)return;
    supabase.from('appointments').select('*, event:events(type,client_id)')
      .eq('boutique_id',boutique.id)
      .order('date',{ascending:false}).limit(50)
      .then(({data})=>setClientAppts((data||[]).filter(a=>a.event?.client_id===cl.id)));
    supabase.from('payment_milestones')
      .select('*, event:events(client_id,type)')
      .eq('boutique_id',boutique.id)
      .order('created_at',{ascending:false}).limit(50)
      .then(({data})=>setClientMilestones((data||[]).filter(m=>m.event?.client_id===cl.id)));
  },[cl?.id,boutique?.id]);
  const {transactions:loyaltyTxns,refetch:refetchTxns}=useLoyaltyTransactions(cl.id);
  const MEAS_FIELDS=[{key:'bust',label:'Bust'},{key:'waist',label:'Waist'},{key:'hips',label:'Hips'},{key:'height',label:'Height'}];
  const EMPTY_MEAS={bust:'',waist:'',hips:'',height:'',shoe_size:'',taken_by_name:'',notes:''};
  const [showMeasForm,setShowMeasForm]=useState(false);
  const [measDraft,setMeasDraft]=useState(EMPTY_MEAS);
  const [measSaving,setMeasSaving]=useState(false);
  const [editingMeasId,setEditingMeasId]=useState(null);
  const openEditMeas=(m)=>{setMeasDraft({bust:m.bust??'',waist:m.waist??'',hips:m.hips??'',height:m.height??'',shoe_size:m.shoe_size||'',taken_by_name:m.taken_by_name||'',notes:m.notes||''});setEditingMeasId(m.id);setShowMeasForm(true);};
  const [showAllMeasOv,setShowAllMeasOv]=useState(false);
  const [showMeasModal,setShowMeasModal]=useState(false);
  const [deleteMeasConfirm,setDeleteMeasConfirm]=useState(null); // meas id | null
  const [measModalSaving,setMeasModalSaving]=useState(false);
  const [measModalDraft,setMeasModalDraft]=useState(EMPTY_MEAS);
  const openAddMeas=()=>{setMeasDraft(EMPTY_MEAS);setEditingMeasId(null);setShowMeasForm(true);};
  const [measModalEditId,setMeasModalEditId]=useState(null);
  const openMeasModal=()=>{setMeasModalDraft(EMPTY_MEAS);setMeasModalEditId(null);setShowMeasModal(true);};
  const openMeasModalEdit=(m)=>{setMeasModalDraft({bust:m.bust??'',waist:m.waist??'',hips:m.hips??'',height:m.height??'',shoe_size:m.shoe_size||'',taken_by_name:m.taken_by_name||'',notes:m.notes||''});setMeasModalEditId(m.id);setShowMeasModal(true);};
  const handleSaveMeasModal=async()=>{
    setMeasModalSaving(true);
    let error;
    if(measModalEditId){({error}=await updateMeasurement(measModalEditId,measModalDraft));}
    else{({error}=await createMeasurement(measModalDraft));}
    setMeasModalSaving(false);
    if(!error){setShowMeasModal(false);setMeasModalDraft(EMPTY_MEAS);setMeasModalEditId(null);toast('Measurements saved');}else toast('Failed to save','warn');
  };
  const cancelMeasForm=()=>{setShowMeasForm(false);setEditingMeasId(null);setMeasDraft(EMPTY_MEAS);};
  const handleSaveMeas=async()=>{
    setMeasSaving(true);
    let error;
    if(editingMeasId){({error}=await updateMeasurement(editingMeasId,measDraft));}
    else{({error}=await createMeasurement(measDraft));}
    setMeasSaving(false);
    if(!error){cancelMeasForm();toast('Measurements saved');}else toast('Failed to save','warn');
  };
  const handleDeleteMeas=(id)=>setDeleteMeasConfirm(id);
  const confirmDeleteMeas=async()=>{
    if(!deleteMeasConfirm)return;
    const{error}=await deleteMeasurement(deleteMeasConfirm);
    setDeleteMeasConfirm(null);
    if(!error)toast('Deleted');else toast('Failed to delete','warn');
  };
  const [smsInput,setSmsInput]=useState('');
  const [smsSending,setSmsSending]=useState(false);
  const smsBubbleRef=useRef(null);
  useEffect(()=>{if(smsBubbleRef.current&&tab==='sms'){smsBubbleRef.current.scrollTop=smsBubbleRef.current.scrollHeight;}},[smsMessages,tab]);

  // SMS opt-out detection
  const OPT_OUT_KEYWORDS=/\b(STOP|UNSUBSCRIBE|CANCEL|QUIT)\b/i;
  const OPT_IN_KEYWORDS=/\b(START|UNSTOP)\b/i;
  const inboundMessages=smsMessages.filter(m=>m.direction!=='outbound');
  const hasOptOutKeyword=inboundMessages.some(m=>OPT_OUT_KEYWORDS.test(m.body||''));
  const hasOptInKeyword=inboundMessages.some(m=>OPT_IN_KEYWORDS.test(m.body||''));
  const prefOptOut=cl.comm_prefs?.sms_opt_out===true;
  const smsOptedOut=prefOptOut||hasOptOutKeyword;
  const smsResubscribed=!prefOptOut&&hasOptInKeyword&&hasOptOutKeyword;
  const [optOutSaving,setOptOutSaving]=useState(false);
  const handleToggleSmsOptOut=async()=>{
    setOptOutSaving(true);
    const newVal=!prefOptOut;
    await updateClient(cl.id,{comm_prefs:{...(cl.comm_prefs||{}),sms_opt_out:newVal}});
    setOptOutSaving(false);
    toast(newVal?'Client marked as opted out of SMS':'Client marked as SMS subscribed');
  };
  const [showDirectSMS,setShowDirectSMS]=useState(false);
  const [editContact,setEditContact]=useState(false);
  const [contactDraft,setContactDraft]=useState({phone:cl.phone||'',email:cl.email||'',language_preference:cl.language_preference||'en',partner_name:cl.partner_name||'',emergency_contact:cl.emergency_contact||'',birthday:cl.birthday||'',anniversary:cl.anniversary||'',birth_date:cl.birth_date||'',anniversary_date:cl.anniversary_date||''});
  // Warn on browser navigation when contact form is open
  useEffect(() => {
    if (!editContact) return;
    const handler = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editContact]);
  const [showAdjustPts,setShowAdjustPts]=useState(false);
  const [adjPts,setAdjPts]=useState({type:'add',points:'',reason:''});
  const [showRedeemModal,setShowRedeemModal]=useState(false);
  const [redeemDraft,setRedeemDraft]=useState({points:'',note:'',event_id:''});
  const [redeemSaving,setRedeemSaving]=useState(false);
  const [showAdjustModal,setShowAdjustModal]=useState(false);
  const [adjustDraft,setAdjustDraft]=useState({delta:'',note:''});
  const [adjustSaving,setAdjustSaving]=useState(false);
  const [showAllTxns,setShowAllTxns]=useState(false);
  // NPS / Satisfaction
  const [npsData,setNpsData]=useState([]);
  const [showLogRating,setShowLogRating]=useState(false);
  const [ratingDraft,setRatingDraft]=useState({score:null,comment:'',event_id:''});
  const [ratingSaving,setRatingSaving]=useState(false);
  const loadNps=useCallback(()=>{
    if(!cl?.id||!boutique?.id)return;
    supabase.from('nps_responses').select('id,score,comment,submitted_at').eq('client_id',cl.id).eq('boutique_id',boutique.id).order('submitted_at',{ascending:false}).limit(10).then(({data})=>setNpsData(data||[]));
  },[cl?.id,boutique?.id]);
  useEffect(()=>{ loadNps(); },[loadNps]);
  const handleSaveRating=async()=>{
    if(ratingDraft.score===null){toast('Select a score','warn');return;}
    setRatingSaving(true);
    await supabase.from('nps_responses').insert({boutique_id:boutique.id,client_id:cl.id,score:ratingDraft.score,comment:ratingDraft.comment||null,event_id:ratingDraft.event_id||null,source:'manual'});
    await supabase.from('clients').update({last_rating:ratingDraft.score}).eq('id',cl.id);
    await addInteraction({type:'note',title:'Satisfaction rating logged',body:`NPS score: ${ratingDraft.score}/10${ratingDraft.comment?` — ${ratingDraft.comment}`:''}`,author_name:boutique?.name||'Staff',occurred_at:new Date().toISOString(),is_editable:false});
    loadNps();
    setRatingSaving(false);
    setShowLogRating(false);
    setRatingDraft({score:null,comment:'',event_id:''});
    toast('Rating saved');
  };
  // Voice Notes
  const [voiceRecording,setVoiceRecording]=useState(false);
  const [voiceAudioUrl,setVoiceAudioUrl]=useState(null);
  const [voiceDuration,setVoiceDuration]=useState(0);
  const [voiceSaving,setVoiceSaving]=useState(false);
  const mediaRecorderRef=useRef(null);
  const chunksRef=useRef([]);
  const voiceTimerRef=useRef(null);
  const startVoiceRecording=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);
      mediaRecorderRef.current=mr;
      chunksRef.current=[];
      mr.ondataavailable=e=>chunksRef.current.push(e.data);
      mr.onstop=()=>{
        const blob=new Blob(chunksRef.current,{type:'audio/webm'});
        setVoiceAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t=>t.stop());
      };
      mr.start();
      setVoiceRecording(true);
      setVoiceDuration(0);
      voiceTimerRef.current=setInterval(()=>setVoiceDuration(d=>d+1),1000);
    }catch(e){
      toast('Microphone access required','warn');
    }
  };
  const stopVoiceRecording=()=>{
    mediaRecorderRef.current?.stop();
    clearInterval(voiceTimerRef.current);
    setVoiceRecording(false);
  };
  const saveVoiceNote=async()=>{
    if(!voiceAudioUrl)return;
    setVoiceSaving(true);
    try{
      const r=await fetch(voiceAudioUrl);
      const blob=await r.blob();
      const filename=`voice-${Date.now()}.webm`;
      const path=`${boutique.id}/${cl.id}/${filename}`;
      const{error:upErr}=await supabase.storage.from('voice-notes').upload(path,blob);
      if(upErr){
        if(upErr.message?.includes('Bucket not found')||upErr.message?.includes('not found')){
          toast('Storage not configured — create a "voice-notes" bucket in Supabase','warn');
        }else{
          toast('Upload failed: '+upErr.message,'warn');
        }
        setVoiceSaving(false);
        return;
      }
      const{data:{publicUrl}}=supabase.storage.from('voice-notes').getPublicUrl(path);
      await addInteraction({type:'voice_note',title:'Voice note',body:`[Voice note ${voiceDuration}s] ${publicUrl}`,author_name:boutique?.name||'Staff',occurred_at:new Date().toISOString(),is_editable:false});
      setVoiceAudioUrl(null);
      toast('Voice note saved');
    }catch(e){
      toast('Failed to save voice note','warn');
    }
    setVoiceSaving(false);
  };
  const discardVoiceNote=()=>{ setVoiceAudioUrl(null); setVoiceDuration(0); };
  const [showAddTask,setShowAddTask]=useState(false);
  const [taskDraft,setTaskDraft]=useState({text:'',category:'general',is_alert:false,due_date:''});
  const TL_FEED_FILTERS=[
    {id:'all',label:'All'},
    {id:'interaction',label:'Interactions'},
    {id:'sms',label:'SMS'},
    {id:'appointment',label:'Appointments'},
    {id:'milestone',label:'Payments'},
  ];
  const [tlFilter,setTlFilter]=useState('all');
  const [showAddInt,setShowAddInt]=useState(false);
  const [intDraft,setIntDraft]=useState({type:'note',body:'',duration_minutes:''});
  const [expandedEv,setExpandedEv]=useState(null);
  const [showMarkPaid,setShowMarkPaid]=useState(null);
  const [paidDraft,setPaidDraft]=useState({paid_date:'',payment_method:'cash',notes:''});
  const [showAddLead,setShowAddLead]=useState(null);
  const [leadDraft,setLeadDraft]=useState({lead_name:cl.name||'',lead_phone:cl.phone||'',event_type:'wedding',estimated_value:'',source:'',notes:''});
  const [showAddTag,setShowAddTag]=useState(false);
  const [tagDraft,setTagDraft]=useState({name:'',category:'internal'});
  const DEFAULT_COMM={sms_reminders:true,email_invoices:true,appt_reminders:true,marketing:false,birthday_sms:true,review_request:true};
  const [commPrefs,setCommPrefs]=useState({...DEFAULT_COMM,...(cl.comm_prefs||{})});
  const [commSaving,setCommSaving]=useState(false);
  const [flowerPrefs,setFlowerPrefs]=useState(cl.flower_prefs||'');
  const [flowerSaving,setFlowerSaving]=useState(false);
  const [styleThemes,setStyleThemes]=useState(cl.style_themes||[]);
  const [themesSaving,setThemesSaving]=useState(false);
  const points=cl.loyalty_points||cl.loyaltyPoints||0;
  const loyaltyTiers=boutique?.loyalty_tiers||DEFAULT_LOYALTY_TIERS;
  const currentTierObj=getTier(points,loyaltyTiers);
  const nextTierInfo=getNextTier(points,loyaltyTiers);
  const tierProgressPct=nextTierInfo
    ?Math.min(100,Math.round(((points-currentTierObj.min_points)/(nextTierInfo.tier.min_points-currentTierObj.min_points))*100))
    :100;
  // legacy compat
  const [tMin,tMax]=TIER_THRESHOLDS[tier]||[0,500];
  const nextTier={new:'Regular',regular:'Loyal',loyal:'VIP',vip:'Diamond',diamond:'Diamond'}[tier];
  const needed=tier==='diamond'?0:(tMax-points);
  const evList=clientEvents||cl.events||[];
  const totalSpent=evList.reduce((s,e)=>s+Number(e.total||0),0);
  const latestMeas=(measurements||[]).length>0?measurements[0]:null;
  const clWithMeas={...cl,_latestMeas:latestMeas};
  const dressRecs=getDressRecommendations(clWithMeas,inventory);
  const unifiedFeed=[
    ...interactions.map(i=>({...i,_feedType:'interaction',_date:i.occurred_at||i.created_at})),
    ...smsMessages.map(s=>({...s,_feedType:'sms',_date:s.created_at})),
    ...clientAppts.map(a=>({...a,_feedType:'appointment',_date:a.date+'T'+(a.time||'00:00:00')})),
    ...clientMilestones.map(m=>({...m,_feedType:'milestone',_date:m.paid_date||m.due_date||m.created_at})),
  ].sort((a,b)=>new Date(b._date)-new Date(a._date));
  const filteredFeed=tlFilter==='all'?unifiedFeed:unifiedFeed.filter(i=>i._feedType===tlFilter);
  const feedCounts={
    all:unifiedFeed.length,
    interaction:interactions.length,
    sms:smsMessages.length,
    appointment:clientAppts.length,
    milestone:clientMilestones.length,
  };
  function getFeedGroup(dateStr){
    if(!dateStr)return'Older';
    const d=new Date(dateStr);
    if(isNaN(d))return'Older';
    const now=new Date();
    const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const diff=todayStart-new Date(d.getFullYear(),d.getMonth(),d.getDate());
    if(diff<=0)return'Today';
    if(diff<=864e5)return'Yesterday';
    if(diff<=6*864e5)return'This week';
    if(d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear())return'This month';
    return'Older';
  }
  const GROUP_ORDER=['Today','Yesterday','This week','This month','Older'];
  function buildGroupedFeed(feed){
    const groups={};
    feed.forEach(item=>{
      const g=getFeedGroup(item._date);
      if(!groups[g])groups[g]=[];
      groups[g].push(item);
    });
    return GROUP_ORDER.filter(g=>groups[g]?.length>0).map(g=>({group:g,items:groups[g]}));
  }
  function fmtFeedDate(dateStr){
    if(!dateStr)return'—';
    const d=new Date(dateStr);
    if(isNaN(d))return'—';
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'});
  }
  function fmtApptTime(timeStr){
    if(!timeStr)return'';
    const[h,m]=timeStr.split(':').map(Number);
    const ampm=h>=12?'PM':'AM';
    const hr=h%12||12;
    return` · ${hr}:${String(m).padStart(2,'0')} ${ampm}`;
  }
  const APPT_TYPE_LABELS={fitting:'Fitting',consultation:'Consultation',pickup:'Pickup',alteration:'Alteration',other:'Appointment'};
  const EVT_TYPE_LABELS={wedding:'Wedding',quinceañera:'Quinceañera',quinceanera:'Quinceañera'};
  const openTasks=(clientTasks||[]).filter(t=>!t.done).sort((a,b)=>{
    if(a.is_alert!==b.is_alert)return a.is_alert?-1:1;
    if(a.due_date&&b.due_date)return new Date(a.due_date)-new Date(b.due_date);
    if(a.due_date)return -1;if(b.due_date)return 1;return 0;
  });
  const saveContact=async()=>{if(updateClient)await updateClient(cl.id,contactDraft);setEditContact(false);toast('Contact saved');};
  const handleAddInteraction=async()=>{
    if(!intDraft.body.trim())return;
    const ic=INTERACTION_CFG[intDraft.type]||INTERACTION_CFG.note;
    await addInteraction({type:intDraft.type,title:ic.label,body:intDraft.body.trim(),author_name:boutique?.name||'Staff',duration_minutes:intDraft.duration_minutes?Number(intDraft.duration_minutes):null,occurred_at:new Date().toISOString()});
    setIntDraft({type:'note',body:'',duration_minutes:''});setShowAddInt(false);toast('Interaction logged');
  };
  const handleAddTask=async()=>{
    if(!taskDraft.text.trim())return;
    await addClientTask({text:taskDraft.text.trim(),category:taskDraft.category,is_alert:taskDraft.is_alert,due_date:taskDraft.due_date||null,created_by_name:boutique?.name||'Staff'});
    setTaskDraft({text:'',category:'general',is_alert:false,due_date:''});setShowAddTask(false);toast('Task added');
  };
  const handleMarkPaid=async()=>{
    if(!showMarkPaid)return;
    const today=new Date().toISOString().split('T')[0];
    await markMilestonePaid(showMarkPaid.id,{paid_date:paidDraft.paid_date||today,payment_method:paidDraft.payment_method});
    setShowMarkPaid(null);toast('Payment recorded');
  };
  const handleAddLead=async()=>{
    if(!leadDraft.lead_name.trim())return;
    await addLead({lead_name:leadDraft.lead_name.trim(),lead_phone:leadDraft.lead_phone.trim()||null,event_type:leadDraft.event_type,estimated_value:leadDraft.estimated_value?Number(leadDraft.estimated_value)*100:0,source:leadDraft.source||null,notes:leadDraft.notes||null,stage:showAddLead,client_id:cl.id});
    setShowAddLead(null);toast('Lead added');
  };
  const MIN_REDEEM=500;
  const POINTS_TO_DOLLAR=100;
  const redeemPts=Math.max(0,parseInt(redeemDraft.points)||0);
  const redeemDollarValue=(redeemPts/POINTS_TO_DOLLAR).toFixed(2);
  const redeemablePoints=Math.floor(points/MIN_REDEEM)*MIN_REDEEM;
  const handleRedeem=async()=>{
    const n=redeemPts;
    if(n<MIN_REDEEM){toast(`Minimum redemption is ${MIN_REDEEM} points`,'warn');return;}
    if(n>points){toast('Insufficient points','warn');return;}
    if(n%100!==0){toast('Points must be in multiples of 100','warn');return;}
    setRedeemSaving(true);
    const{error,dollarValue}=await redeemPoints({client_id:cl.id,points:n,note:redeemDraft.note||null,event_id:redeemDraft.event_id||null});
    if(!error){
      const dollarStr=`$${(n/POINTS_TO_DOLLAR).toFixed(2)}`;
      await addInteraction({type:'note',title:'Loyalty points redeemed',body:`Redeemed ${n.toLocaleString()} points (${dollarStr} discount)${redeemDraft.note?` — ${redeemDraft.note}`:''}`,author_name:boutique?.name||'Staff',occurred_at:new Date().toISOString(),related_event_id:redeemDraft.event_id||null,is_editable:false});
      refetchTxns();
      toast(`Redeemed ${n.toLocaleString()} pts = ${dollarStr} discount`);
      setShowRedeemModal(false);setRedeemDraft({points:'',note:'',event_id:''});
    }else toast(error.message||'Failed to redeem','warn');
    setRedeemSaving(false);
  };
  const handleAdjust=async()=>{
    const d=parseInt(adjustDraft.delta)||0;
    if(d===0){toast('Enter a non-zero amount','warn');return;}
    setAdjustSaving(true);
    await adjustPoints({client_id:cl.id,delta:d,note:adjustDraft.note||null});
    refetchTxns();
    toast(`Points ${d>0?'added':'removed'}: ${Math.abs(d).toLocaleString()} pts`);
    setShowAdjustModal(false);setAdjustDraft({delta:'',note:''});
    setAdjustSaving(false);
  };
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',height:52,background:C.white,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:C.gray,cursor:'pointer',background:'none',border:'none',padding:'8px 6px',minHeight:44}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>All clients
          </button>
          <span style={{color:C.borderDark,fontSize:14}}>›</span>
          <span style={{fontSize:13,fontWeight:500,color:C.ink}}>{cl.name}</span>
          <span style={{padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:500,background:tc.bg,color:tc.col,marginLeft:4}}>{tc.label}</span>
        </div>
        <div style={{display:'flex',gap:8}}>
          <GhostBtn label="Message" onClick={()=>{const p=cl.phone||'';if(/Mobi|Android/i.test(navigator.userAgent)){window.location.href=`sms:${p}`;}else{navigator.clipboard.writeText(p);toast('Phone copied');}}} style={{fontSize:12,padding:'6px 12px'}}/>
          <PrimaryBtn label="+ New event" onClick={()=>setScreen('events')} style={{fontSize:12,padding:'7px 14px'}}/>
        </div>
      </div>
      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.white,padding:'0 16px',flexShrink:0,overflowX:'auto'}}>
        {[['overview','Overview'],['measurements','📏 Measurements'],['timeline','Timeline'],['history','Event history'],['pipeline','Pipeline'],['tags','Tags & prefs'],['sms','💬 SMS']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'13px 14px',fontSize:12,fontWeight:tab===t?500:400,color:tab===t?C.rosaText:C.gray,border:'none',background:'transparent',cursor:'pointer',borderBottom:tab===t?`2px solid ${C.rosa}`:'2px solid transparent',whiteSpace:'nowrap',flexShrink:0}}>
            {l}
            {t==='timeline'&&unifiedFeed.length>0&&<span style={{marginLeft:5,padding:'1px 5px',borderRadius:999,fontSize:10,background:C.rosaPale,color:C.rosaText}}>{unifiedFeed.length}</span>}
            {t==='overview'&&openTasks.length>0&&<span style={{marginLeft:5,padding:'1px 5px',borderRadius:999,fontSize:10,background:'var(--bg-warning)',color:'var(--text-warning)'}}>{openTasks.length}</span>}
          </button>
        ))}
      </div>
      {editContact&&(
        <div style={{background:'#FFFBEB',borderBottom:`1px solid #FDE68A`,padding:'8px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <span style={{fontSize:12,color:'#92400E',flex:1}}>⚠️ You have unsaved changes in the contact form</span>
          <button onClick={()=>{setEditContact(false);setContactDraft({phone:cl.phone||'',email:cl.email||'',language_preference:cl.language_preference||'en',partner_name:cl.partner_name||'',emergency_contact:cl.emergency_contact||'',birthday:cl.birthday||'',anniversary:cl.anniversary||'',birth_date:cl.birth_date||'',anniversary_date:cl.anniversary_date||''});}} style={{fontSize:11,padding:'3px 10px',borderRadius:6,border:'1px solid #D97706',background:'#FEF3C7',color:'#92400E',cursor:'pointer',fontWeight:500,flexShrink:0}}>Discard</button>
        </div>
      )}
      {tab==='overview'&&(
        <div className="page-scroll" style={{flex:1,overflowY:'auto',padding:20}}>
          <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:16}}>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <Card>
                <div style={{padding:'20px 16px',textAlign:'center'}}>
                  <div style={{width:56,height:56,borderRadius:'50%',background:tc.avatarBg||tc.bg,color:tc.avatarCol||tc.col,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:500,margin:'0 auto 10px',border:tier==='diamond'?`2px solid ${tc.border||'#D4AF37'}`:'none'}}>{initials}</div>
                  <div style={{fontSize:16,fontWeight:500,color:C.ink,fontFamily:'Georgia,serif',marginBottom:2}}>{cl.name}</div>
                  <div style={{fontSize:11,color:C.gray,marginBottom:8}}>Client since {cl.created_at?new Date(cl.created_at).toLocaleDateString('en-US',{month:'short',year:'numeric'}):'—'}</div>
                  <span style={{padding:'4px 12px',borderRadius:999,fontSize:11,fontWeight:500,background:tc.bg,color:tc.col}}>{tc.label}</span>
                </div>
              </Card>
              <Card>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,fontWeight:500,color:C.ink}}>Contact</span>
                  <button onClick={()=>setEditContact(e=>!e)} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>{editContact?'Cancel':'Edit'}</button>
                </div>
                {editContact?(
                  <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:8,background:C.rosaPale}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                      <div><label htmlFor="cd-phone" style={LBL}>Phone</label><input id="cd-phone" value={contactDraft.phone} onChange={e=>setContactDraft(d=>({...d,phone:e.target.value}))} style={{...inputSt,fontSize:11,padding:'6px 8px'}}/></div>
                      <div><label htmlFor="cd-email" style={LBL}>Email</label><input id="cd-email" value={contactDraft.email} onChange={e=>setContactDraft(d=>({...d,email:e.target.value}))} style={{...inputSt,fontSize:11,padding:'6px 8px'}}/></div>
                    </div>
                    <div><label htmlFor="cd-partner" style={LBL}>Partner</label><input id="cd-partner" value={contactDraft.partner_name} onChange={e=>setContactDraft(d=>({...d,partner_name:e.target.value}))} style={{...inputSt,fontSize:11,padding:'6px 8px'}}/></div>
                    <div><label htmlFor="cd-lang" style={LBL}>Language</label><select id="cd-lang" value={contactDraft.language_preference} onChange={e=>setContactDraft(d=>({...d,language_preference:e.target.value}))} style={{...inputSt,fontSize:11,padding:'6px 8px'}}><option value="en">English</option><option value="es">Spanish</option><option value="both">Both</option></select></div>
                    <div><label htmlFor="cd-emergency" style={LBL}>Emergency contact</label><input id="cd-emergency" value={contactDraft.emergency_contact} onChange={e=>setContactDraft(d=>({...d,emergency_contact:e.target.value}))} placeholder="Name & phone" style={{...inputSt,fontSize:11,padding:'6px 8px'}}/></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                      <div><label htmlFor="cd-bday" style={LBL}>Birth Date</label><input id="cd-bday" type="date" value={contactDraft.birth_date||contactDraft.birthday} onChange={e=>setContactDraft(d=>({...d,birth_date:e.target.value,birthday:e.target.value}))} style={{...inputSt,fontSize:11,padding:'6px 8px'}}/></div>
                      <div><label htmlFor="cd-anniversary" style={LBL}>Anniversary Date</label><input id="cd-anniversary" type="date" value={contactDraft.anniversary_date||contactDraft.anniversary} onChange={e=>setContactDraft(d=>({...d,anniversary_date:e.target.value,anniversary:e.target.value}))} style={{...inputSt,fontSize:11,padding:'6px 8px'}}/></div>
                    </div>
                    <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}><GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setEditContact(false)} style={{fontSize:11,padding:'5px 10px'}}/><PrimaryBtn label="Save" colorScheme="success" onClick={saveContact} style={{fontSize:11,padding:'6px 12px'}}/></div>
                  </div>
                ):(
                  <div style={{padding:'10px 14px'}}>
                    {[['Phone',cl.phone||'—'],['Email',cl.email||'—'],['Language',cl.language_preference==='es'?'Spanish':cl.language_preference==='both'?'EN / ES':'English'],cl.partner_name&&['Partner',cl.partner_name],cl.emergency_contact&&['Emergency',cl.emergency_contact],(cl.birth_date||cl.birthday)&&['Birth Date',new Date((cl.birth_date||cl.birthday)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})],(cl.anniversary_date||cl.anniversary)&&['Anniversary',new Date((cl.anniversary_date||cl.anniversary)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})]].filter(Boolean).map(([k,v],i,arr)=>(
                      <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:i<arr.length-1?`1px solid ${C.border}`:'none',fontSize:12}}>
                        <span style={{color:C.gray}}>{k}</span>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontWeight:500,color:C.ink}}>{v}</span>
                          {k==='Phone'&&cl.phone&&(
                            <button onClick={()=>setShowDirectSMS(true)} title="Send SMS" style={{fontSize:11,padding:'2px 8px',borderRadius:8,border:`1px solid ${C.border}`,background:C.rosaPale,color:C.rosaText,cursor:'pointer',fontWeight:500,flexShrink:0}}>💬 SMS</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {(cl.no_show_count>0)&&(
                      <div style={{marginTop:6,display:'flex',justifyContent:'flex-end'}}>
                        <span style={{padding:'3px 10px',borderRadius:999,fontSize:11,fontWeight:600,background:cl.no_show_count>=3?C.redBg:C.amberBg,color:cl.no_show_count>=3?C.red:C.warningText,border:`1px solid ${cl.no_show_count>=3?C.red+'33':C.amber+'44'}`}}>
                          ⚠️ No-shows: {cl.no_show_count}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
              {/* ── COMMUNICATION PREFERENCES CARD ── */}
              <Card>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,fontWeight:500,color:C.ink}}>Communication</span>
                </div>
                <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
                  {[
                    {key:'sms_opt_out',label:'SMS messages',icon:'💬'},
                    {key:'email_opt_out',label:'Email messages',icon:'✉️'},
                  ].map(pref=>{
                    const optedOut=cl.comm_prefs?.[pref.key];
                    return(
                      <div key={pref.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span style={{fontSize:12,color:C.ink}}>{pref.icon} {pref.label}</span>
                        <button
                          role="switch"
                          aria-checked={!optedOut}
                          onClick={()=>updateClient(cl.id,{comm_prefs:{...(cl.comm_prefs||{}),[pref.key]:!optedOut}})}
                          style={{fontSize:11,padding:'3px 10px',borderRadius:12,border:`1px solid ${optedOut?'#EF4444':C.border}`,background:optedOut?'#FEE2E2':C.rosaPale,color:optedOut?'#991B1B':C.rosaText,cursor:'pointer',fontWeight:500}}>
                          {optedOut?'Opted out':'Active'}
                        </button>
                      </div>
                    );
                  })}
                  {cl.comm_prefs?.preferredContactTime&&(
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:4,borderTop:`1px solid ${C.border}`}}>
                      <span style={{fontSize:12,color:C.gray}}>⏰ Best time to reach</span>
                      <span style={{fontSize:12,fontWeight:500,color:C.ink}}>{{morning:'Morning (8am–12pm)',afternoon:'Afternoon (12pm–5pm)',evening:'Evening (5pm–8pm)',weekends:'Weekends only'}[cl.comm_prefs.preferredContactTime]||cl.comm_prefs.preferredContactTime}</span>
                    </div>
                  )}
                  {cl.language_preference&&(
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:4,borderTop:`1px solid ${C.border}`}}>
                      <span style={{fontSize:12,color:C.gray}}>Language</span>
                      <span style={{fontSize:12,fontWeight:500,color:C.ink}}>{cl.language_preference==='es'?'Spanish':cl.language_preference==='both'?'EN / ES':'English'}</span>
                    </div>
                  )}
                  {(cl.birth_date||cl.birthday)&&(
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span style={{fontSize:12,color:C.gray}}>🎂 Birthday</span>
                      <span style={{fontSize:12,fontWeight:500,color:C.ink}}>{new Date((cl.birth_date||cl.birthday)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                    </div>
                  )}
                </div>
              </Card>
              {/* ── LOYALTY TIER CARD ── */}
              <Card>
                <div style={{padding:'12px 14px'}}>
                  {/* Tier badge + points header */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <span style={{fontSize:20}}>{tierMedal(currentTierObj.name)}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:currentTierObj.color}}>{currentTierObj.name}</div>
                        <div style={{fontSize:10,color:C.gray}}>{points.toLocaleString()} pts</div>
                      </div>
                    </div>
                    <button onClick={()=>setShowAdjustPts(true)} style={{fontSize:10,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>Adjust</button>
                  </div>
                  {/* Progress bar */}
                  <div style={{height:6,background:C.border,borderRadius:3,overflow:'hidden',marginBottom:4}}>
                    <div style={{height:'100%',width:`${tierProgressPct}%`,background:`linear-gradient(90deg,${currentTierObj.color},${nextTierInfo?.tier.color||currentTierObj.color})`,borderRadius:3,transition:'width 0.4s'}}/>
                  </div>
                  {nextTierInfo
                    ?<div style={{fontSize:10,color:C.gray,marginBottom:10}}>{points.toLocaleString()} / {nextTierInfo.tier.min_points.toLocaleString()} to <strong style={{color:nextTierInfo.tier.color}}>{nextTierInfo.tier.name}</strong> ({nextTierInfo.pointsNeeded.toLocaleString()} pts needed)</div>
                    :<div style={{fontSize:10,color:C.gray,marginBottom:10}}>Maximum tier reached</div>
                  }
                  {/* Current tier perks */}
                  {currentTierObj.perks?.length>0&&(
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>Your perks</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {currentTierObj.perks.map((perk,i)=>(
                          <span key={i} style={{fontSize:10,padding:'2px 8px',borderRadius:999,background:currentTierObj.color+'22',color:currentTierObj.color,border:`1px solid ${currentTierObj.color}44`,fontWeight:500}}>{perk}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Next tier preview */}
                  {nextTierInfo&&(
                    <div style={{padding:'8px 10px',background:C.grayBg,borderRadius:8,border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:10,color:C.gray,marginBottom:4}}>{tierMedal(nextTierInfo.tier.name)} Next: <strong style={{color:nextTierInfo.tier.color}}>{nextTierInfo.tier.name}</strong></div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                        {(nextTierInfo.tier.perks||[]).map((p,i)=>(
                          <span key={i} style={{fontSize:9,padding:'1px 6px',borderRadius:999,background:'#F3F4F6',color:C.gray,border:`1px solid ${C.border}`}}>{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Redemption */}
                  {points>=500&&(
                    <div style={{marginTop:10,padding:'10px 12px',background:C.rosaPale,borderRadius:8,border:`1px solid ${C.rosa}22`}}>
                      <div style={{fontSize:11,color:C.gray,marginBottom:2}}>Redemption value</div>
                      <div style={{fontSize:13,fontWeight:600,color:C.rosaText,marginBottom:8}}>${(points/100).toFixed(2)} available</div>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>{setRedeemDraft({points:String(redeemablePoints),note:'',event_id:''});setShowRedeemModal(true);}} style={{flex:1,padding:'6px 0',borderRadius:7,border:`1px solid ${C.rosa}`,background:C.rosa,color:C.white,fontSize:11,cursor:'pointer',fontWeight:500}}>Redeem points</button>
                        <button onClick={()=>{setAdjustDraft({delta:'',note:''});setShowAdjustModal(true);}} style={{padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.gray,fontSize:11,cursor:'pointer',fontWeight:500}}>Adjust</button>
                      </div>
                    </div>
                  )}
                  {points<500&&redeemPoints&&(
                    <div style={{marginTop:10,display:'flex',justifyContent:'flex-end'}}>
                      <button onClick={()=>{setAdjustDraft({delta:'',note:''});setShowAdjustModal(true);}} style={{padding:'5px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.gray,fontSize:11,cursor:'pointer',fontWeight:500}}>Adjust points</button>
                    </div>
                  )}
                </div>
              </Card>
              {loyaltyTxns.length>0&&(
                <Card>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
                    <span style={{fontSize:12,fontWeight:500,color:C.ink}}>Points history</span>
                    {loyaltyTxns.length>10&&<button onClick={()=>setShowAllTxns(v=>!v)} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer'}}>{showAllTxns?'Show less':'Show all'}</button>}
                  </div>
                  <div style={{padding:'4px 0'}}>
                    {(showAllTxns?loyaltyTxns:loyaltyTxns.slice(0,10)).map(tx=>{
                      const isEarn=(tx.type==='earn'||(!tx.type&&tx.delta>0));
                      const isRedeem=tx.type==='redeem'||(tx.delta<0&&!tx.type);
                      const isClaimed=isRedeem&&(tx.reason||'').includes('[CLAIMED]');
                      const icon=isRedeem?'🎁':isEarn?'⭐':tx.type==='expire'?'⏰':'✏️';
                      const deltaColor=tx.delta>0?'var(--color-success)':'var(--color-danger)';
                      const sign=tx.delta>0?'+':'';
                      const displayReason=(tx.reason||'Points transaction').replace(' [CLAIMED]','');
                      return(
                        <div key={tx.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 14px',borderBottom:`1px solid ${C.border}`}}>
                          <span style={{fontSize:14,flexShrink:0}}>{icon}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                              <span style={{fontSize:12,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayReason}</span>
                              {isRedeem&&(
                                isClaimed
                                  ? <span style={{fontSize:9,padding:'1px 6px',borderRadius:999,background:'var(--bg-success,#DCFCE7)',color:'var(--text-success,#065F46)',fontWeight:600,flexShrink:0,border:'1px solid var(--color-success,#15803D)33'}}>Claimed</span>
                                  : <span style={{fontSize:9,padding:'1px 6px',borderRadius:999,background:'#FEF3C7',color:'#B45309',fontWeight:600,flexShrink:0,border:'1px solid #F59E0B33'}}>Pending</span>
                              )}
                            </div>
                            <div style={{fontSize:10,color:C.gray,marginTop:1}}>{tx.created_at?new Date(tx.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''}</div>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                            {isRedeem&&!isClaimed&&(
                              <button onClick={async()=>{await supabase.from('loyalty_transactions').update({reason:(tx.reason||'Points transaction')+' [CLAIMED]'}).eq('id',tx.id);refetchTxns();toast('Marked as claimed ✓');}} style={{fontSize:10,padding:'2px 8px',borderRadius:6,border:'1px solid var(--color-success,#15803D)',background:'var(--bg-success,#DCFCE7)',color:'var(--text-success,#065F46)',cursor:'pointer',fontWeight:500,whiteSpace:'nowrap'}}>Mark claimed</button>
                            )}
                            <span style={{fontSize:12,fontWeight:600,color:deltaColor}}>{sign}{tx.delta?.toLocaleString()} pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              {cl.how_found&&<Card><div style={{padding:'10px 14px',fontSize:12}}><div style={{color:C.gray,marginBottom:2}}>How found us</div><div style={{fontWeight:500,color:C.ink}}>{HOW_FOUND_LABELS[cl.how_found]||cl.how_found}</div></div></Card>}
              {/* NPS / Satisfaction */}
              <Card>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,fontWeight:500,color:C.ink}}>⭐ Satisfaction</span>
                  <button onClick={()=>setShowLogRating(true)} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>+ Log rating</button>
                </div>
                <div style={{padding:'10px 14px'}}>
                  {npsData.length===0?(
                    <div style={{fontSize:12,color:C.gray,textAlign:'center',padding:'8px 0'}}>No ratings yet</div>
                  ):(()=>{
                    const avg=Math.round((npsData.reduce((s,n)=>s+(n.score||0),0)/npsData.length)*10)/10;
                    const last=npsData[0];
                    const scoreColor=last.score>=9?C.green:last.score>=7?C.amber:last.score>=5?'#D97706':'#DC2626';
                    return(
                      <>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                          <div style={{width:36,height:36,borderRadius:'50%',background:avg>=9?C.greenBg:avg>=7?C.amberBg:C.redBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:avg>=9?C.green:avg>=7?C.warningText:'#DC2626',flexShrink:0}}>{avg}</div>
                          <div style={{fontSize:12,color:C.gray}}>avg · {npsData.length} rating{npsData.length!==1?'s':''}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 10px',background:C.grayBg,borderRadius:8}}>
                          <div style={{width:24,height:24,borderRadius:'50%',background:scoreColor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',flexShrink:0}}>{last.score}</div>
                          <div style={{flex:1,minWidth:0}}>
                            {last.comment&&<div style={{fontSize:11,color:C.ink,lineHeight:1.4,marginBottom:2}}>{last.comment}</div>}
                            <div style={{fontSize:10,color:C.gray}}>{new Date(last.submitted_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </Card>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                {[{label:'Total spent',val:fmt(totalSpent),col:'var(--color-success)'},{label:'Events',val:String(evList.length)},{label:'Last activity',val:cl.last_activity||cl.lastActivity||'—'}].map((s,i)=>(
                  <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:20,fontWeight:600,color:s.col||C.ink,lineHeight:1}}>{s.val}</div>
                    <div style={{fontSize:10,color:C.gray,marginTop:3}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <Card>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,fontWeight:500,color:C.ink}}>Open tasks {openTasks.length>0&&<span style={{marginLeft:4,padding:'1px 5px',borderRadius:999,fontSize:10,background:'var(--bg-warning)',color:'var(--text-warning)'}}>{openTasks.length}</span>}</span>
                  <button onClick={()=>setShowAddTask(true)} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>+ Add</button>
                </div>
                <div style={{padding:'8px 14px'}}>
                  {openTasks.length===0?(<div style={{fontSize:12,color:C.gray,textAlign:'center',padding:'8px 0'}}>No open tasks</div>):openTasks.map(t=>(
                    <div key={t.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'7px 0',borderBottom:`1px solid ${C.border}`}}>
                      <button onClick={()=>toggleClientTask(t.id,true)} style={{width:16,height:16,borderRadius:3,border:`1.5px solid ${t.is_alert?'var(--color-danger)':C.border}`,background:C.white,cursor:'pointer',flexShrink:0,marginTop:2}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:C.ink}}>{t.is_alert&&<span style={{color:'var(--text-danger)',marginRight:4}}>!</span>}{t.text}</div>
                        <div style={{fontSize:10,color:C.gray,marginTop:1}}>{t.category}{t.due_date?` · Due ${new Date(t.due_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`:''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              {interactions.length>0&&(
                <Card>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
                    <span style={{fontSize:12,fontWeight:500,color:C.ink}}>Recent activity</span>
                    <button onClick={()=>setTab('timeline')} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer'}}>View all →</button>
                  </div>
                  <div style={{padding:'8px 14px'}}>
                    {interactions.slice(0,3).map(i=>{
                      const ic=INTERACTION_CFG[i.type]||INTERACTION_CFG.note;
                      return(<div key={i.id} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:`1px solid ${C.border}`,alignItems:'flex-start'}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:ic.dot,marginTop:5,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}><span style={{fontSize:12,color:C.ink,fontWeight:500}}>{ic.label}</span>{i.body&&<div style={{fontSize:11,color:C.gray,marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.body}</div>}</div>
                        <div style={{fontSize:10,color:C.gray,flexShrink:0}}>{new Date(i.occurred_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                      </div>);
                    })}
                  </div>
                </Card>
              )}
              {/* ── MEASUREMENTS PANEL ── */}
              {(()=>{
                const latest=measurements&&measurements.length>0?measurements[0]:null;
                const bustVal=latest?parseFloat(latest.bust):null;
                function suggestedSize(b){
                  if(!b)return null;
                  if(b<32)return'0';
                  if(b<33)return'2';
                  if(b<34)return'4';
                  if(b<35)return'6';
                  if(b<36)return'8';
                  if(b<37)return'10';
                  if(b<38)return'12';
                  if(b<40)return'14';
                  if(b<42)return'16';
                  if(b<44)return'18';
                  return'20+';
                }
                const sz=suggestedSize(bustVal);
                return(
                  <Card>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
                      <span style={{fontSize:12,fontWeight:500,color:C.ink}}>📏 Measurements</span>
                      <button onClick={openMeasModal} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>+ Take Measurements</button>
                    </div>
                    <div style={{padding:'12px 14px'}}>
                      {latest?(
                        <>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                            {[['Bust',latest.bust],['Waist',latest.waist],['Hips',latest.hips],['Height',latest.height]].map(([lbl,val])=>(
                              <div key={lbl} style={{padding:'5px 10px',borderRadius:8,background:C.grayBg,border:`1px solid ${C.border}`,minWidth:64,textAlign:'center'}}>
                                <div style={{fontSize:10,color:C.gray,marginBottom:2}}>{lbl}</div>
                                <div style={{fontSize:13,fontWeight:600,color:val!=null?C.ink:C.borderDark}}>{val!=null?`${val}"`:'—'}</div>
                              </div>
                            ))}
                          </div>
                          {sz&&(
                            <div style={{marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                              <span style={{fontSize:11,color:C.gray}}>Suggested size:</span>
                              <span style={{padding:'2px 10px',borderRadius:999,fontSize:11,fontWeight:600,background:C.rosaPale,color:C.rosaText,border:`1px solid ${C.rosa}22`}}>{sz}</span>
                            </div>
                          )}
                        </>
                      ):(
                        <div style={{fontSize:12,color:C.gray,padding:'6px 0 10px',textAlign:'center'}}>No measurements recorded</div>
                      )}
                      {measurements&&measurements.length>0&&(()=>{
                        const rows=showAllMeasOv?measurements:measurements.slice(0,5);
                        return(
                          <>
                            <div style={{overflowX:'auto'}}>
                              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                                <thead>
                                  <tr>
                                    {['Date','Bust','Waist','Hips','Height','Shoe','Taken by','Notes',''].map((h,i)=>(
                                      <th key={i} style={{textAlign:'left',padding:'4px 6px',color:C.gray,fontWeight:500,borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map(m=>(
                                    <tr key={m.id} style={{borderBottom:`1px solid ${C.border}`}}>
                                      <td style={{padding:'5px 6px',color:C.gray,whiteSpace:'nowrap'}}>{new Date(m.taken_at||m.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'})}</td>
                                      <td style={{padding:'5px 6px',fontWeight:500,color:C.ink}}>{m.bust!=null?`${m.bust}"`:'—'}</td>
                                      <td style={{padding:'5px 6px',fontWeight:500,color:C.ink}}>{m.waist!=null?`${m.waist}"`:'—'}</td>
                                      <td style={{padding:'5px 6px',fontWeight:500,color:C.ink}}>{m.hips!=null?`${m.hips}"`:'—'}</td>
                                      <td style={{padding:'5px 6px',fontWeight:500,color:C.ink}}>{m.height!=null?`${m.height}"`:'—'}</td>
                                      <td style={{padding:'5px 6px',color:C.ink}}>{m.shoe_size||'—'}</td>
                                      <td style={{padding:'5px 6px',color:C.gray,whiteSpace:'nowrap'}}>{m.taken_by_name||'—'}</td>
                                      <td style={{padding:'5px 6px',color:C.gray,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.notes||'—'}</td>
                                      <td style={{padding:'5px 6px',whiteSpace:'nowrap'}}>
                                        <button onClick={()=>openMeasModalEdit(m)} title="Edit" style={{background:'none',border:'none',cursor:'pointer',padding:'2px 4px',color:C.gray,fontSize:13}}>✏️</button>
                                        <button onClick={()=>handleDeleteMeas(m.id)} title="Delete" style={{background:'none',border:'none',cursor:'pointer',padding:'2px 4px',color:C.red,fontSize:13}}>🗑️</button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {measurements.length>5&&(
                              <button onClick={()=>setShowAllMeasOv(v=>!v)} style={{marginTop:8,fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500,padding:0}}>{showAllMeasOv?'Show less':'Show all '+measurements.length+' entries'}</button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </Card>
                );
              })()}
              {/* ── DRESS RECOMMENDATIONS ── */}
              <Card>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,fontWeight:500,color:C.ink}}>👗 Dress Recommendations
                    {dressRecs.length>0&&<span style={{marginLeft:6,padding:'1px 6px',borderRadius:999,fontSize:10,background:C.rosaPale,color:C.rosaText}}>{dressRecs.length}</span>}
                  </span>
                  <button onClick={()=>setScreen('inventory')} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>View inventory →</button>
                </div>
                <div style={{padding:'10px 14px'}}>
                  {!latestMeas?(
                    <div style={{fontSize:12,color:C.gray,textAlign:'center',padding:'12px 0'}}>
                      Add measurements to get personalized dress recommendations.
                      <div style={{marginTop:8}}><button onClick={()=>setTab('measurements')} style={{fontSize:11,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}22`,borderRadius:7,padding:'5px 12px',cursor:'pointer',fontWeight:500}}>+ Add measurements</button></div>
                    </div>
                  ):dressRecs.length===0?(
                    <div style={{fontSize:12,color:C.gray,textAlign:'center',padding:'12px 0'}}>
                      No size or style matches found. Complete style preferences to get better recommendations.
                    </div>
                  ):(
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {dressRecs.map(dress=>(
                        <div key={dress.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 10px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white}}>
                          <div style={{width:36,height:36,borderRadius:8,background:C.rosaPale,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>👗</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.ink,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{dress.name}</div>
                            <div style={{fontSize:11,color:C.gray,marginBottom:5}}>
                              {dress.size&&<span style={{marginRight:8}}>Size {dress.size}</span>}
                              {dress.color&&<span style={{marginRight:8}}>{dress.color}</span>}
                              {dress.price>0&&<span style={{color:C.green,fontWeight:500}}>${Number(dress.price).toLocaleString()}</span>}
                            </div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                              {dress.reasons.map((r,i)=>(
                                <span key={i} style={{fontSize:10,padding:'2px 7px',borderRadius:999,background:C.rosaPale,color:C.rosaText,fontWeight:500,border:`1px solid ${C.rosa}22`}}>{r}</span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={()=>setScreen('inventory')}
                            style={{fontSize:11,padding:'5px 10px',borderRadius:7,border:`1px solid ${C.rosa}`,background:C.rosaPale,color:C.rosaText,cursor:'pointer',fontWeight:500,flexShrink:0,whiteSpace:'nowrap'}}
                          >Reserve</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
      {tab==='measurements'&&(
        <div className="page-scroll" style={{flex:1,overflowY:'auto',padding:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <span style={{fontSize:15,fontWeight:600,color:C.ink}}>Client measurements</span>
            {!showMeasForm&&<button onClick={openAddMeas} style={{padding:'7px 14px',borderRadius:8,background:C.rosa,color:'#fff',border:'none',fontSize:12,cursor:'pointer',fontWeight:500}}>+ Add measurement</button>}
          </div>
          {showMeasForm&&(
            <div style={{background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,color:C.ink,marginBottom:12}}>{editingMeasId?'Edit measurement':'Take measurements'}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                {MEAS_FIELDS.map(f=>(
                  <div key={f.key}>
                    <label htmlFor={`meas-inline-${f.key}`} style={LBL}>{f.label} <span style={{fontWeight:400,color:C.gray}}>(in)</span></label>
                    <input id={`meas-inline-${f.key}`} type="number" step="0.1" value={measDraft[f.key]} onChange={e=>setMeasDraft(d=>({...d,[f.key]:e.target.value}))} placeholder="—" style={{...inputSt,fontSize:12}}/>
                  </div>
                ))}
                <div>
                  <label htmlFor="meas-inline-shoe" style={LBL}>Shoe size</label>
                  <input id="meas-inline-shoe" value={measDraft.shoe_size} onChange={e=>setMeasDraft(d=>({...d,shoe_size:e.target.value}))} placeholder="e.g. 7.5" style={{...inputSt,fontSize:12}}/>
                </div>
                <div>
                  <label htmlFor="meas-inline-takenby" style={LBL}>Taken by <span style={{fontWeight:400,color:C.gray}}>(optional)</span></label>
                  <input id="meas-inline-takenby" value={measDraft.taken_by_name} onChange={e=>setMeasDraft(d=>({...d,taken_by_name:e.target.value}))} placeholder="Staff name" style={{...inputSt,fontSize:12}}/>
                </div>
              </div>
              <label htmlFor="meas-inline-notes" style={LBL}>Notes <span style={{fontWeight:400,color:C.gray}}>(optional)</span></label>
              <textarea id="meas-inline-notes" value={measDraft.notes} onChange={e=>setMeasDraft(d=>({...d,notes:e.target.value}))} placeholder="Any fitting notes…" rows={2} style={{...inputSt,resize:'vertical',fontSize:12,marginBottom:12,width:'100%',boxSizing:'border-box'}}/>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <GhostBtn label="Cancel" colorScheme="danger" onClick={cancelMeasForm} style={{fontSize:12}}/>
                <PrimaryBtn label={measSaving?'Saving…':'Save'} colorScheme="success" onClick={handleSaveMeas} style={{fontSize:12}}/>
              </div>
            </div>
          )}
          {measLoading?(
            <div style={{textAlign:'center',padding:'32px 16px',color:C.gray,fontSize:13}}>Loading…</div>
          ):measurements.length===0&&!showMeasForm?(
            <div style={{textAlign:'center',padding:'48px 16px',color:C.gray}}>
              <div style={{fontSize:32,marginBottom:10}}>📏</div>
              <div style={{fontSize:13}}>No measurements recorded yet</div>
              <button onClick={openAddMeas} style={{marginTop:12,fontSize:12,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>+ Add the first one</button>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {measurements.map(m=>(
                <div key={m.id} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 16px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.ink}}>{new Date(m.taken_at||m.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
                    <div style={{display:'flex',gap:6,flexShrink:0,marginLeft:8}}>
                      <button onClick={()=>openEditMeas(m)} title="Edit" style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" stroke={C.gray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button onClick={()=>handleDeleteMeas(m.id)} title="Delete" style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><polyline points="3,6 13,6" stroke={C.red} strokeWidth="1.5" strokeLinecap="round"/><path d="M6 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M5 6l.75 7.5h4.5L11 6" stroke={C.red} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:'6px 14px',marginBottom:m.notes?10:0}}>
                    {MEAS_FIELDS.filter(f=>m[f.key]!=null&&m[f.key]!=='').map(f=>(
                      <div key={f.key}>
                        <div style={{fontSize:10,color:C.gray,marginBottom:1}}>{f.label}</div>
                        <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{m[f.key]}<span style={{fontSize:10,color:C.gray,marginLeft:2}}>in</span></div>
                      </div>
                    ))}
                    {m.shoe_size&&(
                      <div>
                        <div style={{fontSize:10,color:C.gray,marginBottom:1}}>Shoe</div>
                        <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{m.shoe_size}</div>
                      </div>
                    )}
                  </div>
                  {m.notes&&(
                    <div style={{marginTop:8,padding:'8px 10px',background:C.grayBg,borderRadius:6,fontSize:12,color:C.gray,lineHeight:1.4}}>{m.notes}</div>
                  )}
                  <div style={{marginTop:8,fontSize:10,color:C.gray}}>
                    {m.taken_by_name&&<span>Taken by {m.taken_by_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab==='timeline'&&(
        <div className="page-scroll" style={{flex:1,overflowY:'auto',padding:20}}>
          {/* ── Filter pills ── */}
          <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            {TL_FEED_FILTERS.map(f=>(
              <button key={f.id} onClick={()=>setTlFilter(f.id)} style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${C.border}`,background:tlFilter===f.id?C.ink:C.white,color:tlFilter===f.id?C.white:C.gray,fontSize:11,cursor:'pointer',fontWeight:500,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:4}}>
                {f.label}
                {feedCounts[f.id]>0&&<span style={{padding:'0px 5px',borderRadius:999,fontSize:9,background:tlFilter===f.id?'rgba(255,255,255,0.25)':'var(--bg-warning,#FEF3C7)',color:tlFilter===f.id?C.white:'var(--text-warning,#92400E)',fontWeight:600,lineHeight:'16px'}}>{feedCounts[f.id]}</span>}
              </button>
            ))}
            <button onClick={()=>setShowAddInt(v=>!v)} style={{marginLeft:'auto',padding:'5px 14px',borderRadius:999,background:showAddInt?C.gray:C.rosa,color:'#fff',border:'none',fontSize:11,cursor:'pointer',fontWeight:500,flexShrink:0}}>{showAddInt?'Cancel':'+ Log'}</button>
          </div>
          {/* Voice note recorder */}
          <div style={{padding:'10px 12px',border:`1px solid ${C.border}`,borderRadius:10,background:C.white,marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,color:C.ink,marginBottom:8}}>🎙️ Voice note</div>
            {!voiceRecording&&!voiceAudioUrl&&(
              <button onClick={startVoiceRecording} style={{padding:'7px 16px',background:C.rosa,color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>● Record</button>
            )}
            {voiceRecording&&(
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'#DC2626'}}/>
                <span style={{fontSize:12,color:C.ink}}>Recording {voiceDuration}s</span>
                <button onClick={stopVoiceRecording} style={{padding:'5px 12px',background:'#DC2626',color:'#fff',border:'none',borderRadius:6,fontSize:12,cursor:'pointer'}}>■ Stop</button>
              </div>
            )}
            {voiceAudioUrl&&!voiceRecording&&(
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <audio src={voiceAudioUrl} controls style={{height:32,flex:1,minWidth:150}}/>
                <button onClick={saveVoiceNote} disabled={voiceSaving} style={{padding:'5px 12px',background:C.rosa,color:'#fff',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer'}}>{voiceSaving?'Saving…':'Save'}</button>
                <button onClick={discardVoiceNote} style={{padding:'5px 12px',background:'none',border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,cursor:'pointer',color:C.gray}}>Discard</button>
              </div>
            )}
          </div>
          {/* Log interaction form */}
          {showAddInt&&(
            <div style={{background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:10,padding:14,marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:10}}>Log new interaction</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                {Object.entries(INTERACTION_CFG).filter(([k])=>!['system','payment_received','payment_overdue','event_created','booking_confirmed'].includes(k)).map(([k,v])=>(
                  <button key={k} onClick={()=>setIntDraft(d=>({...d,type:k}))} style={{padding:'4px 10px',borderRadius:999,border:`1.5px solid ${intDraft.type===k?v.dot:C.border}`,background:intDraft.type===k?v.dot+'22':C.white,color:intDraft.type===k?v.dot:C.gray,fontSize:11,cursor:'pointer',fontWeight:intDraft.type===k?500:400}}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
              <textarea value={intDraft.body} onChange={e=>setIntDraft(d=>({...d,body:e.target.value}))} placeholder="Notes…" rows={3} style={{...inputSt,fontSize:12,resize:'vertical',marginBottom:8,width:'100%',boxSizing:'border-box'}}/>
              {['call_outbound','call_inbound','meeting'].includes(intDraft.type)&&(
                <div style={{marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
                  <div style={{...LBL,marginBottom:0}}>Duration (min)</div>
                  <input type="number" value={intDraft.duration_minutes} onChange={e=>setIntDraft(d=>({...d,duration_minutes:e.target.value}))} style={{...inputSt,fontSize:11,padding:'5px 8px',width:80}}/>
                </div>
              )}
              <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}><PrimaryBtn label="Save" colorScheme="success" onClick={handleAddInteraction} style={{fontSize:11,padding:'6px 14px'}}/></div>
            </div>
          )}
          {/* ── Unified feed ── */}
          {filteredFeed.length===0?(
            <div style={{textAlign:'center',padding:'48px 16px',color:C.gray,fontSize:13}}>
              {tlFilter==='all'?<>Nothing here yet.<br/><span onClick={()=>setShowAddInt(true)} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>Log the first interaction →</span></>:`No ${TL_FEED_FILTERS.find(f=>f.id===tlFilter)?.label.toLowerCase()||'items'} found.`}
            </div>
          ):(
            <div style={{position:'relative',paddingLeft:4}}>
              <div style={{position:'absolute',left:19,top:12,bottom:12,width:1,background:C.border,zIndex:0}}/>
              {buildGroupedFeed(filteredFeed).map(({group,items})=>(
                <div key={group}>
                  {/* Date group divider */}
                  <div style={{display:'flex',alignItems:'center',gap:8,margin:'8px 0 10px',paddingLeft:2,position:'relative',zIndex:1}}>
                    <div style={{width:38,flexShrink:0}}/>
                    <div style={{fontSize:10,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',background:C.grayBg,padding:'2px 10px',borderRadius:999,border:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{group}</div>
                    <div style={{flex:1,height:1,background:C.border}}/>
                  </div>
                  {items.map(item=>{
                    /* ── INTERACTION ── */
                    if(item._feedType==='interaction'){
                      const ic=INTERACTION_CFG[item.type]||INTERACTION_CFG.note;
                      return(<div key={'int-'+item.id} style={{display:'flex',gap:12,marginBottom:10,position:'relative'}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:ic.dot,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0,zIndex:1,marginTop:1}}>{ic.icon}</div>
                        <div style={{flex:1,background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',minWidth:0}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:item.body?4:0}}>
                            <div>
                              <span style={{fontSize:12,fontWeight:500,color:C.ink}}>{ic.label}</span>
                              {item.duration_minutes&&<span style={{fontSize:10,color:C.gray,marginLeft:6}}>{item.duration_minutes} min</span>}
                              {item.author_name&&<span style={{fontSize:10,color:C.gray,marginLeft:6}}>· {item.author_name}</span>}
                            </div>
                            <span style={{fontSize:10,color:C.gray,flexShrink:0,marginLeft:8}}>{fmtFeedDate(item.occurred_at||item.created_at)}</span>
                          </div>
                          {item.body&&item.type==='voice_note'&&item.body.includes('[Voice note')?(
                            <audio src={item.body.split('] ').slice(1).join('] ')} controls style={{height:28,width:'100%',marginTop:4}}/>
                          ):item.body?(
                            <div style={{fontSize:12,color:C.gray,lineHeight:1.5}}>{item.body}</div>
                          ):null}
                          {item.edited_at&&<div style={{fontSize:10,color:C.gray,marginTop:4,fontStyle:'italic'}}>Edited</div>}
                        </div>
                      </div>);
                    }
                    /* ── SMS ── */
                    if(item._feedType==='sms'){
                      const isOut=item.direction==='outbound';
                      const isFailed=item.status==='failed';
                      return(<div key={'sms-'+item.id} style={{display:'flex',gap:12,marginBottom:10,position:'relative'}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:C.blue,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0,zIndex:1,marginTop:1}}>💬</div>
                        <div style={{flex:1,background:C.white,border:`1px solid ${isFailed?C.red:C.border}`,borderRadius:10,padding:'10px 12px',minWidth:0}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <span style={{fontSize:11,fontWeight:600,padding:'2px 7px',borderRadius:999,background:isOut?C.rosaPale:C.grayBg,color:isOut?C.rosaText:C.gray,border:`1px solid ${isOut?C.petal:C.border}`}}>{isOut?'→ Sent':'← Received'}</span>
                              {isFailed&&<span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:999,background:C.redBg,color:C.red}}>Failed</span>}
                            </div>
                            <span style={{fontSize:10,color:C.gray,flexShrink:0,marginLeft:8}}>{fmtFeedDate(item.created_at)}</span>
                          </div>
                          <div style={{fontSize:12,color:C.gray,lineHeight:1.5}}>{item.body?.length>120?item.body.slice(0,120)+'…':item.body||''}</div>
                        </div>
                      </div>);
                    }
                    /* ── APPOINTMENT ── */
                    if(item._feedType==='appointment'){
                      const stCfg={confirmed:{bg:C.greenBg,col:C.green,txt:'Confirmed'},cancelled:{bg:C.redBg,col:C.red,txt:'Cancelled'},scheduled:{bg:C.blueBg,col:C.blue,txt:'Scheduled'},completed:{bg:C.grayBg,col:C.gray,txt:'Completed'}}[item.status]||{bg:C.grayBg,col:C.gray,txt:item.status||'Scheduled'};
                      const apptLabel=APPT_TYPE_LABELS[item.type]||'Appointment';
                      const evtLabel=item.event?.type?EVT_TYPE_LABELS[item.event.type]||item.event.type:null;
                      return(<div key={'appt-'+item.id} style={{display:'flex',gap:12,marginBottom:10,position:'relative'}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:C.green,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0,zIndex:1,marginTop:1}}>📅</div>
                        <div style={{flex:1,background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',minWidth:0}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                              <span style={{fontSize:12,fontWeight:500,color:C.ink}}>{apptLabel}</span>
                              {evtLabel&&<span style={{fontSize:10,color:C.gray}}>· {evtLabel}</span>}
                              <span style={{fontSize:10,fontWeight:500,padding:'2px 7px',borderRadius:999,background:stCfg.bg,color:stCfg.col}}>{stCfg.txt}</span>
                            </div>
                            <span style={{fontSize:10,color:C.gray,flexShrink:0,marginLeft:8}}>{fmtFeedDate(item.date)}</span>
                          </div>
                          <div style={{fontSize:12,color:C.gray}}>{item.date?new Date(item.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}):''}{fmtApptTime(item.time)}</div>
                          {item.note&&<div style={{fontSize:11,color:C.gray,marginTop:3,fontStyle:'italic'}}>{item.note}</div>}
                        </div>
                      </div>);
                    }
                    /* ── MILESTONE ── */
                    if(item._feedType==='milestone'){
                      const isPaid=item.status==='paid'||!!item.paid_date;
                      const isOverdue=!isPaid&&item.due_date&&new Date(item.due_date)<new Date();
                      const dotColor=isPaid?C.green:isOverdue?C.red:C.amber;
                      const evtLabel=item.event?.type?EVT_TYPE_LABELS[item.event.type]||item.event.type:null;
                      return(<div key={'ms-'+item.id} style={{display:'flex',gap:12,marginBottom:10,position:'relative'}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:dotColor,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0,zIndex:1,marginTop:1}}>💳</div>
                        <div style={{flex:1,background:C.white,border:`1px solid ${isPaid?C.greenBg:isOverdue?C.redBg:C.border}`,borderRadius:10,padding:'10px 12px',minWidth:0}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:3}}>
                            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                              <span style={{fontSize:12,fontWeight:500,color:C.ink}}>{item.label||'Payment'}</span>
                              {evtLabel&&<span style={{fontSize:10,color:C.gray}}>· {evtLabel}</span>}
                            </div>
                            <span style={{fontSize:13,fontWeight:600,color:dotColor,flexShrink:0,marginLeft:8}}>{fmt(item.amount)}</span>
                          </div>
                          <div style={{fontSize:11,color:isPaid?C.green:isOverdue?C.red:C.amber,fontWeight:500}}>
                            {isPaid&&item.paid_date?`Paid ${new Date(item.paid_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} ✓`:isPaid?'Paid ✓':isOverdue?`Overdue · Due ${new Date(item.due_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`:item.due_date?`Due ${new Date(item.due_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`:null}
                          </div>
                        </div>
                      </div>);
                    }
                    return null;
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab==='history'&&(
        <div className="page-scroll" style={{flex:1,overflowY:'auto',padding:20}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
            {[{label:'Total spent',val:fmt(totalSpent),col:'var(--color-success)'},{label:'Events',val:String(evList.length)},{label:'Services',val:String([...new Set(evList.flatMap(e=>e.services||[]))].length)}].map((s,i)=>(
              <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
                <div style={{fontSize:18,fontWeight:600,color:s.col||C.ink,lineHeight:1}}>{s.val}</div>
                <div style={{fontSize:10,color:C.gray,marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>
          {evList.length===0?(<div style={{textAlign:'center',padding:'32px 16px',color:C.gray,fontSize:13}}>No events yet.<br/><span onClick={()=>setScreen('events')} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>+ Create event →</span></div>
          ):evList.map((ev,idx)=>{
            const sc={active:{bg:C.amberBg,col:C.amber,txt:'Active'},complete:{bg:C.greenBg,col:C.green,txt:'Complete'},cancelled:{bg:C.grayBg,col:C.gray,txt:'Cancelled'},upcoming:{bg:C.blueBg,col:C.blue,txt:'Upcoming'}}[ev.status]||{bg:C.grayBg,col:C.gray,txt:ev.status||'Active'};
            const milestones=ev.milestones||ev.payment_milestones||[];
            const isExp=expandedEv===ev.id;
            return(<div key={ev.id||idx} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:10,overflow:'hidden'}}>
              <div style={{padding:'14px 16px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}} onClick={()=>setExpandedEv(isExp?null:ev.id)}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:500,color:C.ink}}>{ev.type==='wedding'?'Wedding':'Quinceañera'}{ev.event_date?` · ${new Date(ev.event_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`:ev.date?` · ${ev.date}`:''}</span>
                    <Badge text={sc.txt} bg={sc.bg} color={sc.col}/>
                  </div>
                  {ev.venue&&<div style={{fontSize:11,color:C.gray}}>{ev.venue}</div>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{textAlign:'right'}}><div style={{fontSize:13,fontWeight:500,color:'var(--text-success)'}}>{fmt(ev.paid||0)}<span style={{fontSize:11,color:C.gray,fontWeight:400}}> / {fmt(ev.total||0)}</span></div><div style={{fontSize:10,color:C.gray}}>paid</div></div>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{transform:isExp?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0}}><path d="M4 6l4 4 4-4" stroke={C.gray} strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
              </div>
              {isExp&&(<>
                {milestones.length>0&&(<div style={{borderTop:`1px solid ${C.border}`,padding:'10px 16px'}}>
                  <div style={{fontSize:11,fontWeight:500,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Milestones</div>
                  {milestones.map(m=>{
                    const isPaid=m.status==='paid';
                    const isOverdue=!isPaid&&m.due_date&&new Date(m.due_date)<new Date();
                    return(<div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:isPaid?'var(--color-success)':isOverdue?'var(--color-danger)':C.gray,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,color:C.ink,fontWeight:500}}>{m.label}</div><div style={{fontSize:10,color:C.gray}}>{m.due_date?`Due ${new Date(m.due_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`:''}{ isPaid&&m.paid_date?` · Paid ${new Date(m.paid_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`:''}</div></div>
                      <div style={{fontSize:13,fontWeight:500,color:isPaid?'var(--color-success)':C.ink}}>{fmt(m.amount)}</div>
                      {!isPaid&&<button onClick={()=>{setShowMarkPaid(m);setPaidDraft({paid_date:new Date().toISOString().split('T')[0],payment_method:'cash',notes:''}); }} style={{fontSize:10,padding:'4px 8px',borderRadius:6,border:'1px solid var(--color-success)',background:'var(--bg-success)',color:'var(--text-success)',cursor:'pointer',fontWeight:500,whiteSpace:'nowrap'}}>Mark paid</button>}
                    </div>);
                  })}
                </div>)}
                <div style={{padding:'8px 16px',borderTop:milestones.length>0?'none':`1px solid ${C.border}`}}>
                  <button onClick={()=>{if(ev.id)setSelectedEvent(ev.id);setScreen('event_detail');}} style={{fontSize:11,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:6,padding:'5px 10px',cursor:'pointer',fontWeight:500}}>Open event →</button>
                </div>
              </>)}
            </div>);
          })}
          <div style={{textAlign:'center',marginTop:8}}><button onClick={()=>setScreen('events')} style={{fontSize:12,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:8,padding:'8px 16px',cursor:'pointer',fontWeight:500}}>+ Book another event</button></div>
        </div>
      )}
      {tab==='pipeline'&&(
        <div className="page-scroll" style={{flex:1,overflowY:'auto',padding:20}}>
          <div style={{fontSize:12,color:C.gray,marginBottom:12}}>Boutique-wide pipeline · {(pipeline||[]).filter(l=>!['won','lost'].includes(l.stage)).length} active leads</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(140px,1fr))',gap:8}}>
            {PIPELINE_STAGES.map(stage=>{
              const leads=(pipeline||[]).filter(l=>l.stage===stage.id);
              return(<div key={stage.id} style={{background:C.grayBg,borderRadius:10,padding:8,minHeight:180}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:7,height:7,borderRadius:'50%',background:stage.color}}/><span style={{fontSize:11,fontWeight:500,color:C.ink}}>{stage.label}</span></div>
                  <span style={{fontSize:10,color:C.gray,background:C.white,padding:'1px 6px',borderRadius:999}}>{leads.length}</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {leads.map(lead=>{
                    const isThis=lead.client_id===cl.id;
                    const days=lead.updated_at?Math.ceil((new Date()-new Date(lead.updated_at))/864e5):0;
                    return(<div key={lead.id} style={{background:C.white,border:`1.5px solid ${isThis?C.rosa:C.border}`,borderRadius:7,padding:'7px 9px'}}>
                      <div style={{fontSize:11,fontWeight:500,color:C.ink,marginBottom:2}}>{lead.lead_name||'—'}</div>
                      {lead.event_type&&<div style={{fontSize:10,color:C.gray}}>{lead.event_type==='wedding'?'Wedding':'Quinceañera'}</div>}
                      {lead.estimated_value>0&&<div style={{fontSize:10,color:'var(--text-success)',marginTop:1}}>{fmt(lead.estimated_value/100)}</div>}
                      <div style={{fontSize:10,color:days>14?'var(--text-danger)':days>7?C.amber:C.gray,marginTop:3}}>{days===0?'Today':`${days}d ago`}</div>
                      <div style={{display:'flex',gap:3,marginTop:5,flexWrap:'wrap'}}>
                        {PIPELINE_STAGES.filter(s=>s.id!==stage.id&&!['won','lost'].includes(s.id)).slice(0,2).map(s=>(
                          <button key={s.id} onClick={()=>moveLead(lead.id,s.id)} style={{fontSize:9,padding:'2px 5px',borderRadius:3,border:`1px solid ${s.color}`,color:s.color,background:C.white,cursor:'pointer'}}>→ {s.label.split(' ')[0]}</button>
                        ))}
                        {!['won','lost'].includes(stage.id)&&<button onClick={()=>moveLead(lead.id,'lost')} style={{fontSize:9,padding:'2px 5px',borderRadius:3,border:'1px solid #EF4444',color:'#EF4444',background:C.white,cursor:'pointer'}}>Lost</button>}
                      </div>
                    </div>);
                  })}
                </div>
                <button onClick={()=>{setShowAddLead(stage.id);setLeadDraft({lead_name:cl.name||'',lead_phone:cl.phone||'',event_type:'wedding',estimated_value:'',source:'',notes:''}); }} style={{width:'100%',marginTop:6,padding:'5px 0',borderRadius:5,border:`1px dashed ${C.border}`,background:C.white,color:C.gray,fontSize:10,cursor:'pointer'}}>+ Add</button>
              </div>);
            })}
          </div>
          {(pipeline||[]).length>0&&(<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:16}}>
            {[{label:'Active leads',val:String((pipeline||[]).filter(l=>!['won','lost'].includes(l.stage)).length)},{label:'Pipeline value',val:fmt((pipeline||[]).filter(l=>!['won','lost'].includes(l.stage)).reduce((s,l)=>s+(l.estimated_value||0)/100,0))},{label:'Conversion',val:((pipeline||[]).length>0?Math.round(((pipeline||[]).filter(l=>l.stage==='won').length/(pipeline||[]).length)*100):0)+'%'}].map((s,i)=>(
              <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
                <div style={{fontSize:18,fontWeight:600,color:C.ink,lineHeight:1}}>{s.val}</div><div style={{fontSize:10,color:C.gray,marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>)}
        </div>
      )}
      {tab==='tags'&&(
        <div className="page-scroll" style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:16}}>
          <Card>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:12,fontWeight:500,color:C.ink}}>CRM Tags</span>
              <button onClick={()=>setShowAddTag(true)} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>+ Create tag</button>
            </div>
            <div style={{padding:'12px 14px'}}>
              {(tagDefs||[]).length===0?(<div style={{fontSize:12,color:C.gray}}>No tags yet. Click '+ Create tag' to add the first one.</div>):(
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {(tagDefs||[]).map(tag=>{
                    const active=(clientTagIds||[]).includes(tag.id);
                    const cc=TAG_CAT_COLORS[tag.category]||C.gray;
                    return(<button key={tag.id} onClick={()=>toggleTag(tag.id)} style={{padding:'4px 12px',borderRadius:999,border:`1.5px solid ${active?cc:C.border}`,background:active?cc:C.white,color:active?'#fff':C.gray,fontSize:11,cursor:'pointer',fontWeight:500,transition:'all 0.15s'}}>{tag.category==='alert'&&'⚠️ '}{tag.name}</button>);
                  })}
                </div>
              )}
            </div>
          </Card>
          <Card>
            <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:12,fontWeight:500,color:C.ink}}>Communication preferences</span></div>
            <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
              {[{key:'sms_reminders',label:'SMS reminders'},{key:'email_invoices',label:'Email invoices'},{key:'appt_reminders',label:'Appointment reminders'},{key:'marketing',label:'Marketing messages'},{key:'birthday_sms',label:'Birthday SMS'},{key:'review_request',label:'Review request SMS'}].map(pref=>{
                const val=commPrefs[pref.key];
                return(<div key={pref.key} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,color:C.ink}}>{pref.label}</span>
                  <button
                    role="switch"
                    aria-checked={!!val}
                    onClick={()=>setCommPrefs(p=>({...p,[pref.key]:!p[pref.key]}))}
                    style={{width:36,height:20,borderRadius:10,background:val?C.rosa:C.border,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0,border:'none',padding:0}}>
                    <div style={{position:'absolute',top:3,left:val?18:3,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
                  </button>
                </div>);
              })}
              {/* Preferred contact time */}
              <div style={{paddingTop:6,borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:12,color:C.ink,marginBottom:6}}>Preferred contact time</div>
                <select
                  value={commPrefs.preferredContactTime||''}
                  onChange={e=>setCommPrefs(p=>({...p,preferredContactTime:e.target.value}))}
                  style={{width:'100%',padding:'6px 8px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,background:'#fff',color:C.ink,outline:'none',fontFamily:'inherit'}}>
                  <option value="">No preference</option>
                  <option value="morning">Morning (8am–12pm)</option>
                  <option value="afternoon">Afternoon (12pm–5pm)</option>
                  <option value="evening">Evening (5pm–8pm)</option>
                  <option value="weekends">Weekends only</option>
                </select>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:4}}>
                <PrimaryBtn label={commSaving?'Saving…':'Save preferences'} colorScheme="success" style={{fontSize:11,padding:'5px 12px'}} onClick={async()=>{setCommSaving(true);await updateClient(cl.id,{comm_prefs:commPrefs});setCommSaving(false);toast('Preferences saved ✓');}}/>
              </div>
            </div>
          </Card>
          <Card>
            <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:12,fontWeight:500,color:C.ink}}>Style preferences</span></div>
            <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
              <div>
                <div id="pref-themes-label" style={LBL}>Themes</div>
                <div role="group" aria-labelledby="pref-themes-label" style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
                  {['Romantic','Classic','Boho','Glamorous','Modern','Vintage','Minimalist','Dramatic'].map(t=>{
                    const active=styleThemes.includes(t);
                    return <button key={t} onClick={()=>setStyleThemes(prev=>active?prev.filter(x=>x!==t):[...prev,t])} style={{padding:'3px 10px',borderRadius:999,border:`1px solid ${active?C.rosa:C.border}`,background:active?C.rosaPale:C.white,color:active?C.rosaText:C.gray,fontSize:11,cursor:'pointer'}}>{t}</button>;
                  })}
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
                  <PrimaryBtn label={themesSaving?'Saving…':'Save themes'} colorScheme="success" style={{fontSize:11,padding:'5px 12px'}} onClick={async()=>{setThemesSaving(true);await updateClient(cl.id,{style_themes:styleThemes});setThemesSaving(false);toast('Themes saved ✓');}}/>
                </div>
              </div>
              <div>
                <div id="pref-flowers-label" style={LBL}>Flower preferences</div>
                <div role="group" aria-labelledby="pref-flowers-label" style={{display:'flex',gap:6}}>
                  <input value={flowerPrefs} onChange={e=>setFlowerPrefs(e.target.value)} placeholder="Roses, peonies, tulips…" style={{...inputSt,fontSize:11,padding:'6px 8px',flex:1}}/>
                  <PrimaryBtn label={flowerSaving?'…':'Save'} colorScheme="success" style={{fontSize:11,padding:'5px 10px',flexShrink:0}} onClick={async()=>{setFlowerSaving(true);await updateClient(cl.id,{flower_prefs:flowerPrefs});setFlowerSaving(false);toast('Saved ✓');}}/>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
      {tab==='sms'&&(
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {!cl.phone?(
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:32}}>
              <div style={{textAlign:'center',color:C.gray}}>
                <div style={{fontSize:32,marginBottom:12}}>📵</div>
                <div style={{fontSize:13,fontWeight:500,color:C.ink,marginBottom:4}}>No phone number on file</div>
                <div style={{fontSize:12,color:C.gray}}>Add a phone number to this client to enable SMS.</div>
              </div>
            </div>
          ):(
            <>
              <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.border}`,background:C.white,flexShrink:0,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{fontSize:11,color:C.gray}}>Messaging </span>
                <span style={{fontSize:11,fontWeight:500,color:C.ink}}>{cl.phone}</span>
                {smsOptedOut&&!smsResubscribed&&(
                  <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:999,background:'#FEE2E2',color:'#B91C1C',border:'1px solid #FECACA'}}>
                    SMS opt-out
                  </span>
                )}
                {smsResubscribed&&(
                  <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:999,background:'#DCFCE7',color:'#15803D',border:'1px solid #BBF7D0'}}>
                    SMS re-subscribed
                  </span>
                )}
                <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:11,color:C.gray}}>{prefOptOut?'Opted out':'Subscribed'}</span>
                  <button
                    role="switch"
                    aria-checked={!prefOptOut}
                    onClick={handleToggleSmsOptOut}
                    disabled={optOutSaving}
                    title={prefOptOut?'Mark as subscribed':'Mark as opted out'}
                    style={{fontSize:11,padding:'3px 10px',borderRadius:6,border:`1px solid ${prefOptOut?C.green:C.red}`,background:prefOptOut?C.greenBg:'#FEE2E2',color:prefOptOut?C.green:'#B91C1C',cursor:'pointer',fontWeight:500,opacity:optOutSaving?0.6:1}}
                  >
                    {optOutSaving?'…':prefOptOut?'Mark subscribed':'Mark opted out'}
                  </button>
                </div>
              </div>
              <div ref={smsBubbleRef} className="page-scroll" style={{flex:1,overflowY:'auto',padding:'16px 16px 8px',display:'flex',flexDirection:'column',gap:8}}>
                {smsLoading?(
                  <div style={{textAlign:'center',padding:32,color:C.gray,fontSize:12}}>Loading…</div>
                ):smsMessages.length===0?(
                  <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <div style={{textAlign:'center',color:C.gray}}>
                      <div style={{fontSize:28,marginBottom:10}}>💬</div>
                      <div style={{fontSize:12}}>No messages yet. Send the first SMS.</div>
                    </div>
                  </div>
                ):(
                  smsMessages.map(msg=>{
                    const isOut=msg.direction==='outbound';
                    const ts=new Date(msg.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
                    return(
                      <div key={msg.id} style={{display:'flex',flexDirection:'column',alignItems:isOut?'flex-end':'flex-start',gap:2}}>
                        <div style={{maxWidth:'72%',padding:'8px 12px',borderRadius:isOut?'16px 16px 4px 16px':'16px 16px 16px 4px',background:isOut?C.rosaPale:C.grayBg,border:`1px solid ${isOut?C.rosaLight:C.border}`,fontSize:13,color:C.ink,lineHeight:1.45,wordBreak:'break-word'}}>
                          {msg.body}
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          <span style={{fontSize:10,color:C.gray}}>{ts}</span>
                          {isOut&&msg.status==='failed'&&<span style={{fontSize:10,color:C.red,fontWeight:500}}>Failed</span>}
                          {isOut&&msg.status==='sending'&&<span style={{fontSize:10,color:C.gray}}>Sending…</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{padding:'10px 16px',borderTop:`1px solid ${C.border}`,background:C.white,flexShrink:0,display:'flex',gap:8,alignItems:'flex-end'}}>
                <textarea
                  value={smsInput}
                  onChange={e=>setSmsInput(e.target.value)}
                  onKeyDown={async e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!smsInput.trim()||smsSending||smsOptedOut)return;setSmsSending(true);await sendSms(smsInput);setSmsInput('');setSmsSending(false);}}}
                  placeholder={smsOptedOut?"Client has opted out of SMS — cannot send":"Type a message…"}
                  rows={2}
                  style={{...inputSt,flex:1,resize:'none',fontSize:13,padding:'8px 10px',lineHeight:1.4,opacity:smsOptedOut?0.5:1}}
                  disabled={smsSending||smsOptedOut}
                />
                <div title={smsOptedOut?'Client opted out of SMS':undefined} style={{flexShrink:0,alignSelf:'flex-end'}}>
                  <PrimaryBtn
                    label={smsSending?'Sending…':'Send'}
                    onClick={async()=>{if(!smsInput.trim()||smsSending||smsOptedOut)return;setSmsSending(true);await sendSms(smsInput);setSmsInput('');setSmsSending(false);}}
                    style={{fontSize:12,padding:'8px 16px',opacity:smsOptedOut?0.4:1,pointerEvents:smsOptedOut?'none':undefined}}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {showMeasModal&&(<div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget){setShowMeasModal(false);setMeasModalEditId(null);}}}>
        <div style={{background:C.white,borderRadius:16,width:480,padding:24,boxShadow:'0 24px 48px rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:16}}>{measModalEditId?'Edit measurements':'Take measurements'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            {[{key:'bust',label:'Bust (inches)'},{key:'waist',label:'Waist (inches)'},{key:'hips',label:'Hips (inches)'},{key:'height',label:'Height (inches)'}].map(f=>(
              <div key={f.key}>
                <label htmlFor={`meas-modal-${f.key}`} style={LBL}>{f.label}</label>
                <input id={`meas-modal-${f.key}`} type="number" step="0.1" value={measModalDraft[f.key]} onChange={e=>setMeasModalDraft(d=>({...d,[f.key]:e.target.value}))} placeholder="—" style={{...inputSt,fontSize:12}}/>
              </div>
            ))}
            <div>
              <label htmlFor="meas-modal-shoe" style={LBL}>Shoe size</label>
              <input id="meas-modal-shoe" value={measModalDraft.shoe_size} onChange={e=>setMeasModalDraft(d=>({...d,shoe_size:e.target.value}))} placeholder="e.g. 7.5" style={{...inputSt,fontSize:12}}/>
            </div>
            <div>
              <label htmlFor="meas-modal-takenby" style={LBL}>Taken by <span style={{fontWeight:400,color:C.gray}}>(optional)</span></label>
              <input id="meas-modal-takenby" value={measModalDraft.taken_by_name} onChange={e=>setMeasModalDraft(d=>({...d,taken_by_name:e.target.value}))} placeholder="Staff name" style={{...inputSt,fontSize:12}}/>
            </div>
          </div>
          <label htmlFor="meas-modal-notes" style={LBL}>Notes <span style={{fontWeight:400,color:C.gray}}>(optional)</span></label>
          <textarea id="meas-modal-notes" value={measModalDraft.notes} onChange={e=>setMeasModalDraft(d=>({...d,notes:e.target.value}))} placeholder="Any fitting notes…" rows={2} style={{...inputSt,resize:'vertical',fontSize:12,marginBottom:16,width:'100%',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>{setShowMeasModal(false);setMeasModalEditId(null);}} style={{fontSize:12}}/>
            <PrimaryBtn label={measModalSaving?'Saving…':'Save'} colorScheme="success" onClick={handleSaveMeasModal} style={{fontSize:12}}/>
          </div>
        </div>
      </div>)}
      {showAdjustPts&&(<div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setShowAdjustPts(false);}}>
        <div style={{background:C.white,borderRadius:16,width:360,padding:24,boxShadow:'0 24px 48px rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:4}}>Adjust loyalty points</div>
          <div style={{fontSize:12,color:C.gray,marginBottom:16}}>Current: {points.toLocaleString()} pts</div>
          <div style={{display:'flex',gap:6,marginBottom:12}}>{[['add','Add'],['remove','Remove'],['set','Set to']].map(([v,l])=>(<button key={v} onClick={()=>setAdjPts(a=>({...a,type:v}))} style={{flex:1,padding:'7px 0',borderRadius:8,border:`1px solid ${adjPts.type===v?C.rosa:C.border}`,background:adjPts.type===v?C.rosaPale:C.white,color:adjPts.type===v?C.rosaText:C.gray,fontSize:11,cursor:'pointer',fontWeight:500}}>{l}</button>))}</div>
          <label htmlFor="adjpts-points" style={LBL}>Points</label><input id="adjpts-points" type="number" value={adjPts.points} onChange={e=>setAdjPts(a=>({...a,points:e.target.value}))} placeholder="0" style={{...inputSt,marginBottom:10}}/>
          <label htmlFor="adjpts-reason" style={LBL}>Reason</label><input id="adjpts-reason" value={adjPts.reason} onChange={e=>setAdjPts(a=>({...a,reason:e.target.value}))} placeholder="Birthday bonus…" style={{...inputSt,marginBottom:16}}/>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowAdjustPts(false)} style={{fontSize:12}}/><PrimaryBtn label="Save" colorScheme="success" onClick={async()=>{const n=Math.max(0,parseInt(adjPts.points)||0);let newPts,delta;if(adjPts.type==='add'){newPts=points+n;delta=n;}else if(adjPts.type==='remove'){newPts=Math.max(0,points-n);delta=-(points-newPts);}else{newPts=n;delta=newPts-points;}const{error}=await adjustLoyaltyPoints(cl.id,newPts,delta,adjPts.reason||null);if(!error){toast(`Points updated → ${newPts.toLocaleString()} pts ✓`);setShowAdjustPts(false);setAdjPts({type:'add',points:'',reason:''});}else toast('Failed to update points','warn');}} style={{fontSize:12}}/></div>
        </div>
      </div>)}
      {showAddTask&&(<div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setShowAddTask(false);}}>
        <div style={{background:C.white,borderRadius:16,width:400,padding:24,boxShadow:'0 24px 48px rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:16}}>Add task</div>
          <label htmlFor="ctask-desc" style={LBL}>Description *</label><input id="ctask-desc" value={taskDraft.text} onChange={e=>setTaskDraft(d=>({...d,text:e.target.value}))} placeholder="Call to confirm alterations…" style={{...inputSt,marginBottom:10}}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div><label htmlFor="ctask-cat" style={LBL}>Category</label><select id="ctask-cat" value={taskDraft.category} onChange={e=>setTaskDraft(d=>({...d,category:e.target.value}))} style={{...inputSt,fontSize:11}}><option value="general">General</option><option value="crm">CRM</option><option value="payment">Payment</option><option value="fitting">Fitting</option><option value="follow_up">Follow-up</option></select></div>
            <div><label htmlFor="ctask-due" style={LBL}>Due date</label><input id="ctask-due" type="date" value={taskDraft.due_date} onChange={e=>setTaskDraft(d=>({...d,due_date:e.target.value}))} style={{...inputSt,fontSize:11}}/></div>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:C.ink,marginBottom:16,cursor:'pointer'}}><input type="checkbox" checked={taskDraft.is_alert} onChange={e=>setTaskDraft(d=>({...d,is_alert:e.target.checked}))} style={{accentColor:'var(--color-danger)'}}/>Mark as alert (urgent)</label>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowAddTask(false)} style={{fontSize:12}}/><PrimaryBtn label="Add task" colorScheme="success" onClick={handleAddTask} style={{fontSize:12}}/></div>
        </div>
      </div>)}
      {showMarkPaid&&(<div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setShowMarkPaid(null);}}>
        <div style={{background:C.white,borderRadius:16,width:400,padding:24,boxShadow:'0 24px 48px rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:4}}>Mark payment received</div>
          <div style={{fontSize:12,color:C.gray,marginBottom:16}}>{showMarkPaid.label} — {fmt(showMarkPaid.amount)}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div><label htmlFor="cpaid-date" style={LBL}>Date received</label><input id="cpaid-date" type="date" value={paidDraft.paid_date} onChange={e=>setPaidDraft(d=>({...d,paid_date:e.target.value}))} style={{...inputSt,fontSize:11}}/></div>
            <div><label htmlFor="cpaid-method" style={LBL}>Method</label><select id="cpaid-method" value={paidDraft.payment_method} onChange={e=>setPaidDraft(d=>({...d,payment_method:e.target.value}))} style={{...inputSt,fontSize:11}}><option value="cash">Cash</option><option value="zelle">Zelle</option><option value="card">Card</option><option value="check">Check</option><option value="other">Other</option></select></div>
          </div>
          <label htmlFor="cpaid-notes" style={LBL}>Notes</label><input id="cpaid-notes" value={paidDraft.notes} onChange={e=>setPaidDraft(d=>({...d,notes:e.target.value}))} placeholder="Optional…" style={{...inputSt,marginBottom:16}}/>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowMarkPaid(null)} style={{fontSize:12}}/><PrimaryBtn label="Record payment" colorScheme="success" onClick={handleMarkPaid} style={{fontSize:12}}/></div>
        </div>
      </div>)}
      {showAddLead&&(<div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setShowAddLead(null);}}>
        <div style={{background:C.white,borderRadius:16,width:440,padding:24,boxShadow:'0 24px 48px rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:4}}>Add pipeline lead</div>
          <div style={{fontSize:12,color:C.gray,marginBottom:16}}>Stage: {PIPELINE_STAGES.find(s=>s.id===showAddLead)?.label}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div><label htmlFor="lead-name" style={LBL}>Name *</label><input id="lead-name" value={leadDraft.lead_name} onChange={e=>setLeadDraft(d=>({...d,lead_name:e.target.value}))} style={{...inputSt,fontSize:11}}/></div>
            <div><label htmlFor="lead-phone" style={LBL}>Phone</label><input id="lead-phone" value={leadDraft.lead_phone} onChange={e=>setLeadDraft(d=>({...d,lead_phone:e.target.value}))} style={{...inputSt,fontSize:11}}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div><label htmlFor="lead-evtype" style={LBL}>Event type</label><select id="lead-evtype" value={leadDraft.event_type} onChange={e=>setLeadDraft(d=>({...d,event_type:e.target.value}))} style={{...inputSt,fontSize:11}}><option value="wedding">Wedding</option><option value="quinceanera">Quinceañera</option></select></div>
            <div><label htmlFor="lead-value" style={LBL}>Est. value ($)</label><input id="lead-value" type="number" value={leadDraft.estimated_value} onChange={e=>setLeadDraft(d=>({...d,estimated_value:e.target.value}))} placeholder="5000" style={{...inputSt,fontSize:11}}/></div>
          </div>
          <div><label htmlFor="lead-source" style={LBL}>Source</label><select id="lead-source" value={leadDraft.source} onChange={e=>setLeadDraft(d=>({...d,source:e.target.value}))} style={{...inputSt,marginBottom:10,fontSize:11}}><option value="">Select…</option>{Object.entries(HOW_FOUND_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          <div><label htmlFor="lead-notes" style={LBL}>Notes</label><textarea id="lead-notes" value={leadDraft.notes} onChange={e=>setLeadDraft(d=>({...d,notes:e.target.value}))} rows={2} style={{...inputSt,resize:'vertical',fontSize:11,marginBottom:16}}/></div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowAddLead(null)} style={{fontSize:12}}/><PrimaryBtn label="Add lead" colorScheme="success" onClick={handleAddLead} style={{fontSize:12}}/></div>
        </div>
      </div>)}
      {showAddTag&&(<div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setShowAddTag(false);}}>
        <div style={{background:C.white,borderRadius:16,width:360,padding:24,boxShadow:'0 24px 48px rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:16}}>Create new tag</div>
          <label htmlFor="tag-name" style={LBL}>Tag name *</label><input id="tag-name" value={tagDraft.name} onChange={e=>setTagDraft(d=>({...d,name:e.target.value}))} placeholder="VIP, Instagram lead…" style={{...inputSt,marginBottom:10}}/>
          <label htmlFor="tag-cat" style={LBL}>Category</label>
          <select id="tag-cat" value={tagDraft.category} onChange={e=>setTagDraft(d=>({...d,category:e.target.value}))} style={{...inputSt,marginBottom:16}}>
            <option value="status">Status</option><option value="source">Source</option><option value="service">Service</option><option value="internal">Internal</option><option value="alert">Alert ⚠️</option>
          </select>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowAddTag(false)} style={{fontSize:12}}/><PrimaryBtn label="Create & assign" colorScheme="success" onClick={async()=>{if(!tagDraft.name.trim())return;await addTagDef(tagDraft.name.trim(),tagDraft.category);setTagDraft({name:'',category:'internal'});setShowAddTag(false);toast('Tag created');}} style={{fontSize:12}}/></div>
        </div>
      </div>)}
      {showRedeemModal&&(<div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setShowRedeemModal(false);}}>
        <div style={{background:C.white,borderRadius:16,width:400,padding:24,boxShadow:'0 24px 48px rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:4}}>Redeem loyalty points</div>
          <div style={{fontSize:12,color:C.gray,marginBottom:4}}>Balance: <span style={{fontWeight:500,color:C.ink}}>{points.toLocaleString()} pts</span></div>
          <div style={{fontSize:11,color:C.gray,marginBottom:16,padding:'6px 10px',background:C.rosaPale,borderRadius:6}}>100 points = $1.00 discount &nbsp;·&nbsp; Minimum 500 points</div>
          <label htmlFor="redeem-pts" style={LBL}>Points to redeem</label>
          <input id="redeem-pts" type="number" value={redeemDraft.points} min={500} step={100} max={points} onChange={e=>setRedeemDraft(d=>({...d,points:e.target.value}))} placeholder="500" style={{...inputSt,marginBottom:4}}/>
          {redeemPts>=100&&<div style={{fontSize:12,fontWeight:500,color:'var(--text-success)',marginBottom:10}}>= ${redeemDollarValue} discount</div>}
          {redeemPts>0&&redeemPts<500&&<div style={{fontSize:11,color:'var(--text-danger)',marginBottom:10}}>Minimum redemption is 500 points</div>}
          {redeemPts>points&&<div style={{fontSize:11,color:'var(--text-danger)',marginBottom:10}}>Exceeds available balance</div>}
          <label htmlFor="redeem-event" style={LBL}>Apply to event (optional)</label>
          <select id="redeem-event" value={redeemDraft.event_id} onChange={e=>setRedeemDraft(d=>({...d,event_id:e.target.value}))} style={{...inputSt,marginBottom:10}}>
            <option value="">None</option>
            {evList.map(ev=><option key={ev.id} value={ev.id}>{ev.type} — {ev.event_date?new Date(ev.event_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'No date'}</option>)}
          </select>
          <label htmlFor="redeem-note" style={LBL}>Note (optional)</label>
          <input id="redeem-note" value={redeemDraft.note} onChange={e=>setRedeemDraft(d=>({...d,note:e.target.value}))} placeholder="Applied to final payment…" style={{...inputSt,marginBottom:16}}/>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowRedeemModal(false)} style={{fontSize:12}}/>
            <PrimaryBtn label={redeemSaving?'Redeeming…':`Redeem $${redeemDollarValue}`} colorScheme="success" onClick={handleRedeem} style={{fontSize:12}} disabled={redeemSaving||redeemPts<500||redeemPts>points}/>
          </div>
        </div>
      </div>)}
      {showAdjustModal&&(<div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setShowAdjustModal(false);}}>
        <div style={{background:C.white,borderRadius:16,width:360,padding:24,boxShadow:'0 24px 48px rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:4}}>Adjust loyalty points</div>
          <div style={{fontSize:12,color:C.gray,marginBottom:16}}>Current balance: <span style={{fontWeight:500,color:C.ink}}>{points.toLocaleString()} pts</span></div>
          <label htmlFor="adjloy-delta" style={LBL}>+/- Points</label>
          <input id="adjloy-delta" type="number" value={adjustDraft.delta} onChange={e=>setAdjustDraft(d=>({...d,delta:e.target.value}))} placeholder="e.g. 200 or -100" style={{...inputSt,marginBottom:10}}/>
          {adjustDraft.delta&&parseInt(adjustDraft.delta)!==0&&<div style={{fontSize:11,marginBottom:10,color:parseInt(adjustDraft.delta)>0?'var(--color-success)':'var(--color-danger)'}}>New balance: {Math.max(0,points+(parseInt(adjustDraft.delta)||0)).toLocaleString()} pts</div>}
          <label htmlFor="adjloy-reason" style={LBL}>Reason</label>
          <input id="adjloy-reason" value={adjustDraft.note} onChange={e=>setAdjustDraft(d=>({...d,note:e.target.value}))} placeholder="Birthday bonus, correction…" style={{...inputSt,marginBottom:16}}/>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowAdjustModal(false)} style={{fontSize:12}}/>
            <PrimaryBtn label={adjustSaving?'Saving…':'Save'} colorScheme="success" onClick={handleAdjust} style={{fontSize:12}} disabled={adjustSaving}/>
          </div>
        </div>
      </div>)}
      {showLogRating&&(<div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setShowLogRating(false);}}>
        <div style={{background:C.white,borderRadius:16,width:420,padding:24,boxShadow:'0 24px 48px rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:4}}>Log satisfaction rating</div>
          <div style={{fontSize:12,color:C.gray,marginBottom:16}}>{cl.name}</div>
          <div id="rating-score-label" style={LBL}>Score (0–10)</div>
          <div role="group" aria-labelledby="rating-score-label" style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:12}}>
            {[0,1,2,3,4,5,6,7,8,9,10].map(n=>{
              const bg=n>=9?C.green:n>=7?C.amber:n>=5?'#D97706':'#DC2626';
              const active=ratingDraft.score===n;
              return(<button key={n} onClick={()=>setRatingDraft(d=>({...d,score:n}))} style={{width:34,height:34,borderRadius:8,border:`2px solid ${active?bg:C.border}`,background:active?bg:C.white,color:active?'#fff':C.gray,fontSize:13,fontWeight:active?700:400,cursor:'pointer',transition:'all 0.1s'}}>{n}</button>);
            })}
          </div>
          <label htmlFor="rating-comment" style={LBL}>Comment (optional)</label>
          <textarea id="rating-comment" value={ratingDraft.comment} onChange={e=>setRatingDraft(d=>({...d,comment:e.target.value}))} placeholder="Feedback or notes…" rows={3} style={{...inputSt,resize:'vertical',marginBottom:10,width:'100%',boxSizing:'border-box',fontSize:12}}/>
          <label htmlFor="rating-event" style={LBL}>Link to event (optional)</label>
          <select id="rating-event" value={ratingDraft.event_id} onChange={e=>setRatingDraft(d=>({...d,event_id:e.target.value}))} style={{...inputSt,marginBottom:16}}>
            <option value="">None</option>
            {evList.map(ev=><option key={ev.id} value={ev.id}>{ev.type} — {ev.event_date?new Date(ev.event_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'No date'}</option>)}
          </select>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowLogRating(false)} style={{fontSize:12}}/>
            <PrimaryBtn label={ratingSaving?'Saving…':'Save rating'} colorScheme="success" onClick={handleSaveRating} style={{fontSize:12}} disabled={ratingSaving||ratingDraft.score===null}/>
          </div>
        </div>
      </div>)}
      {showDirectSMS&&(
        <DirectSMSModal client={cl} boutique={boutique} onClose={()=>setShowDirectSMS(false)} toast={toast}/>
      )}
      {deleteMeasConfirm&&(
        <div role="presentation" onClick={e=>{if(e.target===e.currentTarget)setDeleteMeasConfirm(null);}}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-meas-title"
            style={{background:'#fff',borderRadius:16,width:360,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'20px 20px 12px',textAlign:'center'}}>
              <div style={{fontSize:26,marginBottom:8}}>⚠️</div>
              <div id="delete-meas-title" style={{fontSize:15,fontWeight:600,color:'#111',marginBottom:8}}>Delete measurement record?</div>
              <div style={{fontSize:12,color:'var(--text-danger)',background:'var(--bg-danger)',borderRadius:8,padding:'8px 12px'}}>This cannot be undone.</div>
            </div>
            <div style={{padding:'12px 20px 20px',display:'flex',gap:8}}>
              <GhostBtn label="Cancel" onClick={()=>setDeleteMeasConfirm(null)} style={{flex:1}}/>
              <button onClick={confirmDeleteMeas}
                style={{flex:1,padding:'9px 16px',borderRadius:8,border:'none',background:'var(--color-danger)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDetail;
