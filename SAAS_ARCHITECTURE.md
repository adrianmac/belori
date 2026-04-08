# SAAS_ARCHITECTURE.md — Belori SaaS Architecture

> **Status:** This document reflects the **actual current stack** as of March 2026, plus the target architecture for each migration phase. Where current and target differ, both are noted.

---

## Architecture overview

Belori is a shared-infrastructure, isolated-data multi-tenant SaaS. Every boutique shares the same application code and database cluster — data is isolated via `boutique_id` scoping in application code today, and will be further hardened with PostgreSQL Row Level Security in Phase 3.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│              Staff web app — belori.app                         │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VERCEL EDGE LAYER                           │
│              Global CDN · Static asset delivery                 │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               APPLICATION LAYER (current)                       │
│        Vite + React 19 SPA · React Router v7                    │
│        All UI in src/pages/NovelApp.jsx (~6200 lines)           │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                          │
│         Supabase PostgreSQL · Supabase Auth · Supabase Storage  │
│         No RLS yet — data scoped in JS via boutique_id          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current technology stack

### Core framework
```
Vite 8              Build tool + dev server
React 19            UI framework
React Router 7      Client-side routing (Login / Signup / App)
```

### Data layer
```
Supabase JS v2      supabase-js createClient() with anon key
Supabase Postgres   Managed PostgreSQL
Supabase Auth       Email/password auth (no Clerk)
Supabase Storage    File storage (not yet used in app)
```

### Styling
```
Inline CSS-in-JS    All styles are inline via the C{} color object
                    No Tailwind, no shadcn, no CSS modules
```

### DnD
```
@dnd-kit/core       Drag and drop (Alterations Kanban)
@dnd-kit/sortable
```

### Hosting
```
Vercel              Static SPA deploy
```

### No current implementation for:
```
Background jobs     (Inngest — Phase 7)
SMS                 (Twilio — Phase 7)
Email               (Resend — Phase 7)
Billing             (Stripe — Phase 5)
Redis cache         (not planned near-term)
CI/CD pipeline      (GitHub Actions — not set up)
```

---

## File structure (current)

```
src/
  App.jsx                        # Root router
  main.jsx                       # Vite entry
  context/
    AuthContext.jsx              # useAuth() — boutique, signOut
  lib/
    supabase.js                  # Single createClient(url, anonKey)
    urgency.js                   # Alert helpers, transition maps
  hooks/
    useEvents.js
    useClients.js                # + 5 CRM sub-hooks
    useInventory.js
    useAlterations.js
    usePayments.js
    useNotes.js
    useBoutique.js
    useLayoutMode.jsx
  pages/
    Login.jsx
    Signup.jsx
    NovelApp.jsx                 # ~6200-line monolith — all UI components
    EventPlanning.jsx
  components/
    PipelineKanban.jsx
```

---

## Multi-tenancy model (current)

### One row in `boutiques` = one tenant

```js
// In AuthContext — resolved once at login via boutique_members join
const { boutique } = useAuth()

// Every hook scopes all queries to boutique.id
const { data } = await supabase
  .from('events')
  .select('*')
  .eq('boutique_id', boutique.id)   // ← always scoped
```

### Tenancy table: `boutique_members`

```sql
boutique_members (
  boutique_id  uuid references boutiques(id),
  user_id      uuid references auth.users(id),
  role         text  -- owner | coordinator | front_desk | seamstress | decorator
)
```

Auth resolves: `auth.users` → `boutique_members` → `boutiques`. The `boutiqueId` is **never** taken from user input.

### Tenancy isolation (current vs target)

| Layer | Current | Target (Phase 3) |
|---|---|---|
| Database rows | JS `.eq('boutique_id', id)` | PostgreSQL RLS policy |
| File storage | Not used yet | `boutiques/{boutiqueId}/` prefix + signed URLs |
| Auth sessions | Supabase JWT | Supabase JWT (no change) |
| SMS numbers | Not implemented | Twilio sub-accounts per boutique |
| Payments | Not implemented | Stripe Connect per boutique |

---

## Database schema

### `boutiques`
```sql
id              uuid primary key
name            text not null
slug            text unique          -- future: public booking URL
email           text
phone           text
address         text
instagram       text
primary_color   text default '#C9697A'
plan_tier       text default 'starter'  -- starter | growth | pro
layout_mode     text default 'desktop'
created_at      timestamptz default now()
```

### `boutique_members`
```sql
boutique_id   uuid references boutiques(id)
user_id       uuid references auth.users(id)
role          text  -- owner | coordinator | front_desk | seamstress | decorator
```

### Core data tables (all have `boutique_id NOT NULL`)
```
events              — bookings, event type, date, contract value, status
clients             — CRM, loyalty points, comm prefs
inventory           — dress catalog (category, sku, price, deposit, status)
alterations         — job management (status, work_items, client_id)
payments            — milestones (event_id, amount, due_date, paid_at)
```

### CRM extension tables
```
client_interactions     — timeline log (type, title, body, occurred_at)
client_tasks            — open tasks per client
pipeline_leads          — 6-stage Kanban (inquiry → won/lost)
client_tag_definitions  — boutique-defined CRM tags
client_tag_assignments  — client ↔ tag links
```

