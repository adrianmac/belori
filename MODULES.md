# MODULES.md — Belori Modular Architecture Spec

> **Status:** The module registry and feature specs are accurate. Code patterns have been updated to reflect the actual stack (Vite + React 19 + supabase-js). The module system itself is Phase 6 — not yet implemented.

---

## Overview

Belori is built as a modular SaaS. Each boutique can enable or disable features independently. Core modules are always active. Optional modules can be toggled from Settings → Module manager. Disabled modules hide their navigation items and screens.

**Current state:** All modules are hardcoded as always-on in `NovelApp.jsx`. The `boutique_modules` table and `useModule` hook don't exist yet — that's Phase 6.

---

## Module Registry

### Complete module list (32 modules)

| ID | Name | Category | Plan | Default | Dependencies |
|----|------|----------|------|---------|-------------|
| `events` | Events | core | all | ✓ on | — |
| `clients` | Clients & CRM | core | all | ✓ on | — |
| `staff` | Staff & roles | core | all | ✓ on | — |
| `settings` | Settings | core | all | ✓ on | — |
| `dress_rental` | Dress rental | services | all | ✓ on | events, clients |
| `alterations` | Alterations | services | all | ✓ on | events |
| `decoration` | Decoration & inventory | services | all | ✓ on | events |
| `event_planning` | Event planning | services | all | ✓ on | events, clients |
| `pos` | Point of sale | operations | all | ✓ on | clients |
| `measurements` | Measurements | services | all | off | alterations |
| `vendors` | Vendor management | operations | all | off | events |
| `floorplan` | Floorplan builder | operations | growth | off | decoration |
| `client_portal` | Client portal | client | growth | off | events, clients, esign |
| `appt_booking` | Appointment booking | client | growth | off | events, staff_sched |
| `esign` | E-signatures | documents | all | off | — |
| `email_marketing` | Email marketing | marketing | growth | off | clients, sms_compliance |
| `online_payments` | Client payment links | finance | all | off | events |
| `fb_beo` | Food & beverage / BEO | services | pro | off | events |
| `ticketing` | Registration & ticketing | marketing | growth | off | clients |
| `staff_sched` | Staff scheduling | operations | growth | off | staff |
| `multi_location` | Multi-location | operations | pro | off | — |
| `retail` | Retail / product sales | operations | all | off | pos |
| `expenses` | Expense tracking | finance | all | off | — |
| `accounting` | Accounting export | finance | growth | off | expenses |
| `reports` | Financial reports | finance | growth | off | — |
| `reviews` | Reviews & reputation | marketing | all | off | clients |
| `photo_gallery` | Photo gallery | client | all | off | events |
| `dress_catalog` | Dress catalog management | services | all | off | dress_rental |
| `waitlist` | Waitlist | client | all | off | events, appt_booking |
| `audit_ui` | Audit log UI | operations | growth | off | — |
| `data_export` | Data export | operations | all | off | — |
| `2fa` | Two-factor authentication | security | all | off | — |
| `sms_compliance` | SMS compliance | security | all | off | — |

---

## Plan Tiers

| Plan | Price | Modules available |
|------|-------|------------------|
| Starter | $49/month | All `plan: 'all'` modules |
| Growth | $129/month | All + `plan: 'growth'` modules |
| Pro | $299/month | All + growth + `plan: 'pro'` modules |

---

## Database Schema (Phase 6)

```sql
CREATE TABLE boutique_modules (
  id            uuid primary key default gen_random_uuid(),
  boutique_id   uuid references boutiques(id) not null,
  module_id     text not null,
  enabled       boolean not null default false,
  enabled_at    timestamptz,
  enabled_by    text,
  disabled_at   timestamptz,
  disabled_by   text,
  config        jsonb default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(boutique_id, module_id)
);

ALTER TABLE boutique_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_isolation" ON boutique_modules
  FOR ALL USING (is_boutique_member(boutique_id));
```

Also add `plan_tier` to `boutiques` if not present:
```sql
ALTER TABLE boutiques ADD COLUMN IF NOT EXISTS plan_tier text default 'starter';
```

---

## Module Registry (JavaScript)

