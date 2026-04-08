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

// ─── PLANNING BOARD PANEL (merged from EventPlanning.jsx) ──────────────────
// Renders directly within the Coordinator role's "Planning Board" tab.
// Re-uses the same data that EventDetail already has (ev, tasks, appointments, milestones).
const PLANNING_FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'week',      label: 'This Week' },
  { id: 'month',     label: 'This Month' },
  { id: 'attention', label: 'Needs Attention' },
];
function planningNeedsAttention(ev) {
  return (
    (ev.tasks || []).some(t => !t.done && t.alert) ||
    (ev.overdue || 0) > 0 ||
    (ev.missingAppointments || []).length > 0
  );
}
function PlanningCountdownBadge({ daysUntil }) {
  const cfg = daysUntil <= 0  ? { text: 'Today!', bg: '#FEE2E2', color: '#B91C1C' }
            : daysUntil <= 7  ? { text: `${daysUntil}d`, bg: '#FEE2E2', color: '#B91C1C' }
            : daysUntil <= 30 ? { text: `${daysUntil}d`, bg: '#FEF3C7', color: '#B45309' }
            : { text: `${daysUntil}d`, bg: '#DBEAFE', color: '#1D4ED8' };
  return (
    <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, minWidth: 34, textAlign: 'center' }}>
      {cfg.text}
    </span>
  );
}
function PlanningBoardPanel({ ev, liveEvent, tasks, appointments, milestones, notes, staff, boutique, allEvents, setScreen, setSelectedEvent, createAppointment, addNote, updateEvent, refetchEvent, toggleTask, addTask, toast }) {
  // allEvents from parent — active events sorted by days until
  const activeEvents = useMemo(() =>
    (allEvents || [])
      .filter(e => e.status === 'active' && e.event_date)
      .sort((a, b) => a.daysUntil - b.daysUntil),
    [allEvents]
  );
  const [planFilter, setPlanFilter] = useState('all');
  const [selectedPlanId, setSelectedPlanId] = useState(ev?.id || null);

  const filteredPlan = useMemo(() => {
    switch (planFilter) {
      case 'week':      return activeEvents.filter(e => e.daysUntil <= 7);
      case 'month':     return activeEvents.filter(e => e.daysUntil <= 30);
      case 'attention': return activeEvents.filter(planningNeedsAttention);
      default:          return activeEvents;
    }
  }, [activeEvents, planFilter]);

  const totalAlertTasks = useMemo(() => activeEvents.reduce((sum, e) => sum + (e.tasks || []).filter(t => !t.done && t.alert).length, 0), [activeEvents]);
  const totalOverdue = useMemo(() => activeEvents.reduce((sum, e) => sum + (e.overdue || 0), 0), [activeEvents]);

  const selectedPlanEvent = activeEvents.find(e => e.id === selectedPlanId) || null;

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 480, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: C.white }}>
      {/* LEFT PANEL — event list */}
      <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Summary bar */}
        {(totalAlertTasks > 0 || totalOverdue > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.grayBg, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
            {totalAlertTasks > 0 && (
              <span style={{ fontSize: 11, color: '#B91C1C', fontWeight: 600, background: '#FEE2E2', padding: '2px 7px', borderRadius: 6 }}>
                {totalAlertTasks} alert
              </span>
            )}
            {totalOverdue > 0 && (
              <span style={{ fontSize: 11, color: '#B45309', fontWeight: 600, background: '#FEF3C7', padding: '2px 7px', borderRadius: 6 }}>
                ${totalOverdue} overdue
              </span>
            )}
          </div>
        )}
        {/* Filter tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {PLANNING_FILTERS.map(f => (
            <button key={f.id} onClick={() => setPlanFilter(f.id)} style={{ flex: '1 1 0', padding: '8px 4px', fontSize: 10, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: planFilter === f.id ? C.rosa : C.gray, borderBottom: planFilter === f.id ? `2px solid ${C.rosa}` : '2px solid transparent', whiteSpace: 'nowrap' }}>{f.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.gray, padding: '4px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>{filteredPlan.length} event{filteredPlan.length !== 1 ? 's' : ''}</div>
        {/* Event list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredPlan.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.gray, fontSize: 12 }}>No events match this filter</div>
          ) : (
            filteredPlan.map(event => {
              const clientName = typeof event.client === 'string' ? event.client : (event.clientData?.name || event.client || '—');
              const typeInfo = EVT_TYPES[event.type] || { label: event.type, icon: '📅' };
              const alertTask = (event.tasks || []).some(t => !t.done && t.alert);
              const overdue = (event.overdue || 0) > 0;
              const isSelected = event.id === selectedPlanId;
              return (
                <div key={event.id} onClick={() => { setSelectedPlanId(event.id); if (event.id !== ev?.id) { setSelectedEvent(event.id); setScreen('event_detail'); } }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', background: isSelected ? C.rosaPale : C.white, borderBottom: `1px solid ${C.border}`, transition: 'background 0.12s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.ivory; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = C.white; }}>
                  <PlanningCountdownBadge daysUntil={event.daysUntil} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? C.rosa : C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientName}</div>
                    <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>{typeInfo.icon} {typeInfo.label} · {event.date}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {alertTask && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#B91C1C', display: 'block' }} />}
                    {overdue && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#B45309', display: 'block' }} />}
                    {!alertTask && !overdue && <span style={{ fontSize: 10, color: C.green }}>✓</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL — selected event summary */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {selectedPlanEvent ? (
          <>
            {/* Header */}
            <div style={{ background: C.grayBg, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <EventTypeBadge type={selectedPlanEvent.type} />
                <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{typeof selectedPlanEvent.client === 'string' ? selectedPlanEvent.client : (selectedPlanEvent.clientData?.name || '—')}</span>
                <PlanningCountdownBadge daysUntil={selectedPlanEvent.daysUntil} />
              </div>
              <div style={{ fontSize: 12, color: C.gray }}>{selectedPlanEvent.date}{selectedPlanEvent.venue ? ` · ${selectedPlanEvent.venue}` : ''}</div>
              {selectedPlanEvent.total > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gray, marginBottom: 4 }}>
                    <span>${selectedPlanEvent.paid || 0} paid of ${selectedPlanEvent.total}</span>
                    {(selectedPlanEvent.overdue || 0) > 0 && <span style={{ color: '#B91C1C', fontWeight: 600 }}>${selectedPlanEvent.overdue} overdue</span>}
                  </div>
                  <ProgressBar paid={selectedPlanEvent.paid || 0} total={selectedPlanEvent.total} height={5} />
                </div>
              )}
              {selectedPlanEvent.id !== ev?.id && (
                <button onClick={() => { setSelectedEvent(selectedPlanEvent.id); setScreen('event_detail'); }} style={{ marginTop: 8, fontSize: 12, color: C.rosa, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}>Open full detail →</button>
              )}
              {selectedPlanEvent.id === ev?.id && (
                <span style={{ marginTop: 6, display: 'inline-block', fontSize: 11, color: C.green, fontWeight: 500 }}>✓ This event — use other tabs for full detail</span>
              )}
            </div>

            {/* Tasks */}
            {(()=>{
              const evTasks = selectedPlanEvent.tasks || [];
              const openTasks = evTasks.filter(t => !t.done);
              const alertTasks = openTasks.filter(t => t.alert);
              if (evTasks.length === 0) return <div style={{ fontSize: 12, color: C.gray, marginBottom: 12 }}>No tasks for this event.</div>;
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tasks ({openTasks.length} open)</div>
                  {alertTasks.length > 0 && (
                    <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 12, color: '#B91C1C', fontWeight: 500 }}>
                      ⚠ {alertTasks.length} alert task{alertTasks.length > 1 ? 's' : ''}: {alertTasks.slice(0,2).map(t => t.text).join(', ')}
                    </div>
                  )}
                  {openTasks.slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.alert ? '#B91C1C' : C.border, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: C.ink, flex: 1 }}>{t.text}</span>
                      <span style={{ fontSize: 10, color: C.gray }}>{t.category || ''}</span>
                    </div>
                  ))}
                  {openTasks.length > 5 && <div style={{ fontSize: 11, color: C.gray, paddingTop: 4 }}>+ {openTasks.length - 5} more tasks</div>}
                </div>
              );
            })()}

            {/* Appointments */}
            {(()=>{
              const evAppts = selectedPlanEvent.appointments || [];
              const missing = selectedPlanEvent.missingAppointments || [];
              if (evAppts.length === 0 && missing.length === 0) return null;
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Appointments</div>
                  {missing.map((m, i) => (
                    <div key={i} style={{ padding: '6px 10px', borderRadius: 7, background: '#FEF3C7', color: '#B45309', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
                      ⚠ No {((m?.type || m || '').toString()).replace(/_/g, ' ')} scheduled
                    </div>
                  ))}
                  {evAppts.slice(0, 3).map((a, i) => (
                    <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 12, color: C.ink, flex: 1 }}>{(a.type || '').replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 11, color: C.gray }}>{a.date || '—'}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.gray, gap: 8 }}>
            <span style={{ fontSize: 28 }}>📋</span>
            <span style={{ fontSize: 13 }}>Select an event to view details</span>
          </div>
        )}
      </div>
    </div>
  );
}

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
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'20px',overflowY:'auto'}}>
      <div style={{background:C.white,borderRadius:16,width:'100%',maxWidth:640,boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>
        <div style={{padding:'12px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',borderRadius:'16px 16px 0 0'}}>
          <span style={{fontSize:13,fontWeight:600,color:C.ink}}>🗓️ Day-of Schedule</span>
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
              <div style={{fontSize:14,fontWeight:700,color:C.rosa}}>{boutique?.name || ''}</div>
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
            <div style={{fontSize:10,color:C.rosa,fontWeight:500}}>{boutique?.name}</div>
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
          <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{padding:'8px 16px',border:`1px solid ${C.rosa}`,borderRadius:8,background:C.rosaPale,color:C.rosa,cursor:'pointer',fontSize:12,fontWeight:500}}>
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
                  <button onClick={async()=>{ if(!confirm(`Delete "${displayName}"?`))return; const {error}=await deleteFile(file.name); if(error)toast('Delete failed','error'); else toast('File deleted'); }} style={{padding:'5px 10px',border:'1px solid #FECACA',borderRadius:6,background:'#FFF5F5',color:'#DC2626',cursor:'pointer',fontSize:11}}>Delete</button>
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
          <span style={{fontSize:12,color:'#10B981'}}>Collected</span>
          <span style={{fontSize:13,fontWeight:600,color:'#10B981'}}>{fmt(p)}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,color:C.gray}}>Remaining</span>
          <span style={{fontSize:13,fontWeight:500,color:C.inkMid||C.gray}}>{fmt(remaining)}</span>
        </div>
        {overdue>0&&(
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#FEF2F2',borderRadius:6,padding:'4px 8px',marginTop:2}}>
            <span style={{fontSize:12,color:'#DC2626',fontWeight:500}}>⚠ Overdue</span>
            <span style={{fontSize:13,fontWeight:700,color:'#DC2626'}}>{fmt(overdue)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const EventDetail = ({eventId,setScreen,setSelectedEvent,allEvents,updateEvent,deleteEvent,markPaid,createMilestone,deleteMilestone,createJob,updateJob,updateClient,updateDress,staff=[],inventory=[],logRefund,logTip,refunds=[]}) => {
  const toast = useToast();
  const { myRole, boutique, session } = useAuth();
  const hasPro = useRequiresPlan('pro');
  const { event: liveEvent, loading: eventLoading, createAppointment, toggleService, addDecoItem, removeDecoItem, updateDecoItem, refetch: refetchEvent } = useEvent(eventId);
  const rescheduleEvent = boutique ? makeRescheduleEvent(boutique.id) : null;
  const { notes, addNote } = useNotes(liveEvent?.id);
  const { tasks: liveTasks, toggleTask: toggleLiveTask, addTask: addLiveTask } = useTasks(liveEvent?.id);
  const { files, loading: filesLoading, uploadFile, deleteFile, getPublicUrl, formatBytes, getFileIcon } = useEventFiles(liveEvent?.id);
  // useSwipe MUST be called here (before any conditional returns) — Rules of Hooks
  const swipeBack = useSwipe({ onSwipeRight: () => setScreen('events') });

  // ── Role selector (persisted per event in localStorage) ──────────────────
  const roleKey = `belori_event_role_${eventId}`;
  const [role, setRoleState] = useState(() => localStorage.getItem(roleKey) || 'coordinator');
  const setRole = (r) => { setRoleState(r); localStorage.setItem(roleKey, r); };

  // ── Coordinator sub-tab (within Coordinator role) ─────────────────────────
  const [coordTab, setCoordTab] = useState('appointments');

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

  const [showDeleteConfirm,setShowDeleteConfirm]=useState(false);
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
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showOverflow,showScheduleAppt,showAddTask,showAddMilestone,showEditEvent,showMarkPaid,showEmailComposer,showDeleteConfirm,showDayOf,showRunsheet,showReschedule,showContractModal,dressSuggestionsOpen]);
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
  const [dressSuggestionsOpen,setDressSuggestionsOpen]=useState(false);
  const [reservingDressId,setReservingDressId]=useState(null);
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
    supabase.from('contracts').select('*').eq('event_id',liveEvent.id).order('created_at',{ascending:false})
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

  const urgencyBadge = daysUntil<=0?{label:'Today!',bg:'var(--bg-danger)',col:'var(--color-danger)'}:daysUntil<=3?{label:`${daysUntil}d away`,bg:'var(--bg-danger)',col:'var(--color-danger)'}:daysUntil<=14?{label:`${daysUntil} days away`,bg:'var(--bg-warning)',col:'var(--color-warning)'}:{label:`${daysUntil} days away`,bg:'var(--bg-success)',col:'var(--color-success)'};

  async function handleAddNote(){if(!note.trim())return;await addNote(note);setNote('');toast('Note added');}

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
        body: { to_email: clientEmail, to_name: ev.client, subject: `Payment receipt — ${boutiqueName}`, html, pdf_url: receiptUrl }
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
      await navigator.clipboard.writeText(receiptUrl).catch(()=>{});
      toast('Receipt link copied — email not configured yet. Log recorded.');
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
        body: { to_email: clientEmail, to_name: ev.client, subject: emailSubject, html }
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
      await navigator.clipboard.writeText(data.url);
      setCopiedPayLinkId(m.id);
      setTimeout(() => setCopiedPayLinkId(null), 2000);
      toast('Payment link created & copied to clipboard ✓');
      await refetchEvent();
    } catch { toast('Could not generate link', 'error'); }
  };

  const copyContractLink = (c) => {
    const link = `${window.location.origin}/sign/${c.sign_token}`;
    navigator.clipboard.writeText(link);
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

  const TASK_CAT_COLORS={Payment:{bg:'var(--bg-danger)',col:'var(--color-danger)'},Fitting:{bg:'var(--bg-info)',col:'var(--color-info)'},Rental:{bg:'var(--bg-primary)',col:'var(--color-primary)'},Deco:{bg:'var(--bg-warning)',col:'var(--color-warning)'},Planning:{bg:'var(--bg-accent)',col:'var(--color-accent)'},General:{bg:C.grayBg,col:C.gray}};

  return (
    <div {...swipeBack} style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* ── STICKY TOPBAR ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',height:52,background:C.white,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
          <button onClick={()=>setScreen('events')} style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:C.gray,cursor:'pointer',background:'none',border:'none',padding:'8px 6px',minHeight:44}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Events
          </button>
          <span style={{color:C.borderDark,fontSize:14}}>›</span>
          <span style={{fontSize:13,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:240}}>{ev.client}</span>
        </div>
        <div className="topbar-actions" style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}>
          {/* ── Role selector pills ── */}
          <div style={{display:'flex',alignItems:'center',gap:2,padding:'3px 3px',border:`1px solid ${C.border}`,borderRadius:24,background:C.grayBg,flexShrink:0}}>
            {[
              { id: 'overview',     label: '👁️ Overview',     sub: 'Client · payments',      activeColor: C.gray,    activeBg: '#E5E7EB', activeText: C.ink      },
              { id: 'coordinator',  label: '🎯 Coordinator',  sub: 'Tasks · appointments',   activeColor: C.rosa,    activeBg: C.rosaPale, activeText: C.rosa    },
              { id: 'decoration',   label: '🌸 Decoration',   sub: 'Florals · inventory',    activeColor: '#0D9488', activeBg: '#F0FDFA', activeText: '#0D9488' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                style={{
                  padding: '4px 10px', borderRadius: 20,
                  border: role === r.id ? `1px solid ${r.activeColor}30` : '1px solid transparent',
                  background: role === r.id ? r.activeBg : 'transparent',
                  color: role === r.id ? r.activeText : C.gray,
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 0,
                }}
              >
                <span style={{fontSize: 12, fontWeight: role === r.id ? 600 : 400, whiteSpace: 'nowrap', lineHeight: 1.4}}>{r.label}</span>
                <span style={{fontSize: 10, whiteSpace: 'nowrap', lineHeight: 1.3, opacity: role === r.id ? 0.75 : 0.55}}>{r.sub}</span>
              </button>
            ))}
          </div>
          {/* ── Print summary toggle ── */}
          <button className="btn-icon" onClick={()=>setShowPrint(p=>!p)} title="Print summary" style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.border}`,borderRadius:8,background:showPrint?C.rosaPale:C.white,cursor:'pointer',color:showPrint?C.rosa:C.gray,flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="1" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 7H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1" stroke="currentColor" strokeWidth="1.3"/><rect x="3" y="10" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="9" r="0.8" fill="currentColor"/></svg>
          </button>
          {/* ── Primary action ── */}
          <PrimaryBtn label="+ Add service" onClick={()=>setShowAddService(true)} style={{padding:'7px 14px',fontSize:12,flexShrink:0}}/>
          {/* ── Overflow "···" menu ── */}
          <div ref={overflowRef} style={{position:'relative',flexShrink:0}}>
            <button onClick={()=>setShowOverflow(s=>!s)} title="More actions"
              style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${showOverflow?C.rosa:C.border}`,borderRadius:8,background:showOverflow?C.rosaPale:C.white,cursor:'pointer',color:showOverflow?C.rosa:C.gray,gap:2}}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg>
            </button>
            {showOverflow&&(
              <div style={{position:'absolute',top:'calc(100% + 6px)',right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:400,minWidth:220,overflow:'hidden'}}>
                {[
                  { label:'📅 Reschedule event',    action:()=>{setRescheduleDate(ev.event_date||'');setShowReschedule(true);} },
                  { label:'🗓️ Day-of schedule',      action:()=>setShowDayOf(true) },
                  { label:'📋 Run sheet',            action:()=>setShowRunsheet(true) },
                  { label:'🤖 AI contract draft',    action:handleAIDraftContract },
                  { label:'📧 Email invoice',        action:()=>{ if(!ev.clientData?.email){toast('Client has no email on file','error');return;} setShowEmailInvoiceConfirm(true); } },
                  { label:'✉️ Email client',         action:()=>{ setEmailSubject(`Re: Your ${ev.type} with ${boutique?.name||'us'}`); setEmailBody(''); setShowEmailComposer(true); } },
                  { label:'⬇️ Download contract PDF', action:handleDownloadContract },
                  { label:'📆 Add to calendar (.ics)', action:()=>{
                    if(!ev.event_date)return;
                    const d=ev.event_date.replace(/-/g,'');
                    const title=`${ev.client}${ev.type==='wedding'?' Wedding':ev.type==='quince'?' Quinceañera':' Event'}`;
                    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Belori//EN','BEGIN:VEVENT',`UID:${ev.id}@belori.app`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${d}`,`SUMMARY:${title}`,`LOCATION:${ev.venue||''}`,`DESCRIPTION:Managed by Belori\\nGuests: ${ev.guests||'TBD'}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
                    const blob=new Blob([ics],{type:'text/calendar'});
                    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${title.replace(/\s+/g,'-').toLowerCase()}.ics`;a.click();URL.revokeObjectURL(a.href);
                    toast('Calendar file downloaded ✓');
                  }},
                  { label:'🔗 Copy event link',      action:()=>{navigator.clipboard.writeText(window.location.href).then(()=>toast('Internal link copied ✓'));} },
                  { label:'🪪 Copy client portal',   action:()=>{if(!liveEvent?.portal_token){toast('Portal link not available','error');return;}navigator.clipboard.writeText(`${window.location.origin}/portal/${liveEvent.portal_token}`).then(()=>toast('Portal link copied!'));} },
                  { label:'📝 Copy questionnaire',   action:()=>{if(!liveEvent?.portal_token){toast('Portal link not available','error');return;}navigator.clipboard.writeText(`${window.location.origin}/questionnaire/${liveEvent.portal_token}`).then(()=>toast('Questionnaire link copied!'));} },
                  ...(myRole==='owner'&&deleteEvent ? [{ label:'🗑️ Delete event', action:()=>setShowDeleteConfirm(true), danger:true }] : []),
                ].map((item,i)=>(
                  <button key={i} onClick={()=>{item.action();setShowOverflow(false);}}
                    style={{display:'flex',alignItems:'center',width:'100%',padding:'11px 16px',background:'transparent',border:'none',
                      borderTop:i>0?`1px solid ${C.border}`:'none',cursor:'pointer',fontSize:13,textAlign:'left',
                      color:item.danger?'#DC2626':C.ink,fontWeight:item.danger?500:400}}
                    onMouseEnter={e=>e.currentTarget.style.background=item.danger?'#FFF5F5':C.grayBg}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {item.label}
                  </button>
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
          <span style={{fontSize:11,color:C.amber,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>View tasks →</span>
        </div>
      )}

      <div className="page-scroll" style={{flex:1,overflowY:'auto'}}>

        {/* ═══════════════════════════════════════════════════════════════════
            OVERVIEW ROLE
        ═══════════════════════════════════════════════════════════════════ */}
        {role === 'overview' && (()=>{
          const nextUnpaid = milestones.filter(m => m.status !== 'paid').sort((a,b)=>{
            if(!a.due_date) return 1; if(!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
          })[0] || null;
          const nextAppt = appointments.filter(a => a.date && new Date(a.date+'T00:00') >= new Date()).sort((a,b)=>new Date(a.date)-new Date(b.date))[0] || null;
          const typeInfo = EVT_TYPES[ev.type] || { label: ev.type, icon: '📅' };
          return (
            <div style={{padding:'20px 20px 32px',maxWidth:900,margin:'0 auto'}}>
              {/* ── Financial summary ring ── */}
              <FinancialRing total={ev.total} paid={ev.paid} milestones={milestones}/>
              {/* ── Two-column overview grid ── */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16,marginBottom:16}}>
                {/* Left: Event info card */}
                <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'20px 20px 16px',display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <EventTypeBadge type={ev.type}/>
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:999,background:urgencyBadge.bg,color:urgencyBadge.col,fontWeight:700}}>{urgencyBadge.label}</span>
                  </div>
                  <div style={{fontSize:24,fontWeight:600,color:C.ink,fontFamily:'Georgia,serif',lineHeight:1.2}}>{ev.client}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:C.gray}}>
                      <span>📅</span>
                      <span>{ev.event_date ? new Date(ev.event_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '—'}</span>
                    </div>
                    {ev.venue && (
                      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:C.gray}}>
                        <span>📍</span><span>{ev.venue}</span>
                      </div>
                    )}
                    {ev.guests && (
                      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:C.gray}}>
                        <span>👥</span><span>~{ev.guests} guests</span>
                      </div>
                    )}
                  </div>
                  <div style={{paddingTop:8,borderTop:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:11,padding:'3px 9px',borderRadius:999,background:ev.status==='completed'?C.greenBg:ev.status==='cancelled'?C.redBg:C.rosaPale,color:ev.status==='completed'?C.green:ev.status==='cancelled'?C.red:C.rosa,fontWeight:600}}>
                      {ev.status==='completed'?'Completed':ev.status==='cancelled'?'Cancelled':'Active'}
                    </span>
                    {ev.services?.length > 0 && (
                      <span style={{fontSize:11,color:C.gray}}>{ev.services.length} service{ev.services.length!==1?'s':''}</span>
                    )}
                  </div>
                </div>

                {/* Right: Action items */}
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {/* Next payment */}
                  <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'14px 16px'}}>
                    <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Next Payment</div>
                    {nextUnpaid ? (
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:C.ink}}>{nextUnpaid.label}</div>
                          <div style={{fontSize:12,color:C.gray,marginTop:2}}>
                            {fmt(nextUnpaid.amount)}
                            {nextUnpaid.due_date && ` · Due ${new Date(nextUnpaid.due_date+'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
                            {nextUnpaid.status==='overdue' && <span style={{color:C.red,fontWeight:600}}> · OVERDUE</span>}
                          </div>
                        </div>
                        <button
                          onClick={()=>{ setPaidForm({method:'Cash',date:new Date().toISOString().slice(0,10)}); setShowMarkPaid(nextUnpaid); }}
                          style={{padding:'6px 12px',borderRadius:8,border:'none',background:C.rosa,color:C.white,fontSize:12,fontWeight:600,cursor:'pointer',flexShrink:0}}
                        >Mark paid</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:C.green,fontWeight:500}}>
                        <span>✅</span><span>All paid</span>
                      </div>
                    )}
                  </div>

                  {/* Next appointment */}
                  <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'14px 16px'}}>
                    <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Next Appointment</div>
                    {nextAppt ? (
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:C.ink}}>{(nextAppt.type||'').replace(/_/g,' ')}</div>
                        <div style={{fontSize:12,color:C.gray,marginTop:2}}>
                          {nextAppt.date}
                          {nextAppt.time && ` · ${nextAppt.time.slice(0,5)}`}
                        </div>
                      </div>
                    ) : (
                      <div style={{fontSize:13,color:C.gray}}>No upcoming appointments</div>
                    )}
                  </div>

                  {/* Quick note */}
                  <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:'14px 16px'}}>
                    <div style={{fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Quick Note</div>
                    <textarea
                      rows={3}
                      value={overviewNote}
                      onChange={e=>setOverviewNote(e.target.value)}
                      onBlur={()=>{ if(overviewNote.trim()) saveOverviewNote(); }}
                      placeholder="Add a quick note for this event…"
                      style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px',fontSize:12,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box',color:C.ink,outline:'none'}}
                    />
                    {overviewNote.trim() && (
                      <button onClick={saveOverviewNote} disabled={overviewNoteSaving} style={{marginTop:6,padding:'5px 12px',borderRadius:7,border:'none',background:C.rosa,color:C.white,fontSize:12,fontWeight:500,cursor:'pointer'}}>
                        {overviewNoteSaving ? 'Saving…' : 'Save note'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Bottom quick actions ── */}
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                <button onClick={()=>setRole('coordinator')} style={{padding:'10px 20px',borderRadius:10,border:`1px solid ${C.rosa}`,background:C.rosaPale,color:C.rosa,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  Switch to Coordinator →
                </button>
                <button onClick={()=>setRole('decoration')} style={{padding:'10px 20px',borderRadius:10,border:'1px solid #0D9488',background:'#F0FDFA',color:'#0D9488',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  Switch to Decoration →
                </button>
                {['wedding','quince'].includes(ev?.type) && (
                  <button onClick={()=>setDressSuggestionsOpen(true)} style={{padding:'10px 20px',borderRadius:10,border:`1px solid ${C.rosa}`,background:C.rosaPale,color:C.rosa,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                    👗 Suggest dress
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════════
            DECORATION ROLE
        ═══════════════════════════════════════════════════════════════════ */}
        {role === 'decoration' && (
          <div style={{display:'flex',flexDirection:'column',gap:0}}>
            {/* Compact header */}
            <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:'10px 20px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <EventTypeBadge type={ev.type}/>
              <span style={{fontSize:14,fontWeight:600,color:C.ink}}>{ev.client}</span>
              {ev.event_date && (
                <span style={{fontSize:12,color:C.gray}}>
                  📅 {new Date(ev.event_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                </span>
              )}
              {ev.venue && <span style={{fontSize:12,color:C.gray}}>📍 {ev.venue}</span>}
            </div>

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
                              <button onClick={()=>deleteChecklistItem(idx)} style={{background:'none',border:'none',color:C.gray,cursor:'pointer',fontSize:14,padding:'0 2px',lineHeight:1,flexShrink:0,opacity:0.5}}>×</button>
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

        {/* ═══════════════════════════════════════════════════════════════════
            COORDINATOR ROLE — tab bar + content
        ═══════════════════════════════════════════════════════════════════ */}
        {role === 'coordinator' && (<>

        {/* ── COORDINATOR TAB BAR ── */}
        <div style={{display:'flex',overflowX:'auto',padding:'0 16px',gap:0,borderBottom:`1px solid ${C.border}`,background:C.white,flexShrink:0,WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
          {[
            { key: 'appointments', label: '📅 Appointments' },
            { key: 'payments', label: '💳 Payments' },
            { key: 'tasks', label: '✅ Tasks' },
            { key: 'guests', label: `👥 Guests${guestListData.length > 0 ? ` (${guestListData.length})` : ''}` },
            { key: 'notes', label: '📝 Notes' },
            { key: 'files', label: '📎 Files' },
            { key: 'vendors', label: '🤝 Vendors' },
            // planning tab hidden until Wedding Planner add-on ships
          ].map(tab => (
            <button key={tab.key} onClick={()=>setCoordTab(tab.key)} style={{flexShrink:0,padding:'12px 14px',border:'none',background:'none',color:coordTab===tab.key?C.rosa:C.gray,fontSize:12,fontWeight:coordTab===tab.key?600:400,cursor:'pointer',whiteSpace:'nowrap',borderBottom:coordTab===tab.key?`2px solid ${C.rosa}`:'2px solid transparent',marginBottom:-1,display:'flex',alignItems:'center',gap:5}}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── COORDINATOR TAB PANELS ── */}
        <div className="page-scroll-inner" style={{flex:1,padding:'16px 20px 32px',maxWidth:1100,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>

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
              {/* UPCOMING */}
              <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.ink}}>🕐 Upcoming appointments</span>
                  <button onClick={()=>setShowScheduleAppt(true)} style={{fontSize:12,color:C.rosa,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>+ Schedule</button>
                </div>
                {upcomingAppts.length>0?upcomingAppts.map((a,i)=>{
                  const st=a.status||'scheduled';
                  const bc={upcoming:{bg:'var(--bg-warning)',col:'var(--color-warning)',txt:'Upcoming'},missing:{bg:'var(--bg-danger)',col:'var(--color-danger)',txt:'Urgent'},scheduled:{bg:C.grayBg,col:C.gray,txt:'Scheduled'}}[st]||{bg:C.grayBg,col:C.gray,txt:'Scheduled'};
                  return(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 16px',borderBottom:i<upcomingAppts.length-1?`1px solid ${C.border}`:'none'}}>
                      <Avatar initials={a.staff?String(a.staff).split(' ').map(w=>w[0]).join('').slice(0,2):'?'} size={28} bg={C.purpleBg} color={C.purple}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:500,color:st==='missing'?'var(--color-danger)':C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.type?.replace(/_/g,' ')||'Appointment'}</div>
                        <div style={{fontSize:10,color:C.gray}}>{a.staff||''}{a.date?' · '+a.date:''}{a.time?' · '+a.time.slice(0,5):''}</div>
                      </div>
                      <Badge text={bc.txt} bg={bc.bg} color={bc.col}/>
                    </div>
                  );
                }):(
                  <div style={{padding:'18px 16px',textAlign:'center',fontSize:12,color:C.gray}}>No upcoming appointments.<br/><span onClick={()=>setShowScheduleAppt(true)} style={{color:C.rosa,cursor:'pointer',fontWeight:500}}>+ Schedule →</span></div>
                )}
              </div>
              {/* ALL DATES TIMELINE */}
              <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.ink}}>⏰ Important dates</span>
                  <button onClick={()=>setShowAddDate(true)} style={{fontSize:12,color:C.rosa,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>+ Add</button>
                </div>
                <div style={{padding:'12px 16px'}}>
                  {appointments.map((a,i)=>{
                    const st=a.status||'scheduled';
                    const dotFill={done:'var(--color-primary)',missing:'var(--color-danger)',upcoming:'transparent',scheduled:'transparent'}[st]||'transparent';
                    const dotBorder={done:'none',missing:'none',upcoming:`2px solid ${C.borderDark}`,scheduled:`2px solid ${C.border}`}[st]||`2px solid ${C.border}`;
                    return(
                      <div key={i} style={{display:'flex',gap:8}}>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:3}}>
                          <div style={{width:9,height:9,borderRadius:'50%',background:dotFill,border:dotBorder,flexShrink:0}}/>
                          {i<appointments.length-1&&<div style={{width:1,flex:1,minHeight:14,background:C.border,margin:'2px 0'}}/>}
                        </div>
                        <div style={{flex:1,paddingBottom:8,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:4}}>
                            <div style={{minWidth:0}}>
                              <div style={{fontSize:11,fontWeight:500,color:st==='missing'?'var(--color-danger)':st==='done'?C.gray:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.type?.replace(/_/g,' ')||'Appointment'}</div>
                              {a.note&&<div style={{fontSize:10,color:C.gray,marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.note}</div>}
                            </div>
                            <div style={{flexShrink:0,textAlign:'right'}}>
                              <div style={{fontSize:10,color:C.gray}}>{a.date||''}</div>
                              {a.date && st !== 'missing' && (
                                <span
                                  onClick={() => downloadApptIcs(a, ev.client, boutique)}
                                  style={{fontSize:10,color:C.rosa,fontWeight:500,cursor:'pointer',display:'block',marginTop:1}}
                                  title="Add to calendar"
                                >📆 Calendar</span>
                              )}
                              {st==='missing'&&<span onClick={()=>setShowScheduleAppt(true)} style={{fontSize:10,color:C.rosa,fontWeight:500,cursor:'pointer'}}>Schedule →</span>}
                            </div>
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
              {hasPro && milestones.length > 0 && (paymentRisk || paymentRiskLoading) && (()=>{
                if (paymentRiskLoading) return (
                  <div key="risk-loading" style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:8,background:C.grayBg,fontSize:12,color:C.gray}}>
                    ✨ Analyzing payment risk…
                  </div>
                );
                if (!paymentRisk) return null;
                const riskConfig = {
                  low:    {bg:'#F0FDF4',col:'#166534',dot:'#22C55E',label:'Low risk'},
                  medium: {bg:'#FFFBEB',col:'#92400E',dot:'#F59E0B',label:'Medium risk'},
                  high:   {bg:'#FEF2F2',col:'#991B1B',dot:'#EF4444',label:'High risk'},
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
                    <button onClick={() => setPaymentRisk(null)} style={{background:'none',border:'none',cursor:'pointer',color:riskConfig.col,fontSize:16,lineHeight:1,padding:0,minHeight:'unset',opacity:0.5}}>×</button>
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
                boutique={boutique}
                onReorder={async (newOrder) => {
                  await Promise.all(newOrder.map((m, i) =>
                    supabase.from('payment_milestones').update({ sort_order: i }).eq('id', m.id)
                  ));
                  await refetchEvent();
                }}
                onMarkPaid={(m) => { setPaidForm({method:'Cash',date:new Date().toISOString().slice(0,10)}); setShowMarkPaid(m); }}
                onRemind={async (m) => {
                  const clientEmail = ev.clientData?.email;
                  if (!clientEmail) { toast('Client email is missing', 'error'); return; }
                  const origin = window.location.origin;
                  const portalUrl = ev.portal_token ? `${origin}/portal/${ev.portal_token}` : origin;
                  const payBtn = m.stripe_payment_link_url
                    ? `<p style="margin:16px 0"><a href="${m.stripe_payment_link_url}" style="display:inline-block;padding:12px 24px;background:#C9697A;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">💳 Pay $${m.amount} online →</a></p>`
                    : `<p><a href="${portalUrl}">View your client portal →</a></p>`;
                  const { error } = await supabase.functions.invoke('send-email', {
                    body: {
                      to: clientEmail,
                      subject: `Payment Reminder: ${m.label}`,
                      html: `<p>Hi ${ev.client.split(' ')[0]},</p><p>This is a friendly reminder that your payment for <strong>${m.label}</strong> in the amount of <strong>$${m.amount}</strong> is currently due.</p>${payBtn}<p>Thank you!</p>`
                    }
                  });
                  if (error) { toast('Failed to send reminder', 'error'); } else { toast('Reminder email sent ✓'); }
                }}
                logRefund={logRefund}
                onLogTip={logTip}
                refunds={refunds}
              />
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
                      <button onClick={()=>{if(checkList.length===0){startChecklistWithDefaults();}else{setChecklistAdding(true);}}} style={{fontSize:11,color:C.rosa,background:'none',border:'none',cursor:'pointer',fontWeight:500,padding:'2px 6px'}}>+ Add item</button>
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
                          <span onClick={startChecklistWithDefaults} style={{color:C.rosa,cursor:'pointer',fontWeight:500}}>+ Add items or load defaults</span>
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
                            <button onClick={()=>deleteChecklistItem(idx)} style={{background:'none',border:'none',color:C.gray,cursor:'pointer',fontSize:14,padding:'0 2px',lineHeight:1,flexShrink:0,opacity:0.5}}>×</button>
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
            <StaffNotesCard
              notes={notes}
              note={note}
              setNote={setNote}
              handleAddNote={handleAddNote}
            />
          )}

          {/* FILES TAB */}
          {coordTab === 'files' && (
            <FilesPanel files={files} filesLoading={filesLoading} uploadFile={uploadFile} deleteFile={deleteFile} getPublicUrl={getPublicUrl} formatBytes={formatBytes} getFileIcon={getFileIcon} toast={toast} />
          )}

          {/* VENDORS TAB */}
          {coordTab === 'vendors' && (
            <EventVendorsCard eventId={eventId}/>
          )}

        </div>{/* end coordinator tab panels */}

        </>)}{/* end coordinator role */}

        {/* end role panels */}

      </div>{/* end page-scroll outer */}

      {/* ── AI CONTRACT DRAFT MODAL ── */}
      {showAIContractModal&&(
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1010,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:'100%',maxWidth:640,maxHeight:'88dvh',display:'flex',flexDirection:'column',boxShadow:'0 24px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div>
                <div style={{fontSize:16,fontWeight:600,color:C.ink}}>🤖 AI Contract Draft</div>
                <div style={{fontSize:11,color:C.gray,marginTop:2}}>AI-generated — review carefully before sending to client</div>
              </div>
              <button onClick={()=>{setShowAIContractModal(false);setAiContractText('');setAiContractCopied(false);}} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:22,lineHeight:1,minHeight:'unset',minWidth:'unset'}}>×</button>
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
                    await navigator.clipboard.writeText(aiContractText);
                    setAiContractCopied(true);
                    setTimeout(()=>setAiContractCopied(false),2000);
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
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:C.white,borderRadius:16,padding:28,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:16,fontWeight:600,color:C.ink,marginBottom:6}}>📅 Reschedule Event</div>
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
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Services</span>
              <button onClick={()=>setShowAddService(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:10}}>
              <div style={{fontSize:12,color:C.gray,marginBottom:4}}>Toggle services included in this event:</div>
              {[['dress_rental','👗 Dress rental'],['alterations','✂ Alterations'],['planning','📋 Planning'],['decoration','⭐ Decoration']].map(([key,label])=>{
                const active=ev.services?.includes(key);
                return(
                  <button key={key} onClick={async()=>{await toggleService?.(key);toast(active?`${label} removed`:`${label} added`);}} style={{padding:'12px 16px',borderRadius:10,border:`1.5px solid ${active?C.rosa:C.border}`,background:active?C.rosaPale:C.white,color:active?C.rosa:C.ink,fontSize:13,cursor:'pointer',fontWeight:active?500:400,textAlign:'left'}}>
                    {label} {active&&<span style={{float:'right',fontSize:10,color:C.rosa}}>✓ Active</span>}
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
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Edit rental</span>
              <button onClick={()=>setShowEditRental(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{padding:'10px 14px',background:C.grayBg,borderRadius:8,fontSize:12,fontWeight:500,color:C.ink}}>{dressRental.name} · #{dressRental.sku}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><div style={{...LBL}}>Pickup date</div><input type="date" value={rentalForm.pickup_date} onChange={e=>setRentalForm(f=>({...f,pickup_date:e.target.value}))} style={{...inputSt}}/></div>
                <div><div style={{...LBL}}>Return due</div><input type="date" value={rentalForm.return_date} onChange={e=>setRentalForm(f=>({...f,return_date:e.target.value}))} style={{...inputSt}}/></div>
              </div>
              <div><div style={{...LBL}}>Rental fee ($)</div><input type="number" value={rentalForm.fee} onChange={e=>setRentalForm(f=>({...f,fee:e.target.value}))} style={{...inputSt}}/></div>
              <div><div style={{...LBL}}>Deposit status</div><select value={rentalForm.deposit_paid?'paid':'pending'} onChange={e=>setRentalForm(f=>({...f,deposit_paid:e.target.value==='paid'}))} style={{...inputSt}}><option value="paid">Deposit paid</option><option value="pending">Deposit pending</option></select></div>
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
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:440,maxHeight:'88dvh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Add alteration job</span>
              <button onClick={()=>setShowAddAlt(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div><div style={{...LBL}}>Garment</div><input value={newAlt.garment} onChange={e=>setNewAlt(a=>({...a,garment:e.target.value}))} placeholder="e.g. Bridal gown #BB-047" style={{...inputSt}}/></div>
              <div><div style={{...LBL}}>Work needed</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
                  {['Hem','Bustle','Waist take-in','Let out','Custom beading','Other'].map(w=>{
                    const sel=newAlt.work.includes(w);
                    return(<button key={w} onClick={()=>setNewAlt(a=>({...a,work:sel?a.work.filter(x=>x!==w):[...a.work,w]}))} style={{padding:'5px 12px',borderRadius:999,border:`1.5px solid ${sel?C.rosa:C.border}`,background:sel?C.rosaPale:C.white,color:sel?C.rosa:C.gray,fontSize:11,cursor:'pointer'}}>{w}</button>);
                  })}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><div style={{...LBL}}>Seamstress</div><select value={newAlt.seamstress_id} onChange={e=>setNewAlt(a=>({...a,seamstress_id:e.target.value}))} style={{...inputSt}}><option value="">Unassigned</option>{staff.filter(s=>s.role==='Seamstress'||s.role==='seamstress'||s.role==='Owner'||s.role==='owner').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><div style={{...LBL}}>Deadline</div><input type="date" value={newAlt.deadline} onChange={e=>setNewAlt(a=>({...a,deadline:e.target.value}))} style={{...inputSt}}/></div>
              </div>
              <div><div style={{...LBL}}>Quoted price ($)</div><input type="number" value={newAlt.price} onChange={e=>setNewAlt(a=>({...a,price:e.target.value}))} placeholder="0.00" style={{...inputSt}}/></div>
              <div><div style={{...LBL}}>Notes</div><textarea rows={2} value={newAlt.notes} onChange={e=>setNewAlt(a=>({...a,notes:e.target.value}))} placeholder="Special instructions…" style={{...inputSt,resize:'vertical'}}/></div>
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
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Update alteration status</span>
              <button onClick={()=>setShowEditAlt(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{padding:'10px 14px',background:C.grayBg,borderRadius:8,fontSize:12,fontWeight:500,color:C.ink}}>{alteration.garment||'Alteration job'}</div>
              <div><div style={{...LBL}}>Status</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[['measurement_needed','Needs measurement'],['in_progress','In progress'],['fitting_scheduled','Fitting scheduled'],['complete','Complete']].map(([s,label])=>(
                    <button key={s} onClick={()=>setAltEditForm(f=>({...f,status:s}))} style={{padding:'10px',borderRadius:8,border:`1.5px solid ${altEditForm.status===s?C.rosa:C.border}`,background:altEditForm.status===s?C.rosaPale:C.white,color:altEditForm.status===s?C.rosa:C.gray,fontSize:11,cursor:'pointer',fontWeight:altEditForm.status===s?500:400}}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><div style={{...LBL}}>Seamstress</div><select value={altEditForm.seamstress_id} onChange={e=>setAltEditForm(f=>({...f,seamstress_id:e.target.value}))} style={{...inputSt}}><option value="">Unassigned</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><div style={{...LBL}}>Deadline</div><input type="date" value={altEditForm.deadline} onChange={e=>setAltEditForm(f=>({...f,deadline:e.target.value}))} style={{...inputSt}}/></div>
              </div>
              <div><div style={{...LBL}}>Quoted price ($)</div><input type="number" value={altEditForm.price} onChange={e=>setAltEditForm(f=>({...f,price:e.target.value}))} style={{...inputSt}}/></div>
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
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Edit client info</span>
              <button onClick={()=>setShowEditClient(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div><div style={{...LBL}}>Client name</div><input value={clientForm.name} onChange={e=>setClientForm(f=>({...f,name:e.target.value}))} style={{...inputSt}}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><div style={{...LBL}}>Phone</div><input value={clientForm.phone} onChange={e=>setClientForm(f=>({...f,phone:e.target.value}))} placeholder="(956) 214-8830" style={{...inputSt}}/></div>
                <div><div style={{...LBL}}>Email</div><input type="email" value={clientForm.email} onChange={e=>setClientForm(f=>({...f,email:e.target.value}))} placeholder="client@email.com" style={{...inputSt}}/></div>
              </div>
              <div><div style={{...LBL}}>Preferred language</div><select value={clientForm.language_preference} onChange={e=>setClientForm(f=>({...f,language_preference:e.target.value}))} style={{...inputSt}}><option value="">—</option><option value="en">English</option><option value="es">Spanish</option><option value="both">EN / ES</option></select></div>
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
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Add important date</span>
              <button onClick={()=>{setShowAddDate(false);setAddDateConflict(null);setStaffAvailWarn(null);}} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div><div style={{...LBL}}>Appointment type</div><select value={addDateForm.type} onChange={e=>setAddDateForm(f=>({...f,type:e.target.value}))} style={{...inputSt}}>{['Measurements','1st fitting','2nd fitting','Final fitting','Dress pickup','Dress return','Planning consult','Venue walkthrough','Other'].map(t=><option key={t}>{t}</option>)}</select></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><div style={{...LBL}}>Date</div><input type="date" value={addDateForm.date} onChange={e=>{const d=e.target.value;setAddDateForm(f=>({...f,date:d}));setAddDateConflict(checkConflict(d,addDateForm.time,addDateForm.staff_id||null));checkStaffAvailability(addDateForm.staff_id,d,addDateForm.time);}} style={{...inputSt}}/></div>
                <div><div style={{...LBL}}>Time</div><input type="time" value={addDateForm.time} onChange={e=>{const t=e.target.value;setAddDateForm(f=>({...f,time:t}));setAddDateConflict(checkConflict(addDateForm.date,t,addDateForm.staff_id||null));checkStaffAvailability(addDateForm.staff_id,addDateForm.date,t);}} style={{...inputSt}}/></div>
              </div>
              {addDateConflict&&(()=>{
                const c=addDateConflict[0];
                const cStaff=c.staff_id?staff.find(s=>s.id===c.staff_id)?.name:null;
                const cTime=c.time?(()=>{const[h,m]=c.time.split(':').map(Number);const ampm=h>=12?'PM':'AM';const hh=h%12||12;return `${hh}:${String(m).padStart(2,'0')} ${ampm}`;})():null;
                return (
                  <div style={{padding:'8px 12px',borderRadius:8,background:'#FEF3C7',border:'1px solid #FDE68A',fontSize:12,color:'#92400E'}}>
                    ⚠️ {cStaff?<><strong>{cStaff}</strong> already has</>:'There is already'} a <strong>{c.type}</strong> appointment{cTime?' at '+cTime:''} on this date — you can still save.
                  </div>
                );
              })()}
              <div><div style={{...LBL}}>Assigned staff</div><select value={addDateForm.staff_id} onChange={e=>{const sid=e.target.value;setAddDateForm(f=>({...f,staff_id:sid}));setAddDateConflict(checkConflict(addDateForm.date,addDateForm.time,sid||null));setStaffAvailWarn(null);checkStaffAvailability(sid,addDateForm.date,addDateForm.time);}} style={{...inputSt}}><option value="">Unassigned</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
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
                    <div style={{padding:'8px 12px',borderRadius:8,background:C.amberBg,border:'1px solid #FDE68A',fontSize:12,color:C.amber,display:'flex',alignItems:'center',gap:6}}>
                      <span>⚠️</span><span><strong>{staffName}</strong> {staffAvailWarn.reason}</span>
                    </div>
                  );
                }
                return null;
              })()}
              <div><div style={{...LBL}}>Notes</div><input value={addDateForm.notes} onChange={e=>setAddDateForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes…" style={{...inputSt}}/></div>
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
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:460,maxHeight:'88dvh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Vision & inspiration</span>
              <button onClick={()=>setShowEditInspiration(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:16}}>
              <div>
                <div style={{...LBL,marginBottom:8}}>Style themes</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {['Romantic','Classic & elegant','Modern / minimal','Rustic & boho','Glamorous','Garden & floral','Traditional','Cultural (Mexican)','Fairy tale','Tropical'].map(t=>{
                    const active=inspoForm.themes.includes(t);
                    return <button key={t} onClick={()=>setInspoForm(f=>({...f,themes:f.themes.includes(t)?f.themes.filter(x=>x!==t):[...f.themes,t]}))} style={{padding:'5px 12px',borderRadius:999,border:`1.5px solid ${active?C.rosa:C.border}`,background:active?C.rosaPale:C.white,color:active?C.rosa:C.gray,fontSize:11,cursor:'pointer'}}>{t}</button>;
                  })}
                </div>
              </div>
              <div><div style={{...LBL}}>Vision notes</div><textarea rows={4} value={inspoForm.vision} onChange={e=>setInspoForm(f=>({...f,vision:e.target.value}))} placeholder="Describe the client's dream event…" style={{...inputSt,resize:'vertical'}}/></div>
              <div><div style={{...LBL}}>Florals / decor notes</div><input value={inspoForm.florals} onChange={e=>setInspoForm(f=>({...f,florals:e.target.value}))} placeholder="e.g. White roses, eucalyptus, gold accents" style={{...inputSt}}/></div>
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
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Mark as paid</span>
              <button onClick={()=>setShowMarkPaid(null)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'10px 14px',background:C.grayBg,borderRadius:8,fontSize:12,color:C.gray}}>Marking <strong style={{color:C.ink}}>{showMarkPaid.label}</strong> as paid</div>
              <div><div style={{...LBL}}>Amount collected ($)</div><input value={showMarkPaid.amount} readOnly style={{...inputSt,background:C.grayBg}} type="number"/></div>
              <div><div style={{...LBL}}>Payment method</div><select value={paidForm.method} onChange={e=>setPaidForm(f=>({...f,method:e.target.value}))} style={{...inputSt}}><option>Cash</option><option>Zelle</option><option>Card</option><option>Other</option></select></div>
              <div><div style={{...LBL}}>Date received</div><input value={paidForm.date} onChange={e=>setPaidForm(f=>({...f,date:e.target.value}))} style={{...inputSt}} type="date"/></div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>setShowMarkPaid(null)}/><PrimaryBtn label={saving?'Saving…':'Save payment'} colorScheme="success" onClick={async()=>{if(!markPaid||!showMarkPaid.id){setShowMarkPaid(null);toast('Payment recorded ✓');return;}setSaving(true);const{error}=await markPaid(showMarkPaid.id,{payment_method:paidForm.method,paid_date:paidForm.date});setSaving(false);if(error)toast('Failed to save','warn');else{setShowMarkPaid(null);toast('Payment recorded ✓');}}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT EVENT MODAL ── */}
      {showEditEvent&&(
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:460,maxHeight:'88dvh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Edit event details</span>
              <button onClick={()=>setShowEditEvent(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><div style={{...LBL}}>Event type</div><select value={editEvData.type||'wedding'} onChange={e=>setEditEvData(d=>({...d,type:e.target.value}))} style={{...inputSt}}>{Object.entries(EVT_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
                <div><div style={{...LBL}}>Event date</div><input value={editEvData.event_date||''} onChange={e=>setEditEvData(d=>({...d,event_date:e.target.value}))} style={{...inputSt}} type="date"/></div>
              </div>
              <div><div style={{...LBL}}>Venue</div><input value={editEvData.venue||''} onChange={e=>setEditEvData(d=>({...d,venue:e.target.value}))} style={{...inputSt}} placeholder="St. Anthony's Chapel"/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><div style={{...LBL}}>Guest count</div><input value={editEvData.guests||''} onChange={e=>setEditEvData(d=>({...d,guests:e.target.value}))} style={{...inputSt}} type="number"/></div>
                <div><div style={{...LBL}}>Contract value ($)</div><input value={editEvData.total||''} onChange={e=>setEditEvData(d=>({...d,total:e.target.value}))} style={{...inputSt}} type="number"/></div>
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
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:440,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Add task</span>
              <button onClick={()=>setShowAddTask(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div><div style={{...LBL}}>Task description</div><textarea rows={3} value={newTask.text} onChange={e=>setNewTask(t=>({...t,text:e.target.value}))} style={{...inputSt,resize:'vertical'}} placeholder="Describe the task..."/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><div style={{...LBL}}>Category</div><select value={newTask.category} onChange={e=>setNewTask(t=>({...t,category:e.target.value}))} style={{...inputSt}}>{['Payment','Fitting','Rental','Deco','Planning','General'].map(c=><option key={c}>{c}</option>)}</select></div>
                <div><div style={{...LBL}}>Priority</div><select value={newTask.priority} onChange={e=>setNewTask(t=>({...t,priority:e.target.value}))} style={{...inputSt}}><option>Normal</option><option>Alert (urgent)</option></select></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <div style={{...LBL}}>Assign to</div>
                  <select value={newTask.assigned_to_id} onChange={e=>{const m=staff.find(s=>s.id===e.target.value);setNewTask(t=>({...t,assigned_to_id:e.target.value,assigned_to_name:m?.name||''}));}} style={{...inputSt}}>
                    <option value="">Unassigned</option>
                    {staff.map(m=><option key={m.id} value={m.id}>{m.name||m.initials||'Staff'}</option>)}
                  </select>
                </div>
                <div><div style={{...LBL}}>Due date (optional)</div><input type="date" value={newTask.due_date} onChange={e=>setNewTask(t=>({...t,due_date:e.target.value}))} style={{...inputSt}}/></div>
              </div>
              {newTask.assigned_to_id&&staff.find(s=>s.id===newTask.assigned_to_id)&&(
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:C.rosaPale,borderRadius:8,fontSize:12,color:C.rosa}}>
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
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Schedule appointment</span>
              <button onClick={()=>{setShowScheduleAppt(false);setApptConflict(null);}} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div><div style={{...LBL}}>Appointment type</div><select value={newAppt.type} onChange={e=>setNewAppt(a=>({...a,type:e.target.value}))} style={{...inputSt}}>{['Measurements','1st fitting','Final fitting','Dress pickup','Planning consult','Other'].map(t=><option key={t}>{t}</option>)}</select></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><div style={{...LBL}}>Date</div><input value={newAppt.date} onChange={e=>{const d=e.target.value;setNewAppt(a=>({...a,date:d}));setApptConflict(checkConflict(d,newAppt.time,newAppt.staff_id||null));}} style={{...inputSt}} type="date"/></div>
                <div><div style={{...LBL}}>Time</div><input value={newAppt.time} onChange={e=>{const t=e.target.value;setNewAppt(a=>({...a,time:t}));setApptConflict(checkConflict(newAppt.date,t,newAppt.staff_id||null));}} style={{...inputSt}} type="time"/></div>
              </div>
              <div><div style={{...LBL}}>Assigned staff</div><select value={newAppt.staff_id} onChange={e=>{const sid=e.target.value;setNewAppt(a=>({...a,staff_id:sid}));setApptConflict(checkConflict(newAppt.date,newAppt.time,sid||null));}} style={{...inputSt}}><option value="">Unassigned</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              {apptConflict&&(()=>{
                const c=apptConflict[0];
                const cStaff=c.staff_id?staff.find(s=>s.id===c.staff_id)?.name:null;
                const cTime=c.time?(()=>{const[h,m]=c.time.split(':').map(Number);const ampm=h>=12?'PM':'AM';const hh=h%12||12;return `${hh}:${String(m).padStart(2,'0')} ${ampm}`;})():null;
                return (
                  <div style={{padding:'8px 12px',borderRadius:8,background:'#FEF3C7',border:'1px solid #FDE68A',fontSize:12,color:'#92400E'}}>
                    ⚠️ {cStaff?<><strong>{cStaff}</strong> already has</>:'There is already'} a <strong>{c.type}</strong> appointment{cTime?' at '+cTime:''} on this date — you can still save.
                  </div>
                );
              })()}
              <div><div style={{...LBL}}>Notes (optional)</div><textarea rows={2} value={newAppt.notes} onChange={e=>setNewAppt(a=>({...a,notes:e.target.value}))} style={{...inputSt,resize:'none'}} placeholder="Any special instructions..."/></div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={()=>{setShowScheduleAppt(false);setApptConflict(null);}}/><PrimaryBtn label={saving?'Saving…':'Schedule appointment'} onClick={async()=>{if(!newAppt.date){toast('Date required','warn');return;}const typeMap={'Measurements':'measurement','1st fitting':'try_on','Final fitting':'final_fitting','Dress pickup':'pickup','Planning consult':'consultation','Other':'other'};const apptType=typeMap[newAppt.type]||'other';if(createAppointment&&liveEvent?.id){setSaving(true);const{error}=await createAppointment({type:apptType,date:newAppt.date,time:newAppt.time,notes:newAppt.notes,staff_id:newAppt.staff_id||null});setSaving(false);if(error){toast('Failed to schedule','warn');return;}}setShowScheduleAppt(false);setApptConflict(null);setNewAppt({type:'Measurements',date:'',time:'13:00',notes:'',staff_id:''});toast('Appointment scheduled');}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE EVENT CONFIRM ── */}
      {showDeleteConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'20px 20px 0',textAlign:'center'}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:'#FEE2E2',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{fontSize:16,fontWeight:600,color:C.ink,marginBottom:8}}>Delete this event?</div>
              <div style={{fontSize:13,color:C.gray,marginBottom:4}}>
                <strong style={{color:C.ink}}>{ev.client}</strong> — {ev.type} {ev.event_date ? `· ${new Date(ev.event_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : ''}
              </div>
              <div style={{fontSize:12,color:'#DC2626',background:'#FEF2F2',borderRadius:8,padding:'8px 12px',margin:'12px 0'}}>
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
              }} style={{flex:1,padding:'9px 16px',borderRadius:8,border:'none',background:'#DC2626',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL INVOICE CONFIRM ── */}
      {showEmailInvoiceConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:400,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'20px 20px 0',textAlign:'center'}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:C.rosaPale,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',fontSize:22}}>📧</div>
              <div style={{fontSize:15,fontWeight:600,color:C.ink,marginBottom:8}}>Send payment receipt?</div>
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
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:'100%',maxWidth:520,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',display:'flex',flexDirection:'column',maxHeight:'90dvh'}}>
            {/* Header */}
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:600,color:C.ink}}>✉️ Email client</span>
              <button onClick={()=>setShowEmailComposer(false)} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:18,lineHeight:1,padding:4}}>×</button>
            </div>
            {/* Body */}
            <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12,overflowY:'auto'}}>
              {/* To */}
              <div>
                <div style={{...LBL}}>To</div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                  <span style={{display:'inline-flex',alignItems:'center',gap:4,background:C.rosaPale,color:C.rosa,borderRadius:20,padding:'3px 10px',fontSize:12,fontWeight:500}}>
                    {ev.client} &lt;{ev.clientData?.email}&gt;
                  </span>
                </div>
              </div>
              {/* Subject */}
              <div>
                <div style={{...LBL}}>Subject</div>
                <input
                  value={emailSubject}
                  onChange={e=>setEmailSubject(e.target.value)}
                  style={{...inputSt,marginTop:4}}
                  placeholder="Subject…"
                />
              </div>
              {/* Body */}
              <div>
                <div style={{...LBL}}>Message</div>
                <textarea
                  value={emailBody}
                  onChange={e=>setEmailBody(e.target.value)}
                  rows={6}
                  style={{...inputSt,marginTop:4,resize:'vertical',minHeight:120,fontSize:14,fontFamily:'inherit'}}
                  placeholder="Write your message here…"
                />
              </div>
              {/* Quick inserts */}
              <div>
                <div style={{...LBL,marginBottom:6}}>Quick insert</div>
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
      {/* ── DRESS RECOMMENDATION MODAL ── */}
      {dressSuggestionsOpen && (() => {
        const dresses = getDressSuggestions(clientMeasurements, inventory);
        const hasMeasurements = clientMeasurements && (clientMeasurements.bust || clientMeasurements.waist);
        function ScoreDots({ score }) {
          const MAX = 8;
          const dotColors = ['#DC2626','#D97706','#B45309','#15803D','#15803D'];
          const filled = Math.min(score, MAX); // use 5 dots display max
          const displayMax = 5;
          const filledDots = Math.round((filled / MAX) * displayMax);
          const col = score >= 6 ? '#15803D' : score >= 3 ? '#B45309' : '#6B7280';
          return (
            <span style={{display:'inline-flex',gap:2,alignItems:'center'}}>
              {Array.from({length: displayMax}).map((_, i) => (
                <span key={i} style={{fontSize:10, color: i < filledDots ? col : '#D1D5DB'}}>&#9679;</span>
              ))}
            </span>
          );
        }
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:1000,padding:'20px 16px',overflowY:'auto'}}
            onClick={e=>{ if(e.target===e.currentTarget) setDressSuggestionsOpen(false); }}>
            <div style={{background:C.white,borderRadius:16,width:'100%',maxWidth:760,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',overflow:'hidden',marginTop:0}}>
              {/* Header */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px 14px',borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.ink}}>👗 Dress Recommendations for {ev.client}</div>
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
                          <span style={{fontSize:10,padding:'2px 7px',borderRadius:999,background:dress.category==='bridal_gown'?C.rosaPale:C.amberBg,color:dress.category==='bridal_gown'?C.rosa:C.amber,fontWeight:600,textTransform:'capitalize'}}>
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
