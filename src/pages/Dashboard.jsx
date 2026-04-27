import React, { useState, useEffect, useMemo } from 'react';
import { C, fmt, EVT_TYPES, SVC_LABELS, SVC_COLORS } from '../lib/colors';
import { Avatar, Badge, Card, CardHead, Topbar, PrimaryBtn, GhostBtn, SvcTag,
  Countdown, EventTypeBadge, ProgressBar, StatusDot, AlertBanner, useToast,
  inputSt, LBL } from '../lib/ui.jsx';
import { getPriorityAlert, getCountdownConfig } from '../lib/urgency';
import { useLayoutMode } from '../hooks/useLayoutMode.jsx';
import { useNotes, useTasks, useAppointmentsToday } from '../hooks/useNotes';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { autoProgressEvents } from '../hooks/useEvents';
import StandaloneAppointmentModal from '../components/StandaloneAppointmentModal';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const D = {
  bg:        '#F8F4F0',
  card:      '#FFFFFF',
  gold:      '#B08A4E',
  goldLight: '#FBF5E9',
  goldBorder:'#E8D9B8',
  rose:      '#C06070',
  roseLight: '#FDF0F2',
  roseBorder:'#EDCDD2',
  ink:       '#1C1118',
  inkMid:    '#5C4A52',
  inkLight:  '#7A6670',
  border:    '#EDE7E2',
  serif:     "'Cormorant Garamond', 'Didot', 'Times New Roman', Georgia, serif",
  sans:      "'DM Sans', 'Inter', system-ui, sans-serif",
  shadow:    '0 1px 4px rgba(28,17,24,0.06)',
  shadowMd:  '0 4px 16px rgba(28,17,24,0.09)',
  shadowLg:  '0 12px 40px rgba(28,17,24,0.12)',
};

