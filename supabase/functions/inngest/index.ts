/**
 * Belori — Automation runner (Supabase Edge Function)
 *
 * Called by pg_cron via pg_net on schedule.
 * Each automation type is triggered by: POST /functions/v1/inngest?type=xxx
 *
 * Required Supabase secrets:
 *   AUTOMATION_SECRET_KEY  — simple shared key to authenticate pg_net calls
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER  — SMS
 *   RESEND_API_KEY / RESEND_FROM_EMAIL  — email
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  — injected automatically
 */

import { supabaseAdmin } from '../_shared/supabase.ts'
import { sendSms, toE164 } from '../_shared/sms.ts'
import { sendEmail } from '../_shared/email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-automation-key',
}

/** Escape user-supplied values before embedding in HTML email bodies. */
function escHtml(s: unknown): string {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAutoEnabled(boutique: { automations?: Record<string, boolean> }, key: string): boolean {
  return boutique?.automations?.[key] !== false
}

/** Fire-and-forget push notification to all boutique subscribers. */
async function sendPush(boutique_id: string, title: string, body: string, url: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return
  await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ boutique_id, title, body, url }),
  }).catch((err) => console.warn('[inngest] push notification skipped:', err?.message))
}
function today(): string { return new Date().toISOString().split('T')[0] }
function offsetDate(days: number): string {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().split('T')[0]
}
function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtMoney(n: number): string {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

// ─── Per-boutique SMS rate limiter ───────────────────────────────────────────
const SMS_CAP = parseInt(Deno.env.get('MAX_SMS_PER_BOUTIQUE_PER_RUN') ?? '50')
const smsSentThisRun: Map<string, number> = new Map()

function smsAllowed(boutiqueId: string): boolean {
  const count = smsSentThisRun.get(boutiqueId) ?? 0
  return count < SMS_CAP
}

function recordSmsSent(boutiqueId: string): void {
  smsSentThisRun.set(boutiqueId, (smsSentThisRun.get(boutiqueId) ?? 0) + 1)
}

// ─── 1. 24-hour appointment reminder ─────────────────────────────────────────
async function runSms24h() {
  const tomorrow = offsetDate(1)
  const { data: boutiques } = await supabaseAdmin.from('boutiques').select('id, name, automations').limit(500)
  if (!boutiques) return

  for (const boutique of boutiques) {
    if (!isAutoEnabled(boutique, 'sms24h')) continue
    const { data: appts } = await supabaseAdmin
      .from('appointments')
      .select('*, event:events(client_id, client:clients(name, phone, comm_prefs))')
      .eq('boutique_id', boutique.id)
      .eq('date', tomorrow)
      .eq('status', 'scheduled')

    // Idempotency: collect client_ids already reminded today so we don't double-send
    const { data: todayReminders } = await supabaseAdmin
      .from('client_interactions')
      .select('client_id')
      .eq('boutique_id', boutique.id)
      .eq('type', 'reminder')
      .eq('title', '24h appointment reminder sent')
      .gte('occurred_at', today() + 'T00:00:00.000Z')
    const alreadyReminded24h = new Set((todayReminders ?? []).map(r => r.client_id))

    for (const appt of (appts ?? [])) {
      const clientId = appt.event?.client_id
      if (clientId && alreadyReminded24h.has(clientId)) continue
      const phone = appt.event?.client?.phone
      const name  = appt.event?.client?.name?.split(' ')[0] ?? 'there'
      const e164  = phone ? toE164(phone) : null
      if (!e164) continue
      const client = appt.event?.client as { name?: string; phone?: string; comm_prefs?: { sms_opt_out?: boolean } } | undefined
      if (client?.comm_prefs?.sms_opt_out === true) continue
      const msg = `Hi ${name}! Reminder from ${boutique.name}: you have a ${appt.type?.replace(/_/g,' ')} tomorrow (${fmtDate(tomorrow)}). See you soon! 💐\n\nReply STOP to opt out. Msg & data rates may apply.`
      if (smsAllowed(boutique.id)) {
        await sendSms(e164, msg)
        recordSmsSent(boutique.id)
      } else {
        console.warn(`[inngest] SMS cap reached for boutique ${boutique.id} in this run`)
      }
      if (clientId) {
        await supabaseAdmin.from('client_interactions').insert({
          boutique_id: boutique.id, client_id: clientId,
          type: 'reminder', title: '24h appointment reminder sent',
          body: `SMS reminder sent for ${appt.type?.replace(/_/g,' ')} on ${fmtDate(tomorrow)}`,
          occurred_at: new Date().toISOString(),
        })
        alreadyReminded24h.add(clientId) // prevent double-send within same run
      }
      // Push notification to boutique staff
      await sendPush(
        boutique.id,
        '📅 Appointment Tomorrow',
        `${appt.type?.replace(/_/g,' ')} with ${appt.event?.client?.name?.split(' ')[0] ?? 'client'} — ${fmtDate(tomorrow)}`,
        '/?screen=events'
      )
    }
  }
}

// ─── 2. 2-hour appointment reminder ──────────────────────────────────────────
async function runSms2h() {
  const todayDate = today()
  const now  = new Date()
  const lo   = new Date(now.getTime() + (115 * 60 * 1000))
  const hi   = new Date(now.getTime() + (125 * 60 * 1000))
  const loTime = lo.toTimeString().slice(0, 5)
  const hiTime = hi.toTimeString().slice(0, 5)
  const { data: boutiques } = await supabaseAdmin.from('boutiques').select('id, name, automations').limit(500)
  if (!boutiques) return

  for (const boutique of boutiques) {
    if (!isAutoEnabled(boutique, 'sms2h')) continue
    const { data: appts } = await supabaseAdmin
      .from('appointments')
      .select('*, event:events(client_id, client:clients(name, phone, comm_prefs))')
      .eq('boutique_id', boutique.id).eq('date', todayDate).eq('status', 'scheduled')
      .gte('time', loTime).lte('time', hiTime)

    // Idempotency: check if a 2h reminder was already sent within the past 90 minutes
    const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString()
    const { data: recentReminders2h } = await supabaseAdmin
      .from('client_interactions')
      .select('client_id')
      .eq('boutique_id', boutique.id)
      .eq('type', 'reminder')
      .eq('title', '2h appointment reminder sent')
      .gte('occurred_at', ninetyMinAgo)
    const alreadyReminded2h = new Set((recentReminders2h ?? []).map(r => r.client_id))

    for (const appt of (appts ?? [])) {
      const clientId = appt.event?.client_id
      if (clientId && alreadyReminded2h.has(clientId)) continue
      const phone = appt.event?.client?.phone
      const name  = appt.event?.client?.name?.split(' ')[0] ?? 'there'
      const e164  = phone ? toE164(phone) : null
      if (!e164) continue
      const client2h = appt.event?.client as { name?: string; phone?: string; comm_prefs?: { sms_opt_out?: boolean } } | undefined
      if (client2h?.comm_prefs?.sms_opt_out === true) continue
      const time = appt.time ? appt.time.slice(0, 5) : ''
      const msg  = `Hi ${name}! Just a reminder — your ${appt.type?.replace(/_/g,' ')} at ${boutique.name} is in about 2 hours${time ? ` (${time})` : ''}. See you soon! 💐\n\nReply STOP to opt out. Msg & data rates may apply.`
      if (smsAllowed(boutique.id)) {
        await sendSms(e164, msg)
        recordSmsSent(boutique.id)
      } else {
        console.warn(`[inngest] SMS cap reached for boutique ${boutique.id} in this run`)
      }
      if (clientId) {
        await supabaseAdmin.from('client_interactions').insert({
          boutique_id: boutique.id, client_id: clientId,
          type: 'reminder', title: '2h appointment reminder sent',
          body: `SMS reminder sent for ${appt.type?.replace(/_/g,' ')} at ${time || 'scheduled time'}`,
          occurred_at: new Date().toISOString(),
        })
        alreadyReminded2h.add(clientId) // prevent double-send within same run
      }
    }
  }
}

// ─── 3. Payment due reminder ──────────────────────────────────────────────────
async function runPaymentReminder() {
  const targetDate = offsetDate(3)
  const { data: boutiques } = await supabaseAdmin.from('boutiques').select('id, name, email, automations').limit(500)
  if (!boutiques) return

  for (const boutique of boutiques) {
    if (!isAutoEnabled(boutique, 'paymentReminder')) continue
    const { data: milestones } = await supabaseAdmin
      .from('payment_milestones')
      .select('*, event:events(client_id, client:clients(name, phone, email, comm_prefs))')
      .eq('boutique_id', boutique.id).eq('due_date', targetDate).neq('status', 'paid')

    // Idempotency: skip milestones already reminded within the past 22 hours
    const payReminderCutoff = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString()

    for (const m of (milestones ?? [])) {
      if (m.last_reminded_at && m.last_reminded_at > payReminderCutoff) continue
      const name  = m.event?.client?.name?.split(' ')[0] ?? 'there'
      const phone = m.event?.client?.phone
      const email = m.event?.client?.email
      const payClient = m.event?.client as { name?: string; phone?: string; email?: string; comm_prefs?: { sms_opt_out?: boolean } } | undefined
      const e164  = phone ? toE164(phone) : null
      if (e164 && payClient?.comm_prefs?.sms_opt_out !== true) {
        if (smsAllowed(boutique.id)) {
          await sendSms(e164, `Hi ${name}! A friendly reminder from ${boutique.name}: your payment of ${fmtMoney(m.amount)} for "${m.label}" is due ${fmtDate(targetDate)}. Questions? Reply here. 💕\n\nReply STOP to opt out. Msg & data rates may apply.`)
          recordSmsSent(boutique.id)
        } else {
          console.warn(`[inngest] SMS cap reached for boutique ${boutique.id} in this run`)
        }
      }
      if (email) {
        await sendEmail({
          to: email,
          subject: `Payment reminder — ${m.label} due ${fmtDate(targetDate)}`,
          html: `<p>Hi ${name},</p><p>Your payment of <strong>${fmtMoney(m.amount)}</strong> for <em>${m.label}</em> is due on <strong>${fmtDate(targetDate)}</strong>.</p><p>Thank you! 💕</p>`,
          text: `Hi ${name},\n\nYour payment of ${fmtMoney(m.amount)} for "${m.label}" is due on ${fmtDate(targetDate)}.\n\nThank you!\n${boutique.name}`,
        })
      }
      if (m.event?.client_id) {
        await supabaseAdmin.from('client_interactions').insert({
          boutique_id: boutique.id, client_id: m.event.client_id,
          type: 'reminder', title: 'Payment reminder sent',
          body: `${fmtMoney(m.amount)} due ${fmtDate(targetDate)} — reminder sent via${e164 ? ' SMS' : ''}${email ? ' email' : ''}`,
          occurred_at: new Date().toISOString(),
        })
        await supabaseAdmin.from('payment_milestones').update({ last_reminded_at: new Date().toISOString() }).eq('id', m.id)
      }
      // Push notification to boutique staff
      await sendPush(
        boutique.id,
        '💳 Payment Reminder',
        `${m.label} — ${fmtMoney(m.amount)} due ${fmtDate(targetDate)}`,
        '/?screen=payments'
      )
    }
  }
}

// ─── 4. Overdue payment alerts ────────────────────────────────────────────────
async function runOverdueAlerts() {
  const checkDates = [offsetDate(-1), offsetDate(-7), offsetDate(-14)]
  const { data: boutiques } = await supabaseAdmin.from('boutiques').select('id, name, automations').limit(500)
  if (!boutiques) return

  for (const boutique of boutiques) {
    if (!isAutoEnabled(boutique, 'overdueAlert')) continue
    const { data: milestones } = await supabaseAdmin
      .from('payment_milestones')
      .select('*, event:events(client_id, client:clients(name, phone, comm_prefs))')
      .eq('boutique_id', boutique.id).in('due_date', checkDates).neq('status', 'paid')

    // Idempotency: skip milestones already alerted within the past 22 hours
    const overdueCutoff = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString()

    for (const m of (milestones ?? [])) {
      if (m.last_reminded_at && m.last_reminded_at > overdueCutoff) continue
      const daysLate = checkDates.indexOf(m.due_date) === 0 ? 1 : checkDates.indexOf(m.due_date) === 1 ? 7 : 14
      const name  = m.event?.client?.name?.split(' ')[0] ?? 'there'
      const phone = m.event?.client?.phone
      const overdueClient = m.event?.client as { name?: string; phone?: string; comm_prefs?: { sms_opt_out?: boolean } } | undefined
      const e164  = phone ? toE164(phone) : null
      if (e164 && overdueClient?.comm_prefs?.sms_opt_out !== true) {
        const msg = daysLate === 1
          ? `Hi ${name}, your payment of ${fmtMoney(m.amount)} for "${m.label}" at ${boutique.name} was due yesterday. Please contact us to settle your balance. 💕\n\nReply STOP to opt out. Msg & data rates may apply.`
          : `Hi ${name}, your payment of ${fmtMoney(m.amount)} for "${m.label}" at ${boutique.name} is now ${daysLate} days overdue. Please reach out as soon as possible.\n\nReply STOP to opt out. Msg & data rates may apply.`
        if (smsAllowed(boutique.id)) {
          await sendSms(e164, msg)
          recordSmsSent(boutique.id)
        } else {
          console.warn(`[inngest] SMS cap reached for boutique ${boutique.id} in this run`)
        }
      }
      if (m.event?.client_id) {
        await supabaseAdmin.from('client_interactions').insert({
          boutique_id: boutique.id, client_id: m.event.client_id,
          type: 'reminder', title: `Overdue alert — ${daysLate}d`,
          body: `${fmtMoney(m.amount)} overdue by ${daysLate} day${daysLate !== 1 ? 's' : ''} — SMS alert sent`,
          occurred_at: new Date().toISOString(),
        })
        await supabaseAdmin.from('payment_milestones').update({ last_reminded_at: new Date().toISOString() }).eq('id', m.id)
      }
      // Push notification to boutique staff
      await sendPush(
        boutique.id,
        '⚠️ Overdue Payment',
        `${m.label} — ${fmtMoney(m.amount)} is ${daysLate} day${daysLate !== 1 ? 's' : ''} overdue`,
        '/?screen=payments'
      )
    }
  }
}

// ─── 5. Dress return reminder ─────────────────────────────────────────────────
async function runReturnReminder() {
  const in48h = offsetDate(2)
  const { data: boutiques } = await supabaseAdmin.from('boutiques').select('id, name, automations').limit(500)
  if (!boutiques) return

  for (const boutique of boutiques) {
    if (!isAutoEnabled(boutique, 'returnReminder')) continue
    const { data: dresses } = await supabaseAdmin
      .from('inventory')
      .select('*, client:clients(name, phone, comm_prefs)')
      .eq('boutique_id', boutique.id).eq('return_date', in48h).eq('status', 'rented')

    for (const dress of (dresses ?? [])) {
      const name  = dress.client?.name?.split(' ')[0] ?? 'there'
      const phone = dress.client?.phone
      const returnClient = dress.client as { name?: string; phone?: string; comm_prefs?: { sms_opt_out?: boolean } } | undefined
      if (returnClient?.comm_prefs?.sms_opt_out === true) continue
      const e164  = phone ? toE164(phone) : null
      if (!e164) continue
      if (smsAllowed(boutique.id)) {
        await sendSms(e164, `Hi ${name}! Reminder from ${boutique.name}: your dress rental "${dress.name}" is due back in 2 days (${fmtDate(in48h)}). Thank you! 💕\n\nReply STOP to opt out. Msg & data rates may apply.`)
        recordSmsSent(boutique.id)
      } else {
        console.warn(`[inngest] SMS cap reached for boutique ${boutique.id} in this run`)
      }
      if (dress.client_id) {
        await supabaseAdmin.from('client_interactions').insert({
          boutique_id: boutique.id, client_id: dress.client_id,
          type: 'reminder', title: 'Return reminder sent',
          body: `SMS reminder for "${dress.name}" — due ${fmtDate(in48h)}`,
          occurred_at: new Date().toISOString(),
        })
      }
    }
  }
}

// ─── 6. Post-event review request ────────────────────────────────────────────
async function runReviewRequest() {
  const yesterday = offsetDate(-1)
  const { data: boutiques } = await supabaseAdmin.from('boutiques').select('id, name, instagram, booking_url, automations').limit(500)
  if (!boutiques) return

  for (const boutique of boutiques) {
    if (!isAutoEnabled(boutique, 'reviewRequest')) continue
    const { data: events } = await supabaseAdmin
      .from('events').select('*, client:clients(name, phone, comm_prefs)')
      .eq('boutique_id', boutique.id).eq('event_date', yesterday).eq('status', 'active')

    for (const ev of (events ?? [])) {
      const name  = ev.client?.name?.split(' ')[0] ?? 'there'
      const phone = ev.client?.phone
      const reviewClient = ev.client as { name?: string; phone?: string; comm_prefs?: { sms_opt_out?: boolean } } | undefined
      if (reviewClient?.comm_prefs?.sms_opt_out === true) continue
      const e164  = phone ? toE164(phone) : null
      if (!e164) continue
      const { count } = await supabaseAdmin
        .from('payment_milestones').select('id', { count: 'exact', head: true })
        .eq('event_id', ev.id).neq('status', 'paid')
      if ((count ?? 0) > 0) continue
      const googleUrl = boutique.automations?.googleReviewUrl
      const reviewLink = googleUrl || boutique.booking_url || null
      const msg = reviewLink
        ? `Hi ${name}! Thank you for celebrating with ${boutique.name}! We hope everything was perfect. We'd love your review: ${reviewLink}\n\nReply STOP to opt out. Msg & data rates may apply.`
        : `Hi ${name}! Thank you for celebrating with ${boutique.name}! We hope everything was perfect. It was our honor to be part of your special day!\n\nReply STOP to opt out. Msg & data rates may apply.`
      if (smsAllowed(boutique.id)) {
        await sendSms(e164, msg)
        recordSmsSent(boutique.id)
      } else {
        console.warn(`[inngest] SMS cap reached for boutique ${boutique.id} in this run`)
      }
      await supabaseAdmin.from('events').update({ status: 'completed' }).eq('id', ev.id)
      // Set portal token expiry to 90 days from now for completed events (SEC-024)
      await supabaseAdmin
        .from('events')
        .update({ portal_token_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() })
        .eq('id', ev.id)
        .is('portal_token_expires_at', null)
      if (ev.client_id) {
        await supabaseAdmin.from('client_interactions').insert({
          boutique_id: boutique.id, client_id: ev.client_id,
          type: 'note', title: 'Review request sent',
          body: 'Post-event review request sent via SMS. Event marked as completed.',
          occurred_at: new Date().toISOString(),
        })
      }
    }
  }
}

// ─── 7. Win-back campaign ─────────────────────────────────────────────────────
async function runWinBack() {
  const cutoff = offsetDate(-60)
  const tooStale = offsetDate(-730) // skip clients with no activity for 2+ years
  const { data: boutiques } = await supabaseAdmin.from('boutiques').select('id, name, automations').limit(500)
  if (!boutiques) return

  for (const boutique of boutiques) {
    if (!isAutoEnabled(boutique, 'winBack')) continue
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('id, name, phone, comm_prefs')
      .eq('boutique_id', boutique.id)

    for (const client of (clients ?? [])) {
      // Skip opted-out clients
      if ((client.comm_prefs as { sms_opt_out?: boolean } | null)?.sms_opt_out === true) continue
      const e164 = client.phone ? toE164(client.phone) : null
      if (!e164) continue
      const { data: last } = await supabaseAdmin
        .from('client_interactions').select('occurred_at')
        .eq('boutique_id', boutique.id).eq('client_id', client.id)
        .order('occurred_at', { ascending: false }).limit(1).maybeSingle()
      const lastDate = last?.occurred_at?.split('T')[0] ?? '2000-01-01'
      if (lastDate >= cutoff) continue          // active within 60 days — skip
      if (lastDate < tooStale) continue         // inactive 2+ years — skip
      const firstName = client.name?.split(' ')[0] ?? 'there'
      if (smsAllowed(boutique.id)) {
        await sendSms(e164, `Hi ${firstName}! We miss you at ${boutique.name} 💕 Whether you're planning a new event or just browsing, we'd love to see you. Reply to chat or visit us anytime!\n\nReply STOP to opt out. Msg & data rates may apply.`)
        recordSmsSent(boutique.id)
      } else {
        console.warn(`[inngest] SMS cap reached for boutique ${boutique.id} in this run`)
      }
      await supabaseAdmin.from('client_interactions').insert({
        boutique_id: boutique.id, client_id: client.id,
        type: 'note', title: 'Win-back SMS sent',
        body: 'Automated win-back message sent (60+ days since last activity).',
        occurred_at: new Date().toISOString(),
      })
    }
  }
}

// ─── 8. Weekly event digest ───────────────────────────────────────────────────
async function runWeeklyDigest() {
  const { data: boutiques } = await supabaseAdmin.from('boutiques').select('id, name, email, automations').limit(500)
  if (!boutiques) return
  const twoWeeksOut = offsetDate(14)

  for (const boutique of boutiques) {
    if (!isAutoEnabled(boutique, 'weeklyDigest')) continue
    if (!boutique.email) continue
    const { data: events } = await supabaseAdmin
      .from('events').select('*, client:clients(name)')
      .eq('boutique_id', boutique.id).eq('status', 'active')
      .gte('event_date', today()).lte('event_date', twoWeeksOut).order('event_date', { ascending: true })
    const { data: overduePayments } = await supabaseAdmin
      .from('payment_milestones')
      .select('label, amount, due_date, event:events(client_id, client:clients(name))')
      .eq('boutique_id', boutique.id).lt('due_date', today()).neq('status', 'paid')

    const eventRows = (events ?? []).map(ev =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${fmtDate(ev.event_date)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${escHtml(ev.client?.name ?? '—')}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${escHtml(ev.type ?? '')}</td></tr>`
    ).join('')
    const overdueRows = (overduePayments ?? []).map(p =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${escHtml(p.event?.client?.name ?? '—')}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${escHtml(p.label)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#DC2626">${fmtMoney(Number(p.amount))}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${fmtDate(p.due_date)}</td></tr>`
    ).join('')

    await sendEmail({
      to: boutique.email,
      subject: `${boutique.name} — Weekly digest ${fmtDate(today())}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#C9697A">Good morning! Here's your weekly digest for ${escHtml(boutique.name)}</h2><h3>📅 Upcoming events (next 2 weeks)</h3>${eventRows ? `<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#FFF5F6"><th style="padding:8px 12px;text-align:left">Date</th><th style="padding:8px 12px;text-align:left">Client</th><th style="padding:8px 12px;text-align:left">Type</th></tr></thead><tbody>${eventRows}</tbody></table>` : '<p style="color:#999">No events in the next 2 weeks.</p>'}${overdueRows ? `<h3 style="color:#DC2626">⚠️ Overdue payments</h3><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="padding:8px 12px;text-align:left">Client</th><th>Milestone</th><th>Amount</th><th>Due</th></tr></thead><tbody>${overdueRows}</tbody></table>` : ''}</div>`,
      text: `Weekly digest for ${boutique.name}\n\nUpcoming events: ${(events ?? []).length}\nOverdue payments: ${(overduePayments ?? []).length}`,
    })
  }
}

// ─── 9. Birthday SMS ─────────────────────────────────────────────────────────
async function runBirthdaySms() {
  const now = new Date()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const mmdd = `${mm}-${dd}`

  const { data: boutiques } = await supabaseAdmin
    .from('boutiques')
    .select('id, name, automations')
  if (!boutiques) return

  for (const boutique of boutiques) {
    // Support both legacy key 'birthdayReminder' and new key 'birthdaySms'
    if (!isAutoEnabled(boutique, 'birthdaySms') && !isAutoEnabled(boutique, 'birthdayReminder')) continue

    // Query clients with birth_date (new) or birthday (legacy)
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('id, name, phone, birth_date, birthday, comm_prefs')
      .eq('boutique_id', boutique.id)
      .not('phone', 'is', null)

    const birthdays = (clients || []).filter(c => {
      const dateVal = c.birth_date || c.birthday
      if (!dateVal) return false
      const parts = dateVal.split('-')
      return `${parts[1]}-${parts[2]}` === mmdd
    })

    for (const client of birthdays) {
      if ((client.comm_prefs as { sms_opt_out?: boolean } | null)?.sms_opt_out === true) continue
      const e164 = toE164(client.phone)
      if (!e164) continue
      const firstName = client.name?.split(' ')[0] ?? 'there'
      const msg = `🎂 Happy Birthday ${firstName}! Wishing you a wonderful day from all of us at ${boutique.name}! 💕\n\nReply STOP to opt out. Msg & data rates may apply.`
      if (smsAllowed(boutique.id)) {
        await sendSms(e164, msg)
        recordSmsSent(boutique.id)
      } else {
        console.warn(`[inngest] SMS cap reached for boutique ${boutique.id} in this run`)
      }
      await supabaseAdmin.from('client_interactions').insert({
        boutique_id: boutique.id,
        client_id: client.id,
        type: 'sms',
        title: 'Birthday SMS sent',
        body: msg,
        occurred_at: new Date().toISOString(),
        is_editable: false,
      })
    }
  }
}

// ─── 10. Anniversary SMS ──────────────────────────────────────────────────────
async function runAnniversarySms() {
  const now = new Date()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const mmdd = `${mm}-${dd}`

  const { data: boutiques } = await supabaseAdmin
    .from('boutiques')
    .select('id, name, automations')
  if (!boutiques) return

  for (const boutique of boutiques) {
    // Support both legacy key 'anniversaryReminder' and new key 'anniversarySms'
    if (!isAutoEnabled(boutique, 'anniversarySms') && !isAutoEnabled(boutique, 'anniversaryReminder')) continue

    // 1. Clients with explicit anniversary_date (new column)
    const { data: clientsWithAnniv } = await supabaseAdmin
      .from('clients')
      .select('id, name, phone, anniversary_date, comm_prefs')
      .eq('boutique_id', boutique.id)
      .not('anniversary_date', 'is', null)
      .not('phone', 'is', null)

    const clientAnniversaries = (clientsWithAnniv || []).filter(c => {
      if (!c.anniversary_date) return false
      const parts = c.anniversary_date.split('-')
      return `${parts[1]}-${parts[2]}` === mmdd
    })

    for (const client of clientAnniversaries) {
      if ((client.comm_prefs as { sms_opt_out?: boolean } | null)?.sms_opt_out === true) continue
      const e164 = toE164(client.phone)
      if (!e164) continue
      const firstName = client.name?.split(' ')[0] ?? 'there'
      const years = now.getUTCFullYear() - new Date(client.anniversary_date).getUTCFullYear()
      const yearsStr = years > 0 ? `${years} year${years !== 1 ? 's' : ''}` : 'another year'
      const msg = `💕 Happy Anniversary ${firstName}! It's been ${yearsStr} since your special day. We hope the memories last forever! - ${boutique.name}\n\nReply STOP to opt out. Msg & data rates may apply.`
      if (smsAllowed(boutique.id)) {
        await sendSms(e164, msg)
        recordSmsSent(boutique.id)
      } else {
        console.warn(`[inngest] SMS cap reached for boutique ${boutique.id} in this run`)
      }
      await supabaseAdmin.from('client_interactions').insert({
        boutique_id: boutique.id,
        client_id: client.id,
        type: 'sms',
        title: 'Anniversary SMS sent',
        body: msg,
        occurred_at: new Date().toISOString(),
        is_editable: false,
      })
    }

    // 2. Completed wedding events (event_date month+day = today)
    const { data: weddings } = await supabaseAdmin
      .from('events')
      .select('id, event_date, client_id, client:clients(id, name, phone, comm_prefs)')
      .eq('boutique_id', boutique.id)
      .eq('type', 'wedding')
      .eq('status', 'completed')
      .not('client_id', 'is', null)

    const weddingAnniversaries = (weddings || []).filter(w => {
      if (!w.event_date) return false
      const parts = w.event_date.split('-')
      return `${parts[1]}-${parts[2]}` === mmdd
    })

    for (const wedding of weddingAnniversaries) {
      const weddingClient = wedding.client as { id?: string; name?: string; phone?: string; comm_prefs?: { sms_opt_out?: boolean } } | undefined
      if (weddingClient?.comm_prefs?.sms_opt_out === true) continue
      const phone = weddingClient?.phone
      if (!phone) continue
      const e164 = toE164(phone)
      if (!e164) continue
      const years = now.getUTCFullYear() - new Date(wedding.event_date).getUTCFullYear()
      if (years <= 0) continue
      const yearsStr = `${years} year${years !== 1 ? 's' : ''}`
      const firstName = (weddingClient?.name || '').split(' ')[0] || 'there'
      const msg = `💕 Happy Anniversary ${firstName}! It's been ${yearsStr} since your special day. We hope the memories last forever! - ${boutique.name}\n\nReply STOP to opt out. Msg & data rates may apply.`
      if (smsAllowed(boutique.id)) {
        await sendSms(e164, msg)
        recordSmsSent(boutique.id)
      } else {
        console.warn(`[inngest] SMS cap reached for boutique ${boutique.id} in this run`)
      }
      await supabaseAdmin.from('client_interactions').insert({
        boutique_id: boutique.id,
        client_id: wedding.client_id,
        type: 'sms',
        title: `${years}-year anniversary SMS sent`,
        body: msg,
        occurred_at: new Date().toISOString(),
        is_editable: false,
      })
    }
  }
}

// ─── 12. Onboarding welcome email (event-driven) ──────────────────────────────
async function runOnboardingWelcome(data: { owner_email: string; boutique_name: string }) {
  const { owner_email, boutique_name } = data
  if (!owner_email) return
  const appUrl = 'https://belori.app'
  await sendEmail({
    to: owner_email,
    subject: `Welcome to Belori, ${boutique_name}! 🎉`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1C1012"><div style="background:#C9697A;padding:28px 32px;border-radius:12px 12px 0 0"><div style="font-size:22px;font-weight:600;color:#fff">Welcome to Belori! 💕</div><div style="font-size:14px;color:rgba(255,255,255,.85);margin-top:4px">You're in — let's make ${escHtml(boutique_name)} shine</div></div><div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:28px 32px;border-radius:0 0 12px 12px"><p>Hi there!</p><p>Your <strong>${escHtml(boutique_name)}</strong> account is ready.</p><p><strong>Get started in 3 steps:</strong><br>1️⃣ Add your first client<br>2️⃣ Create an event<br>3️⃣ Set up payment milestones</p><a href="${appUrl}" style="display:inline-block;background:#C9697A;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Open your dashboard →</a></div></div>`,
    text: `Welcome to Belori!\n\nYour ${boutique_name} account is ready. Log in at ${appUrl}\n\n1. Add your first client\n2. Create an event\n3. Set up payment milestones\n\n— The Belori team`,
  })
}

// ─── 13. Staff invite email (event-driven) ───────────────────────────────────
async function runStaffInvite(data: { email: string; boutique_name: string; role: string; invite_link: string }) {
  const { email, boutique_name, role, invite_link } = data
  if (!email || !invite_link) return

  const roleLabels: Record<string, string> = {
    owner: 'Owner', coordinator: 'Coordinator', front_desk: 'Front Desk',
    seamstress: 'Seamstress', decorator: 'Decorator',
  }
  const roleLabel = roleLabels[role] ?? role

  await sendEmail({
    to: email,
    subject: `You've been invited to join ${boutique_name} on Belori`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1C1012">
      <div style="background:#C9697A;padding:28px 32px;border-radius:12px 12px 0 0">
        <div style="font-size:22px;font-weight:600;color:#fff">You're invited! 🎉</div>
        <div style="font-size:14px;color:rgba(255,255,255,.85);margin-top:4px">${escHtml(boutique_name)} wants you on their team</div>
      </div>
      <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:28px 32px;border-radius:0 0 12px 12px">
        <p>Hi there!</p>
        <p><strong>${escHtml(boutique_name)}</strong> has invited you to join their boutique on Belori as <strong>${escHtml(roleLabel)}</strong>.</p>
        <p>Click the button below to create your account and get started:</p>
        <a href="${invite_link}" style="display:inline-block;background:#C9697A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;margin:8px 0;">Accept invitation →</a>
        <p style="margin-top:24px;font-size:12px;color:#9CA3AF">Or copy this link: <a href="${invite_link}" style="color:#C9697A">${invite_link}</a></p>
        <p style="font-size:12px;color:#9CA3AF">This invite expires in 7 days. If you didn't expect this, you can ignore this email.</p>
      </div>
    </div>`,
    text: `You've been invited to join ${boutique_name} on Belori as ${roleLabel}.\n\nAccept your invitation: ${invite_link}\n\nThis link expires in 7 days.`,
  })
}

// ─── HTTP router ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Auth check — require key from header only (never from query param to avoid log leakage)
  const SECRET = Deno.env.get('AUTOMATION_SECRET_KEY')
  if (!SECRET) {
    return new Response('Server misconfiguration: AUTOMATION_SECRET_KEY not set', { status: 500, headers: corsHeaders })
  }
  const key = req.headers.get('x-automation-key') ?? ''
  if (key !== SECRET) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const url  = new URL(req.url)
  const type = url.searchParams.get('type')

  try {
    let body: Record<string, unknown> = {}
    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      body = await req.json().catch(() => ({}))
    }
    const t = type ?? (body.type as string)

    switch (t) {
      case 'sms24h':           await runSms24h(); break
      case 'sms2h':            await runSms2h(); break
      case 'paymentReminder':  await runPaymentReminder(); break
      case 'overdueAlert':     await runOverdueAlerts(); break
      case 'returnReminder':   await runReturnReminder(); break
      case 'reviewRequest':    await runReviewRequest(); break
      case 'winBack':           await runWinBack(); break
      case 'weeklyDigest':      await runWeeklyDigest(); break
      case 'birthdaySms':
      case 'birthdayReminder':     await runBirthdaySms(); break
      case 'anniversarySms':
      case 'anniversaryReminder':  await runAnniversarySms(); break
      case 'onboarding':           await runOnboardingWelcome(body as { owner_email: string; boutique_name: string }); break
      case 'staffInvite':      await runStaffInvite(body as { email: string; boutique_name: string; role: string; invite_link: string }); break
      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${t}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    return new Response(JSON.stringify({ ok: true, type: t }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error(`[automations] ${type} error:`, err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
