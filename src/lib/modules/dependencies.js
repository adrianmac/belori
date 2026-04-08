// src/lib/modules/dependencies.js
// Validate enable/disable operations against the dependency graph.

import { MODULE_REGISTRY } from './registry'

/**
 * Check whether all dependencies for `moduleId` are currently enabled.
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateEnableModule(moduleId, currentlyEnabled) {
  const def = MODULE_REGISTRY.find(m => m.id === moduleId)
  if (!def) return { valid: false, missing: [] }
  const missing = def.dependencies.filter(dep => !currentlyEnabled.has(dep))
  return { valid: missing.length === 0, missing }
}

/**
 * Check whether disabling `moduleId` would break other enabled modules.
 * @returns {{ valid: boolean, blocking: string[] }}
 */
export function validateDisableModule(moduleId, currentlyEnabled) {
  const blocking = MODULE_REGISTRY
    .filter(m => m.dependencies.includes(moduleId) && currentlyEnabled.has(m.id))
    .map(m => m.name)
  return { valid: blocking.length === 0, blocking }
}

/** Human-readable dependency warning strings for the UI. */
export const DEPENDENCY_WARNINGS = {
  client_portal:   'Requires Events, Clients & CRM, and E-signatures',
  appt_booking:    'Requires Events and Staff scheduling',
  floorplan:       'Requires Decoration & inventory',
  accounting:      'Requires Expense tracking',
  waitlist:        'Requires Events and Appointment booking',
  retail:          'Requires Point of sale',
  dress_catalog:   'Requires Dress rental',
  measurements:    'Requires Alterations',
  email_marketing: 'Requires Clients & CRM and SMS compliance',
}
