import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../lib/ui.jsx'

// Derive tier from loyalty_points
function getTier(points = 0) {
  if (points >= 5000) return 'diamond'
  if (points >= 3000) return 'vip'
  if (points >= 1500) return 'loyal'
  if (points >= 500)  return 'regular'
  return 'new'
}

// Enrich raw client rows with computed display fields
function normalizeClient(c) {
  const events      = c.events || []
  const pts         = Number(c.loyalty_points || 0)
  const totalEvents = events.length
  const totalSpent  = events.reduce((s, e) => s + Number(e.total || 0), 0)
  const hasOverdue  = events.some(
    e => !['completed', 'cancelled'].includes(e.status) &&
         Number(e.paid || 0) < Number(e.total || 0)
  )
  return {
    ...c,
    loyalty_points: pts,
    tier:           getTier(pts),
    totalEvents,
    totalSpent,
    hasOverdue,
  }
}

export function useClients() {
  const { boutique } = useAuth()
  const toast = useToast()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boutique) return
    fetchClients()
  }, [boutique?.id])

  useEffect(() => {
    if (!boutique) return
    const channel = supabase
      .channel('clients-rt-' + boutique.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: 'boutique_id=eq.' + boutique.id }, () => fetchClients())
      .subscribe()
    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [boutique?.id])

  async function fetchClients() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          last_contacted_at,
          events(id, type, event_date, total, paid, status)
        `)
        .eq('boutique_id', boutique.id)
        .limit(500)
        .order('name', { ascending: true })

      if (error) {
        console.error(error)
        toast('Failed to load clients', 'error')
      } else if (data) {
        setClients(data.map(normalizeClient))
      }
    } catch (err) {
      console.error(err)
      toast('Network error loading clients', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function createClient(payload) {
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...payload, boutique_id: boutique.id })
      .select()
      .single()

    if (!error) await fetchClients()
    return { data, error }
  }

  async function updateClient(id, updates) {
    const { error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)

    if (!error) await fetchClients()
    return { error }
  }

  // Atomic loyalty point adjustment — uses a DB function to avoid
  // read-modify-write races that would corrupt point balances.
  async function _atomicPointsRpc(clientId, delta, type, reason) {
    const { data, error } = await supabase.rpc('adjust_loyalty_points', {
      p_client_id: clientId,
      p_delta:     delta,
      p_type:      type,
      p_reason:    reason || null,
    })
    if (!error) await fetchClients()
    return { error, newTotal: data?.new_total }
  }

  async function adjustLoyaltyPoints(clientId, _newPoints, delta, reason) {
    // _newPoints arg retained for API compatibility but ignored — DB computes atomically
    return _atomicPointsRpc(clientId, delta, 'adjust', reason)
  }

  async function redeemPoints({ client_id, points, note, event_id: _eventId }) {
    // Pre-check balance to surface a friendly error before hitting the DB.
    // The actual deduction is still atomic — GREATEST(0, ...) in the DB function
    // means we can't go negative even if two redeem calls race.
    const { data: cl } = await supabase
      .from('clients')
      .select('loyalty_points')
      .eq('id', client_id)
      .eq('boutique_id', boutique.id)
      .single()

    if ((cl?.loyalty_points || 0) < points) {
      return { error: { message: 'Insufficient points' } }
    }

    const { error, newTotal } = await _atomicPointsRpc(client_id, -points, 'redeem', note || 'Points redeemed')
    return { error, dollarValue: points / 100, newTotal }
  }

  async function adjustPoints({ client_id, delta, note }) {
    await _atomicPointsRpc(client_id, delta, 'adjust', note || 'Manual adjustment')
  }

  // Merge: reassign all data from `removeId` to `keepId`, then delete `removeId`
  async function mergeClients(keepId, removeId, mergedPoints) {
    const tables = [
      { table: 'events',               col: 'client_id' },
      { table: 'alteration_jobs',      col: 'client_id' },
      { table: 'client_interactions',  col: 'client_id' },
      { table: 'client_tasks',         col: 'client_id' },
      { table: 'pipeline_leads',       col: 'client_id' },
      { table: 'loyalty_transactions', col: 'client_id' },
      { table: 'client_tag_assignments',col: 'client_id' },
    ]
    await Promise.all([
      ...tables.map(({ table, col }) =>
        supabase.from(table).update({ [col]: keepId }).eq(col, removeId).eq('boutique_id', boutique.id)
      ),
      supabase.from('inventory').update({ client_id: keepId }).eq('client_id', removeId).eq('boutique_id', boutique.id),
      ...(mergedPoints > 0
        ? [supabase.from('clients').update({ loyalty_points: mergedPoints }).eq('id', keepId).eq('boutique_id', boutique.id)]
        : []),
    ])
    // Delete the removed client after all reassignments complete
    const { error } = await supabase.from('clients').delete().eq('id', removeId).eq('boutique_id', boutique.id)
    if (!error) await fetchClients()
    return { error }
  }

  return { clients, loading, createClient, updateClient, adjustLoyaltyPoints, redeemPoints, adjustPoints, mergeClients, refetch: fetchClients }
}

// ─── CRM: Client interactions (timeline) ─────────────────────────────────────
export function useClientInteractions(clientId) {
  const { boutique } = useAuth()
  const toast = useToast()
  const [interactions, setInteractions] = useState([])

  useEffect(() => {
    if (!boutique || !clientId) return
    fetch()
  }, [boutique?.id, clientId])

  async function fetch() {
    try {
      const { data, error } = await supabase
        .from('client_interactions')
        .select('*')
        .eq('client_id', clientId)
        .eq('boutique_id', boutique.id)
        .order('occurred_at', { ascending: false })
      if (error) {
        console.error(error)
        toast('Failed to load interactions', 'error')
      } else if (data) {
        setInteractions(data)
      }
    } catch (err) {
      console.error(err)
      toast('Network error loading interactions', 'error')
    }
  }

  async function addInteraction(payload) {
    const { error } = await supabase.from('client_interactions').insert({
      ...payload,
      client_id: clientId,
      boutique_id: boutique.id,
    })
    if (!error) {
      await supabase.from('clients').update({ last_contacted_at: new Date().toISOString() }).eq('id', clientId).eq('boutique_id', boutique.id)
      await fetch()
    }
    return { error }
  }

  async function editInteraction(id, newBody) {
    const orig = interactions.find(i => i.id === id)
    const { error } = await supabase.from('client_interactions').update({
      body: newBody,
      edited_at: new Date().toISOString(),
      original_body: orig?.body || null,
    }).eq('id', id).eq('boutique_id', boutique.id)
    if (!error) await fetch()
    return { error }
  }

  return { interactions, addInteraction, editInteraction, refetch: fetch }
}

// ─── CRM: Client tasks ────────────────────────────────────────────────────────
export function useClientTasks(clientId) {
  const { boutique } = useAuth()
  const [clientTasks, setClientTasks] = useState([])

  useEffect(() => {
    if (!boutique || !clientId) return
    fetch()
  }, [boutique?.id, clientId])

  async function fetch() {
    const { data } = await supabase
      .from('client_tasks')
      .select('*')
      .eq('client_id', clientId)
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })
    if (data) setClientTasks(data)
  }

  async function addClientTask(payload) {
    const { error } = await supabase.from('client_tasks').insert({
      ...payload,
      client_id: clientId,
      boutique_id: boutique.id,
    })
    if (!error) await fetch()
    return { error }
  }

  async function toggleClientTask(id, done) {
    const { error } = await supabase.from('client_tasks').update({
      done,
      done_at: done ? new Date().toISOString() : null,
    }).eq('id', id).eq('boutique_id', boutique.id)
    if (!error) await fetch()
    return { error }
  }

  return { clientTasks, addClientTask, toggleClientTask, refetch: fetch }
}

// ─── CRM: Pipeline leads (boutique-wide) ─────────────────────────────────────
export function usePipeline() {
  const { boutique } = useAuth()
  const [pipeline, setPipeline] = useState([])

  useEffect(() => {
    if (!boutique) return
    fetch()
  }, [boutique?.id])

  async function fetch() {
    const { data } = await supabase
      .from('pipeline_leads')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('updated_at', { ascending: false })
    if (data) setPipeline(data)
  }

  async function addLead(payload) {
    const { error } = await supabase.from('pipeline_leads').insert({
      ...payload,
      boutique_id: boutique.id,
    })
    if (!error) await fetch()
    return { error }
  }

  async function moveLead(id, stage, lostReason) {
    const updates = { stage, updated_at: new Date().toISOString() }
    if (lostReason) updates.lost_reason = lostReason
    const { error } = await supabase.from('pipeline_leads').update(updates).eq('id', id).eq('boutique_id', boutique.id)
    if (!error) await fetch()
    return { error }
  }

  return { pipeline, addLead, moveLead, refetch: fetch }
}

// ─── CRM: Client tags ─────────────────────────────────────────────────────────
export function useClientTagsData(clientId) {
  const { boutique } = useAuth()
  const [tagDefs, setTagDefs] = useState([])
  const [clientTagIds, setClientTagIds] = useState([])

  useEffect(() => {
    if (!boutique || !clientId) return
    fetchAll()
  }, [boutique?.id, clientId])

  async function fetchAll() {
    const [defsRes, assignRes] = await Promise.all([
      supabase.from('client_tag_definitions').select('*').eq('boutique_id', boutique.id).order('name'),
      supabase.from('client_tag_assignments').select('tag_id').eq('boutique_id', boutique.id).eq('client_id', clientId),
    ])
    if (defsRes.data) setTagDefs(defsRes.data)
    if (assignRes.data) setClientTagIds(assignRes.data.map(a => a.tag_id))
  }

  async function toggleTag(tagId) {
    const isActive = clientTagIds.includes(tagId)
    if (isActive) {
      await supabase.from('client_tag_assignments').delete()
        .eq('boutique_id', boutique.id).eq('client_id', clientId).eq('tag_id', tagId)
    } else {
      await supabase.from('client_tag_assignments').insert({
        client_id: clientId, tag_id: tagId, boutique_id: boutique.id,
      })
    }
    setClientTagIds(ids => isActive ? ids.filter(id => id !== tagId) : [...ids, tagId])
  }

  async function addTagDef(name, category) {
    const { data, error } = await supabase.from('client_tag_definitions')
      .insert({ name, category, boutique_id: boutique.id })
      .select().single()
    if (!error && data) {
      setTagDefs(d => [...d, data])
      // Auto-assign to current client
      await supabase.from('client_tag_assignments').insert({
        client_id: clientId, tag_id: data.id, boutique_id: boutique.id,
      })
      setClientTagIds(ids => [...ids, data.id])
    }
    return { data, error }
  }

  return { tagDefs, clientTagIds, toggleTag, addTagDef, refetch: fetchAll }
}

// ─── CRM: Client events with milestones ───────────────────────────────────────
export function useClientEvents(clientId) {
  const { boutique } = useAuth()
  const [clientEvents, setClientEvents] = useState(null)

  useEffect(() => {
    if (!boutique || !clientId) return
    fetch()
  }, [boutique?.id, clientId])

  async function fetch() {
    const { data } = await supabase
      .from('events')
      .select('*, milestones:payment_milestones(*)')
      .eq('client_id', clientId)
      .eq('boutique_id', boutique.id)
      .order('event_date', { ascending: false })
    if (data) setClientEvents(data)
  }

  async function markMilestonePaid(milestoneId, { paid_date }) {
    const { error } = await supabase.from('payment_milestones').update({
      status: 'paid',
      paid_date,
    }).eq('id', milestoneId).eq('boutique_id', boutique.id)
    if (!error) await fetch()
    return { error }
  }

  return { clientEvents, markMilestonePaid, refetch: fetch }
}

// ─── Loyalty transaction history ──────────────────────────────────────────────
export function useLoyaltyTransactions(clientId) {
  const { boutique } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boutique || !clientId) return
    fetch()
  }, [boutique?.id, clientId])

  async function fetch() {
    setLoading(true)
    const { data } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('client_id', clientId)
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setTransactions(data)
    setLoading(false)
  }

  return { transactions, loading, refetch: fetch }
}
