# Belori — Claude Code Context

> This file is read automatically by Claude Code every session.
> It reflects the **actual current state** of the codebase, not a target architecture.

---

## What this project is

Belori is a bridal boutique SaaS that manages events, clients, dress rentals, alterations, payments, and inventory.
Multi-tenant SaaS migration is complete through Phase 7. All phases done.

---

## Actual tech stack (as of March 2026)

- **Framework:** Vite + React 19 (NOT Next.js — ignore any Next.js references)
- **Routing:** React Router v7
- **Auth:** Supabase Auth via `@supabase/supabase-js`
- **Database:** Supabase Postgres — **RLS is active** on all tables via `my_boutique_id()` function
- **Styling:** Inline CSS-in-JS throughout — NO Tailwind, NO shadcn/ui
- **DnD:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Deployment:** Vercel

---

## File structure (actual)

```
src/
  App.jsx                        # Root router — Login / Signup / Onboarding / JoinInvite / NovelApp
  main.jsx                       # Vite entry
  context/
    AuthContext.jsx              # useAuth() — session, boutique, signIn, signUp, signOut, reloadBoutique
  lib/
    supabase.js                  # Single createClient() with anon key
    colors.js                    # C (brand colors), fmt, pct, SVC_LABELS, SVC_COLORS, EVT_TYPES,
                                 #   TYPE_SVCS, TYPE_DEFAULT_SVCS, COLOR_PRESETS, STYLE_OPTIONS
    ui.jsx                       # Shared atoms: Avatar, Badge, Card, CardHead, Topbar, PrimaryBtn,
                                 #   GhostBtn, SvcTag, Countdown, EventTypeBadge, ProgressBar,
                                 #   StatusDot, AlertBanner, ToastProvider, useToast, inputSt, LBL
    urgency.js                   # getPriorityAlert, getCountdownConfig, DRESS_TRANSITIONS,
                                 #   ALTERATION_TRANSITIONS
    modules/
      registry.js                # 33-module registry, planAllows()
      dependencies.js            # validateEnableModule, validateDisableModule
  hooks/
    useEvents.js                 # useEvents(), useEvent() — includes createAppointment
    useClients.js                # useClients(), useClientInteractions(), useClientTasks(),
                                 #   usePipeline(), useClientTagsData(), useClientEvents()
    useInventory.js              # useInventory()
    useAlterations.js            # useAlterations()
    usePayments.js               # usePayments() — markPaid, logReminder, createMilestone
    useNotes.js                  # useNotes(), useTasks(), useAppointmentsToday()
    useBoutique.js               # useBoutique() — updateBoutique, getStaff, updateStaffMember,
                                 #   sendInvite, getPendingInvites
    useLayoutMode.jsx            # useLayoutMode() — desktop/tablet toggle
    useModules.jsx               # ModuleProvider, useModules(), useModule(), saveModuleSettings,
                                 #   seedDefaultModules
    useBilling.js                # useBilling(), PLANS — Stripe checkout + portal
    usePackages.js               # usePackages() — createPackage, updatePackage, archivePackage
  pages/
    Login.jsx                    # Login screen
    Signup.jsx                   # Signup + boutique creation
    Onboarding.jsx               # First-run boutique setup
    JoinInvite.jsx               # /join/:token — staff invite acceptance
    NovelApp.jsx                 # Root authenticated shell — hooks, screen router, Sidebar
    Dashboard.jsx                # Overview: stats, appointments, onboarding checklist
    Events.jsx                   # EventsList + CreateEventModal (with package picker)
    EventDetail.jsx              # Full event detail — milestones, appointments, tasks, notes
    EventPlanning.jsx            # Event planning board
    DressRentals.jsx             # Rental lifecycle — Catalog, Active, Returns, History
    Inventory.jsx                # Full inventory management
    Alterations.jsx              # Kanban job board
    Payments.jsx                 # Milestone billing table + ReminderModal
    Clients.jsx                  # CRM — client list + 5-tab detail
    Settings.jsx                 # Profile, Staff, Automations, Packages, Modules, Billing, Display
  components/
    Sidebar.jsx                  # Sidebar, BottomNav, IconRail — module-gated nav
    PipelineKanban.jsx           # CRM pipeline Kanban board
```

### NovelApp.jsx
- Root component only (~85 lines)
- Calls all live data hooks (useEvents, useClients, useInventory, useAlterations, usePayments)
- Heavy pages are **lazy-loaded** via `React.lazy()` + `<Suspense>`
- Dashboard is eager (first screen)

---

## Database tables

