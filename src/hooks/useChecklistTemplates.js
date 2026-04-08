import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useChecklistTemplates() {
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
      .from('checklist_templates')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: true })
    if (data) setTemplates(data)
    setLoading(false)
  }

  async function createTemplate(payload) {
    const { error, data } = await supabase
      .from('checklist_templates')
      .insert({ ...payload, boutique_id: boutique.id })
      .select()
      .single()
    if (!error) await fetchTemplates()
    return { error, data }
  }

  async function updateTemplate(id, updates) {
    const { error } = await supabase
      .from('checklist_templates')
      .update(updates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!error) await fetchTemplates()
    return { error }
  }

  async function deleteTemplate(id) {
    const { error } = await supabase
      .from('checklist_templates')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    if (!error) setTemplates(prev => prev.filter(t => t.id !== id))
    return { error }
  }

  async function applyTemplate(templateId, eventId) {
    const tmpl = templates.find(t => t.id === templateId)
    if (!tmpl || !tmpl.items?.length) return { error: null, count: 0 }
    const rows = tmpl.items.map(item => ({
      boutique_id: boutique.id,
      event_id: eventId,
      text: item.text,
      category: item.category || 'General',
      alert: item.is_alert || false,
      done: false,
    }))
    const { error } = await supabase.from('tasks').insert(rows)
    return { error, count: rows.length }
  }

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate, applyTemplate, refetch: fetchTemplates }
}
