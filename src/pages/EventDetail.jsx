import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { C, fmt, pct, SVC_LABELS, SVC_COLORS, EVT_TYPES, TYPE_SVCS,
  TYPE_DEFAULT_SVCS, COLOR_PRESETS, STYLE_OPTIONS } from '../lib/colors';
import { Avatar, Badge, Card, CardHead, Topbar, PrimaryBtn, GhostBtn, SvcTag,
  Countdown, EventTypeBadge, ProgressBar, StatusDot, AlertBanner, useToast,
  inputSt, LBL } from '../lib/ui.jsx';
import { getPriorityAlert, getCountdownConfig, DRESS_TRANSITIONS,
  ALTERATION_TRANSITIONS } from '../lib/urgency';
import { useLayoutMode } from '../hooks/useLayoutMode.jsx';
import { useAuth } from '../context/AuthContext';
import { useEvent, makeRescheduleEvent } from '../hooks/useEvents';
import { useClients, useClientInteractions, useClientEvents } from '../hooks/useClients';
import { useNotes, useTasks } from '../hooks/useNotes';
import { useSwipe } from '../hooks/useSwipe';
import { useSmsMessages } from '../hooks/useSmsMessages';
import { supabase } from '../lib/supabase';
import { useRequiresPlan } from '../components/UpgradeGate';
import { useStaffAvailability } from '../hooks/useStaffAvailability';
import ContractModal from '../components/modals/ContractModal';
import NewMilestoneModal from '../components/modals/NewMilestoneModal';
import DecorationPlanner from '../components/DecorationPlanner';
import PaymentMilestonesCard from './event-detail/PaymentMilestonesCard';
import DressRentalCard from './event-detail/DressRentalCard';
import AlterationsCard from './event-detail/AlterationsCard';
import EventTasksCard from './event-detail/EventTasksCard';
import StaffNotesCard from './event-detail/StaffNotesCard';
import ContractsCard from './event-detail/ContractsCard';
import EventRunsheet from './event-detail/EventRunsheet';
import EventVendorsCard from './event-detail/EventVendorsCard';
import { useBridalParty } from '../hooks/useBridalParty';
import { useEventFiles } from '../hooks/useEventFiles';
import { useGuests } from '../hooks/useGuests';
import GuestList from '../components/GuestList';
import PlanningBoardPanel from './event-detail/PlanningBoardPanel';
import AppointmentScheduler from '../components/appointments/AppointmentScheduler';
import { APPOINTMENT_TYPES, formatApptDateTime } from '../lib/appointmentRules';

// ─── PLANNING BOARD PANEL extracted to ./event-detail/PlanningBoardPanel.jsx ─

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  scheduled:  { label:'Scheduled',     bg:'#DBEAFE', color:'#1E40AF' },
  confirmed:  { label:'Confirmed',     bg:'#DCFCE7', color:'#15803D' },
  done:       { label:'Done',          bg:'#DCFCE7', color:'#15803D' },
  completed:  { label:'Completed',     bg:'#DCFCE7', color:'#15803D' },
  cancelled:  { label:'Cancelled',     bg:'#FEE2E2', color:'#B91C1C' },
  no_show:    { label:'No show',       bg:'#FEE2E2', color:'#B91C1C' },
  missing:    { label:'Not scheduled', bg:'#FEF3C7', color:'#B45309' },
};
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || { label: status, bg: '#F3F4F6', color: '#374151' };
  return (
    <span style={{fontSize:10, padding:'2px 8px', borderRadius:999,
      background:cfg.bg, color:cfg.color, fontWeight:600, whiteSpace:'nowrap'}}>
      {cfg.label}
    </span>
  );
};

