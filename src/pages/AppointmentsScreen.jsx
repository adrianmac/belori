import React, { useState, useEffect } from 'react';
import { C } from '../lib/colors';
import { Topbar } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const TYPE_CFG = {
  consultation: { color: '#A84D5E', bg: '#FDF5F6', icon: '👗', label: 'Consultation',  labelEs: 'Consulta' },
  fitting:      { color: '#6B46B0', bg: '#F5F3FF', icon: '✂️', label: 'Fitting',        labelEs: 'Prueba' },
  pickup:       { color: '#0B8562', bg: '#F0FDF4', icon: '📦', label: 'Pickup',         labelEs: 'Recogida' },
  return:       { color: '#C87810', bg: '#FFFBEB', icon: '🔄', label: 'Return',         labelEs: 'Devolución' },
  measurement:  { color: '#1D4ED8', bg: '#DBEAFE', icon: '📏', label: 'Measurements',   labelEs: 'Medidas' },
  follow_up:    { color: '#7C3AED', bg: '#EDE9FE', icon: '📞', label: 'Follow-up',      labelEs: 'Seguimiento' },
  other:        { color: '#6B7280', bg: '#F9FAFB', icon: '📅', label: 'Other',          labelEs: 'Otro' },
};

const STATUS_CFG = {
  scheduled:  { label: 'Scheduled',  bg: '#DBEAFE', color: '#1E40AF' },
  confirmed:  { label: 'Confirmed',  bg: '#DCFCE7', color: '#15803D' },
  completed:  { label: 'Completed',  bg: '#DCFCE7', color: '#15803D' },
  done:       { label: 'Done',       bg: '#DCFCE7', color: '#15803D' },
  no_show:    { label: 'No show',    bg: '#FEE2E2', color: '#B91C1C' },
  cancelled:  { label: 'Cancelled',  bg: '#F3F4F6', color: '#6B7280' },
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekDates(refDate) {
  // Returns array of 7 YYYY-MM-DD strings starting from Monday of the week containing refDate
  const d = new Date(refDate + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
  }
  return dates;
}

function shiftWeek(weekDates, direction) {
  // direction: +1 or -1 (weeks)
  const base = new Date(weekDates[0] + 'T12:00:00');
  base.setDate(base.getDate() + direction * 7);
  const baseStr = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
  return getWeekDates(baseStr);
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AppointmentsScreen({ setScreen, hideTopbar }) {
  const { boutique } = useAuth();
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekDates, setWeekDates] = useState(() => getWeekDates(today));
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  async function loadAppts(dateStr) {
    if (!boutique?.id) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('appointments')
      .select('id, type, date, time, duration_minutes, status, client_name, client_id, note, staff_id')
      .eq('boutique_id', boutique.id)
      .eq('date', dateStr)
      .order('time', { ascending: true });
    if (error) {
      setLoadError(error.message || 'Failed to load appointments');
      setAppts([]);
    } else {
      setAppts(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAppts(selectedDate);
  }, [selectedDate, boutique?.id]);

  const selectedDateObj = new Date(selectedDate + 'T12:00:00');
  const selectedLabel = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {!hideTopbar && <Topbar
        title="Appointments / Citas"
        subtitle={selectedLabel}
        actions={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => {
                const prev = shiftWeek(weekDates, -1);
                setWeekDates(prev);
                setSelectedDate(prev[0]);
              }}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 14, color: C.gray, minHeight: 'unset', minWidth: 'unset' }}
              title="Previous week"
              aria-label="Previous week"
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              onClick={() => {
                setWeekDates(getWeekDates(today));
                setSelectedDate(today);
              }}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: C.rosaText, fontWeight: 500, minHeight: 'unset', minWidth: 'unset' }}
            >
              Today
            </button>
            <button
              onClick={() => {
                const next = shiftWeek(weekDates, 1);
                setWeekDates(next);
                setSelectedDate(next[0]);
              }}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 14, color: C.gray, minHeight: 'unset', minWidth: 'unset' }}
              title="Next week"
              aria-label="Next week"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        }
      />}

      {/* Week date tabs */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '8px 16px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
        {weekDates.map((d, i) => {
          const isSelected = d === selectedDate;
          const isToday = d === today;
          const dayObj = new Date(d + 'T12:00:00');
          const dayNum = dayObj.getDate();
          return (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              aria-pressed={isSelected}
              aria-label={`${DAY_LABELS[i]} ${dayNum}${isToday ? ', today' : ''}${isSelected ? ', selected' : ''}`}
              style={{
                flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: isSelected ? C.rosaText : isToday ? C.rosaPale : 'transparent',
                color: isSelected ? C.white : isToday ? C.rosaText : C.gray,
                fontWeight: isSelected || isToday ? 600 : 400,
                minHeight: 'unset', minWidth: 'unset',
                transition: 'all 0.15s',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{DAY_LABELS[i]}</span>
              <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>{dayNum}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline body */}
      <div className="page-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.gray, fontSize: 13, padding: '40px 0' }}>Loading…</div>
        ) : loadError ? (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14,
            padding: '24px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#B91C1C', marginBottom: 4 }}>Could not load appointments</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{loadError}</div>
            <button
              onClick={() => loadAppts(selectedDate)}
              style={{ marginTop: 12, fontSize: 12, color: C.rosaText, background: 'none', border: `1px solid ${C.rosaText}`, borderRadius: 7, padding: '5px 14px', cursor: 'pointer', fontWeight: 500 }}
            >
              Try again
            </button>
          </div>
        ) : appts.length === 0 ? (
          <div style={{
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: '40px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🌸</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 6 }}>No appointments / Sin citas</div>
            <div style={{ fontSize: 13, color: C.gray }}>No appointments scheduled for this day.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {appts.map((a, i) => {
              const cfg = TYPE_CFG[a.type] || TYPE_CFG.other;
              const statusCfg = STATUS_CFG[a.status] || { label: a.status || 'Scheduled', bg: '#F3F4F6', color: '#6B7280' };
              const timeStr = a.time ? a.time.slice(0, 5) : '—';
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: C.white,
                  borderRadius: i === 0 ? '12px 12px 0 0' : i === appts.length - 1 ? '0 0 12px 12px' : 0,
                  borderLeft: `1px solid ${C.border}`,
                  borderRight: `1px solid ${C.border}`,
                  borderTop: `1px solid ${C.border}`,
                  borderBottom: i === appts.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  {/* Time column */}
                  <div style={{ width: 48, flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color, lineHeight: 1 }}>{timeStr}</div>
                  </div>

                  {/* Icon bubble */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: cfg.bg, border: `1px solid ${cfg.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}>
                    {cfg.icon}
                  </div>

                  {/* Name + type */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.client_name || 'Client'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
                      {cfg.labelEs && <span style={{ fontSize: 10, color: C.gray }}>· {cfg.labelEs}</span>}
                    </div>
                    {a.note && (
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.note}</div>
                    )}
                  </div>

                  {/* Duration + status */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    {a.duration_minutes && (
                      <span style={{ fontSize: 10, color: C.gray, background: C.grayBg, borderRadius: 6, padding: '2px 6px' }}>
                        {a.duration_minutes} min
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      background: statusCfg.bg, color: statusCfg.color,
                      borderRadius: 6, padding: '2px 8px',
                      textDecoration: a.status === 'cancelled' ? 'line-through' : 'none',
                    }}>
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
