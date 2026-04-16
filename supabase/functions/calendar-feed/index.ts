/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── iCal helpers ─────────────────────────────────────────────────────────────

/** Escape iCal text values (commas, semicolons, backslashes, newlines) */
function escapeIcal(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/** Format a YYYY-MM-DD string as iCal all-day DATE: YYYYMMDD */
function toIcalDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

/** Format a YYYY-MM-DD + HH:MM:SS time as iCal UTC datetime: YYYYMMDDTHHmmssZ
 *  Treats the stored time as local-naive and emits as-is with Z suffix
 *  (boutique times are not timezone-aware in the DB schema).
 */
function toIcalDateTime(dateStr: string, timeStr: string): string {
  const date = toIcalDate(dateStr)
  const time = timeStr.replace(/:/g, '').slice(0, 6).padEnd(6, '0')
  return `${date}T${time}Z`
}

/** Add one hour to a HH:MM:SS time string, returning HH:MM:SS */
function addOneHour(timeStr: string): string {
  const [h, m, s] = timeStr.split(':').map(Number)
  const totalMinutes = h * 60 + m + 60
  const newH = Math.floor(totalMinutes / 60) % 24
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(s || 0).padStart(2, '0')}`
}

/** Fold long iCal lines at 75 octets as per RFC 5545 */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const result: string[] = []
  let pos = 0
  let first = true
  while (pos < line.length) {
    const chunk = first ? line.slice(pos, pos + 75) : line.slice(pos, pos + 74)
    result.push(first ? chunk : ' ' + chunk)
    pos += first ? 75 : 74
    first = false
  }
  return result.join('\r\n')
}

/** Build a VEVENT block from a key/value map, with optional extra lines (e.g. VALARM) */
function buildVEvent(fields: Record<string, string>, extraLines: string[] = []): string {
  const lines = ['BEGIN:VEVENT']
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      lines.push(foldLine(`${key}:${value}`))
    }
  }
  for (const extra of extraLines) {
    lines.push(extra)
  }
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

/** Build a VALARM block for a 1-hour-before display reminder */
function buildAlarm(boutiqueName: string): string[] {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    foldLine(`DESCRIPTION:Upcoming appointment at ${escapeIcal(boutiqueName)}`),
    'TRIGGER:-PT1H',
    'END:VALARM',
  ]
}

// ─── Event type → category mapping ───────────────────────────────────────────

const EVT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Wedding',
  quince: 'Quinceañera',
  prom: 'Prom',
  baptism: 'Baptism',
  communion: 'Communion',
  graduation: 'Graduation',
  corporate: 'Corporate',
  other: 'Event',
}

/** Map event type to an iCal CATEGORIES value for calendar color-coding */
const EVT_TYPE_CATEGORIES: Record<string, string> = {
  wedding:    'Wedding',
  quince:     'Quinceañera',
  prom:       'Prom',
  baptism:    'Baptism',
  communion:  'Communion',
  graduation: 'Graduation',
  corporate:  'Corporate',
  other:      'Event',
}

const APPT_TYPE_LABELS: Record<string, string> = {
  fitting:          'Fitting',
  consultation:     'Consultation',
  pickup:           'Pickup',
  return:           'Return',
  alteration_check: 'Alteration Check',
  final_fitting:    'Final Fitting',
  other:            'Appointment',
}

/** Map appointment type to CATEGORIES */
const APPT_TYPE_CATEGORIES: Record<string, string> = {
  fitting:          'Fitting',
  consultation:     'Consultation',
  pickup:           'Pickup',
  return:           'Dress Return',
  alteration_check: 'Alteration',
  final_fitting:    'Final Fitting',
  other:            'Appointment',
}

// ─── Service label helper ─────────────────────────────────────────────────────

const SVC_LABELS: Record<string, string> = {
  wedding_gown:   'Wedding gown',
  bridesmaid:     'Bridesmaids',
  alterations:    'Alterations',
  florals:        'Florals',
  photography:    'Photography',
  videography:    'Videography',
  venue:          'Venue',
  catering:       'Catering',
  hair_makeup:    'Hair & makeup',
  dj:             'DJ / music',
  transportation: 'Transportation',
  quince_gown:    'Quinceañera gown',
  invitations:    'Invitations',
  cake:           'Cake',
  other:          'Other',
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const url = new URL(req.url)

  // ── Service-role client (used only after auth is verified) ───────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  // ── Auth: accept either a JWT Bearer token OR an opaque calendar_feed_token ──
  // Option 1: opaque per-boutique token (for calendar app subscriptions)
  const feedToken = url.searchParams.get('token')
  // Option 2: JWT Bearer (for in-app usage)
  const authHeader = req.headers.get('Authorization')

  let boutiqueId: string | null = null

  if (feedToken) {
    // Resolve boutique from opaque token stored in boutiques.calendar_feed_token
    const { data: bRow, error: bErr } = await supabase
      .from('boutiques')
      .select('id')
      .eq('calendar_feed_token', feedToken)
      .single()
    if (bErr || !bRow) {
      return new Response('Invalid or expired calendar token', { status: 401, headers: corsHeaders })
    }
    boutiqueId = bRow.id
  } else if (authHeader?.startsWith('Bearer ')) {
    // Verify JWT and resolve boutique from membership
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { auth: { persistSession: false } }
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }
    // Get boutique_id from URL param — must match user's membership
    const paramBoutiqueId = url.searchParams.get('boutique_id')
    if (!paramBoutiqueId) {
      return new Response('Missing boutique_id parameter', { status: 400, headers: corsHeaders })
    }
    const { data: member } = await supabase
      .from('boutique_members')
      .select('boutique_id')
      .eq('user_id', user.id)
      .eq('boutique_id', paramBoutiqueId)
      .single()
    if (!member) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }
    boutiqueId = paramBoutiqueId
  } else {
    return new Response('Authentication required. Provide a Bearer token or a calendar feed token (?token=...)', {
      status: 401,
      headers: corsHeaders,
    })
  }

  // ── Fetch boutique (including feed tracking columns) ─────────────────────────
  const { data: boutique, error: boutiqueErr } = await supabase
    .from('boutiques')
    .select('id, name, calendar_feed_accessed_at, calendar_feed_access_count')
    .eq('id', boutiqueId)
    .single()

  if (boutiqueErr || !boutique) {
    return new Response('Boutique not found', { status: 404, headers: corsHeaders })
  }

  // ── Fire-and-forget: increment access tracking ───────────────────────────────
  supabase.from('boutiques').update({
    calendar_feed_accessed_at: new Date().toISOString(),
    calendar_feed_access_count: (boutique.calendar_feed_access_count || 0) + 1,
  }).eq('id', boutiqueId).then(() => {})

  // ── Fetch events with payment info ───────────────────────────────────────────
  const { data: events } = await supabase
    .from('events')
    .select('id, client_id, type, event_date, venue, guests, status, total, paid')
    .eq('boutique_id', boutiqueId)
    .not('event_date', 'is', null)

  // ── Fetch event services ─────────────────────────────────────────────────────
  const eventIds = (events || []).map((e: { id: string }) => e.id)
  let eventServicesMap: Record<string, string[]> = {}
  if (eventIds.length > 0) {
    const { data: svcRows } = await supabase
      .from('event_services')
      .select('event_id, service_type')
      .in('event_id', eventIds)
    for (const row of svcRows || []) {
      if (!eventServicesMap[row.event_id]) eventServicesMap[row.event_id] = []
      eventServicesMap[row.event_id].push(row.service_type)
    }
  }

  // ── Fetch clients for name lookup (include birthday) ────────────────────────
  const clientIds = [...new Set((events || []).map((e: { client_id: string }) => e.client_id).filter(Boolean))]
  let clientMap: Record<string, { name: string; birthday?: string }> = {}
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, birthday')
      .in('id', clientIds)
    for (const c of clients || []) {
      clientMap[c.id] = { name: c.name, birthday: c.birthday || undefined }
    }
  }

  // ── Fetch appointments ───────────────────────────────────────────────────────
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, event_id, type, date, time, note, status')
    .eq('boutique_id', boutiqueId)
    .not('date', 'is', null)

  // Build a quick event→client lookup for appointment summaries
  const eventClientMap: Record<string, string> = {}
  for (const ev of events || []) {
    if (ev.client_id && clientMap[ev.client_id]) {
      eventClientMap[ev.id] = clientMap[ev.client_id].name
    }
  }

  // ── Build iCal ───────────────────────────────────────────────────────────────
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const boutiqueName = boutique.name || 'Belori'
  const boutiqueNameEsc = escapeIcal(boutiqueName)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Belori//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Belori - ${boutiqueNameEsc}`,
    'X-WR-CALDESC:Events and appointments from Belori',
    'X-WR-TIMEZONE:UTC',
  ]

  // ── VEVENT per boutique event ────────────────────────────────────────────────
  for (const ev of events || []) {
    const client = ev.client_id ? clientMap[ev.client_id] : null
    const clientName = client?.name || 'Client'
    const evTypeLabel = EVT_TYPE_LABELS[ev.type] || 'Event'
    const summary = escapeIcal(`${clientName} ${evTypeLabel}`)
    const dtDate = toIcalDate(ev.event_date)
    // All-day event: DTEND is the next day per iCal spec
    const dtEnd = toIcalDate(
      new Date(new Date(ev.event_date).getTime() + 86400000).toISOString().split('T')[0]
    )

    // Rich description
    const descParts: string[] = [`Client: ${clientName}`]
    if (ev.venue) descParts.push(`Venue: ${ev.venue}`)
    if (ev.guests) descParts.push(`Guests: ${ev.guests}`)
    const svcs = eventServicesMap[ev.id] || []
    if (svcs.length > 0) {
      const svcLabels = svcs.map((s: string) => SVC_LABELS[s] || s).join(', ')
      descParts.push(`Services: ${svcLabels}`)
    }
    if (ev.total != null && ev.paid != null) {
      descParts.push(`Paid: $${Number(ev.paid).toLocaleString()} of $${Number(ev.total).toLocaleString()}`)
    } else if (ev.status) {
      descParts.push(`Status: ${ev.status}`)
    }
    const description = escapeIcal(descParts.join('\n'))

    const category = EVT_TYPE_CATEGORIES[ev.type] || 'Event'

    lines.push(buildVEvent({
      UID: `event-${ev.id}@belori.app`,
      DTSTAMP: now,
      'DTSTART;VALUE=DATE': dtDate,
      'DTEND;VALUE=DATE': dtEnd,
      SUMMARY: summary,
      CATEGORIES: category,
      ...(ev.venue ? { LOCATION: escapeIcal(ev.venue) } : {}),
      ...(description ? { DESCRIPTION: description } : {}),
    }))
  }

  // ── VEVENT per appointment ───────────────────────────────────────────────────
  for (const appt of appointments || []) {
    const apptTypeLabel = APPT_TYPE_LABELS[appt.type] || 'Appointment'
    const clientHint = appt.event_id ? (eventClientMap[appt.event_id] || '') : ''
    const summary = escapeIcal(clientHint ? `${apptTypeLabel} — ${clientHint}` : apptTypeLabel)
    const category = APPT_TYPE_CATEGORIES[appt.type] || 'Appointment'
    const alarm = buildAlarm(boutiqueName)

    if (appt.time) {
      const dtStart = toIcalDateTime(appt.date, appt.time)
      const dtEnd = toIcalDateTime(appt.date, addOneHour(appt.time))
      lines.push(buildVEvent({
        UID: `appt-${appt.id}@belori.app`,
        DTSTAMP: now,
        DTSTART: dtStart,
        DTEND: dtEnd,
        SUMMARY: summary,
        CATEGORIES: category,
        ...(appt.note ? { DESCRIPTION: escapeIcal(appt.note) } : {}),
      }, alarm))
    } else {
      // No time — treat as all-day (no alarm for all-day)
      const dtDate = toIcalDate(appt.date)
      const dtEndDate = toIcalDate(
        new Date(new Date(appt.date).getTime() + 86400000).toISOString().split('T')[0]
      )
      lines.push(buildVEvent({
        UID: `appt-${appt.id}@belori.app`,
        DTSTAMP: now,
        'DTSTART;VALUE=DATE': dtDate,
        'DTEND;VALUE=DATE': dtEndDate,
        SUMMARY: summary,
        CATEGORIES: category,
        ...(appt.note ? { DESCRIPTION: escapeIcal(appt.note) } : {}),
      }))
    }
  }

  // ── Birthday VEVENTs (yearly recurring) ──────────────────────────────────────
  for (const [clientId, client] of Object.entries(clientMap)) {
    if (!client.birthday) continue
    // birthday stored as YYYY-MM-DD
    const bMatch = client.birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!bMatch) continue
    const [, , mm, dd] = bMatch
    // Use a fixed base year that is well-formed; Google Calendar handles RRULE=FREQ=YEARLY
    const dtBday = `${mm}${dd}`
    // We need a real year — use the stored year from the birthday field
    const birthYear = bMatch[1]
    const dtStart = `${birthYear}${mm}${dd}`
    // DTEND = next day
    const nextDay = new Date(`${birthYear}-${mm}-${dd}`)
    nextDay.setDate(nextDay.getDate() + 1)
    const dtEnd = toIcalDate(nextDay.toISOString().split('T')[0])

    lines.push(buildVEvent({
      UID: `bday-${clientId}@belori.app`,
      DTSTAMP: now,
      'DTSTART;VALUE=DATE': dtStart,
      'DTEND;VALUE=DATE': dtEnd,
      SUMMARY: escapeIcal(`${client.name} Birthday`),
      CATEGORIES: 'Birthday',
      'RRULE': 'FREQ=YEARLY',
    }))
  }

  lines.push('END:VCALENDAR')

  const icsBody = lines.join('\r\n') + '\r\n'

  return new Response(icsBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="belori-calendar.ics"',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
})
