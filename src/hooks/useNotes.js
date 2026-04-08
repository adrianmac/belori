import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useNotes(eventId) {
  const { boutique, session } = useAuth()
  const [notes, setNotes] = useState([])

  useEffect(() => {
    if (!boutique || !eventId) return
    fetchNotes()
  }, [boutique?.id, eventId])

  useEffect(() => {
    if (!boutique || !eventId) return
    const channel = supabase
      .channel('notes-rt-' + eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: 'event_id=eq.' + eventId }, () => fetchNotes())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [boutique?.id, eventId])

  async function fetchNotes() {
    const { data } = await supabase
      .from('notes')
      .select(`*, author:boutique_members(id, name, initials, color)`)
      .eq('event_id', eventId)
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })

    if (data) setNotes(data)
  }

  async function addNote(text) {
    // Get current user's member record
    const { data: member } = await supabase
      .from('boutique_members')
      .select('id')
      .eq('boutique_id', boutique.id)
      .eq('user_id', session?.user?.id)
      .maybeSingle()

    const { error } = await supabase
      .from('notes')
      .insert({
        event_id: eventId,
        boutique_id: boutique.id,
        author_id: member?.id || null,
        text,
      })

    if (!error) await fetchNotes()
    return { error }
  }

  return { notes, addNote }
}

export function useTasks(eventId) {
  const { boutique } = useAuth()
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    if (!boutique || !eventId) return
    fetchTasks()
  }, [boutique?.id, eventId])

  useEffect(() => {
    if (!boutique || !eventId) return
    const channel = supabase
      .channel('tasks-rt-' + eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: 'event_id=eq.' + eventId }, () => fetchTasks())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [boutique?.id, eventId])

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('event_id', eventId)
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: true })

    if (data) setTasks(data)
  }

  async function toggleTask(id, done, doneByName) {
    // Optimistically update local state immediately
    const now = new Date().toISOString()
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done, done_at: done ? now : null, done_by_name: done ? (doneByName || null) : null } : t))

    const updates = { done }
    if (done) {
      updates.done_at = now
      if (doneByName) updates.done_by_name = doneByName
    } else {
      updates.done_at = null
      updates.done_by_name = null
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)

    if (error) {
      // Rollback on failure
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !done, done_at: null, done_by_name: null } : t))
    }
    // No refetch needed — state already updated
  }

  async function addTask({ text, category = 'General', priority = 'Normal', assigned_to_id, assigned_to_name, due_date }) {
    // Optimistic insert with temp id
    const tempId = 'temp-' + Date.now()
    const tempTask = {
      id: tempId,
      text,
      category,
      alert: priority === 'Alert (urgent)',
      done: false,
      boutique_id: boutique.id,
      event_id: eventId,
      assigned_to_id: assigned_to_id || null,
      assigned_to_name: assigned_to_name || null,
      due_date: due_date || null,
    }
    setTasks(prev => [...prev, tempTask])

    const insertPayload = {
      event_id: eventId,
      boutique_id: boutique.id,
      text,
      category,
      alert: priority === 'Alert (urgent)',
      done: false,
    }
    if (assigned_to_id) insertPayload.assigned_to_id = assigned_to_id
    if (assigned_to_name) insertPayload.assigned_to_name = assigned_to_name
    if (due_date) insertPayload.due_date = due_date

    const { data: inserted, error } = await supabase.from('tasks').insert(insertPayload).select().single()

    if (error) {
      // Rollback
      setTasks(prev => prev.filter(t => t.id !== tempId))
    } else {
      // Replace temp with real
      setTasks(prev => prev.map(t => t.id === tempId ? inserted : t))
    }
    return { error }
  }

  return { tasks, toggleTask, addTask }
}

export function useAlertTaskCount() {
  const { boutique } = useAuth()
  const [count, setCount] = useState(0)

  function fetchCount() {
    if (!boutique) return
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('boutique_id', boutique.id)
      .eq('alert', true)
      .eq('done', false)
      .then(({ count: c }) => setCount(c || 0))
  }

  useEffect(() => {
    if (!boutique) return
    fetchCount()
  }, [boutique?.id])

  useEffect(() => {
    if (!boutique) return
    const channel = supabase
      .channel('alert-tasks-rt-' + boutique.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: 'boutique_id=eq.' + boutique.id }, () => fetchCount())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [boutique?.id])

  return count
}

export function useAppointmentsToday() {
  const { boutique } = useAuth()
  const [appointments, setAppointments] = useState([])
  const loadRef = useRef(null)

  const load = useCallback(async () => {
    if (!boutique?.id) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('appointments')
      .select('*, event:events(id, type, client:clients(name)), client_name, client_phone')
      .eq('boutique_id', boutique.id)
      .eq('date', today)
      .order('time', { ascending: true, nullsFirst: false })
    if (data) setAppointments(data)
  }, [boutique?.id])

  // Keep ref current so real-time callback always calls latest load
  useEffect(() => { loadRef.current = load }, [load])

  useEffect(() => { load() }, [load])

  // Real-time: update dashboard when any appointment changes today
  useEffect(() => {
    if (!boutique?.id) return
    const channel = supabase
      .channel('appts-today-rt-' + boutique.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: 'boutique_id=eq.' + boutique.id }, () => loadRef.current?.())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [boutique?.id])

  return { appointments, reload: load }
}
