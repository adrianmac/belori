import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useEvents, useEvent } from '../hooks/useEvents'
import { useNotes } from '../hooks/useNotes'
import { useBoutique } from '../hooks/useBoutique'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { C, fmt, EVT_TYPES, SVC_LABELS } from '../lib/colors'
import {
  Topbar, PrimaryBtn, GhostBtn, Badge, Avatar,
  ProgressBar, EventTypeBadge, inputSt, LBL, useToast,
} from '../lib/ui.jsx'
import { useLayoutMode } from '../hooks/useLayoutMode.jsx'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function countdownConfig(daysUntil) {
  if (daysUntil <= 0)  return { text: 'Today!', bg: C.redBg,   color: C.red   }
  if (daysUntil <= 7)  return { text: `${daysUntil}d`, bg: C.redBg,   color: C.red   }
  if (daysUntil <= 30) return { text: `${daysUntil}d`, bg: C.amberBg, color: C.amber }
  return                      { text: `${daysUntil}d`, bg: C.blueBg,  color: C.blue  }
}

function hasAlertTasks(ev) {
  return (ev.tasks || []).some(t => !t.done && t.alert)
}
function hasOverduePayment(ev) {
  return (ev.overdue || 0) > 0
}
function hasMissingAppointments(ev) {
  return (ev.missingAppointments || []).length > 0
}
function needsAttention(ev) {
  return hasAlertTasks(ev) || hasOverduePayment(ev) || hasMissingAppointments(ev)
}

const TASK_CATEGORIES = ['General', 'Dress', 'Payments', 'Venue', 'Vendors', 'Legal', 'Other']
const APPT_TYPES = [
  'consultation', 'fitting_1', 'fitting_2', 'fitting_3', 'pickup',
  'alteration_drop', 'alteration_pickup', 'venue_walkthrough', 'rehearsal', 'other',
]
function apptTypeLabel(t) {
  return (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function today() {
  return new Date().toISOString().split('T')[0]
}

// ─── LEFT PANEL: EVENT ROW ────────────────────────────────────────────────────

function EventRow({ event, selected, onClick }) {
  const cb = countdownConfig(event.daysUntil)
  const alertTask = hasAlertTasks(event)
  const overdue   = hasOverduePayment(event)
  const allGood   = !alertTask && !overdue && !hasMissingAppointments(event)

  const clientName = typeof event.client === 'string'
    ? event.client
    : (event.clientData?.name || event.client || '—')

  const typeInfo = EVT_TYPES[event.type] || { label: event.type, icon: '📅' }

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', cursor: 'pointer',
        background: selected ? C.rosaPale : C.white,
        borderBottom: `1px solid ${C.border}`,
        transition: 'background 0.12s',
        minHeight: 64,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = C.ivory }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = C.white }}
    >
      {/* Countdown pill */}
      <span style={{
        fontSize: 10, padding: '3px 7px', borderRadius: 999,
        background: cb.bg, color: cb.color, fontWeight: 700,
        whiteSpace: 'nowrap', flexShrink: 0, minWidth: 34, textAlign: 'center',
      }}>{cb.text}</span>

      {/* Middle: name + type + date */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: C.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{clientName}</div>
        <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
          {typeInfo.icon} {typeInfo.label} · {event.date}
        </div>
      </div>

      {/* Urgency indicators */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {alertTask && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, display: 'block' }} title="Alert tasks" />
        )}
        {overdue && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.amber, display: 'block' }} title="Overdue payment" />
        )}
        {allGood && (
          <span style={{ fontSize: 11, color: C.green }} title="All good">✓</span>
        )}
      </div>
    </div>
  )
}

// ─── RIGHT PANEL: SECTION CARD ────────────────────────────────────────────────

