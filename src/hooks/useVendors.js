import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useVendors() {
  const { boutique } = useAuth()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!boutique) return
    fetchVendors()
  }, [boutique?.id])

  useEffect(() => {
    if (!boutique) return
    const channel = supabase
      .channel('vendors-rt-' + boutique.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors', filter: 'boutique_id=eq.' + boutique.id }, () => fetchVendors())
      .subscribe()
    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [boutique?.id])

  async function fetchVendors() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('vendors')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('name', { ascending: true })
    if (err) setError(err.message)
    else setVendors(data || [])
    setLoading(false)
  }

  async function createVendor(payload) {
    const { data, error: err } = await supabase
      .from('vendors')
      .insert({ ...payload, boutique_id: boutique.id })
      .select()
      .single()
    if (err) return { error: err }
    setVendors(v => [...v, data])
    return { data }
  }

  async function updateVendor(id, updates) {
    const { data, error: err } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)
      .select()
      .single()
    if (err) return { error: err }
    setVendors(v => v.map(x => x.id === id ? data : x))
    return { data }
  }

  async function deleteVendor(id) {
    const { error: err } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (err) return { error: err }
    setVendors(v => v.filter(x => x.id !== id))
    return {}
  }

  return { vendors, loading, error, createVendor, updateVendor, deleteVendor }
}
