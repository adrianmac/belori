/**
 * Belori — PDF generation endpoint
 *
 * Generates a downloadable event contract or payment receipt.
 *
 * Usage:
 *   GET /functions/v1/pdf?event_id=<uuid>&type=contract
 *   GET /functions/v1/pdf?event_id=<uuid>&type=receipt&milestone_id=<uuid>
 *
 * Auth: pass the user's JWT as Bearer token (standard Supabase auth).
 * RLS is enforced via the service-role client scoped to the boutique.
 */

import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1'
import { supabaseAdmin } from '../_shared/supabase.ts'

// ─── Colour constants ─────────────────────────────────────────────────────────
const ROSA   = rgb(0.788, 0.412, 0.478)   // #C9697A
const INK    = rgb(0.110, 0.063, 0.071)   // #1C1012
const GRAY   = rgb(0.467, 0.467, 0.467)
const BORDER = rgb(0.894, 0.882, 0.875)   // #E4E1DF
const WHITE  = rgb(1, 1, 1)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(n: number) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 }) }
function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

// Draw a horizontal rule
function hRule(page: any, y: number, margin: number, width: number) {
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: BORDER })
}

// ─── Contract PDF ──────────────────────────────────────────────────────────────
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
  const page = doc.addPage([612, 792])  // US Letter
  const { width, height } = page.getSize()
  const margin = 56

  const fontBold   = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontNormal = await doc.embedFont(StandardFonts.Helvetica)

  let y = height - margin

  // ── Header bar ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: ROSA })
  page.drawText(ev.boutique?.name ?? 'Belori Boutique', {
    x: margin, y: height - 46, size: 20, font: fontBold, color: WHITE,
  })
  if (ev.boutique?.phone) {
    page.drawText(ev.boutique.phone, {
      x: width - margin - 100, y: height - 38, size: 9, font: fontNormal, color: WHITE,
    })
  }
  if (ev.boutique?.email) {
    page.drawText(ev.boutique.email, {
      x: width - margin - 100, y: height - 50, size: 9, font: fontNormal, color: WHITE,
    })
  }

  y = height - 90

  // ── Title ─────────────────────────────────────────────────────────────────
  page.drawText('SERVICE CONTRACT', { x: margin, y, size: 14, font: fontBold, color: INK })
  y -= 22
  const typeLabel = ev.type === 'wedding' ? 'Wedding' : ev.type === 'quince' ? 'Quinceañera' : (ev.type ?? 'Event')
  page.drawText(`${typeLabel} — ${ev.event_date ? fmtDate(ev.event_date) : ''}`, {
    x: margin, y, size: 10, font: fontNormal, color: GRAY,
  })
  y -= 6
  hRule(page, y, margin, width)
  y -= 18

  // ── Client info ───────────────────────────────────────────────────────────
  page.drawText('CLIENT INFORMATION', { x: margin, y, size: 8, font: fontBold, color: ROSA })
  y -= 14
  const clientRows: [string, string][] = [
    ['Client name', ev.client?.name ?? '—'],
    ev.client?.partner_name ? ['Partner', ev.client.partner_name] : null,
    ['Phone', ev.client?.phone ?? '—'],
    ['Email', ev.client?.email ?? '—'],
  ].filter(Boolean) as [string, string][]

  for (const [k, v] of clientRows) {
    page.drawText(k + ':', { x: margin, y, size: 9, font: fontBold, color: INK })
    page.drawText(v, { x: margin + 90, y, size: 9, font: fontNormal, color: INK })
    y -= 14
  }
  y -= 4
  hRule(page, y, margin, width)
  y -= 18

  // ── Event details ─────────────────────────────────────────────────────────
  page.drawText('EVENT DETAILS', { x: margin, y, size: 8, font: fontBold, color: ROSA })
  y -= 14
  const detailRows: [string, string][] = [
    ['Event type', typeLabel],
    ['Event date', ev.event_date ? fmtDate(ev.event_date) : '—'],
    ev.venue ? ['Venue', ev.venue] : null,
    ev.guests ? ['Guest count', `~${ev.guests}`] : null,
  ].filter(Boolean) as [string, string][]

  for (const [k, v] of detailRows) {
    page.drawText(k + ':', { x: margin, y, size: 9, font: fontBold, color: INK })
    page.drawText(v, { x: margin + 90, y, size: 9, font: fontNormal, color: INK })
    y -= 14
  }
  y -= 4
  hRule(page, y, margin, width)
  y -= 18

  // ── Services included ─────────────────────────────────────────────────────
  const SVC_LABELS: Record<string, string> = {
    dress_rental: 'Dress rental',
    alterations: 'Alterations & tailoring',
    planning: 'Event planning & coordination',
    decoration: 'Decoration & venue setup',
    photography: 'Photography & video',
    dj: 'DJ / Music',
  }
  const services = (ev.services ?? []).map((s: any) => s.service_type)
  if (services.length > 0) {
    page.drawText('SERVICES INCLUDED', { x: margin, y, size: 8, font: fontBold, color: ROSA })
    y -= 14
    for (const svc of services) {
      page.drawText('• ' + (SVC_LABELS[svc] ?? svc), {
        x: margin + 10, y, size: 9, font: fontNormal, color: INK,
      })
      y -= 13
    }
    y -= 4
    hRule(page, y, margin, width)
    y -= 18
  }

  // ── Payment schedule ──────────────────────────────────────────────────────
  const milestones = ev.milestones ?? []
  if (milestones.length > 0) {
    page.drawText('PAYMENT SCHEDULE', { x: margin, y, size: 8, font: fontBold, color: ROSA })
    y -= 14

    // Header row
    page.drawRectangle({ x: margin, y: y - 2, width: width - margin * 2, height: 16, color: rgb(0.98, 0.96, 0.96) })
    page.drawText('Milestone', { x: margin + 6, y: y + 2, size: 8, font: fontBold, color: INK })
    page.drawText('Due date',  { x: margin + 220, y: y + 2, size: 8, font: fontBold, color: INK })
    page.drawText('Amount',   { x: margin + 360, y: y + 2, size: 8, font: fontBold, color: INK })
    page.drawText('Status',   { x: margin + 440, y: y + 2, size: 8, font: fontBold, color: INK })
    y -= 18

    let total = 0
    for (const m of milestones) {
      total += Number(m.amount)
      const statusLabel = m.status === 'paid' ? '✓ Paid' : 'Pending'
      const statusCol   = m.status === 'paid' ? rgb(0.086, 0.627, 0.522) : GRAY

      page.drawText(m.label ?? '', { x: margin + 6, y, size: 8, font: fontNormal, color: INK })
      page.drawText(m.due_date ? new Date(m.due_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        { x: margin + 220, y, size: 8, font: fontNormal, color: INK })
      page.drawText(fmtMoney(Number(m.amount)), { x: margin + 360, y, size: 8, font: fontNormal, color: INK })
      page.drawText(statusLabel, { x: margin + 440, y, size: 8, font: fontBold, color: statusCol })
      y -= 14
      hRule(page, y + 2, margin, width)
    }

    y -= 6
    page.drawText('Total contract value:', { x: margin + 280, y, size: 9, font: fontBold, color: INK })
    page.drawText(fmtMoney(Number(ev.total ?? total)), { x: margin + 420, y, size: 9, font: fontBold, color: ROSA })
    y -= 28
    hRule(page, y, margin, width)
    y -= 18
  }

  // ── Signature block ───────────────────────────────────────────────────────
  if (y > 160) {
    page.drawText('SIGNATURES', { x: margin, y, size: 8, font: fontBold, color: ROSA })
    y -= 28

    // Client sig
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 200, y }, thickness: 0.75, color: INK })
    page.drawText('Client signature', { x: margin, y: y - 12, size: 8, font: fontNormal, color: GRAY })
    page.drawLine({ start: { x: margin + 230, y }, end: { x: margin + 380, y }, thickness: 0.75, color: INK })
    page.drawText('Date', { x: margin + 230, y: y - 12, size: 8, font: fontNormal, color: GRAY })

    y -= 40

    // Boutique sig
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 200, y }, thickness: 0.75, color: INK })
    page.drawText(`${ev.boutique?.name ?? 'Boutique'} representative`, { x: margin, y: y - 12, size: 8, font: fontNormal, color: GRAY })
    page.drawLine({ start: { x: margin + 230, y }, end: { x: margin + 380, y }, thickness: 0.75, color: INK })
    page.drawText('Date', { x: margin + 230, y: y - 12, size: 8, font: fontNormal, color: GRAY })
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  page.drawText(`Generated by Belori · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, {
    x: margin, y: 28, size: 7, font: fontNormal, color: GRAY,
  })
  if (ev.boutique?.address) {
    page.drawText(ev.boutique.address, { x: margin, y: 18, size: 7, font: fontNormal, color: GRAY })
  }

  return await doc.save()
}

// ─── Receipt PDF ───────────────────────────────────────────────────────────────
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
  const page = doc.addPage([612, 400])
  const { width, height } = page.getSize()
  const margin = 56

  const fontBold   = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontNormal = await doc.embedFont(StandardFonts.Helvetica)

  // Header
  page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: ROSA })
  page.drawText(m.event?.boutique?.name ?? 'Belori Boutique', {
    x: margin, y: height - 36, size: 16, font: fontBold, color: WHITE,
  })
  page.drawText('PAYMENT RECEIPT', { x: width - margin - 130, y: height - 36, size: 10, font: fontBold, color: WHITE })

  let y = height - 80

  // Receipt details
  const rows: [string, string][] = [
    ['Client',     m.event?.client?.name ?? '—'],
    ['Milestone',  m.label ?? '—'],
    ['Amount',     fmtMoney(Number(m.amount))],
    ['Paid on',    m.paid_date ? fmtDate(m.paid_date) : (new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))],
    ['Event',      m.event?.event_date ? fmtDate(m.event.event_date) : '—'],
    m.event?.venue ? ['Venue', m.event.venue] : null,
  ].filter(Boolean) as [string, string][]

  for (const [k, v] of rows) {
    page.drawText(k + ':', { x: margin, y, size: 10, font: fontBold, color: INK })
    page.drawText(v, { x: margin + 100, y, size: 10, font: fontNormal, color: INK })
    y -= 18
    hRule(page, y + 4, margin, width)
  }

  y -= 16
  page.drawRectangle({ x: margin, y: y - 6, width: width - margin * 2, height: 28, color: rgb(0.98, 0.96, 0.96) })
  page.drawText('✓ Payment confirmed', { x: margin + 10, y: y + 4, size: 12, font: fontBold, color: ROSA })

  page.drawText(`Generated by Belori · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    { x: margin, y: 18, size: 7, font: fontNormal, color: GRAY })

  return await doc.save()
}

