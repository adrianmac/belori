import React, { useState, useEffect, useCallback, useRef } from 'react';
import { C, EVT_TYPES } from '../lib/colors';
import { Topbar, GhostBtn } from '../lib/ui.jsx';
import StandaloneAppointmentModal from '../components/StandaloneAppointmentModal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const APPT_TYPE_COLOR = {
  fitting: '#0EA5E9',
  measurement: '#0EA5E9',
  try_on: '#0EA5E9',
  final_fitting: '#10B981',
  pickup: '#10B981',
  alteration_fitting: '#F59E0B',
  follow_up: '#F59E0B',
  consultation: '#8B5CF6',
  return: '#EF4444',
  delivery: '#6366F1',
  walk_in: '#D97706',
  other: '#6B7280',
};

const APPT_TYPE_LABEL = {
  fitting: 'Fitting',
  measurement: 'Measurements',
  try_on: '1st Fitting',
  final_fitting: 'Final Fitting',
  pickup: 'Pickup',
  alteration_fitting: 'Alt. Fitting',
  follow_up: 'Follow-up',
  consultation: 'Consultation',
  return: 'Return',
  delivery: 'Delivery',
  walk_in: 'Walk-in',
  other: 'Other',
};

// Status badge helpers
const STATUS_COLOR = {
  confirmed: '#16A34A',
  walk_in: '#D97706',
  scheduled: '#0EA5E9',
  cancelled: '#9CA3AF',
  no_show: '#B91C1C',
};

// Helper: get display name for any appointment (event-linked or standalone)
// clientByEventId is a map built from the events prop so we never rely on a 3-table join
function getApptDisplayName(a, clientByEventId = {}) {
  if (a.event_id && clientByEventId[a.event_id]) return clientByEventId[a.event_id];
  return a.event?.client?.name || a.client_name || '';
}

// Helper: can this appointment be marked no-show?
function canMarkNoShow(a, today) {
  return a.date <= today && a.status !== 'no_show' && a.status !== 'completed' && a.status !== 'cancelled';
}

// Helper: is a standalone (walk-in / kiosk) appointment
function isStandalone(a) {
  return !a.event_id;
}

// Use LOCAL date to avoid UTC conversion shifting dates in non-UTC timezones
const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - startOffset + i);
    return d;
  });
}

