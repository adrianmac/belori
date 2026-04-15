import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useAlterations({ enabled = true } = {}) {
  const { boutique } = useAuth()
  const [alterations, setAlterations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boutique || !enabled) return
    fetchAlterations()
  }, [boutique?.id, enabled])

  useEffect(() => {
    if (!boutique || !enabled) return
    const channel = supabase
      .channel('alteration-jobs-rt-' + boutique.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alteration_jobs', filter: 'boutique_id=eq.' + boutique.id }, () => fetchAlterations())
      .subscribe()
    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [boutique?.id, enabled])

  async function fetchAlterations() {
    setLoading(true)
    const { data, error } = await supabase
      .from('alteration_jobs')
      .select(`
        *,
        client:clients(id, name),
        seamstress:boutique_members(id, name),
        event:events(id, event_date, type),
        work_items:alteration_work_items(id, description)
      `)
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })
      // Limit to most recent 300 jobs — older history can be added via a "History" tab
      .limit(300)

    if (!error && data) {
      setAlterations(data.map(job => {
        const today = new Date()
        const deadlineDate = job.deadline ? new Date(job.deadline + 'T12:00:00') : null
        const eventDate = job.event ? new Date(job.event.event_date) : null
        const refDate = deadlineDate || eventDate
        const daysUntil = refDate
          ? Math.ceil((refDate - today) / (1000 * 60 * 60 * 24))
          : 999
        return {
          ...job,
          daysUntil,
          work: (job.work_items || []).map(w => w.description),
          client: job.client?.name || '',
          client_id: job.client_id || null,
          seamstress: job.seamstress?.name || '',
          seamstress_id: job.seamstress_id || null,
          measurements: job.measurements || {},
          event: job.event
            ? `${job.event.type === 'wedding' ? 'Wedding' : 'Quinceañera'} ${new Date(job.event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : '',
        }
      }))
    }
    setLoading(false)
  }

  async function createJob(payload) {
    const { work_items, ...jobData } = payload
    const { data: job, error } = await supabase
      .from('alteration_jobs')
      .insert({ ...jobData, boutique_id: boutique.id })
      .select()
      .single()

    if (error) return { error }

    if (work_items?.length) {
      await supabase.from('alteration_work_items').insert(
        work_items.map(desc => ({ job_id: job.id, description: desc }))
      )
    }

    await fetchAlterations()
    return { data: job }
  }

  async function updateJob(id, updates) {
    // Strip derived/joined fields that aren't DB columns
    const { work, client, seamstress, daysUntil, event, work_items, ...dbUpdates } = updates
    const { error } = await supabase
      .from('alteration_jobs')
      .update(dbUpdates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)

    if (!error) await fetchAlterations()
    return { error }
  }

  async function cancelJob(id) {
    const { error } = await supabase
      .from('alteration_jobs')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('boutique_id', boutique.id)

    if (!error) await fetchAlterations()
    return { error }
  }

  async function deleteJob(id) {
    // Delete work items first (FK constraint)
    await supabase.from('alteration_work_items').delete().eq('job_id', id)
    const { error } = await supabase
      .from('alteration_jobs')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)

    if (!error) await fetchAlterations()
    return { error }
  }

  async function logTimeEntry(jobId, minutes, note) {
    const { data: job } = await supabase
      .from('alteration_jobs')
      .select('time_entries, total_minutes')
      .eq('id', jobId)
      .eq('boutique_id', boutique.id)
      .single()
    const entries = job?.time_entries || []
    const newEntry = { minutes: Number(minutes), note: note || '', logged_at: new Date().toISOString() }
    const newTotal = (job?.total_minutes || 0) + Number(minutes)
    const { error } = await supabase
      .from('alteration_jobs')
      .update({ time_entries: [...entries, newEntry], total_minutes: newTotal })
      .eq('id', jobId)
      .eq('boutique_id', boutique.id)
    if (!error) await fetchAlterations()
    return { error }
  }

  return { alterations, loading, createJob, updateJob, cancelJob, deleteJob, logTimeEntry, refetch: fetchAlterations }
}
