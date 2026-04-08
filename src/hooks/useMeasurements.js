import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useMeasurements(clientId) {
  const { boutique } = useAuth()
  const [measurements, setMeasurements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!boutique?.id || !clientId) return
    fetchMeasurements()
  }, [boutique?.id, clientId])

  async function fetchMeasurements() {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await supabase
      .from('client_measurements')
      .select('*')
      .eq('boutique_id', boutique.id)
      .eq('client_id', clientId)
      .order('taken_at', { ascending: false })

    if (fetchErr) setError(fetchErr)
    if (data) setMeasurements(data)
    setLoading(false)
  }

  async function createMeasurement(payload) {
    const record = {
      boutique_id: boutique.id,
      client_id: clientId,
      bust: payload.bust != null && payload.bust !== '' ? Number(payload.bust) : null,
      waist: payload.waist != null && payload.waist !== '' ? Number(payload.waist) : null,
      hips: payload.hips != null && payload.hips !== '' ? Number(payload.hips) : null,
      height: payload.height != null && payload.height !== '' ? Number(payload.height) : null,
      shoe_size: payload.shoe_size || null,
      notes: payload.notes || null,
      taken_by_name: payload.taken_by_name || null,
      taken_at: payload.taken_at || new Date().toISOString(),
    }
    const { error } = await supabase.from('client_measurements').insert(record)
    if (!error) await fetchMeasurements()
    return { error }
  }

  async function updateMeasurement(id, payload) {
    const record = {
      bust: payload.bust != null && payload.bust !== '' ? Number(payload.bust) : null,
      waist: payload.waist != null && payload.waist !== '' ? Number(payload.waist) : null,
      hips: payload.hips != null && payload.hips !== '' ? Number(payload.hips) : null,
      height: payload.height != null && payload.height !== '' ? Number(payload.height) : null,
      shoe_size: payload.shoe_size || null,
      notes: payload.notes || null,
      taken_by_name: payload.taken_by_name || null,
    }
    const { error } = await supabase
      .from('client_measurements')
      .update(record)
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!error) await fetchMeasurements()
    return { error }
  }

  async function deleteMeasurement(id) {
    const { error } = await supabase
      .from('client_measurements')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!error) await fetchMeasurements()
    return { error }
  }

  // Legacy alias kept for backward compatibility with measurements tab
  async function saveMeasurement(payload) {
    if (payload.id) {
      return updateMeasurement(payload.id, payload)
    }
    return createMeasurement(payload)
  }

  return { measurements, loading, error, createMeasurement, updateMeasurement, deleteMeasurement, saveMeasurement }
}