function buildWeekDays(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SLOT_H = 56;

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2, '0')}${ampm}`;
}

function formatWeekRange(days) {
  const first = days[0];
  const last = days[6];
  const sameMonth = first.getMonth() === last.getMonth();
  if (sameMonth) {
    return `${MONTH_NAMES[first.getMonth()].slice(0, 3)} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`;
  }
  return `${MONTH_NAMES[first.getMonth()].slice(0, 3)} ${first.getDate()} – ${MONTH_NAMES[last.getMonth()].slice(0, 3)} ${last.getDate()}, ${last.getFullYear()}`;
}

function formatDayHeading(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
  return `${dayName}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export default function Calendar({ events = [], setScreen, setSelectedEvent, staff = [], clients = [] }) {
  const { boutique } = useAuth();
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [showStandaloneAppt, setShowStandaloneAppt] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const today = toDateStr(new Date()); // computed per render so it's always fresh

  const fetchAppointments = useCallback(async () => {
    if (!boutique?.id) return;

    let startDate, endDate;
    if (view === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const pre = new Date(year, month, 1);
      pre.setDate(pre.getDate() - 25);
      const post = new Date(year, month + 1, 0);
      post.setDate(post.getDate() + 7);
      startDate = toDateStr(pre);
      endDate = toDateStr(post);
    } else if (view === 'day') {
      startDate = toDateStr(currentDate);
      endDate = toDateStr(currentDate);
    } else {
      const days = buildWeekDays(currentDate);
      startDate = toDateStr(days[0]);
      endDate = toDateStr(days[6]);
    }

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('boutique_id', boutique.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('time', { ascending: true });

    if (error) console.error('[Calendar] fetchAppointments error:', error);
    setAppointments(data || []);
  }, [boutique?.id, currentDate, view]);

  // Keep a ref so real-time callback always calls the latest fetchAppointments
  // without needing to re-subscribe on every date/view change (which can cause channel churn)
  const fetchRef = useRef(fetchAppointments);
  useEffect(() => { fetchRef.current = fetchAppointments; }, [fetchAppointments]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Real-time subscription — stable channel, always calls latest fetch via ref
  useEffect(() => {
    if (!boutique?.id) return;
    const channel = supabase
      .channel('calendar-appts-rt-' + boutique.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: 'boutique_id=eq.' + boutique.id,
      }, () => fetchRef.current())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [boutique?.id]); // stable — only recreate when boutique changes

  // Mark a past/today appointment as no-show and increment client's no_show_count
  const markNoShow = useCallback(async (appt) => {
    if (!boutique?.id) return;
    // Update appointment status
    await supabase
      .from('appointments')
      .update({ status: 'no_show' })
      .eq('id', appt.id)
      .eq('boutique_id', boutique.id);
    // Increment client no_show_count if we can identify the client
    const clientId = appt.event?.client?.id || null;
    if (clientId) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('no_show_count')
        .eq('id', clientId)
        .single();
      const cur = clientData?.no_show_count || 0;
      await supabase.from('clients').update({ no_show_count: cur + 1 }).eq('id', clientId);
    }
    // Refresh
    fetchAppointments();
  }, [boutique?.id, fetchAppointments]);

  // Reset selectedDay when view or month changes
  useEffect(() => {
    setSelectedDay(null);
  }, [view, currentDate.getFullYear(), currentDate.getMonth()]);

  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (view === 'day') {
      d.setDate(d.getDate() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (view === 'day') {
      d.setDate(d.getDate() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const getApptColor = (type) => APPT_TYPE_COLOR[type] || APPT_TYPE_COLOR.other;

  const apptsByDate = appointments.reduce((acc, a) => {
    const key = a.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const eventsByDate = events.reduce((acc, e) => {
    if (!e.event_date) return acc;
    if (!acc[e.event_date]) acc[e.event_date] = [];
    acc[e.event_date].push(e);
    return acc;
  }, {});

  // Build event_id → client name lookup from the already-fetched events prop.
  // normalizeEvent stores client as a string (the name), so this is reliable without any extra query.
  const clientByEventId = React.useMemo(() => {
    const m = {};
    events.forEach(e => { if (e.id && e.client) m[e.id] = typeof e.client === 'string' ? e.client : (e.client?.name || ''); });
    return m;
  }, [events]);

  const navigateToEvent = (event) => {
    setSelectedEvent(event.id);
    setScreen('event_detail');
  };

  // ─── MONTH VIEW ────────────────────────────────────────────────────────────
  const MonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const grid = buildMonthGrid(year, month);

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Day name header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: `1px solid ${C.border}`,
          background: C.ivory,
          flexShrink: 0,
        }}>
          {DAY_NAMES.map((name) => (
            <div key={name} style={{
              textAlign: 'center',
              padding: '8px 0',
              fontSize: 11,
              fontWeight: 600,
              color: C.gray,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              {name}
            </div>
          ))}
        </div>

        {/* 6×7 grid */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(6, 1fr)',
          overflow: 'hidden',
        }}>
          {grid.map((day, i) => {
            const dateStr = toDateStr(day);
            const isCurrentMonth = day.getMonth() === month;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDay;
            const dayEvents = eventsByDate[dateStr] || [];
            const dayAppts = apptsByDate[dateStr] || [];
            // Show events first (up to 2), then fill remaining slots with appts (max 3 total rows)
            const visibleEvents = dayEvents.slice(0, 2);
            const apptSlots = Math.max(0, 3 - visibleEvents.length);
            const visibleAppts = dayAppts.slice(0, apptSlots);
            const totalExtra = (dayEvents.length - visibleEvents.length) + (dayAppts.length - visibleAppts.length);

            let bg = C.white;
            if (!isCurrentMonth) bg = C.ivory;
            if (isToday) bg = '#FFFBEB';
            if (isSelected && !isToday) bg = C.rosaPale;

            return (
              <div
                key={i}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                style={{
                  background: bg,
                  borderRight: (i % 7 !== 6) ? `1px solid ${C.border}` : 'none',
                  borderBottom: (i < 35) ? `1px solid ${C.border}` : 'none',
                  padding: '6px 6px 4px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  minHeight: 0,
                  overflow: 'hidden',
                  transition: 'background 0.15s',
                }}
              >
                {/* Day number */}
                <div style={{ flexShrink: 0, marginBottom: 2 }}>
                  <span
                    onClick={(e) => { e.stopPropagation(); setCurrentDate(new Date(day)); setView('day'); }}
                    title="Open day view"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 400,
                      background: isToday ? C.rosa : 'transparent',
                      color: isToday ? C.white : isCurrentMonth ? C.ink : C.gray,
                      cursor: 'pointer',
                    }}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {/* Event pills */}
                {visibleEvents.map((ev) => {
                  const t = EVT_TYPES[ev.type] || { col: C.rosa, label: ev.type };
                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); navigateToEvent(ev); }}
                      title={ev.client || 'Event'}
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: t.col + '38',
                        color: t.col,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        flexShrink: 0,
                        lineHeight: '16px',
                      }}
                    >
                      {ev.client || t.label || 'Event'}
                    </div>
                  );
                })}
                {/* Appointment pills — same style as event pills but with left border accent */}
                {visibleAppts.map((a) => {
                  const isNoShow = a.status === 'no_show';
                  const color = isNoShow ? C.red : getApptColor(a.type);
                  const displayName = getApptDisplayName(a, clientByEventId);
                  const standalone = isStandalone(a);
                  const label = APPT_TYPE_LABEL[a.type] || a.type;
                  return (
                    <div
                      key={a.id}
                      title={`${isNoShow ? '⚠️ No-show — ' : ''}${label}${displayName ? ` — ${displayName}` : ''}${standalone ? ' (walk-in)' : ''}`}
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: isNoShow ? C.redBg : color + '22',
                        color,
                        borderLeft: `2px solid ${color}`,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flexShrink: 0,
                        lineHeight: '16px',
                        textDecoration: isNoShow ? 'line-through' : 'none',
                        opacity: isNoShow ? 0.8 : 1,
                      }}
                    >
                      {isNoShow ? '⚠️ ' : (standalone ? '🚶 ' : '')}{displayName || label}
                    </div>
                  );
                })}

                {totalExtra > 0 && (
                  <div style={{ fontSize: 10, color: C.gray, flexShrink: 0, lineHeight: '14px', paddingLeft: 2 }}>
                    +{totalExtra} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── WEEK VIEW ─────────────────────────────────────────────────────────────
  const WeekView = () => {
    const days = buildWeekDays(currentDate);

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '50px repeat(7, 1fr)',
          borderBottom: `1px solid ${C.border}`,
          background: C.ivory,
          flexShrink: 0,
        }}>
          <div style={{ borderRight: `1px solid ${C.border}` }} />
          {days.map((day, i) => {
            const dateStr = toDateStr(day);
            const isToday = dateStr === today;
            return (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  padding: '8px 4px',
                  borderRight: i < 6 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {DAY_NAMES[day.getDay()]}
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: isToday ? C.rosa : 'transparent',
                  color: isToday ? C.white : C.ink,
                  fontSize: 14,
                  fontWeight: isToday ? 700 : 400,
                  marginTop: 2,
                }}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '50px repeat(7, 1fr)',
          borderBottom: `1px solid ${C.border}`,
          background: C.grayBg,
          flexShrink: 0,
          minHeight: 28,
        }}>
          <div style={{
            borderRight: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            color: C.gray,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            Events
          </div>
          {days.map((day, i) => {
            const dateStr = toDateStr(day);
            const dayEvents = eventsByDate[dateStr] || [];
            return (
              <div
                key={i}
                style={{
                  padding: '3px 4px',
                  borderRight: i < 6 ? `1px solid ${C.border}` : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {dayEvents.map((ev) => {
                  const t = EVT_TYPES[ev.type] || { col: C.rosa };
                  return (
                    <div
                      key={ev.id}
                      onClick={() => navigateToEvent(ev)}
                      title={ev.client || 'Event'}
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: t.col + '38',
                        color: t.col,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        lineHeight: '16px',
                      }}
                    >
                      {ev.client || t.label || 'Event'}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '50px repeat(7, 1fr)',
            position: 'relative',
          }}>
            {/* Hour rows */}
            {HOURS.map((hour) => (
              <React.Fragment key={hour}>
                <div style={{
                  borderRight: `1px solid ${C.border}`,
                  borderBottom: `1px solid ${C.border}`,
                  height: SLOT_H,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  paddingRight: 6,
                  paddingTop: 4,
                  fontSize: 10,
                  color: C.gray,
                  background: C.white,
                  flexShrink: 0,
                }}>
                  {hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
                </div>
                {days.map((_, ci) => (
                  <div
                    key={ci}
                    style={{
                      height: SLOT_H,
                      borderRight: ci < 6 ? `1px solid ${C.border}` : 'none',
                      borderBottom: `1px solid ${C.border}`,
                      background: C.white,
                      position: 'relative',
                    }}
                  />
                ))}
              </React.Fragment>
            ))}

            {/* Appointment blocks — absolutely positioned within day columns */}
            {days.map((day, ci) => {
              const dateStr = toDateStr(day);
              const dayAppts = apptsByDate[dateStr] || [];
              if (!dayAppts.length) return null;

              // col offset: 50px + ci * (1fr)
              return dayAppts.map((a) => {
                if (!a.time) return null;
                const [h, m] = a.time.split(':').map(Number);
                const topPx = (h - 8) * SLOT_H + (m / 60) * SLOT_H + HOURS.indexOf(8) * 0;
                const color = getApptColor(a.type);
                const displayName = getApptDisplayName(a, clientByEventId);
                const standalone = isStandalone(a);

                return (
                  <div
                    key={a.id}
                    onClick={() => !standalone && a.event && navigateToEvent(a.event)}
                    title={`${formatTime(a.time)} — ${APPT_TYPE_LABEL[a.type] || a.type}${displayName ? ` · ${displayName}` : ''}${standalone ? ' (walk-in)' : ''}`}
                    style={{
                      position: 'absolute',
                      top: topPx + HOURS.length * 0,
                      left: `calc(50px + ${ci} * ((100% - 50px) / 7) + 3px)`,
                      width: `calc((100% - 50px) / 7 - 6px)`,
                      minHeight: 40,
                      background: standalone ? '#FEF3C720' : color + '20',
                      borderLeft: `3px solid ${color}`,
                      border: standalone ? `1.5px dashed ${color}` : undefined,
                      borderLeft: standalone ? `3px solid ${color}` : `3px solid ${color}`,
                      borderRadius: 4,
                      padding: '3px 5px',
                      cursor: standalone ? 'default' : (a.event ? 'pointer' : 'default'),
                      overflow: 'hidden',
                      zIndex: 1,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {standalone ? '🚶 ' : ''}{displayName || APPT_TYPE_LABEL[a.type] || a.type}
                    </div>
                    <div style={{ fontSize: 9, color: C.gray, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatTime(a.time)}{` · ${APPT_TYPE_LABEL[a.type] || a.type}`}
                    </div>
                    {a.status === 'confirmed' && (
                      <div style={{ fontSize: 8, color: '#16A34A', fontWeight: 700, marginTop: 1 }}>✓ confirmed</div>
                    )}
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    );
  };

  // ─── STAFF VIEW ────────────────────────────────────────────────────────────
  const StaffView = () => {
    const days = buildWeekDays(currentDate);
    const members = staff.length > 0 ? staff : [];

    const getStaffAppts = (staffId, dateStr) => {
      const dayAppts = apptsByDate[dateStr] || [];
      if (staffId === null) {
        return dayAppts.filter((a) => !a.staff_id);
      }
      return dayAppts.filter((a) => a.staff_id === staffId);
    };

    const colStyle = (isLast) => ({
      padding: '6px 8px',
      borderRight: !isLast ? `1px solid ${C.border}` : 'none',
      verticalAlign: 'top',
    });

    const rows = [...members.map((m) => ({ id: m.id, name: m.name })), { id: null, name: 'Unassigned' }];

    return (
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontSize: 12,
        }}>
          <colgroup>
            <col style={{ width: 120 }} />
            {days.map((_, i) => <col key={i} />)}
          </colgroup>
          <thead>
            <tr style={{ background: C.ivory, borderBottom: `1px solid ${C.border}` }}>
              <th style={{
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: 11,
                fontWeight: 600,
                color: C.gray,
                borderRight: `1px solid ${C.border}`,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                Staff
              </th>
              {days.map((day, i) => {
                const dateStr = toDateStr(day);
                const isToday = dateStr === today;
                return (
                  <th
                    key={i}
                    style={{
                      textAlign: 'center',
                      padding: '8px 4px',
                      borderRight: i < 6 ? `1px solid ${C.border}` : 'none',
                    }}
                  >
                    <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {DAY_NAMES[day.getDay()]}
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: isToday ? C.rosa : 'transparent',
                      color: isToday ? C.white : C.ink,
                      fontSize: 13,
                      fontWeight: isToday ? 700 : 400,
                      marginTop: 2,
                    }}>
                      {day.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: 'center', padding: 40, color: C.gray, fontSize: 13 }}
                >
                  No staff members
                </td>
              </tr>
            ) : (
              rows.map((member, ri) => (
                <tr
                  key={member.id ?? 'unassigned'}
                  style={{ borderBottom: `1px solid ${C.border}`, background: ri % 2 === 0 ? C.white : C.grayBg }}
                >
                  <td style={{
                    padding: '8px 12px',
                    fontWeight: member.id === null ? 400 : 500,
                    color: member.id === null ? C.gray : C.ink,
                    fontSize: 12,
                    borderRight: `1px solid ${C.border}`,
                    whiteSpace: 'nowrap',
                    verticalAlign: 'top',
                  }}>
                    {member.name}
                    {member.role && (
                      <div style={{ fontSize: 10, color: C.gray, fontWeight: 400, marginTop: 1 }}>{member.role}</div>
                    )}
                  </td>
                  {days.map((day, ci) => {
                    const dateStr = toDateStr(day);
                    const appts = getStaffAppts(member.id, dateStr);
                    return (
                      <td key={ci} style={colStyle(ci === 6)}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 28 }}>
                          {appts.map((a) => {
                            const color = getApptColor(a.type);
                            const displayName = getApptDisplayName(a, clientByEventId);
                            const standalone = isStandalone(a);
                            return (
                              <div
                                key={a.id}
                                onClick={() => !standalone && a.event && navigateToEvent(a.event)}
                                title={`${formatTime(a.time)} — ${APPT_TYPE_LABEL[a.type] || a.type}${displayName ? ` · ${displayName}` : ''}${standalone ? ' (walk-in)' : ''}`}
                                style={{
                                  background: standalone ? '#FFFBEB' : color + '20',
                                  borderLeft: `3px solid ${color}`,
                                  border: standalone ? `1.5px dashed ${color}` : undefined,
                                  borderLeft: standalone ? `3px solid ${color}` : `3px solid ${color}`,
                                  borderRadius: 4,
                                  padding: '3px 6px',
                                  cursor: standalone ? 'default' : (a.event ? 'pointer' : 'default'),
                                }}
                              >
                                <div style={{ fontSize: 10, fontWeight: 600, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {standalone ? '🚶 ' : ''}{displayName || APPT_TYPE_LABEL[a.type] || a.type}
                                </div>
                                <div style={{ fontSize: 10, color: C.gray, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {formatTime(a.time)}{` · ${APPT_TYPE_LABEL[a.type] || a.type}`}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── DAY DETAIL PANEL ──────────────────────────────────────────────────────
  const DayPanel = () => {
    if (!selectedDay) return null;
    const dayEvents = eventsByDate[selectedDay] || [];
    const dayAppts = apptsByDate[selectedDay] || [];

    return (
      <div style={{
        width: 280,
        flexShrink: 0,
        borderLeft: `1px solid ${C.border}`,
        background: C.white,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Panel header */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>
              {formatDayHeading(selectedDay)}
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: C.gray,
                fontSize: 18,
                lineHeight: 1,
                padding: '0 0 0 8px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>
            {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''} · {dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''}
          </div>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button
              onClick={() => { setShowStandaloneAppt(true); }}
              style={{ flex: 1, fontSize: 11, fontWeight: 600, padding: '6px 0', borderRadius: 8, border: `1.5px solid ${C.rosa}`, background: C.rosa, color: C.white, cursor: 'pointer' }}
            >
              + Appointment
            </button>
            <button
              onClick={() => { setSelectedDay(null); setScreen('events'); window.dispatchEvent(new CustomEvent('belori:new-event')); }}
              style={{ flex: 1, fontSize: 11, fontWeight: 600, padding: '6px 0', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, color: C.ink, cursor: 'pointer' }}
            >
              + Event
            </button>
          </div>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {dayEvents.length === 0 && dayAppts.length === 0 && (
            <div style={{ textAlign: 'center', color: C.gray, fontSize: 13, marginTop: 24 }}>
              Nothing scheduled
            </div>
          )}

          {/* Events section */}
          {dayEvents.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                Events
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dayEvents.map((ev) => {
                  const t = EVT_TYPES[ev.type] || { col: C.rosa, bg: C.rosaPale, label: ev.type, icon: '' };
                  return (
                    <div
                      key={ev.id}
                      onClick={() => navigateToEvent(ev)}
                      style={{
                        background: t.col + '15',
                        border: `1px solid ${t.col}40`,
                        borderRadius: 8,
                        padding: '8px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: t.col, marginBottom: 2 }}>
                        {t.icon} {t.label}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.client || 'Client'}
                      </div>
                      {ev.venue && (
                        <div style={{ fontSize: 11, color: C.gray, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ev.venue}
                        </div>
                      )}
                      {ev.guests != null && (
                        <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>
                          {ev.guests} guests
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Appointments section */}
          {dayAppts.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                Appointments
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dayAppts.map((a) => {
                  const isNoShow = a.status === 'no_show';
                  const color = isNoShow ? C.red : getApptColor(a.type);
                  const displayName = getApptDisplayName(a, clientByEventId);
                  const standalone = isStandalone(a);
                  return (
                    <div
                      key={a.id}
                      onClick={() => !standalone && a.event && navigateToEvent(a.event)}
                      style={{
                        background: isNoShow ? C.redBg : (standalone ? '#FFFBEB' : color + '15'),
                        border: isNoShow ? `1px solid ${C.red}40` : (standalone ? `1.5px dashed ${color}` : `1px solid ${color}40`),
                        borderLeft: `3px solid ${color}`,
                        borderRadius: 6,
                        padding: '7px 10px',
                        cursor: standalone ? 'default' : (a.event ? 'pointer' : 'default'),
                        opacity: isNoShow ? 0.85 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color, textDecoration: isNoShow ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isNoShow && <span title="No-show">⚠️</span>}
                          {standalone ? '🚶 ' : ''}{APPT_TYPE_LABEL[a.type] || a.type}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isNoShow && <span style={{ fontSize: 9, fontWeight: 700, color: C.red }}>No-show</span>}
                          {a.status === 'confirmed' && !isNoShow && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLOR.confirmed }}>✓</span>
                          )}
                          {a.time && (
                            <div style={{ fontSize: 10, color: C.gray, whiteSpace: 'nowrap' }}>
                              {formatTime(a.time)}
                            </div>
                          )}
                        </div>
                      </div>
                      {displayName && (
                        <div style={{ fontSize: 11, color: C.ink, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isNoShow ? 'line-through' : 'none' }}>
                          {displayName}
                        </div>
                      )}
                      {a.client_phone && standalone && (
                        <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>
                          {a.client_phone}
                        </div>
                      )}
                      {a.note && (
                        <div style={{ fontSize: 10, color: C.gray, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.note}
                        </div>
                      )}
                      {canMarkNoShow(a, today) && (
                        <button
                          onClick={e => { e.stopPropagation(); markNoShow(a); }}
                          style={{ marginTop: 5, fontSize: 10, padding: '2px 8px', borderRadius: 4, border: `1px solid ${C.red}`, background: 'transparent', color: C.red, cursor: 'pointer', display: 'block' }}
                        >
                          Mark no-show
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── DAY VIEW ──────────────────────────────────────────────────────────────
  const DayView = () => {
    const dateStr = toDateStr(currentDate);
    const isToday = dateStr === today;
    const dayAppts = (apptsByDate[dateStr] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const dayEvents = eventsByDate[dateStr] || [];
    const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][currentDate.getDay()];
    const noTime = dayAppts.filter(a => !a.time);
    const withTime = dayAppts.filter(a => a.time);

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Day header strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '10px 20px', borderBottom: `1px solid ${C.border}`,
          background: isToday ? '#FFFBEB' : C.ivory, flexShrink: 0,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
            background: isToday ? C.rosa : C.white,
            border: `2px solid ${isToday ? C.rosa : C.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: isToday ? 'rgba(255,255,255,0.8)' : C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>{dayName.slice(0,3)}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: isToday ? C.white : C.ink, lineHeight: 1.1 }}>{currentDate.getDate()}</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''}</div>
            {dayEvents.length > 0 && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''} this day</div>}
          </div>
          {/* Day-of events as chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 8 }}>
            {dayEvents.map(ev => {
              const t = EVT_TYPES[ev.type] || { col: C.rosa, label: ev.type };
              return (
                <div key={ev.id} onClick={() => navigateToEvent(ev)} style={{
                  fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                  background: t.col + '20', color: t.col, border: `1px solid ${t.col}40`,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  {t.icon ? `${t.icon} ` : ''}{ev.client || t.label}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Time grid */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* All-day / no-time appointments */}
            {noTime.length > 0 && (
              <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: C.grayBg }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>All day</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {noTime.map(a => {
                    const color = getApptColor(a.type);
                    const displayName = getApptDisplayName(a, clientByEventId);
                    const standalone = isStandalone(a);
                    return (
                      <div key={a.id} style={{
                        background: standalone ? '#FFFBEB' : color + '18',
                        borderLeft: `3px solid ${color}`,
                        border: standalone ? `1px dashed ${color}` : `1px solid ${color}30`,
                        borderLeft: `3px solid ${color}`,
                        borderRadius: 6, padding: '6px 10px',
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color }}>{standalone ? '🚶 ' : ''}{displayName || APPT_TYPE_LABEL[a.type] || a.type}</span>
                        {displayName && <span style={{ fontSize: 11, color: C.gray, marginLeft: 6 }}>{APPT_TYPE_LABEL[a.type] || a.type}</span>}
                        {a.note && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{a.note}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hourly rows */}
            <div style={{ position: 'relative' }}>
              {HOURS.map(hour => (
                <div key={hour} style={{
                  display: 'grid', gridTemplateColumns: '56px 1fr',
                  borderBottom: `1px solid ${C.border}`,
                  minHeight: SLOT_H,
                }}>
                  <div style={{
                    borderRight: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                    paddingRight: 8, paddingTop: 4,
                    fontSize: 10, color: C.gray, background: C.white, flexShrink: 0,
                  }}>
                    {hour === 12 ? '12pm' : hour > 12 ? `${hour-12}pm` : `${hour}am`}
                  </div>
                  <div style={{ background: C.white, position: 'relative', padding: '2px 8px' }}>
                    {withTime
                      .filter(a => { const h = parseInt(a.time); return h === hour; })
                      .map(a => {
                        const isNoShow = a.status === 'no_show';
                        const color = isNoShow ? C.red : getApptColor(a.type);
                        const displayName = getApptDisplayName(a, clientByEventId);
                        const standalone = isStandalone(a);
                        const staffMember = staff.find(s => s.id === a.staff_id);
                        const dateStr = toDateStr(currentDate);
                        return (
                          <div key={a.id} style={{
                            background: isNoShow ? C.redBg : (standalone ? '#FEF3C730' : color + '18'),
                            borderLeft: `3px solid ${color}`,
                            border: isNoShow ? `1px solid ${C.red}40` : (standalone ? `1px dashed ${color}` : `1px solid ${color}30`),
                            borderLeft: `3px solid ${color}`,
                            borderRadius: 6, padding: '6px 10px', marginBottom: 4,
                            opacity: isNoShow ? 0.85 : 1,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {isNoShow && <span title="No-show">⚠️</span>}
                                <span style={{ fontSize: 12, fontWeight: 600, color, textDecoration: isNoShow ? 'line-through' : 'none' }}>{standalone ? '🚶 ' : ''}{displayName || APPT_TYPE_LABEL[a.type] || a.type}</span>
                                {displayName && <span style={{ fontSize: 11, color: C.gray, fontWeight: 400, textDecoration: isNoShow ? 'line-through' : 'none' }}>{APPT_TYPE_LABEL[a.type] || a.type}</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                {isNoShow && <span style={{ fontSize: 10, fontWeight: 700, color: C.red }}>No-show</span>}
                                {a.status === 'confirmed' && !isNoShow && <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR.confirmed }}>✓ Confirmed</span>}
                                {a.status === 'walk_in' && !isNoShow && <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR.walk_in }}>Walk-in</span>}
                                <span style={{ fontSize: 11, color: C.gray }}>{formatTime(a.time)}</span>
                              </div>
                            </div>
                            {a.client_phone && standalone && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{a.client_phone}</div>}
                            {staffMember && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>👤 {staffMember.name}</div>}
                            {a.note && <div style={{ fontSize: 11, color: C.gray, marginTop: 2, fontStyle: 'italic' }}>{a.note}</div>}
                            {canMarkNoShow(a, today) && (
                              <button
                                onClick={() => markNoShow(a)}
                                style={{ marginTop: 5, fontSize: 10, padding: '2px 8px', borderRadius: 4, border: `1px solid ${C.red}`, background: 'transparent', color: C.red, cursor: 'pointer', display: 'block' }}
                              >
                                Mark no-show
                              </button>
                            )}
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {dayAppts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: C.gray, fontSize: 13 }}>
                No appointments scheduled for this day
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── WALK-IN COUNT (today) ─────────────────────────────────────────────────
  const todayWalkins = appointments.filter(
    (a) => a.date === today && a.type === 'walk_in'
  );

  // ─── HEADER LABEL ──────────────────────────────────────────────────────────
  const headerLabel = () => {
    if (view === 'month') {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (view === 'day') {
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return `${dayNames[currentDate.getDay()]}, ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    }
    return formatWeekRange(buildWeekDays(currentDate));
  };

  const segBtn = (label, value) => (
    <button
      key={value}
      onClick={() => setView(value)}
      style={{
        padding: '5px 14px',
        fontSize: 12,
        fontWeight: 500,
        background: view === value ? C.rosa : C.white,
        color: view === value ? C.white : C.gray,
        border: `1px solid ${view === value ? C.rosa : C.border}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        outline: 'none',
        lineHeight: '18px',
      }}
    >
      {label}
    </button>
  );

  const downloadBulkIcs = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Belori//Boutique Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Belori Events',
      'X-WR-TIMEZONE:America/Chicago',
    ];

    const fmt4 = (s) => s ? s.replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;') : '';
    const dtStamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

    (events || []).forEach(ev => {
      if (!ev.event_date) return;
      const uid = `event-${ev.id}@belori`;
      const dtStart = ev.event_date.replace(/-/g, '') + 'T120000Z';
      const dtEnd = ev.event_date.replace(/-/g, '') + 'T230000Z';
      const summary = `${ev.client || 'Event'} ${ev.type === 'wedding' ? 'Wedding' : 'Quinceañera'}`;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtStamp}`);
      lines.push(`DTSTART;VALUE=DATE:${ev.event_date.replace(/-/g, '')}`);
      lines.push(`SUMMARY:${fmt4(summary)}`);
      if (ev.venue) lines.push(`LOCATION:${fmt4(ev.venue)}`);
      if (ev.status) lines.push(`STATUS:${ev.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`);
      lines.push('END:VEVENT');

      // Add appointments for this event
      (ev.appointments || []).forEach(appt => {
        if (!appt.date) return;
        const apptUid = `appt-${appt.id}@belori`;
        const apptLabel = appt.type ? appt.type.replace(/_/g, ' ') : 'Appointment';
        const timeStr = appt.time ? appt.time.replace(':', '').slice(0, 4) + '00' : '100000';
        const apptDt = appt.date.replace(/-/g, '') + 'T' + timeStr + 'Z';
        const apptEnd = appt.date.replace(/-/g, '') + 'T' + (String(parseInt(timeStr.slice(0,2)) + 1).padStart(2,'0')) + timeStr.slice(2,4) + '00Z';
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${apptUid}`);
        lines.push(`DTSTAMP:${dtStamp}`);
        lines.push(`DTSTART:${apptDt}`);
        lines.push(`DTEND:${apptEnd}`);
        lines.push(`SUMMARY:${fmt4(apptLabel + ' — ' + (ev.client || 'Client'))}`);
        if (appt.note) lines.push(`DESCRIPTION:${fmt4(appt.note)}`);
        lines.push('END:VEVENT');
      });
    });

    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'belori-calendar.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title="Calendar" subtitle="Events and appointments at a glance" />

      {/* Controls bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: `1px solid ${C.border}`,
        background: C.white,
        flexShrink: 0,
        gap: 12,
        flexWrap: 'wrap',
      }}>
        {/* Left: navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={navigatePrev}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.white,
              color: C.ink,
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ‹
          </button>
          <button
            onClick={goToday}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.white,
              color: C.ink,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              height: 30,
            }}
          >
            Today
          </button>
          <button
            onClick={navigateNext}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.white,
              color: C.ink,
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ›
          </button>
        </div>

        {/* Center: label */}
        <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, textAlign: 'center', flex: 1, minWidth: 0 }}>
          {headerLabel()}
        </div>

        {/* Right: new appointment button + walk-in badge + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            title="Subscribe to this calendar in Google Calendar, Apple Calendar, or Outlook"
            onClick={() => {
              const url = `webcal://${import.meta.env.VITE_SUPABASE_URL.replace('https://','')}/functions/v1/calendar-feed?boutique_id=${boutique?.id}`
              const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url)}`
              window.open(googleUrl, '_blank')
            }}
            style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${C.border}`, background:C.white, color:C.gray, cursor:'pointer', fontSize:11, height:30, display:'flex', alignItems:'center', gap:4 }}
          >
            📅 Subscribe
          </button>
          <GhostBtn label="⬇ .ics" onClick={downloadBulkIcs} style={{fontSize:12,padding:'5px 10px'}}/>
          <GhostBtn label="+ New Appointment" onClick={() => setShowStandaloneAppt(true)} />
          {todayWalkins.length > 0 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 20,
              background: '#FEF3C7',
              border: '1px solid #FCD34D',
              fontSize: 11,
              fontWeight: 600,
              color: '#92400E',
              whiteSpace: 'nowrap',
            }}>
              🚶 {todayWalkins.length} walk-in{todayWalkins.length !== 1 ? 's' : ''} today
            </div>
          )}
          <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            {[['Day', 'day'], ['Week', 'week'], ['Month', 'month'], ['Staff', 'staff']].map(([label, value]) =>
              segBtn(label, value)
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {view === 'day'   && <DayView />}
        {view === 'month' && <MonthView />}
        {view === 'week'  && <WeekView />}
        {view === 'staff' && <StaffView />}
        {view === 'month' && selectedDay && <DayPanel />}
      </div>

      {showStandaloneAppt && (
        <StandaloneAppointmentModal
          clients={clients}
          staff={staff}
          initialDate={selectedDay || ''}
          onClose={() => setShowStandaloneAppt(false)}
          onSaved={() => { setShowStandaloneAppt(false); fetchAppointments(); }}
        />
      )}
    </div>
  );
}
