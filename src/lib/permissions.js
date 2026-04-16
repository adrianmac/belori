/**
 * Belori — Role-based permissions
 *
 * Roles: owner | coordinator | front_desk | seamstress | decorator
 *
 * canAccess(role, pageId)         → bool — controls sidebar visibility + page rendering
 * canAccessSettingsTab(role, tab) → bool — controls which Settings tabs are visible
 */

const PERMISSIONS = {
  owner: {
    pages: null, // null = all pages
    settingsTabs: new Set(['profile','staff','automations','packages','all_templates','modules','billing','webhooks','bookings','integrations','display','data']),
  },
  coordinator: {
    pages: new Set([
      'dashboard','calendar','schedule','events','event_detail','clients','alterations',
      'inventory','inv_full','payments','settings','planning','reports',
      'measurements','vendors','dress_catalog','fb_beo','floorplan',
      'pos','retail','staff_sched','waitlist','photo_gallery',
      'email_mkt','ticketing','reviews','online_pay','expenses',
      'accounting','wedding_planner','qr_labels','roadmap','my_tasks',
    ]),
    settingsTabs: new Set(['packages','all_templates','display']),
  },
  front_desk: {
    pages: new Set([
      'dashboard','calendar','schedule','events','event_detail','clients','inventory','settings','wedding_planner','roadmap','my_tasks',
    ]),
    settingsTabs: new Set(['display']),
  },
  seamstress: {
    pages: new Set(['dashboard','calendar','schedule','alterations','settings','roadmap','my_tasks']),
    settingsTabs: new Set(['display']),
  },
  decorator: {
    pages: new Set(['dashboard','calendar','schedule','inv_full','inventory','settings','roadmap','my_tasks']),
    settingsTabs: new Set(['display']),
  },
}

/**
 * Returns true if the given role can access the given page/screen ID.
 * Defaults to the most restrictive set if the role is unknown.
 */
export function canAccess(role, pageId) {
  const perms = PERMISSIONS[role] ?? PERMISSIONS.front_desk
  if (perms.pages === null) return true   // owner: all pages
  return perms.pages.has(pageId)
}

/**
 * Returns true if the given role can see the given Settings tab.
 */
export function canAccessSettingsTab(role, tab) {
  const perms = PERMISSIONS[role] ?? PERMISSIONS.front_desk
  return perms.settingsTabs.has(tab)
}

export const ROLE_LABELS = {
  owner:       'Owner',
  coordinator: 'Coordinator',
  front_desk:  'Front Desk',
  seamstress:  'Seamstress',
  decorator:   'Decorator',
}

/** First settings tab this role is allowed to see (for default navigation) */
export function defaultSettingsTab(role) {
  const ALL_TABS = ['profile','staff','automations','packages','all_templates','modules','billing','webhooks','bookings','integrations','display','data']
  return ALL_TABS.find(t => canAccessSettingsTab(role, t)) ?? 'display'
}

/**
 * Returns true if the role can create, edit, or delete records.
 * front_desk / seamstress / decorator are read-only in the UI
 * (server-side RLS enforces this for real, this is UX hygiene).
 */
export function canMutate(role) {
  return role === 'owner' || role === 'coordinator'
}

/**
 * Returns true if the role can manage staff members and invites.
 */
export function canManageStaff(role) {
  return role === 'owner'
}

/**
 * Returns true if the role can access billing settings.
 */
export function canManageBilling(role) {
  return role === 'owner'
}
