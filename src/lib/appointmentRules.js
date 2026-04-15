// ─── APPOINTMENT SCHEDULING RULES ────────────────────────────────────────────
// Based on the boutique's Square Appointments workflow

export const APPOINTMENT_TYPES = {
  consultation: {
    label: 'Dress Rental Consultation',
    labelEs: 'Consulta de alquiler de vestidos',
    allowedDays: [2, 4, 6],  // 0=Sun, 2=Tue, 4=Thu, 6=Sat
    allowedDaysLabel: 'Tuesdays, Thursdays & Saturdays',
    allowedDaysLabelEs: 'Martes, jueves y sábados',
    duration: 60,
    color: '#A84D5E',  // rosaSolid — WCAG AA with white text
    bgColor: '#FDF5F6',
    icon: '👗',
  },
  fitting: {
    label: 'Dress Rental Fitting',
    labelEs: 'Prueba de vestido de alquiler',
    rule: 'monday_of_event_week',
    ruleLabel: 'Monday of the event week',
    ruleLabelEs: 'El lunes de la semana del evento',
    duration: 45,
    color: '#6B46B0',
    bgColor: '#F5F3FF',
    icon: '✂️',
  },
  pickup: {
    label: 'Dress Rental Pickup',
    labelEs: 'Recogida de vestido de alquiler',
    rule: 'thu_or_fri_of_event_week',
    ruleLabel: 'Thursday or Friday of the event week',
    ruleLabelEs: 'El jueves o viernes de la semana del evento',
    duration: 30,
    color: '#0B8562',
    bgColor: '#F0FDF4',
    icon: '📦',
  },
  return: {
    label: 'Dress Rental Return',
    labelEs: 'Devolución de vestido de alquiler',
    rule: 'monday_after_event_4pm',
    ruleLabel: 'Monday after the event at 4:00 PM',
    ruleLabelEs: 'El lunes después del evento a las 4:00 PM',
    defaultTime: '16:00',
    duration: 15,
    color: '#C87810',
    bgColor: '#FFFBEB',
    icon: '🔄',
  },
}

/**
 * Given an event date string (YYYY-MM-DD) and appointment type,
 * returns the suggested Date object for that appointment.
 * Returns null for 'consultation' (no fixed rule — user picks Tue/Thu/Sat).
 */
export function getSuggestedDate(eventDate, type) {
  if (!eventDate) return null
  const event = new Date(eventDate + 'T12:00:00')
  const dayOfWeek = event.getDay() // 0=Sun

  switch (type) {
    case 'fitting': {
      // Monday of event week
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(event)
      monday.setDate(event.getDate() + daysToMonday)
      return monday
    }
    case 'pickup': {
      // Thursday of event week (fallback to Friday if needed)
      const daysToThursday = dayOfWeek <= 4
        ? 4 - dayOfWeek
        : 4 + (7 - dayOfWeek)
      const thursday = new Date(event)
      thursday.setDate(event.getDate() + daysToThursday)
      return thursday
    }
    case 'return': {
      // Monday after the event at 4pm
      const daysUntilNextMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7
      const monday = new Date(event)
      monday.setDate(event.getDate() + daysUntilNextMonday)
      return monday
    }
    default:
      return null
  }
}

/**
 * Returns a YYYY-MM-DD string for a given Date, in local time.
 */
export function toDateStr(date) {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Validates that a consultation is on Tue (2), Thu (4), or Sat (6).
 */
export function isValidConsultationDay(dateStr) {
  if (!dateStr) return true // not yet picked — no error yet
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return [2, 4, 6].includes(day)
}

/**
 * Returns a human-readable formatted date string.
 * e.g. "Tuesday, June 3 at 4:00 PM"
 */
export function formatApptDateTime(dateStr, timeStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  const datePart = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  if (!timeStr) return datePart
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${datePart} at ${hour}:${String(m).padStart(2, '0')} ${ampm}`
}
