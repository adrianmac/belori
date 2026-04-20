/**
 * Belori — PDF generation endpoint
 *
 * Generates a downloadable event contract, payment receipt, or proposal quote.
 *
 * Usage:
 *   GET  /functions/v1/pdf?event_id=<uuid>&type=contract
 *   GET  /functions/v1/pdf?event_id=<uuid>&type=receipt&milestone_id=<uuid>
 *   POST /functions/v1/pdf    body: { type: "quote", boutique: {...}, quote: {...} }
 *
 * Auth: pass the user's JWT as Bearer token (standard Supabase auth).
 * RLS is enforced via the service-role client scoped to the boutique.
 *
 * Visual language — "Couture Atelier":
 *   - Ink masthead with a champagne-gold hairline accent
 *   - TimesRoman serif + italic for editorial titles (pdf-lib built-in, no external fonts)
 *   - Helvetica for small-caps metadata labels (tracked, uppercase)
 *   - Warm ivory row banding (vs neon pink)
 *   - Ornamental diamond divider and fine hairline rules
 */

import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1'
import { supabaseAdmin } from '../_shared/supabase.ts'

// ─── Couture palette ─────────────────────────────────────────────────────────
const INK        = rgb(0.110, 0.067, 0.094)   // #1C1118
const INK_MID    = rgb(0.361, 0.290, 0.322)   // #5C4A52
const INK_LIGHT  = rgb(0.612, 0.541, 0.573)   // #9C8A92
const GOLD       = rgb(0.690, 0.541, 0.306)   // #B08A4E champagne
const GOLD_DARK  = rgb(0.557, 0.420, 0.204)   // #8E6B34
const GOLD_LIGHT = rgb(0.984, 0.961, 0.914)   // #FBF5E9
const IVORY      = rgb(0.973, 0.953, 0.941)   // #F8F4F0
const CARD_WARM  = rgb(0.996, 0.984, 0.969)   // #FEFBF7
const HAIR       = rgb(0.788, 0.749, 0.722)   // #C9BFB8
const BORDER     = rgb(0.929, 0.906, 0.886)   // #EDE7E2
const DANGER     = rgb(0.639, 0.267, 0.329)   // #A34454
const SUCCESS    = rgb(0.361, 0.541, 0.431)   // #5C8A6E
const WHITE      = rgb(0.996, 0.984, 0.969)   // warm cream, not stark white

// ─── Formatters ──────────────────────────────────────────────────────────────
function fmtMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })
}
function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}
function fmtDateShort(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
function romanNumeral(n: number): string {
  const map: [number, string][] = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]
  let r = ''
  for (const [v, s] of map) { while (n >= v) { r += s; n -= v } }
  return r
}

// ─── Primitives ──────────────────────────────────────────────────────────────
function hRule(page: any, y: number, margin: number, width: number, color = BORDER) {
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color })
}

/** Draws a centered diamond fleuron flanked by hairline gold rules. */
function ornament(page: any, y: number, margin: number, width: number, ruleWidth = 60) {
  const cx = width / 2
  // Left rule
  page.drawLine({ start: { x: cx - ruleWidth - 12, y }, end: { x: cx - 12, y }, thickness: 0.5, color: GOLD })
  // Right rule
  page.drawLine({ start: { x: cx + 12, y }, end: { x: cx + ruleWidth + 12, y }, thickness: 0.5, color: GOLD })
  // Diamond (rotated 45°)
  const s = 3
  page.drawRectangle({
    x: cx - s, y: y - s,
    width: s * 2, height: s * 2,
    color: GOLD, rotate: { type: 'degrees', angle: 45 },
  })
}

