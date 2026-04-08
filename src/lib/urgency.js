// ─── PRD §6.1 Urgency Engine ───────────────────────────────────────────────
export function getUrgency(event) {
  const { daysUntil, overdue, missingAppointments = [] } = event
  const hasCriticalIssue = overdue > 0 || missingAppointments.length > 0
  if (daysUntil <= 7 && hasCriticalIssue) return 'critical'
  if (daysUntil <= 14) return 'near'
  return 'normal'
}

// ─── PRD §6.2 Countdown Badge ─────────────────────────────────────────────
export function getCountdownConfig(days) {
  if (days < 0)  return { text: 'Past',        bg: '#F3F4F6',            color: '#6B7280',             pulse: false }
  if (days === 0) return { text: 'Today!',      bg: 'var(--bg-danger)',   color: 'var(--color-danger)', pulse: true  }
  if (days <= 6)  return { text: `in ${days}d`, bg: 'var(--bg-danger)',   color: 'var(--color-danger)', pulse: false }
  if (days <= 13) return { text: `in ${days}d`, bg: 'var(--bg-warning)',  color: 'var(--color-warning)',pulse: false }
  if (days <= 30) return { text: `in ${days}d`, bg: 'var(--bg-warning)',  color: 'var(--color-warning)',pulse: false }
  return           { text: `in ${days}d`,       bg: '#F3F4F6',            color: '#6B7280',             pulse: false }
}

// ─── PRD §6.9 Alert Banner Priority ──────────────────────────────────────
export function getPriorityAlert(events) {
  if (!events?.length) return null

  // Priority 1: event ≤ 3 days + CRITICAL
  const p1 = events.find(e => e.daysUntil <= 3 && getUrgency(e) === 'critical')
  if (p1) return { event: p1, priority: 1 }

  // Priority 2: event ≤ 7 days + CRITICAL
  const p2 = events.find(e => e.daysUntil <= 7 && getUrgency(e) === 'critical')
  if (p2) return { event: p2, priority: 2 }

  // Priority 3: event ≤ 7 days + any overdue payment
  const p3 = events.find(e => e.daysUntil <= 7 && e.overdue > 0)
  if (p3) return { event: p3, priority: 3 }

  // Priority 4: event ≤ 14 days + missing required appointment
  const p4 = events.find(e => e.daysUntil <= 14 && e.missingAppointments?.length > 0)
  if (p4) return { event: p4, priority: 4 }

  return null
}

// ─── PRD §6.5 Missing Appointment Detection (client-side) ────────────────
const REQUIRED_APPOINTMENTS = {
  dress_rental:  [{ type: 'try_on', threshold: 999 }, { type: 'pickup', threshold: 2 }, { type: 'return', threshold: 999 }],
  alterations:   [{ type: 'measurement', threshold: 21 }, { type: 'final_fitting', threshold: 7 }],
  planning:      [{ type: 'consultation', threshold: 30 }, { type: 'venue_walkthrough', threshold: 999 }],
  decoration:    [{ type: 'venue_walkthrough', threshold: 999 }],
}

export function getMissingAppointments(event) {
  const { services = [], appointments = [], daysUntil } = event
  const missing = []

  for (const svc of services) {
    const required = REQUIRED_APPOINTMENTS[svc] || []
    for (const req of required) {
      if (daysUntil > req.threshold) continue
      const found = appointments.some(a =>
        a.type === req.type && !['missing', 'cancelled'].includes(a.status)
      )
      if (!found) missing.push({ service: svc, type: req.type })
    }
  }
  return missing
}

// ─── PRD §6.7 Dress Status State Machine ─────────────────────────────────
export const DRESS_TRANSITIONS = {
  available:  { label: 'Reserve for event',  next: 'reserved'  },
  reserved:   { label: 'Mark picked up',      next: 'picked_up' },
  picked_up:  { label: 'Log return',          next: 'returned'  },
  returned:   { label: 'Send to cleaning',    next: 'cleaning'  },
  cleaning:   { label: 'Mark cleaned',        next: 'available' },
  overdue:    { label: 'Log return',          next: 'returned'  },
}

// ─── PRD §6.8 Alteration Job State Machine ───────────────────────────────
export const ALTERATION_TRANSITIONS = {
  measurement_needed: { label: 'Start work',         next: 'in_progress'       },
  in_progress:        { label: 'Schedule fitting',   next: 'fitting_scheduled' },
  fitting_scheduled:  { label: 'Mark complete',      next: 'complete'          },
  complete:           { label: 'Done',               next: null                },
}

// ─── PRD §6.6 5-Star Review Gate ─────────────────────────────────────────
export function shouldSendPublicReview(client) {
  return client.last_rating == null || client.last_rating >= 4
}