// ─── DAY-OF SCHEDULE MODAL ────────────────────────────────────────────────
function DayOfScheduleModal({ ev, appointments, milestones, boutique, onClose }) {
  const sortedAppts = [...(appointments || [])].filter(a => a.date === ev.event_date).sort((a,b) => (a.time||'').localeCompare(b.time||''))
  const unpaidMs = (milestones || []).filter(m => m.status !== 'paid')
  function handlePrint() {
    const el = document.getElementById('day-of-print')
    if (!el) { window.print(); return; }
    const win = window.open('', '_blank', 'width=700,height=900')
    win.document.write(`
      <html><head><title>Day-of Schedule</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 32px; color: #1C1012; }
        * { box-sizing: border-box; }
        @media print { body { padding: 16px; } }
      </style>
      </head><body>
      ${el.innerHTML}
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close(); }, 300)
  }
  return (
    <div role="presentation" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'20px',overflowY:'auto'}}>
      <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-day-of-title" style={{background:C.white,borderRadius:16,width:'100%',maxWidth:640,boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>
        <div style={{padding:'12px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',borderRadius:'16px 16px 0 0'}}>
          <span id="eventdetail-day-of-title" style={{fontSize:13,fontWeight:600,color:C.ink}}>🗓️ Day-of Schedule</span>
          <div style={{display:'flex',gap:8}}>
            <button onClick={handlePrint} style={{padding:'7px 16px',border:'none',borderRadius:8,background:C.rosa,color:C.white,cursor:'pointer',fontSize:12,fontWeight:500}}>🖨️ Print / Save PDF</button>
            <button onClick={onClose} style={{padding:'7px 12px',border:`1px solid ${C.border}`,borderRadius:8,background:'transparent',color:C.gray,cursor:'pointer',fontSize:12}}>Close</button>
          </div>
        </div>
        <div id="day-of-print" style={{padding:'32px 36px'}}>
          <div style={{borderBottom:`2px solid ${C.rosa}`,paddingBottom:16,marginBottom:24,display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:22,fontWeight:700,color:C.ink,fontFamily:'Georgia,serif',marginBottom:4}}>{ev.client}</div>
              <div style={{fontSize:13,color:C.gray}}>{EVT_TYPES[ev.type]?.icon} {EVT_TYPES[ev.type]?.label || ev.type}</div>
              {ev.event_date && <div style={{fontSize:13,color:C.gray,marginTop:2}}>📅 {new Date(ev.event_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div>}
              {ev.venue && <div style={{fontSize:13,color:C.gray,marginTop:2}}>📍 {ev.venue}</div>}
              {ev.guests && <div style={{fontSize:13,color:C.gray,marginTop:2}}>👥 ~{ev.guests} guests</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:14,fontWeight:700,color:C.rosaText}}>{boutique?.name || ''}</div>
              {boutique?.phone && <div style={{fontSize:11,color:C.gray,marginTop:2}}>{boutique.phone}</div>}
              {boutique?.email && <div style={{fontSize:11,color:C.gray,marginTop:1}}>{boutique.email}</div>}
            </div>
          </div>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:12,fontWeight:700,color:C.inkMid,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:10}}>Day-of Timeline</div>
            {sortedAppts.length === 0 ? (
              <div style={{fontSize:12,color:C.gray,fontStyle:'italic'}}>No appointments scheduled for event day</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:1}}>
                {sortedAppts.map((a,i) => (
                  <div key={a.id||i} style={{display:'flex',gap:16,padding:'8px 0',borderBottom:i<sortedAppts.length-1?`1px solid ${C.border}`:'none'}}>
                    <div style={{width:56,fontSize:12,fontWeight:600,color:C.ink,flexShrink:0}}>{a.time ? a.time.slice(0,5) : 'TBD'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:500,color:C.ink,textTransform:'capitalize'}}>{(a.type||'').replace(/_/g,' ')}</div>
                      {a.note && <div style={{fontSize:11,color:C.gray,marginTop:1}}>{a.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {(()=>{
            const otherAppts = (appointments||[]).filter(a => a.date !== ev.event_date).sort((a,b) => (a.date||'').localeCompare(b.date||''))
            if (otherAppts.length === 0) return null
            return (
              <div style={{marginBottom:24}}>
                <div style={{fontSize:12,fontWeight:700,color:C.inkMid,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:10}}>Upcoming Appointments</div>
                <div style={{display:'flex',flexDirection:'column',gap:1}}>
                  {otherAppts.map((a,i) => (
                    <div key={a.id||i} style={{display:'flex',gap:16,padding:'8px 0',borderBottom:i<otherAppts.length-1?`1px solid ${C.border}`:'none'}}>
                      <div style={{width:80,fontSize:12,color:C.gray,flexShrink:0}}>{a.date ? new Date(a.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : ''} {a.time ? a.time.slice(0,5) : ''}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:500,color:C.ink,textTransform:'capitalize'}}>{(a.type||'').replace(/_/g,' ')}</div>
                        {a.note && <div style={{fontSize:11,color:C.gray,marginTop:1}}>{a.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          {unpaidMs.length > 0 && (
            <div style={{marginBottom:24}}>
              <div style={{fontSize:12,fontWeight:700,color:C.inkMid,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:10}}>Outstanding Payments</div>
              <div style={{display:'flex',flexDirection:'column',gap:1}}>
                {unpaidMs.map((m,i) => (
                  <div key={m.id||i} style={{display:'flex',gap:16,padding:'8px 0',borderBottom:i<unpaidMs.length-1?`1px solid ${C.border}`:'none'}}>
                    <div style={{width:80,fontSize:12,color:m.status==='overdue'?C.red:C.gray,flexShrink:0,fontWeight:m.status==='overdue'?600:400}}>{m.due_date ? new Date(m.due_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'TBD'}</div>
                    <div style={{flex:1,fontSize:12,color:C.ink}}>{m.label}</div>
                    <div style={{fontSize:12,fontWeight:600,color:m.status==='overdue'?C.red:C.ink,flexShrink:0}}>${Number(m.amount||0).toLocaleString()}</div>
                    {m.status==='overdue'&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:999,background:C.redBg,color:C.red,flexShrink:0}}>OVERDUE</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:10,color:C.gray}}>Generated by Belori · {new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
            <div style={{fontSize:10,color:C.rosaText,fontWeight:500}}>{boutique?.name}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── FILES PANEL ───────────────────────────────────────────────────────────
function FilesPanel({ files, filesLoading, uploadFile, deleteFile, getPublicUrl, formatBytes, getFileIcon, toast }) {
  const [uploading, setUploading] = React.useState(false)
  const fileRef = React.useRef(null)

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast('File too large (max 10 MB)', 'error'); return }
    setUploading(true)
    const { error } = await uploadFile(file)
    setUploading(false)
    if (error) toast('Upload failed', 'error')
    else toast('File uploaded ✓')
    e.target.value = ''
  }

  return (
    <div style={{padding:'20px',maxWidth:700}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:C.ink}}>📎 Event Files</div>
          <div style={{fontSize:11,color:C.gray,marginTop:1}}>Floor plans, contracts, vendor docs, images</div>
        </div>
        <div>
          <input ref={fileRef} type="file" style={{display:'none'}} onChange={handleUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp,.zip"/>
          <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{padding:'8px 16px',border:`1px solid ${C.rosa}`,borderRadius:8,background:C.rosaPale,color:C.rosaText,cursor:'pointer',fontSize:12,fontWeight:500}}>
            {uploading ? 'Uploading…' : '+ Upload file'}
          </button>
        </div>
      </div>
      {filesLoading && <div style={{color:C.gray,fontSize:12}}>Loading files…</div>}
      {!filesLoading && files.length === 0 && (
        <div style={{textAlign:'center',padding:'40px 20px',color:C.gray}}>
          <div style={{fontSize:36,marginBottom:8}}>📂</div>
          <div style={{fontSize:13,marginBottom:4}}>No files yet</div>
          <div style={{fontSize:11}}>Upload floor plans, contracts, or any event documents</div>
        </div>
      )}
      {!filesLoading && files.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {files.map(file => {
            const displayName = file.name.replace(/^\d+_/, '')
            const url = getPublicUrl(file.name)
            return (
              <div key={file.name} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,border:`1px solid ${C.border}`,background:C.white,transition:'box-shadow 0.1s'}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                <span style={{fontSize:22,flexShrink:0}}>{getFileIcon(file.name)}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayName}</div>
                  <div style={{fontSize:10,color:C.gray,marginTop:1}}>{formatBytes(file.metadata?.size)}{file.created_at ? ` · ${new Date(file.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : ''}</div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{padding:'5px 10px',border:`1px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.gray,cursor:'pointer',fontSize:11,textDecoration:'none'}}>View</a>}
                  <button onClick={async()=>{ if(!confirm(`Delete "${displayName}"?`))return; const {error}=await deleteFile(file.name); if(error)toast('Delete failed','error'); else toast('File deleted'); }} style={{padding:'5px 10px',border:'1px solid var(--border-danger)',borderRadius:6,background:'var(--bg-danger)',color:'var(--text-danger)',cursor:'pointer',fontSize:11}}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── EVENT DETAIL ──────────────────────────────────────────────────────────

// ─── Generate .ics for a single appointment ─────────────────────────────────────────────
function downloadApptIcs(appt, clientName, boutique) {
  if (!appt.date) return;
  const dateStr = appt.date.replace(/-/g, '');
  const timeStr = appt.time ? appt.time.replace(/:/g, '').slice(0, 4) : null;
  const apptLabel = (appt.type || 'Appointment').replace(/_/g, ' ');
  const title = apptLabel + ' — ' + (clientName || 'Client') + ' at ' + ((boutique && boutique.name) ? boutique.name : 'Boutique');
  let dtStart, dtEnd;
  if (timeStr) {
    dtStart = "DTSTART:" + dateStr + "T" + timeStr + "00";
    const parts = appt.time.split(":").map(Number);
    const endH = String(parts[0] + 1).padStart(2, "0");
    const endM = String(parts[1]).padStart(2, "0");
    dtEnd = "DTEND:" + dateStr + "T" + endH + endM + "00";
  } else {
    dtStart = "DTSTART;VALUE=DATE:" + dateStr;
    dtEnd = "DTEND;VALUE=DATE:" + dateStr;
  }
  const location = (boutique && boutique.address) ? boutique.address : '';
  const uid = (appt.id || Date.now()) + '@belori.app';
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Belori//EN','BEGIN:VEVENT',
    'UID:' + uid, dtStart, dtEnd, 'SUMMARY:' + title, 'LOCATION:' + location,
    'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (appt.type || 'appointment').replace(/_/g, '-') + '-' + appt.date + '.ics';
  a.click();
  URL.revokeObjectURL(a.href);
}
// Financial summary ring — rendered at top of overview tab
function FinancialRing({ total, paid, milestones }) {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  const remaining = Math.max(0, t - p);
  const overdue = (milestones||[]).filter(m=>m.status==='overdue').reduce((s,m)=>s+Number(m.amount||0),0);
  const pct = t > 0 ? Math.min(100, Math.round((p/t)*100)) : (p>0?100:0);

  // SVG ring params
  const r = 38, cx = 44, cy = 44, circ = 2*Math.PI*r;
  const dash = (pct/100)*circ;

  return (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:'16px 20px',display:'flex',gap:20,alignItems:'center',marginBottom:12}}>
      {/* Ring */}
      <div style={{flexShrink:0,position:'relative',width:88,height:88}}>
        <svg width={88} height={88} style={{transform:'rotate(-90deg)'}}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={8}/>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={overdue>0?'#EF4444':C.rosa} strokeWidth={8}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{transition:'stroke-dasharray 0.6s ease'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:18,fontWeight:700,color:overdue>0?'#EF4444':C.ink,lineHeight:1}}>{pct}%</span>
          <span style={{fontSize:9,color:C.gray,marginTop:1}}>paid</span>
        </div>
      </div>
      {/* Numbers */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,color:C.gray}}>Total</span>
          <span style={{fontSize:13,fontWeight:600,color:C.ink}}>{fmt(t)}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,color:'var(--text-success)'}}>Collected</span>
          <span style={{fontSize:13,fontWeight:600,color:'var(--text-success)'}}>{fmt(p)}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,color:C.gray}}>Remaining</span>
          <span style={{fontSize:13,fontWeight:500,color:C.inkMid||C.gray}}>{fmt(remaining)}</span>
        </div>
        {overdue>0&&(
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--bg-danger)',borderRadius:6,padding:'4px 8px',marginTop:2}}>
            <span style={{fontSize:12,color:'var(--text-danger)',fontWeight:500}}>⚠ Overdue</span>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text-danger)'}}>{fmt(overdue)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const EventDetail = ({eventId,setScreen,setSelectedEvent,allEvents,updateEvent,deleteEvent,markPaid,createMilestone,createMilestones,deleteMilestone,createJob,updateJob,updateClient,updateDress,staff=[],inventory=[],logRefund,logTip,refunds=[],setConsultationProps}) => {
  const toast = useToast();
  const { myRole, boutique, session } = useAuth();
  const hasPro = useRequiresPlan('pro');
  const { event: liveEvent, loading: eventLoading, createAppointment, toggleService, addDecoItem, removeDecoItem, updateDecoItem, refetch: refetchEvent } = useEvent(eventId);
  const rescheduleEvent = boutique ? makeRescheduleEvent(boutique.id) : null;
  const { sendSms } = useSmsMessages(liveEvent?.client_id);
  const { notes, addNote } = useNotes(liveEvent?.id);
  const { tasks: liveTasks, toggleTask: toggleLiveTask, addTask: addLiveTask } = useTasks(liveEvent?.id);
  const { files, loading: filesLoading, uploadFile, deleteFile, getPublicUrl, formatBytes, getFileIcon } = useEventFiles(liveEvent?.id);
  // useSwipe MUST be called here (before any conditional returns) — Rules of Hooks
  const swipeBack = useSwipe({ onSwipeRight: () => setScreen('events') });

  // ── Unified tab (replaces role selector + coordinator sub-tab) ───────────
  const tabKey = `belori_event_tab_${eventId}`;
  const [coordTab, setCoordTabState] = useState(() => localStorage.getItem(tabKey) || 'summary');
  const setCoordTab = (t) => { setCoordTabState(t); localStorage.setItem(tabKey, t); };

  // ── Overview quick note ───────────────────────────────────────────────────
  const [overviewNote, setOverviewNote] = useState('');
  const [overviewNoteSaving, setOverviewNoteSaving] = useState(false);
  async function saveOverviewNote() {
    if (!overviewNote.trim()) return;
    setOverviewNoteSaving(true);
    await addNote(overviewNote.trim());
    setOverviewNote('');
    setOverviewNoteSaving(false);
    toast('Note saved');
  }
  const tasks = liveTasks;
  const toggleTask = (i) => {
    const currentStaffMember = staff.find(s => s.user_id === session?.user?.id);
    const doneByName = currentStaffMember?.name || myRole || 'Staff';
    toggleLiveTask(tasks[i].id, !tasks[i].done, doneByName);
  };
  const markAllAlertsDone = async () => {
    const alertTasks = tasks.filter(t => t.alert && !t.done);
    if (!alertTasks.length) return;
    const currentStaffMember = staff.find(s => s.user_id === session?.user?.id);
    const doneByName = currentStaffMember?.name || myRole || 'Staff';
    for (const t of alertTasks) {
      await toggleLiveTask(t.id, true, doneByName);
    }
    toast(`${alertTasks.length} alert task${alertTasks.length!==1?'s':''} marked done`);
  };
  const [note,setNote]=useState('');
  const [showPrint,setShowPrint]=useState(false);
  const [showEditEvent,setShowEditEvent]=useState(false);
  // Improvement 1: collapsible summary cards
  const [collapsedCards, setCollapsedCards] = useState(() => { try { return JSON.parse(localStorage.getItem(`belori_collapsed_${eventId}`) || '{}'); } catch { return {}; } });
  const toggleCard = k => { const next = {...collapsedCards, [k]: !collapsedCards[k]}; setCollapsedCards(next); localStorage.setItem(`belori_collapsed_${eventId}`, JSON.stringify(next)); };
  // Improvement 2: service-specific detail panels
  const [svcDetails, setSvcDetails] = useState(() => { try { return JSON.parse(localStorage.getItem(`belori_svc_${eventId}`) || '{}'); } catch { return {}; } });
  const [editingSvc, setEditingSvc] = useState(null);
  const saveSvcDetails = (key, data) => { const next = {...svcDetails, [key]: data}; setSvcDetails(next); localStorage.setItem(`belori_svc_${eventId}`, JSON.stringify(next)); };
  // Improvement 1: inline event info editing
  const [editingEventInfo,setEditingEventInfo]=useState(false);
  const [eventInfoDraft,setEventInfoDraft]=useState({});
  // Service chips expand/collapse
  const [showServicesExpanded,setShowServicesExpanded]=useState(false);
  // Improvement 5: "More" tabs dropdown
  const [showMoreTabs,setShowMoreTabs]=useState(false);
  const [moreTabsPos,setMoreTabsPos]=useState({top:0,left:0});
  const moreTabsRef=useRef(null);
  // Improvement 7: event inventory dresses
  const [eventDresses,setEventDresses]=useState([]);
  const [quickTaskText, setQuickTaskText] = useState('');
  const [showQuickTask, setShowQuickTask] = useState(false);
  const [showAddTask,setShowAddTask]=useState(false);
  const [showMarkPaid,setShowMarkPaid]=useState(null);
  const [showScheduleAppt,setShowScheduleAppt]=useState(false);
  const [showAddService,setShowAddService]=useState(false);
  const [showAddMilestone,setShowAddMilestone]=useState(false);
  const [showEditRental,setShowEditRental]=useState(false);
  const [rentalForm,setRentalForm]=useState({pickup_date:'',return_date:'',fee:'',deposit_paid:true});
  const [showAddAlt,setShowAddAlt]=useState(false);
  const [newAlt,setNewAlt]=useState({garment:'',work:[],seamstress_id:'',deadline:'',price:'',notes:''});
  const [showEditAlt,setShowEditAlt]=useState(false);

  const [showEditClient,setShowEditClient]=useState(false);
  const [showAddDate,setShowAddDate]=useState(false);
  const [showEditInspiration,setShowEditInspiration]=useState(false);
  const [editEvData,setEditEvData]=useState({});
  const [newTask,setNewTask]=useState({text:'',category:'General',priority:'Normal',assigned_to_id:'',assigned_to_name:'',due_date:''});
  const [paidForm,setPaidForm]=useState({method:'Cash',date:new Date().toISOString().slice(0,10)});
  const [newAppt,setNewAppt]=useState({type:'Measurements',date:'',time:'13:00',notes:'',staff_id:''});
  const [saving,setSaving]=useState(false);
  const [addDateForm,setAddDateForm]=useState({type:'Measurements',date:'',time:'10:00',staff_id:'',notes:''});
  const [clientForm,setClientForm]=useState({name:'',phone:'',email:'',language_preference:''});
  const [altEditForm,setAltEditForm]=useState({status:'',seamstress_id:'',deadline:'',price:''});
  const [inspoForm,setInspoForm]=useState({themes:[],vision:'',florals:''});
  const [smsText, setSmsText] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [showSmsInput, setShowSmsInput] = useState(false);
  const [assigningCoord, setAssigningCoord] = useState(false);
  const [coordDraft, setCoordDraft] = useState('');

  const [showDeleteConfirm,setShowDeleteConfirm]=useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmt, setTipAmt] = useState('');
  const [returnModal, setReturnModal] = useState(null); // { appt } | null
  const [returnNotes, setReturnNotes] = useState('');
  const [reminderConfirm, setReminderConfirm] = useState(null); // { m, clientEmail } | null
  const [sendingReminder, setSendingReminder] = useState(false);
  // Email invoice confirm
  const [showEmailInvoiceConfirm,setShowEmailInvoiceConfirm]=useState(false);
  const [sendingInvoice,setSendingInvoice]=useState(false);
  // Email composer
  const [showEmailComposer,setShowEmailComposer]=useState(false);
  const [emailSubject,setEmailSubject]=useState('');
  const [emailBody,setEmailBody]=useState('');
  const [sendingEmail,setSendingEmail]=useState(false);
  // Contracts
  const [contracts,setContracts]=useState([]);
  const [showContractModal,setShowContractModal]=useState(false);
  const [copiedContractId,setCopiedContractId]=useState(null);
  // Payment link copy feedback
  const [copiedPayLinkId,setCopiedPayLinkId]=useState(null);
  // Client quick-contact copy feedback
  const [copiedField,setCopiedField]=useState(null);
  // Runsheet
  const [showRunsheet,setShowRunsheet]=useState(false);
  // Reschedule
  const [showReschedule,setShowReschedule]=useState(false);
  const [rescheduleDate,setRescheduleDate]=useState('');
  const [rescheduling,setRescheduling]=useState(false);
  // Day-of schedule
  const [showDayOf,setShowDayOf]=useState(false);
  // Topbar overflow menu
  const [showOverflow,setShowOverflow]=useState(false);
  const overflowRef=useRef(null);
  useEffect(()=>{
    if(!showOverflow)return;
    const handler=e=>{if(overflowRef.current&&!overflowRef.current.contains(e.target))setShowOverflow(false);};
    document.addEventListener('mousedown',handler);
    document.addEventListener('touchstart',handler,{passive:true});
    return ()=>{document.removeEventListener('mousedown',handler);document.removeEventListener('touchstart',handler);};
  },[showOverflow]);
  // Improvement 5: close "More" dropdown on outside click
  useEffect(()=>{
    const handler=(e)=>{if(moreTabsRef.current&&!moreTabsRef.current.contains(e.target))setShowMoreTabs(false);};
    document.addEventListener('mousedown',handler);
    return ()=>document.removeEventListener('mousedown',handler);
  },[]);
  // Dress recommendation engine — declared early so escape handler dep array can reference it
  const [dressSuggestionsOpen,setDressSuggestionsOpen]=useState(false);
  // Global keyboard shortcuts
  useEffect(()=>{
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (showOverflow) { setShowOverflow(false); return; }
        if (showScheduleAppt) { setShowScheduleAppt(false); return; }
        if (showAddTask) { setShowAddTask(false); return; }
        if (showAddMilestone) { setShowAddMilestone(false); return; }
        if (showEditEvent) { setShowEditEvent(false); return; }
        if (showMarkPaid) { setShowMarkPaid(null); return; }
        if (showEmailComposer) { setShowEmailComposer(false); return; }
        if (showDeleteConfirm) { setShowDeleteConfirm(false); return; }
        if (showDayOf) { setShowDayOf(false); return; }
        if (showRunsheet) { setShowRunsheet(false); return; }
        if (showReschedule) { setShowReschedule(false); return; }
        if (showContractModal) { setShowContractModal(false); return; }
        if (dressSuggestionsOpen) { setDressSuggestionsOpen(false); return; }
        if (showTemplateModal) { setShowTemplateModal(false); return; }
        if (showAIContractModal) { setShowAIContractModal(false); return; }
        if (showAddPartyMember) { setShowAddPartyMember(false); return; }
        if (showMoodAddPopover) { setShowMoodAddPopover(false); return; }
        if (reminderConfirm) { setReminderConfirm(null); return; }
        if (returnModal) { setReturnModal(null); return; }
        if (tipOpen) { setTipOpen(false); setTipAmt(''); return; }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showOverflow,showScheduleAppt,showAddTask,showAddMilestone,showEditEvent,showMarkPaid,showEmailComposer,showDeleteConfirm,showDayOf,showRunsheet,showReschedule,showContractModal,dressSuggestionsOpen,showTemplateModal,showAIContractModal,showAddPartyMember,showMoodAddPopover,reminderConfirm,returnModal,tipOpen]);
  // Mobile tab state
  const [mobileTab,setMobileTab]=useState('overview');
  // AI features
  const [aiDescription,setAiDescription]=useState('');
  const [aiDescLoading,setAiDescLoading]=useState(false);
  const [paymentRisk,setPaymentRisk]=useState(null); // {risk,reason,action}
  const [paymentRiskLoading,setPaymentRiskLoading]=useState(false);
  const [paymentRiskFetched,setPaymentRiskFetched]=useState(false);
  // AI contract draft
  const [showAIContractModal,setShowAIContractModal]=useState(false);
  const [aiContractText,setAiContractText]=useState('');
  const [aiContractLoading,setAiContractLoading]=useState(false);
  const [aiContractCopied,setAiContractCopied]=useState(false);
  // Mood board
  const [moodBoard,setMoodBoard]=useState(null); // null = not loaded yet
  const [moodBoardLoading,setMoodBoardLoading]=useState(false);
  const [showMoodAddPopover,setShowMoodAddPopover]=useState(false);
  const [moodUrlInput,setMoodUrlInput]=useState('');
  const [moodUrlMode,setMoodUrlMode]=useState(false);
  const [editingCaptionId,setEditingCaptionId]=useState(null);
  const [editingCaptionText,setEditingCaptionText]=useState('');
  // Dress recommendation engine
  const [clientMeasurements,setClientMeasurements]=useState(null);
  const [reservingDressId,setReservingDressId]=useState(null);
  // Appointment reminder / status update
  const [remindingApptId, setRemindingApptId] = useState(null);
  const [updatingApptId, setUpdatingApptId] = useState(null);
  // Payment receipt
  const [showReceipt, setShowReceipt] = useState(null); // milestone object or null
  // Task template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateTasks, setSelectedTemplateTasks] = useState([]);
  // Pinned notes (persisted in localStorage per event)
  const [pinnedNoteIds, setPinnedNoteIds] = useState(() => { try { return JSON.parse(localStorage.getItem(`belori_pins_${eventId}`) || '[]'); } catch { return []; } });
  const pinNote = id => { const next = pinnedNoteIds.includes(id) ? pinnedNoteIds.filter(x=>x!==id) : [...pinnedNoteIds, id]; setPinnedNoteIds(next); localStorage.setItem(`belori_pins_${eventId}`, JSON.stringify(next)); };
  // Duplicate appointment detection
  const [apptConflict,setApptConflict]=useState(null);
  const [addDateConflict,setAddDateConflict]=useState(null);
  // Staff availability warning for add-date modal
  const [staffAvailWarn,setStaffAvailWarn]=useState(null); // {available,busy,reason} | null
  const { isStaffAvailable } = useStaffAvailability();
  // Bridal Party
  const { members: bridalMembers, addMember: addBridalMember, updateMember: updateBridalMember, removeMember: removeBridalMember } = useBridalParty(eventId);
  const { guests: guestListData } = useGuests(eventId);
  const [showAddPartyMember,setShowAddPartyMember]=useState(false);
  const [partyMemberDraft,setPartyMemberDraft]=useState({name:'',role:'bridesmaid',phone:'',email:'',dress_size:'',color_assigned:'',fitting_date:'',notes:''});
  const [partyMemberSaving,setPartyMemberSaving]=useState(false);
  const [clientSearchQuery,setClientSearchQuery]=useState('');
  const [linkingMemberId,setLinkingMemberId]=useState(null);

  // ── Day-of Checklist state ──
  const [dayChecklist,setDayChecklist]=useState(null); // null = not yet synced from liveEvent
  const [checklistNewText,setChecklistNewText]=useState('');
  const [checklistAdding,setChecklistAdding]=useState(false);
  const [checklistSaving,setChecklistSaving]=useState(false);
  const DEFAULT_CHECKLIST_ITEMS=[
    'Confirm venue access time',
    'Check all decorations loaded',
    'Staff briefing complete',
    'Client arrival confirmed',
    'Final payment collected',
    'Photography brief sent',
  ];
  // Sync day_checklist from liveEvent on first load only (dayChecklist starts null)
  const checklistInitialized = React.useRef(false);
  useEffect(()=>{
    if(liveEvent && !checklistInitialized.current){
      checklistInitialized.current = true;
      setDayChecklist(Array.isArray(liveEvent.day_checklist)?liveEvent.day_checklist:[]);
    }
  },[liveEvent]);

  async function saveChecklist(list){
    if(!updateEvent||!liveEvent?.id)return;
    setChecklistSaving(true);
    await updateEvent(liveEvent.id,{day_checklist:list});
    setChecklistSaving(false);
  }
  async function toggleChecklistItem(idx,userName){
    if(!dayChecklist)return;
    const updated=dayChecklist.map((item,i)=>{
      if(i!==idx)return item;
      const nowDone=!item.done;
      return {
        ...item,
        done:nowDone,
        done_at:nowDone?new Date().toISOString():null,
        done_by:nowDone?(userName||'Staff'):null,
      };
    });
    setDayChecklist(updated);
    await saveChecklist(updated);
  }
  async function addChecklistItem(text){
    if(!text.trim())return;
    const updated=[...(dayChecklist||[]),{id:Date.now().toString(),text:text.trim(),done:false,done_at:null,done_by:null,created_at:new Date().toISOString()}];
    setDayChecklist(updated);
    setChecklistNewText('');
    setChecklistAdding(false);
    await saveChecklist(updated);
  }
  async function deleteChecklistItem(idx){
    const updated=(dayChecklist||[]).filter((_,i)=>i!==idx);
    setDayChecklist(updated);
    await saveChecklist(updated);
  }
  function startChecklistWithDefaults(){
    if(dayChecklist&&dayChecklist.length>0){setChecklistAdding(true);return;}
    const defaults=DEFAULT_CHECKLIST_ITEMS.map(text=>({id:Date.now().toString()+Math.random(),text,done:false,done_at:null,done_by:null,created_at:new Date().toISOString()}));
    setDayChecklist(defaults);
    saveChecklist(defaults);
  }

  // Inject mobile media-query styles once
  useEffect(()=>{
    const id='event-detail-mobile-styles';
    if(document.getElementById(id)) return;
    const el=document.createElement('style');
    el.id=id;
    el.textContent=`
@media (max-width: 680px) {
  .event-body { display: block !important; }
  .event-mobile-tabs { display: flex !important; }
  .event-tab-panel { display: none; }
  .event-tab-panel.active { display: block !important; }
  .event-hero-amounts { display: none !important; }
  .topbar-actions { gap: 4px !important; }
  .topbar-actions .btn-icon { display: none !important; }
}
@media (min-width: 681px) {
  .event-mobile-tabs { display: none !important; }
  .event-tab-panel { display: block !important; }
}
    `;
    document.head.appendChild(el);
    return ()=>{ const s=document.getElementById(id); if(s) s.remove(); };
  },[]);

  const addTask = (data) => addLiveTask(data);
  // Find dress linked to this event (by event_id or client_id) and normalize fields
  const dressRental = useMemo(() => {
    if (!liveEvent) return null;
    const clientId = liveEvent.client_id || liveEvent.clientData?.id;
    const raw = inventory.find(d => d.event_id === liveEvent.id && ['reserved','rented','picked_up'].includes(d.status))
      || (clientId ? inventory.find(d => d.client_id === clientId && ['reserved','rented','picked_up'].includes(d.status)) : null);
    if (!raw) return null;
    return {
      ...raw,
      fee: raw.fee ?? raw.price ?? 0,
      deposit: raw.deposit ?? 0,
      depositPaid: raw.deposit_paid ?? false,
      pickupDate: raw.pickup_date || '—',
      pickupTime: '',
      returnDate: raw.return_date || '—',
      returnTime: '',
    };
  }, [inventory, liveEvent?.id]);
  const decoItems = liveEvent?.event_inventory || [];
  const alteration = liveEvent?.alteration || null;
  const inspiration = liveEvent?.inspiration || null;

  // Load contracts for this event (must be before any early return)
  useEffect(()=>{
    if(!liveEvent?.id) return;
    supabase.from('contracts').select('*').eq('event_id',liveEvent.id).eq('boutique_id',boutique.id).order('created_at',{ascending:false})
      .then(({data})=>setContracts(data||[]));
  },[liveEvent?.id]);

  // Track this event in recently viewed (for Dashboard widget)
  useEffect(() => {
    if (!liveEvent?.id) return;
    try {
      const recent = JSON.parse(localStorage.getItem('belori_recent') || '[]');
      const entry = { type: 'event', id: liveEvent.id, name: liveEvent.client, sub: liveEvent.type + ' · ' + (liveEvent.event_date || '') };
      const filtered = recent.filter(r => !(r.type === 'event' && r.id === liveEvent.id));
      localStorage.setItem('belori_recent', JSON.stringify([entry, ...filtered].slice(0, 10)));
    } catch {}
  }, [liveEvent?.id]);

  // Load questionnaire submission for this event
  const [questionnaire, setQuestionnaire] = useState(null)
  useEffect(() => {
    if (!liveEvent?.id) return
    supabase.from('questionnaire_submissions')
      .select('*')
      .eq('event_id', liveEvent.id)
      .eq('boutique_id', boutique.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setQuestionnaire(data?.[0] || null))
  }, [liveEvent?.id])

  // Fetch client measurements for dress recommendations
  useEffect(() => {
    if (!liveEvent?.client_id) return;
    if (!boutique?.id) return;
    supabase.from('client_measurements').select('*')
      .eq('client_id', liveEvent.client_id)
      .eq('boutique_id', boutique?.id)
      .limit(1).single()
      .then(({ data }) => setClientMeasurements(data || null));
  }, [liveEvent?.client_id, boutique?.id]);

  // Fetch payment risk once when milestones are available — rule-based
  useEffect(() => {
    if (!liveEvent?.id || paymentRiskFetched) return;
    const ms = (liveEvent.milestones || []);
    if (!ms.length) return;
    setPaymentRiskFetched(true);
    const total = Number(liveEvent.total) || 0;
    const paid = Number(liveEvent.paid) || 0;
    const remaining = total - paid;
    const days = liveEvent.daysUntil ?? 999;
    const overdueMs = ms.filter(m => m.status === 'overdue');
    const overdueCount = overdueMs.length;
    const overdueAmt = overdueMs.reduce((s, m) => s + Number(m.amount || 0), 0);
    const paidPct = total > 0 ? paid / total : 1;

    let risk, reason, action;
    if (overdueCount > 0 && days <= 30) {
      risk = 'critical';
      reason = `${overdueCount} overdue milestone${overdueCount>1?'s':''} (${fmt(overdueAmt)}) with only ${days} days until the event.`;
      action = 'Send payment reminder immediately';
    } else if (overdueCount > 0) {
      risk = 'high';
      reason = `${overdueCount} overdue milestone${overdueCount>1?'s':''} totaling ${fmt(overdueAmt)}.`;
      action = 'Follow up with client';
    } else if (paidPct < 0.5 && days <= 60) {
      risk = 'medium';
      reason = `Only ${Math.round(paidPct*100)}% paid with ${days} days remaining. ${fmt(remaining)} still owed.`;
      action = 'Schedule payment check-in';
    } else if (paidPct >= 1) {
      risk = 'low';
      reason = 'Fully paid — no payment risk.';
      action = null;
    } else {
      risk = 'low';
      reason = `${Math.round(paidPct*100)}% paid. ${fmt(remaining)} remaining with ${days} days until event.`;
      action = null;
    }
    setPaymentRisk({ risk, reason, action });
  }, [liveEvent?.id, liveEvent?.milestones?.length]);

  // Load mood board from event
  useEffect(()=>{
    if(!liveEvent?.id) return;
    setMoodBoard(liveEvent.mood_board || []);
  },[liveEvent?.id]);

  // Improvement 7: load event inventory dresses
  useEffect(()=>{
    if(!liveEvent?.id) return;
    supabase
      .from('event_inventory')
      .select('*, inventory(*)')
      .eq('event_id', liveEvent.id)
      .eq('boutique_id', boutique.id)
      .then(({ data }) => {
        if (data) setEventDresses(data.filter(ei => ['bridal_gown','quince_gown','veil','headpiece'].includes(ei.inventory?.category)));
      });
  },[liveEvent?.id]);

  if (!liveEvent) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:C.gray,fontSize:13}}>
      {eventLoading ? 'Loading…' : 'Event not found'}
    </div>
  );
  const ev = liveEvent;
  const sortedMilestones = [...(liveEvent.milestones || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const milestones = sortedMilestones;
  const appointments = liveEvent.appointments || [];
  const upcomingAppts = appointments.filter(a=>['upcoming','scheduled','missing'].includes(a.status));
  const daysUntil = ev.daysUntil || 0;

  // Compute blocking issues from live data
  const blockingIssues = (()=>{
    const issues=[];
    milestones.filter(m=>m.status==='overdue').forEach(m=>{
      issues.push({label:`${m.label} (${fmt(Number(m.amount))}) overdue${m.daysLate?' '+m.daysLate+' days':''}`,severity:'high'});
    });
    appointments.filter(a=>a.status==='missing').forEach(a=>{
      issues.push({label:`${a.type} — not scheduled (${daysUntil}d away)`,severity:daysUntil<=7?'critical':'high'});
    });
    if(alteration&&!['fitting_scheduled','complete'].includes(alteration.status)&&daysUntil<=7)
      issues.push({label:`Alterations not complete — ${alteration.garment} (${alteration.status.replace(/_/g,' ')})`,severity:'critical'});
    decoItems.filter(d=>d.available<d.qty).forEach(d=>{
      issues.push({label:`${d.name} — ${d.qty-d.available} units short`,severity:'medium'});
    });
    return issues;
  })();

  const urgencyBadge = daysUntil<=0?{label:'Today!',bg:'var(--bg-danger)',col:'var(--text-danger)'}:daysUntil<=3?{label:`${daysUntil}d away`,bg:'var(--bg-danger)',col:'var(--text-danger)'}:daysUntil<=14?{label:`${daysUntil} days away`,bg:'var(--bg-warning)',col:'var(--text-warning)'}:{label:`${daysUntil} days away`,bg:'var(--bg-success)',col:'var(--text-success)'};

  async function handleAddNote(){if(!note.trim())return;await addNote(note);setNote('');toast('Note added');}

  async function copyField(value, fieldName) {
    try { await navigator.clipboard.writeText(value); setCopiedField(fieldName); setTimeout(()=>setCopiedField(null),1500); } catch { toast('Could not copy'); }
  }

  const fmtApptDate = (date, time) => {
    if (!date) return '';
    const d = new Date(date + 'T12:00:00');
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!time) return dateStr;
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${dateStr} · ${h12}:${String(m).padStart(2,'0')} ${ampm}`;
  };

  async function updateApptStatus(apptId, newStatus) {
    setUpdatingApptId(apptId);
    await supabase.from('appointments').update({ status: newStatus }).eq('id', apptId).eq('boutique_id', boutique.id);
    setUpdatingApptId(null);
    await refetchEvent();
    toast('Appointment updated');
  }

  const markApptStatus = updateApptStatus;

  const logReturn = (appt) => { setReturnNotes(''); setReturnModal({ appt }); };

  const confirmReturn = async () => {
    if (!returnModal) return;
    const now = new Date().toISOString();
    await supabase.from('appointments')
      .update({ status: 'done', completed_at: now, actual_return_at: now, condition_notes: returnNotes.trim() || null })
      .eq('id', returnModal.appt.id).eq('boutique_id', boutique.id);
    setReturnModal(null);
    await refetchEvent();
    toast('Return logged ✓');
  };

  const sendReminder = async () => {
    if (!reminderConfirm) return;
    const { m, clientEmail } = reminderConfirm;
    setSendingReminder(true);
    const origin = window.location.origin;
    const portalUrl = ev.portal_token ? `${origin}/portal/${ev.portal_token}` : origin;
    const payBtn = m.stripe_payment_link_url
      ? `<p style="margin:16px 0"><a href="${m.stripe_payment_link_url}" style="display:inline-block;padding:12px 24px;background:#C9697A;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">💳 Pay $${m.amount} online →</a></p>`
      : `<p><a href="${portalUrl}">View your client portal →</a></p>`;
    const clientFirst = ev.client?.split(' ')[0] || 'there';
    const [{ error }] = await Promise.all([
      supabase.functions.invoke('send-email', {
        body: {
          to: clientEmail,
          subject: `Payment Reminder: ${m.label}`,
          html: `<p>Hi ${clientFirst},</p><p>This is a friendly reminder that your payment for <strong>${m.label}</strong> in the amount of <strong>$${m.amount}</strong> is currently due.</p>${payBtn}<p>Thank you!</p>`
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }),
      supabase.from('payment_milestones').update({ last_reminded_at: new Date().toISOString() }).eq('id', m.id).eq('boutique_id', boutique.id),
    ]);
    setSendingReminder(false);
    setReminderConfirm(null);
    if (error) { toast('Failed to send reminder', 'error'); } else { toast('Reminder email sent ✓'); refetchEvent?.(); }
  };

  async function handleReschedule() {
    if (!rescheduleDate || !ev.event_date) return;
    setRescheduling(true);
    const { error } = await rescheduleEvent(ev.id, ev.event_date, rescheduleDate);
    setRescheduling(false);
    if (error) { toast('Failed to reschedule', 'error'); return; }
    toast('Event rescheduled ✓ — all milestones & appointments shifted');
    setShowReschedule(false);
    refetchEvent();
  }

  // ── Task templates ─────────────────────────────────────────────────────────
  const TASK_TEMPLATES = {
    wedding: ['Confirm venue booking','Schedule measurements appointment','Book dress fitting','Confirm florist order','Confirm DJ / music','Send payment reminder','Finalize day-of timeline','Confirm photographer','Confirm catering','Bridal party fittings complete'],
    quince: ['Confirm venue booking','Schedule measurements appointment','Book dress fitting','Court of honor fittings','Confirm DJ / music','Schedule waltz rehearsal','Send payment reminder','Order tiara & accessories','Confirm photographer','Finalize day-of timeline'],
    baptism: ['Confirm venue','Book decoration setup','Confirm photographer','Send payment reminder','Confirm catering','Print programs'],
    birthday: ['Confirm venue','Book decoration setup','Confirm DJ','Send payment reminder','Order cake','Confirm photographer'],
    default: ['Confirm booking','Send payment reminder','Confirm day-of details','Final payment collected'],
  };

  // ── Dress recommendation engine ─────────────────────────────────────────────
  function getDressSuggestions(measurements, inv) {
    const evColors = (ev?.inspiration_colors || []).map(c => (c.label||c).toLowerCase());
    const clientStyleThemes = (ev?.clientData?.style_themes || []).map(s => (s.label||s).toLowerCase());
    const gowns = (inv || []).filter(i =>
      ['bridal_gown','quince_gown'].includes(i.category) && i.status === 'available'
    );
    const hasMeasurements = measurements && (measurements.bust || measurements.waist);
    if (!hasMeasurements) {
      // No measurements: show all available gowns sorted by price
      return gowns
        .map(g => ({ ...g, score: 0, matchNotes: [] }))
        .sort((a, b) => (a.price || 0) - (b.price || 0))
        .slice(0, 8);
    }
    return gowns.map(g => {
      let score = 0;
      const notes = [];
      // +3 size match (bust or waist within 2 inches of dress size)
      if (g.size) {
        const sizeNum = Number(g.size);
        const bustMatch = measurements.bust && Math.abs(Number(measurements.bust) - sizeNum) <= 2;
        const waistMatch = measurements.waist && Math.abs(Number(measurements.waist) - sizeNum) <= 2;
        if (bustMatch || waistMatch) { score += 3; notes.push('Size match'); }
      }
      // +2 color match against event inspiration_colors
      if (g.color && evColors.includes(g.color.toLowerCase())) {
        score += 2; notes.push(`Matches ${g.color} inspiration`);
      }
      // +2 style match against client style_themes
      const gStyleStr = (g.style || g.name || '').toLowerCase();
      if (clientStyleThemes.some(s => gStyleStr.includes(s) || s.includes(gStyleStr.split(' ')[0]))) {
        score += 2; notes.push('Style match');
      }
      // +1 price within budget (<=120% of event total)
      if (ev?.total && g.price && Number(g.price) <= Number(ev.total) * 1.2) {
        score += 1; notes.push('Within budget');
      }
      return { ...g, score, matchNotes: notes };
    }).sort((a, b) => b.score - a.score).slice(0, 8);
  }

  async function handleReserveDress(dress) {
    setReservingDressId(dress.id);
    const { error } = await supabase.from('event_inventory').insert({
      boutique_id: boutique.id,
      event_id: ev.id,
      inventory_id: dress.id,
      quantity: 1,
    });
    setReservingDressId(null);
    if (error) { toast('Failed to reserve dress', 'error'); return; }
    toast(`${dress.name} reserved for this event`);
    refetchEvent();
  }

  // ── Staff availability check for add-date modal ────────────────────────────
  async function checkStaffAvailability(staffId, date, time) {
    if (!staffId || !date) { setStaffAvailWarn(null); return; }
    const result = await isStaffAvailable(staffId, date, time);
    setStaffAvailWarn(result);
  }

  // ── Duplicate appointment detection ────────────────────────────────────────
  function timesOverlap(t1, t2, windowMinutes = 60) {
    if (!t1 || !t2) return false;
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    const diff = Math.abs((h1 * 60 + m1) - (h2 * 60 + m2));
    return diff < windowMinutes;
  }
  function checkConflict(date, time, staffId) {
    if (!date || !time) return null;
    const conflicts = appointments.filter(a => {
      if (a.status === 'cancelled') return false;
      if (a.date !== date) return false;
      if (staffId && a.staff_id !== staffId) return false;
      if (!staffId && a.staff_id) return false;
      return timesOverlap(a.time, time);
    });
    return conflicts.length > 0 ? conflicts : null;
  }

  const openContractModal = () => setShowContractModal(true);

  // ── AI description generator ────────────────────────────────────────────────
  async function handleGenerateDescription() {
    if (!hasPro) {
      document.dispatchEvent(new CustomEvent('belori:show-upgrade', { detail: { feature: 'AI Event Description', minPlan: 'pro' } }));
      return;
    }
    setAiDescLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-suggest', {
        body: {
          type: 'event_description',
          eventType: ev.type,
          clientName: ev.client,
          eventDate: ev.event_date,
          venue: ev.venue,
          services: ev.services,
          guests: ev.guests,
        },
      });
      if (error || data?.error) {
        toast('AI not configured — add ANTHROPIC_API_KEY to Supabase secrets.', 'warn');
      } else if (data?.result) {
        setAiDescription(data.result.trim());
      }
    } catch {
      toast('Could not reach AI service', 'error');
    } finally {
      setAiDescLoading(false);
    }
  }

  // ── AI contract draft ───────────────────────────────────────────────────────
  async function handleAIDraftContract() {
    if (!hasPro) {
      document.dispatchEvent(new CustomEvent('belori:show-upgrade', { detail: { feature: 'AI Contract Drafting', minPlan: 'pro' } }));
      return;
    }
    setShowAIContractModal(true);
    setAiContractLoading(true);
    setAiContractText('');
    try {
      const { data, error } = await supabase.functions.invoke('ai-suggest', {
        body: {
          type: 'contract_draft',
          eventType: ev.type,
          clientName: ev.client,
          eventDate: ev.event_date,
          venue: ev.venue,
          services: ev.services,
          total: ev.total,
          deposit: (ev.milestones || []).find(m => m.label?.toLowerCase().includes('deposit'))?.amount || 0,
          boutiqueName: boutique?.name || 'Your Boutique',
        },
      });
      if (error || data?.error) {
        setAiContractText('AI not configured — add ANTHROPIC_API_KEY to Supabase secrets.');
      } else if (data?.result) {
        setAiContractText(data.result.trim());
      }
    } catch {
      setAiContractText('Could not reach AI service. Please try again.');
    }
    setAiContractLoading(false);
  }

  // ── Mood board helpers ──────────────────────────────────────────────────────
  async function saveMoodBoard(newBoard) {
    setMoodBoardLoading(true);
    await supabase.from('events').update({ mood_board: newBoard }).eq('id', ev.id).eq('boutique_id', boutique.id);
    setMoodBoard(newBoard);
    setMoodBoardLoading(false);
  }

  async function handleMoodAddUrl() {
    if (!moodUrlInput.trim()) return;
    const newItem = { id: Date.now().toString(), url: moodUrlInput.trim(), caption: '', type: 'url', added_at: new Date().toISOString() };
    const newBoard = [...(moodBoard || []), newItem];
    setMoodUrlInput('');
    setMoodUrlMode(false);
    setShowMoodAddPopover(false);
    await saveMoodBoard(newBoard);
  }

  async function handleMoodUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMoodBoardLoading(true);
    setShowMoodAddPopover(false);
    const ext = file.name.split('.').pop();
    const path = `${boutique.id}/${ev.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('mood-board').upload(path, file, { upsert: true });
    if (uploadErr) { toast('Upload failed', 'error'); setMoodBoardLoading(false); return; }
    const { data: urlData } = supabase.storage.from('mood-board').getPublicUrl(path);
    const url = urlData?.publicUrl;
    if (!url) { toast('Could not get image URL', 'error'); setMoodBoardLoading(false); return; }
    const newItem = { id: Date.now().toString(), url, caption: '', type: 'upload', added_at: new Date().toISOString() };
    const newBoard = [...(moodBoard || []), newItem];
    setMoodBoard(newBoard);
    await supabase.from('events').update({ mood_board: newBoard }).eq('id', ev.id).eq('boutique_id', boutique.id);
    setMoodBoardLoading(false);
    toast('Photo added to mood board');
  }

  async function handleMoodRemove(id) {
    const newBoard = (moodBoard || []).filter(item => item.id !== id);
    await saveMoodBoard(newBoard);
    toast('Photo removed');
  }

  async function handleCaptionSave(id) {
    const newBoard = (moodBoard || []).map(item => item.id === id ? { ...item, caption: editingCaptionText } : item);
    await saveMoodBoard(newBoard);
    setEditingCaptionId(null);
    setEditingCaptionText('');
  }

  // ── Payment risk analyzer ───────────────────────────────────────────────────
  // Risk is now computed locally in the useEffect above — no AI call needed.

  // ── Email invoice handler ───────────────────────────────────────────────
  async function handleSendInvoice() {
    const clientEmail = ev.clientData?.email;
    if (!clientEmail) { toast('Client has no email on file', 'error'); return; }
    setSendingInvoice(true);
    const receiptUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf?type=receipt&event_id=${ev.id}`;
    const boutiquePhone = boutique?.phone || '';
    const boutiqueEmail = boutique?.email || '';
    const boutiqueName = boutique?.name || 'Your boutique';
    const html = `<p>Dear ${ev.client},</p><p>Please find attached your payment receipt from ${boutiqueName}.</p><p>Your receipt is available at: <a href="${receiptUrl}">Download Receipt</a></p><p>Thank you for choosing ${boutiqueName}!</p><p>— ${boutiqueName}<br/>${boutiquePhone}<br/>${boutiqueEmail}</p>`;
    let emailSent = false;
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: { to: clientEmail, subject: `Payment receipt — ${boutiqueName}`, html },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!error) emailSent = true;
    } catch (_e) { /* edge function missing or failed — use fallback */ }
    // Log to client_interactions regardless
    if (ev.client_id) {
      await supabase.from('client_interactions').insert({
        boutique_id: boutique?.id,
        client_id: ev.client_id,
        type: 'email',
        title: 'Invoice emailed',
        body: `Payment receipt sent to ${clientEmail}`,
        occurred_at: new Date().toISOString(),
        is_editable: false,
      });
    }
    setSendingInvoice(false);
    setShowEmailInvoiceConfirm(false);
    if (emailSent) {
      toast(`Receipt sent to ${clientEmail}`);
    } else {
      try {
        await navigator.clipboard.writeText(receiptUrl);
        toast('Receipt link copied — email not configured yet. Log recorded.');
      } catch {
        toast('Could not copy — please copy manually', 'warn');
      }
    }
  }

  // ── Email composer handler ──────────────────────────────────────────────
  async function handleSendEmail() {
    const clientEmail = ev.clientData?.email;
    if (!clientEmail) { toast('Client has no email on file', 'error'); return; }
    if (!emailSubject.trim()) { toast('Please enter a subject', 'warn'); return; }
    setSendingEmail(true);
    const html = emailBody.replace(/\n/g,'<br/>');
    let emailSent = false;
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: { to: clientEmail, subject: emailSubject, html },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!error) emailSent = true;
    } catch (_e) { /* fallback */ }
    // Always log interaction
    if (ev.client_id) {
      await supabase.from('client_interactions').insert({
        boutique_id: boutique?.id,
        client_id: ev.client_id,
        type: 'email',
        title: emailSubject,
        body: emailBody,
        occurred_at: new Date().toISOString(),
        is_editable: false,
      });
    }
    setSendingEmail(false);
    setShowEmailComposer(false);
    setEmailSubject('');
    setEmailBody('');
    toast(emailSent ? 'Email sent' : 'Email logged (SMTP not configured)');
  }

  const generatePayLink = async (m) => {
    toast('Generating payment link…');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: { milestone_id: m.id },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error || !data?.url) { toast('Could not generate link', 'error'); return; }
      try {
        await navigator.clipboard.writeText(data.url);
        toast('Payment link created & copied to clipboard ✓');
      } catch {
        toast('Could not copy — please copy manually', 'warn');
      }
      setCopiedPayLinkId(m.id);
      setTimeout(() => setCopiedPayLinkId(null), 2000);
      await refetchEvent();
    } catch { toast('Could not generate link', 'error'); }
  };

  const copyContractLink = async (c) => {
    const link = `${window.location.origin}/sign/${c.sign_token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Contract link copied ✓', 'success');
    } catch {
      toast('Could not copy — please copy manually', 'warn');
    }
    setCopiedContractId(c.id);
    setTimeout(()=>setCopiedContractId(null),2000);
  };

  const downloadSignedPDF = async (c) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation:'portrait', unit:'in', format:'letter' });
    const margin = 0.75;
    doc.setFont('Helvetica','bold').setFontSize(16).setTextColor(28,16,18);
    doc.text(c.title, margin, 1);
    doc.setFont('Helvetica','normal').setFontSize(10).setTextColor(107,114,128);
    doc.text(`Signed by: ${c.signed_by_name}  |  Date: ${new Date(c.signed_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`, margin, 1.3);
    doc.setDrawColor(229,231,235).setLineWidth(0.01).line(margin, 1.45, 8.5-margin, 1.45);
    doc.setTextColor(55,65,81).setFontSize(10);
    const lines = doc.splitTextToSize(c.body_html||'', 8.5-margin*2);
    doc.text(lines, margin, 1.7);
    const sigY = Math.min(1.7 + lines.length*0.14 + 0.3, 9.5);
    if(c.signature_data) {
      doc.addImage(c.signature_data,'PNG',margin,sigY,2.5,0.8);
      doc.setDrawColor(200,200,200).line(margin,sigY+0.85,margin+2.5,sigY+0.85);
      doc.setFontSize(8).setTextColor(150,150,150).text('Client signature',margin,sigY+1);
    }
    doc.save(`contract-${c.title.replace(/\s+/g,'-').toLowerCase()}.pdf`);
  };

  async function handleDownloadContract(){
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf?type=contract&event_id=${ev.id}`;
      const res = await fetch(url, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
      if (!res.ok) { toast('Could not generate PDF'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `contract-${ev.client?.replace(/\s+/g,'-').toLowerCase() ?? ev.id.slice(0,8)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast('Could not generate PDF'); }
  }

  const TASK_CAT_COLORS={Payment:{bg:'var(--bg-danger)',col:'var(--text-danger)'},Fitting:{bg:'var(--bg-info)',col:'var(--text-info)'},Rental:{bg:'var(--bg-primary)',col:'var(--text-primary)'},Deco:{bg:'var(--bg-warning)',col:'var(--text-warning)'},Planning:{bg:'var(--bg-accent)',col:'var(--text-accent)'},General:{bg:C.grayBg,col:C.gray}};

  // Improvement 1: reusable collapse button
  const CollapseBtn = ({cardKey}) => (
    <button onClick={()=>toggleCard(cardKey)} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,padding:'2px 4px',display:'flex',alignItems:'center',fontSize:16,lineHeight:1,flexShrink:0}} title={collapsedCards[cardKey]?'Expand':'Collapse'}>{collapsedCards[cardKey] ? '▸' : '▾'}</button>
  );

  return (
    <div {...swipeBack} style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* ── STICKY TOPBAR ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',height:52,background:C.white,borderBottom:`1px solid ${C.border}`,flexShrink:0,position:'sticky',top:0,zIndex:20}}>
        <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
          <button onClick={()=>setScreen('events')} style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:C.gray,cursor:'pointer',background:'none',border:'none',padding:'8px 6px',minHeight:44}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Events
          </button>
          <span style={{color:C.borderDark,fontSize:14}}>›</span>
          <span style={{fontSize:13,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:240}}>{ev.client}</span>
        </div>
        <div className="topbar-actions" style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}>
          {/* ── Print summary toggle ── */}
          <button className="btn-icon" onClick={()=>setShowPrint(p=>!p)} title="Print summary" style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.border}`,borderRadius:8,background:showPrint?C.rosaPale:C.white,cursor:'pointer',color:showPrint?C.rosaText:C.gray,flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="1" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 7H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1" stroke="currentColor" strokeWidth="1.3"/><rect x="3" y="10" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="9" r="0.8" fill="currentColor"/></svg>
          </button>
          {/* ── Overflow "···" menu ── */}
          <div ref={overflowRef} style={{position:'relative',flexShrink:0}}>
            <button onClick={()=>setShowOverflow(s=>!s)} title="More actions"
              style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${showOverflow?C.rosa:C.border}`,borderRadius:8,background:showOverflow?C.rosaPale:C.white,cursor:'pointer',color:showOverflow?C.rosaText:C.gray,gap:2}}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg>
            </button>
            {showOverflow&&(
              <div style={{position:'absolute',top:'calc(100% + 6px)',right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:400,minWidth:230,overflow:'hidden'}}>
                {[
                  { group:'Event' },
                  { label:'➕ Add service',            action:()=>setShowAddService(true) },
                  { label:'📅 Reschedule event',      action:()=>{setRescheduleDate(ev.event_date||'');setShowReschedule(true);} },
                  { label:'🗓️ Day-of schedule',        action:()=>setShowDayOf(true) },
                  { label:'📋 Run sheet',              action:()=>setShowRunsheet(true) },
                  { group:'Client communication' },
                  { label:'📧 Email invoice',          action:()=>{ if(!ev.clientData?.email){toast('Client has no email on file','error');return;} setShowEmailInvoiceConfirm(true); } },
                  { label:'✉️ Email client',           action:()=>{ setEmailSubject(`Re: Your ${ev.type} with ${boutique?.name||'us'}`); setEmailBody(''); setShowEmailComposer(true); } },
                  { label:'🪪 Copy client portal',     action:async()=>{ if(!liveEvent?.portal_token){toast('Portal link not available','error');return;} try { await navigator.clipboard.writeText(`${window.location.origin}/portal/${liveEvent.portal_token}`); toast('Portal link copied!'); } catch { toast('Could not copy — please copy manually','warn'); } } },
                  { label:'📝 Copy questionnaire link',action:async()=>{ if(!liveEvent?.portal_token){toast('Portal link not available','error');return;} try { await navigator.clipboard.writeText(`${window.location.origin}/questionnaire/${liveEvent.portal_token}`); toast('Questionnaire link copied!'); } catch { toast('Could not copy — please copy manually','warn'); } } },
                  { group:'Documents' },
                  { label:'🤖 AI contract draft',      action:handleAIDraftContract },
                  { label:'⬇️ Download contract PDF',  action:handleDownloadContract },
                  { label:'📆 Add to calendar (.ics)', action:()=>{
                    if(!ev.event_date)return;
                    const d=ev.event_date.replace(/-/g,'');
                    const title=`${ev.client}${ev.type==='wedding'?' Wedding':ev.type==='quince'?' Quinceañera':' Event'}`;
                    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Belori//EN','BEGIN:VEVENT',`UID:${ev.id}@belori.app`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${d}`,`SUMMARY:${title}`,`LOCATION:${ev.venue||''}`,`DESCRIPTION:Managed by Belori\\nGuests: ${ev.guests||'TBD'}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
                    const blob=new Blob([ics],{type:'text/calendar'});
                    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${title.replace(/\s+/g,'-').toLowerCase()}.ics`;a.click();URL.revokeObjectURL(a.href);
                    toast('Calendar file downloaded ✓');
                  }},
                  { label:'🔗 Copy event link',        action:async()=>{ try { await navigator.clipboard.writeText(window.location.href); toast('Internal link copied ✓'); } catch { toast('Could not copy — please copy manually','warn'); } } },
                  ...(myRole==='owner'&&deleteEvent ? [{ group:'Danger zone' },{ label:'🗑️ Delete event', action:()=>setShowDeleteConfirm(true), danger:true }] : []),
                ].map((item,i)=>(
                  item.group ? (
                    <div key={`g${i}`} style={{padding:'6px 16px 4px',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:item.group==='Danger zone'?'var(--text-danger)':C.gray,background:C.grayBg,borderTop:i>0?`1px solid ${C.border}`:'none'}}>
                      {item.group}
                    </div>
                  ) : (
                    <button key={i} onClick={()=>{item.action();setShowOverflow(false);}}
                      style={{display:'flex',alignItems:'center',width:'100%',padding:'9px 16px',background:'transparent',border:'none',
                        cursor:'pointer',fontSize:13,textAlign:'left',
                        color:item.danger?'var(--text-danger)':C.ink,fontWeight:item.danger?500:400}}
                      onMouseEnter={e=>e.currentTarget.style.background=item.danger?'var(--bg-danger)':C.grayBg}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      {item.label}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ALERT BAR ── */}
      {blockingIssues.length>0&&(
        <div style={{background:'#FFFBEB',borderBottom:'1px solid #FDE68A',padding:'9px 20px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}><path d="M8 2L1.5 13h13L8 2z" stroke={C.amber} strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 7v2.5M8 11v.5" stroke={C.amber} strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span style={{fontSize:11,color:'#78350F',flex:1}}><strong>{blockingIssues.length} {blockingIssues.length===1?'issue needs':'issues need'} attention</strong> — {blockingIssues.slice(0,2).map(i=>i.label).join(' · ')}</span>
          <span onClick={()=>setCoordTab('tasks')} style={{fontSize:11,color:C.amber,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>View tasks →</span>
        </div>
      )}

      {/* ── EVENT CONTEXT HEADER — always visible across all roles ── */}
      {(() => {
        const pct = Number(ev.total) > 0 ? Math.min(100, Math.round((Number(ev.paid) / Number(ev.total)) * 100)) : 0;
        const hasOverdue = Number(ev.overdue) > 0;
        const barColor = hasOverdue ? 'var(--color-danger)' : pct >= 100 ? 'var(--color-success)' : C.rosa;
        return (
          <div style={{background:'#FAFAFA',borderBottom:`1px solid ${C.border}`,padding:'7px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0,flexWrap:'wrap'}}>
            <EventTypeBadge type={ev.type}/>
            <span style={{fontSize:14,fontWeight:600,color:C.ink}}>{ev.client}</span>
            {ev.event_date&&(
              <span style={{fontSize:12,color:C.gray}}>
                {new Date(ev.event_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                {daysUntil>0&&<span style={{marginLeft:6,fontWeight:600,color:daysUntil<=14?'var(--text-danger)':daysUntil<=30?C.amber:C.gray}}>· {daysUntil}d away</span>}
                {daysUntil===0&&<span style={{marginLeft:6,fontWeight:700,color:'var(--text-danger)'}}>· Today!</span>}
                {daysUntil<0&&<span style={{marginLeft:6,color:C.gray}}>· Completed</span>}
              </span>
            )}
            {Number(ev.total)>0&&(
              <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:'auto',flexShrink:0}}>
                {hasOverdue&&<span style={{fontSize:11,color:'var(--text-danger)',fontWeight:600}}>⚠ {fmt(Number(ev.overdue))} overdue</span>}
                <div style={{width:72,height:4,background:C.border,borderRadius:99,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:99,transition:'width 0.3s'}}/>
                </div>
                <span style={{fontSize:11,color:C.gray,whiteSpace:'nowrap'}}>{fmt(Number(ev.total))} · {fmt(Number(ev.paid))} paid</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── UNIFIED TAB BAR — always visible (Improvement 5: More dropdown) ── */}
      <div style={{display:'flex',overflowX:'auto',padding:'0 16px',gap:0,borderBottom:`1px solid ${C.border}`,background:C.white,flexShrink:0,WebkitOverflowScrolling:'touch',scrollbarWidth:'none',position:'relative'}}>
          {(()=>{
            const overdueCount = milestones.filter(m=>m.status==='overdue').length;
            const pendingTaskCount = tasks.filter(t=>!t.done).length;
            const alertTaskCount = tasks.filter(t=>t.alert&&!t.done).length;
            const primaryTabs = [
              { key:'summary',      label:'🏠 Summary',      badge:null,                        badgeRed:false },
              { key:'payments',     label:'💳 Payments',     badge:overdueCount||null,           badgeRed:true },
              { key:'tasks',        label:'✅ Tasks',         badge:pendingTaskCount||null,       badgeRed:alertTaskCount>0 },
              { key:'appointments', label:'📅 Appointments', badge:upcomingAppts.length||null,  badgeRed:false },
              { key:'guests',       label:'👥 Guests',        badge:guestListData.length||null,  badgeRed:false },
            ];
            const secondaryTabs = [
              { key:'planning',   label:'📋 Planning',   badge:null,                       badgeRed:false },
              { key:'notes',      label:'📝 Notes',      badge:notes.length||null,        badgeRed:false },
              { key:'activity',   label:'⚡ Activity',   badge:null,                       badgeRed:false },
              { key:'files',      label:'📎 Files',      badge:files.length||null,        badgeRed:false },
              { key:'vendors',    label:'🤝 Vendors',    badge:null,                       badgeRed:false },
              { key:'decoration', label:'🌸 Decoration', badge:decoItems.length||null,    badgeRed:false },
            ];
            const isSecondaryActive = secondaryTabs.some(t=>t.key===coordTab);
            return (
              <>
                {primaryTabs.map(tab=>(
                  <button key={tab.key} onClick={()=>setCoordTab(tab.key)}
                    style={{flexShrink:0,padding:'12px 14px',border:'none',background:'none',
                      color:coordTab===tab.key?C.rosaText:C.gray,fontSize:12,
                      fontWeight:coordTab===tab.key?600:400,cursor:'pointer',whiteSpace:'nowrap',
                      borderBottom:coordTab===tab.key?`2px solid ${C.rosa}`:'2px solid transparent',
                      marginBottom:-1,display:'flex',alignItems:'center',gap:5}}>
                    {tab.label}
                    {tab.badge!=null&&(
                      <span style={{fontSize:10,fontWeight:700,minWidth:16,height:16,borderRadius:99,
                        background:tab.badgeRed?'var(--color-danger)':coordTab===tab.key?C.rosa:C.border,
                        color:tab.badgeRed||coordTab===tab.key?'#fff':C.gray,
                        display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 4px',lineHeight:1}}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
                {/* More ▾ dropdown */}
                <div ref={moreTabsRef} style={{position:'relative',flexShrink:0}}>
                  <button onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setMoreTabsPos({top:r.bottom+4,right:window.innerWidth-r.right});setShowMoreTabs(s=>!s);}}
                    style={{flexShrink:0,padding:'12px 14px',border:'none',background:'none',
                      color:isSecondaryActive?C.rosaText:C.gray,fontSize:12,
                      fontWeight:isSecondaryActive?600:400,cursor:'pointer',whiteSpace:'nowrap',
                      borderBottom:isSecondaryActive?`2px solid ${C.rosa}`:'2px solid transparent',
                      marginBottom:-1,display:'flex',alignItems:'center',gap:5}}>
                    More ▾
                    {(()=>{
                      const totalSecondaryBadge = secondaryTabs.reduce((s,t)=>s+(t.badge||0),0);
                      if(isSecondaryActive) return <span style={{width:6,height:6,borderRadius:'50%',background:C.rosa,display:'inline-block'}}/>;
                      if(totalSecondaryBadge>0) return <span style={{fontSize:10,fontWeight:700,minWidth:16,height:16,borderRadius:99,background:C.border,color:C.gray,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 4px'}}>{totalSecondaryBadge}</span>;
                      return null;
                    })()}
                  </button>
                  {showMoreTabs&&(
                    <div style={{position:'fixed',top:moreTabsPos.top,right:moreTabsPos.right,background:C.white,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:500,minWidth:160,overflow:'hidden'}}>
                      {secondaryTabs.map(tab=>(
                        <button key={tab.key} onClick={()=>{setCoordTab(tab.key);setShowMoreTabs(false);}}
                          style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',padding:'9px 16px',background:coordTab===tab.key?C.rosaPale:'transparent',border:'none',
                            cursor:'pointer',fontSize:13,textAlign:'left',color:coordTab===tab.key?C.rosaText:C.ink,fontWeight:coordTab===tab.key?600:400}}
                          onMouseEnter={e=>{if(coordTab!==tab.key)e.currentTarget.style.background=C.grayBg;}}
                          onMouseLeave={e=>{if(coordTab!==tab.key)e.currentTarget.style.background='transparent';}}>
                          <span>{tab.label}</span>
                          {tab.badge!=null&&<span style={{fontSize:10,fontWeight:700,minWidth:16,height:16,borderRadius:99,background:coordTab===tab.key?C.rosa:C.border,color:coordTab===tab.key?'#fff':C.gray,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 4px'}}>{tab.badge}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
      </div>

      <div className="page-scroll" style={{flex:1,overflowY:'auto'}}>

        {/* ═══════════════════════════════════════════════════════════════════
            DECORATION TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {coordTab === 'decoration' && (
          <div style={{display:'flex',flexDirection:'column',gap:0}}>
            <div style={{padding:'16px 20px 32px',display:'flex',flexDirection:'column',gap:16,maxWidth:960,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>

              {/* Section 1: Decoration Planner */}
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'#0D9488',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                  <span>🌸</span><span>Decoration Planner</span>
                </div>
                <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'14px 16px'}}>
                  <DecorationPlanner
                    event={liveEvent}
                    updateEvent={updateEvent}
                    addDecoItem={addDecoItem}
                    removeDecoItem={removeDecoItem}
                    updateDecoItem={updateDecoItem}
                    inventory={inventory}
                    refetch={refetchEvent}
                  />
                </div>
              </div>

              {/* Section 2: Inventory / Items */}
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'#0D9488',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                  <span>📦</span><span>Items Assigned to Event</span>
                </div>
                <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                  {decoItems.length === 0 ? (
                    <div style={{padding:'24px',textAlign:'center',fontSize:12,color:C.gray}}>
                      No items assigned yet.
                      <span style={{display:'block',marginTop:4,color:'#0D9488',fontWeight:500,cursor:'pointer'}} onClick={()=>setShowAddService(true)}>+ Assign items via the Decoration Planner above</span>
                    </div>
                  ) : (
                    decoItems.map((item, i) => (
                      <div key={item.id||i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderBottom:i<decoItems.length-1?`1px solid ${C.border}`:'none'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{item.name || item.item_name || '—'}</div>
                          <div style={{fontSize:11,color:C.gray,marginTop:1}}>
                            {item.category && <span style={{textTransform:'capitalize'}}>{item.category.replace(/_/g,' ')}</span>}
                            {item.qty && <span> · Qty: {item.qty}</span>}
                            {item.notes && <span> · {item.notes}</span>}
                          </div>
                        </div>
                        {item.available < item.qty && (
                          <span style={{fontSize:10,padding:'2px 7px',borderRadius:999,background:C.redBg,color:C.red,fontWeight:600,flexShrink:0}}>
                            {item.qty - item.available} short
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Section 3: Day-of Checklist */}
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'#0D9488',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                  <span>✅</span><span>Day-of Checklist</span>
                </div>
                {(()=>{
                  const checkList = dayChecklist||[];
                  const doneCount = checkList.filter(i=>i.done).length;
                  const totalCount = checkList.length;
                  const pctDone = totalCount>0?Math.round((doneCount/totalCount)*100):0;
                  const currentMember = staff.find(s=>s.user_id===boutique?.owner_user_id)||staff[0];
                  const currentUserName = currentMember?.name||myRole||'Staff';
                  return (
                    <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                      <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:13,fontWeight:500,color:C.ink}}>Day-of Checklist</span>
                          {totalCount>0&&<span style={{fontSize:11,color:C.gray}}>{doneCount} / {totalCount} complete{checklistSaving?' · saving…':''}</span>}
                        </div>
                        <button onClick={()=>{if(checkList.length===0){startChecklistWithDefaults();}else{setChecklistAdding(true);}}} style={{fontSize:11,color:'#0D9488',background:'none',border:'none',cursor:'pointer',fontWeight:500,padding:'2px 6px'}}>+ Add item</button>
                      </div>
                      <div style={{padding:'10px 16px'}}>
                        {totalCount>0&&(
                          <div style={{marginBottom:10}}>
                            <div style={{height:5,background:C.border,borderRadius:3,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${pctDone}%`,background:pctDone===100?C.green:'#0D9488',borderRadius:3,transition:'width 0.3s'}}/>
                            </div>
                            <div style={{fontSize:10,color:pctDone===100?C.green:C.gray,marginTop:3,textAlign:'right'}}>{pctDone}%{pctDone===100?' — All done!':''}</div>
                          </div>
                        )}
                        {checkList.length===0&&!checklistAdding&&(
                          <div style={{textAlign:'center',padding:'16px 0',color:C.gray,fontSize:12}}>
                            No checklist items yet.<br/>
                            <span onClick={startChecklistWithDefaults} style={{color:'#0D9488',cursor:'pointer',fontWeight:500}}>+ Add items or load defaults</span>
                          </div>
                        )}
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          {checkList.map((item,idx)=>(
                            <div key={item.id||idx} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'6px 8px',borderRadius:7,background:item.done?C.greenBg:C.grayBg}}>
                              <input type="checkbox" checked={!!item.done} onChange={()=>toggleChecklistItem(idx,currentUserName)} style={{marginTop:2,width:15,height:15,cursor:'pointer',accentColor:'#0D9488',flexShrink:0}}/>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,color:item.done?C.gray:C.ink,textDecoration:item.done?'line-through':'none'}}>{item.text}</div>
                                {item.done&&item.done_at&&(
                                  <div style={{fontSize:10,color:C.gray,marginTop:1}}>
                                    {item.done_by&&<span>{item.done_by} · </span>}
                                    {new Date(item.done_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
                                  </div>
                                )}
                              </div>
                              <button onClick={()=>deleteChecklistItem(idx)} aria-label="Delete checklist item" style={{background:'none',border:'none',color:C.gray,cursor:'pointer',fontSize:14,padding:'4px 8px',lineHeight:1,flexShrink:0,opacity:0.5,minHeight:32,minWidth:32}}>×</button>
                            </div>
                          ))}
                        </div>
                        {checklistAdding&&(
                          <div style={{display:'flex',gap:6,marginTop:8,alignItems:'center'}}>
                            <input autoFocus value={checklistNewText} onChange={e=>setChecklistNewText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addChecklistItem(checklistNewText);if(e.key==='Escape'){setChecklistAdding(false);setChecklistNewText('');}}} placeholder="New checklist item…" style={{flex:1,padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,outline:'none'}}/>
                            <button onClick={()=>addChecklistItem(checklistNewText)} style={{padding:'6px 10px',borderRadius:7,border:'none',background:'#0D9488',color:C.white,cursor:'pointer',fontSize:12,fontWeight:500}}>✓</button>
                            <button onClick={()=>{setChecklistAdding(false);setChecklistNewText('');}} style={{padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.gray,cursor:'pointer',fontSize:12}}>✕</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        )}

        {/* ── TAB PANELS ── */}
        <div className="page-scroll-inner" style={{flex:1,padding:'16px 20px 32px',maxWidth:1100,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>

          {/* SUMMARY TAB */}
          {coordTab === 'summary' && (()=>{
            const nextUnpaid = milestones.filter(m=>m.status!=='paid').sort((a,b)=>{
              if(!a.due_date)return 1; if(!b.due_date)return -1;
              return new Date(a.due_date)-new Date(b.due_date);
            })[0]||null;
            const nextAppt = appointments.filter(a=>a.date&&new Date(a.date+'T00:00')>=new Date()).sort((a,b)=>new Date(a.date)-new Date(b.date))[0]||null;
            const incompleteTasks = tasks.filter(t=>!t.done);
            const alertTasks = incompleteTasks.filter(t=>t.alert);
            const overdueMilestones = milestones.filter(m=>m.status==='overdue');
            const paidMilestones = milestones.filter(m=>m.status==='paid');
            return (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>

                {/* Priority banner — only shown when action needed */}
                {(overdueMilestones.length>0||alertTasks.length>0)&&(
                  <div style={{background:'#FEF2F2',border:'1px solid #FCA5A520',borderRadius:10,padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--text-danger)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Action needed</div>
                    {overdueMilestones.map(m=>(
                      <div key={m.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                        <span style={{fontSize:13,color:'var(--text-danger)'}}>⚠ {m.label} — {fmt(m.amount)} overdue</span>
                        <button onClick={()=>{setPaidForm({method:'Cash',date:new Date().toISOString().slice(0,10)});setShowMarkPaid(m);}} style={{padding:'4px 12px',background:'var(--color-danger)',color:'#fff',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',flexShrink:0}}>Mark paid</button>
                      </div>
                    ))}
                    {alertTasks.map(t=>(
                      <div key={t.id} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text-danger)'}}>
                        <span>🚨</span><span style={{flex:1}}>{t.text}</span>
                        <button onClick={()=>setCoordTab('tasks')} style={{padding:'4px 10px',background:'transparent',border:'1px solid var(--color-danger)',color:'var(--text-danger)',borderRadius:6,fontSize:11,cursor:'pointer',flexShrink:0}}>View tasks</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Improvement 6: Smart "Next action" prompt */}
                {(()=>{
                  const daysLeft = daysUntil;
                  const missingAppts = appointments.filter(a=>a.status==='missing');
                  const nextMilestone = milestones.filter(m=>m.status!=='paid').sort((a,b)=>new Date(a.due_date||'9999')-new Date(b.due_date||'9999'))[0];
                  const alertPendingTasks = tasks.filter(t=>t.alert&&!t.done);

                  let prompt = null;
                  if (daysLeft > 0 && daysLeft <= 30 && missingAppts.length > 0) {
                    prompt = { text: `${daysLeft}d until event — ${missingAppts[0].type?.replace(/_/g,' ')||'appointment'} not yet scheduled`, action: 'Schedule', onAction: ()=>setShowScheduleAppt(true), color: 'var(--text-warning)' };
                  } else if (nextMilestone && nextMilestone.status==='overdue') {
                    prompt = null; // covered by priority banner
                  } else if (nextMilestone && nextMilestone.due_date) {
                    const daysToPayment = Math.round((new Date(nextMilestone.due_date+'T12:00:00')-new Date())/86400000);
                    if (daysToPayment <= 7 && daysToPayment >= 0) {
                      prompt = { text: `${nextMilestone.label} due in ${daysToPayment}d — ${fmt(Number(nextMilestone.amount))}`, action: 'Remind client', onAction: ()=>setCoordTab('payments'), color: C.rosaText };
                    }
                  } else if (alertPendingTasks.length > 0) {
                    prompt = { text: `${alertPendingTasks.length} alert task${alertPendingTasks.length>1?'s':''} need attention`, action: 'View tasks', onAction: ()=>setCoordTab('tasks'), color: 'var(--text-danger)' };
                  } else if (daysLeft > 0 && daysLeft <= 7) {
                    prompt = { text: `Event in ${daysLeft} day${daysLeft>1?'s':''}`, action: 'Day-of schedule', onAction: ()=>setShowDayOf(true), color: 'var(--text-danger)' };
                  }

                  if (!prompt) return null;
                  return (
                    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:C.grayBg,border:`1px solid ${C.border}`}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:prompt.color,flexShrink:0}}/>
                      <span style={{flex:1,fontSize:12,color:C.ink}}>{prompt.text}</span>
                      <button onClick={prompt.onAction} style={{padding:'4px 12px',borderRadius:20,background:prompt.color,color:'#fff',border:'none',fontSize:11,fontWeight:600,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>{prompt.action}</button>
                    </div>
                  );
                })()}

                {/* Event info strip — Improvement 1 (inline edit) + Improvement 2 (service chips) */}
                <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}>
                    <EventTypeBadge type={ev.type}/>
                    {ev.venue&&<span style={{fontSize:12,color:C.gray}}>📍 {ev.venue}</span>}
                    {ev.guests&&<span style={{fontSize:12,color:C.gray}}>👥 ~{ev.guests} guests</span>}
                    {ev.services?.length>0&&(
                      showServicesExpanded ? (
                        <>
                          {ev.services.map(s=>(
                            <span key={s} style={{fontSize:11,padding:'2px 8px',borderRadius:999,background:C.rosaPale,color:C.rosaText,fontWeight:500}}>{SVC_LABELS[s]||s}</span>
                          ))}
                          <span onClick={()=>setShowServicesExpanded(false)} style={{fontSize:11,color:C.gray,cursor:'pointer',textDecoration:'underline',whiteSpace:'nowrap'}}>▴ hide</span>
                        </>
                      ) : (
                        <span onClick={()=>setShowServicesExpanded(true)} style={{fontSize:11,padding:'3px 10px',borderRadius:999,background:C.rosaPale,color:C.rosaText,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>Services ({ev.services.length}) ▾</span>
                      )
                    )}
                    <span style={{fontSize:11,padding:'3px 9px',borderRadius:999,background:ev.status==='completed'?C.greenBg:ev.status==='cancelled'?C.redBg:C.rosaPale,color:ev.status==='completed'?C.green:ev.status==='cancelled'?C.red:C.rosaText,fontWeight:600}}>
                      {ev.status==='completed'?'Completed':ev.status==='cancelled'?'Cancelled':'Active'}
                    </span>
                    {ev.coordinator_id && staff.find(s=>s.user_id===ev.coordinator_id) && (
                      <span style={{fontSize:11,color:C.gray,display:'flex',alignItems:'center',gap:4}}>
                        <div style={{width:18,height:18,borderRadius:'50%',background:C.rosaPale,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:C.rosaText}}>
                          {(staff.find(s=>s.user_id===ev.coordinator_id)?.name||'?').slice(0,1).toUpperCase()}
                        </div>
                        {staff.find(s=>s.user_id===ev.coordinator_id)?.name}
                      </span>
                    )}
                    <button onClick={()=>{setEventInfoDraft({event_date:ev.event_date||'',venue:ev.venue||'',guests:ev.guests||'',status:ev.status||'active',coordinator_id:ev.coordinator_id||''});setEditingEventInfo(e=>!e);}} style={{marginLeft:'auto',fontSize:11,color:C.rosaText,background:'none',border:`1px solid ${C.rosa}`,borderRadius:6,padding:'3px 10px',cursor:'pointer',fontWeight:500,flexShrink:0}}>✏ Edit</button>
                  </div>
                  {editingEventInfo&&(
                    <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:10,borderTop:`1px solid ${C.border}`,paddingTop:12}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                        <div>
                          <div style={{fontSize:11,fontWeight:500,color:C.gray,marginBottom:3}}>Event date</div>
                          <input type="date" value={eventInfoDraft.event_date||''} onChange={e=>setEventInfoDraft(d=>({...d,event_date:e.target.value}))} style={{width:'100%',padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,boxSizing:'border-box'}}/>
                        </div>
                        <div>
                          <div style={{fontSize:11,fontWeight:500,color:C.gray,marginBottom:3}}>Status</div>
                          <select value={eventInfoDraft.status||'active'} onChange={e=>setEventInfoDraft(d=>({...d,status:e.target.value}))} style={{width:'100%',padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,boxSizing:'border-box'}}>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:500,color:C.gray,marginBottom:3}}>Venue</div>
                        <input value={eventInfoDraft.venue||''} onChange={e=>setEventInfoDraft(d=>({...d,venue:e.target.value}))} placeholder="Venue name or address" style={{width:'100%',padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,boxSizing:'border-box'}}/>
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:500,color:C.gray,marginBottom:3}}>Guest count</div>
                        <input type="number" value={eventInfoDraft.guests||''} onChange={e=>setEventInfoDraft(d=>({...d,guests:e.target.value}))} placeholder="e.g. 150" style={{width:'100%',padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,boxSizing:'border-box'}}/>
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:500,color:C.gray,marginBottom:3}}>Coordinator</div>
                        <select value={eventInfoDraft.coordinator_id||''} onChange={e=>setEventInfoDraft(d=>({...d,coordinator_id:e.target.value}))} style={{width:'100%',padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,boxSizing:'border-box'}}>
                          <option value="">— Unassigned —</option>
                          {staff.map(s=><option key={s.user_id} value={s.user_id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                        <button onClick={()=>setEditingEventInfo(false)} style={{padding:'6px 14px',borderRadius:7,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:12,cursor:'pointer'}}>Cancel</button>
                        <button onClick={async()=>{await updateEvent(ev.id,{event_date:eventInfoDraft.event_date||null,venue:eventInfoDraft.venue||null,guests:Number(eventInfoDraft.guests)||null,status:eventInfoDraft.status,coordinator_id:eventInfoDraft.coordinator_id||null});await refetchEvent();setEditingEventInfo(false);toast('Event updated ✓');}} style={{padding:'6px 16px',borderRadius:7,border:'none',background:C.rosa,color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>Save</button>
                      </div>
                    </div>
                  )}
                </div>


                {/* Event Readiness Score */}
                {(()=>{
                  const totalTasks = tasks.length;
                  const doneTasks = tasks.filter(t=>t.done).length;
                  const totalMs = milestones.length;
                  const paidMs = milestones.filter(m=>m.status==='paid').length;
                  const totalAppts = appointments.filter(a=>a.status!=='missing').length + appointments.filter(a=>a.status==='missing').length;
                  const scheduledAppts = appointments.filter(a=>a.status!=='missing').length;
                  const hasSigned = contracts.some(c=>c.signed_at);
                  const hasDress = ev.services?.includes('dress_rental') ? eventDresses.length > 0 : null;

                  let score = 0;
                  let total = 0;

                  if (totalTasks > 0) { score += (doneTasks/totalTasks)*30; total += 30; } else { score += 30; total += 30; }
                  if (totalMs > 0) { score += (paidMs/totalMs)*30; total += 30; } else { score += 30; total += 30; }
                  if (totalAppts > 0) { score += (scheduledAppts/totalAppts)*20; total += 20; } else { score += 20; total += 20; }
                  score += hasSigned ? 10 : 0; total += 10;
                  if (hasDress !== null) { score += hasDress ? 10 : 0; total += 10; }

                  const pct = total > 0 ? Math.round((score/total)*100) : 100;
                  const color = pct >= 80 ? 'var(--text-success)' : pct >= 50 ? C.amber : 'var(--text-danger)';
                  const label = pct >= 80 ? 'Ready' : pct >= 50 ? 'In progress' : 'Needs attention';

                  const checks = [
                    { label: `Tasks (${doneTasks}/${totalTasks||0} done)`, ok: totalTasks===0||doneTasks===totalTasks },
                    { label: `Payments (${paidMs}/${totalMs||0} paid)`, ok: totalMs===0||paidMs===totalMs },
                    { label: `Appointments (${scheduledAppts} scheduled)`, ok: totalAppts===0||scheduledAppts===totalAppts },
                    { label: hasSigned ? 'Contract signed' : 'No contract signed', ok: hasSigned },
                    ...(hasDress !== null ? [{ label: hasDress ? 'Dress assigned' : 'No dress assigned', ok: hasDress }] : []),
                  ];

                  const timelineStages = [
                    { label:'Booked', done:true },
                    { label:'Measurements', done:appointments.some(a=>a.type==='measurements'&&a.status!=='missing') },
                    { label:'Fitting', done:appointments.some(a=>a.type==='fitting'&&a.status!=='missing') },
                    { label:'Paid in full', done:milestones.length > 0 && milestones.every(m=>m.status==='paid') },
                    { label:'Event day', done:daysUntil === 0 || ev.status === 'completed' },
                    { label:'Complete', done:ev.status === 'completed' },
                  ];
                  const timelineCurrentIdx = timelineStages.reduce((last, s, i) => s.done ? i : last, -1);

                  return (
                    <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,padding:'14px 16px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:14}}>
                        <div style={{position:'relative',width:56,height:56,flexShrink:0}}>
                          <svg width={56} height={56} style={{transform:'rotate(-90deg)'}}>
                            <circle cx={28} cy={28} r={22} fill="none" stroke={C.border} strokeWidth={5}/>
                            <circle cx={28} cy={28} r={22} fill="none" stroke={color} strokeWidth={5}
                              strokeDasharray={`${(pct/100)*2*Math.PI*22} ${2*Math.PI*22}`} strokeLinecap="round"/>
                          </svg>
                          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                            <span style={{fontSize:13,fontWeight:700,color,lineHeight:1}}>{pct}%</span>
                          </div>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:C.ink,marginBottom:6}}>Event Readiness <span style={{fontSize:11,padding:'2px 8px',borderRadius:999,background:pct>=80?C.greenBg:pct>=50?'#FEF9C3':'var(--bg-danger)',color,marginLeft:4,fontWeight:600}}>{label}</span></div>
                          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                            {checks.map((c,i)=>(
                              <span key={i} style={{fontSize:11,color:c.ok?'var(--text-success)':C.gray,display:'flex',alignItems:'center',gap:3}}>
                                <span style={{color:c.ok?'var(--text-success)':'var(--text-danger)'}}>{c.ok?'✓':'✗'}</span> {c.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Event Timeline Stepper — merged into readiness card */}
                      <div style={{borderTop:`1px solid ${C.border}`,marginTop:12,paddingTop:12}}>
                        <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Event Timeline</div>
                        <div style={{display:'flex',alignItems:'flex-start',gap:0}}>
                          {timelineStages.map((s,i)=>{
                            const isDone = s.done;
                            const isCurrent = i === timelineCurrentIdx + 1 && !isDone;
                            return (
                              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',position:'relative'}}>
                                {i < timelineStages.length-1 && (
                                  <div style={{position:'absolute',top:10,left:'50%',width:'100%',height:2,background:isDone?C.rosa:C.border,zIndex:0}}/>
                                )}
                                <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${isDone?C.rosa:isCurrent?C.rosa:C.border}`,background:isDone?C.rosa:isCurrent?C.rosaPale:C.white,display:'flex',alignItems:'center',justifyContent:'center',zIndex:1,flexShrink:0}}>
                                  {isDone && <span style={{fontSize:10,color:C.white,fontWeight:700}}>✓</span>}
                                  {isCurrent && <div style={{width:8,height:8,borderRadius:'50%',background:C.rosa}}/>}
                                </div>
                                <div style={{fontSize:9,color:isDone?C.rosaText:isCurrent?C.rosaText:C.gray,fontWeight:isDone||isCurrent?600:400,textAlign:'center',marginTop:4,lineHeight:1.2,maxWidth:52}}>{s.label}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 2-col grid */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>

                  {/* Payments card */}
                  <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                    <div style={{padding:'11px 16px',borderBottom:collapsedCards['pay']?'none':`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <CollapseBtn cardKey="pay"/>
                        <span style={{fontSize:13,fontWeight:600,color:C.ink}}>💳 Payments</span>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <button onClick={()=>setShowAddMilestone(true)} style={{fontSize:11,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:500}}>+ Add</button>
                      </div>
                    </div>
                    {!collapsedCards['pay'] && (
                      <>
                        {milestones.length===0?(
                          <div style={{padding:'14px 16px',fontSize:12,color:C.gray,textAlign:'center'}}>No milestones yet. <span onClick={()=>setCoordTab('payments')} style={{color:C.rosaText,cursor:'pointer'}}>Add one →</span></div>
                        ):(
                          <>
                            {milestones.length > 0 && (
                              <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`}}>
                                <FinancialRing total={ev.total} paid={ev.paid} milestones={milestones} />
                              </div>
                            )}
                            {milestones.filter(m=>m.status!=='paid').slice(0,4).map((m,i)=>{
                              const ms=m.status||'pending';
                              return(
                                <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:`1px solid ${C.border}`}}>
                                  <div style={{width:7,height:7,borderRadius:'50%',background:ms==='overdue'?'var(--color-danger)':C.rosa,flexShrink:0}}/>
                                  <span style={{flex:1,fontSize:12,color:ms==='overdue'?'var(--text-danger)':C.ink,fontWeight:ms==='overdue'?600:400}}>{m.label}</span>
                                  <span style={{fontSize:12,fontWeight:500,color:ms==='overdue'?'var(--text-danger)':C.ink}}>{fmt(Number(m.amount))}</span>
                                  {ms==='overdue'&&<button onClick={()=>{setPaidForm({method:'Cash',date:new Date().toISOString().slice(0,10)});setShowMarkPaid(m);}} style={{padding:'3px 8px',background:C.rosa,color:'#fff',border:'none',borderRadius:5,fontSize:10,fontWeight:600,cursor:'pointer',flexShrink:0}}>Pay</button>}
                                </div>
                              );
                            })}
                            {paidMilestones.length>0&&(
                              paidMilestones.slice(0,2).map((m,i)=>(
                                <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 16px',borderBottom:`1px solid ${C.border}`}}>
                                  <span style={{fontSize:12,color:C.green}}>✓</span>
                                  <span style={{flex:1,fontSize:12,color:C.gray}}>{m.label}</span>
                                  <span style={{fontSize:12,color:C.gray}}>{fmt(Number(m.amount))}</span>
                                  <button onClick={()=>setShowReceipt(m)} style={{fontSize:10,color:C.rosaText,background:'none',border:`1px solid ${C.border}`,borderRadius:5,padding:'2px 7px',cursor:'pointer',flexShrink:0}}>Receipt</button>
                                </div>
                              ))
                            )}
                            {paidMilestones.length>2&&(
                              <div style={{padding:'7px 16px',fontSize:11,color:C.gray}}>+ {paidMilestones.length-2} more paid</div>
                            )}
                            {milestones.filter(m=>m.status!=='paid').length===0&&(
                              <div style={{padding:'12px 16px',fontSize:12,color:'var(--text-success)',display:'flex',alignItems:'center',gap:6}}>✅ All paid — {fmt(Number(ev.total))} collected</div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Tasks card */}
                  <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                    <div style={{padding:'11px 16px',borderBottom:collapsedCards['tasks']?'none':`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <CollapseBtn cardKey="tasks"/>
                        <span style={{fontSize:13,fontWeight:600,color:C.ink}}>✅ Tasks</span>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <button onClick={()=>setShowQuickTask(s=>!s)} style={{fontSize:11,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:500}}>+ Add</button>
                      </div>
                    </div>
                    {!collapsedCards['tasks'] && (
                      <>
                        {showQuickTask && (
                          <div style={{padding:'10px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',gap:6,alignItems:'center'}}>
                            <input
                              autoFocus
                              value={quickTaskText}
                              onChange={e=>setQuickTaskText(e.target.value)}
                              onKeyDown={async e=>{
                                if(e.key==='Enter'&&quickTaskText.trim()){
                                  await addTask({text:quickTaskText.trim(),category:'General',alert:false});
                                  setQuickTaskText('');setShowQuickTask(false);toast('Task added');
                                }
                                if(e.key==='Escape'){setShowQuickTask(false);setQuickTaskText('');}
                              }}
                              placeholder="Task description… (Enter to save)"
                              style={{flex:1,padding:'5px 9px',borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,outline:'none'}}
                            />
                            <button onClick={async()=>{if(!quickTaskText.trim())return;await addTask({text:quickTaskText.trim(),category:'General',alert:false});setQuickTaskText('');setShowQuickTask(false);toast('Task added');}} style={{padding:'5px 10px',borderRadius:6,border:'none',background:C.rosa,color:'#fff',fontSize:12,cursor:'pointer',fontWeight:500}}>✓</button>
                            <button onClick={()=>{setShowQuickTask(false);setQuickTaskText('');}} style={{padding:'5px 8px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:12,cursor:'pointer'}}>✕</button>
                          </div>
                        )}
                        {incompleteTasks.length===0?(
                          <div style={{padding:'14px 16px',fontSize:12,color:'var(--text-success)',display:'flex',alignItems:'center',gap:6}}>✅ All done</div>
                        ):(
                          incompleteTasks.slice(0,5).map((t,i)=>(
                            <div key={t.id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:i<Math.min(incompleteTasks.length,5)-1?`1px solid ${C.border}`:'none'}}>
                              <input type="checkbox" checked={false} onChange={()=>toggleTask(tasks.indexOf(t))} style={{width:14,height:14,cursor:'pointer',accentColor:C.rosa,flexShrink:0}}/>
                              <span style={{flex:1,fontSize:12,color:t.alert?'var(--text-danger)':C.ink,fontWeight:t.alert?600:400}}>{t.alert?'🚨 ':''}{t.text}</span>
                              {t.category&&<span style={{fontSize:10,color:C.gray}}>{t.category}</span>}
                            </div>
                          ))
                        )}
                        {incompleteTasks.length>5&&(
                          <div style={{padding:'7px 16px',fontSize:11,color:C.gray}}>+{incompleteTasks.length-5} more tasks <span onClick={()=>setCoordTab('tasks')} style={{color:C.rosaText,cursor:'pointer'}}>→</span></div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Appointments card */}
                  <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                    <div style={{padding:'11px 16px',borderBottom:collapsedCards['appts']?'none':`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <CollapseBtn cardKey="appts"/>
                        <span style={{fontSize:13,fontWeight:600,color:C.ink}}>📅 Appointments</span>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <button onClick={()=>setShowScheduleAppt(true)} style={{fontSize:11,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:500}}>+ Schedule</button>
                      </div>
                    </div>
                    {!collapsedCards['appts'] && (
                      <>
                        {appointments.length===0?(
                          <div style={{padding:'14px 16px',fontSize:12,color:C.gray,textAlign:'center'}}>None scheduled. <span onClick={()=>setShowScheduleAppt(true)} style={{color:C.rosaText,cursor:'pointer'}}>+ Schedule →</span></div>
                        ):(
                          appointments.slice(0,4).map((a,i)=>{
                            const st=a.status||'scheduled';
                            const isPast=st==='done';
                            const isMissing=st==='missing';
                            return(
                              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:i<Math.min(appointments.length,4)-1?`1px solid ${C.border}`:'none',opacity:isPast?0.55:1}}>
                                <div style={{width:7,height:7,borderRadius:'50%',background:isMissing?'var(--color-danger)':isPast?C.border:C.rosa,border:isPast?`1.5px solid ${C.border}`:'none',flexShrink:0}}/>
                                <span style={{flex:1,fontSize:12,color:isMissing?'var(--color-danger)':C.ink,fontWeight:isMissing?600:400}}>{(a.type||'Appointment').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span>
                                <span style={{fontSize:11,color:C.gray}}>{fmtApptDate(a.date,a.time)}</span>
                                {isMissing&&<span onClick={()=>setShowScheduleAppt(true)} style={{fontSize:10,color:C.rosaText,cursor:'pointer',fontWeight:500,flexShrink:0}}>Schedule →</span>}
                              </div>
                            );
                          })
                        )}
                        {appointments.length>4&&<div style={{padding:'7px 16px',fontSize:11,color:C.gray}}>+{appointments.length-4} more</div>}
                        {appointments.length>0&&<div style={{padding:'7px 16px',borderTop:`1px solid ${C.border}`}}><span onClick={()=>setCoordTab('appointments')} style={{fontSize:11,color:C.rosaText,cursor:'pointer',fontWeight:500}}>View all →</span></div>}
                      </>
                    )}
                  </div>

                  {/* Client quick-contact card — paired with Appointments in 2-col layout */}
                  {ev.client && (
                    <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                      <div style={{padding:'11px 16px',borderBottom:collapsedCards['client']?'none':`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <CollapseBtn cardKey="client"/>
                          <span style={{fontSize:13,fontWeight:600,color:C.ink}}>👤 Client</span>
                        </div>
                      </div>
                      {!collapsedCards['client'] && <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.ink}}>{ev.client}</div>
                        {ev.clientData?.partner_name && (
                          <div style={{fontSize:11,color:C.gray}}>Partner: {ev.clientData.partner_name}</div>
                        )}
                        {ev.clientData?.phone && (
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:12,color:C.ink,flex:1}}>📞 {ev.clientData.phone}</span>
                            <button onClick={()=>copyField(ev.clientData.phone,'phone')} style={{padding:'3px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:11,cursor:'pointer',fontWeight:500,flexShrink:0}}>
                              {copiedField==='phone'?'Copied!':'Copy'}
                            </button>
                          </div>
                        )}
                        {ev.clientData?.email && (
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:12,color:C.ink,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>✉️ {ev.clientData.email}</span>
                            <button onClick={()=>copyField(ev.clientData.email,'email')} style={{padding:'3px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:11,cursor:'pointer',fontWeight:500,flexShrink:0}}>
                              {copiedField==='email'?'Copied!':'Copy'}
                            </button>
                          </div>
                        )}
                        {ev.clientData?.phone && (
                          <div style={{marginTop:4}}>
                            {!showSmsInput ? (
                              <button onClick={()=>setShowSmsInput(true)} style={{width:'100%',padding:'6px 12px',borderRadius:7,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:11,fontWeight:500,cursor:'pointer',textAlign:'center'}}>
                                💬 Send SMS
                              </button>
                            ) : (
                              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                <textarea
                                  autoFocus
                                  rows={2}
                                  value={smsText}
                                  onChange={e=>setSmsText(e.target.value)}
                                  placeholder={`Message to ${ev.client}…`}
                                  style={{width:'100%',padding:'7px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,fontFamily:'inherit',resize:'none',boxSizing:'border-box',outline:'none'}}
                                />
                                <div style={{display:'flex',gap:6}}>
                                  <button onClick={async()=>{
                                    if(!smsText.trim())return;
                                    setSendingSms(true);
                                    await sendSms(smsText.trim());
                                    setSmsText('');setShowSmsInput(false);setSendingSms(false);
                                    toast('SMS sent ✓');
                                  }} disabled={sendingSms||!smsText.trim()} style={{flex:1,padding:'6px',borderRadius:7,border:'none',background:C.rosa,color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                                    {sendingSms?'Sending…':'Send'}
                                  </button>
                                  <button onClick={()=>{setShowSmsInput(false);setSmsText('');}} style={{padding:'6px 12px',borderRadius:7,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:12,cursor:'pointer'}}>Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <button onClick={()=>toast('Navigate to Clients from the sidebar')} style={{marginTop:4,padding:'6px 12px',borderRadius:7,border:`1px solid ${C.border}`,background:'transparent',color:C.rosaText,fontSize:11,fontWeight:500,cursor:'pointer',textAlign:'left'}}>
                          View client profile →
                        </button>
                      </div>}
                    </div>
                  )}

                  {/* Quick note card */}
                  <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,padding:'11px 16px',gridColumn:'1 / -1'}}>
                    <div onClick={()=>toggleCard('quicknote')} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',userSelect:'none'}}>
                      <span style={{fontSize:13,fontWeight:600,color:C.ink}}>📝 Quick note</span>
                      <span style={{fontSize:11,color:C.gray,marginLeft:'auto'}}>{collapsedCards['quicknote']?'▾':'▴'}</span>
                    </div>
                    {collapsedCards['quicknote'] && (
                      <div style={{marginTop:10}}>
                        <textarea
                          rows={4}
                          value={overviewNote}
                          onChange={e=>setOverviewNote(e.target.value)}
                          onBlur={()=>{if(overviewNote.trim())saveOverviewNote();}}
                          placeholder="Add a note for this event…"
                          style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px',fontSize:12,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box',color:C.ink,outline:'none'}}
                        />
                        {overviewNote.trim()&&(
                          <button onClick={saveOverviewNote} disabled={overviewNoteSaving} style={{marginTop:6,padding:'5px 12px',borderRadius:7,border:'none',background:C.rosa,color:C.white,fontSize:12,fontWeight:500,cursor:'pointer'}}>
                            {overviewNoteSaving?'Saving…':'Save note'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dress card — shown when dress_rental service is selected */}
                  {ev.services?.includes('dress_rental') && (
                    <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                      <div style={{padding:'11px 16px',borderBottom:collapsedCards['dress']?'none':`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <CollapseBtn cardKey="dress"/>
                          <span style={{fontSize:13,fontWeight:600,color:C.ink}}>👗 Dress</span>
                        </div>
                        <button onClick={()=>setDressSuggestionsOpen(true)} style={{fontSize:11,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:500}}>Suggest</button>
                      </div>
                      {!collapsedCards['dress'] && (
                        <>
                          {eventDresses.length === 0 ? (
                            <div style={{padding:'16px',textAlign:'center',color:C.gray,fontSize:12}}>
                              No dress assigned yet.
                              <div style={{marginTop:4}}><span onClick={()=>setDressSuggestionsOpen(true)} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>+ Suggest a dress →</span></div>
                            </div>
                          ) : (
                            eventDresses.map((ei,i) => (
                              <div key={ei.id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:i<eventDresses.length-1?`1px solid ${C.border}`:'none'}}>
                                <span style={{fontSize:18}}>👗</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:12,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ei.inventory?.name||'Dress'}</div>
                                  <div style={{fontSize:10,color:C.gray}}>{ei.inventory?.sku||''}{ei.inventory?.size?` · Size ${ei.inventory.size}`:''}{ei.inventory?.color?` · ${ei.inventory.color}`:''}</div>
                                </div>
                                <span style={{fontSize:10,padding:'2px 7px',borderRadius:999,background:C.rosaPale,color:C.rosaText,fontWeight:500}}>{ei.inventory?.category?.replace(/_/g,' ')||''}</span>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Wedding-specific: Bridal party card */}
                  {ev?.type === 'wedding' && (
                    <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden',gridColumn:'1 / -1'}}>
                      <div style={{padding:'11px 16px',borderBottom:collapsedCards['party']?'none':`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <CollapseBtn cardKey="party"/>
                          <span style={{fontSize:13,fontWeight:600,color:C.ink}}>💐 Bridal Party</span>
                        </div>
                        <button onClick={()=>setShowAddPartyMember(true)} style={{fontSize:11,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:500}}>+ Add</button>
                      </div>
                      {!collapsedCards['party'] && (
                        <>
                          {bridalMembers.length === 0 ? (
                            <div style={{padding:'16px',textAlign:'center',color:C.gray,fontSize:12}}>
                              No bridal party members yet.
                              <div style={{marginTop:4}}><span onClick={()=>setShowAddPartyMember(true)} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>+ Add member →</span></div>
                            </div>
                          ) : (
                            <>
                              {bridalMembers.slice(0,4).map((m,i)=>(
                                <div key={m.id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:i<Math.min(bridalMembers.length,4)-1?`1px solid ${C.border}`:'none'}}>
                                  <div style={{width:28,height:28,borderRadius:'50%',background:C.rosaPale,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600,color:C.rosaText,flexShrink:0}}>
                                    {(m.name||'?').slice(0,1).toUpperCase()}
                                  </div>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:12,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</div>
                                    <div style={{fontSize:10,color:C.gray,textTransform:'capitalize'}}>{m.role?.replace(/_/g,' ')||''}{m.dress_size?` · Size ${m.dress_size}`:''}</div>
                                  </div>
                                  {m.fitting_date&&<span style={{fontSize:10,color:C.gray,flexShrink:0}}>{new Date(m.fitting_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
                                </div>
                              ))}
                              {bridalMembers.length > 4 && <div style={{padding:'7px 16px',fontSize:11,color:C.gray}}>+{bridalMembers.length-4} more members</div>}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Quince-specific: Court of Honor + details */}
                  {ev?.type === 'quince' && (
                    <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden',gridColumn:'1 / -1'}}>
                      <div style={{padding:'11px 16px',borderBottom:`1px solid ${C.border}`}}>
                        <span style={{fontSize:13,fontWeight:600,color:C.ink}}>👑 Quinceañera Details</span>
                      </div>
                      <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                        {ev.quince_theme && (
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12}}>
                            <span style={{color:C.gray}}>Theme</span>
                            <span style={{color:C.ink,fontWeight:500}}>{ev.quince_theme}</span>
                          </div>
                        )}
                        {ev.quince_waltz_song && (
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12}}>
                            <span style={{color:C.gray}}>🎵 Waltz song</span>
                            <span style={{color:C.ink,fontWeight:500,textAlign:'right',maxWidth:'60%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.quince_waltz_song}</span>
                          </div>
                        )}
                        {(ev.quince_cort_size_damas || ev.quince_cort_size_chambelanes) && (
                          <div style={{display:'flex',gap:16,marginTop:4}}>
                            {ev.quince_cort_size_damas && (
                              <div style={{flex:1,textAlign:'center',padding:'8px',background:C.rosaPale,borderRadius:8}}>
                                <div style={{fontSize:18,fontWeight:700,color:C.rosaText}}>{ev.quince_cort_size_damas}</div>
                                <div style={{fontSize:10,color:C.gray}}>Damas</div>
                              </div>
                            )}
                            {ev.quince_cort_size_chambelanes && (
                              <div style={{flex:1,textAlign:'center',padding:'8px',background:C.grayBg,borderRadius:8}}>
                                <div style={{fontSize:18,fontWeight:700,color:C.ink}}>{ev.quince_cort_size_chambelanes}</div>
                                <div style={{fontSize:10,color:C.gray}}>Chambelanes</div>
                              </div>
                            )}
                          </div>
                        )}
                        {!ev.quince_theme && !ev.quince_waltz_song && !ev.quince_cort_size_damas && (
                          <div style={{fontSize:12,color:C.gray,textAlign:'center',padding:'8px 0'}}>
                            No details yet. <span onClick={()=>{setEventInfoDraft({event_date:ev.event_date||'',venue:ev.venue||'',guests:ev.guests||'',status:ev.status||'active',coordinator_id:ev.coordinator_id||''});setEditingEventInfo(true);}} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>Edit event →</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inspiration panel */}
                  {(ev.inspiration_colors?.length > 0 || ev.inspiration_styles?.length > 0 || ev.inspiration_notes || ev.inspiration_florals) && (
                    <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden',gridColumn:'1 / -1'}}>
                      <div style={{padding:'11px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:13,fontWeight:600,color:C.ink}}>✨ Inspiration</span>
                        <button onClick={()=>{setInspoForm({themes:ev.inspiration_styles||[],vision:ev.inspiration_notes||'',florals:ev.inspiration_florals||''});setShowEditInspiration(true);}} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>Edit →</button>
                      </div>
                      <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
                        {ev.inspiration_colors?.length > 0 && (
                          <div>
                            <div style={{fontSize:10,color:C.gray,marginBottom:6,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.04em'}}>Colors</div>
                            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                              {ev.inspiration_colors.map((c,i)=>{
                                const colorVal = typeof c === 'object' ? (c.hex||c.value||c.label) : c;
                                const colorLabel = typeof c === 'object' ? (c.label||c.name||colorVal) : c;
                                return (
                                  <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
                                    <div style={{width:16,height:16,borderRadius:'50%',background:colorVal,border:`1px solid ${C.border}`,flexShrink:0}}/>
                                    <span style={{fontSize:11,color:C.gray}}>{colorLabel}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {ev.inspiration_styles?.length > 0 && (
                          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                            {ev.inspiration_styles.map((s,i)=>{
                              const label = typeof s === 'object' ? (s.label||s.name||s) : s;
                              return <span key={i} style={{fontSize:11,padding:'2px 8px',borderRadius:999,background:C.rosaPale,color:C.rosaText,fontWeight:500}}>{label}</span>;
                            })}
                          </div>
                        )}
                        {ev.inspiration_notes && <div style={{fontSize:12,color:C.ink,lineHeight:1.4}}>{ev.inspiration_notes}</div>}
                        {ev.inspiration_florals && <div style={{fontSize:12,color:C.gray}}>🌸 {ev.inspiration_florals}</div>}
                      </div>
                    </div>
                  )}

                  {/* Alteration status card */}
                  {alteration && ev.services?.includes('alterations') && (
                    <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                      <div style={{padding:'11px 16px',borderBottom:collapsedCards['alt']?'none':`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <CollapseBtn cardKey="alt"/>
                          <span style={{fontSize:13,fontWeight:600,color:C.ink}}>✂️ Alterations</span>
                        </div>
                        <button onClick={()=>setCoordTab('alteration')} style={{fontSize:11,color:C.gray,background:'none',border:'none',cursor:'pointer'}}>View →</button>
                      </div>
                      {!collapsedCards['alt'] && (
                        <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <span style={{fontSize:12,color:C.ink,fontWeight:500}}>{alteration.garment||'Garment'}</span>
                            {(()=>{
                              const s = alteration.status||'pending';
                              const cfg = {pending:{bg:C.grayBg,col:C.gray},in_progress:{bg:'var(--bg-info)',col:'var(--color-info)'},fitting_scheduled:{bg:'var(--bg-warning)',col:'var(--color-warning)'},complete:{bg:C.greenBg,col:C.green}}[s]||{bg:C.grayBg,col:C.gray};
                              return <span style={{fontSize:10,padding:'2px 8px',borderRadius:999,background:cfg.bg,color:cfg.col,fontWeight:600,textTransform:'capitalize'}}>{s.replace(/_/g,' ')}</span>;
                            })()}
                          </div>
                          {alteration.seamstress_id && staff.find(s=>s.user_id===alteration.seamstress_id) && (
                            <div style={{fontSize:11,color:C.gray}}>👩‍🧵 {staff.find(s=>s.user_id===alteration.seamstress_id)?.name||'Seamstress'}</div>
                          )}
                          {alteration.deadline && (
                            <div style={{fontSize:11,color:C.gray}}>📅 Due {new Date(alteration.deadline+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                          )}
                          {alteration.price && (
                            <div style={{fontSize:11,color:C.gray}}>💲 {fmt(Number(alteration.price))}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contract status card */}
                  <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                    <div style={{padding:'11px 16px',borderBottom:collapsedCards['contract']?'none':`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <CollapseBtn cardKey="contract"/>
                        <span style={{fontSize:13,fontWeight:600,color:C.ink}}>📄 Contract</span>
                      </div>
                      <button onClick={()=>setShowContractModal(true)} style={{fontSize:11,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:500}}>+ New</button>
                    </div>
                    {!collapsedCards['contract'] && (
                      <>
                        {contracts.length === 0 ? (
                          <div style={{padding:'16px',textAlign:'center',color:C.gray,fontSize:12}}>
                            No contracts yet.
                            <div style={{marginTop:4}}><span onClick={()=>setShowContractModal(true)} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>+ Create contract →</span></div>
                          </div>
                        ) : (
                          contracts.slice(0,3).map((c,i)=>{
                            const signed = !!c.signed_at;
                            return (
                              <div key={c.id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 16px',borderBottom:i<Math.min(contracts.length,3)-1?`1px solid ${C.border}`:'none'}}>
                                <span style={{fontSize:16,flexShrink:0}}>{signed?'✅':'📝'}</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:12,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title||'Contract'}</div>
                                  <div style={{fontSize:10,color:C.gray}}>
                                    {signed ? `Signed by ${c.signed_by_name||'client'} · ${new Date(c.signed_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : 'Awaiting signature'}
                                  </div>
                                </div>
                                {signed ? (
                                  <button onClick={()=>downloadSignedPDF(c)} style={{fontSize:10,color:C.gray,background:'none',border:`1px solid ${C.border}`,borderRadius:5,padding:'2px 8px',cursor:'pointer',flexShrink:0}}>PDF</button>
                                ) : (
                                  <button onClick={()=>copyContractLink(c)} style={{fontSize:10,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:5,padding:'2px 8px',cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>{copiedContractId===c.id?'Copied!':'Copy link'}</button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </>
                    )}
                  </div>

                  {/* Client portal */}
                  <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                    <div style={{padding:'11px 16px',borderBottom:collapsedCards['portal']?'none':`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:6}}>
                      <CollapseBtn cardKey="portal"/>
                      <span style={{fontSize:13,fontWeight:600,color:C.ink}}>🔗 Client Portal</span>
                    </div>
                    {!collapsedCards['portal'] && (
                      <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                        {liveEvent?.portal_token ? (
                          <>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <div style={{width:8,height:8,borderRadius:'50%',background:C.green,flexShrink:0}}/>
                              <span style={{fontSize:12,color:C.ink,fontWeight:500}}>Portal active</span>
                            </div>
                            <div style={{display:'flex',gap:6}}>
                              <button onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/portal/${liveEvent.portal_token}`);toast('Portal link copied ✓');}catch{toast('Could not copy','warn');}}} style={{flex:1,padding:'6px',borderRadius:7,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:11,fontWeight:500,cursor:'pointer'}}>📋 Copy portal link</button>
                              <button onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/questionnaire/${liveEvent.portal_token}`);toast('Questionnaire link copied ✓');}catch{toast('Could not copy','warn');}}} style={{flex:1,padding:'6px',borderRadius:7,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:11,fontWeight:500,cursor:'pointer'}}>📝 Questionnaire</button>
                            </div>
                            {questionnaire && (
                              <div style={{fontSize:11,color:'var(--text-success)',padding:'5px 8px',background:C.greenBg,borderRadius:6}}>
                                ✅ Questionnaire submitted {questionnaire.submitted_at ? new Date(questionnaire.submitted_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : ''}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{textAlign:'center',padding:'8px 0',color:C.gray,fontSize:12}}>
                            No portal link generated yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Improvement 2: Photo Booth details card */}
                  {ev.services?.includes('photobooth') && (
                    <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden',gridColumn:'1 / -1'}}>
                      <div style={{padding:'11px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:13,fontWeight:600,color:C.ink}}>📸 Photo Booth</span>
                        <button onClick={()=>setEditingSvc(editingSvc==='photobooth'?null:'photobooth')} style={{fontSize:11,color:C.rosaText,background:'none',border:`1px solid ${C.rosa}`,borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:500}}>{editingSvc==='photobooth'?'Done':'Edit'}</button>
                      </div>
                      {editingSvc==='photobooth' ? (
                        <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                          {[{k:'backdrop',label:'Backdrop color/style'},{k:'prints',label:'Prints per session'},{k:'vendor',label:'Rental company'},{k:'props',label:'Props included'}].map(({k,label})=>(
                            <div key={k}>
                              <div style={{fontSize:10,color:C.gray,marginBottom:2,fontWeight:500}}>{label}</div>
                              <input value={svcDetails.photobooth?.[k]||''} onChange={e=>saveSvcDetails('photobooth',{...(svcDetails.photobooth||{}),[k]:e.target.value})} placeholder={label} style={{width:'100%',padding:'5px 9px',borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,boxSizing:'border-box',outline:'none'}}/>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:6}}>
                          {svcDetails.photobooth && Object.entries({backdrop:'Backdrop',prints:'Prints',vendor:'Vendor',props:'Props'}).map(([k,label])=>
                            svcDetails.photobooth[k] ? (
                              <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                                <span style={{color:C.gray}}>{label}</span>
                                <span style={{color:C.ink,fontWeight:500,textAlign:'right',maxWidth:'60%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svcDetails.photobooth[k]}</span>
                              </div>
                            ) : null
                          )}
                          {(!svcDetails.photobooth||!Object.values(svcDetails.photobooth).some(Boolean))&&(
                            <div style={{textAlign:'center',padding:'8px 0',color:C.gray,fontSize:12}}>No details yet. <span onClick={()=>setEditingSvc('photobooth')} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>Add details →</span></div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Improvement 2: Custom Sneakers details card */}
                  {ev.services?.includes('custom_sneakers') && (
                    <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden',gridColumn:'1 / -1'}}>
                      <div style={{padding:'11px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:13,fontWeight:600,color:C.ink}}>👟 Custom Sneakers</span>
                        <button onClick={()=>setEditingSvc(editingSvc==='custom_sneakers'?null:'custom_sneakers')} style={{fontSize:11,color:C.rosaText,background:'none',border:`1px solid ${C.rosa}`,borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:500}}>{editingSvc==='custom_sneakers'?'Done':'Edit'}</button>
                      </div>
                      {editingSvc==='custom_sneakers' ? (
                        <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                          {[{k:'designer',label:'Designer / vendor'},{k:'pairs',label:'Number of pairs'},{k:'sizes',label:'Sizes needed'},{k:'design',label:'Design / customization'},{k:'delivery',label:'Delivery date'}].map(({k,label})=>(
                            <div key={k}>
                              <div style={{fontSize:10,color:C.gray,marginBottom:2,fontWeight:500}}>{label}</div>
                              <input value={svcDetails.custom_sneakers?.[k]||''} onChange={e=>saveSvcDetails('custom_sneakers',{...(svcDetails.custom_sneakers||{}),[k]:e.target.value})} placeholder={label} style={{width:'100%',padding:'5px 9px',borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,boxSizing:'border-box',outline:'none'}}/>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:6}}>
                          {svcDetails.custom_sneakers && Object.entries({designer:'Designer',pairs:'Pairs',sizes:'Sizes',design:'Design',delivery:'Delivery'}).map(([k,label])=>
                            svcDetails.custom_sneakers[k] ? (
                              <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                                <span style={{color:C.gray}}>{label}</span>
                                <span style={{color:C.ink,fontWeight:500,textAlign:'right',maxWidth:'60%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svcDetails.custom_sneakers[k]}</span>
                              </div>
                            ) : null
                          )}
                          {(!svcDetails.custom_sneakers||!Object.values(svcDetails.custom_sneakers).some(Boolean))&&(
                            <div style={{textAlign:'center',padding:'8px 0',color:C.gray,fontSize:12}}>No details yet. <span onClick={()=>setEditingSvc('custom_sneakers')} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>Add details →</span></div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Improvement 3: Recent notes card */}
                {notes.length > 0 && (
                  <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                    <div style={{padding:'11px 16px',borderBottom:collapsedCards['recentnotes']?'none':`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <CollapseBtn cardKey="recentnotes"/>
                        <span style={{fontSize:13,fontWeight:600,color:C.ink}}>📝 Recent notes</span>
                      </div>
                      <button onClick={()=>setCoordTab('notes')} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>All notes →</button>
                    </div>
                    {!collapsedCards['recentnotes'] && notes.slice(0,3).map((n,i) => (
                      <div key={n.id||i} style={{padding:'10px 16px',borderBottom:i<Math.min(notes.length,3)-1?`1px solid ${C.border}`:'none'}}>
                        <div style={{fontSize:12,color:C.ink,lineHeight:1.4}}>{n.text}</div>
                        <div style={{fontSize:10,color:C.gray,marginTop:4}}>{n.author_name||'Staff'}{n.created_at ? ` · ${new Date(n.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            );
          })()}

          {/* WEDDING PLANNER TAB — coming soon add-on */}
          {coordTab === 'planning' && (
            <PlanningBoardPanel
              ev={ev}
              liveEvent={liveEvent}
              tasks={liveTasks}
              appointments={appointments}
              milestones={milestones}
              notes={notes}
              staff={staff}
              boutique={boutique}
              allEvents={allEvents}
              setScreen={setScreen}
              setSelectedEvent={setSelectedEvent}
              createAppointment={createAppointment}
              addNote={addNote}
              updateEvent={updateEvent}
              refetchEvent={refetchEvent}
              toggleTask={toggleLiveTask}
              addTask={addLiveTask}
              toast={toast}
            />
          )}

          {/* APPOINTMENTS TAB */}
          {coordTab === 'appointments' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* UNIFIED APPOINTMENTS CARD */}
              <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:13,fontWeight:600,color:C.ink}}>📅 Appointments</span>
                    {upcomingAppts.length>0&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:999,background:'var(--bg-warning)',color:'var(--text-warning)',fontWeight:600}}>{upcomingAppts.length} upcoming</span>}
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <button onClick={()=>setShowAddDate(true)} style={{fontSize:12,color:C.gray,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>+ Add date</button>
                    <button onClick={()=>setShowScheduleAppt(true)} style={{fontSize:12,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>+ Schedule</button>
                    {typeof setConsultationProps === 'function' && (
                      <button
                        onClick={() => {
                          setConsultationProps({
                            eventId: ev.id,
                            clientId: ev.client_id,
                            eventDate: ev.event_date,
                          });
                          setScreen('consultation');
                        }}
                        style={{fontSize:12,color:'#0B8562',background:'#F0FDF4',border:'1px solid #0B856230',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontWeight:500,whiteSpace:'nowrap'}}
                      >
                        Start consultation
                      </button>
                    )}
                  </div>
                </div>
                <div style={{padding:'12px 16px'}}>
                  {appointments.length===0&&(
                    <div style={{padding:'16px 0',textAlign:'center',fontSize:12,color:C.gray}}>
                      No appointments yet.{' '}
                      <span onClick={()=>setShowScheduleAppt(true)} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>+ Schedule one →</span>
                    </div>
                  )}
                  {appointments.map((a, i) => {
                    const cfg = APPOINTMENT_TYPES[a.type] || null;
                    const isPast = a.date && new Date(a.date + 'T23:59') < new Date();
                    const isMissing = a.status === 'missing';
                    return (
                      <div key={a.id||i} style={{
                        display:'flex', alignItems:'flex-start', gap:12,
                        padding:'12px 0',
                        borderBottom: i < appointments.length-1 ? `1px solid ${C.border}` : 'none',
                        opacity: isPast && a.status !== 'done' ? 0.6 : 1,
                      }}>
                        {/* Icon */}
                        <div style={{
                          width:36, height:36, borderRadius:10, flexShrink:0,
                          background: cfg?.bgColor || C.grayBg,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:18,
                        }}>{cfg?.icon || '📅'}</div>

                        {/* Main content */}
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontWeight:600, fontSize:13, color:C.ink}}>
                            {cfg?.label || (a.type||'Appointment').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                          </div>
                          {cfg?.labelEs && (
                            <div style={{fontSize:11, color:C.gray, marginTop:1}}>{cfg.labelEs}</div>
                          )}
                          <div style={{fontSize:12, color:C.gray, marginTop:4}}>
                            {isMissing
                              ? <span style={{color:'var(--text-warning)', fontWeight:500}}>⚠ Not yet scheduled</span>
                              : formatApptDateTime(a.date, a.time)
                            }
                            {a.duration_minutes && !isMissing && (
                              <span style={{color:C.gray}}> · {a.duration_minutes}min</span>
                            )}
                          </div>
                          {a.condition_notes && (
                            <div style={{fontSize:11, color:C.gray, marginTop:3, fontStyle:'italic'}}>
                              Condition: {a.condition_notes}
                            </div>
                          )}
                          {a.note && (
                            <div style={{fontSize:11, color:C.gray, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                              {a.note}
                            </div>
                          )}
                        </div>

                        {/* Status + actions */}
                        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0}}>
                          <StatusBadge status={a.status || 'scheduled'} />
                          <div style={{display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end'}}>
                            {/* Calendar link */}
                            {a.date && !isMissing && (
                              <span
                                onClick={() => downloadApptIcs(a, ev.client, boutique)}
                                style={{fontSize:10,color:C.rosaText,fontWeight:500,cursor:'pointer'}}
                                title="Add to calendar"
                              >📆 Cal</span>
                            )}
                            {/* SMS reminder */}
                            {a.date && !isMissing && a.status !== 'done' && a.status !== 'cancelled' && ev.clientData?.phone && (
                              <button
                                onClick={async () => {
                                  setRemindingApptId(a.id);
                                  const apptLabel = (a.type||'appointment').replace(/_/g,' ');
                                  const msg = `Hi ${ev.client?.split(' ')[0] || 'there'}, just a reminder for your ${apptLabel} on ${fmtApptDate(a.date, a.time)}. See you at ${boutique?.name||'us'}! Reply STOP to opt out.`;
                                  await sendSms(msg);
                                  setRemindingApptId(null);
                                  toast('Reminder sent ✓');
                                }}
                                disabled={remindingApptId === a.id}
                                style={{fontSize:10,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:5,padding:'2px 8px',cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}
                              >
                                {remindingApptId === a.id ? 'Sending…' : '💬 Remind'}
                              </button>
                            )}
                            {/* Schedule button for missing */}
                            {isMissing && (
                              <button onClick={()=>setShowScheduleAppt(true)}
                                style={{fontSize:10, padding:'3px 8px', borderRadius:6, border:`1px solid ${C.rosaText}`,
                                  background:C.rosaPale, color:C.rosaText, cursor:'pointer', fontWeight:500}}>
                                Schedule
                              </button>
                            )}
                            {/* Mark done */}
                            {!isMissing && a.status !== 'done' && a.status !== 'cancelled' && (
                              <button onClick={()=>markApptStatus(a.id, 'done')}
                                style={{fontSize:10, padding:'3px 8px', borderRadius:6,
                                  border:'1px solid #15803D', background:'#DCFCE7', color:'#15803D',
                                  cursor:'pointer', fontWeight:500}}>
                                ✓ Done
                              </button>
                            )}
                            {/* Log return — only for return type */}
                            {a.type === 'return' && a.status !== 'done' && !isMissing && (
                              <button onClick={()=>logReturn(a)}
                                style={{fontSize:10, padding:'3px 8px', borderRadius:6,
                                  border:`1px solid #C87810`, background:'#FFFBEB', color:'#C87810',
                                  cursor:'pointer', fontWeight:500}}>
                                Log return
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PAYMENTS TAB */}
          {coordTab === 'payments' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* ── Financial summary strip ── */}
              {(() => {
                const total = Number(ev.total) || 0;
                const paid = Number(ev.paid) || 0;
                const remaining = Math.max(0, total - paid);
                const overdue = Number(ev.overdue) || 0;
                const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                const stats = [
                  { label: 'Contract total', value: fmt(total), color: C.ink },
                  { label: 'Collected', value: fmt(paid), sub: total > 0 ? `${pct}%` : null, color: paid >= total && total > 0 ? 'var(--color-success)' : C.ink },
                  { label: 'Remaining', value: remaining > 0 ? fmt(remaining) : '—', color: remaining > 0 ? C.ink : 'var(--color-success)' },
                  { label: 'Overdue', value: overdue > 0 ? fmt(overdue) : '—', color: overdue > 0 ? 'var(--color-danger)' : C.gray },
                ];
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    {stats.map(({ label, value, sub, color }) => (
                      <div key={label} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                        {sub && <div style={{ fontSize: 10, color: 'var(--text-success)', marginTop: 3 }}>{sub} paid</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}
              {hasPro && milestones.length > 0 && (paymentRisk || paymentRiskLoading) && (()=>{
                if (paymentRiskLoading) return (
                  <div key="risk-loading" style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:8,background:C.grayBg,fontSize:12,color:C.gray}}>
                    ✨ Analyzing payment risk…
                  </div>
                );
                if (!paymentRisk) return null;
                const riskConfig = {
                  low:    {bg:'var(--bg-success)',col:'var(--text-success)',dot:'var(--color-success)',label:'Low risk'},
                  medium: {bg:'var(--bg-warning)',col:'var(--text-warning)',dot:'var(--color-warning)',label:'Medium risk'},
                  high:   {bg:'var(--bg-danger)', col:'var(--text-danger)', dot:'var(--color-danger)', label:'High risk'},
                }[paymentRisk.risk] || {bg:C.grayBg,col:C.gray,dot:C.gray,label:'Unknown risk'};
                return (
                  <div key="risk-badge" style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',borderRadius:8,background:riskConfig.bg,border:`1px solid ${riskConfig.dot}30`}}>
                    <div style={{width:9,height:9,borderRadius:'50%',background:riskConfig.dot,flexShrink:0,marginTop:4}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                        <span style={{fontSize:12,fontWeight:600,color:riskConfig.col}}>{riskConfig.label}</span>
                        <span style={{fontSize:10,color:riskConfig.col,opacity:0.7}}>AI analysis</span>
                      </div>
                      <div style={{fontSize:12,color:riskConfig.col,opacity:0.85,lineHeight:1.4}}>{paymentRisk.reason}</div>
                      {paymentRisk.action && <div style={{fontSize:11,color:riskConfig.col,marginTop:4,fontWeight:500}}>→ {paymentRisk.action}</div>}
                    </div>
                    <button onClick={() => setPaymentRisk(null)} aria-label="Close" style={{background:'none',border:'none',cursor:'pointer',color:riskConfig.col,fontSize:16,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32,opacity:0.5}}>×</button>
                  </div>
                );
              })()}
              <PaymentMilestonesCard
                ev={ev}
                milestones={milestones}
                onAddMilestone={() => setShowAddMilestone(true)}
                onGeneratePayLink={generatePayLink}
                copiedPayLinkId={copiedPayLinkId}
                createMilestone={createMilestone}
                createMilestones={createMilestones}
                boutique={boutique}
                onReorder={async (newOrder) => {
                  await Promise.all(newOrder.map((m, i) =>
                    supabase.from('payment_milestones').update({ sort_order: i }).eq('id', m.id).eq('boutique_id', boutique.id)
                  ));
                  await refetchEvent();
                }}
                onMarkPaid={(m) => { setPaidForm({method:'Cash',date:new Date().toISOString().slice(0,10)}); setShowMarkPaid(m); }}
                onRemind={(m) => {
                  const clientEmail = ev.clientData?.email;
                  if (!clientEmail) { toast('Client email is missing', 'error'); return; }
                  setReminderConfirm({ m, clientEmail });
                }}
                logRefund={logRefund}
                onLogTip={logTip}
                refunds={refunds}
              />
              {/* Tips summary */}
              {(refunds?.length > 0 || logTip) && (
                <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:13,fontWeight:600,color:C.ink}}>💝 Tips & Refunds</span>
                    {logTip && !tipOpen && (
                      <button onClick={() => { setTipAmt(''); setTipOpen(true); }}
                        style={{fontSize:11,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:500}}>
                        + Log tip
                      </button>
                    )}
                    {logTip && tipOpen && (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <span style={{fontSize:11,color:C.gray}}>$</span>
                        <input
                          type="number" min="0.01" step="0.01"
                          value={tipAmt}
                          onChange={e => setTipAmt(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const n = Number(tipAmt);
                              if (!Number.isFinite(n) || n <= 0) return;
                              logTip({ event_id: ev.id, amount: n });
                              toast(`Tip of $${n.toFixed(2)} logged ✓`);
                              setTipOpen(false); setTipAmt('');
                              refetchEvent();
                            } else if (e.key === 'Escape') { setTipOpen(false); setTipAmt(''); }
                          }}
                          placeholder="0.00"
                          autoFocus
                          aria-label="Tip amount in dollars"
                          style={{width:70,padding:'3px 6px',borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.ink}}
                        />
                        <button
                          onClick={() => {
                            const n = Number(tipAmt);
                            if (!Number.isFinite(n) || n <= 0) { toast('Enter a valid amount', 'error'); return; }
                            logTip({ event_id: ev.id, amount: n });
                            toast(`Tip of $${n.toFixed(2)} logged ✓`);
                            setTipOpen(false); setTipAmt('');
                            refetchEvent();
                          }}
                          style={{fontSize:11,color:C.white,background:C.rosaSolid,border:'none',borderRadius:6,padding:'3px 9px',cursor:'pointer',fontWeight:500}}>
                          Save
                        </button>
                        <button onClick={() => { setTipOpen(false); setTipAmt(''); }}
                          aria-label="Cancel tip entry"
                          style={{fontSize:13,color:C.gray,background:'none',border:'none',cursor:'pointer',lineHeight:1,padding:'2px 4px'}}>
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{padding:'12px 16px'}}>
                    {(!refunds||refunds.length===0) ? (
                      <div style={{fontSize:12,color:C.gray,textAlign:'center',padding:'8px 0'}}>No tips or refunds logged yet.</div>
                    ) : (
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {refunds.map((r,i)=>(
                          <div key={r.id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:i<refunds.length-1?`1px solid ${C.border}`:'none'}}>
                            <span style={{fontSize:14,flexShrink:0}}>{r.type==='tip'?'💝':'↩️'}</span>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,fontWeight:500,color:C.ink,textTransform:'capitalize'}}>{r.type||'Tip'}</div>
                              {r.note&&<div style={{fontSize:10,color:C.gray}}>{r.note}</div>}
                            </div>
                            <span style={{fontSize:13,fontWeight:600,color:r.type==='tip'?C.green:'var(--color-danger)',flexShrink:0}}>{r.type==='tip'?'+':'-'}{fmt(Number(r.amount||0))}</span>
                            {r.created_at&&<span style={{fontSize:10,color:C.gray,flexShrink:0}}>{new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
                          </div>
                        ))}
                        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8,display:'flex',justifyContent:'space-between',fontSize:12}}>
                          <span style={{color:C.gray}}>Total tips</span>
                          <span style={{fontWeight:600,color:C.green}}>{fmt(refunds.filter(r=>r.type==='tip').reduce((s,r)=>s+Number(r.amount||0),0))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <ContractsCard
                contracts={contracts}
                openContractModal={openContractModal}
                downloadSignedPDF={downloadSignedPDF}
                copyContractLink={copyContractLink}
                copiedContractId={copiedContractId}
                onContractVoided={(id) => setContracts(cs => cs.map(c => c.id===id ? {...c,status:'voided'} : c))}
              />
            </div>
          )}

          {/* TASKS TAB */}
          {coordTab === 'tasks' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',justifyContent:'flex-end'}}>
                <button onClick={()=>{
                  const tmpl = TASK_TEMPLATES[ev.type] || TASK_TEMPLATES.default;
                  const existing = tasks.map(t=>t.text.toLowerCase());
                  setSelectedTemplateTasks(tmpl.filter(t=>!existing.includes(t.toLowerCase())));
                  setShowTemplateModal(true);
                }} style={{fontSize:12,color:C.rosaText,background:C.rosaPale,border:`1px solid ${C.rosa}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',fontWeight:500}}>📋 Load template</button>
              </div>
              <EventTasksCard
                tasks={tasks}
                setShowAddTask={setShowAddTask}
                toggleTask={toggleTask}
                addTask={addTask}
                markAllAlertsDone={markAllAlertsDone}
                ev={ev}
                staff={staff}
              />
              {(()=>{
                const checkList=dayChecklist||[];
                const doneCount=checkList.filter(i=>i.done).length;
                const totalCount=checkList.length;
                const pctDone=totalCount>0?Math.round((doneCount/totalCount)*100):0;
                const currentMember=staff.find(s=>s.user_id===boutique?.owner_user_id)||staff[0];
                const currentUserName=currentMember?.name||myRole||'Staff';
                return(
                  <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                    <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:13,fontWeight:500,color:C.ink}}>Day-of Checklist</span>
                        {totalCount>0&&<span style={{fontSize:11,color:C.gray}}>{doneCount} / {totalCount} complete{checklistSaving?' · saving…':''}</span>}
                      </div>
                      <button onClick={()=>{if(checkList.length===0){startChecklistWithDefaults();}else{setChecklistAdding(true);}}} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500,padding:'2px 6px'}}>+ Add item</button>
                    </div>
                    <div style={{padding:'10px 16px'}}>
                      {totalCount>0&&(
                        <div style={{marginBottom:10}}>
                          <div style={{height:5,background:C.border,borderRadius:3,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${pctDone}%`,background:pctDone===100?C.green:C.rosa,borderRadius:3,transition:'width 0.3s'}}/>
                          </div>
                          <div style={{fontSize:10,color:pctDone===100?C.green:C.gray,marginTop:3,textAlign:'right'}}>{pctDone}%{pctDone===100?' — All done!':''}</div>
                        </div>
                      )}
                      {checkList.length===0&&!checklistAdding&&(
                        <div style={{textAlign:'center',padding:'16px 0',color:C.gray,fontSize:12}}>
                          No checklist items yet.<br/>
                          <span onClick={startChecklistWithDefaults} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>+ Add items or load defaults</span>
                        </div>
                      )}
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {checkList.map((item,idx)=>(
                          <div key={item.id||idx} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'6px 8px',borderRadius:7,background:item.done?C.greenBg:C.grayBg}}>
                            <input type="checkbox" checked={!!item.done} onChange={()=>toggleChecklistItem(idx,currentUserName)} style={{marginTop:2,width:15,height:15,cursor:'pointer',accentColor:C.green,flexShrink:0}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,color:item.done?C.gray:C.ink,textDecoration:item.done?'line-through':'none'}}>{item.text}</div>
                              {item.done&&item.done_at&&(
                                <div style={{fontSize:10,color:C.gray,marginTop:1}}>
                                  {item.done_by&&<span>{item.done_by} · </span>}
                                  {new Date(item.done_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
                                </div>
                              )}
                            </div>
                            <button onClick={()=>deleteChecklistItem(idx)} aria-label="Delete checklist item" style={{background:'none',border:'none',color:C.gray,cursor:'pointer',fontSize:14,padding:'4px 8px',lineHeight:1,flexShrink:0,opacity:0.5,minHeight:32,minWidth:32}}>×</button>
                          </div>
                        ))}
                      </div>
                      {checklistAdding&&(
                        <div style={{display:'flex',gap:6,marginTop:8,alignItems:'center'}}>
                          <input autoFocus value={checklistNewText} onChange={e=>setChecklistNewText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addChecklistItem(checklistNewText);if(e.key==='Escape'){setChecklistAdding(false);setChecklistNewText('');}}} placeholder="New checklist item…" style={{flex:1,padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,outline:'none'}}/>
                          <button onClick={()=>addChecklistItem(checklistNewText)} style={{padding:'6px 10px',borderRadius:7,border:'none',background:C.rosa,color:C.white,cursor:'pointer',fontSize:12,fontWeight:500}}>✓</button>
                          <button onClick={()=>{setChecklistAdding(false);setChecklistNewText('');}} style={{padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:C.white,color:C.gray,cursor:'pointer',fontSize:12}}>✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* GUESTS TAB */}
          {coordTab === 'guests' && (
            <GuestList eventId={ev.id} boutique_id={boutique?.id} />
          )}

          {/* NOTES TAB */}
          {coordTab === 'notes' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* Pinned notes */}
              {notes.filter(n=>pinnedNoteIds.includes(n.id)).length>0&&(
                <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                  <div style={{padding:'11px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:13,fontWeight:600,color:C.ink}}>📌 Pinned</span>
                  </div>
                  {notes.filter(n=>pinnedNoteIds.includes(n.id)).map((n,i,arr)=>(
                    <div key={n.id} style={{padding:'10px 16px',borderBottom:i<arr.length-1?`1px solid ${C.border}`:'none',display:'flex',gap:8,alignItems:'flex-start'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,color:C.ink,lineHeight:1.5}}>{n.text}</div>
                        <div style={{fontSize:10,color:C.gray,marginTop:3}}>{n.author_name||'Staff'}{n.created_at?` · ${new Date(n.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`:''}</div>
                      </div>
                      <button onClick={()=>pinNote(n.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#F59E0B',fontSize:14,padding:'0 2px',flexShrink:0}} title="Unpin">📌</button>
                    </div>
                  ))}
                </div>
              )}
              <StaffNotesCard
                notes={notes}
                note={note}
                setNote={setNote}
                handleAddNote={handleAddNote}
                pinnedNoteIds={pinnedNoteIds}
                onPin={pinNote}
              />
            </div>
          )}

          {/* ACTIVITY TAB — Improvement 4 */}
          {coordTab === 'activity' && (()=>{
            const feed = [
              ...notes.map(n => ({ type:'note', date: n.created_at, text: n.text, author: n.author_name, icon:'📝' })),
              ...milestones.filter(m=>m.status==='paid'&&m.paid_date).map(m => ({ type:'payment', date: m.paid_date+'T12:00:00', text:`${m.label} paid — ${fmt(Number(m.amount))}`, icon:'💳' })),
              ...tasks.filter(t=>t.done).map(t => ({ type:'task', date: t.done_at||null, text: t.text, icon:'✅' })),
              ...appointments.filter(a=>a.status==='done'&&a.date).map(a => ({ type:'appt', date: a.date+'T12:00:00', text:`${(a.type||'Appointment').replace(/_/g,' ')} completed`, icon:'📅' })),
            ].filter(e=>e.date).sort((a,b)=>new Date(b.date)-new Date(a.date));

            return (
              <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:600,color:C.ink}}>⚡ Event activity</div>
                {feed.length===0 ? (
                  <div style={{padding:'24px 16px',textAlign:'center',fontSize:12,color:C.gray}}>No activity yet</div>
                ) : feed.map((item,i) => (
                  <div key={i} style={{display:'flex',gap:12,padding:'10px 16px',borderBottom:i<feed.length-1?`1px solid ${C.border}`:'none',alignItems:'flex-start'}}>
                    <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{item.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:C.ink,lineHeight:1.4}}>{item.text}</div>
                      {item.author && <div style={{fontSize:10,color:C.gray,marginTop:2}}>{item.author}</div>}
                    </div>
                    <div style={{fontSize:10,color:C.gray,flexShrink:0}}>
                      {new Date(item.date).toLocaleDateString('en-US',{month:'short', day:'numeric'})}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* FILES TAB */}
          {coordTab === 'files' && (
            <FilesPanel files={files} filesLoading={filesLoading} uploadFile={uploadFile} deleteFile={deleteFile} getPublicUrl={getPublicUrl} formatBytes={formatBytes} getFileIcon={getFileIcon} toast={toast} />
          )}

          {/* VENDORS TAB */}
          {coordTab === 'vendors' && (
            <EventVendorsCard eventId={eventId}/>
          )}

        </div>{/* end tab panels */}

      </div>{/* end page-scroll outer */}

      {/* ── AI CONTRACT DRAFT MODAL ── */}
      {showAIContractModal&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1010,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-ai-contract-title" style={{background:C.white,borderRadius:16,width:'100%',maxWidth:640,maxHeight:'88dvh',display:'flex',flexDirection:'column',boxShadow:'0 24px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div>
                <div id="eventdetail-ai-contract-title" style={{fontSize:16,fontWeight:600,color:C.ink}}>🤖 AI Contract Draft</div>
                <div style={{fontSize:11,color:C.gray,marginTop:2}}>AI-generated — review carefully before sending to client</div>
              </div>
              <button onClick={()=>{setShowAIContractModal(false);setAiContractText('');setAiContractCopied(false);}} aria-label="Close" style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:22,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
              {aiContractLoading?(
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:'40px 0',color:C.gray}}>
                  <div style={{width:32,height:32,border:`3px solid ${C.border}`,borderTopColor:C.rosa,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                  <div style={{fontSize:13}}>Drafting your contract…</div>
                </div>
              ):(
                <textarea
                  value={aiContractText}
                  onChange={e=>setAiContractText(e.target.value)}
                  style={{width:'100%',minHeight:360,border:`1px solid ${C.border}`,borderRadius:8,padding:12,fontSize:12,fontFamily:'Georgia,serif',lineHeight:1.7,color:C.ink,background:C.ivory,resize:'vertical',boxSizing:'border-box'}}
                />
              )}
            </div>
            {!aiContractLoading&&aiContractText&&(
              <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',flexShrink:0}}>
                <button
                  onClick={async()=>{
                    try {
                      await navigator.clipboard.writeText(aiContractText);
                      setAiContractCopied(true);
                      setTimeout(()=>setAiContractCopied(false),2000);
                    } catch {
                      toast('Could not copy — please copy manually','warn');
                    }
                  }}
                  style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:aiContractCopied?C.greenBg:C.white,color:aiContractCopied?C.green:C.gray,fontSize:12,cursor:'pointer',fontWeight:500,minHeight:'unset'}}
                >{aiContractCopied?'Copied ✓':'Copy to clipboard'}</button>
                <button
                  onClick={async()=>{
                    if(!boutique?.id)return;
                    setSaving(true);
                    const existing=boutique.contract_templates||{};
                    const key=`ai_draft_${ev.type}_${Date.now()}`;
                    const{error}=await supabase.from('boutiques').update({contract_templates:{...existing,[key]:{title:`${EVT_TYPES[ev.type]?.label||ev.type} Contract`,body:aiContractText,created_at:new Date().toISOString()}}}).eq('id',boutique.id);
                    setSaving(false);
                    if(error)toast('Could not save template','error');
                    else toast('Contract saved as template ✓');
                  }}
                  style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.gray,fontSize:12,cursor:'pointer',fontWeight:500,minHeight:'unset'}}
                >{saving?'Saving…':'Save as template'}</button>
                <GhostBtn label="Close" onClick={()=>{setShowAIContractModal(false);setAiContractText('');setAiContractCopied(false);}} style={{marginLeft:'auto'}}/>
              </div>
            )}
            {aiContractLoading&&(
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            )}
          </div>
        </div>
      )}

      {/* ── RESCHEDULE MODAL ── */}
      {showReschedule&&(
        <div role="presentation" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-reschedule-title" style={{background:C.white,borderRadius:16,padding:28,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div id="eventdetail-reschedule-title" style={{fontSize:16,fontWeight:600,color:C.ink,marginBottom:6}}>📅 Reschedule Event</div>
            <div style={{fontSize:12,color:C.gray,marginBottom:20}}>All unpaid milestones and upcoming appointments will be shifted by the same number of days.</div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:500,color:C.inkMid,marginBottom:4}}>Current date</div>
              <div style={{fontSize:13,color:C.gray,padding:'8px 12px',background:C.grayBg,borderRadius:8}}>{ev.event_date ? new Date(ev.event_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'}) : '—'}</div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:500,color:C.inkMid,marginBottom:4}}>New date</div>
              <input type="date" value={rescheduleDate} onChange={e=>setRescheduleDate(e.target.value)} style={{...inputSt,width:'100%'}}/>
            </div>
            {rescheduleDate&&ev.event_date&&rescheduleDate!==ev.event_date&&(()=>{
              const delta=Math.round((new Date(rescheduleDate)-new Date(ev.event_date))/86400000);
              return <div style={{fontSize:11,color:delta>0?C.green:C.red,background:delta>0?C.greenBg:C.redBg,padding:'7px 12px',borderRadius:8,marginBottom:16,fontWeight:500}}>
                {delta>0?`+${delta}`:`${delta}`} days — all milestones & appointments will be shifted
              </div>;
            })()}
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowReschedule(false)} style={{flex:1,padding:'9px',border:`1px solid ${C.border}`,borderRadius:8,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={handleReschedule} disabled={rescheduling||!rescheduleDate||rescheduleDate===ev.event_date} style={{flex:1,padding:'9px',border:'none',borderRadius:8,background:C.rosa,color:C.white,cursor:'pointer',fontSize:13,fontWeight:500,opacity:(rescheduling||!rescheduleDate||rescheduleDate===ev.event_date)?0.5:1}}>{rescheduling?'Rescheduling…':'Confirm reschedule'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RUNSHEET ── */}
      {showRunsheet && (
        <EventRunsheet
          ev={ev}
          appointments={liveEvent.appointments || []}
          tasks={tasks}
          milestones={milestones}
          alteration={alteration}
          dressRental={dressRental}
          onClose={() => setShowRunsheet(false)}
        />
      )}

      {/* ── DAY-OF SCHEDULE MODAL ── */}
      {showDayOf && <DayOfScheduleModal ev={ev} appointments={appointments} milestones={milestones} boutique={boutique} onClose={()=>setShowDayOf(false)}/>}

      {/* ── CONTRACT MODAL ── */}
      {showContractModal && (
        <ContractModal 
          liveEvent={liveEvent} 
          onClose={() => setShowContractModal(false)}
          onSuccess={(newContract) => setContracts(prev => [newContract, ...prev])}
        />
      )}

      {/* ── ADD SERVICE MODAL ── */}
      {showAddService&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-add-service-title" style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-add-service-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Services</span>
              <button onClick={()=>setShowAddService(false)} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:10}}>
              <div style={{fontSize:12,color:C.gray,marginBottom:4}}>Toggle services included in this event:</div>
              {[['dress_rental','👗 Dress rental'],['alterations','✂ Alterations'],['planning','📋 Planning'],['decoration','⭐ Decoration']].map(([key,label])=>{
                const active=ev.services?.includes(key);
                return(
                  <button key={key} onClick={async()=>{await toggleService?.(key);toast(active?`${label} removed`:`${label} added`);}} style={{padding:'12px 16px',borderRadius:10,border:`1.5px solid ${active?C.rosa:C.border}`,background:active?C.rosaPale:C.white,color:active?C.rosaText:C.ink,fontSize:13,cursor:'pointer',fontWeight:active?500:400,textAlign:'left'}}>
                    {label} {active&&<span style={{float:'right',fontSize:10,color:C.rosaText}}>✓ Active</span>}
                  </button>
                );
              })}
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'flex-end'}}>
              <PrimaryBtn label="Done" onClick={()=>setShowAddService(false)}/>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MILESTONE MODAL ── */}
      {showAddMilestone && (
        <NewMilestoneModal
          liveEvent={liveEvent}
          createMilestone={createMilestone}
          onClose={() => setShowAddMilestone(false)}
        />
      )}

      {/* ── EDIT RENTAL MODAL ── */}
      {showEditRental&&dressRental&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-edit-rental-title" style={{background:C.white,borderRadius:16,width:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-edit-rental-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Edit rental</span>
              <button onClick={()=>setShowEditRental(false)} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{padding:'10px 14px',background:C.grayBg,borderRadius:8,fontSize:12,fontWeight:500,color:C.ink}}>{dressRental.name} · #{dressRental.sku}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label htmlFor="rental-pickup" style={LBL}>Pickup date</label><input id="rental-pickup" type="date" value={rentalForm.pickup_date} onChange={e=>setRentalForm(f=>({...f,pickup_date:e.target.value}))} style={{...inputSt}}/></div>
                <div><label htmlFor="rental-return" style={LBL}>Return due</label><input id="rental-return" type="date" value={rentalForm.return_date} onChange={e=>setRentalForm(f=>({...f,return_date:e.target.value}))} style={{...inputSt}}/></div>
              </div>
              <div><label htmlFor="rental-fee" style={LBL}>Rental fee ($)</label><input id="rental-fee" type="number" value={rentalForm.fee} onChange={e=>setRentalForm(f=>({...f,fee:e.target.value}))} style={{...inputSt}}/></div>
              <div><label htmlFor="rental-deposit" style={LBL}>Deposit status</label><select id="rental-deposit" value={rentalForm.deposit_paid?'paid':'pending'} onChange={e=>setRentalForm(f=>({...f,deposit_paid:e.target.value==='paid'}))} style={{...inputSt}}><option value="paid">Deposit paid</option><option value="pending">Deposit pending</option></select></div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowEditRental(false)}/>
              <PrimaryBtn label={saving?'Saving…':'Save changes'} colorScheme="success" onClick={async()=>{if(updateDress&&dressRental.id){setSaving(true);const{error}=await updateDress(dressRental.id,{pickup_date:rentalForm.pickup_date||null,return_date:rentalForm.return_date||null});setSaving(false);if(error){toast('Failed to update rental','warn');return;}}setShowEditRental(false);toast('Rental updated ✓');}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD ALTERATION MODAL ── */}
      {showAddAlt&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-add-alt-title" style={{background:C.white,borderRadius:16,width:440,maxHeight:'88dvh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-add-alt-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Add alteration job</span>
              <button onClick={()=>setShowAddAlt(false)} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div><label htmlFor="alt-garment" style={LBL}>Garment</label><input id="alt-garment" value={newAlt.garment} onChange={e=>setNewAlt(a=>({...a,garment:e.target.value}))} placeholder="e.g. Bridal gown #BB-047" style={{...inputSt}}/></div>
              <div><div id="alt-work-label" style={LBL}>Work needed</div>
                <div role="group" aria-labelledby="alt-work-label" style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
                  {['Hem','Bustle','Waist take-in','Let out','Custom beading','Other'].map(w=>{
                    const sel=newAlt.work.includes(w);
                    return(<button key={w} onClick={()=>setNewAlt(a=>({...a,work:sel?a.work.filter(x=>x!==w):[...a.work,w]}))} style={{padding:'5px 12px',borderRadius:999,border:`1.5px solid ${sel?C.rosa:C.border}`,background:sel?C.rosaPale:C.white,color:sel?C.rosaText:C.gray,fontSize:11,cursor:'pointer'}}>{w}</button>);
                  })}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label htmlFor="alt-seamstress" style={LBL}>Seamstress</label><select id="alt-seamstress" value={newAlt.seamstress_id} onChange={e=>setNewAlt(a=>({...a,seamstress_id:e.target.value}))} style={{...inputSt}}><option value="">Unassigned</option>{staff.filter(s=>s.role==='Seamstress'||s.role==='seamstress'||s.role==='Owner'||s.role==='owner').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label htmlFor="alt-deadline" style={LBL}>Deadline</label><input id="alt-deadline" type="date" value={newAlt.deadline} onChange={e=>setNewAlt(a=>({...a,deadline:e.target.value}))} style={{...inputSt}}/></div>
              </div>
              <div><label htmlFor="alt-price" style={LBL}>Quoted price ($)</label><input id="alt-price" type="number" value={newAlt.price} onChange={e=>setNewAlt(a=>({...a,price:e.target.value}))} placeholder="0.00" style={{...inputSt}}/></div>
              <div><label htmlFor="alt-notes" style={LBL}>Notes</label><textarea id="alt-notes" rows={2} value={newAlt.notes} onChange={e=>setNewAlt(a=>({...a,notes:e.target.value}))} placeholder="Special instructions…" style={{...inputSt,resize:'vertical'}}/></div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowAddAlt(false)}/>
              <PrimaryBtn label={saving?'Saving…':'Create job'} colorScheme="success" onClick={async()=>{if(!newAlt.garment.trim()){toast('Garment required','warn');return;}if(createJob&&liveEvent?.id){setSaving(true);const{error}=await createJob({event_id:liveEvent.id,client_id:ev.clientData?.id||null,garment:newAlt.garment.trim(),work_items:newAlt.work,seamstress_id:newAlt.seamstress_id||null,deadline:newAlt.deadline||null,price:newAlt.price?Number(newAlt.price):null,notes:newAlt.notes||null,status:'measurement_needed'});setSaving(false);if(error){toast('Failed to create job','warn');return;}}setShowAddAlt(false);setNewAlt({garment:'',work:[],seamstress_id:'',deadline:'',price:'',notes:''});toast('Alteration job created ✓');}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT ALTERATION MODAL ── */}
      {showEditAlt&&alteration&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-edit-alt-title" style={{background:C.white,borderRadius:16,width:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-edit-alt-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Update alteration status</span>
              <button onClick={()=>setShowEditAlt(false)} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{padding:'10px 14px',background:C.grayBg,borderRadius:8,fontSize:12,fontWeight:500,color:C.ink}}>{alteration.garment||'Alteration job'}</div>
              <div><div id="alt-edit-status-label" style={LBL}>Status</div>
                <div role="group" aria-labelledby="alt-edit-status-label" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[['measurement_needed','Needs measurement'],['in_progress','In progress'],['fitting_scheduled','Fitting scheduled'],['complete','Complete']].map(([s,label])=>(
                    <button key={s} onClick={()=>setAltEditForm(f=>({...f,status:s}))} style={{padding:'10px',borderRadius:8,border:`1.5px solid ${altEditForm.status===s?C.rosa:C.border}`,background:altEditForm.status===s?C.rosaPale:C.white,color:altEditForm.status===s?C.rosaText:C.gray,fontSize:11,cursor:'pointer',fontWeight:altEditForm.status===s?500:400}}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label htmlFor="altedit-seamstress" style={LBL}>Seamstress</label><select id="altedit-seamstress" value={altEditForm.seamstress_id} onChange={e=>setAltEditForm(f=>({...f,seamstress_id:e.target.value}))} style={{...inputSt}}><option value="">Unassigned</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label htmlFor="altedit-deadline" style={LBL}>Deadline</label><input id="altedit-deadline" type="date" value={altEditForm.deadline} onChange={e=>setAltEditForm(f=>({...f,deadline:e.target.value}))} style={{...inputSt}}/></div>
              </div>
              <div><label htmlFor="altedit-price" style={LBL}>Quoted price ($)</label><input id="altedit-price" type="number" value={altEditForm.price} onChange={e=>setAltEditForm(f=>({...f,price:e.target.value}))} style={{...inputSt}}/></div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowEditAlt(false)}/>
              <PrimaryBtn label={saving?'Saving…':'Save'} colorScheme="success" onClick={async()=>{if(alteration?.id&&updateJob){setSaving(true);const upd={};if(altEditForm.status)upd.status=altEditForm.status;if(altEditForm.seamstress_id)upd.seamstress_id=altEditForm.seamstress_id;else upd.seamstress_id=null;if(altEditForm.deadline)upd.deadline=altEditForm.deadline;if(altEditForm.price)upd.price=Number(altEditForm.price);const{error}=await updateJob(alteration.id,upd);setSaving(false);if(error){toast('Failed to save','warn');return;}await refetchEvent();}setShowEditAlt(false);toast('Alteration updated ✓');}}/>
            </div>
          </div>
        </div>
      )}



      {/* ── EDIT CLIENT MODAL ── */}
      {showEditClient&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-edit-client-title" style={{background:C.white,borderRadius:16,width:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-edit-client-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Edit client info</span>
              <button onClick={()=>setShowEditClient(false)} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div><label htmlFor="client-name" style={LBL}>Client name</label><input id="client-name" value={clientForm.name} onChange={e=>setClientForm(f=>({...f,name:e.target.value}))} style={{...inputSt}}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label htmlFor="client-phone" style={LBL}>Phone</label><input id="client-phone" value={clientForm.phone} onChange={e=>setClientForm(f=>({...f,phone:e.target.value}))} placeholder="(956) 214-8830" style={{...inputSt}}/></div>
                <div><label htmlFor="client-email" style={LBL}>Email</label><input id="client-email" type="email" value={clientForm.email} onChange={e=>setClientForm(f=>({...f,email:e.target.value}))} placeholder="client@email.com" style={{...inputSt}}/></div>
              </div>
              <div><label htmlFor="client-lang" style={LBL}>Preferred language</label><select id="client-lang" value={clientForm.language_preference} onChange={e=>setClientForm(f=>({...f,language_preference:e.target.value}))} style={{...inputSt}}><option value="">—</option><option value="en">English</option><option value="es">Spanish</option><option value="both">EN / ES</option></select></div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowEditClient(false)}/>
              <PrimaryBtn label={saving?'Saving…':'Save'} colorScheme="success" onClick={async()=>{if(updateClient&&ev.clientData?.id){setSaving(true);const{error}=await updateClient(ev.clientData.id,{name:clientForm.name.trim()||undefined,phone:clientForm.phone||null,email:clientForm.email||null,language_preference:clientForm.language_preference||null});setSaving(false);if(error){toast('Failed to save','warn');return;}}setShowEditClient(false);toast('Client info saved ✓');}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD DATE MODAL ── */}
      {showAddDate&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-add-date-title" style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-add-date-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Add important date</span>
              <button onClick={()=>{setShowAddDate(false);setAddDateConflict(null);setStaffAvailWarn(null);}} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div><label htmlFor="appt-type" style={LBL}>Appointment type</label><select id="appt-type" value={addDateForm.type} onChange={e=>setAddDateForm(f=>({...f,type:e.target.value}))} style={{...inputSt}}>{['Measurements','1st fitting','2nd fitting','Final fitting','Dress pickup','Dress return','Planning consult','Venue walkthrough','Other'].map(t=><option key={t}>{t}</option>)}</select></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label htmlFor="appt-date" style={LBL}>Date</label><input id="appt-date" type="date" value={addDateForm.date} onChange={e=>{const d=e.target.value;setAddDateForm(f=>({...f,date:d}));setAddDateConflict(checkConflict(d,addDateForm.time,addDateForm.staff_id||null));checkStaffAvailability(addDateForm.staff_id,d,addDateForm.time);}} style={{...inputSt}}/></div>
                <div><label htmlFor="appt-time" style={LBL}>Time</label><input id="appt-time" type="time" value={addDateForm.time} onChange={e=>{const t=e.target.value;setAddDateForm(f=>({...f,time:t}));setAddDateConflict(checkConflict(addDateForm.date,t,addDateForm.staff_id||null));checkStaffAvailability(addDateForm.staff_id,addDateForm.date,t);}} style={{...inputSt}}/></div>
              </div>
              {addDateConflict&&(()=>{
                const c=addDateConflict[0];
                const cStaff=c.staff_id?staff.find(s=>s.id===c.staff_id)?.name:null;
                const cTime=c.time?(()=>{const[h,m]=c.time.split(':').map(Number);const ampm=h>=12?'PM':'AM';const hh=h%12||12;return `${hh}:${String(m).padStart(2,'0')} ${ampm}`;})():null;
                return (
                  <div style={{padding:'8px 12px',borderRadius:8,background:'var(--bg-warning)',border:'1px solid var(--border-warning)',fontSize:12,color:'var(--text-warning)'}}>
                    ⚠️ {cStaff?<><strong>{cStaff}</strong> already has</>:'There is already'} a <strong>{c.type}</strong> appointment{cTime?' at '+cTime:''} on this date — you can still save.
                  </div>
                );
              })()}
              <div><label htmlFor="appt-staff" style={LBL}>Assigned staff</label><select id="appt-staff" value={addDateForm.staff_id} onChange={e=>{const sid=e.target.value;setAddDateForm(f=>({...f,staff_id:sid}));setAddDateConflict(checkConflict(addDateForm.date,addDateForm.time,sid||null));setStaffAvailWarn(null);checkStaffAvailability(sid,addDateForm.date,addDateForm.time);}} style={{...inputSt}}><option value="">Unassigned</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              {staffAvailWarn && addDateForm.staff_id && (()=>{
                const staffName = staff.find(s=>s.id===addDateForm.staff_id)?.name || 'Staff';
                if (!staffAvailWarn.available) {
                  return (
                    <div style={{padding:'8px 12px',borderRadius:8,background:C.redBg,border:`1px solid ${C.rosaLight}`,fontSize:12,color:C.red,display:'flex',alignItems:'center',gap:6}}>
                      <span>⛔</span><span><strong>{staffName}</strong> is {staffAvailWarn.reason}</span>
                    </div>
                  );
                }
                if (staffAvailWarn.busy) {
                  return (
                    <div style={{padding:'8px 12px',borderRadius:8,background:C.amberBg,border:'1px solid #FDE68A',fontSize:12,color:C.warningText,display:'flex',alignItems:'center',gap:6}}>
                      <span>⚠️</span><span><strong>{staffName}</strong> {staffAvailWarn.reason}</span>
                    </div>
                  );
                }
                return null;
              })()}
              <div><label htmlFor="appt-notes" style={LBL}>Notes</label><input id="appt-notes" value={addDateForm.notes} onChange={e=>setAddDateForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes…" style={{...inputSt}}/></div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>{setShowAddDate(false);setAddDateConflict(null);setStaffAvailWarn(null);}}/>
              <PrimaryBtn label={saving?'Saving…':'Add date'} colorScheme="success" onClick={async()=>{if(!addDateForm.date){toast('Date required','warn');return;}const typeMap={'Measurements':'measurement','1st fitting':'try_on','2nd fitting':'try_on_2','Final fitting':'final_fitting','Dress pickup':'pickup','Dress return':'return','Planning consult':'consultation','Venue walkthrough':'walkthrough','Other':'other'};setSaving(true);const{error}=await createAppointment({type:typeMap[addDateForm.type]||'other',date:addDateForm.date,time:addDateForm.time,notes:addDateForm.notes,staff_id:addDateForm.staff_id||null});setSaving(false);if(error){toast('Failed to save','warn');return;}setShowAddDate(false);setAddDateConflict(null);setStaffAvailWarn(null);setAddDateForm({type:'Measurements',date:'',time:'10:00',staff_id:'',notes:''});toast('Date added ✓');}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT INSPIRATION MODAL ── */}
      {showEditInspiration&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-edit-inspiration-title" style={{background:C.white,borderRadius:16,width:460,maxHeight:'88dvh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-edit-inspiration-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Vision & inspiration</span>
              <button onClick={()=>setShowEditInspiration(false)} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:16}}>
              <div>
                <div style={{...LBL,marginBottom:8}}>Style themes</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {['Romantic','Classic & elegant','Modern / minimal','Rustic & boho','Glamorous','Garden & floral','Traditional','Cultural (Mexican)','Fairy tale','Tropical'].map(t=>{
                    const active=inspoForm.themes.includes(t);
                    return <button key={t} onClick={()=>setInspoForm(f=>({...f,themes:f.themes.includes(t)?f.themes.filter(x=>x!==t):[...f.themes,t]}))} style={{padding:'5px 12px',borderRadius:999,border:`1.5px solid ${active?C.rosa:C.border}`,background:active?C.rosaPale:C.white,color:active?C.rosaText:C.gray,fontSize:11,cursor:'pointer'}}>{t}</button>;
                  })}
                </div>
              </div>
              <div><label htmlFor="inspo-vision" style={LBL}>Vision notes</label><textarea id="inspo-vision" rows={4} value={inspoForm.vision} onChange={e=>setInspoForm(f=>({...f,vision:e.target.value}))} placeholder="Describe the client's dream event…" style={{...inputSt,resize:'vertical'}}/></div>
              <div><label htmlFor="inspo-florals" style={LBL}>Florals / decor notes</label><input id="inspo-florals" value={inspoForm.florals} onChange={e=>setInspoForm(f=>({...f,florals:e.target.value}))} placeholder="e.g. White roses, eucalyptus, gold accents" style={{...inputSt}}/></div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowEditInspiration(false)}/>
              <PrimaryBtn label={saving?'Saving…':'Save'} colorScheme="success" onClick={async()=>{if(updateEvent&&liveEvent?.id){setSaving(true);const{error}=await updateEvent(liveEvent.id,{inspiration_styles:inspoForm.themes.length?inspoForm.themes:null,inspiration_notes:inspoForm.vision||null,inspiration_florals:inspoForm.florals||null});setSaving(false);if(error){toast('Failed to save','warn');return;}}setShowEditInspiration(false);toast('Inspiration saved ✓');}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── MARK PAID MODAL ── */}
      {showMarkPaid&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-mark-paid-title" style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-mark-paid-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Mark as paid</span>
              <button onClick={()=>setShowMarkPaid(null)} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'10px 14px',background:C.grayBg,borderRadius:8,fontSize:12,color:C.gray}}>Marking <strong style={{color:C.ink}}>{showMarkPaid.label}</strong> as paid</div>
              <div><label htmlFor="paid-amount" style={LBL}>Amount collected ($)</label><input id="paid-amount" value={showMarkPaid.amount} readOnly style={{...inputSt,background:C.grayBg}} type="number"/></div>
              <div><label htmlFor="paid-method" style={LBL}>Payment method</label><select id="paid-method" value={paidForm.method} onChange={e=>setPaidForm(f=>({...f,method:e.target.value}))} style={{...inputSt}}><option>Cash</option><option>Zelle</option><option>Card</option><option>Other</option></select></div>
              <div><label htmlFor="paid-date" style={LBL}>Date received</label><input id="paid-date" value={paidForm.date} onChange={e=>setPaidForm(f=>({...f,date:e.target.value}))} style={{...inputSt}} type="date"/></div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowMarkPaid(null)}/><PrimaryBtn label={saving?'Saving…':'Save payment'} colorScheme="success" onClick={async()=>{if(!markPaid||!showMarkPaid.id){setShowMarkPaid(null);toast('Payment recorded ✓');return;}setSaving(true);const{error}=await markPaid(showMarkPaid.id,{payment_method:paidForm.method,paid_date:paidForm.date});setSaving(false);if(error)toast('Failed to save','warn');else{setShowMarkPaid(null);toast('Payment recorded ✓');}}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT EVENT MODAL ── */}
      {showEditEvent&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-edit-event-title" style={{background:C.white,borderRadius:16,width:460,maxHeight:'88dvh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-edit-event-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Edit event details</span>
              <button onClick={()=>setShowEditEvent(false)} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label htmlFor="evtedit-type" style={LBL}>Event type</label><select id="evtedit-type" value={editEvData.type||'wedding'} onChange={e=>setEditEvData(d=>({...d,type:e.target.value}))} style={{...inputSt}}>{Object.entries(EVT_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
                <div><label htmlFor="evtedit-date" style={LBL}>Event date</label><input id="evtedit-date" value={editEvData.event_date||''} onChange={e=>setEditEvData(d=>({...d,event_date:e.target.value}))} style={{...inputSt}} type="date"/></div>
              </div>
              <div><label htmlFor="evtedit-venue" style={LBL}>Venue</label><input id="evtedit-venue" value={editEvData.venue||''} onChange={e=>setEditEvData(d=>({...d,venue:e.target.value}))} style={{...inputSt}} placeholder="St. Anthony's Chapel"/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label htmlFor="evtedit-guests" style={LBL}>Guest count</label><input id="evtedit-guests" value={editEvData.guests||''} onChange={e=>setEditEvData(d=>({...d,guests:e.target.value}))} style={{...inputSt}} type="number"/></div>
                <div><label htmlFor="evtedit-total" style={LBL}>Contract value ($)</label><input id="evtedit-total" value={editEvData.total||''} onChange={e=>setEditEvData(d=>({...d,total:e.target.value}))} style={{...inputSt}} type="number"/></div>
              </div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowEditEvent(false)}/><PrimaryBtn label={saving?'Saving…':'Save changes'} colorScheme="success" onClick={async()=>{if(updateEvent&&liveEvent?.id){setSaving(true);const{error}=await updateEvent(liveEvent.id,{type:editEvData.type,event_date:editEvData.event_date||null,venue:editEvData.venue||null,guests:Number(editEvData.guests)||null,total:Number(editEvData.total)||null});setSaving(false);if(error){toast('Failed to save','warn');return;}}setShowEditEvent(false);toast('Event details saved');}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD TASK MODAL ── */}
      {showAddTask&&(
        <div role="presentation" className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-add-task-title" style={{background:C.white,borderRadius:16,width:440,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-add-task-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Add task</span>
              <button onClick={()=>setShowAddTask(false)} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div><label htmlFor="task-desc" style={LBL}>Task description</label><textarea id="task-desc" rows={3} value={newTask.text} onChange={e=>setNewTask(t=>({...t,text:e.target.value}))} style={{...inputSt,resize:'vertical'}} placeholder="Describe the task..."/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label htmlFor="task-cat" style={LBL}>Category</label><select id="task-cat" value={newTask.category} onChange={e=>setNewTask(t=>({...t,category:e.target.value}))} style={{...inputSt}}>{['Payment','Fitting','Rental','Deco','Planning','General'].map(c=><option key={c}>{c}</option>)}</select></div>
                <div><label htmlFor="task-priority" style={LBL}>Priority</label><select id="task-priority" value={newTask.priority} onChange={e=>setNewTask(t=>({...t,priority:e.target.value}))} style={{...inputSt}}><option>Normal</option><option>Alert (urgent)</option></select></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label htmlFor="task-assign" style={LBL}>Assign to</label>
                  <select id="task-assign" value={newTask.assigned_to_id} onChange={e=>{const m=staff.find(s=>s.id===e.target.value);setNewTask(t=>({...t,assigned_to_id:e.target.value,assigned_to_name:m?.name||''}));}} style={{...inputSt}}>
                    <option value="">Unassigned</option>
                    {staff.map(m=><option key={m.id} value={m.id}>{m.name||m.initials||'Staff'}</option>)}
                  </select>
                </div>
                <div><label htmlFor="task-due" style={LBL}>Due date (optional)</label><input id="task-due" type="date" value={newTask.due_date} onChange={e=>setNewTask(t=>({...t,due_date:e.target.value}))} style={{...inputSt}}/></div>
              </div>
              {newTask.assigned_to_id&&staff.find(s=>s.id===newTask.assigned_to_id)&&(
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:C.rosaPale,borderRadius:8,fontSize:12,color:C.rosaText}}>
                  <Avatar initials={staff.find(s=>s.id===newTask.assigned_to_id)?.initials||'?'} size={22} bg={staff.find(s=>s.id===newTask.assigned_to_id)?.color||C.rosa} color={C.white}/>
                  <span>Assigning to <strong>{staff.find(s=>s.id===newTask.assigned_to_id)?.name}</strong> — will appear in their My Tasks</span>
                </div>
              )}
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowAddTask(false)}/><PrimaryBtn label={saving?'Saving…':'Add task'} colorScheme="success" onClick={async()=>{if(!newTask.text.trim()){toast('Task description required','warn');return;}setSaving(true);await addTask({text:newTask.text.trim(),category:newTask.category,priority:newTask.priority,assigned_to_id:newTask.assigned_to_id||undefined,assigned_to_name:newTask.assigned_to_name||undefined,due_date:newTask.due_date||undefined});setSaving(false);setShowAddTask(false);setNewTask({text:'',category:'General',priority:'Normal',assigned_to_id:'',assigned_to_name:'',due_date:''});toast('Task added');}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE APPOINTMENT MODAL ── */}
      {showScheduleAppt&&(
        <AppointmentScheduler
          eventId={ev.id}
          clientId={ev.client_id}
          eventDate={ev.event_date}
          onSave={()=>{ setShowScheduleAppt(false); refetchEvent(); }}
          onClose={()=>setShowScheduleAppt(false)}
        />
      )}

      {/* ── DRESS RETURN MODAL ── */}
      {returnModal && (
        <div role="presentation" onClick={e => { if (e.target === e.currentTarget) setReturnModal(null); }}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="return-modal-title"
            style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'20px 20px 0'}}>
              <div id="return-modal-title" style={{fontSize:15,fontWeight:700,color:C.ink,marginBottom:4}}>Log dress return</div>
              <div style={{fontSize:12,color:C.gray,marginBottom:12}}>
                {returnModal.appt.note || returnModal.appt.type}
              </div>
              <label htmlFor="return-condition-notes" style={{fontSize:12,fontWeight:500,color:C.ink,display:'block',marginBottom:6}}>
                Condition notes <span style={{color:C.gray,fontWeight:400}}>(optional)</span>
              </label>
              <textarea
                id="return-condition-notes"
                value={returnNotes}
                onChange={e => setReturnNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Small stain on hem, no damage otherwise…"
                style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box'}}
              />
            </div>
            <div style={{padding:'12px 20px 20px',display:'flex',gap:8}}>
              <GhostBtn label="Cancel" onClick={() => setReturnModal(null)} style={{flex:1}}/>
              <button onClick={confirmReturn}
                style={{flex:1,padding:'9px 16px',borderRadius:8,border:'none',background:C.rosaSolid,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Confirm return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT REMINDER CONFIRM ── */}
      {reminderConfirm && (
        <div role="presentation" onClick={e => { if (e.target === e.currentTarget) setReminderConfirm(null); }}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="reminder-confirm-title"
            style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'20px 20px 12px',textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:8}}>📧</div>
              <div id="reminder-confirm-title" style={{fontSize:16,fontWeight:600,color:C.ink,marginBottom:8}}>
                Send payment reminder?
              </div>
              <div style={{fontSize:13,color:C.gray,marginBottom:4}}>
                <strong style={{color:C.ink}}>{reminderConfirm.m.label}</strong> — ${Number(reminderConfirm.m.amount).toFixed(2)}
              </div>
              <div style={{fontSize:12,color:C.gray}}>
                Email to: <strong>{reminderConfirm.clientEmail}</strong>
              </div>
            </div>
            <div style={{padding:'12px 20px 20px',display:'flex',gap:8}}>
              <GhostBtn label="Cancel" onClick={() => setReminderConfirm(null)} style={{flex:1}} disabled={sendingReminder}/>
              <button onClick={sendReminder} disabled={sendingReminder}
                style={{flex:1,padding:'9px 16px',borderRadius:8,border:'none',background:C.rosaSolid,color:'#fff',fontSize:13,fontWeight:600,cursor:sendingReminder?'not-allowed':'pointer',opacity:sendingReminder?0.7:1}}>
                {sendingReminder ? 'Sending…' : 'Send reminder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE EVENT CONFIRM ── */}
      {showDeleteConfirm && (
        <div role="presentation" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-delete-confirm-title" style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'20px 20px 0',textAlign:'center'}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:'var(--bg-danger)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="var(--color-danger)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div id="eventdetail-delete-confirm-title" style={{fontSize:16,fontWeight:600,color:C.ink,marginBottom:8}}>Delete this event?</div>
              <div style={{fontSize:13,color:C.gray,marginBottom:4}}>
                <strong style={{color:C.ink}}>{ev.client}</strong> — {ev.type} {ev.event_date ? `· ${new Date(ev.event_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : ''}
              </div>
              <div style={{fontSize:12,color:'var(--text-danger)',background:'var(--bg-danger)',borderRadius:8,padding:'8px 12px',margin:'12px 0'}}>
                This will permanently delete the event, all milestones, appointments, notes, and tasks. This cannot be undone.
              </div>
            </div>
            <div style={{padding:'12px 20px 20px',display:'flex',gap:8}}>
              <GhostBtn label="Cancel" onClick={()=>setShowDeleteConfirm(false)} style={{flex:1}}/>
              <button onClick={async()=>{
                const {error} = await deleteEvent(ev.id);
                if(error){toast('Failed to delete event','error');return;}
                toast('Event deleted');
                setShowDeleteConfirm(false);
                setScreen('events');
              }} style={{flex:1,padding:'9px 16px',borderRadius:8,border:'none',background:'var(--color-danger)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL INVOICE CONFIRM ── */}
      {showEmailInvoiceConfirm && (
        <div role="presentation" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-email-invoice-title" style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'20px 20px 0',textAlign:'center'}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:C.rosaPale,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',fontSize:22}}>📧</div>
              <div id="eventdetail-email-invoice-title" style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:8}}>Send payment receipt?</div>
              <div style={{fontSize:13,color:C.gray}}>
                Send payment receipt to <strong style={{color:C.ink}}>{ev.clientData?.email}</strong>?
              </div>
            </div>
            <div style={{padding:'16px 20px 20px',display:'flex',gap:8}}>
              <GhostBtn label="Cancel" onClick={()=>setShowEmailInvoiceConfirm(false)} style={{flex:1}}/>
              <PrimaryBtn label={sendingInvoice?'Sending…':'Send'} onClick={handleSendInvoice} style={{flex:1}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL COMPOSER ── */}
      {showEmailComposer && (
        <div role="presentation" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-email-client-title" style={{background:C.white,borderRadius:16,width:'100%',maxWidth:520,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',display:'flex',flexDirection:'column',maxHeight:'90dvh'}}>
            {/* Header */}
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <span id="eventdetail-email-client-title" style={{fontSize:15,fontWeight:600,color:C.ink}}>✉️ Email client</span>
              <button onClick={()=>setShowEmailComposer(false)} aria-label="Close" style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:18,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            {/* Body */}
            <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12,overflowY:'auto'}}>
              {/* To */}
              <div>
                <div id="email-to-label" style={LBL}>To</div>
                <div aria-labelledby="email-to-label" style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                  <span style={{display:'inline-flex',alignItems:'center',gap:4,background:C.rosaPale,color:C.rosaText,borderRadius:20,padding:'3px 10px',fontSize:12,fontWeight:500}}>
                    {ev.client} &lt;{ev.clientData?.email}&gt;
                  </span>
                </div>
              </div>
              {/* Subject */}
              <div>
                <label htmlFor="email-subject" style={LBL}>Subject</label>
                <input
                  id="email-subject"
                  value={emailSubject}
                  onChange={e=>setEmailSubject(e.target.value)}
                  style={{...inputSt,marginTop:4}}
                  placeholder="Subject…"
                />
              </div>
              {/* Body */}
              <div>
                <label htmlFor="email-body" style={LBL}>Message</label>
                <textarea
                  id="email-body"
                  value={emailBody}
                  onChange={e=>setEmailBody(e.target.value)}
                  rows={6}
                  style={{...inputSt,marginTop:4,resize:'vertical',minHeight:120,fontSize:14,fontFamily:'inherit'}}
                  placeholder="Write your message here…"
                />
              </div>
              {/* Quick inserts */}
              <div>
                <div id="email-quickinsert-label" style={{...LBL,marginBottom:6}}>Quick insert</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {(()=>{
                    const overdue = milestones.find(m=>m.status==='overdue'&&m.stripe_payment_link_url);
                    if(overdue) return (
                      <button key="pay" onClick={()=>setEmailBody(b=>b+(b?'\n':'')+overdue.stripe_payment_link_url)} style={{fontSize:11,padding:'4px 10px',borderRadius:20,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',color:C.ink}}>
                        Add payment link
                      </button>
                    );
                    return null;
                  })()}
                  {liveEvent?.portal_token && (
                    <button onClick={()=>setEmailBody(b=>b+(b?'\n':'')+`${window.location.origin}/portal/${liveEvent.portal_token}`)} style={{fontSize:11,padding:'4px 10px',borderRadius:20,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',color:C.ink}}>
                      Add portal link
                    </button>
                  )}
                  {(boutique?.booking_url||boutique?.slug) && (
                    <button onClick={()=>setEmailBody(b=>b+(b?'\n':'')+(boutique.booking_url||`${window.location.origin}/book/${boutique.slug}`))} style={{fontSize:11,padding:'4px 10px',borderRadius:20,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',color:C.ink}}>
                      Add booking link
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Footer */}
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,justifyContent:'flex-end',flexShrink:0}}>
              <GhostBtn label="Cancel" onClick={()=>setShowEmailComposer(false)}/>
              <PrimaryBtn label={sendingEmail?'Sending…':'Send email'} onClick={handleSendEmail}/>
            </div>
          </div>
        </div>
      )}
      {/* Receipt modal */}
      {showReceipt && (
        <div role="presentation" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-receipt-title" style={{background:C.white,borderRadius:16,width:'100%',maxWidth:420,boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>
            <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span id="eventdetail-receipt-title" style={{fontSize:14,fontWeight:600,color:C.ink}}>Payment Receipt</span>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>{
                  const w=window.open('','_blank','width=500,height=600');
                  w.document.write(`<html><head><title>Receipt</title><style>body{font-family:system-ui,sans-serif;padding:40px;color:#1C1012;}h2{margin:0 0 4px;}hr{border:none;border-top:1px solid #eee;margin:16px 0;}.row{display:flex;justify-content:space-between;margin:8px 0;font-size:14px;}.label{color:#6B7280;}.val{font-weight:600;}.total{font-size:18px;font-weight:700;color:#1C1012;}.footer{margin-top:32px;font-size:11px;color:#9CA3AF;}</style></head><body>
                  <h2>${boutique?.name||'Boutique'}</h2><p style="color:#6B7280;font-size:13px;margin:0 0 16px">${boutique?.phone||''} ${boutique?.email||''}</p>
                  <hr/>
                  <div class="row"><span class="label">Client</span><span class="val">${ev.client}</span></div>
                  <div class="row"><span class="label">Payment</span><span class="val">${showReceipt.label}</span></div>
                  <div class="row"><span class="label">Date paid</span><span class="val">${showReceipt.paid_date ? new Date(showReceipt.paid_date+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span></div>
                  <hr/>
                  <div class="row"><span class="label">Amount</span><span class="total">$${Number(showReceipt.amount||0).toLocaleString()}</span></div>
                  <hr/>
                  <div class="footer">Thank you! Generated by Belori · ${new Date().toLocaleDateString()}</div>
                  </body></html>`);
                  w.document.close();
                  setTimeout(()=>w.print(),300);
                }} style={{padding:'6px 14px',borderRadius:8,border:'none',background:C.rosa,color:'#fff',fontSize:12,fontWeight:500,cursor:'pointer'}}>🖨 Print</button>
                <button onClick={()=>setShowReceipt(null)} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:12,cursor:'pointer'}}>Close</button>
              </div>
            </div>
            <div style={{padding:'24px 28px'}}>
              <div style={{fontSize:16,fontWeight:700,color:C.ink,marginBottom:2}}>{boutique?.name||'Boutique'}</div>
              <div style={{fontSize:12,color:C.gray,marginBottom:20}}>{boutique?.phone||''}{boutique?.email?` · ${boutique.email}`:''}</div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,display:'flex',flexDirection:'column',gap:10}}>
                {[
                  {label:'Client', val:ev.client},
                  {label:'Payment', val:showReceipt.label},
                  {label:'Date paid', val:showReceipt.paid_date ? new Date(showReceipt.paid_date+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : 'Today'},
                ].map(({label,val})=>(
                  <div key={label} style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                    <span style={{color:C.gray}}>{label}</span>
                    <span style={{fontWeight:500,color:C.ink}}>{val}</span>
                  </div>
                ))}
                <div style={{borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:14,color:C.gray}}>Amount paid</span>
                  <span style={{fontSize:22,fontWeight:700,color:C.ink}}>{fmt(Number(showReceipt.amount||0))}</span>
                </div>
              </div>
              <div style={{marginTop:20,fontSize:11,color:C.gray,textAlign:'center'}}>Thank you for your payment! · Generated by Belori</div>
            </div>
          </div>
        </div>
      )}

      {/* Task template modal */}
      {showTemplateModal && (
        <div role="presentation" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-task-template-title" style={{background:C.white,borderRadius:16,width:'100%',maxWidth:460,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>
            <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
              <span id="eventdetail-task-template-title" style={{fontSize:14,fontWeight:600,color:C.ink}}>📋 Load Task Template</span>
              <button onClick={()=>setShowTemplateModal(false)} aria-label="Close" style={{background:'none',border:'none',fontSize:18,color:C.gray,cursor:'pointer',lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{padding:'16px 20px',overflowY:'auto',flex:1}}>
              <div style={{fontSize:12,color:C.gray,marginBottom:12}}>Select tasks to add to this event. Existing tasks won't be duplicated.</div>
              {(() => {
                const template = TASK_TEMPLATES[ev.type] || TASK_TEMPLATES.default;
                const existingTexts = tasks.map(t => t.text.toLowerCase());
                return (
                  <>
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                      {template.map((t, i) => {
                        const alreadyExists = existingTexts.includes(t.toLowerCase());
                        const isSelected = selectedTemplateTasks.includes(t);
                        return (
                          <label key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,background:alreadyExists?C.greenBg:isSelected?C.rosaPale:C.grayBg,cursor:alreadyExists?'default':'pointer',opacity:alreadyExists?0.6:1}}>
                            <input type="checkbox" checked={isSelected||alreadyExists} disabled={alreadyExists} onChange={()=>{ if(alreadyExists)return; setSelectedTemplateTasks(s=>s.includes(t)?s.filter(x=>x!==t):[...s,t]); }} style={{accentColor:C.rosa,flexShrink:0}}/>
                            <span style={{fontSize:12,color:alreadyExists?C.green:C.ink,flex:1}}>{t}</span>
                            {alreadyExists&&<span style={{fontSize:10,color:C.green}}>Already added</span>}
                          </label>
                        );
                      })}
                    </div>
                    <button onClick={async()=>{
                      const existingTexts2 = tasks.map(t=>t.text.toLowerCase());
                      for(const text of selectedTemplateTasks){
                        if(!existingTexts2.includes(text.toLowerCase())){
                          await addTask({text,category:'General',priority:'Normal'});
                        }
                      }
                      setShowTemplateModal(false);
                      toast(`${selectedTemplateTasks.length} task${selectedTemplateTasks.length!==1?'s':''} added ✓`);
                    }} style={{width:'100%',padding:'10px',borderRadius:8,border:'none',background:C.rosa,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                      Add {selectedTemplateTasks.length} selected task{selectedTemplateTasks.length!==1?'s':''}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── DRESS RECOMMENDATION MODAL ── */}
      {dressSuggestionsOpen && (() => {
        const dresses = getDressSuggestions(clientMeasurements, inventory);
        const hasMeasurements = clientMeasurements && (clientMeasurements.bust || clientMeasurements.waist);
        function ScoreDots({ score }) {
          const MAX = 8;
          const dotColors = ['var(--color-danger)','var(--color-warning)',C.amber,C.green,C.green];
          const filled = Math.min(score, MAX); // use 5 dots display max
          const displayMax = 5;
          const filledDots = Math.round((filled / MAX) * displayMax);
          const col = score >= 6 ? C.green : score >= 3 ? C.amber : C.gray;
          return (
            <span style={{display:'inline-flex',gap:2,alignItems:'center'}}>
              {Array.from({length: displayMax}).map((_, i) => (
                <span key={i} style={{fontSize:10, color: i < filledDots ? col : '#D1D5DB'}}>&#9679;</span>
              ))}
            </span>
          );
        }
        return (
          <div role="presentation" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:1000,padding:'20px 16px',overflowY:'auto'}}
            onClick={e=>{ if(e.target===e.currentTarget) setDressSuggestionsOpen(false); }}>
            <div role="dialog" aria-modal="true" aria-labelledby="eventdetail-dress-rec-title" style={{background:C.white,borderRadius:16,width:'100%',maxWidth:760,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',overflow:'hidden',marginTop:0}}>
              {/* Header */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px 14px',borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <div id="eventdetail-dress-rec-title" style={{fontSize:16,fontWeight:700,color:C.ink}}>👗 Dress Recommendations for {ev.client}</div>
                  {hasMeasurements ? (
                    <div style={{fontSize:12,color:C.gray,marginTop:3}}>
                      Scored by size, color, style &amp; budget match
                      {clientMeasurements?.bust && <span> · Bust: {clientMeasurements.bust}&quot;</span>}
                      {clientMeasurements?.waist && <span> · Waist: {clientMeasurements.waist}&quot;</span>}
                    </div>
                  ) : (
                    <div style={{fontSize:12,color:C.amber,marginTop:3}}>No measurements on file — showing all available gowns by price</div>
                  )}
                </div>
                <button onClick={()=>setDressSuggestionsOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:22,lineHeight:1,padding:'4px 8px'}}>&#215;</button>
              </div>
              {/* Body */}
              <div style={{padding:'16px 20px 20px'}}>
                {dresses.length === 0 ? (
                  <div style={{textAlign:'center',padding:'40px 20px',color:C.gray}}>
                    <div style={{fontSize:32,marginBottom:8}}>👗</div>
                    <div style={{fontSize:14,fontWeight:500,color:C.ink,marginBottom:4}}>No dresses available</div>
                    <div style={{fontSize:13}}>Check inventory for available bridal or quince gowns</div>
                  </div>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                    {dresses.map(dress => (
                      <div key={dress.id} style={{
                        border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 14px 12px',
                        display:'flex',flexDirection:'column',gap:6,background:C.grayBg,
                        boxSizing:'border-box'
                      }}>
                        {/* Name + SKU */}
                        <div style={{fontSize:13,fontWeight:600,color:C.ink,lineHeight:1.3}}>{dress.name || '—'}</div>
                        {dress.sku && <div style={{fontSize:10,color:C.gray,marginTop:-2}}>SKU: {dress.sku}</div>}
                        {/* Category badge + size + color */}
                        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:2}}>
                          <span style={{fontSize:10,padding:'2px 7px',borderRadius:999,background:dress.category==='bridal_gown'?C.rosaPale:C.amberBg,color:dress.category==='bridal_gown'?C.rosaText:C.warningText,fontWeight:600,textTransform:'capitalize'}}>
                            {dress.category === 'bridal_gown' ? 'Bridal' : 'Quince'}
                          </span>
                          {dress.size && <span style={{fontSize:10,padding:'2px 7px',borderRadius:999,background:C.blueBg,color:C.blue,fontWeight:500}}>Sz {dress.size}</span>}
                          {dress.color && <span style={{fontSize:10,padding:'2px 7px',borderRadius:999,background:'#F3F4F6',color:C.ink,fontWeight:400,textTransform:'capitalize'}}>{dress.color}</span>}
                        </div>
                        {/* Price + deposit */}
                        <div style={{fontSize:12,color:C.ink,marginTop:2}}>
                          <span style={{fontWeight:600}}>{fmt(dress.price||0)}</span>
                          {dress.deposit > 0 && <span style={{color:C.gray}}> · {fmt(dress.deposit)} deposit</span>}
                        </div>
                        {/* Match score dots */}
                        {hasMeasurements && (
                          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                            <ScoreDots score={dress.score} />
                            {dress.score > 0 && <span style={{fontSize:10,color:C.gray}}>{dress.matchNotes.join(' · ')}</span>}
                            {dress.score === 0 && <span style={{fontSize:10,color:C.gray}}>No match signals</span>}
                          </div>
                        )}
                        {/* Reserve button */}
                        <button
                          disabled={reservingDressId === dress.id}
                          onClick={()=>handleReserveDress(dress).then(()=>setDressSuggestionsOpen(false))}
                          style={{
                            marginTop:'auto',paddingTop:6,padding:'7px 0',borderRadius:7,border:'none',
                            background:reservingDressId===dress.id?C.border:C.rosa,
                            color:reservingDressId===dress.id?C.gray:C.white,
                            fontSize:12,fontWeight:600,cursor:reservingDressId===dress.id?'not-allowed':'pointer',width:'100%'
                          }}
                        >
                          {reservingDressId === dress.id ? 'Reserving…' : 'Reserve for this event'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default EventDetail;
