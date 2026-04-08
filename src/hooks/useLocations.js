import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useLocations() {
  const { boutique } = useAuth()
  const [locations, setLocations] = useState([])
  const [activeLocation, setActiveLocationState] = useState(null)
  const [loading, setLoading] = useState(false)

  async function fetchLocations() {
    if (!boutique) return
    setLoading(true)
    const { data } = await supabase.from('boutique_locations').select('*')
      .eq('boutique_id', boutique.id).eq('active', true)
      .order('is_primary', { ascending: false })
    setLocations(data || [])
    if (data?.length > 0 && !activeLocation) {
      const saved = localStorage.getItem('belori_location')
      const primary = (saved && data.find(l => l.id === saved)) || data.find(l => l.is_primary) || data[0]
      setActiveLocationState(primary)
    }
    setLoading(false)
  }

  useEffect(() => { fetchLocations() }, [boutique?.id])

  async function createLocation(loc) {
    const { error } = await supabase.from('boutique_locations').insert({ ...loc, boutique_id: boutique.id })
    if (!error) fetchLocations()
    return { error }
  }

  async function updateLocation(id, updates) {
    const { error } = await supabase.from('boutique_locations').update(updates).eq('id', id).eq('boutique_id', boutique.id)
    if (!error) fetchLocations()
    return { error }
  }

  async function setPrimary(id) {
    await supabase.from('boutique_locations').update({ is_primary: false }).eq('boutique_id', boutique.id)
    await supabase.from('boutique_locations').update({ is_primary: true }).eq('id', id)
    fetchLocations()
  }

  async function deactivateLocation(id) {
    await supabase.from('boutique_locations').update({ active: false }).eq('id', id).eq('boutique_id', boutique.id)
    fetchLocations()
  }

  // Keep legacy name as alias for backward compatibility
  async function deleteLocation(id) {
    return deactivateLocation(id)
  }

  function setActiveLocation(loc) {
    setActiveLocationState(loc)
    if (loc) localStorage.setItem('belori_location', loc.id)
  }

  return { locations, activeLocation, setActiveLocation, loading, createLocation, updateLocation, setPrimary, deactivateLocation, deleteLocation, fetchLocations }
}
