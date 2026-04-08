import React, { useState, useEffect } from 'react';
import { C, fmt, EVT_TYPES, SVC_LABELS, SVC_COLORS } from '../lib/colors';
import { Avatar, Badge, Card, CardHead, Topbar, PrimaryBtn, GhostBtn, SvcTag,
  Countdown, EventTypeBadge, ProgressBar, StatusDot, AlertBanner, useToast,
  inputSt, LBL } from '../lib/ui.jsx';
import { getPriorityAlert, getCountdownConfig } from '../lib/urgency';
import { useLayoutMode } from '../hooks/useLayoutMode.jsx';
import { useNotes, useTasks, useAppointmentsToday } from '../hooks/useNotes';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { autoProgressEvents } from '../hooks/useEvents';
import StandaloneAppointmentModal from '../components/StandaloneAppointmentModal';

const APPT_TYPE_CFG = {
  measurement:   {label:'Measurements',  tag:'Fitting',  tagBg:'var(--bg-success)', tagCol:'var(--color-success)', col:C.rosaPale,              textCol:C.rosa},
  try_on:        {label:'1st fitting',   tag:'Fitting',  tagBg:'var(--bg-success)', tagCol:'var(--color-success)', col:C.rosaPale,              textCol:C.rosa},
  final_fitting: {label:'Final fitting', tag:'Fitting',  tagBg:'var(--bg-success)', tagCol:'var(--color-success)', col:C.rosaPale,              textCol:C.rosa},
  pickup:        {label:'Dress pickup',  tag:'Pickup',   tagBg:'var(--bg-warning)', tagCol:'var(--color-warning)', col:'var(--bg-warning)',      textCol:'var(--color-warning)'},
  consultation:  {label:'Consultation',  tag:'Consult',  tagBg:'var(--bg-accent)',  tagCol:'var(--color-accent)',  col:'var(--bg-accent)',       textCol:'var(--color-accent)'},
  other:         {label:'Appointment',   tag:'Appt',     tagBg:'var(--bg-info)',    tagCol:'var(--color-info)',    col:'var(--bg-info)',         textCol:'var(--color-info)'},
};


// ─── NEW APPOINTMENT MODAL ────────────────────────────────────────────────────
const APPT_TYPES = ['measurement','try_on','final_fitting','pickup','consultation','other'];
const APPT_TYPE_LABELS = {measurement:'Measurements',try_on:'1st fitting',final_fitting:'Final fitting',pickup:'Dress pickup',consultation:'Consultation',other:'Other'};