| Table | Key columns |
|---|---|
| `boutiques` | `id`, `name`, `plan`, `email`, `phone`, `address`, `instagram`, `booking_url`, `automations jsonb`, `subscription_status`, `stripe_customer_id`, `trial_ends_at` |
| `boutique_members` | `boutique_id`, `user_id`, `role`, `name`, `initials`, `color` |
| `boutique_invites` | `boutique_id`, `email`, `role`, `token`, `invited_by`, `expires_at`, `accepted_at` |
| `boutique_modules` | `boutique_id`, `module_id`, `enabled`, `enabled_at`, `disabled_at`, `enabled_by`, `disabled_by`, `updated_at`, `config jsonb` |
| `events` | `boutique_id`, `client_id`, `coordinator_id`, `package_id`, `type`, `event_date`, `venue`, `guests`, `status`, `total`, `paid`, `last_reminder_sent_at`, `inspiration_colors jsonb`, `inspiration_styles jsonb`, `inspiration_notes`, `inspiration_florals`, `quince_theme`, `quince_waltz_song`, `quince_cort_size_damas`, `quince_cort_size_chambelanes`, `venue_plan jsonb` |
| `event_services` | `event_id`, `boutique_id`, `service_type` — services are a **separate table**, NOT a jsonb column on events |
| `event_inventory` | `boutique_id`, `event_id`, `inventory_id`, `quantity`, `notes` — decoration assignments |
| `clients` | `boutique_id`, `name`, `phone`, `email`, `loyalty_points`, `partner_name`, `language_preference`, `referred_by`, `emergency_contact`, `last_rating`, `flower_prefs`, `comm_prefs jsonb`, `style_themes jsonb` |
| `inventory` | `boutique_id`, `sku`, `name`, `category`, `color`, `size`, `price`, `deposit`, `status`, `client_id`, `return_date`, `return_date_confirmed`, `pickup_date`, `last_cleaned`, `notes`, `condition`, `group`, `track`, `totalQty`, `availQty`, `reservedQty`, `outQty`, `dmgQty`, `minStock`, `currentStock`, `restockPoint`, `restockQty`, `unit` |
| `alteration_jobs` | `boutique_id`, `client_id`, `event_id`, `garment`, `status`, `seamstress_id`, `deadline`, `price`, `notes` — work items are in a **separate table** |
| `alteration_work_items` | `job_id`, `description` — work items for alteration jobs |
| `payment_milestones` | `boutique_id`, `event_id`, `label`, `amount`, `due_date`, `paid_date`, `status`, `last_reminded_at` — NO `payment_method` column |
| `appointments` | `boutique_id`, `event_id`, `type`, `date DATE`, `time TIME`, `note` (singular), `staff_id`, `status` |
| `notes` | `boutique_id`, `event_id`, `author_id`, `text` |
| `tasks` | `boutique_id`, `event_id`, `text`, `category`, `alert boolean`, `done` — NO `priority` column, use `alert` |
| `client_interactions` | `boutique_id`, `client_id`, `type`, `title`, `body`, `occurred_at`, `is_editable`, `author_name`, `author_role`, `duration_minutes`, `related_event_id`, `points_awarded`, `edited_at`, `edited_by_name`, `original_body` |
| `client_tasks` | `boutique_id`, `client_id`, `event_id`, `text`, `category`, `is_alert`, `done`, `done_at`, `done_by_name`, `assigned_to_id`, `due_date`, `created_by_name` |
| `pipeline_leads` | `boutique_id`, `client_id`, `lead_name`, `lead_phone`, `stage`, `event_type`, `estimated_event_date`, `estimated_value`, `source`, `notes`, `lost_reason`, `assigned_to_id`, `converted_at`, `converted_event_id` |
| `loyalty_transactions` | `boutique_id`, `client_id`, `delta`, `reason` |
| `client_tag_definitions` | `boutique_id`, `name`, `category`, `color` |
| `client_tag_assignments` | `boutique_id`, `client_id`, `tag_id` |
| `service_packages` | `boutique_id`, `name`, `description`, `services text[]`, `base_price`, `event_type`, `active`, `sort_order` |

---

## Critical rules — enforce in every task

### 1. boutiqueId always comes from auth — never from user input
```js
// CORRECT — from AuthContext via boutique_members
const { boutique } = useAuth()
supabase.from('events').select('*').eq('boutique_id', boutique.id)

// WRONG — never trust client-supplied IDs
const boutiqueId = req.body.boutiqueId
```

### 2. One Supabase client — the anon client from `src/lib/supabase.js`
All queries use the anon key. RLS is active on all tables — boutique scoping is enforced by
the `my_boutique_id()` Postgres function in policies.

### 3. All mutations happen in hooks — no server actions (this is a SPA)
Data is fetched and mutated in `src/hooks/`. Components call hook functions, not Supabase directly.
Exception: Dashboard's `NewAppointmentModal` and Settings' `BillingTab` call supabase directly for
one-off operations — acceptable for isolated component-level mutations.

### 4. Styling is inline CSS-in-JS
Use the `C` color object from `src/lib/colors.js`. Do not add Tailwind classes or import CSS files.

### 5. New page components go in `src/pages/`, new shared atoms in `src/lib/ui.jsx`
The old pattern of putting everything in NovelApp.jsx is retired. Each page is its own file.
For a new page: create `src/pages/MyPage.jsx`, add a lazy import + case in NovelApp.jsx.