// ─── FONT INJECTION ───────────────────────────────────────────────────────────
const DashFonts = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
    .dash-root * { font-family: ${D.sans}; }
    .dash-serif { font-family: ${D.serif} !important; }
    .dash-stat-num { font-family: ${D.serif} !important; font-weight: 300; letter-spacing: -0.02em; }
    .dash-root .page-scroll::-webkit-scrollbar { width: 4px; }
    .dash-root .page-scroll::-webkit-scrollbar-track { background: transparent; }
    .dash-root .page-scroll::-webkit-scrollbar-thumb { background: #DDD5CF; border-radius: 2px; }
    .dash-card { background: ${D.card}; border: 1px solid ${D.border}; border-radius: 16px; overflow: hidden; box-shadow: ${D.shadow}; }
    .dash-card-hover:hover { box-shadow: ${D.shadowMd}; border-color: ${D.roseBorder}; transform: translateY(-1px); transition: all 0.2s; }
    .dash-row-hover:hover { background: #FAF7F4 !important; }
    @keyframes dashFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .dash-fade-in { animation: dashFadeIn 0.4s ease both; }
    @keyframes dashPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
  `}</style>
);

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, subColor, accentColor, accentBg, icon, onClick, delay = 0 }) {
  return (
    <div
      onClick={onClick}
      className="dash-card dash-fade-in"
      style={{
        padding: '20px 20px 16px',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s',
        animationDelay: `${delay}ms`,
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = D.shadowMd; e.currentTarget.style.borderColor = D.roseBorder; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.boxShadow = D.shadow; e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = 'translateY(0)'; } }}
    >
      {/* Top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accentColor || D.gold, opacity: 0.6 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: D.inkLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: D.sans }}>{label}</div>
          <div className="dash-stat-num" style={{ fontSize: 32, color: D.ink, lineHeight: 1, marginBottom: 6 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: subColor || D.inkLight, fontFamily: D.sans, fontWeight: 400 }}>{sub}</div>}
        </div>
        {icon && (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: accentBg || D.goldLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor || D.gold, flexShrink: 0 }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ELEGANT DIVIDER ──────────────────────────────────────────────────────────
const Divider = ({ style }) => (
  <div style={{ height: 1, background: D.border, ...style }} />
);

const APPT_TYPE_CFG = {
  measurement:   {label:'Measurements',  tag:'Fitting',  tagBg:'var(--bg-success)', tagCol:'var(--text-success)', col:C.rosaPale,              textCol:C.rosaText},
  try_on:        {label:'1st fitting',   tag:'Fitting',  tagBg:'var(--bg-success)', tagCol:'var(--text-success)', col:C.rosaPale,              textCol:C.rosaText},
  final_fitting: {label:'Final fitting', tag:'Fitting',  tagBg:'var(--bg-success)', tagCol:'var(--text-success)', col:C.rosaPale,              textCol:C.rosaText},
  pickup:        {label:'Dress pickup',  tag:'Pickup',   tagBg:'var(--bg-warning)', tagCol:'var(--text-warning)', col:'var(--bg-warning)',      textCol:'var(--text-warning)'},
  consultation:  {label:'Consultation',  tag:'Consult',  tagBg:'var(--bg-accent)',  tagCol:'var(--text-accent)',  col:'var(--bg-accent)',       textCol:'var(--text-accent)'},
  other:         {label:'Appointment',   tag:'Appt',     tagBg:'var(--bg-info)',    tagCol:'var(--text-info)',    col:'var(--bg-info)',         textCol:'var(--text-info)'},
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
    <div style={{position:'fixed',inset:0,background:'rgba(28,17,24,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,backdropFilter:'blur(2px)'}}>
      <div style={{background:D.card,borderRadius:20,width:440,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:D.shadowLg,overflow:'hidden',border:`1px solid ${D.border}`}}>
        <div style={{padding:'20px 24px',borderBottom:`1px solid ${D.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <div className="dash-serif" style={{fontSize:18,fontWeight:400,color:D.ink,fontStyle:'italic'}}>New Appointment</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:D.inkLight,lineHeight:1,padding:'4px 8px',minWidth:32,minHeight:32,borderRadius:8,transition:'all 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background=D.bg} onMouseLeave={e=>e.currentTarget.style.background='none'}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
          {err && <div style={{fontSize:12,color:'var(--text-danger)',background:'var(--bg-danger)',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border-danger)'}}>{err}</div>}
          <div>
            <label htmlFor="new-appt-event" style={LBL}>Event *</label>
            <select id="new-appt-event" value={eventId} onChange={e=>setEventId(e.target.value)} style={{...inputSt}}>
              <option value="">Select event…</option>
              {(events||[]).filter(ev=>ev.status!=='completed'&&ev.status!=='cancelled').map(ev=>(
                <option key={ev.id} value={ev.id}>{ev.client} — {EVT_TYPES[ev.type]?.label || ev.type} · {ev.date}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-appt-type" style={LBL}>Type</label>
            <select id="new-appt-type" value={type} onChange={e=>setType(e.target.value)} style={{...inputSt}}>
              {APPT_TYPES.map(t=><option key={t} value={t}>{APPT_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label htmlFor="new-appt-date" style={LBL}>Date *</label>
              <input id="new-appt-date" type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...inputSt}}/>
            </div>
            <div>
              <label htmlFor="new-appt-time" style={LBL}>Time</label>
              <input id="new-appt-time" type="time" value={time} onChange={e=>setTime(e.target.value)} style={{...inputSt}}/>
            </div>
          </div>
          <div>
            <label htmlFor="new-appt-staff" style={LBL}>Staff member <span style={{fontWeight:400,color:D.inkLight}}>(optional)</span></label>
            <select id="new-appt-staff" value={staffId} onChange={e=>setStaffId(e.target.value)} style={{...inputSt}}>
              <option value="">Unassigned</option>
              {(staff||[]).map(s=><option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="new-appt-note" style={LBL}>Note <span style={{fontWeight:400,color:D.inkLight}}>(optional)</span></label>
            <textarea id="new-appt-note" value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="Any details for the appointment…" style={{...inputSt,resize:'vertical',fontFamily:'inherit'}}/>
          </div>
        </div>
        <div style={{padding:'14px 24px',borderTop:`1px solid ${D.border}`,display:'flex',justifyContent:'space-between',flexShrink:0}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>
          <PrimaryBtn label={saving?'Saving…':'Schedule appointment'} onClick={save} disabled={saving}/>
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
    <div className="dash-fade-in" style={{
      background: `linear-gradient(120deg, ${D.goldLight} 0%, ${D.roseLight} 100%)`,
      borderRadius: 14, padding: '14px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      border: `1px solid ${D.goldBorder}`,
    }}>
      <div style={{ flex: 1 }}>
        <div className="dash-serif" style={{ fontSize: 16, color: D.ink, fontStyle: 'italic' }}>{greeting} ✦</div>
        <div style={{ fontSize: 11, color: D.inkMid, marginTop: 2, fontFamily: D.sans }}>{todayStr}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {todayAppts > 0 && <span style={{ fontSize: 11, color: D.rose, fontWeight: 500, fontFamily: D.sans }}>◆ {todayAppts} appointment{todayAppts !== 1 ? 's' : ''} today</span>}
          {overdueCount > 0 && <span style={{ fontSize: 11, color: 'var(--text-danger)', fontWeight: 500, fontFamily: D.sans }}>◆ {overdueCount} overdue payment{overdueCount !== 1 ? 's' : ''}</span>}
          {todayAppts === 0 && overdueCount === 0 && <span style={{ fontSize: 11, color: '#6B9E6B', fontWeight: 500, fontFamily: D.sans }}>◆ Clear day — no urgent items</span>}
        </div>
      </div>
      <button onClick={dismiss} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.inkLight, fontSize: 18, lineHeight: 1, padding: '4px 8px', flexShrink: 0, minWidth: 32, minHeight: 32 }}>×</button>
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
    <div className="dash-card">
      <div style={{ padding: '16px 20px 10px', borderBottom: `1px solid ${D.border}` }}>
        <div className="dash-serif" style={{ fontSize: 16, color: D.ink, fontStyle: 'italic' }}>Recently Viewed</div>
      </div>
      <div style={{ padding: '4px 0 8px' }}>
        {items.map((item, i) => (
          <button key={i} onClick={() => {
            if (item.type === 'event') { setSelectedEvent(item.id); setScreen('event_detail'); }
            else if (item.type === 'client') setScreen('clients');
          }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = D.bg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: item.type === 'event' ? D.roseLight : D.goldLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
              {item.type === 'event' ? '◈' : '◉'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: D.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: D.sans }}>{item.name}</div>
              <div style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans }}>{item.sub}</div>
            </div>
            <span style={{ fontSize: 13, color: D.inkLight }}>›</span>
          </button>
        ))}
      </div>
    </div>
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
    {label:'Add your first client',         done: (clients?.length||0) > 0,   action:()=>goWithHint('clients','new_client'),    icon:'◉'},
    {label:'Book your first event',          done: (events?.length||0) > 0,    action:()=>goWithHint('events','new_event'),      icon:'◈'},
    {label:'Add a dress to inventory',       done: (inventory?.length||0) > 0, action:()=>goWithHint('inventory','new_dress'),   icon:'◇'},
    {label:'Invite a staff member',          done: (staff?.length||0) > 1,     action:()=>goWithHint('settings','invite_staff'), icon:'◎'},
    {label:'Set up your first payment milestone', done: (payments?.length||0) > 0, action:()=>setScreen('payments'),            icon:'◐'},
    {label:'Try the Calendar',               done: allAppointments.length > 0, action:()=>setScreen('schedule'),               icon:'◑'},
  ];
  const doneCount = items.filter(i=>i.done).length;
  const allDone = doneCount === items.length;

  useEffect(() => {
    if (prevDoneCount === null) { setPrevDoneCount(doneCount); return; }
    if (doneCount === items.length && prevDoneCount < items.length) {
      setShowCelebration(true);
      const t = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(t);
    }
    setPrevDoneCount(doneCount);
  }, [doneCount]);

  const createdAt = boutique?.created_at;
  const accountAgeDays = createdAt ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000) : 0;
  const canDismiss = allDone || accountAgeDays >= 14;

  if (dismissed) return null;

  const dismiss = () => { localStorage.setItem('belori_onboarding_dismissed','true'); setDismissed(true); };
  const pct = Math.round((doneCount / items.length) * 100);

  return (
    <>
      {showCelebration && (
        <div style={{background:D.goldLight,border:`1px solid ${D.goldBorder}`,borderRadius:12,padding:'12px 18px',display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18}}>✦</span>
          <span className="dash-serif" style={{fontSize:15,color:D.gold,fontStyle:'italic'}}>Setup complete! Your boutique is ready.</span>
        </div>
      )}
      <div className="dash-card">
        <div style={{padding:'18px 20px 14px',borderBottom:`1px solid ${D.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div>
            <div className="dash-serif" style={{fontSize:16,color:D.ink,fontStyle:'italic'}}>Getting Started</div>
            <div style={{fontSize:11,color:D.inkLight,marginTop:2,fontFamily:D.sans}}>{doneCount} of {items.length} steps complete</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {/* Progress arc / bar */}
            <div style={{position:'relative',width:36,height:36,flexShrink:0}}>
              <svg width="36" height="36" style={{transform:'rotate(-90deg)'}}>
                <circle cx="18" cy="18" r="14" fill="none" stroke={D.border} strokeWidth="3"/>
                <circle cx="18" cy="18" r="14" fill="none" stroke={D.gold} strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 14}`}
                  strokeDashoffset={`${2 * Math.PI * 14 * (1 - pct/100)}`}
                  strokeLinecap="round" style={{transition:'stroke-dashoffset 0.5s ease'}}/>
              </svg>
              <div className="dash-serif" style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:D.gold,fontWeight:600}}>{pct}%</div>
            </div>
            <button onClick={dismiss} aria-label="Close" style={{background:'none',border:'none',cursor:'pointer',color:D.inkLight,fontSize:16,lineHeight:1,padding:'4px 8px',minWidth:32,minHeight:32}}>×</button>
          </div>
        </div>
        <div style={{padding:'12px 20px 16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {items.map((item,i)=>(
            <button key={i} onClick={item.action}
              style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderRadius:10,border:`1px solid ${item.done?D.border:D.roseBorder}`,background:item.done?D.bg:D.roseLight,cursor:'pointer',textAlign:'left',transition:'all 0.15s',minHeight:'unset',minWidth:'unset'}}
              onMouseEnter={e=>{ if(!item.done){e.currentTarget.style.borderColor=D.rose;e.currentTarget.style.boxShadow='0 2px 8px rgba(192,96,112,0.12)';} }}
              onMouseLeave={e=>{ if(!item.done){e.currentTarget.style.borderColor=D.roseBorder;e.currentTarget.style.boxShadow='none';} }}>
              <div style={{width:22,height:22,borderRadius:'50%',background:item.done?D.rose:D.card,border:`1.5px solid ${item.done?D.rose:D.roseBorder}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11,color:D.card,fontWeight:700}}>
                {item.done ? '✓' : <span style={{fontSize:10,color:D.rose}}>{item.icon}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontSize:12,color:item.done?D.inkLight:D.ink,fontWeight:item.done?400:500,textDecoration:item.done?'line-through':'none',display:'block',fontFamily:D.sans}}>{item.label}</span>
                {!item.done&&<span style={{fontSize:10,color:D.rose,fontFamily:D.sans}}>Start →</span>}
              </div>
            </button>
          ))}
        </div>
        {canDismiss && (
          <div style={{padding:'0 20px 14px',textAlign:'center'}}>
            <button onClick={dismiss} style={{background:'none',border:'none',cursor:'pointer',color:D.inkLight,fontSize:11,textDecoration:'underline',padding:0,fontFamily:D.sans}}>
              Hide checklist
            </button>
          </div>
        )}
      </div>
    </>
  );
};

// ─── AI INSIGHTS PANEL ───────────────────────────────────────────────────────
function buildRuleInsights({ payments, events, inventory, clients, alterations }) {
  const now = new Date();
  const insights = [];

  const overduePmts = (payments || []).filter(p => p.status === 'overdue');
  if (overduePmts.length > 0) {
    const total = overduePmts.reduce((s, p) => s + Number(p.amount), 0);
    insights.push({ severity: 'red', icon: '◈', message: `${overduePmts.length} payment${overduePmts.length !== 1 ? 's' : ''} overdue totaling ${fmt(total)}`, action: 'View payments', screen: 'payments' });
  }

  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const eventsThisWeek = (events || []).filter(e => {
    if (!e.event_date) return false;
    const d = new Date(e.event_date + 'T12:00:00');
    return d >= now && d <= week;
  });
  if (eventsThisWeek.length > 0) {
    insights.push({ severity: 'amber', icon: '◇', message: `${eventsThisWeek.length} event${eventsThisWeek.length !== 1 ? 's' : ''} in the next 7 days`, action: 'Open events', screen: 'events' });
  }

  if (eventsThisWeek.length === 0) {
    const month = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const eventsThisMonth = (events || []).filter(e => {
      if (!e.event_date) return false;
      const d = new Date(e.event_date + 'T12:00:00');
      return d >= now && d <= month;
    });
    if (eventsThisMonth.length > 0) {
      insights.push({ severity: 'blue', icon: '◇', message: `${eventsThisMonth.length} upcoming event${eventsThisMonth.length !== 1 ? 's' : ''} in the next 30 days`, action: 'Open events', screen: 'events' });
    }
  }

  const today = now.toISOString().split('T')[0];
  const overdueReturns = (inventory || []).filter(d =>
    ['rented', 'picked_up'].includes(d.status) && d.return_date && d.return_date < today
  );
  if (overdueReturns.length > 0) {
    insights.push({ severity: 'red', icon: '◉', message: `${overdueReturns.length} dress${overdueReturns.length !== 1 ? 'es' : ''} past their return date`, action: 'View rentals', screen: 'inventory' });
  }

  const lowStock = (inventory || []).filter(i =>
    (i.track === 'consumable' && i.restockPoint > 0 && i.currentStock <= i.restockPoint) ||
    (i.minStock > 0 && (i.availQty||i.currentStock||0) <= i.minStock)
  );
  if (lowStock.length > 0) {
    insights.push({ severity: 'amber', icon: '◎', message: `${lowStock.length} consumable item${lowStock.length !== 1 ? 's' : ''} at or below restock level`, action: 'View inventory', screen: 'inventory' });
  }

  const loyalClients = (clients || []).filter(c => (c.loyalty_points || 0) >= 500);
  if (loyalClients.length > 0) {
    insights.push({ severity: 'purple', icon: '◆', message: `${loyalClients.length} VIP client${loyalClients.length !== 1 ? 's' : ''} with 500+ loyalty points`, action: 'View clients', screen: 'clients' });
  }

  if (overduePmts.length === 0 && (payments || []).length > 0) {
    insights.push({ severity: 'green', icon: '✦', message: 'All payments are on track — no overdue milestones', action: null, screen: null });
  }

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
    insights.push({ severity: 'amber', icon: '◐', message: `${missingAppts.length} upcoming event${missingAppts.length!==1?'s':''} missing fitting appointments`, action: 'View events', screen: 'events' });
  }

  const noMilestones = (events || []).filter(e =>
    e.status === 'active' && e.event_date && new Date(e.event_date + 'T12:00:00') > now &&
    (!e.milestones || e.milestones.length === 0) && Number(e.total || 0) > 0
  );
  if (noMilestones.length > 0) {
    insights.push({ severity: 'blue', icon: '◑', message: `${noMilestones.length} event${noMilestones.length!==1?'s':''} with no payment milestones set up`, action: 'View events', screen: 'events' });
  }

  const overdueAlts = (alterations || []).filter(a =>
    !['complete','cancelled'].includes(a.status) && a.deadline && a.deadline < today
  );
  if (overdueAlts.length > 0) {
    insights.push({ severity: 'red', icon: '✂', message: `${overdueAlts.length} alteration${overdueAlts.length!==1?'s':''} past deadline`, action: 'View alterations', screen: 'alterations' });
  }

  const order = { red: 0, amber: 1, blue: 2, purple: 3, green: 4 };
  insights.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return insights.slice(0, 5);
}

const INSIGHT_COLORS = {
  red:    { border: '#C0606E', bg: '#FFF0F2', text: '#9B3040', pill: '#FCE4E8' },
  amber:  { border: '#C08040', bg: '#FFF8EE', text: '#8A5820', pill: '#FDECD8' },
  blue:   { border: '#4070B0', bg: '#F0F4FC', text: '#2A4E88', pill: '#DCE8F8' },
  green:  { border: '#507050', bg: '#F0F8F0', text: '#306030', pill: '#D8EDD8' },
  purple: { border: '#7060B0', bg: '#F4F0FC', text: '#4A3488', pill: '#E4DCF8' },
};

const AIInsightsPanel = ({ payments, events, inventory, clients, alterations, setScreen }) => {
  const insights = buildRuleInsights({ payments, events, inventory, clients, alterations });
  if (insights.length === 0) return null;

  return (
    <div className="dash-card">
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="dash-serif" style={{ fontSize: 16, color: D.ink, fontStyle: 'italic' }}>Smart Alerts</div>
        <span style={{ fontSize: 10, color: D.inkLight, background: D.bg, border: `1px solid ${D.border}`, borderRadius: 20, padding: '3px 9px', fontFamily: D.sans, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {insights.length} insight{insights.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div>
        {insights.map((ins, i) => {
          const s = INSIGHT_COLORS[ins.severity] || INSIGHT_COLORS.blue;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
              borderLeft: `3px solid ${s.border}`,
              borderBottom: i < insights.length - 1 ? `1px solid ${D.border}` : 'none',
              background: i % 2 === 0 ? D.card : D.bg,
            }}>
              <span style={{ fontSize: 14, color: s.text, flexShrink: 0, width: 18, textAlign: 'center' }}>{ins.icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: D.inkMid, fontFamily: D.sans, lineHeight: 1.4 }}>{ins.message}</span>
              {ins.action && ins.screen && (
                <button onClick={() => setScreen(ins.screen)} style={{
                  fontSize: 11, fontWeight: 500, color: s.text,
                  background: s.pill, border: `1px solid ${s.border}40`,
                  borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
                  whiteSpace: 'nowrap', minHeight: 'unset', minWidth: 'unset',
                  fontFamily: D.sans, transition: 'all 0.15s',
                }} onMouseEnter={e=>e.currentTarget.style.background=s.bg} onMouseLeave={e=>e.currentTarget.style.background=s.pill}>
                  {ins.action} →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
    <div className="dash-card">
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div className="dash-serif" style={{ fontSize: 16, color: D.ink, fontStyle: 'italic' }}>Revenue</div>
        <div style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans }}>collected & forecast</div>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: D.goldLight, borderRadius: 12, padding: '14px 16px', border: `1px solid ${D.goldBorder}` }}>
            <div style={{ fontSize: 10, color: D.gold, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: D.sans }}>This month</div>
            <div className="dash-stat-num" style={{ fontSize: 26, color: D.ink }}>{fmt(thisMonth)}</div>
            {trend !== null && <div style={{ fontSize: 11, color: trendUp ? '#507050' : '#904040', marginTop: 4, fontFamily: D.sans }}>
              {trendUp ? '▲' : '▼'} {Math.abs(Math.round(trend))}% vs last month
            </div>}
          </div>
          <div style={{ background: D.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${D.border}` }}>
            <div style={{ fontSize: 10, color: D.inkLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: D.sans }}>Last month</div>
            <div className="dash-stat-num" style={{ fontSize: 26, color: D.inkMid }}>{fmt(lastMonth)}</div>
          </div>
        </div>
        {(next30+next60+next90) > 0 && (
          <div>
            <div style={{ fontSize: 10, color: D.inkLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: D.sans }}>Expected pipeline</div>
            {[
              {label:'Next 30 days', amt:next30, color:D.rose},
              {label:'31–60 days',   amt:next60, color:D.gold},
              {label:'61–90 days',   amt:next90, color:D.inkLight},
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: D.inkLight, width: 88, flexShrink: 0, fontFamily: D.sans }}>{row.label}</div>
                <div style={{ flex: 1, height: 4, background: D.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: row.color, borderRadius: 2, opacity: 0.7, width: row.amt > 0 ? `${Math.min(100, Math.round((row.amt/(next30+next60+next90))*100))}%` : '0%', transition: 'width 0.5s ease' }}/>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: D.inkMid, width: 70, textAlign: 'right', flexShrink: 0, fontFamily: D.sans }}>{fmt(row.amt)}</div>
              </div>
            ))}
          </div>
        )}
        {(next30+next60+next90) === 0 && pmt.length > 0 && (
          <div style={{ fontSize: 12, color: D.inkLight, textAlign: 'center', padding: '6px 0', fontFamily: D.sans }}>No upcoming milestones due in the next 90 days</div>
        )}
      </div>
    </div>
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
  monthAppts.forEach(a => { counts[a.staff_id] = (counts[a.staff_id] || 0) + 1; });

  const staffWithCounts = (staff || [])
    .map(s => ({ ...s, count: counts[s.id] || 0 }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!staffWithCounts.length) return null;
  const maxCount = staffWithCounts[0].count;

  return (
    <div className="dash-card">
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div className="dash-serif" style={{ fontSize: 16, color: D.ink, fontStyle: 'italic' }}>Staff This Month</div>
        <div style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans }}>{monthAppts.length} appointment{monthAppts.length!==1?'s':''}</div>
      </div>
      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {staffWithCounts.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar initials={s.initials||s.name?.split(' ').map(w=>w[0]).join('').slice(0,2)||'?'} size={28} bg={s.color||D.rose} color="#fff"/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: D.ink, fontFamily: D.sans }}>{s.name}</span>
                <span style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans }}>{s.count} appt{s.count!==1?'s':''}</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: D.border, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: D.rose, opacity: 0.7, width: `${Math.round((s.count/maxCount)*100)}%`, transition: 'width 0.5s ease' }}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
    <div className="dash-card">
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div className="dash-serif" style={{ fontSize: 16, color: D.ink, fontStyle: 'italic' }}>Today's Recap</div>
        <div style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
      </div>
      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {totalAppts > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: doneAppts === totalAppts ? '#F0F8F0' : D.bg, borderRadius: 10, border: `1px solid ${doneAppts === totalAppts ? '#B0D8B0' : D.border}` }}>
            <span style={{ fontSize: 13, color: D.inkMid, fontFamily: D.sans }}>Appointments</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: doneAppts === totalAppts ? '#507050' : D.ink, fontFamily: D.sans }}>{doneAppts}/{totalAppts} done</span>
          </div>
        )}
        {paidToday.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: D.goldLight, borderRadius: 10, border: `1px solid ${D.goldBorder}` }}>
            <span style={{ fontSize: 13, color: D.inkMid, fontFamily: D.sans }}>Payments collected</span>
            <span className="dash-serif" style={{ fontSize: 16, color: D.gold }}>{fmt(revenueToday)}</span>
          </div>
        )}
        {eventsToday > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: D.roseLight, borderRadius: 10, border: `1px solid ${D.roseBorder}` }}>
            <span style={{ fontSize: 13, color: D.inkMid, fontFamily: D.sans }}>Events today</span>
            <span className="dash-serif" style={{ fontSize: 16, color: D.rose }}>{eventsToday}</span>
          </div>
        )}
        {doneAppts === 0 && paidToday.length === 0 && eventsToday === 0 && totalAppts > 0 && (
          <div style={{ fontSize: 12, color: D.inkLight, textAlign: 'center', padding: '8px 0', fontFamily: D.sans }}>No completed items yet today</div>
        )}
      </div>
    </div>
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

    supabase.from('inventory')
      .select('id, name, return_date, client_id')
      .eq('boutique_id', boutique.id)
      .eq('status', 'out')
      .lte('return_date', tomorrow)
      .then(({ data }) => setDueReturns(data || []));

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
    <div className="dash-root" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, background: D.bg }}>
      <DashFonts />
      <Topbar
        title={<span style={{ fontFamily: D.serif, fontStyle: 'italic', fontWeight: 400 }}>⚡ Focus <span style={{ fontSize: 12, fontWeight: 400, color: D.inkLight, fontFamily: D.sans, fontStyle: 'normal', marginLeft: 6 }}>{dateLabel}</span></span>}
        actions={<GhostBtn label="Exit Focus" onClick={onToggleFocus} />}
      />

      <div className="page-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: '+ New Rental',     col: D.rose,    bg: D.roseLight, event: 'belori:new-rental',     screen: 'inventory' },
            { label: '+ New Event',      col: D.gold,    bg: D.goldLight, event: 'belori:new-event',       screen: 'events' },
            { label: '+ New Alteration', col: '#3A7A6A', bg: '#F0FBF8',   event: 'belori:new-alteration', screen: 'alterations' },
          ].map((a, i) => (
            <button key={i}
              onClick={() => { setScreen(a.screen); setTimeout(() => window.dispatchEvent(new CustomEvent(a.event)), 80); }}
              style={{ flex: 1, padding: '11px 10px', borderRadius: 10, border: `1.5px solid ${a.col}30`, background: a.bg, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: a.col, transition: 'all 0.15s', fontFamily: D.sans }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >{a.label}</button>
          ))}
          <button onClick={() => setScreen('clients')}
            style={{ flex: 1, padding: '11px 10px', borderRadius: 10, border: `1.5px solid ${D.border}`, background: D.card, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: D.inkMid, transition: 'all 0.15s', fontFamily: D.sans }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = D.rose; e.currentTarget.style.color = D.rose; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.inkMid; }}
          >Look up client</button>
        </div>

        <div className="dash-card">
          <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="dash-serif" style={{ fontSize: 15, color: D.ink, fontStyle: 'italic' }}>Today's Appointments ({todayAppts.length})</div>
            <button onClick={() => setShowAppt(true)} style={{ fontSize: 12, color: D.rose, fontFamily: D.sans, background: D.roseLight, border: `1px solid ${D.roseBorder}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontWeight: 500 }}>+ New</button>
          </div>
          {todayAppts.length === 0 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: D.inkLight, fontSize: 13, fontFamily: D.sans }}>No appointments today — enjoy the calm ✦</div>
          ) : todayAppts.map((a, i) => {
            const timeStr = a.time ? a.time.slice(0, 5) : '';
            const cfg = APPT_TYPE_CFG[a.type] || APPT_TYPE_CFG.other;
            const ev = events?.find(e => e.id === a.event_id);
            const isDone = a.status === 'completed';
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < todayAppts.length - 1 ? `1px solid ${D.border}` : 'none', cursor: ev ? 'pointer' : 'default', opacity: isDone ? 0.55 : 1, transition: 'background 0.15s' }}
                onClick={() => ev && (setSelectedEvent(ev.id), setScreen('event_detail'))}
                onMouseEnter={e => ev && (e.currentTarget.style.background = D.bg)}
                onMouseLeave={e => ev && (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ minWidth: 44, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: D.ink, fontFamily: D.sans }}>{timeStr}</div>
                </div>
                <Avatar initials={ev?.client?.slice(0, 2)?.toUpperCase() || '?'} size={32} bg={cfg.col} color={cfg.textCol} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: D.ink, textDecoration: isDone ? 'line-through' : 'none', fontFamily: D.sans }}>{ev?.client || 'Client'}</div>
                  <div style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans }}>{APPT_TYPE_LABELS[a.type] || 'Appointment'}{a.note ? ` · ${a.note}` : ''}</div>
                </div>
                {isDone
                  ? <span style={{ fontSize: 10, fontWeight: 600, color: '#507050', background: '#F0F8F0', padding: '3px 8px', borderRadius: 20, fontFamily: D.sans, border: '1px solid #B0D8B0' }}>Done</span>
                  : <Badge text={cfg.tag} bg={cfg.tagBg} color={cfg.tagCol} />
                }
              </div>
            );
          })}
        </div>

        {dueReturns.length > 0 && (
          <div className="dash-card">
            <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="dash-serif" style={{ fontSize: 15, color: D.ink, fontStyle: 'italic' }}>Dress Returns Due ({dueReturns.length})</div>
              <button onClick={() => setScreen('inventory')} style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans, background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {dueReturns.map((item, i) => {
              const isToday   = item.return_date === today;
              const isTomorrow = item.return_date === tomorrow;
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < dueReturns.length - 1 ? `1px solid ${D.border}` : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isToday ? '#C04040' : D.gold, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: D.ink, fontFamily: D.sans }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: isToday ? '#C04040' : D.gold, fontWeight: 500, fontFamily: D.sans }}>
                      {isToday ? 'Due TODAY' : isTomorrow ? 'Due tomorrow' : `Due ${item.return_date}`}
                    </div>
                  </div>
                  <button onClick={() => setScreen('inventory')} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: `1px solid ${D.border}`, background: D.card, cursor: 'pointer', color: D.inkMid, fontFamily: D.sans }}>
                    Mark returned
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {dueAlts.length > 0 && (
          <div className="dash-card">
            <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="dash-serif" style={{ fontSize: 15, color: D.ink, fontStyle: 'italic' }}>Alterations Due ({dueAlts.length})</div>
              <button onClick={() => setScreen('alterations')} style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans, background: 'none', border: 'none', cursor: 'pointer' }}>View board →</button>
            </div>
            {dueAlts.map((job, i) => {
              const isToday   = job.deadline === today;
              const isTomorrow = job.deadline === tomorrow;
              const clientName = job.clients?.name || 'Client';
              const STATUS_LABEL = { pending: 'Pending', in_progress: 'In progress', fitting: 'Fitting', ready: 'Ready' };
              const statusColors = { pending: D.inkLight, in_progress: D.gold, fitting: D.rose, ready: '#507050' };
              return (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < dueAlts.length - 1 ? `1px solid ${D.border}` : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onClick={() => setScreen('alterations')}
                  onMouseEnter={e => e.currentTarget.style.background = D.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isToday ? '#C04040' : D.gold, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: D.ink, fontFamily: D.sans }}>{clientName} — {job.garment}</div>
                    <div style={{ fontSize: 11, color: isToday ? '#C04040' : D.gold, fontWeight: 500, fontFamily: D.sans }}>
                      {isToday ? 'Deadline TODAY' : isTomorrow ? 'Due tomorrow' : `Due ${job.deadline}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 500, color: statusColors[job.status] || D.inkLight, background: D.bg, padding: '3px 9px', borderRadius: 20, fontFamily: D.sans, border: `1px solid ${D.border}` }}>
                    {STATUS_LABEL[job.status] || job.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {dueReturns.length === 0 && dueAlts.length === 0 && todayAppts.length === 0 && (
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, padding: '36px 20px', textAlign: 'center' }}>
            <div className="dash-serif" style={{ fontSize: 28, color: D.gold, marginBottom: 10, fontStyle: 'italic' }}>✦</div>
            <div className="dash-serif" style={{ fontSize: 18, color: D.ink, marginBottom: 6, fontStyle: 'italic' }}>All clear for today</div>
            <div style={{ fontSize: 13, color: D.inkLight, fontFamily: D.sans }}>No appointments, returns, or urgent alterations.</div>
          </div>
        )}

        <EndOfDaySummary payments={payments} events={events} appointments={todayAppts} />
      </div>

      {showAppt && <StandaloneAppointmentModal events={events || []} staff={staff || []} onClose={() => setShowAppt(false)} onSaved={() => { reloadAppts(); setShowAppt(false); }} />}
    </div>
  );
};

