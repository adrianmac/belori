import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getMissingAppointments, getUrgency } from '../lib/urgency'
import { sendInngestEvent } from '../lib/inngest'
import { useToast } from '../lib/ui.jsx'

function shiftDate(dateStr, days) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function useEvents() {
  const { boutique } = useAuth()
  const toast = useToast()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boutique) return
    fetchEvents()
  }, [boutique?.id])

  useEffect(() => {
    if (!boutique) return
    const channel = supabase
      .channel('events-rt-' + boutique.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: 'boutique_id=eq.' + boutique.id }, () => fetchEvents())
      .subscribe()
    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [boutique?.id])

  async function fetchEvents() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          client:clients(id, name, phone, email),
          coordinator:boutique_members(id, name),
          services:event_services(service_type),
          milestones:payment_milestones(id, label, amount, due_date, paid_date, status)
        `)
        .eq('boutique_id', boutique.id)
        .order('event_date', { ascending: true })

      if (error) {
        console.error(error)
        toast('Failed to load events', 'error')
      } else if (data) {
        setEvents(data.map(normalizeEvent))
      }
    } catch (err) {
      console.error(err)
      toast('Network error loading events', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function createEvent(payload) {
    // Strip non-column fields (handled separately or logic-only)
    const {
      services,
      milestones,
      dress_id,
      alterationData,
      isNewClient,
      newClientData,
      event_name,
      ...eventData
    } = payload

    // event_name is display-only (no 'name' column in events table) — already stripped above

    // If creating a new client, insert them first
    let clientId = eventData.client_id
    if (isNewClient && newClientData?.name) {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({ ...newClientData, boutique_id: boutique.id })
        .select()
        .single()
      if (clientError) return { error: clientError }
      if (newClient) clientId = newClient.id
    }

    const { data: event, error } = await supabase
      .from('events')
      .insert({ ...eventData, client_id: clientId, boutique_id: boutique.id })
      .select()
      .single()

    if (error) return { error }

    if (alterationData && event?.id) {
      const { garment, price, notes: altNotes, deadline, seamstress_id } = alterationData
      await supabase.from('alteration_jobs').insert({
        boutique_id: boutique.id,
        client_id: clientId || null,
        event_id: event.id,
        garment: garment || '',
        status: 'pending',
        price: price ? Number(price) : null,
        notes: altNotes || null,
        deadline: deadline || null,
        seamstress_id: seamstress_id || null,
      })
    }

    // Insert services
    if (services?.length) {
      await supabase.from('event_services').insert(
        services.map(s => ({ event_id: event.id, boutique_id: boutique.id, service_type: s }))
      )
    }

    // Insert payment milestones
    if (milestones?.length) {
      await supabase.from('payment_milestones').insert(
        milestones.map(m => ({
          event_id: event.id,
          boutique_id: boutique.id,
          label: m.label,
          amount: m.amount,
          due_date: m.due,
          status: 'pending',
        }))
      )
    }

    await fetchEvents()

    // Retrieve full client data if we just created them
    let clientEmail = eventData.client?.email || newClientData?.email;
    let clientName = eventData.client?.name || newClientData?.name;
    
    if (!clientEmail && clientId) {
      const { data: cData } = await supabase.from('clients').select('name, email').eq('id', clientId).single()
      if (cData) {
        clientEmail = cData.email
        clientName = cData.name
      }
    }

    if (clientEmail && event.portal_token) {
      const portalUrl = `${window.location.origin}/portal/${event.portal_token}`
      const { data: { session: emailSession } } = await supabase.auth.getSession()
      await supabase.functions.invoke('send-email', {
        body: {
          to: clientEmail,
          subject: `Your Client Portal for ${boutique.name}`,
          html: `<p>Hi ${clientName?.split(' ')[0] || 'there'},</p><p>We are thrilled to be working with you! You can access your client portal to view your invoices, contracts, and event details here:</p><p><a href="${portalUrl}">${portalUrl}</a></p>`
        },
        headers: { Authorization: `Bearer ${emailSession?.access_token}` },
      })
    }

    return { data: event }
  }

  async function updateEvent(id, updates) {
    // Optimistic update
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))

    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)

    if (error) {
      // Rollback
      await fetchEvents()
    } else {
      // Still refetch to get normalized data (milestones etc)
      await fetchEvents()
      // Fire automation: post-event review request
      if (updates.status === 'completed') {
        sendInngestEvent('belori/event.completed', {
          event_id: id,
          boutique_id: boutique.id,
        })
      }
    }
    return { error }
  }

  async function duplicateEvent(eventId) {
    const { data: orig, error: fetchErr } = await supabase
      .from('events')
      .select('*, services:event_services(service_type)')
      .eq('id', eventId)
      .eq('boutique_id', boutique.id)
      .single()
    if (fetchErr || !orig) return { error: fetchErr || new Error('Event not found') }

    // Strip non-column fields before inserting; clear client, date, paid
    const { id, created_at, updated_at, services, milestones, client, coordinator, last_reminder_sent_at, ...fields } = orig
    const { data: copy, error } = await supabase
      .from('events')
      .insert({
        ...fields,
        event_date: null,
        client_id: null,
        total: 0,
        paid: 0,
        status: 'draft',
        boutique_id: boutique.id,
      })
      .select()
      .single()
    if (error) return { error }

    // Copy event_services
    if (orig.services?.length) {
      await supabase.from('event_services').insert(
        orig.services.map(s => ({ event_id: copy.id, boutique_id: boutique.id, service_type: s.service_type }))
      )
    }

    // Copy payment_milestones as templates (clear due_date, paid_date, set status='pending')
    const { data: origMilestones } = await supabase
      .from('payment_milestones')
      .select('label, amount')
      .eq('event_id', eventId)
      .eq('boutique_id', boutique.id)
    if (origMilestones?.length) {
      await supabase.from('payment_milestones').insert(
        origMilestones.map(m => ({
          event_id: copy.id,
          boutique_id: boutique.id,
          label: m.label,
          amount: m.amount,
          due_date: null,
          paid_date: null,
          status: 'pending',
        }))
      )
    }

    // Copy tasks (reset done state)
    const { data: origTasks } = await supabase
      .from('tasks')
      .select('text, category, alert')
      .eq('event_id', eventId)
      .eq('boutique_id', boutique.id)
    if (origTasks?.length) {
      await supabase.from('tasks').insert(
        origTasks.map(t => ({
          event_id: copy.id,
          boutique_id: boutique.id,
          text: t.text,
          category: t.category,
          alert: t.alert,
          done: false,
        }))
      )
    }

    // Copy appointments as shells (clear date/time, reset to 'scheduled')
    const { data: origAppts } = await supabase
      .from('appointments')
      .select('type, staff_id, note')
      .eq('event_id', eventId)
      .eq('boutique_id', boutique.id)
    if (origAppts?.length) {
      await supabase.from('appointments').insert(
        origAppts.map(a => ({
          event_id: copy.id,
          boutique_id: boutique.id,
          type: a.type,
          staff_id: a.staff_id || null,
          note: a.note || null,
          date: null,
          time: null,
          status: 'scheduled',
        }))
      )
    }

    // Copy decoration / inventory assignments
    const { data: origDeco } = await supabase
      .from('event_inventory')
      .select('inventory_id, quantity, notes, setup_time, placement, color_notes')
      .eq('event_id', eventId)
      .eq('boutique_id', boutique.id)
    if (origDeco?.length) {
      await supabase.from('event_inventory').insert(
        origDeco.map(d => ({
          event_id: copy.id,
          boutique_id: boutique.id,
          inventory_id: d.inventory_id,
          quantity: d.quantity,
          notes: d.notes || null,
          setup_time: d.setup_time || null,
          placement: d.placement || null,
          color_notes: d.color_notes || null,
        }))
      )
    }

    await fetchEvents()
    return { data: copy }
  }

  async function deleteEvent(id) {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!error) await fetchEvents()
    return { error }
  }

  async function rescheduleEvent(eventId, oldDate, newDate) {
    try {
      const deltaDays = Math.round((new Date(newDate) - new Date(oldDate)) / 86400000)

      // Update event date
      const { error: evErr } = await supabase
        .from('events')
        .update({ event_date: newDate })
        .eq('id', eventId)
        .eq('boutique_id', boutique.id)
      if (evErr) return { error: evErr }

      // Shift unpaid milestones
      const { data: msData } = await supabase
        .from('payment_milestones')
        .select('id, due_date')
        .eq('event_id', eventId)
        .eq('boutique_id', boutique.id)
        .neq('status', 'paid')
      await Promise.all((msData || []).filter(m => m.due_date).map(m =>
        supabase.from('payment_milestones')
          .update({ due_date: shiftDate(m.due_date, deltaDays) })
          .eq('id', m.id)
          .eq('boutique_id', boutique.id)
      ))

      // Shift appointments
      const { data: apptData } = await supabase
        .from('appointments')
        .select('id, date')
        .eq('event_id', eventId)
        .eq('boutique_id', boutique.id)
      await Promise.all((apptData || []).filter(a => a.date).map(a =>
        supabase.from('appointments')
          .update({ date: shiftDate(a.date, deltaDays) })
          .eq('id', a.id)
          .eq('boutique_id', boutique.id)
      ))

      await fetchEvents()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  return { events, loading, createEvent, updateEvent, duplicateEvent, deleteEvent, rescheduleEvent, refetch: fetchEvents }
}

/**
 * makeRescheduleEvent — create a standalone reschedule function bound to a boutique.
 * Use this in components that only need to reschedule (e.g. EventDetail) so they
 * don't have to call useEvents() and create a second real-time subscription.
 */
export function makeRescheduleEvent(boutiqueId) {
  return async function rescheduleEvent(eventId, oldDate, newDate) {
    try {
      const deltaDays = Math.round((new Date(newDate) - new Date(oldDate)) / 86400000)

      const { error: evErr } = await supabase
        .from('events')
        .update({ event_date: newDate })
        .eq('id', eventId)
        .eq('boutique_id', boutiqueId)
      if (evErr) return { error: evErr }

      const { data: msData } = await supabase
        .from('payment_milestones')
        .select('id, due_date')
        .eq('event_id', eventId)
        .eq('boutique_id', boutiqueId)
        .neq('status', 'paid')
      await Promise.all((msData || []).filter(m => m.due_date).map(m =>
        supabase.from('payment_milestones')
          .update({ due_date: shiftDate(m.due_date, deltaDays) })
          .eq('id', m.id)
          .eq('boutique_id', boutiqueId)
      ))

      const { data: apptData } = await supabase
        .from('appointments')
        .select('id, date')
        .eq('event_id', eventId)
        .eq('boutique_id', boutiqueId)
      await Promise.all((apptData || []).filter(a => a.date).map(a =>
        supabase.from('appointments')
          .update({ date: shiftDate(a.date, deltaDays) })
          .eq('id', a.id)
          .eq('boutique_id', boutiqueId)
      ))

      return { error: null }
    } catch (error) {
      return { error }
    }
  }
}

/**
 * autoProgressEvents — call once on Dashboard mount after events have loaded.
 * Silently marks past-due, fully-paid active events as 'completed'.
 * Returns the number of events updated.
 */
export async function autoProgressEvents(events, boutiqueId, supabaseClient) {
  const today = new Date().toISOString().split('T')[0]
  const toComplete = events.filter(e =>
    e.status === 'active' &&
    e.event_date < today &&
    Number(e.paid) >= Number(e.total) &&
    Number(e.total) > 0
  )
  await Promise.all(toComplete.map(e =>
    supabaseClient.from('events')
      .update({ status: 'completed' })
      .eq('id', e.id)
      .eq('boutique_id', boutiqueId)
  ))
  return toComplete.length
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function useEvent(eventId) {
  const { boutique } = useAuth()
  const toast = useToast()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boutique || !eventId) return
    fetchEvent()
  }, [boutique?.id, eventId])

  async function fetchEvent() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          client:clients(*),
          coordinator:boutique_members(id, name, role),
          services:event_services(service_type),
          milestones:payment_milestones(*),
          tasks:tasks(*),
          notes:notes(*, author:boutique_members(id, name, initials, color)),
          appointments:appointments(*, staff:boutique_members(id, name)),
          alteration_jobs(*, work_items:alteration_work_items(id, description)),
          event_inventory(id, inventory_id, quantity, notes, setup_time, placement, color_notes, item:inventory(id, name, sku, category, color, condition, availQty, totalQty, status, notes))
        `)
        .eq('id', eventId)
        .eq('boutique_id', boutique.id)
        .single()

      if (error) {
        console.error(error)
        toast('Failed to load event details', 'error')
      } else if (data) {
        setEvent(normalizeEvent(data))
      }
    } catch (err) {
      console.error(err)
      toast('Network error loading event', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function createAppointment({ type, date, time, notes, note, staff_id = null, force = false }) {
    // Conflict check unless caller passed force=true (user clicked "Book anyway")
    if (!force) {
      const { findAppointmentConflicts } = await import('../lib/appointmentConflicts')
      const conflicts = await findAppointmentConflicts({
        boutiqueId: boutique.id,
        date,
        time: time || null,
        staffId: staff_id || null,
        clientId: event?.client_id || null,
      })
      if (conflicts.length > 0) {
        // Surface to caller — caller decides to retry with force:true or abort
        return { error: null, conflicts }
      }
    }

    const { error } = await supabase.from('appointments').insert({
      event_id: eventId,
      boutique_id: boutique.id,
      type,
      date,
      time: time || null,
      note: note || notes || null,
      staff_id,
      status: 'scheduled',
    })
    if (!error) {
      await fetchEvent()
      // Fire-and-forget confirmation SMS if client has opted in
      const clientId = event?.client_id
      const commPrefs = event?.clientData?.comm_prefs || {}
      if (clientId && commPrefs.sms !== false) {
        const firstName = event?.clientData?.name?.split(' ')[0] || 'there'
        const timeStr = time ? ` at ${formatTime(time)}` : ''
        supabase.functions.invoke('send-sms', {
          body: {
            client_id: clientId,
            message: `Hi ${firstName}, your ${type.replace(/_/g,' ')} appointment at ${boutique.name} is confirmed for ${date}${timeStr}. Reply STOP to opt out.`,
          },
        }).catch(() => {}) // fire and forget — don't block
      }
    }
    return { error, conflicts: [] }
  }

  async function toggleService(serviceType) {
    const isActive = event?.services?.includes(serviceType)
    if (isActive) {
      await supabase.from('event_services')
        .delete()
        .eq('event_id', eventId)
        .eq('boutique_id', boutique.id)
        .eq('service_type', serviceType)
    } else {
      await supabase.from('event_services')
        .insert({ event_id: eventId, boutique_id: boutique.id, service_type: serviceType })
    }
    await fetchEvent()
  }

  async function addDecoItem(inventoryId, quantity = 1, notes = null) {
    const { error } = await supabase.from('event_inventory').insert({
      event_id: eventId,
      boutique_id: boutique.id,
      inventory_id: inventoryId,
      quantity,
      notes: notes || null,
    })
    if (!error) await fetchEvent()
    return { error }
  }

  async function removeDecoItem(eventInventoryId) {
    const { error } = await supabase.from('event_inventory').delete()
      .eq('id', eventInventoryId)
      .eq('boutique_id', boutique.id)
    if (!error) await fetchEvent()
    return { error }
  }

  async function updateDecoItem(eventInventoryId, { quantity, notes, setup_time, placement, color_notes }) {
    const { error } = await supabase.from('event_inventory').update({
      quantity: quantity != null ? Number(quantity) : undefined,
      notes: notes ?? null,
      setup_time: setup_time || null,
      placement: placement || null,
      color_notes: color_notes || null,
    }).eq('id', eventInventoryId).eq('boutique_id', boutique.id)
    if (!error) await fetchEvent()
    return { error }
  }

  return { event, loading, refetch: fetchEvent, createAppointment, toggleService, addDecoItem, removeDecoItem, updateDecoItem }
}

function normalizeEvent(e) {
  if (!e.event_date) {
    return {
      ...e,
      client: e.client?.name || 'Unknown',
      date: '—',
      daysUntil: 9999,
      overdue: 0,
      services: (e.services || []).map(s => s.service_type),
      milestones: e.milestones || [],
      missingAppointments: [],
      urgency: 'normal',
    }
  }

  const services = (e.services || []).map(s => s.service_type)

  const today = new Date()
  const eventDate = new Date(e.event_date)
  const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24))

  // Compute milestone status from due_date (not stored in DB as 'overdue')
  const milestones = (e.milestones || []).map(m => {
    const due = m.due_date ? new Date(m.due_date) : null
    const status = m.status === 'paid' ? 'paid' : (due && due < today ? 'overdue' : 'pending')
    const daysLate = status === 'overdue' && due ? Math.ceil((today - due) / (1000 * 60 * 60 * 24)) : 0
    return { ...m, status, daysLate }
  })
  const overdue = milestones
    .filter(m => m.status === 'overdue')
    .reduce((sum, m) => sum + Number(m.amount), 0)

  // First active alteration job for this event
  const alteration = (e.alteration_jobs || [])[0] || null

  // Inspiration — only populated if any field has data
  const inspiration = (e.inspiration_colors?.length || e.inspiration_styles?.length || e.inspiration_notes || e.inspiration_florals)
    ? {
        colors: e.inspiration_colors || [],
        themes: e.inspiration_styles || [],
        vision: e.inspiration_notes || '',
        florals: e.inspiration_florals || '',
      }
    : null

  // Normalize event_inventory rows into shape the deco section expects
  const event_inventory = (e.event_inventory || []).map(ei => ({
    id: ei.id,
    inventory_id: ei.inventory_id,
    qty: ei.quantity,
    notes: ei.notes,
    setup_time: ei.setup_time,
    placement: ei.placement,
    color_notes: ei.color_notes,
    name: ei.item?.name || '',
    sku: ei.item?.sku || '',
    available: ei.item?.availQty ?? 999,
    totalQty: ei.item?.totalQty,
    category: ei.item?.category,
    color: ei.item?.color,
    condition: ei.item?.condition,
    itemNotes: ei.item?.notes,
    itemStatus: ei.item?.status,
  }))

  const partial = {
    ...e,
    services,
    milestones,
    overdue,
    daysUntil,
    alteration,
    inspiration,
    event_inventory,
    date: eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    client: typeof e.client === 'string' ? e.client : (e.client?.name || ''),
    clientData: e.client || null,
    venue: e.venue || '',
    coordinator: e.coordinator?.name || '',
    total: Number(e.total),
    paid: Number(e.paid),
    appointments: e.appointments || [],
  }
  const missingAppointments = getMissingAppointments(partial)
  return { ...partial, missingAppointments, urgency: getUrgency({ ...partial, missingAppointments }) }
}