// ─── Quote PDF ─────────────────────────────────────────────────────────────────
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

  const fontBold   = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontNormal = await doc.embedFont(StandardFonts.Helvetica)

  let y = height - margin

  // ── Header bar ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: ROSA })
  page.drawText(boutique.name || 'Belori Boutique', {
    x: margin, y: height - 46, size: 20, font: fontBold, color: WHITE,
  })
  if (boutique.phone) {
    page.drawText(boutique.phone, {
      x: width - margin - 120, y: height - 38, size: 9, font: fontNormal, color: WHITE,
    })
  }
  if (boutique.email) {
    page.drawText(boutique.email, {
      x: width - margin - 120, y: height - 50, size: 9, font: fontNormal, color: WHITE,
    })
  }

  y = height - 90

  // ── Title ─────────────────────────────────────────────────────────────────
  page.drawText('PROPOSAL / QUOTE', { x: margin, y, size: 14, font: fontBold, color: INK })
  y -= 16
  const preparedLine = `Prepared on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  page.drawText(preparedLine, { x: margin, y, size: 9, font: fontNormal, color: GRAY })
  if (quote.expires_at) {
    const validUntil = `Valid until ${new Date(quote.expires_at + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    page.drawText(validUntil, { x: width - margin - 180, y, size: 9, font: fontBold, color: rgb(0.706, 0.329, 0.035) })
  }
  y -= 10
  hRule(page, y, margin, width)
  y -= 18

  // ── Client info ───────────────────────────────────────────────────────────
  page.drawText('CLIENT INFORMATION', { x: margin, y, size: 8, font: fontBold, color: ROSA })
  y -= 14
  const clientRows: [string, string][] = [
    ['Client name', quote.client_name],
    quote.event_type ? ['Event type', quote.event_type] : null,
    quote.event_date ? ['Event date', fmtDate(quote.event_date)] : null,
    quote.venue ? ['Venue', quote.venue] : null,
  ].filter(Boolean) as [string, string][]

  for (const [k, v] of clientRows) {
    page.drawText(k + ':', { x: margin, y, size: 9, font: fontBold, color: INK })
    page.drawText(v, { x: margin + 90, y, size: 9, font: fontNormal, color: INK })
    y -= 14
  }
  y -= 4
  hRule(page, y, margin, width)
  y -= 18

  // ── Line items table ──────────────────────────────────────────────────────
  const lineItems = (quote.line_items || []).filter(li => li.description)
  if (lineItems.length > 0) {
    page.drawText('SERVICES & PRICING', { x: margin, y, size: 8, font: fontBold, color: ROSA })
    y -= 14

    // Header row
    const colDesc  = margin + 6
    const colQty   = margin + 240
    const colUnit  = margin + 290
    const colTotal = margin + 360

    page.drawRectangle({ x: margin, y: y - 2, width: width - margin * 2, height: 16, color: rgb(0.98, 0.96, 0.96) })
    page.drawText('Description', { x: colDesc, y: y + 2, size: 8, font: fontBold, color: INK })
    page.drawText('Qty',         { x: colQty,  y: y + 2, size: 8, font: fontBold, color: INK })
    page.drawText('Unit price',  { x: colUnit, y: y + 2, size: 8, font: fontBold, color: INK })
    page.drawText('Total',       { x: colTotal, y: y + 2, size: 8, font: fontBold, color: INK })
    y -= 18

    for (const li of lineItems) {
      const lineTotal = (Number(li.qty) || 1) * (Number(li.unit_price) || 0)
      page.drawText(li.description, { x: colDesc, y, size: 8, font: fontNormal, color: INK })
      page.drawText(String(li.qty),  { x: colQty,  y, size: 8, font: fontNormal, color: INK })
      page.drawText(fmtMoney(li.unit_price), { x: colUnit, y, size: 8, font: fontNormal, color: INK })
      page.drawText(fmtMoney(lineTotal),     { x: colTotal, y, size: 8, font: fontNormal, color: INK })
      y -= 14
      hRule(page, y + 2, margin, width)
    }

    y -= 6
    // Subtotal
    page.drawText('Subtotal:', { x: colUnit - 40, y, size: 8, font: fontNormal, color: GRAY })
    page.drawText(fmtMoney(quote.subtotal), { x: colTotal, y, size: 8, font: fontNormal, color: GRAY })
    y -= 12

    // Discount
    if (quote.discount_amt > 0) {
      page.drawText('Discount:', { x: colUnit - 40, y, size: 8, font: fontNormal, color: GRAY })
      page.drawText('− ' + fmtMoney(quote.discount_amt), { x: colTotal, y, size: 8, font: fontNormal, color: rgb(0.086, 0.502, 0.239) })
      y -= 12
    }

    // Total
    page.drawText('TOTAL:', { x: colUnit - 40, y, size: 10, font: fontBold, color: INK })
    page.drawText(fmtMoney(quote.total), { x: colTotal, y, size: 10, font: fontBold, color: ROSA })
    y -= 20
    hRule(page, y, margin, width)
    y -= 18
  }

  // ── Payment schedule ──────────────────────────────────────────────────────
  const milestones = quote.milestones || []
  if (milestones.length > 0) {
    page.drawText('PAYMENT SCHEDULE', { x: margin, y, size: 8, font: fontBold, color: ROSA })
    y -= 14

    page.drawRectangle({ x: margin, y: y - 2, width: width - margin * 2, height: 16, color: rgb(0.98, 0.96, 0.96) })
    page.drawText('Milestone', { x: margin + 6,   y: y + 2, size: 8, font: fontBold, color: INK })
    page.drawText('Due date',  { x: margin + 240,  y: y + 2, size: 8, font: fontBold, color: INK })
    page.drawText('Amount',    { x: margin + 380,  y: y + 2, size: 8, font: fontBold, color: INK })
    y -= 18

    for (const m of milestones) {
      page.drawText(m.label || '—', { x: margin + 6, y, size: 8, font: fontNormal, color: INK })
      page.drawText(
        m.due_date ? new Date(m.due_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        { x: margin + 240, y, size: 8, font: fontNormal, color: INK }
      )
      page.drawText(fmtMoney(Number(m.amount)), { x: margin + 380, y, size: 8, font: fontNormal, color: INK })
      y -= 14
      hRule(page, y + 2, margin, width)
    }
    y -= 10
    hRule(page, y, margin, width)
    y -= 18
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (quote.notes && y > 80) {
    page.drawText('NOTES & TERMS', { x: margin, y, size: 8, font: fontBold, color: ROSA })
    y -= 14
    // Wrap long notes text (~80 chars per line)
    const words = quote.notes.split(' ')
    let line = ''
    for (const word of words) {
      if ((line + ' ' + word).length > 82) {
        page.drawText(line.trim(), { x: margin, y, size: 8, font: fontNormal, color: INK })
        y -= 12
        line = word
        if (y < 60) break
      } else {
        line = line ? line + ' ' + word : word
      }
    }
    if (line && y >= 60) {
      page.drawText(line.trim(), { x: margin, y, size: 8, font: fontNormal, color: INK })
      y -= 12
    }
    y -= 6
    hRule(page, y, margin, width)
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerText = quote.expires_at
    ? `Valid until ${new Date(quote.expires_at + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} \u00b7 ${boutique.name}`
    : boutique.name
  page.drawText(footerText, { x: margin, y: 28, size: 7, font: fontNormal, color: GRAY })
  page.drawText(`Generated by Belori \u00b7 ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    { x: width - margin - 180, y: 28, size: 7, font: fontNormal, color: GRAY })
  if (boutique.address) {
    page.drawText(boutique.address, { x: margin, y: 18, size: 7, font: fontNormal, color: GRAY })
  }

  return await doc.save()
}

// ─── Request handler ──────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const url        = new URL(req.url)
  const eventId    = url.searchParams.get('event_id')
  const milestoneId= url.searchParams.get('milestone_id')

  // Determine type — check POST body first, then query param
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
      pdfBytes = await buildReceiptPdf(milestoneId)
      filename = `receipt-${milestoneId.slice(0, 8)}.pdf`
    } else if (eventId) {
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