const NewAppointmentModal = ({events, staff, onClose, onSaved}) => {
  const { boutique } = useAuth();
  const toast = useToast();
  const [eventId, setEventId] = useState('');
  const [type, setType] = useState('consultation');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [staffId, setStaffId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!eventId) return setErr('Select an event');
    if (!date) return setErr('Date is required');
    setSaving(true); setErr('');
    const { error } = await supabase.from('appointments').insert({
      boutique_id: boutique.id,
      event_id: eventId,
      type,
      date,
      time: time || null,
      note: note.trim() || null,
      staff_id: staffId || null,
      status: 'scheduled',
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    toast('Appointment scheduled ✓');
    onSaved();
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{background:C.white,borderRadius:16,width:440,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>
        <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <span style={{fontWeight:600,fontSize:15,color:C.ink}}>New appointment</span>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:14}}>
          {err && <div style={{fontSize:12,color:'#dc2626',background:'#fef2f2',padding:'8px 12px',borderRadius:7,border:'1px solid #fecaca'}}>{err}</div>}
          <div>
            <div style={{...LBL}}>Event *</div>
            <select value={eventId} onChange={e=>setEventId(e.target.value)} style={{...inputSt}}>
              <option value="">Select event…</option>
              {(events||[]).filter(ev=>ev.status!=='completed'&&ev.status!=='cancelled').map(ev=>(
                <option key={ev.id} value={ev.id}>{ev.client} — {ev.type==='wedding'?'Wedding':'Quinceañera'} · {ev.date}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{...LBL}}>Type</div>
            <select value={type} onChange={e=>setType(e.target.value)} style={{...inputSt}}>
              {APPT_TYPES.map(t=><option key={t} value={t}>{APPT_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <div style={{...LBL}}>Date *</div>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...inputSt}}/>
            </div>
            <div>
              <div style={{...LBL}}>Time</div>
              <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={{...inputSt}}/>
            </div>
          </div>
          <div>
            <div style={{...LBL}}>Staff member <span style={{fontWeight:400,color:C.gray}}>(optional)</span></div>
            <select value={staffId} onChange={e=>setStaffId(e.target.value)} style={{...inputSt}}>
              <option value="">Unassigned</option>
              {(staff||[]).map(s=><option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
            </select>
          </div>
          <div>
            <div style={{...LBL}}>Note <span style={{fontWeight:400,color:C.gray}}>(optional)</span></div>
            <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="Any details for the appointment…" style={{...inputSt,resize:'vertical',fontFamily:'inherit'}}/>
          </div>
        </div>
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',flexShrink:0}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>
          <PrimaryBtn label={saving?'Saving…':'Schedule appointment'} onClick={save}/>
        </div>
      </div>
    </div>
  );
};

// ─── DAILY BRIEFING BANNER ───────────────────────────────────────────────────
function DailyBriefingBanner({ appointments, payments, events }) {
  const [dismissed, setDismissed] = React.useState(() => {
    const stored = sessionStorage.getItem('belori_daily_brief');
    return stored === new Date().toDateString();
  });

  if (dismissed) return null;

  const todayAppts = (appointments || []).length;
  const overdueCount = (payments || []).filter(p => p.status === 'overdue').length;
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const dismiss = () => {
    sessionStorage.setItem('belori_daily_brief', new Date().toDateString());
    setDismissed(true);
  };

  return (
    <div style={{ background: `linear-gradient(135deg, ${C.rosaPale} 0%, #EDE9FE 100%)`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4, border: `1px solid ${C.border}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{greeting} 👋</div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{todayStr}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {todayAppts > 0 && <span style={{ fontSize: 12, color: C.rosa, fontWeight: 500 }}>📅 {todayAppts} appointment{todayAppts !== 1 ? 's' : ''} today</span>}
          {overdueCount > 0 && <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 500 }}>⚠️ {overdueCount} overdue payment{overdueCount !== 1 ? 's' : ''}</span>}
          {todayAppts === 0 && overdueCount === 0 && <span style={{ fontSize: 12, color: '#10B981', fontWeight: 500 }}>✅ Clear day — no urgent items</span>}
        </div>
      </div>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0 }}>×</button>
    </div>
  );
}

// ─── RECENTLY VIEWED ─────────────────────────────────────────────────────────
function RecentlyViewedCard({ setScreen, setSelectedEvent }) {
  const items = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('belori_recent') || '[]').slice(0, 5); } catch { return []; }
  }, []);

  if (!items.length) return null;

  return (
    <Card>
      <CardHead title="Recently viewed" sub="Jump back in"/>
      <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <button key={i} onClick={() => {
            if (item.type === 'event') { setSelectedEvent(item.id); setScreen('event_detail'); }
            else if (item.type === 'client') setScreen('clients');
          }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            onMouseEnter={e => e.currentTarget.style.background = C.rosaPale}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontSize: 16 }}>{item.type === 'event' ? '📅' : '👤'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
              <div style={{ fontSize: 11, color: C.gray }}>{item.sub}</div>
            </div>
            <span style={{ fontSize: 11, color: C.gray, flexShrink: 0 }}>→</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─── ONBOARDING CHECKLIST ─────────────────────────────────────────────────────
const OnboardingChecklist = ({events, clients, staff, inventory, payments, appointments, setScreen}) => {
  const { boutique } = useAuth();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('belori_onboarding_dismissed') === 'true');
  const [prevDoneCount, setPrevDoneCount] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);

  function goWithHint(screen, hint) {
    if (hint) sessionStorage.setItem('belori_autoopen', hint);
    setScreen(screen);
  }

  const allAppointments = appointments || (events || []).flatMap(e => e.appointments || []);

  const items = [
    {label:'Add your first client',         done: (clients?.length||0) > 0,   action:()=>goWithHint('clients','new_client'),    icon:'👤'},
    {label:'Book your first event',          done: (events?.length||0) > 0,    action:()=>goWithHint('events','new_event'),      icon:'📅'},
    {label:'Add a dress to inventory',       done: (inventory?.length||0) > 0, action:()=>goWithHint('inventory','new_dress'),   icon:'👗'},
    {label:'Invite a staff member',          done: (staff?.length||0) > 1,     action:()=>goWithHint('settings','invite_staff'), icon:'👥'},
    {label:'Set up your first payment milestone', done: (payments?.length||0) > 0, action:()=>setScreen('payments'),            icon:'💳'},
    {label:'Try the Calendar',               done: allAppointments.length > 0, action:()=>setScreen('staff_calendar'),          icon:'🗓️'},
  ];
  const doneCount = items.filter(i=>i.done).length;
  const allDone = doneCount === items.length;

  // Detect transition to all-complete and fire celebration
  useEffect(() => {
    if (prevDoneCount === null) { setPrevDoneCount(doneCount); return; }
    if (doneCount === items.length && prevDoneCount < items.length) {
      setShowCelebration(true);
      const t = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(t);
    }
    setPrevDoneCount(doneCount);
  }, [doneCount]);

  // Determine if dismiss option should be shown
  const createdAt = boutique?.created_at;
  const accountAgeDays = createdAt
    ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
    : 0;
  const canDismiss = allDone || accountAgeDays >= 14;

  if (dismissed) return null;

  const dismiss = () => { localStorage.setItem('belori_onboarding_dismissed','true'); setDismissed(true); };

  return (
    <>
      {showCelebration && (
        <div style={{background:'#D1FAE5',border:'1px solid #6EE7B7',borderRadius:10,padding:'10px 16px',display:'flex',alignItems:'center',gap:10,marginBottom:0}}>
          <span style={{fontSize:18}}>🎉</span>
          <span style={{fontSize:13,fontWeight:600,color:'#065F46'}}>Setup complete! Your boutique is ready to go.</span>
        </div>
      )}
      <Card>
        <div style={{padding:'16px 16px 4px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:C.ink}}>Get started with Belori</div>
            <div style={{fontSize:11,color:C.gray,marginTop:2}}>{doneCount} of {items.length} steps complete</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{display:'flex',gap:3}}>
              {items.map((_,i)=><div key={i} style={{width:16,height:4,borderRadius:2,background:i<doneCount?C.rosa:C.border,transition:'background 0.2s'}}/>)}
            </div>
            <button onClick={dismiss} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:16,lineHeight:1,padding:0}}>×</button>
          </div>
        </div>
        <div style={{padding:'8px 16px 16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {items.map((item,i)=>(
            <button key={i} onClick={item.action}
              style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:9,border:`1px solid ${item.done?C.border:C.rosa}`,background:item.done?C.grayBg:C.rosaPale,cursor:'pointer',textAlign:'left',transition:'all 0.15s',minHeight:'unset',minWidth:'unset'}}
              onMouseEnter={e=>{ if(!item.done){e.currentTarget.style.background='#F5E0E3';e.currentTarget.style.boxShadow='0 2px 8px rgba(201,105,122,0.15)';} }}
              onMouseLeave={e=>{ if(!item.done){e.currentTarget.style.background=item.done?C.grayBg:C.rosaPale;e.currentTarget.style.boxShadow='none';} }}>
              <div style={{width:22,height:22,borderRadius:'50%',background:item.done?C.rosa:C.white,border:`2px solid ${item.done?C.rosa:C.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11,color:C.white,fontWeight:700}}>
                {item.done?'✓':item.icon}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontSize:12,color:item.done?C.gray:C.ink,fontWeight:item.done?400:500,textDecoration:item.done?'line-through':'none',display:'block'}}>{item.label}</span>
                {!item.done&&<span style={{fontSize:10,color:C.rosa}}>Tap to start →</span>}
              </div>
            </button>
          ))}
        </div>
        {canDismiss && (
          <div style={{padding:'0 16px 14px',textAlign:'center'}}>
            <button onClick={dismiss} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:12,textDecoration:'underline',padding:0}}>
              Hide checklist
            </button>
          </div>
        )}
      </Card>
    </>
  );
};

