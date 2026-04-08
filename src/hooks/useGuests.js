import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useGuests(eventId) {
  const { boutique } = useAuth()
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGuests = useCallback(async () => {
    if (!boutique?.id || !eventId) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('event_guests')
      .select('*')
      .eq('event_id', eventId)
      .eq('boutique_id', boutique.id)
      .order('name', { ascending: true })
    if (err) setError(err)
    else setGuests(data || [])
    setLoading(false)
  }, [boutique?.id, eventId])

  useEffect(() => {
    fetchGuests()
  }, [fetchGuests])

  useEffect(() => {
    if (!boutique?.id || !eventId) return
    const channel = supabase
      .channel('guests-rt-' + eventId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_guests',
        filter: 'event_id=eq.' + eventId,
      }, () => fetchGuests())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [boutique?.id, eventId, fetchGuests])

  async function createGuest(fields) {
    if (!boutique?.id || !eventId) return { error: new Error('Missing context') }
    const { data, error: err } = await supabase
      .from('event_guests')
      .insert({ ...fields, boutique_id: boutique.id, event_id: eventId })
      .select()
      .single()
    if (!err && data) setGuests(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return { data, error: err }
  }

  async function updateGuest(id, fields) {
    if (!boutique?.id) return { error: new Error('Missing context') }
    const { data, error: err } = await supabase
      .from('event_guests')
      .update(fields)
      .eq('id', id)
      .eq('boutique_id', boutique.id)
      .select()
      .single()
    if (!err && data) setGuests(prev => prev.map(g => g.id === id ? data : g))
    return { data, error: err }
  }

  async function deleteGuest(id) {
    if (!boutique?.id) return { error: new Error('Missing context') }
    const { error: err } = await supabase
      .from('event_guests')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!err) setGuests(prev => prev.filter(g => g.id !== id))
    return { error: err }
  }

  async function bulkUpdateRsvp(ids, rsvp_status) {
    if (!boutique?.id || !ids.length) return { error: null }
    const { error: err } = await supabase
      .from('event_guests')
      .update({ rsvp_status })
      .in('id', ids)
      .eq('boutique_id', boutique.id)
    if (!err) setGuests(prev => prev.map(g => ids.includes(g.id) ? { ...g, rsvp_status } : g))
    return { error: err }
  }

  return { guests, loading, error, createGuest, updateGuest, deleteGuest, bulkUpdateRsvp }
}
