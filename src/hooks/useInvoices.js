import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useInvoices() {
  const { boutique } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!boutique?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, status, total_cents, paid_cents, subtotal_cents, tax_cents, include_tax, notes, sent_at, cancelled_at, created_at,
        client:clients(id, name, phone, email),
        event:events(id, type, event_date)
      `)
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })
    if (data) setInvoices(data)
    setLoading(false)
  }, [boutique?.id])

  useEffect(() => { load() }, [load])

  async function createInvoice({ clientId, eventId, items, includeTax, paymentSchedule, notes }) {
    // Calculate totals
    const subtotalCents = items.reduce((sum, i) => sum + (i.price_cents * i.quantity), 0)
    const taxCents = includeTax ? Math.round(subtotalCents * 0.03) : 0
    const totalCents = subtotalCents + taxCents

    // Generate invoice number
    const { data: numData } = await supabase.rpc('generate_invoice_number', { boutique: boutique.id })
    const invoiceNumber = numData || `INV-${Date.now()}`

    // Insert invoice
    const { data: inv, error } = await supabase.from('invoices').insert({
      boutique_id: boutique.id,
      client_id: clientId,
      event_id: eventId || null,
      invoice_number: invoiceNumber,
      status: 'draft',
      subtotal_cents: subtotalCents,
      tax_cents: taxCents,
      include_tax: includeTax,
      total_cents: totalCents,
      paid_cents: 0,
      notes: notes || null,
    }).select().single()
    if (error) return { data: null, error }

    // Insert items
    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from('invoice_items').insert(
        items.map((item, idx) => ({
          boutique_id: boutique.id,
          invoice_id: inv.id,
          name: item.name,
          name_es: item.name_es || null,
          price_cents: item.price_cents,
          quantity: item.quantity || 1,
          is_custom_amount: item.is_custom_amount || false,
          sort_order: idx,
        }))
      )
      if (itemsErr) return { data: null, error: itemsErr }
    }

    // Insert payment schedule if provided
    if (paymentSchedule?.length > 0) {
      const { error: schedErr } = await supabase.from('invoice_payment_schedule').insert(
        paymentSchedule.map((row, idx) => ({
          boutique_id: boutique.id,
          invoice_id: inv.id,
          label: row.label,
          label_es: row.label_es || null,
          amount_cents: row.amount_cents,
          due_date: row.due_date || null,
          status: 'pending',
          sort_order: idx,
        }))
      )
      if (schedErr) return { data: null, error: schedErr }
    }

    await load()
    return { data: inv, error: null }
  }

  async function getInvoiceDetail(invoiceId) {
    const { data } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(id, name, phone, email),
        event:events(id, type, event_date),
        items:invoice_items(*),
        schedule:invoice_payment_schedule(*),
        payments:invoice_payments(*),
        attachments:invoice_attachments(*),
        card_on_file:client_cards_on_file(*)
      `)
      .eq('id', invoiceId)
      .single()
    return data
  }

  async function recordPayment({ invoiceId, amountCents, method, reference, recordedByName }) {
    // Insert payment record
    await supabase.from('invoice_payments').insert({
      boutique_id: boutique.id,
      invoice_id: invoiceId,
      amount_cents: amountCents,
      method,
      reference: reference || null,
      recorded_by_name: recordedByName || null,
    })

    // Fetch current invoice to update paid_cents and status
    const { data: inv } = await supabase.from('invoices').select('paid_cents, total_cents').eq('id', invoiceId).single()
    const newPaid = (inv?.paid_cents || 0) + amountCents
    const newStatus = newPaid >= (inv?.total_cents || 0) ? 'paid' : 'partially_paid'
    await supabase.from('invoices').update({ paid_cents: newPaid, status: newStatus }).eq('id', invoiceId)

    await load()
  }

  async function markInvoiceSent(invoiceId) {
    await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoiceId)
    await load()
  }

  async function cancelInvoice(invoiceId) {
    await supabase.from('invoices').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', invoiceId)
    await load()
  }

  return { invoices, loading, reload: load, createInvoice, getInvoiceDetail, recordPayment, markInvoiceSent, cancelInvoice }
}
