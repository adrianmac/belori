// src/lib/modules/registry.js
// Canonical list of all Belori modules.
// isCore: true  → always enabled, cannot be toggled off.
// plan:         'all' | 'growth' | 'pro' — minimum plan required.
// defaultEnabled: seeded as enabled when a boutique is created.

export const MODULE_REGISTRY = [
  // ── CORE ─────────────────────────────────────────────────────────────────
  {
    id: 'events', name: 'Events', category: 'core', plan: 'all',
    defaultEnabled: true, isCore: true, dependencies: [], screen: 'events',
    description: 'Event creation, detail pages, milestones, tasks, and notes.',
    features: ['Event detail page', 'Payment milestones', 'Tasks & notes'],
  },
  {
    id: 'clients', name: 'Clients & CRM', category: 'core', plan: 'all',
    defaultEnabled: true, isCore: true, dependencies: [], screen: 'clients',
    description: 'Client profiles, interaction timeline, pipeline, and tags.',
    features: ['5-tab client detail', 'Interaction timeline', 'Pipeline Kanban'],
  },
  {
    id: 'staff', name: 'Staff & roles', category: 'core', plan: 'all',
    defaultEnabled: true, isCore: true, dependencies: [], screen: 'settings',
    description: 'Staff members, roles, and invite management.',
    features: ['Role management', 'Staff invite', 'Initials & color'],
  },
  {
    id: 'settings', name: 'Settings', category: 'core', plan: 'all',
    defaultEnabled: true, isCore: true, dependencies: [], screen: 'settings',
    description: 'Boutique profile, automations, packages, and display settings.',
    features: ['Boutique profile', 'Automation settings', 'Module manager'],
  },
  // ── SERVICES ─────────────────────────────────────────────────────────────
  {
    id: 'dress_rental', name: 'Dress rental', category: 'services', plan: 'all',
    defaultEnabled: true, isCore: false, dependencies: ['events', 'clients'], screen: 'inventory',
    description: 'Full dress rental lifecycle — reserve, pickup, return, cleaning.',
    features: ['Reserve, pickup, return, cleaning', 'Overdue alerts', 'Return scheduling'],
  },
  {
    id: 'alterations', name: 'Alterations', category: 'services', plan: 'all',
    defaultEnabled: true, isCore: false, dependencies: ['events'], screen: 'alterations',
    description: 'Alteration job management with Kanban board.',
    features: ['Kanban board', 'Work item pricing', 'Garment tracking'],
  },
  {
    id: 'decoration', name: 'Decoration & inventory', category: 'services', plan: 'all',
    defaultEnabled: true, isCore: false, dependencies: ['events'], screen: 'inv_full',
    description: 'Full inventory management for all item categories.',
    features: ['Grid/list/category views', 'Single/quantity/consumable tracking', 'QR codes'],
  },
  {
    id: 'event_planning', name: 'Wedding Planner', category: 'services', plan: 'pro',
    defaultEnabled: false, isCore: false, dependencies: ['events', 'clients'], screen: 'planning',
    description: 'Full-featured wedding planning board — timelines, vendor coordination, run-of-show, and more.',
    features: ['Planning timeline', 'Vendor management', 'Run-of-show builder', 'Guest coordination'],
    comingSoon: true,
  },
  {
    id: 'measurements', name: 'Measurements', category: 'services', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: ['alterations'], screen: 'measurements',
    description: 'Client measurements with comparison to dress on record.',
    features: ['Full measurement profile', 'Dress spec comparison', 'PDF export'],
  },
  {
    id: 'vendors', name: 'Vendor management', category: 'services', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: ['events'], screen: 'vendors',
    description: 'Vendor directory with event assignments and history.',
    features: ['Vendor directory', 'Event assignment', 'Vendor history'],
  },
  {
    id: 'purchase_orders', name: 'Purchase orders', category: 'services', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: ['vendors'], screen: 'purchase_orders',
    description: 'Create and manage purchase orders for vendor stock replenishment.',
    features: ['Draft, send, and receive POs', 'Line item tracking', 'Auto inventory stock update'],
  },
  {
    id: 'dress_catalog', name: 'Dress catalog', category: 'services', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: ['dress_rental'], screen: 'dress_catalog',
    description: 'Public-facing dress catalog for client browsing.',
    features: ['Shareable catalog link', 'Category filters', 'Favorites'],
  },
  {
    id: 'fb_beo', name: 'Food & beverage / BEO', category: 'services', plan: 'pro',
    defaultEnabled: false, isCore: false, dependencies: ['events'], screen: 'fb_beo',
    description: 'Banquet event order management for catering coordination.',
    features: ['BEO templates', 'Menu items', 'Dietary tracking'],
  },
  {
    id: 'floorplan', name: 'Floorplan builder', category: 'services', plan: 'growth',
    defaultEnabled: false, isCore: false, dependencies: ['decoration'], screen: 'floorplan',
    description: 'Drag-and-drop venue floorplan editor with linen assignments.',
    features: ['Drag-and-drop editor', 'Linen assignment', 'PNG/PDF export'],
  },
  // ── OPERATIONS ───────────────────────────────────────────────────────────
  {
    id: 'pos', name: 'Point of sale', category: 'operations', plan: 'all',
    defaultEnabled: true, isCore: false, dependencies: ['clients'], screen: 'pos',
    description: 'Quick checkout for walk-in sales and service payments.',
    features: ['Quick checkout', 'Receipt printing', 'Cash & card'],
  },
  {
    id: 'retail', name: 'Retail / product sales', category: 'operations', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: ['pos'], screen: 'retail',
    description: 'Track and sell physical products separately from rentals.',
    features: ['Product catalog', 'SKU tracking', 'Sales history'],
  },
  {
    id: 'staff_sched', name: 'Staff scheduling', category: 'operations', plan: 'growth',
    defaultEnabled: false, isCore: false, dependencies: ['staff'], screen: 'staff_schedule',
    description: 'Staff shift scheduling and availability management.',
    features: ['Shift scheduling', 'Availability management', 'Event assignment'],
  },
  {
    id: 'multi_location', name: 'Multi-location', category: 'operations', plan: 'pro',
    defaultEnabled: false, isCore: false, dependencies: [], screen: 'locations',
    description: 'Manage multiple boutique locations from one account.',
    features: ['Multiple locations', 'Per-location stats', 'Staff sharing'],
  },
  {
    id: 'audit_ui', name: 'Audit log', category: 'operations', plan: 'growth',
    defaultEnabled: false, isCore: false, dependencies: [], screen: 'audit',
    description: 'View a full audit log of all staff actions.',
    features: ['Full action history', 'Staff filter', 'Export CSV'],
  },
  {
    id: 'data_export', name: 'Data export', category: 'operations', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: [], screen: 'export',
    description: 'Export all boutique data as JSON or CSV for GDPR compliance.',
    features: ['JSON/CSV export', 'GDPR compliance', 'Full data portability'],
  },
  // ── CLIENT ───────────────────────────────────────────────────────────────
  {
    id: 'client_portal', name: 'Client portal', category: 'client', plan: 'growth',
    defaultEnabled: false, isCore: false, dependencies: ['events', 'clients', 'esign'], screen: 'portal',
    description: 'Client-facing portal for payments, contracts, and appointments.',
    features: ['Event summary', 'Payment links', 'E-signatures'],
  },
  {
    id: 'appt_booking', name: 'Appointment booking', category: 'client', plan: 'growth',
    defaultEnabled: false, isCore: false, dependencies: ['events', 'staff_sched'], screen: 'booking',
    description: 'Public appointment booking page for clients.',
    features: ['Online booking', 'SMS confirmation', 'Staff schedule sync'],
  },
  {
    id: 'waitlist', name: 'Waitlist', category: 'client', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: ['events', 'appt_booking'], screen: 'waitlist',
    description: 'Client waitlist for high-demand dates and services.',
    features: ['Waitlist management', 'Auto-notify on opening', 'Conversion tracking'],
  },
  {
    id: 'photo_gallery', name: 'Photo gallery', category: 'client', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: ['events'], screen: 'gallery',
    description: 'Photo gallery per event for dress and decoration photos.',
    features: ['Per-event gallery', 'Client sharing link', 'Before/after views'],
  },
  // ── DOCUMENTS ────────────────────────────────────────────────────────────
  {
    id: 'esign', name: 'E-signatures', category: 'documents', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: [], screen: 'contracts',
    description: 'Collect digital signatures on contracts and agreements.',
    features: ['PDF contracts', 'Digital signature', 'Audit trail'],
  },
  // ── MARKETING ────────────────────────────────────────────────────────────
  {
    id: 'email_marketing', name: 'Email marketing', category: 'marketing', plan: 'growth',
    defaultEnabled: false, isCore: false, dependencies: ['clients', 'sms_compliance'], screen: 'marketing',
    description: 'Send marketing emails and automated follow-up campaigns.',
    features: ['Campaign builder', 'Automated follow-up', 'Unsubscribe management'],
  },
  {
    id: 'ticketing', name: 'Registration & ticketing', category: 'marketing', plan: 'growth',
    defaultEnabled: false, isCore: false, dependencies: ['clients'], screen: 'ticketing',
    description: 'Sell tickets and manage event registrations online.',
    features: ['Online ticket sales', 'QR check-in', 'Attendee management'],
  },
  {
    id: 'reviews', name: 'Reviews & reputation', category: 'marketing', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: ['clients'], screen: 'reviews',
    description: 'Collect and manage client reviews after each event.',
    features: ['Review request automation', '5-star filter', 'Public review link'],
  },
  // ── FINANCE ──────────────────────────────────────────────────────────────
  {
    id: 'online_payments', name: 'Client payment links', category: 'finance', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: ['events'], screen: 'online_payments',
    description: 'Send Stripe payment links for milestones directly to clients.',
    features: ['Stripe payment links', 'Auto mark-paid on receipt', 'Client email receipt'],
  },
  {
    id: 'expenses', name: 'Expense tracking', category: 'finance', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: [], screen: 'expenses',
    description: 'Track boutique expenses and operational costs.',
    features: ['Expense log', 'Category tagging', 'Receipt upload'],
  },
  {
    id: 'accounting', name: 'Accounting export', category: 'finance', plan: 'growth',
    defaultEnabled: false, isCore: false, dependencies: ['expenses'], screen: 'accounting',
    description: 'Export financial data in QuickBooks and Xero-compatible formats.',
    features: ['QuickBooks export', 'Xero export', 'P&L summary'],
  },
  {
    id: 'reports', name: 'Financial reports', category: 'finance', plan: 'growth',
    defaultEnabled: false, isCore: false, dependencies: [], screen: 'reports',
    description: 'Revenue reports, event analysis, and client lifetime value.',
    features: ['Revenue by period', 'Event type breakdown', 'Client LTV'],
  },
  // ── SECURITY ─────────────────────────────────────────────────────────────
  {
    id: '2fa', name: 'Two-factor authentication', category: 'security', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: [], screen: null,
    description: 'Require 2FA for all staff logins.',
    features: ['TOTP authenticator support', 'SMS backup codes', 'Recovery codes'],
  },
  {
    id: 'sms_compliance', name: 'SMS compliance', category: 'security', plan: 'all',
    defaultEnabled: false, isCore: false, dependencies: [], screen: null,
    description: 'TCPA-compliant SMS opt-in/opt-out management.',
    features: ['Opt-in tracking', 'STOP/UNSTOP handler', 'Compliance audit log'],
  },
]

/**
 * Returns true if `boutiquePlan` allows access to a module with `modulePlan`.
 * starter → 'all' only
 * growth  → 'all' + 'growth'
 * pro     → everything
 */
export function planAllows(boutiquePlan, modulePlan) {
  if (modulePlan === 'all') return true
  const tierRank  = { starter: 0, growth: 1, pro: 2 }
  const planRank  = { all: 0, growth: 1, pro: 2 }
  return (tierRank[boutiquePlan] ?? 0) >= (planRank[modulePlan] ?? 0)
}