function SectionCard({ title, action, onAction, children }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, padding: 16,
      marginBottom: 12, border: `1px solid ${C.border}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{title}</span>
        {action && (
          <button onClick={onAction} style={{
            fontSize: 12, color: C.rosa, background: 'none', border: 'none',
            cursor: 'pointer', fontWeight: 500, padding: '2px 6px',
          }}>{action}</button>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── TASKS SECTION ────────────────────────────────────────────────────────────

function TasksSection({ event, boutique, onRefetch }) {
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [newText, setNewText]       = useState('')
  const [newCat, setNewCat]         = useState('General')
  const [newAlert, setNewAlert]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [showDone, setShowDone]     = useState(false)
  const [toggling, setToggling]     = useState({})

  const tasks = event?.tasks || []
  const open  = tasks.filter(t => !t.done)
  const done  = tasks.filter(t => t.done)

  async function toggleTask(id, newDone) {
    setToggling(p => ({ ...p, [id]: true }))
    const { error } = await supabase
      .from('tasks')
      .update({ done: newDone })
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (error) toast('Failed to update task', 'error')
    else onRefetch()
    setToggling(p => ({ ...p, [id]: false }))
  }

  async function addTask() {
    if (!newText.trim()) return
    setSaving(true)
    const { error } = await supabase.from('tasks').insert({
      event_id: event.id,
      boutique_id: boutique.id,
      text: newText.trim(),
      category: newCat,
      alert: newAlert,
      done: false,
    })
    setSaving(false)
    if (error) { toast('Failed to add task', 'error'); return }
    setNewText(''); setNewCat('General'); setNewAlert(false); setShowAdd(false)
    onRefetch()
    toast('Task added')
  }

  function renderTask(t) {
    return (
      <div key={t.id} style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '7px 0', borderBottom: `1px solid ${C.border}`,
        borderLeft: t.alert && !t.done ? `3px solid ${C.red}` : '3px solid transparent',
        paddingLeft: 8, opacity: t.done ? 0.45 : 1,
      }}>
        <input
          type="checkbox"
          checked={!!t.done}
          disabled={!!toggling[t.id]}
          onChange={e => toggleTask(t.id, e.target.checked)}
          style={{ marginTop: 2, cursor: 'pointer', accentColor: C.rosa, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 13, color: C.ink,
            textDecoration: t.done ? 'line-through' : 'none',
          }}>{t.text}</span>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 6,
              background: C.grayBg, color: C.gray,
            }}>{t.category || 'General'}</span>
            {t.alert && !t.done && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 6,
                background: C.redBg, color: C.red, fontWeight: 600,
              }}>ALERT</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <SectionCard
      title={`Tasks (${open.length} open${done.length ? `, ${done.length} done` : ''})`}
      action={showAdd ? null : '+ Add'}
      onAction={() => setShowAdd(true)}
    >
      {open.length === 0 && !showAdd && (
        <div style={{ fontSize: 12, color: C.gray, textAlign: 'center', padding: '10px 0' }}>
          No open tasks
        </div>
      )}
      {open.map(renderTask)}

      {/* Add task form */}
      {showAdd && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            autoFocus
            placeholder="Task description…"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setShowAdd(false) }}
            style={{ ...inputSt }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              style={{ ...inputSt, flex: 1 }}
            >
              {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.gray, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <input type="checkbox" checked={newAlert} onChange={e => setNewAlert(e.target.checked)} style={{ accentColor: C.red }} />
              Alert
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PrimaryBtn label={saving ? 'Saving…' : 'Add task'} onClick={addTask} disabled={saving} style={{ flex: 1 }} />
            <GhostBtn label="Cancel" onClick={() => { setShowAdd(false); setNewText('') }} style={{ flex: 1 }} />
          </div>
        </div>
      )}

      {/* Done tasks toggle */}
      {done.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setShowDone(s => !s)}
            style={{ fontSize: 12, color: C.gray, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showDone ? '▾' : '▸'} {done.length} completed task{done.length > 1 ? 's' : ''}
          </button>
          {showDone && done.map(renderTask)}
        </div>
      )}
    </SectionCard>
  )
}

// ─── APPOINTMENTS SECTION ─────────────────────────────────────────────────────

function AppointmentsSection({ event, boutique, staff, createAppointment, onRefetch }) {
  const toast = useToast()
  const [showForm, setShowForm]   = useState(false)
  const [type, setType]           = useState('consultation')
  const [date, setDate]           = useState('')
  const [time, setTime]           = useState('')
  const [staffId, setStaffId]     = useState('')
  const [saving, setSaving]       = useState(false)

  const appointments = event?.appointments || []
  const missing      = event?.missingAppointments || []

  async function submit() {
    if (!type || !date) { toast('Date and type required', 'error'); return }
    setSaving(true)
    const { error } = await createAppointment({
      type, date, time: time || null,
      staff_id: staffId || null,
    })
    setSaving(false)
    if (error) { toast('Failed to schedule appointment', 'error'); return }
    setType('consultation'); setDate(''); setTime(''); setStaffId(''); setShowForm(false)
    toast('Appointment scheduled')
  }

  const sorted = [...appointments].sort((a, b) => {
    if (!a.date) return 1; if (!b.date) return -1
    return new Date(a.date) - new Date(b.date)
  })

  return (
    <SectionCard
      title="Appointments"
      action={showForm ? null : '+ Schedule'}
      onAction={() => setShowForm(true)}
    >
      {/* Missing appointment warnings */}
      {missing.map((m, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8,
          background: C.amberBg, color: C.amber,
          fontSize: 12, fontWeight: 500,
          marginBottom: 6,
        }}>
          <span>⚠</span>
          <span>No {((m?.type || m || '').toString()).replace(/_/g, ' ')} scheduled yet</span>
        </div>
      ))}

      {sorted.length === 0 && missing.length === 0 && (
        <div style={{ fontSize: 12, color: C.gray, textAlign: 'center', padding: '10px 0' }}>
          No appointments scheduled
        </div>
      )}

      {sorted.map(a => {
        const staffMember = staff.find(s => s.id === a.staff_id)
        const apptDate = a.date ? new Date(a.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
        return (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0', borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>
                {apptTypeLabel(a.type)}
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
                {apptDate}{a.time ? ` · ${a.time.slice(0, 5)}` : ''}{staffMember ? ` · ${staffMember.name}` : ''}
              </div>
            </div>
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999,
              background: a.status === 'confirmed' ? C.greenBg : C.blueBg,
              color: a.status === 'confirmed' ? C.green : C.blue,
              fontWeight: 500,
            }}>{a.status || 'scheduled'}</span>
          </div>
        )
      })}

      {/* Inline add form */}
      {showForm && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={LBL}>Type</div>
              <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputSt }}>
                {APPT_TYPES.map(t => <option key={t} value={t}>{apptTypeLabel(t)}</option>)}
              </select>
            </div>
            <div>
              <div style={LBL}>Staff</div>
              <select value={staffId} onChange={e => setStaffId(e.target.value)} style={{ ...inputSt }}>
                <option value="">— Unassigned —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={LBL}>Date</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputSt }} />
            </div>
            <div>
              <div style={LBL}>Time</div>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputSt }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PrimaryBtn label={saving ? 'Saving…' : 'Schedule'} onClick={submit} disabled={saving} style={{ flex: 1 }} />
            <GhostBtn label="Cancel" onClick={() => setShowForm(false)} style={{ flex: 1 }} />
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── PAYMENTS SECTION ─────────────────────────────────────────────────────────

function PaymentsSection({ event, boutique, onRefetch }) {
  const toast   = useToast()
  const [paying, setPaying] = useState({})

  const milestones = event?.milestones || []
  const total      = event?.total || 0
  const paid       = event?.paid  || 0

  async function markPaid(m) {
    setPaying(p => ({ ...p, [m.id]: true }))
    const { error } = await supabase
      .from('payment_milestones')
      .update({ status: 'paid', paid_date: today() })
      .eq('id', m.id)
      .eq('boutique_id', boutique.id)

    if (error) {
      toast('Failed to mark paid', 'error')
    } else {
      // Also update event paid amount
      const newPaid = paid + Number(m.amount)
      await supabase
        .from('events')
        .update({ paid: newPaid })
        .eq('id', event.id)
        .eq('boutique_id', boutique.id)
      toast('Marked as paid')
      onRefetch()
    }
    setPaying(p => ({ ...p, [m.id]: false }))
  }

  if (milestones.length === 0 && total === 0) {
    return (
      <SectionCard title="Payments">
        <div style={{ fontSize: 12, color: C.gray, textAlign: 'center', padding: '10px 0' }}>
          No payment milestones
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Payments">
      {/* Progress bar */}
      {total > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.gray, marginBottom: 6 }}>
            <span>{fmt(paid)} paid</span>
            <span>{fmt(total)} total</span>
          </div>
          <ProgressBar paid={paid} total={total} height={6} />
        </div>
      )}

      {milestones.map(m => {
        const isOverdue = m.status === 'overdue'
        const isPaid    = m.status === 'paid'
        const dueStr    = m.due_date ? new Date(m.due_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
        return (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8, marginBottom: 6,
            background: isOverdue ? C.redBg : C.grayBg,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{m.label}</div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
                {fmt(m.amount)} · Due {dueStr}
                {m.daysLate > 0 ? ` · ${m.daysLate}d overdue` : ''}
              </div>
            </div>
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999,
              background: isPaid ? C.greenBg : isOverdue ? C.redBg : C.amberBg,
              color: isPaid ? C.green : isOverdue ? C.red : C.amber,
              fontWeight: 600, flexShrink: 0,
            }}>{m.status}</span>
            {!isPaid && (
              <button
                onClick={() => markPaid(m)}
                disabled={!!paying[m.id]}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 7,
                  border: 'none', cursor: 'pointer', fontWeight: 600,
                  background: C.rosa, color: C.white, flexShrink: 0,
                  opacity: paying[m.id] ? 0.6 : 1,
                }}
              >{paying[m.id] ? '…' : 'Mark Paid'}</button>
            )}
          </div>
        )
      })}
    </SectionCard>
  )
}

// ─── NOTES SECTION ────────────────────────────────────────────────────────────

function NotesSection({ eventId }) {
  const { notes, addNote } = useNotes(eventId)
  const toast = useToast()
  const [text, setText]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [expanded, setExpanded] = useState(false)

  const displayNotes = expanded ? notes : notes.slice(0, 3)

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    const { error } = await addNote(text.trim())
    setSaving(false)
    if (error) { toast('Failed to add note', 'error'); return }
    setText('')
    toast('Note added')
  }

  return (
    <SectionCard title={`Notes (${notes.length})`}>
      {displayNotes.map(n => {
        const initials = n.author?.initials || (n.author?.name || '?').slice(0, 2).toUpperCase()
        const bg       = n.author?.color || C.rosaPale
        const ts       = n.created_at
          ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : ''
        return (
          <div key={n.id} style={{
            display: 'flex', gap: 10, padding: '8px 0',
            borderBottom: `1px solid ${C.border}`,
          }}>
            <Avatar initials={initials} size={28} bg={bg} color={C.white} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: C.gray, marginBottom: 2 }}>
                {n.author?.name || 'Staff'} · {ts}
              </div>
              <div style={{ fontSize: 13, color: C.ink, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {n.text}
              </div>
            </div>
          </div>
        )
      })}

      {notes.length > 3 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{ fontSize: 12, color: C.rosa, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
        >Show {notes.length - 3} more notes</button>
      )}

      {/* Add note */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          placeholder="Add a note…"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <PrimaryBtn
          label={saving ? 'Saving…' : 'Add note'}
          onClick={submit}
          disabled={saving || !text.trim()}
          style={{ alignSelf: 'flex-end' }}
        />
      </div>
    </SectionCard>
  )
}

// ─── RIGHT PANEL: EVENT DETAIL ────────────────────────────────────────────────

function EventDetailPanel({ eventId, setScreen, setSelectedEvent, staff }) {
  const { event, loading, refetch, createAppointment } = useEvent(eventId)
  const { boutique } = useAuth()
  const toast = useToast()

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>
        Loading…
      </div>
    )
  }
  if (!event) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>
        Event not found
      </div>
    )
  }

  const clientName = typeof event.client === 'string'
    ? event.client
    : (event.clientData?.name || event.client || '—')
  const typeInfo = EVT_TYPES[event.type] || { label: event.type, icon: '📅' }
  const cb = countdownConfig(event.daysUntil)

  function goFullDetail() {
    setSelectedEvent(event.id)
    setScreen('event_detail')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      {/* Header card */}
      <div style={{
        background: C.white, borderRadius: 12, padding: 16,
        marginBottom: 12, border: `1px solid ${C.border}`,
      }}>
        {/* Name + type + countdown */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{clientName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <EventTypeBadge type={event.type} />
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 999,
                background: cb.bg, color: cb.color, fontWeight: 700,
              }}>{cb.text}</span>
              <span style={{ fontSize: 12, color: C.gray }}>
                {event.date}{event.venue ? ` · ${event.venue}` : ''}
              </span>
            </div>
          </div>
          <button
            onClick={goFullDetail}
            style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.white,
              color: C.ink, cursor: 'pointer', fontWeight: 500, flexShrink: 0,
            }}
          >Full detail →</button>
        </div>

        {/* Payment progress */}
        {event.total > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.gray, marginBottom: 4 }}>
              <span>{fmt(event.paid)} paid of {fmt(event.total)}</span>
              {event.overdue > 0 && (
                <span style={{ color: C.red, fontWeight: 600 }}>{fmt(event.overdue)} overdue</span>
              )}
            </div>
            <ProgressBar paid={event.paid} total={event.total} height={6} />
          </div>
        )}
      </div>

      {/* Sections */}
      <TasksSection event={event} boutique={boutique} onRefetch={refetch} />
      <AppointmentsSection event={event} boutique={boutique} staff={staff} createAppointment={createAppointment} onRefetch={refetch} />
      <PaymentsSection event={event} boutique={boutique} onRefetch={refetch} />
      <NotesSection eventId={event.id} />
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'week',      label: 'This Week' },
  { id: 'month',     label: 'This Month' },
  { id: 'attention', label: 'Needs Attention' },
]

export default function EventPlanning({ setScreen, setSelectedEvent }) {
  const { events = [], loading } = useEvents()
  const { getStaff } = useBoutique()
  const { isTablet } = useLayoutMode()
  const [staff, setStaff]             = useState([])
  const [filter, setFilter]           = useState('all')
  const [selectedId, setSelectedId]   = useState(null)

  // Load staff once on mount
  useEffect(() => {
    getStaff().then(({ data }) => { if (data?.length) setStaff(data) })
  }, [])

  // Active events sorted by date
  const activeEvents = useMemo(() =>
    (events || [])
      .filter(e => e.status === 'active' && e.event_date)
      .sort((a, b) => a.daysUntil - b.daysUntil),
    [events]
  )

  // Apply filter
  const filtered = useMemo(() => {
    switch (filter) {
      case 'week':      return activeEvents.filter(e => e.daysUntil <= 7)
      case 'month':     return activeEvents.filter(e => e.daysUntil <= 30)
      case 'attention': return activeEvents.filter(needsAttention)
      default:          return activeEvents
    }
  }, [activeEvents, filter])

  // Auto-select first event when filtered list changes
  const firstId = filtered[0]?.id
  useEffect(() => {
    if (filtered.length > 0) {
      setSelectedId(id => {
        // Keep current selection if it's still in filtered list
        if (id && filtered.find(e => e.id === id)) return id
        return filtered[0].id
      })
    } else {
      setSelectedId(null)
    }
  }, [firstId, filter])

  // Summary stats
  const totalAlertTasks = useMemo(() =>
    activeEvents.reduce((sum, e) => sum + (e.tasks || []).filter(t => !t.done && t.alert).length, 0),
    [activeEvents]
  )
  const totalOverdue = useMemo(() =>
    activeEvents.reduce((sum, e) => sum + (e.overdue || 0), 0),
    [activeEvents]
  )

  function handleNewEvent() {
    sessionStorage.setItem('belori_autoopen', 'new_event')
    setScreen('events')
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.grayBg }}>
      {/* Topbar */}
      <Topbar
        title="Event Planning"
        subtitle={`${activeEvents.length} active event${activeEvents.length !== 1 ? 's' : ''}`}
        actions={<PrimaryBtn label="+ New Event" onClick={handleNewEvent} />}
      />

      {/* Summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '8px 16px', background: C.white,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {totalAlertTasks > 0 && (
          <span style={{ fontSize: 12, color: C.red, fontWeight: 600, background: C.redBg, padding: '2px 8px', borderRadius: 6 }}>
            {totalAlertTasks} alert task{totalAlertTasks !== 1 ? 's' : ''}
          </span>
        )}
        {totalOverdue > 0 && (
          <span style={{ fontSize: 12, color: C.amber, fontWeight: 600, background: C.amberBg, padding: '2px 8px', borderRadius: 6 }}>
            {fmt(totalOverdue)} overdue
          </span>
        )}
        {loading && <span style={{ fontSize: 11, color: C.gray, marginLeft: 'auto' }}>Loading…</span>}
      </div>

      {/* Main layout: left panel + right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isTablet ? 'column' : 'row', overflow: 'hidden' }}>

        {/* LEFT PANEL */}
        <div style={{
          width: isTablet ? '100%' : 'clamp(220px, 25vw, 320px)',
          minWidth: isTablet ? undefined : 220,
          flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: isTablet ? 'none' : `1px solid ${C.border}`,
          borderBottom: isTablet ? `1px solid ${C.border}` : 'none',
          background: C.white, overflow: 'hidden',
          maxHeight: isTablet ? '40%' : undefined,
        }}>
          {/* Filter tabs */}
          <div style={{
            display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`,
            flexShrink: 0, overflowX: 'auto',
          }}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  flex: '1 1 0', padding: '10px 6px', fontSize: 11, fontWeight: 600,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: filter === f.id ? C.rosa : C.gray,
                  borderBottom: filter === f.id ? `2px solid ${C.rosa}` : '2px solid transparent',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.12s, border-color 0.12s',
                }}
              >{f.label}</button>
            ))}
          </div>

          {/* Count */}
          <div style={{ padding: '6px 14px', fontSize: 11, color: C.gray, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </div>

          {/* Event list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{
                padding: 24, textAlign: 'center', color: C.gray,
                fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
              }}>
                <span style={{ fontSize: 28 }}>🗓️</span>
                <span>No events match this filter</span>
              </div>
            ) : (
              filtered.map(ev => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  selected={ev.id === selectedId}
                  onClick={() => setSelectedId(ev.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        {selectedId ? (
          <EventDetailPanel
            key={selectedId}
            eventId={selectedId}
            setScreen={setScreen}
            setSelectedEvent={setSelectedEvent}
            staff={staff}
          />
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: C.gray, gap: 10,
          }}>
            <span style={{ fontSize: 36 }}>📋</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>Select an event to view details</span>
            <span style={{ fontSize: 13 }}>Choose an event from the list on the left</span>
            {activeEvents.length === 0 && !loading && (
              <PrimaryBtn label="+ New Event" onClick={handleNewEvent} style={{ marginTop: 8 }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