### 6. inventory.category must match valid values
Valid `category` values (enforced by DB CHECK constraint): `bridal_gown`, `quince_gown`, `arch`,
`centerpiece`, `linen`, `lighting`, `chair`, `veil`, `headpiece`, `jewelry`, `ceremony`,
`consumable`, `equipment`.
The inventory table also has extended columns: `group`, `track`, `totalQty`, `availQty`,
`reservedQty`, `outQty`, `dmgQty`, `minStock`, `currentStock`, `restockPoint`, `restockQty`, `unit`.
Never send a `cat` column — it does not exist in the DB.

### 7. appointments use `date DATE` + `time TIME` columns — not `scheduled_at`
`createAppointment({ type, date, time, note, staff_id })` — the `note` column is singular.
`useAppointmentsToday()` queries by `.eq('date', today)`.

---

## What's built (UI screens)

- **Dashboard** — stats, today's appointments (+New modal), upcoming events, onboarding checklist
- **Events** — list with filters; 5-step wizard with package picker; event detail with milestones, appointments, tasks, notes
- **Clients** — list with search/filters; 5-tab detail (Overview, Timeline, Event history, Pipeline, Tags & prefs)
- **Alterations** — Kanban board; new job modal
- **Dress Rentals** — Catalog, Active, Returns due, History; new rental wizard
- **Inventory** — grid/list/category views; add item modal
- **Payments** — milestone billing table; reminder modal (copies SMS template + logs to client timeline)
- **Settings** — Boutique profile (saves), Staff (invite + edit), Automations (persisted), Packages (full CRUD), Modules, Billing (usage stats + plan cards), Display mode

---

## Migration status

- [x] Phase 1 — Boutique layer (`boutiques` table, `boutique_id` columns)
- [x] Phase 2 — Auth upgrade (onboarding, invite flow, boutique guard)
- [x] Phase 3 — Row Level Security (RLS on all tables)
- [x] Phase 4 — Split NovelApp.jsx into separate page files + lazy loading
- [x] Phase 5 — Stripe billing (subscriptions, billing portal, usage stats)
- [x] Phase 6 — Module system (`boutique_modules`, `useModules`, Module Manager UI)
- [x] Phase 7 — Inngest jobs (9 automations as Supabase Edge Functions; see `supabase/functions/inngest/`)

---

## Phase 7 — Inngest deployment

### Edge function locations
- `supabase/functions/inngest/index.ts` — serves all 9 Inngest automation functions
- `supabase/functions/inngest-send/index.ts` — frontend proxy to fire Inngest events (no JWT required)
- `supabase/functions/pdf/index.ts` — PDF generation (contract + receipt)

### Deploy
```bash
supabase functions deploy inngest
supabase functions deploy inngest-send
supabase functions deploy pdf
```
Then register the inngest endpoint in the Inngest dashboard:
`https://bohdabdgqgfeatpxyvbz.supabase.co/functions/v1/inngest`

### Frontend helpers
- `src/lib/inngest.js` — `sendInngestEvent(name, data)` — fire-and-forget event sender
  - Called from `Signup.jsx` and `Onboarding.jsx` on boutique creation (`belori/boutique.created`)
- `EventDetail.jsx` topbar — download button calls `/functions/v1/pdf?type=contract&event_id=...`

### Required secrets (set once)
```bash
supabase secrets set INNGEST_EVENT_KEY=your_key
supabase secrets set INNGEST_SIGNING_KEY=your_signing_key
supabase secrets set TWILIO_ACCOUNT_SID=ACxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxx
supabase secrets set TWILIO_FROM_NUMBER=+1xxxxxxxxxx
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set RESEND_FROM_EMAIL="Belori <noreply@yourdomain.com>"
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.

### Automations (stored in `boutiques.automations` jsonb)
| Key | Schedule | Description |
|---|---|---|
| `sms24h` | daily 9am UTC | SMS 24h before each appointment |
| `sms2h` | hourly | SMS 2h before each appointment |
| `paymentReminder` | daily 10am UTC | SMS + email 3 days before milestone due |
| `overdueAlert` | daily 8am UTC | SMS at 1, 7, 14 days past due |
| `returnReminder` | daily 9am UTC | SMS 48h before dress return date |
| `reviewRequest` | daily 11am UTC | SMS 24h after event; marks event completed |
| `winBack` | weekly Sun noon UTC | SMS clients inactive 60+ days |
| `weeklyDigest` | weekly Mon 7am UTC | Email owner upcoming events + overdue payments |
| _(event-driven)_ | `belori/boutique.created` | Onboarding email sequence: welcome → day 3 → day 7 → day 14 |

All automations default ON unless explicitly set to `false` in the boutique's `automations` column.

---

## Environment variables

```bash
VITE_SUPABASE_URL=https://bohdabdgqgfeatpxyvbz.supabase.co
VITE_SUPABASE_ANON_KEY=...
```