/** Couture masthead — ink bar + gold hairline accent + small-caps + house name. */
function drawMasthead(
  page: any,
  width: number,
  height: number,
  margin: number,
  boutique: { name?: string; phone?: string; email?: string; address?: string },
  kicker: string,  // e.g. "SERVICE CONTRACT"
  fontBold: any,
  fontNormal: any,
  fontSerif: any,
  fontSerifItalic: any,
) {
  const barHeight = 84
  // Ink bar
  page.drawRectangle({ x: 0, y: height - barHeight, width, height: barHeight, color: INK })
  // Champagne gold hairline — top accent
  page.drawRectangle({ x: 0, y: height - 2.5, width, height: 1.5, color: GOLD })
  // Gold hairline — bottom rule (subtle)
  page.drawRectangle({ x: 0, y: height - barHeight, width, height: 0.5, color: GOLD })

  // House name — Italic serif display
  page.drawText(boutique?.name ?? 'Belori', {
    x: margin, y: height - 42,
    size: 24, font: fontSerifItalic, color: WHITE,
  })
  // Small-caps subtitle under the name
  page.drawText('ATELIER', {
    x: margin, y: height - 62,
    size: 7, font: fontBold, color: GOLD, characterSpacing: 3.2,
  })

  // Kicker on the right — small-caps tracked
  const kw = fontBold.widthOfTextAtSize(kicker, 7)
  page.drawText(kicker, {
    x: width - margin - kw - 12 * 3.2, y: height - 42,
    size: 7, font: fontBold, color: GOLD, characterSpacing: 3.2,
  })

  // Contact lines on the right
  const y0 = height - 58
  if (boutique?.phone) {
    const w = fontNormal.widthOfTextAtSize(boutique.phone, 8.5)
    page.drawText(boutique.phone, { x: width - margin - w, y: y0, size: 8.5, font: fontNormal, color: IVORY })
  }
  if (boutique?.email) {
    const w = fontNormal.widthOfTextAtSize(boutique.email, 8.5)
    page.drawText(boutique.email, { x: width - margin - w, y: y0 - 12, size: 8.5, font: fontNormal, color: IVORY })
  }
}

/** Small-caps tracked section header — consistent across all PDFs. */
function drawSectionHeader(
  page: any, text: string, x: number, y: number, fontBold: any,
) {
  page.drawText(text, {
    x, y,
    size: 7.5, font: fontBold, color: GOLD_DARK,
    characterSpacing: 2.8,
  })
}

/** Editorial couture footer — hairline rule, small-caps meta, centered fleuron. */
function drawFooter(
  page: any, width: number, margin: number,
  boutique: { name?: string; address?: string },
  fontBold: any, fontNormal: any, fontSerifItalic: any,
) {
  // Hairline
  page.drawLine({
    start: { x: margin, y: 48 }, end: { x: width - margin, y: 48 },
    thickness: 0.5, color: HAIR,
  })
  // Small diamond in center
  page.drawRectangle({
    x: width / 2 - 2, y: 46, width: 4, height: 4,
    color: GOLD, rotate: { type: 'degrees', angle: 45 },
  })
  // Left: italic serif house name
  if (boutique?.name) {
    page.drawText(boutique.name, {
      x: margin, y: 32, size: 8.5, font: fontSerifItalic, color: INK_MID,
    })
  }
  if (boutique?.address) {
    page.drawText(boutique.address, {
      x: margin, y: 22, size: 7, font: fontNormal, color: INK_LIGHT,
    })
  }
  // Right: small-caps generated line
  const gen = `GENERATED BY BELORI · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}`
  const w = fontBold.widthOfTextAtSize(gen, 6.5)
  page.drawText(gen, {
    x: width - margin - w - 6 * 1.6, y: 32,
    size: 6.5, font: fontBold, color: INK_LIGHT,
    characterSpacing: 1.6,
  })
}

