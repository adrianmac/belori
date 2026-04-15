import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { sendInngestEvent } from '../lib/inngest'

// ─── PAYMENT PLAN GENERATOR ────────────────────────────────────────────────
// Returns array of { label, amount, due_date } ready to pass to createMilestone
export function generatePaymentPlan({ totalAmount, depositAmount, installmentCount, startDate, frequencyDays = 30 }) {
  const deposit = Math.round(Number(depositAmount) * 100) / 100
  const remaining = Math.round((Number(totalAmount) - deposit) * 100) / 100
  const extraCount = Math.max(1, installmentCount - 1) // milestones after deposit
  const baseInstallment = Math.floor((remaining / extraCount) * 100) / 100
  const lastInstallment = Math.round((remaining - baseInstallment * (extraCount - 1)) * 100) / 100

  const milestones = []
  const start = new Date(startDate)

  // Deposit (first milestone)
  milestones.push({
    label: 'Deposit',
    amount: deposit,
    due_date: start.toISOString().slice(0, 10),
  })

  // Remaining installments
  for (let i = 1; i < installmentCount; i++) {
    const dueDate = new Date(start)
    dueDate.setDate(dueDate.getDate() + frequencyDays * i)
    const isLast = i === installmentCount - 1
    milestones.push({
      label: i === installmentCount - 2 && installmentCount > 2
        ? `Installment ${i + 1}`
        : isLast ? 'Final Payment' : `Installment ${i + 1}`,
      amount: isLast ? lastInstallment : baseInstallment,
      due_date: dueDate.toISOString().slice(0, 10),
    })
  }

  return milestones
}