### Valid `inventory.category` values
```
bridal_gown · quince_gown · veil · tiara · jewelry · shoes ·
bolero · gloves · decoration · chair · table_linen · lighting · other
```

---

## Authentication (current)

### Flow
```
1. User submits email + password → Login.jsx
2. supabase.auth.signInWithPassword()
3. Supabase returns JWT session
4. AuthContext fetches boutique_members → resolves boutique
5. App renders with boutique context available everywhere
```

### AuthContext shape
```js
const { boutique, session, signOut } = useAuth()
// boutique: { id, name, email, phone, ... }
// session: Supabase session object
```

### Role model
```
owner           Full access — settings, billing, staff, all modules
coordinator     Events, clients, finance read + mark paid, inventory assign
front_desk      Events read/create, clients full, POS, inventory read
seamstress      Alterations full, measurements, clients read
decorator       Inventory full, decoration, events read
```

Role is stored in `boutique_members.role`. Not enforced at DB level yet — enforced in UI only.

---

## Data mutation pattern (current)

All data mutations happen inside hooks. Components call hook functions — never Supabase directly.

```js
// Hook (src/hooks/useEvents.js)
async function createEvent(payload) {
  const { data, error } = await supabase
    .from('events')
    .insert({ ...payload, boutique_id: boutique.id })
    .select()
    .single()
  if (!error) setEvents(prev => [data, ...prev])
  return { data, error }
}

// Component
const { createEvent } = useEvents()
await createEvent({ name: 'Sofia & Juan', type: 'wedding', date: '2026-10-10' })
```

---

## Stripe billing — plan tiers (target Phase 5)

| Plan | Price | Seats | Storage |
|---|---|---|---|
| Starter | $49/month | 3 | 10 GB |
| Growth | $129/month | 10 | 100 GB |
| Pro | $299/month | Unlimited | 1 TB |

Platform fee on client payments via Stripe Connect: **1.5%**

---

## Role Level Security — RLS policy template (target Phase 3)

```sql
-- Apply to every table. Uses boutique_members, not Clerk.
CREATE OR REPLACE FUNCTION is_boutique_member(target_boutique_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM boutique_members
    WHERE boutique_id = target_boutique_id
      AND user_id = auth.uid()
  );
$$;

CREATE POLICY "boutique_isolation" ON events
  FOR ALL USING (is_boutique_member(boutique_id));
```

---

## Background jobs — Inngest (target Phase 7)

```
return-reminder         SMS 48h + 4h before dress return date
payment-reminder        Daily cron — SMS overdue milestones
contract-pdf            Generate PDF → upload to Storage → email client
win-back                Weekly — SMS clients inactive 60+ days
onboarding-sequence     Triggered on boutique.created
```

---

## Compliance requirements

| Regulation | Requirement | Target implementation |
|---|---|---|
| TCPA | SMS opt-out | Twilio inbound STOP/UNSTOP handler per boutique |
| CAN-SPAM | Email unsubscribe | Resend 1-click unsubscribe in every marketing email |
| GDPR | Data export + deletion | Export tool (JSON/CSV), anonymize audit logs |
| PCI-DSS | Card data | Stripe handles all card storage — nothing touches Belori servers |
| CCPA | Right to know/delete | Same GDPR tooling |

---

## Security threat model

| Threat | Current mitigation | Target |
|---|---|---|
| Cross-tenant data access | `.eq('boutique_id', id)` in every query | RLS at DB level (Phase 3) |
| Auth bypass | Supabase JWT validated server-side | No change |
| SQL injection | supabase-js parameterized queries | No change |
| XSS | React auto-escapes | CSP headers via Vercel |
| Webhook spoofing | Not applicable yet | HMAC signature on Stripe/Twilio webhooks |
| Secret exposure | Vercel encrypted env vars | No change |
| Brute force | Supabase Auth rate limiting | No change |

---

## Migration phases

- [ ] **Phase 1** — Boutique layer (`boutiques` + `boutique_id` on all tables, `getBoutiqueFromUser`)
- [ ] **Phase 2** — Auth upgrade (onboarding flow, invite staff flow, role enforcement)
- [ ] **Phase 3** — Row Level Security (RLS on all tables, test with two boutiques)
- [ ] **Phase 4** — Split `NovelApp.jsx` into separate page/component files
- [ ] **Phase 5** — Stripe billing (subscriptions, webhook handler, billing settings page)
- [ ] **Phase 6** — Module system (`boutique_modules` table, `useModule` hook, module manager UI)
- [ ] **Phase 7** — Inngest jobs (SMS automations, PDF generation, onboarding sequence)

---

## Environment variables

```bash
VITE_SUPABASE_URL=https://bohdabdgqgfeatpxyvbz.supabase.co
VITE_SUPABASE_ANON_KEY=...

# Phase 5
VITE_STRIPE_PUBLISHABLE_KEY=...
STRIPE_SECRET_KEY=...             # server-side only
STRIPE_WEBHOOK_SECRET=...

# Phase 7
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
RESEND_API_KEY=...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```
