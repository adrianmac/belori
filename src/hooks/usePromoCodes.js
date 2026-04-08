import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function usePromoCodes() {
  const { boutique } = useAuth()
  const [codes, setCodes] = useState([])
  const [uses, setUses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!boutique?.id) return
    setLoading(true)
    setError(null)

    const [{ data: codesData, error: codesErr }, { data: usesData, error: usesErr }] =
      await Promise.all([
        supabase
          .from('promo_codes')
          .select('*')
          .eq('boutique_id', boutique.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('promo_code_uses')
          .select('*, event:events(id, type, event_date)')
          .eq('boutique_id', boutique.id)
          .order('used_at', { ascending: false }),
      ])

    if (codesErr || usesErr) {
      setError(codesErr || usesErr)
    } else {
      setCodes(codesData || [])
      setUses(usesData || [])
    }
    setLoading(false)
  }, [boutique?.id])

  useEffect(() => { load() }, [load])

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async function createCode({
    code, description, discount_type, discount_value,
    max_uses, expires_at, active,
  }) {
    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        boutique_id: boutique.id,
        code: code.trim().toUpperCase(),
        description: description?.trim() || null,
        discount_type,
        discount_value: Number(discount_value),
        max_uses: max_uses ? Number(max_uses) : null,
        expires_at: expires_at || null,
        active: active !== false,
      })
      .select()
      .single()

    if (!error) setCodes(prev => [data, ...prev])
    return { data, error }
  }

  async function updateCode(id, updates) {
    const payload = { ...updates }
    if (payload.code) payload.code = payload.code.trim().toUpperCase()
    if (payload.description !== undefined) payload.description = payload.description?.trim() || null
    if (payload.discount_value !== undefined) payload.discount_value = Number(payload.discount_value)
    if (payload.max_uses !== undefined) payload.max_uses = payload.max_uses ? Number(payload.max_uses) : null
    if (payload.expires_at === '') payload.expires_at = null

    const { data, error } = await supabase
      .from('promo_codes')
      .update(payload)
      .eq('id', id)
      .eq('boutique_id', boutique.id)
      .select()
      .single()

    if (!error) setCodes(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    return { data, error }
  }

  async function deactivateCode(id) {
    return updateCode(id, { active: false })
  }

  async function deleteCode(id) {
    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id)

    if (!error) {
      setCodes(prev => prev.filter(c => c.id !== id))
      setUses(prev => prev.filter(u => u.promo_code_id !== id))
    }
    return { error }
  }

  async function applyCode(codeId, eventId, clientName, discountApplied) {
    // Insert use record
    const { data: useData, error: useErr } = await supabase
      .from('promo_code_uses')
      .insert({
        boutique_id: boutique.id,
        promo_code_id: codeId,
        event_id: eventId || null,
        client_name: clientName || null,
        discount_applied: Number(discountApplied),
      })
      .select('*, event:events(id, type, event_date)')
      .single()

    if (useErr) return { error: useErr }

    // Increment uses_count
    const current = codes.find(c => c.id === codeId)
    const newCount = (current?.uses_count || 0) + 1
    const { error: updateErr } = await supabase
      .from('promo_codes')
      .update({ uses_count: newCount })
      .eq('id', codeId)
      .eq('boutique_id', boutique.id)

    if (!updateErr) {
      setCodes(prev => prev.map(c => c.id === codeId ? { ...c, uses_count: newCount } : c))
      setUses(prev => [useData, ...prev])
    }

    return { data: useData, error: updateErr }
  }

  // ─── DERIVED STATS ─────────────────────────────────────────────────────────

  const totalUses = codes.reduce((sum, c) => sum + (c.uses_count || 0), 0)
  const totalSavings = uses.reduce((sum, u) => sum + Number(u.discount_applied || 0), 0)
  const activeCodes = codes.filter(c => c.active).length

  return {
    codes,
    uses,
    loading,
    error,
    reload: load,
    createCode,
    updateCode,
    deactivateCode,
    deleteCode,
    applyCode,
    stats: { activeCodes, totalUses, totalSavings },
  }
}