// ─── AI INSIGHTS PANEL ───────────────────────────────────────────────────────
function buildRuleInsights({ payments, events, inventory, clients, alterations }) {
  const now = new Date();
  const insights = [];

  // Overdue payments
  const overduePmts = (payments || []).filter(p => p.status === 'overdue');
  if (overduePmts.length > 0) {
    const total = overduePmts.reduce((s, p) => s + Number(p.amount), 0);
    insights.push({
      severity: 'red',
      icon: '💰',
      message: `${overduePmts.length} payment${overduePmts.length !== 1 ? 's' : ''} overdue totaling ${fmt(total)}`,
      action: 'View payments',
      screen: 'payments',
    });
  }

  // Events this week
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const eventsThisWeek = (events || []).filter(e => {
    if (!e.event_date) return false;
    const d = new Date(e.event_date + 'T12:00:00');
    return d >= now && d <= week;
  });
  if (eventsThisWeek.length > 0) {
    insights.push({
      severity: 'amber',
      icon: '📅',
      message: `${eventsThisWeek.length} event${eventsThisWeek.length !== 1 ? 's' : ''} in the next 7 days`,
      action: 'Open events',
      screen: 'events',
    });
  }

  // Events in next 30 days (info-level, only if no week events)
  if (eventsThisWeek.length === 0) {
    const month = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const eventsThisMonth = (events || []).filter(e => {
      if (!e.event_date) return false;
      const d = new Date(e.event_date + 'T12:00:00');
      return d >= now && d <= month;
    });
    if (eventsThisMonth.length > 0) {
      insights.push({
        severity: 'blue',
        icon: '📅',
        message: `${eventsThisMonth.length} upcoming event${eventsThisMonth.length !== 1 ? 's' : ''} in the next 30 days`,
        action: 'Open events',
        screen: 'events',
      });
    }
  }

  // Overdue dress returns
  const today = now.toISOString().split('T')[0];
  const overdueReturns = (inventory || []).filter(d =>
    ['rented', 'picked_up'].includes(d.status) && d.return_date && d.return_date < today
  );
  if (overdueReturns.length > 0) {
    insights.push({
      severity: 'red',
      icon: '👗',
      message: `${overdueReturns.length} dress${overdueReturns.length !== 1 ? 'es' : ''} past their return date`,
      action: 'View rentals',
      screen: 'inventory',
    });
  }

  // Low stock consumables + any item with minStock set
  const lowStock = (inventory || []).filter(i =>
    (i.track === 'consumable' && i.restockPoint > 0 && i.currentStock <= i.restockPoint) ||
    (i.minStock > 0 && (i.availQty||i.currentStock||0) <= i.minStock)
  );
  if (lowStock.length > 0) {
    insights.push({
      severity: 'amber',
      icon: '📦',
      message: `${lowStock.length} consumable item${lowStock.length !== 1 ? 's' : ''} at or below restock level`,
      action: 'View inventory',
      screen: 'inventory',
    });
  }

  // High-value clients with loyalty points
  const loyalClients = (clients || []).filter(c => (c.loyalty_points || 0) >= 500);
  if (loyalClients.length > 0) {
    insights.push({
      severity: 'purple',
      icon: '💎',
      message: `${loyalClients.length} VIP client${loyalClients.length !== 1 ? 's' : ''} with 500+ loyalty points`,
      action: 'View clients',
      screen: 'clients',
    });
  }

  // No overdue payments — positive insight
  if (overduePmts.length === 0 && (payments || []).length > 0) {
    insights.push({
      severity: 'green',
      icon: '✅',
      message: 'All payments are on track — no overdue milestones',
      action: null,
      screen: null,
    });
  }

  // Events missing critical appointments
  const upcoming60 = new Date(now.getTime() + 60*24*60*60*1000);
  const missingAppts = (events || []).filter(e => {
    if (!e.event_date || e.status === 'completed' || e.status === 'cancelled') return false;
    const d = new Date(e.event_date + 'T12:00:00');
    if (d < now || d > upcoming60) return false;
    const appts = e.appointments || [];
    const types = new Set(appts.map(a => a.type));
    return !types.has('measurement') && !types.has('final_fitting');
  });
  if (missingAppts.length > 0) {
    insights.push({
      severity: 'amber',
      icon: '📐',
      message: `${missingAppts.length} upcoming event${missingAppts.length!==1?'s':''} missing fitting appointments`,
      action: 'View events',
      screen: 'events',
    });
  }

  // Active events with no payment milestones
  const noMilestones = (events || []).filter(e =>
    e.status === 'active' &&
    e.event_date &&
    new Date(e.event_date + 'T12:00:00') > now &&
    (!e.milestones || e.milestones.length === 0) &&
    Number(e.total || 0) > 0
  );
  if (noMilestones.length > 0) {
    insights.push({
      severity: 'blue',
      icon: '🧾',
      message: `${noMilestones.length} event${noMilestones.length!==1?'s':''} with no payment milestones set up`,
      action: 'View events',
      screen: 'events',
    });
  }

  // Overdue alterations
  const overdueAlts = (alterations || []).filter(a =>
    !['complete','cancelled'].includes(a.status) &&
    a.deadline &&
    a.deadline < today
  );
  if (overdueAlts.length > 0) {
    insights.push({
      severity: 'red',
      icon: '✂️',
      message: `${overdueAlts.length} alteration${overdueAlts.length!==1?'s':''} past deadline`,
      action: 'View alterations',
      screen: 'alterations',
    });
  }

  // Sort: red first, then amber, then blue, then purple, then green
  const order = { red: 0, amber: 1, blue: 2, purple: 3, green: 4 };
  insights.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return insights.slice(0, 5);
}

const INSIGHT_STYLE = {
  red:    { border: C.red,     bg: C.redBg,    text: C.red },
  amber:  { border: C.amber,   bg: C.amberBg,  text: C.amber },
  blue:   { border: C.blue,    bg: C.blueBg,   text: C.blue },
  green:  { border: C.green,   bg: C.greenBg,  text: C.green },
  purple: { border: '#7C3AED', bg: '#F5F3FF',  text: '#5B21B6' },
};

