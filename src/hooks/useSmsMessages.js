import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useSmsMessages(clientId) {
  const { boutique } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boutique || !clientId) return
    fetchMessages()
  }, [boutique?.id, clientId])

  useEffect(() => {
    if (!boutique || !clientId) return
    const channel = supabase
      .channel('sms-messages-rt-' + clientId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sms_messages',
        filter: 'client_id=eq.' + clientId,
      }, () => fetchMessages())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [boutique?.id, clientId])

  async function fetchMessages() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('boutique_id', boutique.id)
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })

    if (!error && data) setMessages(data)
    setLoading(false)
  }

  async function sendSms(body) {
    if (!body?.trim()) return

    // Insert outbound record with status='sending'
    const { data: inserted, error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        boutique_id: boutique.id,
        client_id: clientId,
        direction: 'outbound',
        body: body.trim(),
        status: 'sending',
      })
      .select()
      .single()

    if (insertError || !inserted) {
      await fetchMessages()
      return { error: insertError }
    }

    // Optimistically update local state
    setMessages(prev => [...prev, inserted])

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('send-sms', {
        body: { client_id: clientId, message: body.trim() },
      })

      if (fnError) throw fnError

      // Update status to 'sent'
      await supabase
        .from('sms_messages')
        .update({ status: 'sent', twilio_sid: fnData?.sid || null })
        .eq('id', inserted.id)
        .eq('boutique_id', boutique.id)
    } catch (err) {
      // Update status to 'failed'
      await supabase
        .from('sms_messages')
        .update({ status: 'failed' })
        .eq('id', inserted.id)
        .eq('boutique_id', boutique.id)
    }

    await fetchMessages()
  }

  return { messages, loading, sendSms }
}