```js
// src/lib/modules/registry.js

export const MODULE_REGISTRY = [
  {
    id: 'events',
    name: 'Events',
    category: 'core',
    plan: 'all',
    defaultEnabled: true,
    isCore: true,
    dependencies: [],
    screen: 'events',
    description: 'Event creation, detail pages, milestones, tasks, and notes.',
    features: ['Event detail page', 'Payment milestones', 'Tasks & notes', 'Urgency engine'],
  },
  {
    id: 'clients',
    name: 'Clients & CRM',
    category: 'core',
    plan: 'all',
    defaultEnabled: true,
    isCore: true,
    dependencies: [],
    screen: 'clients',
    description: 'Client profiles, interaction timeline, pipeline, and tags.',
    features: ['5-tab client detail', 'Interaction timeline', 'Pipeline Kanban', 'Tags & prefs'],
  },
  {
    id: 'dress_rental',
    name: 'Dress rental',
    category: 'services',
    plan: 'all',
    defaultEnabled: true,
    isCore: false,
    dependencies: ['events', 'clients'],
    screen: 'inventory',
    description: 'Full dress rental lifecycle.',
    features: ['Reserve, pickup, return, cleaning', 'QR scanning', 'Overdue alerts'],
  },
  {
    id: 'alterations',
    name: 'Alterations',
    category: 'services',
    plan: 'all',
    defaultEnabled: true,
    isCore: false,
    dependencies: ['events'],
    screen: 'alterations',
    description: 'Alteration job management with Kanban board.',
    features: ['Kanban board', 'Work item pricing', 'Garment tracking'],
  },
  {
    id: 'decoration',
    name: 'Decoration & inventory',
    category: 'services',
    plan: 'all',
    defaultEnabled: true,
    isCore: false,
    dependencies: ['events'],
    screen: 'inv_full',
    description: 'Full inventory management for all item categories.',
    features: ['Grid/list/category views', 'Single/quantity/consumable tracking', 'QR codes'],
  },
  // ... remaining modules follow same shape
]
```

---

## Module State Hook (Phase 6)

```js
// src/hooks/useModules.js

import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MODULE_REGISTRY } from '../lib/modules/registry'

const ModuleContext = createContext({ isEnabled: () => true, planTier: 'starter' })

export function ModuleProvider({ children }) {
  const { boutique } = useAuth()
  const [enabled, setEnabled] = useState(new Set())
  const [planTier, setPlanTier] = useState('starter')

  useEffect(() => {
    if (!boutique) return
    // Core modules always enabled
    const coreIds = MODULE_REGISTRY.filter(m => m.isCore).map(m => m.id)
    setPlanTier(boutique.plan_tier || 'starter')

    supabase
      .from('boutique_modules')
      .select('module_id')
      .eq('boutique_id', boutique.id)
      .eq('enabled', true)
      .then(({ data }) => {
        const dbIds = data?.map(r => r.module_id) || []
        setEnabled(new Set([...coreIds, ...dbIds]))
      })
  }, [boutique?.id])

  return (
    <ModuleContext.Provider value={{
      isEnabled: (id) => {
        const def = MODULE_REGISTRY.find(m => m.id === id)
        if (def?.isCore) return true
        return enabled.has(id)
      },
      planTier,
    }}>
      {children}
    </ModuleContext.Provider>
  )
}

export function useModule(moduleId) {
  const { isEnabled } = useContext(ModuleContext)
  return isEnabled(moduleId)
}

export function useModules() {
  return useContext(ModuleContext)
}
```

---

## Usage in NovelApp.jsx (Phase 6)

```jsx
// Wrap app in ModuleProvider (src/App.jsx)
import { ModuleProvider } from './hooks/useModules'

<ModuleProvider>
  <NovelApp />
</ModuleProvider>

// In NovelApp.jsx — hide nav items based on module state
const hasDressRental = useModule('dress_rental')
const hasAlterations = useModule('alterations')

// buildNavItems already receives badges — extend to accept module state:
const buildNavItems = (badges = {}, modules = {}) => [
  { id: 'dashboard', label: 'Overview', icon: 'overview' },
  { id: 'events', label: 'Events', icon: 'events', ... },
  { id: 'clients', label: 'Clients', icon: 'clients' },
  { divider: 'Services' },
  ...(modules.alterations ? [{ id: 'alterations', ... }] : []),
  ...(modules.dress_rental ? [{ id: 'inventory', ... }] : []),
  { divider: 'Operations' },
  ...(modules.decoration ? [{ id: 'inv_full', ... }] : []),
  { id: 'payments', ... },
  { id: 'settings', ... },
]
```