const AIInsightsPanel = ({ payments, events, inventory, clients, alterations, setScreen }) => {
  const insights = buildRuleInsights({ payments, events, inventory, clients, alterations });
  if (insights.length === 0) return null;

  return (
    <Card>
      <div style={{ padding: '14px 16px 6px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>AI Insights</span>
        <span style={{ fontSize: 11, color: C.gray, background: C.grayBg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 7px' }}>Smart alerts</span>
      </div>
      <div style={{ padding: '8px 0' }}>
        {insights.map((ins, i) => {
          const s = INSIGHT_STYLE[ins.severity] || INSIGHT_STYLE.blue;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 16px',
              borderLeft: `3px solid ${s.border}`,
              borderBottom: i < insights.length - 1 ? `1px solid ${C.border}` : 'none',
              background: i % 2 === 0 ? C.white : C.grayBg,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{ins.icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: C.ink }}>{ins.message}</span>
              {ins.action && ins.screen && (
                <button
                  onClick={() => setScreen(ins.screen)}
                  style={{
                    fontSize: 11, fontWeight: 500, color: s.text,
                    background: s.bg, border: `1px solid ${s.border}`,
                    borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                    whiteSpace: 'nowrap', minHeight: 'unset', minWidth: 'unset',
                  }}>
                  {ins.action} →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ─── REVENUE FORECAST PANEL ──────────────────────────────────────────────────
function RevenueForecastPanel({ payments }) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,10);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0,10);
  const today = now.toISOString().slice(0,10);
  const d30   = new Date(now.getTime()+30*86400000).toISOString().slice(0,10);
  const d60   = new Date(now.getTime()+60*86400000).toISOString().slice(0,10);
  const d90   = new Date(now.getTime()+90*86400000).toISOString().slice(0,10);

  const pmt = payments || [];
  const thisMonth = pmt.filter(p=>p.status==='paid'&&p.paid_date>=thisMonthStart).reduce((s,p)=>s+Number(p.amount||0),0);
  const lastMonth = pmt.filter(p=>p.status==='paid'&&p.paid_date>=lastMonthStart&&p.paid_date<=lastMonthEnd).reduce((s,p)=>s+Number(p.amount||0),0);
  const next30 = pmt.filter(p=>p.status!=='paid'&&p.due_date>=today&&p.due_date<=d30).reduce((s,p)=>s+Number(p.amount||0),0);
  const next60 = pmt.filter(p=>p.status!=='paid'&&p.due_date>d30&&p.due_date<=d60).reduce((s,p)=>s+Number(p.amount||0),0);
  const next90 = pmt.filter(p=>p.status!=='paid'&&p.due_date>d60&&p.due_date<=d90).reduce((s,p)=>s+Number(p.amount||0),0);

  const trend = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;
  const trendUp = trend !== null && trend >= 0;

  return (
    <Card>
      <CardHead title="Revenue" sub="collected & forecast"/>
      <div style={{padding:'0 16px 16px',display:'flex',flexDirection:'column',gap:12}}>
        {/* This month vs last */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:C.rosaPale,borderRadius:10,padding:'10px 12px'}}>
            <div style={{fontSize:10,color:C.rosa,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>This month</div>
            <div style={{fontSize:18,fontWeight:700,color:C.ink}}>{fmt(thisMonth)}</div>
            {trend!==null&&<div style={{fontSize:11,color:trendUp?'#10B981':'#EF4444',marginTop:2}}>{trendUp?'↑':'↓'} {Math.abs(Math.round(trend))}% vs last month</div>}
          </div>
          <div style={{background:C.grayBg,borderRadius:10,padding:'10px 12px'}}>
            <div style={{fontSize:10,color:C.gray,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Last month</div>
            <div style={{fontSize:18,fontWeight:700,color:C.inkMid||C.ink}}>{fmt(lastMonth)}</div>
          </div>
        </div>
        {/* Forecast bars */}
        {(next30+next60+next90)>0&&(
          <div>
            <div style={{fontSize:11,color:C.gray,fontWeight:500,marginBottom:8}}>Expected (unpaid milestones)</div>
            {[{label:'Next 30 days',amt:next30,color:'#3B82F6'},{label:'31–60 days',amt:next60,color:'#8B5CF6'},{label:'61–90 days',amt:next90,color:'#6B7280'}].map(row=>(
              <div key={row.label} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <div style={{fontSize:11,color:C.gray,width:90,flexShrink:0}}>{row.label}</div>
                <div style={{flex:1,height:6,background:C.border,borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',background:row.color,borderRadius:3,width:row.amt>0?`${Math.min(100,Math.round((row.amt/(next30+next60+next90))*100))}%`:'0%',transition:'width 0.4s'}}/>
                </div>
                <div style={{fontSize:12,fontWeight:500,color:C.ink,width:72,textAlign:'right',flexShrink:0}}>{fmt(row.amt)}</div>
              </div>
            ))}
          </div>
        )}
        {(next30+next60+next90)===0&&pmt.length>0&&(
          <div style={{fontSize:12,color:C.gray,textAlign:'center',padding:'8px 0'}}>No upcoming milestones due in the next 90 days</div>
        )}
      </div>
    </Card>
  );
}

// ─── STAFF UTILIZATION CARD ──────────────────────────────────────────────────
function StaffUtilizationCard({ events, staff }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const allAppts = (events || []).flatMap(e => e.appointments || []);
  const monthAppts = allAppts.filter(a => a.date >= monthStart && a.date <= monthEnd && a.staff_id);

  if (!staff?.length || !monthAppts.length) return null;

  const counts = {};
  monthAppts.forEach(a => {
    counts[a.staff_id] = (counts[a.staff_id] || 0) + 1;
  });

  const staffWithCounts = (staff || [])
    .map(s => ({ ...s, count: counts[s.id] || 0 }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!staffWithCounts.length) return null;
  const maxCount = staffWithCounts[0].count;

  return (
    <Card>
      <CardHead title="Staff this month" sub={`${monthAppts.length} appointment${monthAppts.length!==1?'s':''}`}/>
      <div style={{padding:'0 16px 16px',display:'flex',flexDirection:'column',gap:10}}>
        {staffWithCounts.map(s => (
          <div key={s.id} style={{display:'flex',alignItems:'center',gap:10}}>
            <Avatar initials={s.initials||s.name?.split(' ').map(w=>w[0]).join('').slice(0,2)||'?'} size={28} bg={s.color||C.rosaPale} color={C.white}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                <span style={{fontSize:12,fontWeight:500,color:C.ink}}>{s.name}</span>
                <span style={{fontSize:11,color:C.gray}}>{s.count} appt{s.count!==1?'s':''}</span>
              </div>
              <div style={{height:4,borderRadius:2,background:C.border,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:2,background:C.rosa,width:`${Math.round((s.count/maxCount)*100)}%`,transition:'width 0.4s'}}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── END OF DAY SUMMARY ──────────────────────────────────────────────────────
function EndOfDaySummary({ payments, events, appointments }) {
  const today = new Date().toISOString().slice(0, 10);

  const doneAppts = (appointments || []).filter(a => a.date === today && a.status === 'completed').length;
  const totalAppts = (appointments || []).filter(a => a.date === today).length;

  const paidToday = (payments || []).filter(p => p.paid_date === today && p.status === 'paid');
  const revenueToday = paidToday.reduce((s, p) => s + Number(p.amount || 0), 0);

  const eventsToday = (events || []).filter(e => e.event_date === today).length;

  const allClear = doneAppts === 0 && paidToday.length === 0 && eventsToday === 0;

  if (allClear && totalAppts === 0) return null;

  return (
    <Card>
      <CardHead title="Today's recap" sub={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} />
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {totalAppts > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: doneAppts === totalAppts ? '#D1FAE5' : '#F9FAFB', borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: C.ink }}>Appointments</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: doneAppts === totalAppts ? '#065F46' : C.ink }}>{doneAppts}/{totalAppts} done</span>
          </div>
        )}
        {paidToday.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#D1FAE5', borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: C.ink }}>Payments collected</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#065F46' }}>{fmt(revenueToday)}</span>
          </div>
        )}
        {eventsToday > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.rosaPale, borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: C.ink }}>Events today</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.rosa }}>{eventsToday}</span>
          </div>
        )}
        {doneAppts === 0 && paidToday.length === 0 && eventsToday === 0 && totalAppts > 0 && (
          <div style={{ fontSize: 12, color: C.gray, textAlign: 'center', padding: '8px 0' }}>No completed items yet today</div>
        )}
      </div>
    </Card>
  );
}

// ─── FOCUS DASHBOARD ─────────────────────────────────────────────────────────
const FocusDashboard = ({ setScreen, setSelectedEvent, events, payments, staff, onToggleFocus }) => {
  const { boutique } = useAuth();
  const { appointments: todayAppts, reload: reloadAppts } = useAppointmentsToday();

  const [dueReturns, setDueReturns]     = useState([]);
  const [dueAlts, setDueAlts]           = useState([]);
  const [showAppt, setShowAppt]         = useState(false);

  const today     = new Date().toISOString().split('T')[0];
  const tomorrow  = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const in3days   = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  useEffect(() => {
    if (!boutique?.id) return;

    // Dress returns due today or tomorrow
    supabase.from('inventory')
      .select('id, name, return_date, client_id')
      .eq('boutique_id', boutique.id)
      .eq('status', 'out')
      .lte('return_date', tomorrow)
      .then(({ data }) => setDueReturns(data || []));

    // Alterations due within 3 days, not completed
    supabase.from('alteration_jobs')
      .select('id, garment, deadline, status, client_id, clients(name)')
      .eq('boutique_id', boutique.id)
      .neq('status', 'done')
      .lte('deadline', in3days)
      .order('deadline', { ascending: true })
      .then(({ data }) => setDueAlts(data || []));
  }, [boutique?.id]);

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const APPT_TYPE_LABELS = {
    measurement: 'Measurements', try_on: '1st fitting',
    final_fitting: 'Final fitting', pickup: 'Pickup',
    consultation: 'Consultation', other: 'Appointment',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Topbar */}
      <Topbar
        title={<span>⚡ Focus Mode <span style={{ fontSize: 12, fontWeight: 400, color: C.gray, marginLeft: 6 }}>{dateLabel}</span></span>}
        actions={
          <GhostBtn label="Exit Focus Mode" onClick={onToggleFocus} />
        }
      />

      <div className="page-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Quick actions row */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: '+ New Rental',     col: '#7C3AED', bg: '#F5F3FF', event: 'belori:new-rental',     screen: 'inventory' },
            { label: '+ New Event',      col: C.rosa,    bg: C.rosaPale, event: 'belori:new-event',     screen: 'events' },
            { label: '+ New Alteration', col: '#0D9488', bg: '#F0FDFA', event: 'belori:new-alteration', screen: 'alterations' },
          ].map((a, i) => (
            <button key={i}
              onClick={() => { setScreen(a.screen); setTimeout(() => window.dispatchEvent(new CustomEvent(a.event)), 80); }}
              style={{ flex: 1, padding: '12px 10px', borderRadius: 10, border: `1.5px solid ${a.col}22`, background: a.bg, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: a.col, transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={() => setScreen('clients')}
            style={{ flex: 1, padding: '12px 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: C.gray, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.rosa; e.currentTarget.style.color = C.rosa; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.gray; }}
          >
            Look up client
          </button>
        </div>

        {/* Today's appointments */}
        <Card>
          <CardHead title={`Today's appointments (${todayAppts.length})`} action="+ New" onAction={() => setShowAppt(true)} />
          {todayAppts.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: C.gray, fontSize: 13 }}>
              No appointments today — enjoy the calm 🌸
            </div>
          ) : (
            <>
              {todayAppts.map((a, i) => {
                const timeStr = a.time ? a.time.slice(0, 5) : '';
                const cfg = APPT_TYPE_CFG[a.type] || APPT_TYPE_CFG.other;
                const ev = events?.find(e => e.id === a.event_id);
                const isDone = a.status === 'completed';
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < todayAppts.length - 1 ? `1px solid ${C.border}` : 'none', cursor: ev ? 'pointer' : 'default', opacity: isDone ? 0.6 : 1 }}
                    onClick={() => ev && (setSelectedEvent(ev.id), setScreen('event_detail'))}
                    onMouseEnter={e => e.currentTarget.style.background = C.ivory}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ minWidth: 48, textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{timeStr}</div>
                      <div style={{ fontSize: 10, color: C.gray }}>{timeStr ? 'AM' : '' }</div>
                    </div>
                    <Avatar initials={ev?.client?.slice(0, 2)?.toUpperCase() || '?'} size={32} bg={cfg.col} color={cfg.textCol} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, textDecoration: isDone ? 'line-through' : 'none' }}>{ev?.client || 'Client'}</div>
                      <div style={{ fontSize: 11, color: C.gray }}>{APPT_TYPE_LABELS[a.type] || 'Appointment'}{a.note ? ` · ${a.note}` : ''}</div>
                    </div>
                    {isDone
                      ? <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', background: '#D1FAE5', padding: '3px 8px', borderRadius: 6 }}>Done</span>
                      : <Badge text={cfg.tag} bg={cfg.tagBg} color={cfg.tagCol} />
                    }
                  </div>
                );
              })}
              {todayAppts.some(a => a.status !== 'completed') && (
                <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={async () => {
                      const pending = todayAppts.filter(a => a.status !== 'completed');
                      if (!pending.length) return;
                      if (!window.confirm(`Mark all ${pending.length} appointment${pending.length !== 1 ? 's' : ''} as completed?`)) return;
                      await Promise.all(pending.map(a =>
                        supabase.from('appointments').update({ status: 'completed' }).eq('id', a.id)
                      ));
                      reloadAppts();
                    }}
                    style={{ fontSize: 12, fontWeight: 500, color: '#059669', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', minHeight: 'unset', minWidth: 'unset' }}
                  >
                    Mark all complete
                  </button>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Dress returns due */}
        {dueReturns.length > 0 && (
          <Card>
            <CardHead title={`👗 Dress returns due (${dueReturns.length})`} action="View all" onAction={() => setScreen('inventory')} />
            {dueReturns.map((item, i) => {
              const isToday   = item.return_date === today;
              const isTomorrow = item.return_date === tomorrow;
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < dueReturns.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: isToday ? '#DC2626' : '#D97706', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: isToday ? '#DC2626' : '#D97706', fontWeight: 500 }}>
                      {isToday ? 'Due TODAY' : isTomorrow ? 'Due tomorrow' : `Due ${item.return_date}`}
                    </div>
                  </div>
                  <button onClick={() => setScreen('inventory')}
                    style={{ fontSize: 11, padding: '5px 11px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', color: C.gray, minHeight: 'unset', minWidth: 'unset' }}>
                    Mark returned
                  </button>
                </div>
              );
            })}
          </Card>
        )}

        {/* Alterations due soon */}
        {dueAlts.length > 0 && (
          <Card>
            <CardHead title={`✂️ Alterations due soon (${dueAlts.length})`} action="View board" onAction={() => setScreen('alterations')} />
            {dueAlts.map((job, i) => {
              const isToday   = job.deadline === today;
              const isTomorrow = job.deadline === tomorrow;
              const clientName = job.clients?.name || 'Client';
              const STATUS_LABEL = { pending: 'Pending', in_progress: 'In progress', fitting: 'Fitting', ready: 'Ready' };
              const statusColors = { pending: C.gray, in_progress: '#D97706', fitting: C.rosa, ready: '#059669' };
              return (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < dueAlts.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}
                  onClick={() => setScreen('alterations')}
                  onMouseEnter={e => e.currentTarget.style.background = C.ivory}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: isToday ? '#DC2626' : '#D97706', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{clientName} — {job.garment}</div>
                    <div style={{ fontSize: 11, color: isToday ? '#DC2626' : '#D97706', fontWeight: 500 }}>
                      {isToday ? 'Deadline TODAY' : isTomorrow ? 'Due tomorrow' : `Due ${job.deadline}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: statusColors[job.status] || C.gray, background: C.grayBg, padding: '3px 8px', borderRadius: 6 }}>
                    {STATUS_LABEL[job.status] || job.status}
                  </span>
                </div>
              );
            })}
          </Card>
        )}

        {/* Empty state */}
        {dueReturns.length === 0 && dueAlts.length === 0 && todayAppts.length === 0 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 6 }}>All clear for today!</div>
            <div style={{ fontSize: 13, color: C.gray }}>No appointments, returns, or urgent alterations. Use the quick actions above to get started.</div>
          </div>
        )}

        {/* End of day recap */}
        <EndOfDaySummary payments={payments} events={events} appointments={todayAppts} />
      </div>

      {showAppt && <StandaloneAppointmentModal events={events || []} staff={staff || []} onClose={() => setShowAppt(false)} onSaved={() => { reloadAppts(); setShowAppt(false); }} />}

    </div>
  );
};

const DashboardFull = ({setScreen,setSelectedEvent,events,payments,inventory,boutique,clients,staff,alterations}) => {
  const { boutique: authBoutique } = useAuth();
  const { appointments: todayAppts, reload: reloadAppts } = useAppointmentsToday();
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [showStandaloneAppt, setShowStandaloneAppt] = useState(false);
  const [churnCount, setChurnCount] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState(null);
  const toast = useToast();

  // Auto-progress fully-paid past events to 'completed' — runs once per session after events load
  const [autoProgressDone, setAutoProgressDone] = useState(false);
  useEffect(() => {
    if (!authBoutique?.id || !events?.length || autoProgressDone) return;
    setAutoProgressDone(true);
    autoProgressEvents(events, authBoutique.id, supabase).then(count => {
      if (count > 0) {
        toast(`${count} event${count !== 1 ? 's' : ''} marked completed automatically`);
      }
    }).catch(() => {});
  }, [authBoutique?.id, events?.length, autoProgressDone]);
  const overdueTotal = payments.filter(p=>p.status==='overdue').reduce((s,p)=>s+p.amount,0);
  const rentedCount = inventory.filter(d=>['rented','reserved','picked_up'].includes(d.status)).length;
  const totalCount = inventory.length;
  const alert = getPriorityAlert(events);
  const { isTablet } = useLayoutMode();

  // Real-time revenue: sum paid milestones this calendar month
  const now = new Date();
  const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().split('T')[0];
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  const allMilestones  = events.flatMap(e => e.milestones || []);
  const revenueThisMonth = events.length
    ? allMilestones.filter(m => m.status === 'paid' && m.paid_date && m.paid_date >= monthStart)
        .reduce((s, m) => s + Number(m.amount), 0)
    : null;
  const revenueLastMonth = events.length
    ? allMilestones.filter(m => m.status === 'paid' && m.paid_date && m.paid_date >= lastMonthStart && m.paid_date <= lastMonthEnd)
        .reduce((s, m) => s + Number(m.amount), 0)
    : null;
  const revPct = revenueThisMonth !== null && revenueLastMonth !== null && revenueLastMonth > 0
    ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
    : null;

  // Churn alert: clients with last_contacted_at > 90 days ago
  useEffect(() => {
    if (!authBoutique) return;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    supabase.from('clients').select('id', { count: 'exact', head: true })
      .eq('boutique_id', authBoutique.id)
      .lt('last_contacted_at', ninetyDaysAgo)
      .not('last_contacted_at', 'is', null)
      .then(({ count }) => setChurnCount(count || 0));
  }, [authBoutique?.id]);

  // Revenue collected this week (last 7 days of paid milestones)
  useEffect(() => {
    if (!authBoutique?.id) return;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    supabase.from('payment_milestones')
      .select('amount')
      .eq('boutique_id', authBoutique.id)
      .eq('status', 'paid')
      .gte('paid_date', sevenDaysAgo)
      .then(({ data }) => {
        const total = (data || []).reduce((s, m) => s + Number(m.amount || 0), 0);
        setWeeklyRevenue(total);
      });
  }, [authBoutique?.id]);

  // Greeting
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const ownerMember = staff?.find(s => s.role === 'owner') || staff?.[0];
  const ownerFirst = ownerMember?.name?.split(' ')[0] || boutique?.name?.split(' ')[0] || '';

  // Subtitle
  const todayLabel = now.toLocaleDateString('en-US', {weekday:'long',month:'long',day:'numeric'});
  const apptCount = todayAppts?.length ?? 0;
  const apptLabel = apptCount === 0 ? 'No appointments today' : `${apptCount} appointment${apptCount !== 1 ? 's' : ''} today`;

  // Map real today appointments to display rows
  const mappedAppts = (todayAppts || []).map(a => {
    const cfg = APPT_TYPE_CFG[a.type] || APPT_TYPE_CFG.other;
    const clientName = a.event?.client?.name || a.client_name || '';
    const parts = clientName.split(' ');
    const init = (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
    const evType = a.event?.type === 'wedding' ? 'Wedding' : a.event?.type === 'quince' ? 'Quinceañera' : '';
    const isWalkIn = a.type === 'walk_in';
    const serviceStr = isWalkIn
      ? ['Walk-in', a.client_phone, a.note].filter(Boolean).join(' · ')
      : [cfg.label, evType, a.note].filter(Boolean).join(' · ');
    const rawTime = a.time || '';
    const displayTime = rawTime.slice(0, 5).replace(/^0/, '');
    return { time: displayTime, client: clientName, init: init.toUpperCase(), col: cfg.col, textCol: cfg.textCol, service: serviceStr, tag: cfg.tag, tagBg: cfg.tagBg, tagCol: cfg.tagCol };
  });
  const displayAppts = mappedAppts;

  function goWithHint(screen, hint) {
    if (hint) sessionStorage.setItem('belori_autoopen', hint);
    setScreen(screen);
  }

  const QUICK_ACTIONS = [
    {label:'New rental',sub:'Reserve a dress',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3c-2 0-4 1.5-5.5 4L4 12v8h16v-8l-2.5-5C16 4.5 14 3 12 3z"/><path d="M9 12c0-1.7 1.3-3 3-3s3 1.3 3 3"/></svg>,bg:'var(--bg-primary)',col:'var(--color-primary)',onClick:()=>setScreen('inventory')},
    {label:'Log return',sub:'Check a dress in',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,bg:'var(--bg-success)',col:'var(--color-success)',onClick:()=>setScreen('inventory')},
    {label:'New event',sub:'Book a client',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M12 14v4M10 16h4"/></svg>,bg:'var(--bg-info)',col:'var(--color-info)',onClick:()=>goWithHint('events','new_event')},
    {label:'Add alteration',sub:'Start a job',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3l2 6-4 3 4 3-2 6 6-4 6 4-2-6 4-3-4-3 2-6-6 4z"/></svg>,bg:'var(--bg-accent)',col:'var(--color-accent)',onClick:()=>goWithHint('alterations','new_alteration')},
    {label:'Payments',sub:'View overdue',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,bg:'var(--bg-warning)',col:'var(--color-warning)',onClick:()=>setScreen('payments')},
    {label:'New client',sub:'Add a contact',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="7" r="4"/><path d="M2 21v-1a8 8 0 0 1 12.95-6.3M19 15v6M22 18h-6"/></svg>,bg:'var(--bg-success)',col:'var(--color-success)',onClick:()=>goWithHint('clients','new_client')},
  ];

  // Returns due in next 7 days
  const today7 = new Date(); today7.setDate(today7.getDate()+7);
  const returnsDue = inventory.filter(d => ['rented','picked_up'].includes(d.status) && d.return_date && new Date(d.return_date+'T12:00:00') <= today7);
  const returnsDueToday = returnsDue.filter(d => d.return_date === now.toISOString().split('T')[0]);

  const fmtCurrency = (amount) => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(amount);

  const STATS = [
    {label:'Revenue this month',val:revenueThisMonth !== null ? fmt(revenueThisMonth) : '—',sub:revenueThisMonth !== null ? (revPct !== null ? `${revPct >= 0 ? '▲' : '▼'} ${Math.abs(revPct)}% vs last month` : `${now.toLocaleString('default',{month:'long'})}`) : 'Loading…',subCol:revPct !== null ? (revPct >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-success)',icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,iconBg:'var(--bg-success)',iconCol:'var(--color-success)',onClick:()=>setScreen('payments')},
    {label:'Active events',val:`${events.length}`,sub:`${events.filter(e=>e.type==='wedding').length} weddings · ${events.filter(e=>e.type==='quince').length} quinces`,subCol:C.gray,icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,iconBg:'var(--bg-info)',iconCol:'var(--color-info)',onClick:()=>setScreen('events')},
    {label:'Dresses rented',val:`${rentedCount}/${totalCount}`,sub:returnsDue.length>0?`${returnsDue.length} due back soon`:'No returns due soon',subCol:returnsDue.length>0?'var(--color-warning)':C.gray,icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3c-2 0-4 1.5-5.5 4L4 12v8h16v-8l-2.5-5C16 4.5 14 3 12 3z"/></svg>,iconBg:'var(--bg-primary)',iconCol:'var(--color-primary)',onClick:()=>setScreen('inventory')},
    {label:'Payments overdue',val:fmt(overdueTotal),sub:`${payments.filter(p=>p.status==='overdue').length} clients · action needed`,subCol:'var(--color-danger)',icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,iconBg:'var(--bg-danger)',iconCol:'var(--color-danger)',onClick:()=>setScreen('payments')},
    {label:"This week's revenue",val:weeklyRevenue !== null ? fmtCurrency(weeklyRevenue) : '—',sub:'Last 7 days collected',subCol:'#10B981',icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>,iconBg:'#D1FAE5',iconCol:'#10B981',onClick:()=>setScreen('payments')},
  ];

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
      <Topbar title={ownerFirst ? `${greeting}, ${ownerFirst}` : greeting} subtitle={`${todayLabel} · ${apptLabel}`}
        actions={<><GhostBtn label="🖥️ Kiosk" className="topbar-hide" onClick={()=>{ const id=boutique?.id; window.open(`/kiosk${id?`?boutique=${id}`:''}`, '_blank'); }}/><GhostBtn label="View packages" className="topbar-hide" onClick={()=>goWithHint('settings','tab_packages')}/><GhostBtn label="+ New Appointment" className="topbar-hide" onClick={()=>setShowStandaloneAppt(true)}/><PrimaryBtn label="+ New client" colorScheme="success" onClick={()=>goWithHint('clients','new_client')}/></>}/>
      {alert && <AlertBanner
        msg={<>
          <strong>{alert.event.client}'s {alert.event.type === 'wedding' ? 'wedding' : 'quinceañera'} is in {alert.event.daysUntil} days</strong>
          {alert.event.overdue > 0 && ` — $${alert.event.overdue.toLocaleString()} deposit overdue`}
          {alert.event.missingAppointments?.length > 0 && ` — ${alert.event.missingAppointments[0].type.replace(/_/g,' ')} not scheduled`}
        </>}
        action="Act now"
        onAction={()=>{setSelectedEvent(alert.event.id);setScreen('event_detail');}}
      />}
      <div className="page-scroll" style={{flex:1,minHeight:0,overflowY:'auto',padding:isTablet?16:20,display:'flex',flexDirection:'column',gap:isTablet?12:16}}>
        <DailyBriefingBanner appointments={todayAppts} payments={payments} events={events}/>
        <OnboardingChecklist events={events} clients={clients} staff={staff} inventory={inventory} payments={payments} appointments={todayAppts} setScreen={setScreen}/>

        {/* Churn alert widget */}
        {churnCount > 0 && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>⚠️ {churnCount} clients need re-engagement</div>
              <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>Last contact was 90+ days ago with no upcoming events</div>
            </div>
            <button onClick={() => setScreen('reports')} style={{ padding: '6px 12px', background: '#D97706', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              View →
            </button>
          </div>
        )}

        {/* Quick actions — desktop: ghost button row · tablet: 3-col icon grid */}
        {isTablet?(
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {QUICK_ACTIONS.map((a,i)=>(
              <button key={i} onClick={a.onClick} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'13px 8px',display:'flex',flexDirection:'column',alignItems:'center',gap:7,cursor:'pointer',transition:'all 0.13s',minHeight:'unset',minWidth:'unset',boxShadow:'var(--btn-shadow-ghost)'}}
                onTouchStart={e=>{e.currentTarget.style.borderColor=a.col;e.currentTarget.style.background=a.bg;e.currentTarget.style.transform='scale(0.96)';}} onTouchEnd={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.white;e.currentTarget.style.transform='scale(1)';}}>
                <div style={{width:40,height:40,borderRadius:10,background:a.bg,display:'flex',alignItems:'center',justifyContent:'center',color:a.col}}>{a.icon}</div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:11,fontWeight:500,color:C.ink,lineHeight:1.2}}>{a.label}</div>
                  <div style={{fontSize:10,color:C.gray,marginTop:2,lineHeight:1.2}}>{a.sub}</div>
                </div>
              </button>
            ))}
          </div>
        ):(
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {QUICK_ACTIONS.map((a,i)=>(
              <button key={i} onClick={a.onClick} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontSize:12,color:C.gray,whiteSpace:'nowrap',minHeight:'unset',minWidth:'unset',transition:'all 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background=a.bg;e.currentTarget.style.borderColor=a.col;e.currentTarget.style.color=a.col;}} onMouseLeave={e=>{e.currentTarget.style.background=C.white;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.gray;}}>
                <span style={{color:a.col,fontWeight:600}}>+</span>{a.label}
              </button>
            ))}
          </div>
        )}

        {/* Stat grid — desktop: flat number · tablet: icon + number */}
        <div className="stat-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:isTablet?8:12}}>
          {STATS.map((s,i)=>(
            <div key={i} onClick={s.onClick} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:isTablet?10:12,padding:isTablet?'11px 13px':'14px 16px',display:'flex',alignItems:isTablet?'center':'flex-start',gap:isTablet?11:0,flexDirection:isTablet?'row':'column',boxShadow:isTablet?'0 1px 4px rgba(0,0,0,0.06)':'none',cursor:s.onClick?'pointer':'default',transition:'all 0.15s'}}
              onMouseEnter={e=>{if(s.onClick){e.currentTarget.style.borderColor=C.rosa;e.currentTarget.style.boxShadow='0 4px 12px rgba(201,105,122,0.1)';}}}
              onMouseLeave={e=>{if(s.onClick){e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow=isTablet?'0 1px 4px rgba(0,0,0,0.06)':'none';}}}>
              {isTablet&&<div style={{width:40,height:40,borderRadius:10,background:s.iconBg,display:'flex',alignItems:'center',justifyContent:'center',color:s.iconCol,flexShrink:0}}>{s.icon}</div>}
              <div>
                {!isTablet&&<div style={{fontSize:11,color:C.gray,marginBottom:4}}>{s.label}</div>}
                <div style={{fontSize:'var(--stat-num-size)',fontWeight:500,color:C.ink,lineHeight:1}}>{s.val}</div>
                {isTablet&&<div style={{fontSize:11,color:C.gray,marginTop:2}}>{s.label}</div>}
                <div style={{fontSize:10,color:s.subCol,marginTop:isTablet?1:4}}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Insights Panel */}
        <AIInsightsPanel
          payments={payments}
          events={events}
          inventory={inventory}
          clients={clients}
          alterations={alterations}
          setScreen={setScreen}
        />

        {/* Recently Viewed */}
        <RecentlyViewedCard setScreen={setScreen} setSelectedEvent={setSelectedEvent}/>

        {/* Revenue Forecast Panel */}
        <RevenueForecastPanel payments={payments}/>

        {/* Staff Utilization Card */}
        <StaffUtilizationCard events={events} staff={staff}/>

        <div className="dash-layout" style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:16}}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <Card>
              <CardHead title="Today's appointments" action="+ New" onAction={()=>setShowStandaloneAppt(true)}/>
              {displayAppts.length === 0
                ? <div style={{padding:'20px 16px',textAlign:'center',color:C.gray,fontSize:13}}>No appointments scheduled for today</div>
                : displayAppts.map((a,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:i<displayAppts.length-1?`1px solid ${C.border}`:'none',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.ivory} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{fontSize:12,color:C.gray,minWidth:38,flexShrink:0}}>{a.time}</span>
                  <Avatar initials={a.init} size={28} bg={a.col} color={a.textCol}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{a.client}</div>
                    <div style={{fontSize:11,color:C.gray,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.service}</div>
                  </div>
                  <Badge text={a.tag} bg={a.tagBg} color={a.tagCol}/>
                </div>
              ))}
            </Card>
            <Card>
              <CardHead title="Upcoming events" action="Full calendar" onAction={()=>setScreen('events')}/>
              {events.slice(0,5).map((ev,i)=>(
                <div key={ev.id} onClick={()=>{setSelectedEvent(ev.id);setScreen('event_detail');}}
                  style={{display:'flex',alignItems:'flex-start',gap:12,padding:'10px 16px',borderBottom:i<4?`1px solid ${C.border}`:'none',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.ivory} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{minWidth:40,textAlign:'center'}}>
                    <div style={{fontSize:9,fontWeight:500,color:C.gray,textTransform:'uppercase'}}>{ev.date.split(' ')[0]}</div>
                    <div style={{fontSize:20,fontWeight:500,color:C.ink,lineHeight:1}}>{ev.date.split(' ')[1]}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{ev.client}</div>
                    <div style={{fontSize:11,color:C.gray,marginTop:1}}>{ev.type==='wedding'?'Wedding':'Quinceañera'} · {ev.venue}</div>
                    <div style={{display:'flex',gap:4,marginTop:5,flexWrap:'wrap'}}>
                      {ev.services.map(s=><SvcTag key={s} svc={s}/>)}
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{fmt(ev.total)}</div>
                    {ev.overdue>0?<div style={{fontSize:11,color:'var(--color-danger)'}}>{fmt(ev.overdue)} overdue</div>
                      :<div style={{fontSize:11,color:'var(--color-success)'}}>{fmt(ev.paid)} paid</div>}
                    <Countdown days={ev.daysUntil}/>
                  </div>
                </div>
              ))}
            </Card>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <Card>
              <CardHead title="Payments due this week"/>
              {payments.filter(p=>p.status!=='paid').slice(0,4).map((p,i)=>(
                <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'9px 16px',borderBottom:i<3?`1px solid ${C.border}`:'none',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.ivory} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <StatusDot status={p.status}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:C.ink,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.client} — {p.label}</div>
                    <div style={{fontSize:11,color:C.gray}}>{p.status==='overdue'?`${p.daysLate} days overdue`:`Due ${p.due}`}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:13,fontWeight:500,color:p.status==='overdue'?'var(--color-danger)':C.ink}}>{fmt(p.amount)}</div>
                    {p.status==='overdue'&&<div onClick={()=>setScreen('payments')} style={{fontSize:11,color:C.rosa,cursor:'pointer',fontWeight:500}}>Remind →</div>}
                  </div>
                </div>
              ))}
            </Card>
            {returnsDue.length > 0 && (
              <Card>
                <CardHead title="Returns due soon" action="View all" onAction={()=>setScreen('inventory')}/>
                {returnsDue.slice(0,4).map((d,i)=>{
                  const isToday = d.return_date === now.toISOString().split('T')[0];
                  const dueDate = d.return_date ? new Date(d.return_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';
                  return (
                    <div key={d.id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 16px',borderBottom:i<Math.min(returnsDue.length,4)-1?`1px solid ${C.border}`:'none'}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:isToday?'var(--color-danger)':'var(--color-warning)',flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</div>
                        <div style={{fontSize:11,color:C.gray}}>{d.clientName||'—'}</div>
                      </div>
                      <div style={{fontSize:11,fontWeight:500,color:isToday?'var(--color-danger)':'var(--color-warning)',whiteSpace:'nowrap'}}>{isToday?'Today':dueDate}</div>
                    </div>
                  );
                })}
              </Card>
            )}
            {(()=>{
              const today = new Date();
              const upcoming = (clients||[]).filter(cl=>{
                if(!cl.birthday)return false;
                const bday = new Date(cl.birthday+'T12:00:00');
                const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
                const nextYear = new Date(today.getFullYear()+1, bday.getMonth(), bday.getDate());
                const target = thisYear >= today ? thisYear : nextYear;
                const diff = Math.round((target - today)/(1000*60*60*24));
                return diff>=0 && diff<=14;
              }).map(cl=>{
                const bday = new Date(cl.birthday+'T12:00:00');
                const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
                const target = thisYear >= today ? thisYear : new Date(today.getFullYear()+1, bday.getMonth(), bday.getDate());
                const diff = Math.round((target - today)/(1000*60*60*24));
                const label = bday.toLocaleDateString('en-US',{month:'short',day:'numeric'});
                return {...cl, _diff:diff, _label:label};
              }).sort((a,b)=>a._diff-b._diff).slice(0,5);
              if(upcoming.length===0)return null;
              return (
                <Card>
                  <CardHead title="Upcoming birthdays"/>
                  {upcoming.map((cl,i)=>(
                    <div key={cl.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:i<upcoming.length-1?`1px solid ${C.border}`:'none'}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:cl._diff===0?C.rosa:'var(--color-accent)',flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cl.name}</div>
                        <div style={{fontSize:11,color:C.gray}}>{cl._diff===0?'Today!':cl._diff===1?'Tomorrow':`In ${cl._diff} days`}</div>
                      </div>
                      <div style={{fontSize:11,fontWeight:500,color:C.gray,whiteSpace:'nowrap'}}>{cl._label}</div>
                    </div>
                  ))}
                </Card>
              );
            })()}
            <Card>
              <div style={{padding:'12px 16px'}}>
                <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:4}}>Staff today</div>
                {staff.length === 0
                  ? <div style={{padding:'10px 0',fontSize:12,color:C.gray,textAlign:'center'}}>No staff on record</div>
                  : staff.map(s=>(
                  <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid ${C.border}`}}>
                    <Avatar initials={s.initials||s.name?.slice(0,2).toUpperCase()} size={24} bg={(s.color||C.rosa)+'22'} color={s.color||C.rosa}/>
                    <div style={{flex:1}}><div style={{fontSize:12,fontWeight:500,color:C.ink}}>{s.name}</div><div style={{fontSize:10,color:C.gray}}>{s.role}</div></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
      {showNewAppt && (
        <NewAppointmentModal
          events={events}
          staff={staff}
          onClose={()=>setShowNewAppt(false)}
          onSaved={()=>{ setShowNewAppt(false); reloadAppts(); }}
        />
      )}
      {showStandaloneAppt && (
        <StandaloneAppointmentModal
          clients={clients}
          staff={staff}
          onClose={()=>setShowStandaloneAppt(false)}
          onSaved={()=>{ setShowStandaloneAppt(false); reloadAppts(); }}
        />
      )}
    </div>
  );
};

// ─── DASHBOARD WRAPPER — switches between Focus and Full view ─────────────────
const Dashboard = ({ focusMode, onToggleFocus, ...props }) => {
  if (focusMode) return <FocusDashboard {...props} onToggleFocus={onToggleFocus} />;
  return <DashboardFull {...props} />;
};

export default Dashboard;
