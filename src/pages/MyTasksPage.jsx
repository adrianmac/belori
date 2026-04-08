import React, { useState, useEffect, useMemo } from 'react';
import { C, EVT_TYPES } from '../lib/colors';
import { Topbar, Avatar, Badge, useToast } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ─── CATEGORY COLORS ────────────────────────────────────────────────────────
const TASK_CAT_COLORS = {
  Planning:  { bg: C.purpleBg, col: C.purple },
  Vendor:    { bg: C.blueBg,   col: C.blue },
  Payment:   { bg: '#DCFCE7',  col: '#166534' },
  Fitting:   { bg: C.amberBg,  col: C.amber },
  Rental:    { bg: C.rosaPale, col: C.rosa },
  Deco:      { bg: '#E0F2FE',  col: '#0369A1' },
  General:   { bg: C.grayBg,   col: C.gray },
};

function catStyle(cat) {
  return TASK_CAT_COLORS[cat] || { bg: C.grayBg, col: C.gray };
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  // dateStr is 'YYYY-MM-DD'
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isDueDateOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

function isDueToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr === today;
}

function isDueThisWeek(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 7);
  const todayStr = today.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  return dateStr >= todayStr && dateStr <= endStr;
}

function isCompletedThisWeek(task) {
  if (!task.done || !task.done_at) return false;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return new Date(task.done_at) >= weekAgo;
}

const FILTER_TABS = [
  { id: 'all',          label: 'All' },
  { id: 'event_tasks',  label: 'Event Tasks' },
  { id: 'client_tasks', label: 'Client Tasks' },
  { id: 'overdue',      label: 'Overdue' },
  { id: 'done',         label: 'Done' },
];

