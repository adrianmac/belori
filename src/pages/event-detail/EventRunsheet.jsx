import React, { useState } from 'react'
import { C, fmt } from '../../lib/colors'

const APT_ICONS = {
  Measurements: '📏', Fitting: '👗', 'Final Fitting': '✨', Pickup: '📦',
  Delivery: '🚚', Consultation: '💬', 'Alteration Drop-off': '🧵',
  'Contract Signing': '✍', Other: '📋',
}

function fmtTime(time) {
  if (!time) return 'TBD'
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export default function EventRunsheet({ ev, appointments = [], tasks = [], milestones = [], alteration = null, dressRental = null, onClose }) {
  const [printing, setPrinting] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const eventDate = ev.event_date

  // Sort appointments chronologically
  const sortedAppts = [...appointments]
    .filter(a => a.date && a.status !== 'cancelled')
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      if (!a.time) return 1
      if (!b.time) return -1
      return a.time < b.time ? -1 : 1
    })

  const upcomingAppts = sortedAppts.filter(a => a.date >= today)
  const pastAppts = sortedAppts.filter(a => a.date < today)

  const openTasks = tasks.filter(t => !t.done)
  const alertTasks = openTasks.filter(t => t.alert)
  const normalTasks = openTasks.filter(t => !t.alert)
  const doneTasks = tasks.filter(t => t.done)

  const unpaidMilestones = milestones.filter(m => m.status !== 'paid')
  const paidMilestones = milestones.filter(m => m.status === 'paid')

  const handlePrint = () => {
    setPrinting(true)
    setTimeout(() => { window.print(); setPrinting(false) }, 100)
  }

  const daysUntil = eventDate
    ? Math.ceil((new Date(eventDate + 'T12:00:00') - new Date()) / 86400000)
    : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
      <div style={{ background: C.white, borderRadius: 16, width: '100%', maxWidth: 680, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', marginBottom: 20 }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, fontFamily: 'Georgia,serif' }}>
              {ev.client} — Day-of Runsheet
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
              {eventDate ? new Date(eventDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Date TBD'}
              {daysUntil !== null && daysUntil > 0 && (
                <span style={{ marginLeft: 8, fontWeight: 600, color: daysUntil <= 7 ? '#DC2626' : daysUntil <= 30 ? '#D97706' : '#15803D' }}>
                  ({daysUntil} days away)
                </span>
              )}
              {ev.venue && ` · ${ev.venue}`}
            </div>
          </div>
          <button onClick={handlePrint}
            style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, color: C.gray, cursor: 'pointer', fontWeight: 500 }}>
            🖨 Print
          </button>
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, fontSize: 18, color: C.gray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Summary row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { label: 'Contract value', val: fmt(ev.total), color: C.ink },
              { label: 'Collected', val: fmt(ev.paid), color: 'var(--text-success)' },
              { label: 'Remaining', val: fmt(ev.total - ev.paid), color: ev.total - ev.paid > 0 ? 'var(--text-danger)' : 'var(--text-success)' },
              { label: 'Open tasks', val: String(openTasks.length), color: openTasks.length > 0 ? 'var(--text-warning)' : 'var(--text-success)' },
            ].map(s => (
              <div key={s.label} style={{ background: C.ivory, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Alert tasks ── */}
          {alertTasks.length > 0 && (
            <Section title="⚠️ Priority tasks" accent="#FEF3C7" borderColor="#FDE68A">
              {alertTasks.map(t => (
                <div key={t.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11, flex: 1, color: '#92400E', fontWeight: 500 }}>{t.text}</span>
                  <span style={{ fontSize: 10, color: C.gray }}>{t.category}</span>
                </div>
              ))}
            </Section>
          )}

          {/* ── Upcoming appointments ── */}
          {upcomingAppts.length > 0 && (
            <Section title="📅 Upcoming appointments">
              {upcomingAppts.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: C.rosaPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {APT_ICONS[a.type] || '📋'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>{a.type?.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>{fmtDate(a.date)}{a.time ? ` at ${fmtTime(a.time)}` : ''}{a.note ? ` · ${a.note}` : ''}</div>
                  </div>
                  {a.staff?.name && <div style={{ fontSize: 10, color: C.gray, flexShrink: 0 }}>{a.staff.name}</div>}
                </div>
              ))}
            </Section>
          )}

          {/* ── Payment schedule ── */}
          {milestones.length > 0 && (
            <Section title="💳 Payment schedule">
              {milestones.map(m => {
                const col = m.status === 'paid' ? 'var(--color-success)' : m.status === 'overdue' ? 'var(--color-danger)' : C.gray
                const textCol = m.status === 'paid' ? 'var(--text-success)' : m.status === 'overdue' ? 'var(--text-danger)' : C.gray
                const dueStr = m.due_date ? new Date(m.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 12, color: C.ink }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: textCol }}>{m.status === 'paid' ? 'Paid ✓' : `Due ${dueStr}`}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: textCol }}>{fmt(m.amount)}</div>
                  </div>
                )
              })}
            </Section>
          )}

          {/* ── Dress rental ── */}
          {dressRental && (
            <Section title="👗 Dress rental">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                {[
                  { label: 'Dress', val: dressRental.name || '—' },
                  { label: 'Status', val: dressRental.status || '—' },
                  { label: 'Pickup', val: dressRental.pickupDate || '—' },
                  { label: 'Return', val: dressRental.returnDate || '—' },
                ].map(r => (
                  <div key={r.label}>
                    <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.label}</div>
                    <div style={{ color: C.ink, marginTop: 2 }}>{r.val}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Alteration status ── */}
          {alteration && (
            <Section title="🧵 Alterations">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                {[
                  { label: 'Garment', val: alteration.garment },
                  { label: 'Status', val: alteration.status?.replace(/_/g, ' ') },
                  { label: 'Seamstress', val: alteration.seamstress_name || '—' },
                  { label: 'Deadline', val: alteration.deadline || '—' },
                ].map(r => (
                  <div key={r.label}>
                    <div style={{ fontSize: 10, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.label}</div>
                    <div style={{ color: C.ink, marginTop: 2 }}>{r.val}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── All tasks ── */}
          {normalTasks.length > 0 && (
            <Section title={`✅ Open tasks (${normalTasks.length})`}>
              {normalTasks.slice(0, 10).map(t => (
                <div key={t.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${C.border}`, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, fontSize: 12, color: C.ink }}>{t.text}</div>
                  <div style={{ fontSize: 10, color: C.gray }}>{t.category}</div>
                </div>
              ))}
              {normalTasks.length > 10 && <div style={{ fontSize: 11, color: C.gray, paddingTop: 6 }}>+{normalTasks.length - 10} more tasks</div>}
            </Section>
          )}

          {/* ── Past appointments ── */}
          {pastAppts.length > 0 && (
            <Section title="📆 Past appointments" muted>
              {pastAppts.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: `1px solid ${C.border}`, opacity: 0.6 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, flex: 1 }}>{a.type?.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>{fmtDate(a.date)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-success)' }}>✓</div>
                </div>
              ))}
            </Section>
          )}

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, fontSize: 11, color: C.gray, textAlign: 'center' }}>
            Generated by Belori · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, accent, borderColor, muted }) {
  return (
    <div style={{ background: accent || C.white, border: `1px solid ${borderColor || C.border}`, borderRadius: 12, overflow: 'hidden', opacity: muted ? 0.8 : 1 }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${borderColor || C.border}`, fontSize: 12, fontWeight: 600, color: C.ink, background: accent ? 'transparent' : C.ivory }}>
        {title}
      </div>
      <div style={{ padding: '2px 14px 8px' }}>
        {children}
      </div>
    </div>
  )
}