---

## Saving Module Settings (Phase 6)

```js
// src/hooks/useModules.js — saveModuleSettings

export async function saveModuleSettings(boutiqueId, updates, staffName) {
  // updates: [{ moduleId: 'vendors', enabled: true }, ...]

  // Validate plan allows these modules
  const boutique = await supabase
    .from('boutiques')
    .select('plan_tier')
    .eq('id', boutiqueId)
    .single()

  for (const update of updates) {
    const def = MODULE_REGISTRY.find(m => m.id === update.moduleId)
    if (!def) throw new Error(`Unknown module: ${update.moduleId}`)
    if (def.isCore && !update.enabled) throw new Error(`Cannot disable core module: ${update.moduleId}`)
    if (!planAllows(boutique.data.plan_tier, def.plan)) {
      throw new Error(`${update.moduleId} requires ${def.plan} plan`)
    }
  }

  // Upsert each module row
  const rows = updates.map(u => ({
    boutique_id: boutiqueId,
    module_id: u.moduleId,
    enabled: u.enabled,
    enabled_at: u.enabled ? new Date().toISOString() : null,
    enabled_by: u.enabled ? staffName : null,
    disabled_at: !u.enabled ? new Date().toISOString() : null,
    disabled_by: !u.enabled ? staffName : null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('boutique_modules')
    .upsert(rows, { onConflict: 'boutique_id,module_id' })

  if (error) throw error
}

function planAllows(boutiquePlan, modulePlan) {
  const rank = { all: 0, growth: 1, pro: 2 }
  const tierRank = { starter: 0, growth: 1, pro: 2 }
  return tierRank[boutiquePlan] >= rank[modulePlan]
}
```

---

## Dependency Validation

```js
// src/lib/modules/dependencies.js

export function validateEnableModule(moduleId, currentlyEnabled) {
  const def = MODULE_REGISTRY.find(m => m.id === moduleId)
  if (!def) return { valid: false, missing: [] }
  const missing = def.dependencies.filter(dep => !currentlyEnabled.has(dep))
  return { valid: missing.length === 0, missing }
}

export function validateDisableModule(moduleId, currentlyEnabled) {
  const blocking = MODULE_REGISTRY
    .filter(m => m.dependencies.includes(moduleId) && currentlyEnabled.has(m.id))
    .map(m => m.id)
  return { valid: blocking.length === 0, blocking }
}

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
```

---

## Default Modules on Boutique Creation

When a boutique is first created, seed the default module state:

```js
export async function seedDefaultModules(boutiqueId) {
  const defaults = MODULE_REGISTRY
    .filter(m => m.defaultEnabled)
    .map(m => ({
      boutique_id: boutiqueId,
      module_id: m.id,
      enabled: true,
      enabled_at: new Date().toISOString(),
      enabled_by: 'System (setup)',
    }))

  await supabase
    .from('boutique_modules')
    .upsert(defaults, { onConflict: 'boutique_id,module_id' })
}
```

Default-enabled on creation:
- `events`, `clients`, `staff`, `settings` (core — always on)
- `dress_rental`, `alterations`, `decoration`, `event_planning` (services)
- `pos` (operations)

---

## Module Manager UI (Phase 6)

### Location
Settings → Modules tab (add to existing Settings 5-tab layout in NovelApp.jsx)

### Features
- Stats strip: active modules, disabled, plan-locked
- Filter pills: All, Enabled, Disabled — by category
- Search (name + description)
- Module card: name, category tag, description, 3 feature bullets, plan badge, toggle
- Core modules: "Always on" — non-interactive
- Plan-locked modules: "Upgrade to unlock" — non-interactive
- Sticky save bar: appears when unsaved changes exist
- Changes update sidebar nav immediately after save

### Who can manage
Owner role only. Coordinator and below see a read-only view.

---

## Nav Item Map by Module

| Module | Screen ID | Sidebar label | Section |
|--------|-----------|---------------|---------|
| events | events | Events | — |
| clients | clients | Clients | — |
| alterations | alterations | Alterations | Services |
| dress_rental | inventory | Dress rentals | Services |
| decoration | inv_full | Inventory | Operations |
| event_planning | planning | Planning | Services |
| pos | pos | Point of sale | Operations |
| payments | payments | Payments | Operations |
| staff_sched | staff_schedule | Staff schedule | Operations |
| reports | reports | Reports | Finance |
| expenses | expenses | Expenses | Finance |
| retail | retail | Products | Inventory |
| vendors | vendors | Vendors | Services |
| email_marketing | marketing | Email campaigns | Marketing |
| multi_location | locations | All locations | — |
| audit_ui | audit | Audit log | Settings |

