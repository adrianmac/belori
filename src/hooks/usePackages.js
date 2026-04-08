import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function usePackages() {
  const { boutique } = useAuth()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!boutique?.id) return
    setLoading(true)

    // Load packages + usage counts in one go
    const [{ data: pkgs }, { data: usage }] = await Promise.all([
      supabase
        .from('service_packages')
        .select('*')
        .eq('boutique_id', boutique.id)
        .order('sort_order')
        .order('created_at'),
      supabase
        .from('events')
        .select('package_id')
        .eq('boutique_id', boutique.id)
        .not('package_id', 'is', null),
    ])

    // Build usage count map
    const usageMap = {}
    ;(usage || []).forEach(e => {
      usageMap[e.package_id] = (usageMap[e.package_id] || 0) + 1
    })

    setPackages((pkgs || []).map(p => ({ ...p, used: usageMap[p.id] || 0 })))
    setLoading(false)
  }, [boutique?.id])

  useEffect(() => { load() }, [load])

  async function createPackage({ name, description, services, base_price, event_type }) {
    const { data, error } = await supabase
      .from('service_packages')
      .insert({
        boutique_id: boutique.id,
        name: name.trim(),
        description: description?.trim() || '',
        services,
        base_price: Number(base_price),
        event_type: event_type || 'both',
        sort_order: packages.filter(p => p.active).length,
      })
      .select()
      .single()
    if (!error) setPackages(ps => [...ps, { ...data, used: 0 }])
    return { data, error }
  }

  async function updatePackage(id, updates) {
    const payload = { ...updates, updated_at: new Date().toISOString() }
    if (payload.name) payload.name = payload.name.trim()
    if (payload.description !== undefined) payload.description = payload.description.trim()
    if (payload.base_price !== undefined) payload.base_price = Number(payload.base_price)
    const { data, error } = await supabase
      .from('service_packages')
      .update(payload)
      .eq('id', id)
      .eq('boutique_id', boutique.id)
      .select()
      .single()
    if (!error) setPackages(ps => ps.map(p => p.id === id ? { ...p, ...data } : p))
    return { data, error }
  }

  async function archivePackage(id) {
    return updatePackage(id, { active: false })
  }

  async function restorePackage(id) {
    return updatePackage(id, { active: true })
  }

  return { packages, loading, reload: load, createPackage, updatePackage, archivePackage, restorePackage }
}
