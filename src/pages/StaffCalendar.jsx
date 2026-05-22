import React, { useState, useEffect, useMemo, useRef } from 'react'
import { C } from '../lib/colors'
import { Topbar } from '../lib/ui.jsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useStaffAvailability } from '../hooks/useStaffAvailability'

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const FALLBACK_COLORS = [
  '#C9697A','#7C6FCD','#3B9EBF','#45B37A','#E8953A','#E85A7A',
]

const APT_ICONS = {
  Measurements: '📏', Fitting: '👗', 'Final Fitting': '✨', Pickup: '📦',
  Delivery: '🚚', Consultation: '💬', 'Alteration Drop-off': '🧵',
  'Contract Signing': '✍', Other: '📋',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function toDateStr(d) {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  // shift: Mon=0 ... Sun=6
  const diff = (day === 0) ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function buildWeekDays(anchor) {
  const mon = getMonday(anchor)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function buildMonthGrid(anchor) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  // Mon-based offset: getDay() 0=Sun,1=Mon...6=Sat → Mon-based: (day+6)%7
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const totalCells = Math.ceil((startOffset + new Date(year, month + 1, 0).getDate()) / 7) * 7
  return Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(year, month, 1 - startOffset + i)
    return d
  })
}

function formatWeekRange(days) {
  const first = days[0]
  const last = days[6]
  const sameMonth = first.getMonth() === last.getMonth()
  if (sameMonth) {
    return `${MONTH_NAMES[first.getMonth()].slice(0,3)} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`
  }
  return `${MONTH_NAMES[first.getMonth()].slice(0,3)} ${first.getDate()} – ${MONTH_NAMES[last.getMonth()].slice(0,3)} ${last.getDate()}, ${last.getFullYear()}`
}

