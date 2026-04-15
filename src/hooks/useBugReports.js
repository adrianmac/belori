import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useBugReports() {
  const { boutique, myRole, session } = useAuth()

  /** Submit a bug report. Returns { error }. */
  async function submitReport({ title, description, category, severity, screenName }) {
    if (!boutique?.id) return { error: { message: 'No boutique' } }

    const ua = navigator.userAgent
    const os = /Windows/.test(ua) ? 'Windows'
             : /Mac OS/.test(ua)   ? 'macOS'
             : /iPhone|iPad/.test(ua) ? 'iOS'
             : /Android/.test(ua)  ? 'Android'
             : /Linux/.test(ua)    ? 'Linux'
             : 'Unknown'

    const payload = {
      boutique_id:   boutique.id,
      boutique_name: boutique.name || '',
      submitted_by:  session?.user?.id ?? null,
      title:         title.trim(),
      description:   description.trim(),
      category,
      severity,
      status:        'new',
      screen_name:   screenName || null,
      user_role:     myRole || null,
      browser_info:  `[${os}] ${ua}`,  // os_info column doesn't exist — embed OS in browser_info
      submitted_at:  new Date().toISOString(),
    }

    const { error } = await supabase.from('bug_reports').insert(payload)
    return { error }
  }

  /** Fetch reports for this boutique (visible to all members via RLS). */
  async function fetchMyReports() {
    if (!boutique?.id) return { data: [], error: null }
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('submitted_at', { ascending: false })
      .limit(200)
    return { data: data || [], error }
  }

  /** Update status + admin notes on a report (owner only). */
  async function updateReport(id, { status, admin_notes }) {
    const updates = {}
    if (status !== undefined) {
      updates.status = status
      if (status === 'fixed' || status === 'wont_fix') {
        updates.resolved_at = new Date().toISOString()
      }
    }
    if (admin_notes !== undefined) updates.admin_notes = admin_notes

    const { error } = await supabase
      .from('bug_reports')
      .update(updates)
      .eq('id', id)
      .eq('boutique_id', boutique.id)
    return { error }
  }

  return { submitReport, fetchMyReports, updateReport }
}
