import React, { useState, useMemo } from 'react';
import { C, EVT_TYPES } from '../../lib/colors';
import { EventTypeBadge, ProgressBar } from '../../lib/ui.jsx';

// ─── PLANNING BOARD PANEL (merged from EventPlanning.jsx) ──────────────────
// Renders directly within the Coordinator role's "Planning Board" tab.
// Re-uses the same data that EventDetail already has (ev, tasks, appointments, milestones).
export const PLANNING_FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'week',      label: 'This Week' },
  { id: 'month',     label: 'This Month' },
  { id: 'attention', label: 'Needs Attention' },
];
export function planningNeedsAttention(ev) {
  return (
    (ev.tasks || []).some(t => !t.done && t.alert) ||
    (ev.overdue || 0) > 0 ||
    (ev.missingAppointments || []).length > 0
  );
}
function PlanningCountdownBadge({ daysUntil }) {
  const cfg = daysUntil <= 0  ? { text: 'Today!', bg: 'var(--bg-danger)',   color: 'var(--text-danger)'  }
            : daysUntil <= 7  ? { text: `${daysUntil}d`, bg: 'var(--bg-danger)',   color: 'var(--text-danger)'  }
            : daysUntil <= 30 ? { text: `${daysUntil}d`, bg: 'var(--bg-warning)', color: 'var(--text-warning)' }
            : { text: `${daysUntil}d`, bg: 'var(--bg-info)', color: 'var(--text-info)' };
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
              <span style={{ fontSize: 11, color: 'var(--text-danger)', fontWeight: 600, background: 'var(--bg-danger)', padding: '2px 7px', borderRadius: 6 }}>
                {totalAlertTasks} alert
              </span>
            )}
            {totalOverdue > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-warning)', fontWeight: 600, background: 'var(--bg-warning)', padding: '2px 7px', borderRadius: 6 }}>
                ${totalOverdue} overdue
              </span>
            )}
          </div>
        )}
        {/* Filter tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {PLANNING_FILTERS.map(f => (
            <button key={f.id} onClick={() => setPlanFilter(f.id)} style={{ flex: '1 1 0', padding: '8px 4px', fontSize: 10, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: planFilter === f.id ? C.rosaText : C.gray, borderBottom: planFilter === f.id ? `2px solid ${C.rosa}` : '2px solid transparent', whiteSpace: 'nowrap' }}>{f.label}</button>
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
                    <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? C.rosaText : C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientName}</div>
                    <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>{typeInfo.icon} {typeInfo.label} · {event.date}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {alertTask && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-danger)', display: 'block' }} />}
                    {overdue && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-warning)', display: 'block' }} />}
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
                    {(selectedPlanEvent.overdue || 0) > 0 && <span style={{ color: 'var(--text-danger)', fontWeight: 600 }}>${selectedPlanEvent.overdue} overdue</span>}
                  </div>
                  <ProgressBar paid={selectedPlanEvent.paid || 0} total={selectedPlanEvent.total} height={5} />
                </div>
              )}
              {selectedPlanEvent.id !== ev?.id && (
                <button onClick={() => { setSelectedEvent(selectedPlanEvent.id); setScreen('event_detail'); }} style={{ marginTop: 8, fontSize: 12, color: C.rosaText, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}>Open full detail →</button>
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
                    <div style={{ background: 'var(--bg-danger)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 12, color: 'var(--text-danger)', fontWeight: 500 }}>
                      ⚠ {alertTasks.length} alert task{alertTasks.length > 1 ? 's' : ''}: {alertTasks.slice(0,2).map(t => t.text).join(', ')}
                    </div>
                  )}
                  {openTasks.slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.alert ? 'var(--color-danger)' : C.border, flexShrink: 0 }} />
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
                    <div key={i} style={{ padding: '6px 10px', borderRadius: 7, background: 'var(--bg-warning)', color: 'var(--text-warning)', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
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

export default PlanningBoardPanel;