function staffColor(member, index) {
  if (member?.color && /^#[0-9A-Fa-f]{6}$/.test(member.color)) return member.color
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function lighten(hex, amount = 0.88) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return '#FDF5F6'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const m = (c) => Math.round(c * (1 - amount) + 255 * amount)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

// ─── Popover ─────────────────────────────────────────────────────────────────

function ApptPopover({ appt, staffMap, onClose }) {
  const ref = useRef(null)
  const member = staffMap[appt.staff_id]
  const color = member ? staffColor(member, Object.keys(staffMap).indexOf(appt.staff_id)) : C.gray
  const clientName = appt.event?.client?.name || appt.client_name || '—'
  const icon = APT_ICONS[appt.type] || '📋'

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', zIndex: 500,
        background: C.white, border: `1px solid ${C.border}`,
        borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
        padding: '14px 18px', minWidth: 220, maxWidth: 300,
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{clientName !== '—' ? clientName : (appt.type || 'Appointment')}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 18, lineHeight: 1, padding: '0 2px' }} aria-label="Close">×</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: C.ink }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: C.gray, minWidth: 46 }}>Client</span>
          <span style={{ fontWeight: 500 }}>{clientName}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: C.gray, minWidth: 46 }}>Time</span>
          <span>{fmtTime(appt.time)}</span>
        </div>
        {member && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: C.gray, minWidth: 46 }}>Staff</span>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: lighten(color, 0.85), color, borderRadius: 20,
                padding: '2px 8px', fontWeight: 500,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              {member.name || member.initials || 'Staff'}
            </span>
          </div>
        )}
        {appt.note && (
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: C.gray, minWidth: 46 }}>Note</span>
            <span style={{ color: C.gray, lineHeight: 1.4 }}>{appt.note}</span>
          </div>
        )}
        {appt.status && (
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: C.gray, minWidth: 46 }}>Status</span>
            <span style={{ textTransform: 'capitalize' }}>{appt.status}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function ApptChip({ appt, staffMap, compact, onClick }) {
  const member = staffMap[appt.staff_id]
  const idx = member ? Object.values(staffMap).indexOf(member) : 0
  const color = member ? staffColor(member, idx) : C.gray
  const clientName = appt.event?.client?.name || appt.client_name || '—'
  const icon = APT_ICONS[appt.type] || '📋'

  if (compact) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick(appt) }}
        title={`${appt.type} — ${clientName} ${fmtTime(appt.time)}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: lighten(color, 0.82), borderLeft: `3px solid ${color}`,
          borderRadius: 4, padding: '2px 5px',
          fontSize: 11, color: C.ink, cursor: 'pointer',
          maxWidth: '100%', overflow: 'hidden', whiteSpace: 'nowrap',
          marginBottom: 2,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientName}</span>
      </div>
    )
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(appt) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: lighten(color, 0.82), borderLeft: `3px solid ${color}`,
        borderRadius: 5, padding: '5px 8px',
        fontSize: 12, color: C.ink, cursor: 'pointer',
        marginBottom: 4,
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = lighten(color, 0.72)}
      onMouseLeave={e => e.currentTarget.style.background = lighten(color, 0.82)}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {icon} {clientName !== '—' ? clientName : (appt.type || 'Appointment')}
        </div>
        <div style={{ color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {appt.type || 'Appointment'} · {fmtTime(appt.time)}
        </div>
      </div>
    </div>
  )
}

// ─── Availability helpers ─────────────────────────────────────────────────────

// Returns true if the staff member has a blockout on the given dateStr
function hasBlockout(blockouts, staffId, dateStr) {
  if (!staffId || !blockouts || !blockouts.length) return false
  return blockouts.some(b => b.user_id === staffId && b.start_date <= dateStr && b.end_date >= dateStr)
}

// Returns false if the staff member is marked unavailable for that day-of-week
function isScheduledDay(availability, staffId, dayOfWeek) {
  if (!staffId || !availability || !availability.length) return true // default: assume available
  const row = availability.find(a => a.staff_id === staffId && a.day_of_week === dayOfWeek)
  if (!row) return true // no schedule set — assume available
  return row.available !== false
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ days, apptsByDate, staffMap, selectedStaff, onChipClick, availability, blockouts }) {
  const todayStr = toDateStr(new Date())

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(7, 1fr)`,
      gap: 1, background: C.border, border: `1px solid ${C.border}`,
      borderRadius: 10, overflow: 'hidden', flex: 1,
    }}>
      {days.map((day) => {
        const dateStr = toDateStr(day)
        const isToday = dateStr === todayStr
        const raw = apptsByDate[dateStr] || []
        const filtered = selectedStaff
          ? raw.filter(a => a.staff_id === selectedStaff)
          : raw

        // Availability overlays (only when a specific staff is selected)
        const isBlockedOut = selectedStaff ? hasBlockout(blockouts, selectedStaff, dateStr) : false
        // day.getDay() gives 0=Sun..6=Sat matching our DB convention
        const isOffDay = selectedStaff ? !isScheduledDay(availability, selectedStaff, day.getDay()) : false

        return (
          <div
            key={dateStr}
            style={{
              background: isBlockedOut
                ? 'repeating-linear-gradient(45deg, #FEF3C7, #FEF3C7 4px, #FFFBEB 4px, #FFFBEB 10px)'
                : isOffDay
                  ? '#F5F5F5'
                  : isToday ? '#FDF0F2' : C.white,
              display: 'flex', flexDirection: 'column',
              minHeight: 120, padding: '8px 7px',
              position: 'relative',
            }}
          >
            {/* Day header */}
            <div style={{
              fontSize: 11, fontWeight: isToday ? 700 : 500,
              color: isToday ? C.rosaText : C.gray,
              marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span>{DAY_LABELS[(days.indexOf(day))]}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: isToday ? 20 : undefined, height: isToday ? 20 : undefined,
                borderRadius: isToday ? '50%' : undefined,
                background: isToday ? C.rosa : undefined,
                color: isToday ? C.white : C.ink,
                fontWeight: 600, fontSize: 12,
              }}>{day.getDate()}</span>
            </div>

            {/* Availability badges */}
            {isBlockedOut && (
              <div style={{ fontSize: 10, color: C.warningText, fontWeight: 600, marginBottom: 4, background: C.amberBg, borderRadius: 4, padding: '1px 5px', display: 'inline-block' }}>
                Time off
              </div>
            )}
            {!isBlockedOut && isOffDay && (
              <div style={{ fontSize: 10, color: C.gray, fontWeight: 500, marginBottom: 4, background: C.grayBg, borderRadius: 4, padding: '1px 5px', display: 'inline-block' }}>
                Day off
              </div>
            )}

            {/* Chips */}
            <div style={{ flex: 1, overflow: 'hidden', marginTop: 4 }}>
              {filtered.length === 0 && !isBlockedOut && !isOffDay && (
                <div style={{ fontSize: 11, color: C.border, textAlign: 'center', marginTop: 16 }}>—</div>
              )}
              {filtered.map(appt => (
                <ApptChip
                  key={appt.id}
                  appt={appt}
                  staffMap={staffMap}
                  compact={false}
                  onClick={onChipClick}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ cells, anchor, apptsByDate, staffMap, selectedStaff, onChipClick, availability, blockouts }) {
  const todayStr = toDateStr(new Date())
  const currentMonth = anchor.getMonth()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Day-of-week header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        marginBottom: 2,
      }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 600,
            color: C.gray, padding: '6px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 1, background: C.border,
        border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', flex: 1,
      }}>
        {cells.map((day) => {
          const dateStr = toDateStr(day)
          const isToday = dateStr === todayStr
          const inMonth = day.getMonth() === currentMonth
          const raw = apptsByDate[dateStr] || []
          const filtered = selectedStaff
            ? raw.filter(a => a.staff_id === selectedStaff)
            : raw
          const shown = filtered.slice(0, 3)
          const overflow = filtered.length - shown.length

          // Availability overlays (only when a specific staff is selected)
          const isBlockedOut = selectedStaff ? hasBlockout(blockouts, selectedStaff, dateStr) : false
          const isOffDay = selectedStaff ? !isScheduledDay(availability, selectedStaff, day.getDay()) : false

          return (
            <div
              key={dateStr}
              style={{
                background: isBlockedOut
                  ? 'repeating-linear-gradient(45deg, #FEF3C7, #FEF3C7 4px, #FFFBEB 4px, #FFFBEB 10px)'
                  : isOffDay
                    ? '#F5F5F5'
                    : isToday ? '#FDF0F2' : C.white,
                minHeight: 90, padding: '6px 5px',
                opacity: inMonth ? 1 : 0.4,
              }}
            >
              <div style={{
                fontSize: 11, fontWeight: isToday ? 700 : 400,
                marginBottom: 2,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: isToday ? 20 : undefined, height: isToday ? 20 : undefined,
                borderRadius: isToday ? '50%' : undefined,
                background: isToday ? C.rosa : undefined,
                color: isToday ? C.white : inMonth ? C.ink : C.gray,
              }}>{day.getDate()}</div>

              {isBlockedOut && (
                <div style={{ fontSize: 9, color: C.warningText, fontWeight: 600, background: C.amberBg, borderRadius: 3, padding: '1px 4px', display: 'block', marginBottom: 2 }}>
                  Time off
                </div>
              )}
              {!isBlockedOut && isOffDay && (
                <div style={{ fontSize: 9, color: C.gray, fontWeight: 500, background: C.border, borderRadius: 3, padding: '1px 4px', display: 'block', marginBottom: 2 }}>
                  Day off
                </div>
              )}

              {shown.map(appt => (
                <ApptChip
                  key={appt.id}
                  appt={appt}
                  staffMap={staffMap}
                  compact={true}
                  onClick={onChipClick}
                />
              ))}
              {overflow > 0 && (
                <div style={{ fontSize: 10, color: C.rosaText, fontWeight: 600, paddingLeft: 2 }}>
                  +{overflow} more
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Staff Filter Pills ───────────────────────────────────────────────────────

function StaffPills({ staff, staffColors, selectedStaff, setSelectedStaff, apptsByStaff }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* All */}
      <button
        onClick={() => setSelectedStaff(null)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20,
          border: `1.5px solid ${selectedStaff === null ? C.rosa : C.border}`,
          background: selectedStaff === null ? C.rosa : C.white,
          color: selectedStaff === null ? C.white : C.ink,
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
          transition: 'all 0.12s',
        }}
      >
        All staff
        <span style={{
          background: selectedStaff === null ? 'rgba(255,255,255,0.3)' : C.grayBg,
          color: selectedStaff === null ? C.white : C.gray,
          borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 600,
        }}>
          {Object.values(apptsByStaff).reduce((s, a) => s + a, 0)}
        </span>
      </button>

      {staff.map((member, idx) => {
        const color = staffColors[member.user_id] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
        const isActive = selectedStaff === member.user_id
        const count = apptsByStaff[member.user_id] || 0
        return (
          <button
            key={member.user_id}
            onClick={() => setSelectedStaff(isActive ? null : member.user_id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20,
              border: `1.5px solid ${isActive ? color : C.border}`,
              background: isActive ? color : C.white,
              color: isActive ? C.white : C.ink,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isActive ? 'rgba(255,255,255,0.8)' : color,
              flexShrink: 0,
            }} />
            {member.name || member.initials || 'Staff'}
            <span style={{
              background: isActive ? 'rgba(255,255,255,0.25)' : lighten(color, 0.75),
              color: isActive ? C.white : color,
              borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 600,
            }}>
              {count}
            </span>
          </button>
        )
      })}

      {/* Unassigned */}
      {(apptsByStaff['unassigned'] || 0) > 0 && (
        <button
          onClick={() => setSelectedStaff(selectedStaff === 'unassigned' ? null : 'unassigned')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20,
            border: `1.5px solid ${selectedStaff === 'unassigned' ? C.gray : C.border}`,
            background: selectedStaff === 'unassigned' ? C.gray : C.white,
            color: selectedStaff === 'unassigned' ? C.white : C.ink,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.gray, flexShrink: 0 }} />
          Unassigned
          <span style={{
            background: selectedStaff === 'unassigned' ? 'rgba(255,255,255,0.25)' : C.grayBg,
            color: selectedStaff === 'unassigned' ? C.white : C.gray,
            borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 600,
          }}>
            {apptsByStaff['unassigned']}
          </span>
        </button>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StaffCalendar({ hideTopbar }) {
  const { boutique } = useAuth()

  const [view, setView] = useState('week')
  const [anchor, setAnchor] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [appointments, setAppointments] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [popover, setPopover] = useState(null) // appt object

  // Staff availability + blockouts (pass selectedStaff to filter when set)
  const { availability, blockouts } = useStaffAvailability(selectedStaff || undefined)

  // Derived grid cells
  const weekDays = useMemo(() => buildWeekDays(anchor), [anchor])
  const monthCells = useMemo(() => buildMonthGrid(anchor), [anchor])

  // Date range for fetching
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === 'week') {
      return { rangeStart: toDateStr(weekDays[0]), rangeEnd: toDateStr(weekDays[6]) }
    }
    const cells = monthCells
    return { rangeStart: toDateStr(cells[0]), rangeEnd: toDateStr(cells[cells.length - 1]) }
  }, [view, weekDays, monthCells])

  // Fetch staff
  useEffect(() => {
    if (!boutique?.id) return
    supabase
      .from('boutique_members')
      .select('user_id, name, initials, color, role')
      .eq('boutique_id', boutique.id)
      .then(({ data }) => {
        if (data) setStaff(data)
      })
  }, [boutique?.id])

  // Fetch appointments for date range
  useEffect(() => {
    if (!boutique?.id || !rangeStart || !rangeEnd) return
    setLoading(true)
    supabase
      .from('appointments')
      .select('id, event_id, type, date, time, note, staff_id, status, client_name, event:events(id, type, client:clients(id, name))')
      .eq('boutique_id', boutique.id)
      .gte('date', rangeStart)
      .lte('date', rangeEnd)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .then(({ data }) => {
        setAppointments(data || [])
        setLoading(false)
      })
  }, [boutique?.id, rangeStart, rangeEnd])

  // Build staffMap: user_id → member
  const staffMap = useMemo(() => {
    const m = {}
    staff.forEach(s => { m[s.user_id] = s })
    return m
  }, [staff])

  // Build staffColors: user_id → hex color
  const staffColors = useMemo(() => {
    const m = {}
    staff.forEach((s, idx) => { m[s.user_id] = staffColor(s, idx) })
    return m
  }, [staff])

  // Group appointments by date
  const apptsByDate = useMemo(() => {
    const m = {}
    appointments.forEach(a => {
      const key = a.date
      if (!m[key]) m[key] = []
      m[key].push(a)
    })
    return m
  }, [appointments])

  // Count per staff for the current visible range
  const apptsByStaff = useMemo(() => {
    const m = {}
    appointments.forEach(a => {
      const key = a.staff_id || 'unassigned'
      m[key] = (m[key] || 0) + 1
    })
    return m
  }, [appointments])

  // Navigation
  function prevPeriod() {
    setAnchor(prev => {
      const d = new Date(prev)
      if (view === 'week') d.setDate(d.getDate() - 7)
      else d.setMonth(d.getMonth() - 1)
      return d
    })
  }

  function nextPeriod() {
    setAnchor(prev => {
      const d = new Date(prev)
      if (view === 'week') d.setDate(d.getDate() + 7)
      else d.setMonth(d.getMonth() + 1)
      return d
    })
  }

  function goToday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setAnchor(d)
  }

  // Header label
  const headerLabel = view === 'week'
    ? formatWeekRange(weekDays)
    : `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`

  const totalVisible = appointments.filter(a =>
    selectedStaff ? a.staff_id === selectedStaff : true
  ).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!hideTopbar && <Topbar
        title="Staff Calendar"
        subtitle={loading ? 'Loading…' : `${totalVisible} appointment${totalVisible !== 1 ? 's' : ''}`}
      />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 20px', gap: 14 }}>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={prevPeriod} style={navBtnSt}>‹</button>
            <button onClick={goToday} style={todayBtnSt}>Today</button>
            <button onClick={nextPeriod} style={navBtnSt}>›</button>
          </div>

          {/* Period label */}
          <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, minWidth: 160 }}>
            {headerLabel}
          </span>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* View toggle */}
          <div style={{
            display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8,
            overflow: 'hidden', background: C.white,
          }}>
            {['week', 'month'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer',
                  background: view === v ? C.rosa : 'transparent',
                  color: view === v ? C.white : C.ink,
                  fontSize: 12, fontWeight: 500,
                  transition: 'all 0.12s',
                }}
              >
                {v === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Staff filter pills */}
        <StaffPills
          staff={staff}
          staffColors={staffColors}
          selectedStaff={selectedStaff}
          setSelectedStaff={setSelectedStaff}
          apptsByStaff={apptsByStaff}
        />

        {/* Calendar grid */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>
            Loading appointments…
          </div>
        ) : totalVisible === 0 && !loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.gray }}>
            <span style={{ fontSize: 36 }}>🗓️</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>
              No appointments this {view}
            </span>
            <span style={{ fontSize: 12 }}>
              {selectedStaff ? 'Try selecting a different staff member or period.' : 'Nothing scheduled for this period.'}
            </span>
          </div>
        ) : view === 'week' ? (
          <WeekView
            days={weekDays}
            apptsByDate={apptsByDate}
            staffMap={staffMap}
            selectedStaff={selectedStaff}
            onChipClick={setPopover}
            availability={availability}
            blockouts={blockouts}
          />
        ) : (
          <MonthView
            cells={monthCells}
            anchor={anchor}
            apptsByDate={apptsByDate}
            staffMap={staffMap}
            selectedStaff={selectedStaff}
            onChipClick={setPopover}
            availability={availability}
            blockouts={blockouts}
          />
        )}
      </div>

      {/* Popover overlay */}
      {popover && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 499,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ApptPopover
            appt={popover}
            staffMap={staffMap}
            onClose={() => setPopover(null)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Shared button styles ─────────────────────────────────────────────────────

const navBtnSt = {
  width: 30, height: 30, border: `1px solid ${C.border}`,
  borderRadius: 7, background: C.white, color: C.ink,
  fontSize: 16, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  fontWeight: 500, lineHeight: 1,
}

const todayBtnSt = {
  padding: '5px 12px', border: `1px solid ${C.border}`,
  borderRadius: 7, background: C.white, color: C.ink,
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
}