// ─── Contract PDF ────────────────────────────────────────────────────────────
async function buildContractPdf(eventId: string): Promise<Uint8Array> {
  const { data: ev, error } = await supabaseAdmin
    .from('events')
    .select(`
      *,
      client:clients(name, phone, email, partner_name, language_preference),
      boutique:boutiques(name, phone, email, address, instagram),
      milestones:payment_milestones(label, amount, due_date, status),
      services:event_services(service_type)
    `)
    .eq('id', eventId)
    .single()

  if (error || !ev) throw new Error('Event not found')

  const doc  = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const { width, height } = page.getSize()
  const margin = 56

  const fontBold        = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontNormal      = await doc.embedFont(StandardFonts.Helvetica)
  const fontSerif       = await doc.embedFont(StandardFonts.TimesRoman)
  const fontSerifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const fontSerifBold   = await doc.embedFont(StandardFonts.TimesRomanBold)

  // ── Couture masthead ────────────────────────────────────────────────────
  drawMasthead(page, width, height, margin, ev.boutique ?? {}, 'SERVICE CONTRACT',
    fontBold, fontNormal, fontSerif, fontSerifItalic)

  let y = height - 110

  // ── Editorial title block ───────────────────────────────────────────────
  const typeLabel = ev.type === 'wedding' ? 'Wedding'
    : ev.type === 'quince' ? 'Quinceañera'
    : (ev.type ?? 'Event')
  // Italic serif title (very editorial)
  page.drawText('A record of', { x: margin, y, size: 11, font: fontSerifItalic, color: INK_MID })
  y -= 22
  page.drawText(typeLabel + ' Services.', { x: margin, y, size: 28, font: fontSerifItalic, color: INK })
  y -= 18
  if (ev.event_date) {
    page.drawText(fmtDate(ev.event_date).toUpperCase(), {
      x: margin, y, size: 8, font: fontBold, color: GOLD_DARK, characterSpacing: 2.2,
    })
  }
  y -= 16
  ornament(page, y, margin, width)
  y -= 22

  // ── Client information ──────────────────────────────────────────────────
  drawSectionHeader(page, 'CLIENT', margin, y, fontBold)
  y -= 16
  const clientRows: [string, string][] = [
    ['Client', ev.client?.name ?? '—'],
    ev.client?.partner_name ? ['Partner', ev.client.partner_name] : null,
    ['Phone', ev.client?.phone ?? '—'],
    ['Email', ev.client?.email ?? '—'],
  ].filter(Boolean) as [string, string][]

  for (const [k, v] of clientRows) {
    // Small-caps tracked label
    page.drawText(k.toUpperCase(), {
      x: margin, y, size: 7, font: fontBold, color: INK_LIGHT, characterSpacing: 2,
    })
    // Value — serif normal, weight that reads like type setting
    page.drawText(v, {
      x: margin + 80, y, size: 10.5, font: fontSerif, color: INK,
    })
    y -= 16
  }
  y -= 4
  hRule(page, y, margin, width)
  y -= 20

  // ── Event details ───────────────────────────────────────────────────────
  drawSectionHeader(page, 'CEREMONY', margin, y, fontBold)
  y -= 16
  const detailRows: [string, string][] = [
    ['Event', typeLabel],
    ['Date', ev.event_date ? fmtDate(ev.event_date) : '—'],
    ev.venue ? ['Venue', ev.venue] : null,
    ev.guests ? ['Guests', `approx. ${ev.guests}`] : null,
  ].filter(Boolean) as [string, string][]

  for (const [k, v] of detailRows) {
    page.drawText(k.toUpperCase(), {
      x: margin, y, size: 7, font: fontBold, color: INK_LIGHT, characterSpacing: 2,
    })
    page.drawText(v, {
      x: margin + 80, y, size: 10.5, font: fontSerif, color: INK,
    })
    y -= 16
  }
  y -= 4
  hRule(page, y, margin, width)
  y -= 20

  // ── Services included ──────────────────────────────────────────────────
  const SVC_LABELS: Record<string, string> = {
    dress_rental:     'Dress rental',
    alterations:      'Alterations & tailoring',
    planning:         'Event planning & coordination',
    decoration:       'Decoration & venue setup',
    photography:      'Photography & video',
    dj:               'DJ / Music',
    photobooth:       'Photo booth',
    custom_sneakers:  'Custom sneakers',
  }
  const services = (ev.services ?? []).map((s: any) => s.service_type)
  if (services.length > 0) {
    drawSectionHeader(page, 'SERVICES INCLUDED', margin, y, fontBold)
    y -= 18
    services.forEach((svc: string, i: number) => {
      const roman = romanNumeral(i + 1).padEnd(4, ' ')
      // Roman numeral + italic label — editorial list
      page.drawText(roman, { x: margin, y, size: 9, font: fontSerifItalic, color: GOLD_DARK })
      page.drawText(SVC_LABELS[svc] ?? svc, {
        x: margin + 28, y, size: 10.5, font: fontSerif, color: INK,
      })
      y -= 15
    })
    y -= 4
    hRule(page, y, margin, width)
    y -= 20
  }

  // ── Payment schedule ────────────────────────────────────────────────────
  const milestones = ev.milestones ?? []
  if (milestones.length > 0) {
    drawSectionHeader(page, 'PAYMENT SCHEDULE', margin, y, fontBold)
    y -= 18

    // Header row — warm ivory band, small-caps
    page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 18, color: IVORY })
    page.drawText('MILESTONE', { x: margin + 8, y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    page.drawText('DUE',       { x: margin + 240, y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    page.drawText('AMOUNT',    { x: margin + 360, y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    page.drawText('STATUS',    { x: margin + 440, y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    y -= 20

    let total = 0
    milestones.forEach((m: any, idx: number) => {
      total += Number(m.amount)
      const statusLabel = m.status === 'paid' ? 'Paid' : 'Pending'
      const statusCol   = m.status === 'paid' ? SUCCESS : INK_MID

      // Subtle zebra stripe on alt rows — warm cream
      if (idx % 2 === 1) {
        page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 16, color: CARD_WARM })
      }
      page.drawText(m.label ?? '', { x: margin + 8, y, size: 10, font: fontSerif, color: INK })
      page.drawText(m.due_date ? fmtDateShort(m.due_date) : '—',
        { x: margin + 240, y, size: 10, font: fontSerif, color: INK })
      page.drawText(fmtMoney(Number(m.amount)),
        { x: margin + 360, y, size: 10, font: fontSerif, color: INK })
      page.drawText(statusLabel,
        { x: margin + 440, y, size: 10, font: fontSerifItalic, color: statusCol })
      y -= 16
    })

    y -= 4
    hRule(page, y, margin, width, HAIR)
    y -= 14
    // Total row — italic serif + gold
    page.drawText('Total contract value', {
      x: margin + 240, y, size: 11, font: fontSerifItalic, color: INK_MID,
    })
    page.drawText(fmtMoney(Number(ev.total ?? total)), {
      x: margin + 440, y, size: 12, font: fontSerifBold, color: GOLD_DARK,
    })
    y -= 22
    hRule(page, y, margin, width)
    y -= 20
  }

  // ── Signature block ─────────────────────────────────────────────────────
  if (y > 150) {
    drawSectionHeader(page, 'SIGNATURES', margin, y, fontBold)
    y -= 32

    // Client sig line
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.75, color: INK })
    page.drawText('Client signature', {
      x: margin, y: y - 13, size: 7, font: fontBold, color: INK_LIGHT, characterSpacing: 1.6,
    })
    page.drawText('CLIENT SIGNATURE'.toLowerCase(), { x: margin, y: y - 13, size: 7, font: fontBold, color: INK_LIGHT })
    page.drawLine({ start: { x: margin + 250, y }, end: { x: margin + 400, y }, thickness: 0.75, color: INK })
    page.drawText('Date', {
      x: margin + 250, y: y - 13, size: 7, font: fontBold, color: INK_LIGHT, characterSpacing: 1.6,
    })

    y -= 48
    // Boutique sig line
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.75, color: INK })
    const repLabel = `${(ev.boutique?.name ?? 'Atelier')} representative`
    page.drawText(repLabel, {
      x: margin, y: y - 13, size: 7, font: fontBold, color: INK_LIGHT, characterSpacing: 1.6,
    })
    page.drawLine({ start: { x: margin + 250, y }, end: { x: margin + 400, y }, thickness: 0.75, color: INK })
    page.drawText('Date', {
      x: margin + 250, y: y - 13, size: 7, font: fontBold, color: INK_LIGHT, characterSpacing: 1.6,
    })
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  drawFooter(page, width, margin, ev.boutique ?? {}, fontBold, fontNormal, fontSerifItalic)

  return await doc.save()
}

// ─── Receipt PDF ─────────────────────────────────────────────────────────────
async function buildReceiptPdf(milestoneId: string): Promise<Uint8Array> {
  const { data: m, error } = await supabaseAdmin
    .from('payment_milestones')
    .select(`
      *,
      event:events(
        type, event_date, venue,
        client:clients(name, phone, email),
        boutique:boutiques(name, phone, email, address)
      )
    `)
    .eq('id', milestoneId)
    .single()

  if (error || !m) throw new Error('Milestone not found')

  const doc  = await PDFDocument.create()
  const page = doc.addPage([612, 440])
  const { width, height } = page.getSize()
  const margin = 56

  const fontBold        = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontNormal      = await doc.embedFont(StandardFonts.Helvetica)
  const fontSerif       = await doc.embedFont(StandardFonts.TimesRoman)
  const fontSerifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const fontSerifBold   = await doc.embedFont(StandardFonts.TimesRomanBold)

  // Masthead
  drawMasthead(page, width, height, margin, m.event?.boutique ?? {}, 'PAYMENT RECEIPT',
    fontBold, fontNormal, fontSerif, fontSerifItalic)

  let y = height - 120

  // Title
  page.drawText('With thanks,', { x: margin, y, size: 11, font: fontSerifItalic, color: INK_MID })
  y -= 22
  page.drawText('Receipt of Payment.', { x: margin, y, size: 24, font: fontSerifItalic, color: INK })
  y -= 18
  ornament(page, y, margin, width)
  y -= 22

  // Rows
  const rows: [string, string][] = [
    ['Client',    m.event?.client?.name ?? '—'],
    ['Milestone', m.label ?? '—'],
    ['Amount',    fmtMoney(Number(m.amount))],
    ['Paid on',   m.paid_date ? fmtDate(m.paid_date) :
                  new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
    ['Event',     m.event?.event_date ? fmtDate(m.event.event_date) : '—'],
    m.event?.venue ? ['Venue', m.event.venue] : null,
  ].filter(Boolean) as [string, string][]

  for (const [k, v] of rows) {
    page.drawText(k.toUpperCase(), {
      x: margin, y, size: 7, font: fontBold, color: INK_LIGHT, characterSpacing: 2,
    })
    // Amount row gets gold emphasis
    if (k === 'Amount') {
      page.drawText(v, { x: margin + 100, y, size: 14, font: fontSerifBold, color: GOLD_DARK })
    } else {
      page.drawText(v, { x: margin + 100, y, size: 10.5, font: fontSerif, color: INK })
    }
    y -= 18
    hRule(page, y + 4, margin, width, HAIR)
  }

  y -= 14
  // Confirmation pill — warm gold band
  page.drawRectangle({ x: margin, y: y - 8, width: width - margin * 2, height: 30, color: GOLD_LIGHT })
  page.drawRectangle({ x: margin, y: y - 8, width: 2, height: 30, color: GOLD })
  page.drawText('Payment received in full.', {
    x: margin + 14, y: y + 4, size: 12, font: fontSerifItalic, color: GOLD_DARK,
  })

  drawFooter(page, width, margin, m.event?.boutique ?? {}, fontBold, fontNormal, fontSerifItalic)
  return await doc.save()
}

// ─── Quote PDF ───────────────────────────────────────────────────────────────
interface QuoteLineItem { description: string; qty: number; unit_price: number }
interface QuoteMilestone { label: string; due_date: string; amount: number }
interface QuotePayload {
  boutique: { name: string; phone?: string; email?: string; address?: string }
  quote: {
    client_name: string
    event_type?: string
    event_date?: string
    venue?: string
    expires_at?: string
    line_items: QuoteLineItem[]
    milestones: QuoteMilestone[]
    discount_type: 'fixed' | 'percent'
    discount_value: number
    subtotal: number
    discount_amt: number
    total: number
    notes?: string
  }
}

async function buildQuotePdf(payload: QuotePayload): Promise<Uint8Array> {
  const { boutique, quote } = payload

  const doc  = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const { width, height } = page.getSize()
  const margin = 56

  const fontBold        = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontNormal      = await doc.embedFont(StandardFonts.Helvetica)
  const fontSerif       = await doc.embedFont(StandardFonts.TimesRoman)
  const fontSerifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const fontSerifBold   = await doc.embedFont(StandardFonts.TimesRomanBold)

  drawMasthead(page, width, height, margin, boutique, 'PROPOSAL', fontBold, fontNormal, fontSerif, fontSerifItalic)

  let y = height - 110

  // Editorial title
  page.drawText('A proposal for', { x: margin, y, size: 11, font: fontSerifItalic, color: INK_MID })
  y -= 22
  page.drawText(quote.client_name + '.', { x: margin, y, size: 26, font: fontSerifItalic, color: INK })
  y -= 14
  const prepLine = `PREPARED ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}`
  page.drawText(prepLine, { x: margin, y, size: 7, font: fontBold, color: INK_LIGHT, characterSpacing: 2 })
  if (quote.expires_at) {
    const valid = `VALID UNTIL ${new Date(quote.expires_at + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}`
    const w = fontBold.widthOfTextAtSize(valid, 7)
    page.drawText(valid, { x: width - margin - w - 2 * 12, y, size: 7, font: fontBold, color: GOLD_DARK, characterSpacing: 2 })
  }
  y -= 16
  ornament(page, y, margin, width)
  y -= 22

  // Client info
  drawSectionHeader(page, 'CEREMONY', margin, y, fontBold)
  y -= 16
  const clientRows: [string, string][] = [
    ['Client', quote.client_name],
    quote.event_type ? ['Event', quote.event_type] : null,
    quote.event_date ? ['Date', fmtDate(quote.event_date)] : null,
    quote.venue ? ['Venue', quote.venue] : null,
  ].filter(Boolean) as [string, string][]

  for (const [k, v] of clientRows) {
    page.drawText(k.toUpperCase(), { x: margin, y, size: 7, font: fontBold, color: INK_LIGHT, characterSpacing: 2 })
    page.drawText(v, { x: margin + 80, y, size: 10.5, font: fontSerif, color: INK })
    y -= 16
  }
  y -= 4
  hRule(page, y, margin, width)
  y -= 20

  // Line items table
  const lineItems = (quote.line_items || []).filter(li => li.description)
  if (lineItems.length > 0) {
    drawSectionHeader(page, 'SERVICES & PRICING', margin, y, fontBold)
    y -= 18

    const colDesc  = margin + 8
    const colQty   = margin + 240
    const colUnit  = margin + 300
    const colTotal = margin + 400

    // Header row
    page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 18, color: IVORY })
    page.drawText('DESCRIPTION', { x: colDesc,  y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    page.drawText('QTY',         { x: colQty,   y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    page.drawText('UNIT',        { x: colUnit,  y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    page.drawText('TOTAL',       { x: colTotal, y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    y -= 20

    lineItems.forEach((li, idx) => {
      const lineTotal = (Number(li.qty) || 1) * (Number(li.unit_price) || 0)
      if (idx % 2 === 1) {
        page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 16, color: CARD_WARM })
      }
      page.drawText(li.description, { x: colDesc, y, size: 10, font: fontSerif, color: INK })
      page.drawText(String(li.qty),  { x: colQty,  y, size: 10, font: fontSerif, color: INK })
      page.drawText(fmtMoney(li.unit_price), { x: colUnit,  y, size: 10, font: fontSerif, color: INK })
      page.drawText(fmtMoney(lineTotal),     { x: colTotal, y, size: 10, font: fontSerifBold, color: INK })
      y -= 16
    })

    y -= 4
    hRule(page, y, margin, width, HAIR)
    y -= 14

    // Subtotal
    page.drawText('Subtotal', { x: colUnit, y, size: 10, font: fontSerif, color: INK_MID })
    page.drawText(fmtMoney(quote.subtotal), { x: colTotal, y, size: 10, font: fontSerif, color: INK_MID })
    y -= 14

    // Discount
    if (quote.discount_amt > 0) {
      page.drawText('Discount', { x: colUnit, y, size: 10, font: fontSerifItalic, color: SUCCESS })
      page.drawText('− ' + fmtMoney(quote.discount_amt), { x: colTotal, y, size: 10, font: fontSerifItalic, color: SUCCESS })
      y -= 14
    }

    y -= 4
    hRule(page, y + 4, margin, width, HAIR)
    y -= 10
    // Total
    page.drawText('Total', { x: colUnit, y, size: 13, font: fontSerifItalic, color: INK })
    page.drawText(fmtMoney(quote.total), { x: colTotal, y, size: 14, font: fontSerifBold, color: GOLD_DARK })
    y -= 22
    hRule(page, y, margin, width)
    y -= 20
  }

  // Payment schedule
  const milestones = quote.milestones || []
  if (milestones.length > 0 && y > 120) {
    drawSectionHeader(page, 'PAYMENT SCHEDULE', margin, y, fontBold)
    y -= 18

    page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 18, color: IVORY })
    page.drawText('MILESTONE', { x: margin + 8,   y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    page.drawText('DUE',       { x: margin + 260, y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    page.drawText('AMOUNT',    { x: margin + 400, y: y + 2, size: 7, font: fontBold, color: INK_MID, characterSpacing: 1.6 })
    y -= 20

    milestones.forEach((m, idx) => {
      if (idx % 2 === 1) {
        page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 16, color: CARD_WARM })
      }
      page.drawText(m.label || '—', { x: margin + 8, y, size: 10, font: fontSerif, color: INK })
      page.drawText(m.due_date ? fmtDateShort(m.due_date) : '—', { x: margin + 260, y, size: 10, font: fontSerif, color: INK })
      page.drawText(fmtMoney(Number(m.amount)), { x: margin + 400, y, size: 10, font: fontSerif, color: INK })
      y -= 16
    })
    y -= 8
    hRule(page, y, margin, width)
    y -= 20
  }

  // Notes
  if (quote.notes && y > 80) {
    drawSectionHeader(page, 'NOTES & TERMS', margin, y, fontBold)
    y -= 16
    const words = quote.notes.split(' ')
    let line = ''
    for (const word of words) {
      if ((line + ' ' + word).length > 82) {
        page.drawText(line.trim(), { x: margin, y, size: 10, font: fontSerif, color: INK })
        y -= 14
        line = word
        if (y < 70) break
      } else {
        line = line ? line + ' ' + word : word
      }
    }
    if (line && y >= 70) {
      page.drawText(line.trim(), { x: margin, y, size: 10, font: fontSerif, color: INK })
      y -= 14
    }
  }

  drawFooter(page, width, margin, boutique, fontBold, fontNormal, fontSerifItalic)
  return await doc.save()
}

// ─── JWT auth helper ─────────────────────────────────────────────────────────
async function requireAuth(req: Request): Promise<{ userId: string; boutiqueId: string } | Response> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) return new Response('Unauthorized', { status: 401 })
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: { user }, error } = await anon.auth.getUser(jwt)
  if (error || !user) return new Response('Unauthorized', { status: 401 })
  const { data: member } = await supabaseAdmin
    .from('boutique_members')
    .select('boutique_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()
  if (!member?.boutique_id) return new Response('Unauthorized', { status: 401 })
  return { userId: user.id, boutiqueId: member.boutique_id }
}

// ─── Request handler ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })

  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult
  const { boutiqueId } = authResult

  const url         = new URL(req.url)
  const eventId     = url.searchParams.get('event_id')
  const milestoneId = url.searchParams.get('milestone_id')

  let bodyJson: Record<string, unknown> = {}
  let bodyType: string | null = null
  if (req.method === 'POST') {
    try {
      bodyJson = await req.json()
      bodyType = (bodyJson.type as string) ?? null
    } catch { /* not JSON */ }
  }
  const type = bodyType ?? url.searchParams.get('type') ?? 'contract'

  try {
    let pdfBytes: Uint8Array
    let filename: string

    if (type === 'quote') {
      const payload = bodyJson as unknown as QuotePayload
      if (!payload?.quote?.client_name) {
        return new Response('Missing quote data', { status: 400 })
      }
      pdfBytes = await buildQuotePdf(payload)
      filename = `quote-${payload.quote.client_name.replace(/\s+/g, '-').toLowerCase().slice(0, 20)}.pdf`
    } else if (type === 'receipt' && milestoneId) {
      const { data: ms } = await supabaseAdmin.from('payment_milestones').select('boutique_id').eq('id', milestoneId).single()
      if (!ms || ms.boutique_id !== boutiqueId) return new Response('Not found', { status: 404 })
      pdfBytes = await buildReceiptPdf(milestoneId)
      filename = `receipt-${milestoneId.slice(0, 8)}.pdf`
    } else if (eventId) {
      const { data: ev } = await supabaseAdmin.from('events').select('boutique_id').eq('id', eventId).single()
      if (!ev || ev.boutique_id !== boutiqueId) return new Response('Not found', { status: 404 })
      pdfBytes = await buildContractPdf(eventId)
      filename = `contract-${eventId.slice(0, 8)}.pdf`
    } else {
      return new Response('Missing event_id, milestone_id, or quote data', { status: 400 })
    }

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('[pdf]', err)
    return new Response(String(err), { status: 500 })
  }
})
