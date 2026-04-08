import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useExpenses() {
  const { boutique } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!boutique?.id) return
    fetchExpenses()
  }, [boutique?.id])

  async function fetchExpenses() {
    if (!boutique?.id) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('expenses')
      .select(`
        *,
        event:events(id, type, event_date)
      `)
      .eq('boutique_id', boutique.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else if (data) {
      setExpenses(data)
    }
    setLoading(false)
  }

  async function createExpense(payload) {
    if (!boutique?.id) return { error: new Error('No boutique') }
    const { data, error: err } = await supabase
      .from('expenses')
      .insert({ ...payload, boutique_id: boutique.id })
      .select(`*, event:events(id, type, event_date)`)
      .single()
    if (!err) await fetchExpenses()
    return { data, error: err }
  }

  async function updateExpense(id, updates) {
    if (!boutique?.id) return { error: new Error('No boutique') }
    const { data, error: err } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)
      .select(`*, event:events(id, type, event_date)`)
      .single()
    if (!err) await fetchExpenses()
    return { data, error: err }
  }

  async function deleteExpense(id) {
    if (!boutique?.id) return { error: new Error('No boutique') }
    const { error: err } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!err) await fetchExpenses()
    return { error: err }
  }

  return { expenses, loading, error, createExpense, updateExpense, deleteExpense, refetch: fetchExpenses }
}
