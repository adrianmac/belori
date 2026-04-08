import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useCommissions() {
  const { boutique } = useAuth()
  const [records, setRecords] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRecords = useCallback(async () => {
    if (!boutique) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('commission_records')
      .select(`
        *,
        events (
          type,
          event_date,
          client_id,
          clients ( name )
        )
      `)
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })
    if (err) { setError(err); setLoading(false); return }
    setRecords(data || [])
    setLoading(false)
  }, [boutique?.id])

  const fetchStaff = useCallback(async () => {
    if (!boutique) return
    const { data } = await supabase
      .from('boutique_members')
      .select('id, user_id, name, initials, color, commission_rate')
      .eq('boutique_id', boutique.id)
      .order('name')
    setStaff(data || [])
  }, [boutique?.id])

  useEffect(() => {
    fetchRecords()
    fetchStaff()
  }, [fetchRecords, fetchStaff])

  // Realtime subscription
  useEffect(() => {
    if (!boutique) return
    const channel = supabase
      .channel('commission-records-rt-' + boutique.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'commission_records',
        filter: 'boutique_id=eq.' + boutique.id,
      }, () => fetchRecords())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [boutique?.id, fetchRecords])

  const createRecord = useCallback(async (payload) => {
    const { data, error: err } = await supabase
      .from('commission_records')
      .insert([{ ...payload, boutique_id: boutique.id }])
      .select()
      .single()
    if (err) throw err
    await fetchRecords()
    return data
  }, [boutique?.id, fetchRecords])

  const updateRecord = useCallback(async (id, updates) => {
    const { error: err } = await supabase
      .from('commission_records')
      .update(updates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (err) throw err
    await fetchRecords()
  }, [boutique?.id, fetchRecords])

  const markPaid = useCallback(async (id) => {
    const { error: err } = await supabase
      .from('commission_records')
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (err) throw err
    await fetchRecords()
  }, [boutique?.id, fetchRecords])

  const deleteRecord = useCallback(async (id) => {
    const { error: err } = await supabase
      .from('commission_records')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (err) throw err
    await fetchRecords()
  }, [boutique?.id, fetchRecords])

  const updateStaffRate = useCallback(async (memberId, rate) => {
    const { error: err } = await supabase
      .from('boutique_members')
      .update({ commission_rate: rate })
      .eq('id', memberId)
      .eq('boutique_id', boutique.id)
    if (err) throw err
    await fetchStaff()
  }, [boutique?.id, fetchStaff])

  return {
    records, staff, loading, error,
    createRecord, updateRecord, markPaid, deleteRecord,
    updateStaffRate, refetch: fetchRecords,
  }
}
