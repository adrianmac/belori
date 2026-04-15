// src/hooks/useModules.js
// ModuleProvider + useModule / useModules hooks for Phase 6.

import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MODULE_REGISTRY, planAllows } from '../lib/modules/registry'

// Default: every call to isEnabled() returns true so the UI renders
// normally before the provider loads module state from the DB.
const ModuleContext = createContext({
  isEnabled: () => true,
  getModuleConfig: () => ({}),
  planTier: 'starter',
  reload: () => {},
})

export function ModuleProvider({ children }) {
  const { boutique } = useAuth()
  const [enabled, setEnabled] = useState(new Set())
  const [configs, setConfigs] = useState({})   // moduleId → config object
  const [planTier, setPlanTier] = useState('starter')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!boutique) return

    const coreIds = MODULE_REGISTRY.filter(m => m.isCore).map(m => m.id)
    setPlanTier(boutique.plan ?? 'starter')

    supabase
      .from('boutique_modules')
      .select('module_id, config')
      .eq('boutique_id', boutique.id)
      .eq('enabled', true)
      .then(({ data }) => {
        const dbIds = data?.map(r => r.module_id) ?? []
        setEnabled(new Set([...coreIds, ...dbIds]))
        const cfgMap = {}
        data?.forEach(r => { if (r.config) cfgMap[r.module_id] = r.config })
        setConfigs(cfgMap)
      })
  }, [boutique?.id, tick])

  function isEnabled(id) {
    const def = MODULE_REGISTRY.find(m => m.id === id)
    if (!def) return false
    if (def.isCore) return true
    if (!planAllows(planTier, def.plan)) return false
    return enabled.has(id)
  }

  function getModuleConfig(id) {
    return configs[id] ?? {}
  }

  function reload() {
    setTick(t => t + 1)
  }

  return (
    <ModuleContext.Provider value={{ isEnabled, getModuleConfig, planTier, reload }}>
      {children}
    </ModuleContext.Provider>
  )
}

/** Returns true if `moduleId` is enabled for the current boutique. */
export function useModule(moduleId) {
  const { isEnabled } = useContext(ModuleContext)
  return isEnabled(moduleId)
}

/** Returns the full module context: { isEnabled, getModuleConfig, planTier, reload }. */
export function useModules() {
  return useContext(ModuleContext)
}

/**
 * Persist module enable/disable changes to the DB.
 * @param {string}   boutiqueId
 * @param {{ moduleId: string, enabled: boolean }[]} updates
 * @param {string}   staffName   - displayed in the audit columns
 * @param {string}   boutiquePlan - 'starter' | 'growth' | 'pro'
 */
export async function saveModuleSettings(boutiqueId, updates, staffName, boutiquePlan) {
  for (const u of updates) {
    const def = MODULE_REGISTRY.find(m => m.id === u.moduleId)
    if (!def) throw new Error(`Unknown module: ${u.moduleId}`)
    if (def.isCore && !u.enabled) throw new Error(`Cannot disable core module: ${u.moduleId}`)
    if (!planAllows(boutiquePlan, def.plan)) {
      throw new Error(`${def.name} requires the ${def.plan} plan`)
    }
  }

  const now = new Date().toISOString()
  const rows = updates.map(u => ({
    boutique_id:  boutiqueId,
    module_id:    u.moduleId,
    enabled:      u.enabled,
    enabled_at:   u.enabled  ? now : null,
    enabled_by:   u.enabled  ? staffName : null,
    disabled_at:  !u.enabled ? now : null,
    disabled_by:  !u.enabled ? staffName : null,
    updated_at:   now,
    ...(u.config !== undefined ? { config: u.config } : {}),
  }))

  const { error } = await supabase
    .from('boutique_modules')
    .upsert(rows, { onConflict: 'boutique_id,module_id' })

  if (error) throw error
}

/**
 * Persist config for a single module without changing its enabled state.
 * @param {string} boutiqueId
 * @param {string} moduleId
 * @param {object} config
 */
export async function saveModuleConfig(boutiqueId, moduleId, config) {
  const { error } = await supabase
    .from('boutique_modules')
    .update({ config, updated_at: new Date().toISOString() })
    .eq('boutique_id', boutiqueId)
    .eq('module_id', moduleId)
  if (error) throw error
}

/**
 * Seed default-enabled modules when a new boutique is created.
 * Called from the Signup flow after `create_boutique_for_user` RPC.
 */
export async function seedDefaultModules(boutiqueId) {
  const defaults = MODULE_REGISTRY
    .filter(m => m.defaultEnabled)
    .map(m => ({
      boutique_id: boutiqueId,
      module_id:   m.id,
      enabled:     true,
      enabled_at:  new Date().toISOString(),
      enabled_by:  'System (setup)',
    }))

  const { error } = await supabase
    .from('boutique_modules')
    .upsert(defaults, { onConflict: 'boutique_id,module_id' })

  if (error) throw error
}
