import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useBoutique() {
  const { boutique } = useAuth()
  const [saving, setSaving] = useState(false)

  async function updateBoutique(updates) {
    if (!boutique) return { error: new Error('No boutique') }
    const ALLOWED_FIELDS = [
      'name', 'phone', 'email', 'address', 'instagram', 'booking_url', 'website',
      'logo_url', 'color', 'currency', 'timezone', 'language',
      'receipt_footer', 'receipt_header', 'receipt_show_logo',
      'automations', 'calendar_feed_token',
      'appointment_duration', 'booking_buffer',
      'city', 'state', 'zip', 'country',
      'display_mode', 'sidebar_collapsed',
    ]
    const safe = Object.fromEntries(
      Object.entries(updates).filter(([k]) => ALLOWED_FIELDS.includes(k))
    )
    if (Object.keys(safe).length === 0) return { error: null }
    setSaving(true)
    const { error } = await supabase
      .from('boutiques')
      .update(safe)
      .eq('id', boutique.id)
    setSaving(false)
    return { error }
  }

  async function getStaff() {
    const { data, error } = await supabase
      .from('boutique_members')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('role', { ascending: true })
    return { data: data || [], error }
  }

  async function updateStaffMember(memberId, updates) {
    const { error } = await supabase
      .from('boutique_members')
      .update(updates)
      .eq('id', memberId)
      .eq('boutique_id', boutique.id)
    return { error }
  }

  async function sendInvite(email, role) {
    const { data, error } = await supabase.rpc('send_invite', { p_email: email, p_role: role })
    if (error) return { error }
    if (data?.error) return { error: new Error(data.error) }
    return { token: data.token }
  }

  async function getPendingInvites() {
    const { data, error } = await supabase
      .from('boutique_invites')
      .select('*')
      .eq('boutique_id', boutique.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    return { data: data || [], error }
  }

  async function cancelInvite(inviteId) {
    const { error } = await supabase
      .from('boutique_invites')
      .delete()
      .eq('id', inviteId)
      .eq('boutique_id', boutique.id)
    return { error }
  }

  return { boutique, saving, updateBoutique, getStaff, updateStaffMember, sendInvite, getPendingInvites, cancelInvite }
}
