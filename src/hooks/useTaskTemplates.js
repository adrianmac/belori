import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useTaskTemplates() {
  const { boutique } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!boutique) return
    fetchTemplates()
  }, [boutique?.id])

  async function fetchTemplates() {
    setLoading(true)
    const { data } = await supabase
      .from('task_templates')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (data) setTemplates(data)
    setLoading(false)
  }

  async function createTemplate(payload) {
    const { error, data } = await supabase
      .from('task_templates')
      .insert({ ...payload, boutique_id: boutique.id })
      .select()
      .single()
    if (!error) await fetchTemplates()
    return { error, data }
  }

  async function updateTemplate(id, updates) {
    const { error } = await supabase
      .from('task_templates')
      .update(updates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!error) await fetchTemplates()
    return { error }
  }

  async function deleteTemplate(id) {
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!error) setTemplates(prev => prev.filter(t => t.id !== id))
    return { error }
  }

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate }
}
