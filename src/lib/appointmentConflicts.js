// Appointment double-book detection.
//
// Two kinds of conflicts:
//   1. STAFF — same staff member already booked at this date+time
//   2. CLIENT — same client already booked at this date+time
//
// Returns an array of conflict objects. Empty array means no conflict.
// Caller decides whether to block the save or show a warning + override.

import { supabase } from './supabase'

/**
 * Find appointment conflicts for a proposed booking.
 *
 * @param {object} args
 * @param {string} args.boutiqueId - scope (RLS also enforces this)
 * @param {string} args.date - YYYY-MM-DD
 * @param {string} args.time - HH:MM (24-hour). null/empty → no conflict possible
 * @param {string|null} args.staffId - optional, check staff conflict
 * @param {string|null} args.clientId - optional, check client conflict
 * @param {string|null} args.excludeId - exclude this appointment from results (when editing)
 * @returns {Promise<Array<{id, kind: 'staff'|'client', type, time, staff_id, client_id, client_name, event}>>}
 */
export async function findAppointmentConflicts({
  boutiqueId,
  date,
  time,
  staffId = null,
  clientId = null,
  excludeId = null,
}) {
  if (!boutiqueId || !date || !time) return []
  if (!staffId && !clientId) return []   // nothing to check

  const conflicts = []

  // ── Staff conflict ──
  if (staffId) {
    let q = supabase
      .from('appointments')
      .select('id, type, date, time, staff_id, client_id, client_name, event:events(client:clients(name))')
      .eq('boutique_id', boutiqueId)
      .eq('date', date)
      .eq('time', time)
      .eq('staff_id', staffId)
      .neq('status', 'cancelled')
    if (excludeId) q = q.neq('id', excludeId)
    const { data, error } = await q
    if (!error && data) {
      for (const row of data) conflicts.push({ ...row, kind: 'staff' })
    }
  }

  // ── Client conflict ──
  if (clientId) {
    let q = supabase
      .from('appointments')
      .select('id, type, date, time, staff_id, client_id, client_name, event:events(client:clients(name))')
      .eq('boutique_id', boutiqueId)
      .eq('date', date)
      .eq('time', time)
      .eq('client_id', clientId)
      .neq('status', 'cancelled')
    if (excludeId) q = q.neq('id', excludeId)
    const { data, error } = await q
    if (!error && data) {
      for (const row of data) {
        // Skip duplicate if it's the same appointment we already added under 'staff' kind
        if (!conflicts.some(c => c.id === row.id)) conflicts.push({ ...row, kind: 'client' })
      }
    }
  }

  return conflicts
}

/**
 * Pretty-format a conflict for display.
 * @param {{kind, type, time, client_name, event}} conflict
 * @param {Array<{id, name}>} staff - boutique staff list for staff name lookup
 */
export function formatConflict(conflict, staff = []) {
  const time = conflict.time ? formatTimeShort(conflict.time) : '?'
  const apptType = (conflict.type || 'appointment').replace(/_/g, ' ')
  const personLabel = conflict.kind === 'staff'
    ? (staff.find(s => s.id === conflict.staff_id)?.name || 'a staff member')
    : (conflict.client_name || conflict.event?.client?.name || 'this client')
  const otherParty = conflict.kind === 'staff'
    ? (conflict.client_name || conflict.event?.client?.name || 'someone')
    : null
  return otherParty
    ? `${personLabel} is already booked at ${time} with ${otherParty} (${apptType})`
    : `${personLabel} is already booked at ${time} (${apptType})`
}

function formatTimeShort(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
