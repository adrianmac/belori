// EventActivityFeed — single chronological stream for everything that
// happened on this event: notes posted, payments collected, appointments
// booked / completed, alterations started / finished, tasks created /
// done, payment reminders sent, and any client interactions tagged to
// this event (calls, SMS, etc.).
//
// Replaces the inline activity panel that used to live in EventDetail.jsx.
// That version only covered 4 sources and was capped at ~25 lines of code;
// this one covers 8 sources, groups by day, supports filtering, and uses
// the couture aesthetic (cream cards, gold timeline rail, italic Cormorant
// section labels).
//
// The buildActivityStream() helper is exported separately so it can be
// unit-tested in isolation.

import React, { useMemo, useState } from 'react';
import { C, fmt } from '../../lib/colors';
import { useClientInteractions } from '../../hooks/useClients';

// ─── Pure helper — merge every event-scoped record into one timeline ──────
//
// Returns an array of items sorted DESC by `at` (ISO string). Each item:
//   { id, kind, at, headline, subhead?, amount?, actor? }
//
// kind: 'payment' | 'reminder' | 'appointment' | 'note' | 'task' |
//       'alteration' | 'interaction'
//
// `actor` is "Sarah" / "Owner" / "System" — whoever caused the event,
// when known.
export function buildActivityStream({
  notes = [],
  tasks = [],
  milestones = [],
  appointments = [],
  alterations = [],
  interactions = [],
}) {
  const out = [];

  // ── Notes ──────────────────────────────────────────────────────────────
  for (const n of notes) {
    if (!n.created_at) continue;
    out.push({
      id: `note-${n.id}`,
      kind: 'note',
      at: n.created_at,
      headline: 'Staff note added',
      body: n.text,
      actor: n.author?.name || n.author_name || 'Staff',
    });
  }

  // ── Tasks: created + completed (two events per task when applicable) ──
  for (const t of tasks) {
    if (t.created_at) {
      out.push({
        id: `task-add-${t.id}`,
        kind: 'task',
        at: t.created_at,
        headline: t.alert ? 'Alert task created' : 'Task added',
        body: t.text,
        actor: t.assigned_to_name || null,
      });
    }
    if (t.done && t.done_at) {
      out.push({
        id: `task-done-${t.id}`,
        kind: 'task',
        at: t.done_at,
        headline: 'Task completed',
        body: t.text,
        actor: t.done_by_name || null,
      });
    }
  }

  // ── Payments: created + paid + reminders sent ─────────────────────────
  for (const m of milestones) {
    const amt = Number(m.amount || 0);
    if (m.created_at) {
      out.push({
        id: `ms-add-${m.id}`,
        kind: 'payment',
        at: m.created_at,
        headline: `Milestone created · ${m.label}`,
        amount: amt,
      });
    }
    if (m.status === 'paid' && m.paid_date) {
      // paid_date is a DATE — treat as midday so it slots correctly relative to time-stamped rows
      out.push({
        id: `ms-paid-${m.id}`,
        kind: 'payment',
        at: `${m.paid_date}T12:00:00Z`,
        headline: `${m.label} paid`,
        amount: amt,
      });
    }
    if (m.last_reminded_at) {
      out.push({
        id: `ms-rem-${m.id}`,
        kind: 'reminder',
        at: m.last_reminded_at,
        headline: `Reminder sent · ${m.label}`,
        amount: amt,
      });
    }
  }

  // ── Appointments: booked + the appointment itself + completed/cancelled ──
  for (const a of appointments) {
    const apptType = (a.type || 'appointment').replace(/_/g, ' ');
    const staffName = a.staff?.name || null;

    // The "booking" — when the row was inserted
    if (a.created_at) {
      out.push({
        id: `appt-book-${a.id}`,
        kind: 'appointment',
        at: a.created_at,
        headline: `Appointment booked · ${apptType}`,
        body: formatApptWhen(a),
        actor: staffName,
      });
    }
    // The appointment itself (when the date arrives), only for non-cancelled rows
    if (a.date && a.status !== 'cancelled') {
      out.push({
        id: `appt-when-${a.id}`,
        kind: 'appointment',
        at: `${a.date}T${a.time || '12:00'}:00Z`,
        headline: a.status === 'done'
          ? `${apptType} completed`
          : a.status === 'missing'
          ? `${apptType} missed`
          : `${apptType} scheduled`,
        body: formatApptWhen(a),
        actor: staffName,
      });
    }
  }

  // ── Alterations: started + status changes (best-effort, no audit table) ──
  for (const j of alterations) {
    if (!j.created_at) continue;
    out.push({
      id: `alt-add-${j.id}`,
      kind: 'alteration',
      at: j.created_at,
      headline: `Alteration started · ${j.garment}`,
      body: j.deadline ? `Deadline ${j.deadline}` : null,
      amount: Number(j.price || 0) || null,
    });
    // Best-effort: if the job is complete and it has a deadline in the past,
    // surface it. (No completion timestamp in the schema yet — to do.)
    // Skip for now to avoid faking a date.
  }

  // ── Client interactions tagged to this event (SMS, email, calls, etc.) ──
  for (const i of interactions) {
    out.push({
      id: `int-${i.id}`,
      kind: 'interaction',
      at: i.occurred_at || i.created_at,
      headline: prettyInteractionTitle(i),
      body: i.body || null,
      actor: i.author_name || null,
    });
  }

  // Drop anything without a timestamp, sort newest-first
  return out
    .filter(x => !!x.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function formatApptWhen(a) {
  if (!a.date) return null;
  const d = new Date(a.date + 'T00:00:00');
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (!a.time) return datePart;
  const [h, m] = a.time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${datePart} · ${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function prettyInteractionTitle(i) {
  const t = (i.type || 'note').toLowerCase();
  const titleSuffix = i.title ? ` · ${i.title}` : '';
  switch (t) {
    case 'sms':       return `SMS sent${titleSuffix}`;
    case 'email':     return `Email sent${titleSuffix}`;
    case 'call':      return `Call logged${titleSuffix}`;
    case 'in_person':
    case 'visit':     return `In-person visit${titleSuffix}`;
    case 'reminder':  return `Reminder${titleSuffix}`;
    default:          return i.title || 'Interaction';
  }
}

// ─── Display helpers ──────────────────────────────────────────────────────

function dayBucketLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - dDay) / 86400000);
  if (diffDays === 0)   return 'Today';
  if (diffDays === 1)   return 'Yesterday';
  if (diffDays === -1)  return 'Tomorrow';
  if (diffDays > 1 && diffDays < 7)   return `${diffDays} days ago`;
  if (diffDays < 0 && diffDays > -7)  return `In ${-diffDays} days`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeOfDay(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Per-kind visual treatment — small dot + accent color on the timeline rail
const KIND_META = {
  payment:     { color: '#B08A4E', label: 'payment',     icon: '◆' },
  reminder:    { color: '#8E6B34', label: 'reminder',    icon: '⌁' },
  appointment: { color: '#A0596C', label: 'appointment', icon: '✦' },
  note:        { color: '#5C4A52', label: 'note',        icon: '·' },
  task:        { color: '#7A6670', label: 'task',        icon: '✓' },
  alteration:  { color: '#6B7A8E', label: 'alteration',  icon: '✁' },
  interaction: { color: '#9C7A52', label: 'interaction', icon: '✉' },
};

const FILTERS = [
  { key: 'all',          label: 'All' },
  { key: 'payment',      label: 'Money' },
  { key: 'appointment',  label: 'Schedule' },
  { key: 'note',         label: 'Notes' },
  { key: 'task',         label: 'Tasks' },
  { key: 'alteration',   label: 'Alterations' },
  { key: 'interaction',  label: 'Comms' },
];

// ─── Component ────────────────────────────────────────────────────────────

export default function EventActivityFeed({ event }) {
  const clientId = event?.client_id || event?.client?.id || null;
  // Pull this client's interactions and filter to ones tagged with this event.
  // Fetch is no-op if clientId missing.
  const { interactions } = useClientInteractions(clientId);
  const eventScopedInteractions = useMemo(
    () => (interactions || []).filter(i => i.related_event_id === event?.id),
    [interactions, event?.id]
  );

  const stream = useMemo(() => buildActivityStream({
    notes:        event?.notes        || [],
    tasks:        event?.tasks        || [],
    milestones:   event?.milestones   || [],
    appointments: event?.appointments || [],
    alterations:  event?.alteration_jobs || [],
    interactions: eventScopedInteractions,
  }), [event, eventScopedInteractions]);

  const [filter, setFilter] = useState('all');
  const visible = filter === 'all' ? stream : stream.filter(s => s.kind === filter);

  // Group items by day-bucket for visual chunking
  const grouped = useMemo(() => {
    const m = new Map();
    for (const it of visible) {
      const k = dayBucketLabel(it.at);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it);
    }
    return [...m.entries()];
  }, [visible]);

  // Per-kind counts for the filter chips (helps users see "ah, 4 payments")
  const counts = useMemo(() => {
    const c = { all: stream.length };
    for (const s of stream) c[s.kind] = (c[s.kind] || 0) + 1;
    return c;
  }, [stream]);

  return (
    <div data-testid="event-activity-feed" style={{
      background: '#FEFBF7',          // couture warm cream
      border: '1px solid #E8DFD2',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid #E8DFD2',
        display: 'flex', alignItems: 'baseline', gap: 12,
      }}>
        <span style={{
          fontFamily: "'Cormorant Garamond','Didot',Georgia,serif",
          fontStyle: 'italic',
          fontSize: 20,
          color: '#1C1118',
          lineHeight: 1,
        }}>
          The journal.
        </span>
        <span style={{
          fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
          fontSize: 11,
          color: '#7A6670',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }} data-testid="activity-total-count">
          {stream.length} entr{stream.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {/* Filter chips */}
      <div style={{
        padding: '10px 18px',
        borderBottom: '1px solid #E8DFD2',
        display: 'flex', gap: 6, flexWrap: 'wrap',
      }}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          const n = counts[f.key] || 0;
          if (f.key !== 'all' && n === 0) return null;     // hide chips with nothing to show
          return (
            <button
              key={f.key}
              data-testid={`activity-filter-${f.key}`}
              data-active={active ? 'true' : 'false'}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '5px 11px',
                borderRadius: 999,
                border: `1px solid ${active ? '#B08A4E' : '#D8C9A8'}`,
                background: active ? '#FBF2E3' : 'transparent',
                color: active ? '#5C3A0F' : '#5C4A52',
                fontSize: 11.5,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              {f.label}
              {n > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: 10, opacity: 0.75,
                  color: active ? '#5C3A0F' : '#7A6670',
                }}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div style={{ padding: '6px 0 14px' }}>
        {visible.length === 0 ? (
          <div data-testid="activity-empty" style={{
            padding: '32px 18px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'Cormorant Garamond','Didot',Georgia,serif",
              fontStyle: 'italic',
              fontSize: 16, color: '#7A6670', marginBottom: 6,
            }}>
              {filter === 'all' ? 'Nothing here yet.' : 'No matching entries.'}
            </div>
            <div style={{ fontSize: 11.5, color: '#7A6670' }}>
              {filter === 'all'
                ? 'Notes, payments, and appointments will land here as they happen.'
                : 'Try another filter.'}
            </div>
          </div>
        ) : grouped.map(([dayLabel, items]) => (
          <div key={dayLabel} data-testid={`activity-day-${dayLabel}`} style={{ paddingTop: 10 }}>
            {/* Day divider */}
            <div style={{
              padding: '0 18px 6px',
              fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
              fontSize: 10.5, color: '#8E6B34',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              fontWeight: 500,
            }}>
              {dayLabel}
            </div>

            {/* Items in this day */}
            {items.map(it => {
              const meta = KIND_META[it.kind] || KIND_META.note;
              return (
                <div
                  key={it.id}
                  data-testid={`activity-item-${it.kind}`}
                  data-activity-id={it.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '52px 1fr auto',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '8px 18px',
                    borderLeft: `2px solid transparent`,
                  }}
                >
                  {/* Time-of-day column (left) */}
                  <div style={{
                    fontSize: 10, color: '#8E8278',
                    paddingTop: 3,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatTimeOfDay(it.at)}
                  </div>

                  {/* Body */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      marginBottom: 2,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: meta.color, flexShrink: 0,
                      }} aria-hidden="true"/>
                      <span style={{
                        fontSize: 12.5, fontWeight: 500, color: '#1C1118',
                        lineHeight: 1.35,
                      }}>
                        {it.headline}
                      </span>
                    </div>
                    {it.body && (
                      <div style={{
                        fontSize: 11.5, color: '#5C4A52',
                        lineHeight: 1.5, paddingLeft: 13,
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {it.body}
                      </div>
                    )}
                    {it.actor && (
                      <div style={{
                        fontSize: 10.5, color: '#8E8278',
                        marginTop: 2, paddingLeft: 13,
                        letterSpacing: '0.04em',
                      }}>
                        {it.actor}
                      </div>
                    )}
                  </div>

                  {/* Amount column (right) — only payments/alterations */}
                  <div style={{
                    fontSize: 12, color: meta.color, fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    paddingTop: 2,
                  }}>
                    {it.amount != null && it.amount > 0 ? fmt(it.amount) : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
