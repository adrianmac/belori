import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useWaitlist() {
  const { boutique } = useAuth()
  const [waitlist, setWaitlist] = useState([])
  const [loading, setLoading] = useState(false)

  async function fetchWaitlist() {
    if (!boutique) return
    setLoading(true)
    const { data } = await supabase
      .from('waitlist')
      .select('*')
      .eq('boutique_id', boutique.id)
      .in('status', ['waiting', 'contacted'])
      .order('created_at', { ascending: true })
    setWaitlist(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchWaitlist() }, [boutique?.id])

  async function addToWaitlist(entry) {
    const { error } = await supabase.from('waitlist').insert({ ...entry, boutique_id: boutique.id })
    if (!error) fetchWaitlist()
    return { error }
  }

  async function updateWaitlistEntry(id, updates) {
    const { error } = await supabase.from('waitlist').update(updates).eq('id', id).eq('boutique_id', boutique.id)
    if (!error) fetchWaitlist()
    return { error }
  }

  async function markContacted(id) {
    return updateWaitlistEntry(id, { status: 'contacted', contacted_at: new Date().toISOString() })
  }

  async function markBooked(id, event_id) {
    return updateWaitlistEntry(id, { status: 'booked', converted_event_id: event_id || null })
  }

  async function removeFromWaitlist(id) {
    return updateWaitlistEntry(id, { status: 'removed' })
  }

  return { waitlist, loading, addToWaitlist, updateWaitlistEntry, markContacted, markBooked, removeFromWaitlist }
}