export function usePayments({ enabled = true } = {}) {
  const { boutique } = useAuth()
  const [payments, setPayments] = useState([])
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boutique || !enabled) return
    fetchPayments()
    fetchRefunds()
  }, [boutique?.id, enabled])

  useEffect(() => {
    if (!boutique || !enabled) return
    const channel = supabase
      .channel('payment-milestones-rt-' + boutique.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_milestones', filter: 'boutique_id=eq.' + boutique.id }, () => fetchPayments())
      .subscribe()
    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [boutique?.id, enabled])

  async function fetchRefunds() {
    const { data } = await supabase
      .from('payment_refunds')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('refunded_at', { ascending: false })
      .limit(200) // unbounded refund history grows forever; history > 200 requires dedicated report
    if (data) setRefunds(data)
  }

  async function fetchPayments() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payment_milestones')
        .select(`
          *,
          event:events(id, type, event_date, client_id, client:clients(name, phone))
        `)
        .eq('boutique_id', boutique.id)
        .neq('status', 'paid')
        .order('due_date', { ascending: true })

      if (!error && data) {
        const today = new Date()
        setPayments(data.map(p => {
          const due = p.due_date ? new Date(p.due_date + 'T12:00:00') : null
          const daysLate = due && due < today
            ? Math.ceil((today - due) / (1000 * 60 * 60 * 24))
            : 0
          return {
            ...p,
            status: daysLate > 0 ? 'overdue' : 'pending',
            client: p.event?.client?.name
              ? p.event.client.name.split(' ')[0] + ' ' + (p.event.client.name.split(' ').slice(-1)[0]?.[0] || '') + '.'
              : '',
            clientFull: p.event?.client?.name || '',
            clientPhone: p.event?.client?.phone || '',
            client_id: p.event?.client_id || null,
            event: p.event?.event_date
              ? `${p.event.type === 'wedding' ? 'Wedding' : 'Quinceañera'} ${new Date(p.event.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : '',
            due: due?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '',
            daysLate,
            amount: Number(p.amount),
          }
        }))
      }
    } catch (err) {
      console.error('fetchPayments error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function createMilestone(payload) {
    const { data, error } = await supabase
      .from('payment_milestones')
      .insert({ ...payload, boutique_id: boutique.id })
      .select()
      .single()

    if (!error) await fetchPayments()
    return { data, error }
  }

  async function createMilestones(payloads) {
    const rows = payloads.map(p => ({ ...p, boutique_id: boutique.id }))
    const { data, error } = await supabase
      .from('payment_milestones')
      .insert(rows)
      .select()

    if (!error) await fetchPayments()
    return { data, error }
  }

  async function logRefund({ event_id, milestone_id, amount, reason, refunded_at, void_milestone = false }) {
    const { error } = await supabase.from('payment_refunds').insert({
      boutique_id: boutique.id,
      event_id,
      milestone_id: milestone_id || null,
      amount: Number(amount),
      reason,
      refunded_at: refunded_at || new Date().toISOString().slice(0, 10),
    })
    if (!error) {
      if (void_milestone && milestone_id) {
        await supabase
          .from('payment_milestones')
          .update({ status: 'pending', paid_date: null, last_reminded_at: null })
          .eq('id', milestone_id)
          .eq('boutique_id', boutique.id)
      }

      // Always recalculate event.paid from remaining paid milestones minus all refunds
      const [{ data: allMs }, { data: allRefunds }] = await Promise.all([
        supabase.from('payment_milestones').select('amount, status').eq('event_id', event_id).eq('boutique_id', boutique.id),
        supabase.from('payment_refunds').select('amount').eq('event_id', event_id).eq('boutique_id', boutique.id),
      ])
      if (allMs) {
        const totalPaid = allMs.filter(m => m.status === 'paid').reduce((s, m) => s + Number(m.amount || 0), 0)
        const totalRefunded = (allRefunds || []).reduce((s, r) => s + Number(r.amount || 0), 0)
        await supabase
          .from('events')
          .update({ paid: Math.max(0, totalPaid - totalRefunded) })
          .eq('id', event_id)
          .eq('boutique_id', boutique.id)
      }

      await fetchPayments()
      await fetchRefunds()
    }
    return { error }
  }

  async function logTip({ event_id, amount }) {
    const tipAmt = Number(amount)
    if (!Number.isFinite(tipAmt) || tipAmt <= 0) return { error: { message: 'Invalid tip amount' } }
    const { data: ev } = await supabase.from('events').select('tip,paid').eq('id', event_id).eq('boutique_id', boutique.id).single()
    const { error } = await supabase.from('events').update({
      tip:  (Number(ev?.tip)  || 0) + tipAmt,
      paid: (Number(ev?.paid) || 0) + tipAmt,
    }).eq('id', event_id).eq('boutique_id', boutique.id)
    if (!error) await fetchPayments()
    return { error }
  }

  async function markPaid(id, extra = {}) {
    // Capture before optimistic removal clears it from state
    const payment = payments.find(p => p.id === id)

    // Remove from payments list optimistically (it's the unpaid list)
    setPayments(prev => prev.filter(p => p.id !== id))

    const { error } = await supabase
      .from('payment_milestones')
      .update({
        status: 'paid',
        paid_date: extra.paid_date || new Date().toISOString().split('T')[0],
      })
      .eq('id', id)
      .eq('boutique_id', boutique.id)

    if (error) {
      // Rollback by refetching
      await fetchPayments()
    } else {
      await fetchPayments()

      // Sync the event's paid field by summing all paid milestones
      if (payment?.event_id) {
        const milestoneEventId = payment.event_id

        const { data: allMilestones } = await supabase
          .from('payment_milestones')
          .select('amount, status, paid_date')
          .eq('event_id', milestoneEventId)
          .eq('boutique_id', boutique.id)

        if (allMilestones) {
          const newPaid = allMilestones
            .filter(m => m.status === 'paid')
            .reduce((sum, m) => sum + Number(m.amount || 0), 0)

          const { data: evData } = await supabase
            .from('events')
            .select('id, total, event_date, status')
            .eq('id', milestoneEventId)
            .eq('boutique_id', boutique.id)
            .single()

          if (evData) {
            const updatePayload = { paid: newPaid }
            const isPast = evData.event_date && new Date(evData.event_date + 'T23:59:59') < new Date()
            const isFullyPaid = newPaid >= Number(evData.total || 0) && Number(evData.total || 0) > 0
            if (isPast && isFullyPaid && evData.status === 'active') {
              updatePayload.status = 'completed'
            }
            await supabase
              .from('events')
              .update(updatePayload)
              .eq('id', milestoneEventId)
              .eq('boutique_id', boutique.id)
          }
        }
      }

      // Log payment to client timeline so the method isn't lost
      if (payment?.client_id) {
        const method = extra.payment_method || 'Cash'
        const dateStr = extra.paid_date || new Date().toISOString().split('T')[0]
        await supabase.from('client_interactions').insert({
          boutique_id: boutique.id,
          client_id: payment.client_id,
          type: 'payment',
          title: `Payment received — ${payment.label}`,
          body: `$${Number(payment.amount).toLocaleString()} received via ${method} on ${dateStr}`,
          occurred_at: new Date(dateStr).toISOString(),
        })
      }
    }
    return { error }
  }

  async function logReminder(paymentId) {
    const payment = payments.find(p => p.id === paymentId)
    const now = new Date().toISOString()
    await supabase
      .from('payment_milestones')
      .update({ last_reminded_at: now })
      .eq('id', paymentId)
      .eq('boutique_id', boutique.id)
    if (payment?.client_id) {
      await supabase.from('client_interactions').insert({
        boutique_id: boutique.id,
        client_id: payment.client_id,
        type: 'note',
        title: 'Payment reminder sent',
        body: `Reminder sent for "${payment.label}" — $${Number(payment.amount).toLocaleString()}`,
        occurred_at: now,
      })
    }
    // Fire SMS automation via Inngest
    sendInngestEvent('belori/payment.due_soon', {
      milestone_id: paymentId,
      boutique_id: boutique.id,
    })
    await fetchPayments()
  }

  async function deleteMilestone(id) {
    const { error } = await supabase
      .from('payment_milestones')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!error) await fetchPayments()
    return { error }
  }

  return { payments, refunds, loading, createMilestone, createMilestones, markPaid, logReminder, deleteMilestone, logRefund, logTip, refetch: fetchPayments }
}