---

## Individual Module Specs

### Measurements
```
Screen:   /measurements (or client detail tab)
DB:       client_measurements
Fields:   client_id, event_id, alteration_job_id, taken_by
          bust, waist, hips, shoulder, sleeve_length, neckline
          hollow_to_hem, waist_to_floor, inseam, notes
          dress_specs (jsonb — target dress sizes for comparison)
UI:       Per-client measurement history
          Comparison to dress on record
          Export as PDF measurement sheet
```

### Vendor management
```
Screen:   Vendors list + vendor detail
DB:       vendors, event_vendors (junction)
Fields:   name, category, phone, email, website
          price_range, rating, preferred, notes
UI:       Directory with category filter
          Assign vendors to events from event detail
          Vendor history (events worked)
```

### Floorplan builder
```
Screen:   Floorplans list + event floorplan editor
DB:       event_floorplans (canvas_data jsonb, thumbnail_url)
Elements: round_table, rectangle_table, head_table, chair,
          arch, stage, dance_floor, bar, photo_booth
          wall, door, free_text_label
Linked:   Table elements can have linens assigned from decoration inventory
Export:   PNG image, PDF, shareable read-only link
```

### Client portal
```
Screen:   Public URL — no auth required
DB:       portal_tokens (token, event_id, expires_at)
Client sees: Event summary, payment milestones + "Pay now" (Stripe)
             Contract + e-signature (if esign enabled)
             Upcoming appointments
Config:   Boutique logo + colors, custom welcome message
```

### Appointment booking
```
Screen:   Public booking page (no auth)
DB:       booking_availability, booking_appointments
Flow:     Select service → pick slot → enter name + phone
          → SMS confirmation → appears in staff schedule
Config:   Which staff are bookable, lead time, slot duration,
          buffer time, blackout dates
```

### E-signatures
```
DB fields on contracts:
          signature_token, client_signature_data (base64 PNG)
          client_signed_at, client_signed_ip
          staff_signature_data, staff_signed_at
Flow:     Staff sends link → client signs in browser → PDF regenerated
Tech:     signature-pad library, Puppeteer PDF (Phase 7)
```

### Online payment links
```
Flow:     Staff clicks "Send payment link" on milestone
          → Stripe Payment Link created
          → Link sent via SMS/email
          → Client pays via Stripe Checkout
          → Webhook marks milestone paid + awards loyalty points
DB adds:  stripe_payment_link_url, stripe_session_id, paid_via_link
```

### Staff scheduling
```
Screen:   Weekly calendar (all staff)
DB:       staff_availability (day_of_week, start_time, end_time)
          staff_exceptions (date, is_off, note)
          staff_event_assignments (junction)
Features: Per-staff availability settings, conflict detection,
          integration with appointment booking
```

### Financial reports
```
Screen:   Reports dashboard
Types:    Monthly P&L, Revenue by service, Top clients by LTV,
          Booking pace (12-month), Dress utilization,
          Alteration turnaround
Export:   PDF or CSV
```

### Email marketing
```
Screen:   Email campaigns list + campaign builder
DB:       email_campaigns, email_recipients
Sending:  Resend bulk email API
Segments: Filter by tag, loyalty tier, event type, last activity
Templates: Trunk show, seasonal sale, re-engagement, anniversary, blank
Compliance: 1-click unsubscribe required in every send
```

### Multi-location
```
DB:       locations table (belongs to boutique)
          staff assigned to one or more locations
          inventory, events, clients scoped per location
Dashboard: Cross-location revenue, events, staff, inventory
Transfers: Move inventory between locations with transfer log
Scoping:   Staff see their location only. Owner sees all.
```

### Retail / product sales
```
DB:       retail_products (sku, category, price, stock_qty, reorder_at)
          retail_sales (client_id, product_id, qty, sold_at)
Categories: Accessories, shoes, shapewear, gifts, bridal party, care products
POS:      Products appear as a tile category in the POS register
          Sale auto-decrements stock
Alerts:   Low stock notification to owner when below reorder_at threshold
```