// Sort: overdue first, then by due_date asc, then undated
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const aOver = !a.done && isDueDateOverdue(a.due_date);
    const bOver = !b.done && isDueDateOverdue(b.due_date);
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return 1;
    // both overdue or neither overdue — sort by due_date
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return 0;
  });
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────
function TaskCard({ task, onToggleDone }) {
  const isOverdue = !task.done && isDueDateOverdue(task.due_date);
  const isToday   = !task.done && isDueToday(task.due_date);

  const dueDateColor = isOverdue ? C.red : isToday ? C.amber : C.gray;
  const dueDateBg    = isOverdue ? C.redBg : isToday ? C.amberBg : C.grayBg;

  const hasAlert = task.alert || task.is_alert;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 16px',
        borderBottom: `1px solid ${C.border}`,
        background: hasAlert && !task.done ? '#FEF2F2' : C.white,
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!hasAlert || task.done) e.currentTarget.style.background = C.grayBg; }}
      onMouseLeave={e => { e.currentTarget.style.background = hasAlert && !task.done ? '#FEF2F2' : C.white; }}
      onClick={() => onToggleDone(task)}
    >
      {/* Checkbox */}
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
        border: `1.5px solid ${task.done ? 'var(--color-success)' : hasAlert ? C.red : C.border}`,
        background: task.done ? 'var(--color-success)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && (
          <svg width="8" height="8" viewBox="0 0 10 10">
            <path d="M2 5l2.5 2.5L8 2" stroke={C.white} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 13, color: task.done ? C.gray : hasAlert ? C.red : C.ink,
            textDecoration: task.done ? 'line-through' : 'none',
            lineHeight: 1.45, flex: 1, minWidth: 0,
          }}>{task.text}</span>
          {hasAlert && !task.done && (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 999,
              background: C.redBg, color: C.red, fontWeight: 600, flexShrink: 0,
            }}>Urgent</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
          {/* Source badge */}
          {task._source && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999,
              background: task._sourceType === 'event' ? C.rosaPale : C.blueBg,
              color: task._sourceType === 'event' ? C.rosa : C.blue,
              fontWeight: 500, whiteSpace: 'nowrap',
            }}>{task._source}</span>
          )}

          {/* Category */}
          {task.category && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999,
              background: catStyle(task.category).bg,
              color: catStyle(task.category).col,
              fontWeight: 500,
            }}>{task.category}</span>
          )}

          {/* Due date */}
          {task.due_date && !task.done && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999,
              background: dueDateBg, color: dueDateColor, fontWeight: 500,
            }}>
              {isOverdue ? 'Overdue · ' : isToday ? 'Today · ' : ''}{formatDate(task.due_date)}
            </span>
          )}

          {/* Done timestamp */}
          {task.done && task.done_at && (
            <span style={{ fontSize: 10, color: C.gray }}>
              Done {new Date(task.done_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {task.done_by_name ? ` · ${task.done_by_name}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function MyTasksPage({ setScreen, setSelectedEvent }) {
  const toast = useToast();
  const { boutique, session } = useAuth();
  const [eventTasks, setEventTasks] = useState([]);
  const [clientTasks, setClientTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const userId = session?.user?.id;
  const today = new Date().toISOString().slice(0, 10);

  // Fetch current user's boutique_member record to get name
  const [currentMember, setCurrentMember] = useState(null);
  useEffect(() => {
    if (!boutique || !userId) return;
    supabase
      .from('boutique_members')
      .select('id, name, initials, color')
      .eq('boutique_id', boutique.id)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (data) setCurrentMember(data); });
  }, [boutique?.id, userId]);

  async function loadTasks() {
    setLoading(true);
    await Promise.all([loadEventTasks(), loadClientTasks()]);
    setLoading(false);
  }

  async function loadEventTasks() {
    if (!boutique || !userId) return;
    // Fetch tasks assigned to this user (by assigned_to_id) or name match
    // Join with events and clients
    const memberName = currentMember?.name;
    let query = supabase
      .from('tasks')
      .select('*, event:events(id, type, event_date, client:clients(name))')
      .eq('boutique_id', boutique.id);

    // We want: assigned_to_id matches current member id OR (no assigned_to_id and assigned_to_name matches)
    // Use or filter
    if (currentMember?.id) {
      query = query.or(`assigned_to_id.eq.${currentMember.id}${memberName ? `,assigned_to_name.eq.${memberName}` : ''}`);
    } else if (memberName) {
      query = query.eq('assigned_to_name', memberName);
    } else {
      // No way to filter — return empty
      setEventTasks([]);
      return;
    }

    const { data } = await query.order('created_at', { ascending: true });
    if (data) {
      const normalized = data.map(t => ({
        ...t,
        _type: 'event',
        _sourceType: 'event',
        _source: t.event
          ? `${EVT_TYPES[t.event.type]?.label || t.event.type}${t.event.client?.name ? ` · ${t.event.client.name}` : ''}`
          : null,
        _eventId: t.event?.id || t.event_id,
      }));
      setEventTasks(normalized);
    }
  }

  async function loadClientTasks() {
    if (!boutique || !userId) return;
    let query = supabase
      .from('client_tasks')
      .select('*, client:clients(name), event:events(type, event_date)')
      .eq('boutique_id', boutique.id);

    if (currentMember?.id) {
      const memberName = currentMember?.name;
      query = query.or(`assigned_to_id.eq.${currentMember.id}${memberName ? `,assigned_to_name.eq.${memberName}` : ''}`);
    } else if (currentMember?.name) {
      query = query.eq('assigned_to_name', currentMember.name);
    } else {
      setClientTasks([]);
      return;
    }

    const { data } = await query.order('created_at', { ascending: true });
    if (data) {
      const normalized = data.map(t => ({
        ...t,
        _type: 'client',
        _sourceType: 'client',
        _source: t.client?.name || null,
        alert: t.is_alert,
      }));
      setClientTasks(normalized);
    }
  }

  // Load tasks once currentMember is resolved
  useEffect(() => {
    if (!boutique || !userId) return;
    // currentMember may still be loading — we always re-run when it's known
    loadTasks();
  }, [boutique?.id, userId, currentMember?.id]);

  // Merged & sorted task feed
  const allTasks = useMemo(() => sortTasks([...eventTasks, ...clientTasks]), [eventTasks, clientTasks]);

  // Filter
  const filteredTasks = useMemo(() => {
    switch (activeFilter) {
      case 'event_tasks':  return allTasks.filter(t => t._type === 'event');
      case 'client_tasks': return allTasks.filter(t => t._type === 'client');
      case 'overdue':      return allTasks.filter(t => !t.done && isDueDateOverdue(t.due_date));
      case 'done':         return allTasks.filter(t => t.done);
      default:             return allTasks;
    }
  }, [allTasks, activeFilter]);

  // Stats
  const stats = useMemo(() => {
    const active = allTasks.filter(t => !t.done);
    return {
      overdue:      active.filter(t => isDueDateOverdue(t.due_date)).length,
      dueToday:     active.filter(t => isDueToday(t.due_date)).length,
      dueThisWeek:  active.filter(t => isDueThisWeek(t.due_date) && !isDueDateOverdue(t.due_date) && !isDueToday(t.due_date)).length,
      completedWeek: allTasks.filter(t => isCompletedThisWeek(t)).length,
    };
  }, [allTasks]);

  async function handleToggleDone(task) {
    const nowDone = !task.done;
    const doneByName = currentMember?.name || null;
    const now = new Date().toISOString();

    // Optimistic update
    const updateLocal = (prev) => prev.map(t =>
      t.id === task.id
        ? { ...t, done: nowDone, done_at: nowDone ? now : null, done_by_name: nowDone ? doneByName : null }
        : t
    );

    if (task._type === 'event') {
      setEventTasks(updateLocal);
    } else {
      setClientTasks(updateLocal);
    }

    const table = task._type === 'event' ? 'tasks' : 'client_tasks';
    const updates = { done: nowDone };
    if (nowDone) {
      updates.done_at = now;
      if (doneByName) updates.done_by_name = doneByName;
    } else {
      updates.done_at = null;
      updates.done_by_name = null;
    }

    const { error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', task.id)
      .eq('boutique_id', boutique.id);

    if (error) {
      // Rollback
      const rollback = (prev) => prev.map(t => t.id === task.id ? { ...t, done: !nowDone, done_at: null, done_by_name: null } : t);
      if (task._type === 'event') setEventTasks(rollback);
      else setClientTasks(rollback);
      toast('Could not update task', 'error');
    } else {
      toast(nowDone ? 'Task marked done' : 'Task reopened');
    }
  }

  const statChips = [
    { label: 'Overdue',          count: stats.overdue,       bg: C.redBg,    col: C.red,   filter: 'overdue' },
    { label: 'Due today',        count: stats.dueToday,      bg: C.amberBg,  col: C.amber, filter: 'all' },
    { label: 'Due this week',    count: stats.dueThisWeek,   bg: C.blueBg,   col: C.blue,  filter: 'all' },
    { label: 'Completed / week', count: stats.completedWeek, bg: C.greenBg,  col: C.green, filter: 'done' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary, #F8F4F0)' }}>
      <Topbar
        title="My Tasks"
        subtitle={currentMember?.name ? `Assigned to ${currentMember.name}` : 'Your assigned tasks'}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {statChips.map(chip => (
            <div
              key={chip.label}
              onClick={() => setActiveFilter(chip.filter)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 10,
                background: chip.bg, border: `1px solid transparent`,
                cursor: 'pointer', transition: 'opacity 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: chip.col, lineHeight: 1 }}>{chip.count}</span>
              <span style={{ fontSize: 11, color: chip.col, fontWeight: 500 }}>{chip.label}</span>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, background: C.white, borderRadius: 10, padding: 4, border: `1px solid ${C.border}`, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              style={{
                padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12,
                fontWeight: activeFilter === tab.id ? 600 : 400,
                background: activeFilter === tab.id ? C.rosa : 'transparent',
                color: activeFilter === tab.id ? C.white : C.gray,
                transition: 'all 0.15s',
              }}
            >{tab.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: C.gray }}>Loading tasks…</div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, marginBottom: 4 }}>All clear!</div>
              <div style={{ fontSize: 12, color: C.gray }}>
                {activeFilter === 'all' ? 'No tasks assigned to you right now.' : `No ${activeFilter.replace('_', ' ')} tasks.`}
              </div>
            </div>
          ) : (
            filteredTasks.map((task, i) => (
              <div key={`${task._type}-${task.id}`}>
                <TaskCard task={task} onToggleDone={handleToggleDone} />
              </div>
            ))
          )}
        </div>

        {/* Footer count */}
        {!loading && filteredTasks.length > 0 && (
          <div style={{ fontSize: 11, color: C.gray, textAlign: 'center' }}>
            {filteredTasks.filter(t => t.done).length} of {filteredTasks.length} tasks completed
          </div>
        )}
      </div>
    </div>
  );
}