// ─── DASHBOARD FULL ───────────────────────────────────────────────────────────
const DashboardFull = ({setScreen,setSelectedEvent,events,payments,inventory,boutique,clients,staff,alterations}) => {
  const { boutique: authBoutique } = useAuth();
  const { appointments: todayAppts, reload: reloadAppts } = useAppointmentsToday();
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [showStandaloneAppt, setShowStandaloneAppt] = useState(false);
  const [showMarkAllComplete, setShowMarkAllComplete] = useState(false);
  const [churnCount, setChurnCount] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState(null);
  const toast = useToast();

  const [autoProgressDone, setAutoProgressDone] = useState(false);
  useEffect(() => {
    if (!authBoutique?.id || !events?.length || autoProgressDone) return;
    setAutoProgressDone(true);
    autoProgressEvents(events, authBoutique.id, supabase).then(count => {
      if (count > 0) toast(`${count} event${count !== 1 ? 's' : ''} marked completed automatically`);
    }).catch(e => console.error('[Belori] Auto-progress failed:', e));
  }, [authBoutique?.id, events?.length, autoProgressDone]);

  const overdueTotal = payments.filter(p=>p.status==='overdue').reduce((s,p)=>s+p.amount,0);
  const rentedCount = inventory.filter(d=>['rented','reserved','picked_up'].includes(d.status)).length;
  const totalCount = inventory.length;
  const alert = getPriorityAlert(events);
  const { isTablet } = useLayoutMode();

  const now = new Date();
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

  const { revenueThisMonth, revenueLastMonth, revPct } = useMemo(() => {
    if (!events.length) return { revenueThisMonth: null, revenueLastMonth: null, revPct: null };
    const allMilestones = events.flatMap(e => e.milestones || []);
    const thisMonth = allMilestones.filter(m => m.status === 'paid' && m.paid_date && m.paid_date >= monthStart).reduce((s, m) => s + Number(m.amount), 0);
    const lastMonth = allMilestones.filter(m => m.status === 'paid' && m.paid_date && m.paid_date >= lastMonthStart && m.paid_date <= lastMonthEnd).reduce((s, m) => s + Number(m.amount), 0);
    const pct = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
    return { revenueThisMonth: thisMonth, revenueLastMonth: lastMonth, revPct: pct };
  }, [events, monthStart, lastMonthStart, lastMonthEnd]);

  useEffect(() => {
    if (!authBoutique) return;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    supabase.from('clients').select('id', { count: 'exact', head: true })
      .eq('boutique_id', authBoutique.id)
      .lt('last_contacted_at', ninetyDaysAgo)
      .not('last_contacted_at', 'is', null)
      .then(({ count }) => setChurnCount(count || 0));
  }, [authBoutique?.id]);

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

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const ownerMember = staff?.find(s => s.role === 'owner') || staff?.[0];
  const ownerFirst = ownerMember?.name?.split(' ')[0] || boutique?.name?.split(' ')[0] || '';

  const todayLabel = now.toLocaleDateString('en-US', {weekday:'long',month:'long',day:'numeric'});
  const apptCount = todayAppts?.length ?? 0;
  const apptLabel = apptCount === 0 ? 'No appointments today' : `${apptCount} appointment${apptCount !== 1 ? 's' : ''} today`;

  const mappedAppts = (todayAppts || []).map(a => {
    const cfg = APPT_TYPE_CFG[a.type] || APPT_TYPE_CFG.other;
    const clientName = a.event?.client?.name || a.client_name || '';
    const parts = clientName.split(' ');
    const init = (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
    const evType = EVT_TYPES[a.event?.type]?.label || '';
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
    {label:'New rental',     sub:'Reserve a dress',  icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3c-2 0-4 1.5-5.5 4L4 12v8h16v-8l-2.5-5C16 4.5 14 3 12 3z"/><path d="M9 12c0-1.7 1.3-3 3-3s3 1.3 3 3"/></svg>,bg:D.roseLight,col:D.rose,onClick:()=>setScreen('inventory')},
    {label:'Log return',     sub:'Check a dress in', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>,bg:'#F0FBF8',col:'#3A7A6A',onClick:()=>setScreen('inventory')},
    {label:'New event',      sub:'Book a client',    icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M12 14v4M10 16h4"/></svg>,bg:D.goldLight,col:D.gold,onClick:()=>goWithHint('events','new_event')},
    {label:'Add alteration', sub:'Start a job',      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3l2 6-4 3 4 3-2 6 6-4 6 4-2-6 4-3-4-3 2-6-6 4z"/></svg>,bg:'#F0F4FC',col:'#4070B0',onClick:()=>goWithHint('alterations','new_alteration')},
    {label:'Payments',       sub:'View overdue',     icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,bg:'#FFF8EE',col:'#C08040',onClick:()=>setScreen('payments')},
    {label:'New client',     sub:'Add a contact',    icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="7" r="4"/><path d="M2 21v-1a8 8 0 0 1 12.95-6.3M19 15v6M22 18h-6"/></svg>,bg:'#F0F8F0',col:'#507050',onClick:()=>goWithHint('clients','new_client')},
  ];

  const today7 = new Date(); today7.setDate(today7.getDate()+7);
  const returnsDue = inventory.filter(d => ['rented','picked_up'].includes(d.status) && d.return_date && new Date(d.return_date+'T12:00:00') <= today7);

  const fmtCurrency = (amount) => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(amount);

  const STATS = [
    {
      label: 'Revenue this month', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
      val: revenueThisMonth !== null ? fmt(revenueThisMonth) : '—',
      sub: revenueThisMonth !== null ? (revPct !== null ? `${revPct >= 0 ? '▲' : '▼'} ${Math.abs(revPct)}% vs last month` : now.toLocaleString('default',{month:'long'})) : 'Loading…',
      subColor: revPct !== null ? (revPct >= 0 ? '#507050' : '#904040') : '#507050',
      accentColor: D.gold, accentBg: D.goldLight, onClick: () => setScreen('payments'), delay: 0,
    },
    {
      label: 'Active events', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
      val: `${events.length}`,
      sub: `${events.filter(e=>e.type==='wedding').length} weddings · ${events.filter(e=>e.type==='quince').length} quinces`,
      subColor: D.inkLight, accentColor: '#4070B0', accentBg: '#F0F4FC', onClick: () => setScreen('events'), delay: 60,
    },
    {
      label: 'Dresses rented', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3c-2 0-4 1.5-5.5 4L4 12v8h16v-8l-2.5-5C16 4.5 14 3 12 3z"/></svg>,
      val: `${rentedCount}/${totalCount}`,
      sub: returnsDue.length>0 ? `${returnsDue.length} due back soon` : 'No returns due soon',
      subColor: returnsDue.length>0 ? '#C08040' : D.inkLight,
      accentColor: D.rose, accentBg: D.roseLight, onClick: () => setScreen('inventory'), delay: 120,
    },
    {
      label: 'Payments overdue', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
      val: fmt(overdueTotal),
      sub: `${payments.filter(p=>p.status==='overdue').length} clients · action needed`,
      subColor: '#904040', accentColor: '#C04040', accentBg: '#FFF0F0', onClick: () => setScreen('payments'), delay: 180,
    },
    {
      label: "This week's revenue", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>,
      val: weeklyRevenue !== null ? fmtCurrency(weeklyRevenue) : '—',
      sub: 'Last 7 days collected',
      subColor: '#507050', accentColor: '#507050', accentBg: '#F0F8F0', onClick: () => setScreen('payments'), delay: 240,
    },
  ];

  const topbarTitle = ownerFirst
    ? <span style={{fontFamily:D.serif,fontStyle:'italic',fontWeight:400}}>{greeting}, <span style={{fontWeight:600}}>{ownerFirst}</span></span>
    : <span style={{fontFamily:D.serif,fontStyle:'italic',fontWeight:400}}>{greeting}</span>;

  return (
    <div className="dash-root" data-testid="dashboard-root" style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0, background: D.bg }}>
      <DashFonts />
      <Topbar
        title={topbarTitle}
        subtitle={`${todayLabel} · ${apptLabel}`}
        actions={<>
          <GhostBtn label="🖥️ Kiosk" className="topbar-hide" onClick={()=>{ const id=boutique?.id; window.open(`/kiosk${id?`?boutique=${id}`:''}`, '_blank'); }}/>
          <GhostBtn label="View packages" className="topbar-hide" onClick={()=>goWithHint('settings','tab_packages')}/>
          <GhostBtn label="+ Appointment" className="topbar-hide" onClick={()=>setShowStandaloneAppt(true)}/>
          <PrimaryBtn label="+ New client" colorScheme="success" onClick={()=>goWithHint('clients','new_client')}/>
        </>}
      />

      {alert && <AlertBanner
        msg={<>
          <strong>{alert.event.client}'s {alert.event.type === 'wedding' ? 'wedding' : 'quinceañera'} is in {alert.event.daysUntil} days</strong>
          {alert.event.overdue > 0 && ` — $${alert.event.overdue.toLocaleString()} deposit overdue`}
          {alert.event.missingAppointments?.length > 0 && ` — ${alert.event.missingAppointments[0].type.replace(/_/g,' ')} not scheduled`}
        </>}
        action="Act now"
        onAction={()=>{setSelectedEvent(alert.event.id);setScreen('event_detail');}}
      />}

      <div className="page-scroll" style={{flex:1,minHeight:0,overflowY:'auto',padding:isTablet?16:24,display:'flex',flexDirection:'column',gap:isTablet?12:18,maxWidth:1200,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>

        <DailyBriefingBanner appointments={todayAppts} payments={payments} events={events}/>
        <OnboardingChecklist events={events} clients={clients} staff={staff} inventory={inventory} payments={payments} appointments={todayAppts} setScreen={setScreen}/>

        {/* Churn alert */}
        {churnCount > 0 && (
          <div style={{ background: '#FFF8EE', border: `1px solid ${D.goldBorder}`, borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#8A5820', fontFamily: D.sans }}>◆ {churnCount} clients need re-engagement</div>
              <div style={{ fontSize: 11, color: '#B08040', marginTop: 2, fontFamily: D.sans }}>Last contact was 90+ days ago with no upcoming events</div>
            </div>
            <button onClick={() => setScreen('reports')} style={{ padding: '6px 14px', background: D.gold, color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: D.sans }}>
              View →
            </button>
          </div>
        )}

        {/* Stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isTablet ? 'repeat(2,1fr)' : 'repeat(auto-fit,minmax(180px,1fr))', gap: isTablet ? 10 : 12 }}>
          {STATS.map((s, i) => (
            isTablet ? (
              <div key={i} onClick={s.onClick} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: s.onClick?'pointer':'default', boxShadow: D.shadow, transition: 'all 0.2s' }}
                onMouseEnter={e => { if(s.onClick){e.currentTarget.style.borderColor=D.roseBorder;e.currentTarget.style.boxShadow=D.shadowMd;} }}
                onMouseLeave={e => { if(s.onClick){e.currentTarget.style.borderColor=D.border;e.currentTarget.style.boxShadow=D.shadow;} }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: s.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.accentColor, flexShrink: 0 }}>{s.icon}</div>
                <div>
                  <div className="dash-stat-num" style={{ fontSize: 22, color: D.ink }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: D.inkLight, fontFamily: D.sans, marginTop: 1 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: s.subColor, fontFamily: D.sans, marginTop: 1 }}>{s.sub}</div>
                </div>
              </div>
            ) : (
              <StatCard key={i} {...s} />
            )
          ))}
        </div>

        {/* Quick actions */}
        {isTablet ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {QUICK_ACTIONS.map((a, i) => (
              <button key={i} onClick={a.onClick} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '13px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, cursor: 'pointer', transition: 'all 0.15s', minHeight: 'unset', minWidth: 'unset', boxShadow: D.shadow }}
                onTouchStart={e => { e.currentTarget.style.borderColor = a.col; e.currentTarget.style.background = a.bg; e.currentTarget.style.transform = 'scale(0.96)'; }}
                onTouchEnd={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.background = D.card; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.col }}>{a.icon}</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: D.ink, lineHeight: 1.2, fontFamily: D.sans }}>{a.label}</div>
                  <div style={{ fontSize: 10, color: D.inkLight, marginTop: 2, lineHeight: 1.2, fontFamily: D.sans }}>{a.sub}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {QUICK_ACTIONS.map((a, i) => (
              <button key={i} onClick={a.onClick} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20, border: `1px solid ${D.border}`, background: D.card, cursor: 'pointer', fontSize: 12, color: D.inkMid, whiteSpace: 'nowrap', minHeight: 'unset', minWidth: 'unset', transition: 'all 0.15s', fontFamily: D.sans }}
                onMouseEnter={e => { e.currentTarget.style.background = a.bg; e.currentTarget.style.borderColor = a.col; e.currentTarget.style.color = a.col; }}
                onMouseLeave={e => { e.currentTarget.style.background = D.card; e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.inkMid; }}
              >
                <span style={{ color: a.col, opacity: 0.7 }}>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* AI Insights */}
        <AIInsightsPanel payments={payments} events={events} inventory={inventory} clients={clients} alterations={alterations} setScreen={setScreen}/>

        {/* Recently Viewed */}
        <RecentlyViewedCard setScreen={setScreen} setSelectedEvent={setSelectedEvent}/>

        {/* Revenue + Staff side-by-side on desktop */}
        <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr', gap: 14 }}>
          <RevenueForecastPanel payments={payments}/>
          <StaffUtilizationCard events={events} staff={staff}/>
        </div>

        {/* Main content grid */}
        <div className="dash-layout" style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 320px', gap: 18 }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Today's appointments */}
            <div className="dash-card">
              <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="dash-serif" style={{ fontSize: 17, color: D.ink, fontStyle: 'italic' }}>Today's Appointments</div>
                <button onClick={() => setShowStandaloneAppt(true)} style={{ fontSize: 12, color: D.rose, fontFamily: D.sans, background: D.roseLight, border: `1px solid ${D.roseBorder}`, borderRadius: 20, padding: '5px 13px', cursor: 'pointer', fontWeight: 500 }}>+ New</button>
              </div>

              {/* Horizontal scroll appointment cards */}
              {todayAppts.length > 0 && (() => {
                const APPT_COLORS = {
                  consultation: { color: D.rose,    bg: D.roseLight,  icon: '◈' },
                  fitting:      { color: '#7060B0', bg: '#F4F0FC',    icon: '◐' },
                  pickup:       { color: '#3A7A6A', bg: '#F0FBF8',    icon: '◉' },
                  return:       { color: D.gold,    bg: D.goldLight,  icon: '◑' },
                  measurement:  { color: '#4070B0', bg: '#F0F4FC',    icon: '◎' },
                  follow_up:    { color: '#7060B0', bg: '#F4F0FC',    icon: '◇' },
                  other:        { color: D.inkMid,  bg: D.bg,         icon: '◆' },
                };
                return (
                  <div style={{ padding: '12px 20px 6px' }}>
                    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
                      {todayAppts.map(appt => {
                        const cfg = APPT_COLORS[appt.type] || APPT_COLORS.other;
                        const apptClientName = appt.event?.client?.name || appt.client_name || 'Client';
                        return (
                          <div key={appt.id} style={{
                            flexShrink: 0, minWidth: 130, borderRadius: 12, padding: '12px 14px',
                            background: cfg.bg, border: `1px solid ${cfg.color}25`,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.color + '60'; e.currentTarget.style.boxShadow = D.shadowMd; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = cfg.color + '25'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <div style={{ fontSize: 16, color: cfg.color, marginBottom: 6 }}>{cfg.icon}</div>
                            <div className="dash-serif" style={{ fontSize: 15, color: cfg.color, fontStyle: 'italic' }}>
                              {appt.time ? appt.time.slice(0, 5) : '—'}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: D.ink, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: D.sans }}>
                              {apptClientName}
                            </div>
                            <div style={{ fontSize: 10, color: D.inkLight, marginTop: 2, fontFamily: D.sans }}>
                              {appt.type?.replace(/_/g, ' ')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Timeline list */}
              <div style={{ position: 'relative' }}>
                {displayAppts.length === 0
                  ? <div style={{ padding: '24px 20px', textAlign: 'center', color: D.inkLight, fontSize: 13, fontFamily: D.sans }}>No appointments scheduled for today</div>
                  : displayAppts.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < displayAppts.length - 1 ? `1px solid ${D.border}` : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = D.bg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 12, color: D.inkLight, minWidth: 38, flexShrink: 0, fontFamily: D.sans }}>{a.time}</span>
                    <Avatar initials={a.init} size={28} bg={a.col} color={a.textCol}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: D.ink, fontFamily: D.sans }}>{a.client}</div>
                      <div style={{ fontSize: 11, color: D.inkLight, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: D.sans }}>{a.service}</div>
                    </div>
                    <Badge text={a.tag} bg={a.tagBg} color={a.tagCol}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming events — editorial style */}
            <div className="dash-card">
              <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="dash-serif" style={{ fontSize: 17, color: D.ink, fontStyle: 'italic' }}>Upcoming Events</div>
                <button onClick={() => setScreen('events')} style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans, background: 'none', border: 'none', cursor: 'pointer' }}>Full calendar →</button>
              </div>
              {events.slice(0, 5).map((ev, i) => {
                const [mon, day] = (ev.date || '').split(' ');
                return (
                  <div key={ev.id} onClick={() => { setSelectedEvent(ev.id); setScreen('event_detail'); }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 20px', borderBottom: i < Math.min(events.length, 5) - 1 ? `1px solid ${D.border}` : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = D.bg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Editorial date block */}
                    <div style={{ minWidth: 44, textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: D.rose, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: D.sans }}>{mon}</div>
                      <div className="dash-serif" style={{ fontSize: 28, color: D.ink, lineHeight: 1, marginTop: 1 }}>{day}</div>
                    </div>
                    {/* Thin separator */}
                    <div style={{ width: 1, background: D.border, alignSelf: 'stretch', flexShrink: 0, marginTop: 2 }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: D.ink, fontFamily: D.sans }}>{ev.client}</div>
                      <div style={{ fontSize: 11, color: D.inkMid, marginTop: 2, fontFamily: D.sans }}>{EVT_TYPES[ev.type]?.label || ev.type} · {ev.venue}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {ev.services.map(s => <SvcTag key={s} svc={s}/>)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="dash-serif" style={{ fontSize: 16, color: D.ink }}>{fmt(ev.total)}</div>
                      {ev.overdue > 0
                        ? <div style={{ fontSize: 11, color: '#904040', marginTop: 2, fontFamily: D.sans }}>{fmt(ev.overdue)} overdue</div>
                        : <div style={{ fontSize: 11, color: '#507050', marginTop: 2, fontFamily: D.sans }}>{fmt(ev.paid)} paid</div>
                      }
                      <Countdown days={ev.daysUntil}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Payments due */}
            <div className="dash-card">
              <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${D.border}` }}>
                <div className="dash-serif" style={{ fontSize: 15, color: D.ink, fontStyle: 'italic' }}>Payments Due</div>
              </div>
              {payments.filter(p => p.status !== 'paid').slice(0, 4).map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 20px', borderBottom: i < 3 ? `1px solid ${D.border}` : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = D.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.status === 'overdue' ? '#C04040' : D.gold, flexShrink: 0, marginTop: 5 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: D.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: D.sans }}>{p.client} — {p.label}</div>
                    <div style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans }}>{p.status === 'overdue' ? `${p.daysLate} days overdue` : `Due ${p.due}`}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="dash-serif" style={{ fontSize: 14, color: p.status === 'overdue' ? '#C04040' : D.ink }}>{fmt(p.amount)}</div>
                    {p.status === 'overdue' && <div onClick={() => setScreen('payments')} style={{ fontSize: 10, color: D.rose, cursor: 'pointer', fontWeight: 500, fontFamily: D.sans }}>Remind →</div>}
                  </div>
                </div>
              ))}
              {payments.filter(p => p.status !== 'paid').length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: D.inkLight, fontFamily: D.sans }}>All payments up to date ✦</div>
              )}
            </div>

            {/* Returns due */}
            {returnsDue.length > 0 && (
              <div className="dash-card">
                <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="dash-serif" style={{ fontSize: 15, color: D.ink, fontStyle: 'italic' }}>Returns Due</div>
                  <button onClick={() => setScreen('inventory')} style={{ fontSize: 10, color: D.inkLight, background: 'none', border: 'none', cursor: 'pointer', fontFamily: D.sans }}>View all →</button>
                </div>
                {returnsDue.slice(0, 4).map((d, i) => {
                  const isToday = d.return_date === now.toISOString().split('T')[0];
                  const dueDate = d.return_date ? new Date(d.return_date+'T12:00:00').toLocaleDateString('en-US', {month:'short',day:'numeric'}) : '—';
                  return (
                    <div key={d.id||i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: i < Math.min(returnsDue.length,4)-1 ? `1px solid ${D.border}` : 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: isToday ? '#C04040' : D.gold, flexShrink: 0 }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: D.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: D.sans }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans }}>{d.clientName || '—'}</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: isToday ? '#C04040' : D.gold, whiteSpace: 'nowrap', fontFamily: D.sans }}>{isToday ? 'Today' : dueDate}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upcoming birthdays */}
            {(()=>{
              const today = new Date();
              const upcoming = (clients||[]).filter(cl => {
                if (!cl.birthday) return false;
                const bday = new Date(cl.birthday+'T12:00:00');
                const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
                const nextYear = new Date(today.getFullYear()+1, bday.getMonth(), bday.getDate());
                const target = thisYear >= today ? thisYear : nextYear;
                const diff = Math.round((target - today)/(1000*60*60*24));
                return diff >= 0 && diff <= 14;
              }).map(cl => {
                const bday = new Date(cl.birthday+'T12:00:00');
                const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
                const target = thisYear >= today ? thisYear : new Date(today.getFullYear()+1, bday.getMonth(), bday.getDate());
                const diff = Math.round((target - today)/(1000*60*60*24));
                const label = bday.toLocaleDateString('en-US', {month:'short', day:'numeric'});
                return {...cl, _diff: diff, _label: label};
              }).sort((a,b) => a._diff - b._diff).slice(0, 5);
              if (!upcoming.length) return null;
              return (
                <div className="dash-card">
                  <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${D.border}` }}>
                    <div className="dash-serif" style={{ fontSize: 15, color: D.ink, fontStyle: 'italic' }}>Upcoming Birthdays</div>
                  </div>
                  {upcoming.map((cl, i) => (
                    <div key={cl.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', borderBottom: i < upcoming.length-1 ? `1px solid ${D.border}` : 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: cl._diff === 0 ? D.rose : D.gold, flexShrink: 0 }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: D.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: D.sans }}>{cl.name}</div>
                        <div style={{ fontSize: 11, color: D.inkLight, fontFamily: D.sans }}>{cl._diff===0?'Today!':cl._diff===1?'Tomorrow':`In ${cl._diff} days`}</div>
                      </div>
                      <div style={{ fontSize: 11, color: D.inkLight, whiteSpace: 'nowrap', fontFamily: D.sans }}>{cl._label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Staff today */}
            <div className="dash-card">
              <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${D.border}` }}>
                <div className="dash-serif" style={{ fontSize: 15, color: D.ink, fontStyle: 'italic' }}>Staff Today</div>
              </div>
              <div style={{ padding: '8px 20px 14px' }}>
                {staff.length === 0
                  ? <div style={{ padding: '12px 0', fontSize: 12, color: D.inkLight, textAlign: 'center', fontFamily: D.sans }}>No staff on record</div>
                  : staff.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${D.border}` }}>
                      <Avatar initials={s.initials || s.name?.slice(0,2).toUpperCase()} size={26} bg={(s.color || D.rose) + '22'} color={s.color || D.rose}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: D.ink, fontFamily: D.sans }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: D.inkLight, fontFamily: D.sans }}>{s.role}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

          </div>
        </div>
      </div>

      {showNewAppt && (
        <NewAppointmentModal events={events} staff={staff} onClose={() => setShowNewAppt(false)} onSaved={() => { setShowNewAppt(false); reloadAppts(); }}/>
      )}
      {showStandaloneAppt && (
        <StandaloneAppointmentModal clients={clients} staff={staff} onClose={() => setShowStandaloneAppt(false)} onSaved={() => { setShowStandaloneAppt(false); reloadAppts(); }}/>
      )}
      {showMarkAllComplete && (() => {
        const pending = todayAppts.filter(a => a.status !== 'completed');
        return (
          <div role="presentation" onClick={e => { if (e.target === e.currentTarget) setShowMarkAllComplete(false); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(28,17,24,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(2px)' }}>
            <div role="dialog" aria-modal="true" aria-labelledby="mark-all-complete-title"
              style={{ background: D.card, borderRadius: 20, width: 360, overflow: 'hidden', boxShadow: D.shadowLg, border: `1px solid ${D.border}` }}>
              <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
                <div className="dash-serif" style={{ fontSize: 28, color: D.gold, marginBottom: 10, fontStyle: 'italic' }}>✦</div>
                <div id="mark-all-complete-title" className="dash-serif" style={{ fontSize: 18, color: D.ink, marginBottom: 8, fontStyle: 'italic' }}>Mark all complete?</div>
                <div style={{ fontSize: 13, color: D.inkMid, fontFamily: D.sans }}>
                  {pending.length} appointment{pending.length !== 1 ? 's' : ''} will be marked as completed.
                </div>
              </div>
              <div style={{ padding: '12px 24px 24px', display: 'flex', gap: 10 }}>
                <button onClick={() => setShowMarkAllComplete(false)}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: `1px solid ${D.border}`, background: D.card, color: D.inkMid, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: D.sans }}>
                  Cancel
                </button>
                <button onClick={async () => {
                  await Promise.all(pending.map(a => supabase.from('appointments').update({ status: 'completed' }).eq('id', a.id)));
                  setShowMarkAllComplete(false);
                  reloadAppts();
                }}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#507050', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: D.sans }}>
                  Mark complete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── DASHBOARD WRAPPER ────────────────────────────────────────────────────────
const Dashboard = ({ focusMode, onToggleFocus, ...props }) => {
  usePageTitle('Dashboard');
  if (focusMode) return <FocusDashboard {...props} onToggleFocus={onToggleFocus} />;
  return <DashboardFull {...props} />;
};

export default Dashboard;
