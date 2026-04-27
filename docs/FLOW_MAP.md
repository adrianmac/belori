I now have sufficient information to produce the comprehensive test matrix. Let me compile the full report:

---

# Belori — Complete QA Test Matrix

**Prepared by:** Belori Flow Cartographer (testing-workflow-optimizer agent)
**Date:** 2026-04-13
**Codebase root:** `C:/Dev/novela/src/`
**Module registry:** 33 modules (4 core + 29 optional)

---

## Foundational Infrastructure

### Auth & RLS (No dedicated screen — underlies everything)
**Screen file:** `src/context/AuthContext.jsx`, `src/App.jsx`
**Hook:** `src/context/AuthContext.jsx` (useAuth)
**DB tables:** `boutiques`, `boutique_members`, `boutique_invites`

#### Happy path
1. User navigates to app root; unauthenticated → redirected to Login
2. User enters valid email + password → Supabase Auth session created → `boutique` populated from `boutique_members` join
3. `boutique.id` is written into every subsequent query via `eq('boutique_id', boutique.id)`
4. On sign-out, session cleared, redirect to Login

#### Edge cases & error paths
- Login with wrong password → Supabase error propagated to UI
- User exists in auth but has no `boutique_members` row → `boutique` is null → every hook bails with `if (!boutique) return`
- Expired session → Supabase auto-refresh; if refresh fails, session is null → redirect
- Multi-boutique: `boutiques` array populated; `switchBoutique()` changes active boutique and all hooks re-subscribe with new `boutique.id`
- RLS: every table enforces `boutique_id = my_boutique_id()` → cross-tenant reads return empty, not 403
- `myRole` drives `canAccess(role, screen)` in `goScreen()`; unknown role defaults to `front_desk` permissions (most restrictive)

#### Cross-module dependencies
- Required by: every module — no module works without a valid `boutique`
- Used by: nothing (root dependency)

#### Test priority
P0 — data security foundation; all other tests presuppose this passes

---

## 1. Events

**Screen file:** `src/pages/Events.jsx` (EventsList + CreateEventModal), `src/pages/EventDetail.jsx`
**Hook:** `src/hooks/useEvents.js` (useEvents, useEvent)
**DB tables:** `events`, `event_services`, `payment_milestones`, `appointments`, `tasks`, `notes`, `event_inventory`, `alteration_jobs`

#### Happy path
1. Navigate to `events` screen; EventsList renders sorted by `event_date` ascending
2. Click "New Event" → 3-step CreateEventModal opens
   - Step 1: select or create client; pick event type (wedding/quince), date, venue, guest count, coordinator
   - Step 2: select services from `TYPE_DEFAULT_SVCS[evType]`; optionally pick a package
   - Step 3: review auto-generated payment milestones (`genMilestones()`); confirm
3. `createEvent()` called → inserts into `events`, then `event_services`, then `payment_milestones` in sequence; optionally creates alteration job if `alterationData` provided
4. If `isNewClient`: client is inserted first; returned `id` used as `client_id`
5. If `clientEmail + portal_token`: portal welcome email sent via `send-email` Edge Function
6. EventsList re-renders with new event via real-time subscription (channel `events-rt-{boutique.id}`)
7. Click event row → `setSelectedEvent(id)`, `setScreen('event_detail')` → EventDetail loads
8. EventDetail: view milestones, appointments, tasks, notes, alteration jobs, decoration assignments, vendors
9. Edit event inline (status, date, venue); `updateEvent()` with optimistic update + rollback on error
10. Status set to `completed` → `sendInngestEvent('belori/event.completed', ...)` fired
11. Duplicate event → copies event, services, milestones, tasks, appointments, inventory assignments (cleared dates)
12. Delete event → `deleteEvent()` hard-deletes; cascades in DB

#### Edge cases & error paths
- Create event with no client selected → form validation blocks submission (`err` state)
- Create event with missing date → milestones generate with invalid dates (edge: `genMilestones()` uses `new Date(undefined)`)
- `event_date` in the past on creation → `daysUntil` is negative; `urgency` set high
- Delete event with paid milestones still linked → DB FK cascade or orphan milestones; confirm modal required
- Duplicate event when source has no milestones/tasks → silent no-op for each sub-copy, not an error
- `autoProgressEvents()` runs on Dashboard mount: marks active past-due fully-paid events as completed silently
- Real-time subscription: if `boutique.id` changes mid-session (boutique switch), old channel is unsubscribed, new one re-subscribed
- `rescheduleEvent()`: shifts all unpaid milestone due_dates and appointment dates by `deltaDays`; if milestones have no `due_date` they are skipped
- Network failure mid-`createEvent()` after event row inserted but before services → partial event without services; no rollback mechanism
- Staff role `front_desk`: can access `event_detail` but `coordinator` role needed for payments, alterations
- `portal_token` absent on event → portal email silently skipped (no error)

#### Cross-module dependencies
- Requires: clients (client FK), staff (coordinator FK)
- Used by: alterations (event_id FK), dress_rental (event lookup), payments/milestones (event FK), decoration/inventory (event_inventory), appointments (event FK), vendors (event assignment), expenses (event link), PO (no direct link), reports (reads events)

#### Test priority
P0 — core entity; all service modules depend on events existing

---

## 2. Clients & CRM

**Screen file:** `src/pages/Clients.jsx`, `src/pages/clients/ClientDetail.jsx`
**Hook:** `src/hooks/useClients.js` (useClients, useClientInteractions, useClientTasks, usePipeline, useClientTagsData, useClientEvents, useLoyaltyTransactions)
**DB tables:** `clients`, `client_interactions`, `client_tasks`, `pipeline_leads`, `loyalty_transactions`, `client_tag_definitions`, `client_tag_assignments`

#### Happy path
1. Navigate to `clients`; list sorted alphabetically, limit 500
2. Search by name/phone/email (client-side filter)
3. Create new client via NewClientModal: name, phone, email, partner name, language preference
4. Click client row → 5-tab ClientDetail opens:
   - **Overview**: profile, loyalty tier display, quick actions (message, tag)
   - **Timeline**: `useClientInteractions()` — sorted desc by `occurred_at`; add call/note/SMS entries; edit interactions (stores `original_body`)
   - **Event history**: `useClientEvents()` — all events with milestone totals; mark milestones paid inline
   - **Pipeline**: `usePipeline()` — add lead, drag between stages via `moveLead()`
   - **Tags & prefs**: `useClientTagsData()` — toggle existing tags, create new tag definitions (auto-assigned)
5. Loyalty points: `adjustLoyaltyPoints()` calls `adjust_loyalty_points` RPC (atomic, no race condition); `redeemPoints()` pre-checks balance then RPC
6. Merge clients: reassigns all FK references across 7 tables + inventory, then deletes removed client

#### Edge cases & error paths
- Client list > 500: oldest clients beyond limit become invisible — no pagination indicator in current UI
- Create client with duplicate phone/email: no unique constraint enforced in application layer; DB may or may not have unique index
- `redeemPoints()` with insufficient balance → returns `{ error: { message: 'Insufficient points' } }` — UI must handle
- Concurrent loyalty adjustment from two staff → RPC uses `GREATEST(0, ...)` so floor is 0 but order not guaranteed
- Merge clients: if `removeId` has inventory assigned, `inventory.client_id` reassignment must succeed before delete; if it fails, orphan inventory rows possible
- Client with no events: `totalSpent = 0`, `hasOverdue = false` — displays correctly
- `editInteraction()`: only saves `body` and `edited_at`; original_body captured from in-memory state — if component remounts between load and edit, `orig` could be undefined (returns `original_body: null`)
- `addInteraction()` updates `last_contacted_at` on clients table — must succeed atomically with the interaction insert
- Pipeline: `moveLead()` to `lost` stage requires `lostReason` — UI may not enforce this
- BulkMessageModal: sends SMS/email in loop without batch; large recipient list can timeout; `sendProgress` tracks progress

#### Cross-module dependencies
- Requires: nothing (core)
- Used by: events (client FK), alterations (client FK), dress_rental (assigned client), payments (client timeline), loyalty, CRM pipeline, tags

#### Test priority
P0 — core entity; client merge is particularly risky (data reassignment across 7+ tables)

---

## 3. Staff & Roles

**Screen file:** `src/pages/Settings.jsx` (Staff tab)
**Hook:** `src/hooks/useBoutique.js`
**DB tables:** `boutique_members`, `boutique_invites`

#### Happy path
1. Owner navigates to Settings → Staff tab (owner-only)
2. See current staff list (`getStaff()`) with name, initials, color, role
3. Edit staff member: update name, initials, color via `updateStaffMember()`
4. Invite new staff: enter email + select role → `sendInvite()` calls `send_invite` RPC → generates token, stores in `boutique_invites`
5. Invitee receives link `/join/:token` → JoinInvite.jsx validates token, creates boutique_members row
6. Cancel pending invite: `cancelInvite()` deletes from `boutique_invites`
7. Role controls: `canAccess(role, screen)` enforced in `goScreen()`; Settings tabs gated by `canAccessSettingsTab(role, tab)`

#### Edge cases & error paths
- Non-owner navigates to Staff tab → `canAccessSettingsTab('coordinator', 'staff')` returns false → tab hidden
- `front_desk` role: cannot see payments, alterations, inventory — `canAccess` returns false, `AccessDenied` rendered
- Invite to already-registered email: RPC behavior unclear — needs test
- Expired invite (>7 days typically): `getPendingInvites()` filters by `expires_at > now()` so not shown; but accept link still valid until DB check
- Staff member in two boutiques: role is per-boutique; switching boutique reloads staff list correctly via boutique.id re-effect
- `seamstress` role: can only access dashboard, calendar, schedule, alterations — attempting `events` screen shows `AccessDenied`
- `decorator` role: can only access dashboard, calendar, schedule, inv_full/inventory

#### Cross-module dependencies
- Requires: nothing (core)
- Used by: events (coordinator assignment), alterations (seamstress_id), appointments (staff_id), staff_sched, commissions

#### Test priority
P1 — role permissions are a security boundary; staff invite flow creates access

---

## 4. Settings (Boutique Profile, Automations, Packages, Modules)

**Screen file:** `src/pages/Settings.jsx`
**Hook:** `src/hooks/useBoutique.js`, `src/hooks/useModules.jsx`, `src/hooks/usePackages.js`
**DB tables:** `boutiques`, `boutique_modules`, `service_packages`

#### Happy path
1. **Profile tab** (owner only): edit boutique name, email, phone, address, Instagram, booking URL, primary color; save via `updateBoutique()`
2. **Automations tab**: toggle each of the 9 automations; saved to `boutiques.automations jsonb`
3. **Packages tab**: create/edit/archive `service_packages`; packages appear in CreateEventModal step 2
4. **Modules tab**: toggle optional modules on/off via `saveModuleSettings()`; plan-gated modules show UpgradeGate if plan insufficient; `validateDisableModule()` checks dependencies before disable
5. **Billing tab**: displays usage stats; plan cards with "Upgrade" button → `startCheckout(planName)` → Stripe redirect; "Manage subscription" → `openBillingPortal()` → Stripe portal
6. **Display tab** (all roles): toggle desktop/tablet mode; toggle language (EN/ES)
7. **Data tab** (owner): data export link

#### Edge cases & error paths
- `updateBoutique()` with no network → error returned, boutique state in AuthContext not updated (needs `reloadBoutique()` call post-save)
- Disable module that others depend on: `validateDisableModule()` returns list of dependents; UI should block or warn
- Enable module for plan that doesn't allow it: `planAllows(boutiquePlan, modulePlan)` → false → UpgradeGate fires `belori:show-upgrade` event → UpgradeModal
- `startCheckout()` fails (Stripe error) → `setError(e.message)` displayed; user stuck if not shown clearly
- Packages CRUD: `archivePackage()` sets `active=false`; archived packages should not appear in CreateEventModal — check filter
- `boutique?.primary_color` drives CSS variable `--brand-primary`; invalid hex → `hexToPale()` returns fallback `#FDF5F6`
- Language toggle: stored in `localStorage`; boutique setting is fallback — device preference wins
- Coordinator role navigates to settings → sees only packages, all_templates, display tabs; profile/staff/modules/billing hidden

#### Cross-module dependencies
- Requires: nothing (core)
- Used by: every module (modules gating), events (packages), billing (plan determines module access)

#### Test priority
P1 — module gating controls what staff can access; billing drives plan tier

---

## 5. Dress Rental

**Screen file:** `src/pages/DressRentals.jsx`
**Hook:** `src/hooks/useInventory.js`, `src/hooks/usePayments.js`
**DB tables:** `inventory`, `inventory_audit_log`

#### Happy path — Module gate check
- `isEnabled('dress_rental')` must be true; screen guard in NovelApp: `en('dress_rental') ? <DressRentals...> : <Placeholder>`

#### Happy path — Rental lifecycle
1. **Catalog tab**: browse gowns (category: `bridal_gown` or `quince_gown`); filter by status/color/category; grid or list view; pagination (40/page)
2. **New rental**: click "Rent" on a catalog item → RentDressModal → assign to client + event + deposit + pickup/return dates
3. `updateDress(id, { status: 'reserved', client_id, return_date, pickup_date })` → `logInventoryAudit()` records `reserved`
4. **Pickup**: confirm client collected dress → DressPickupModal → `updateDress(id, { status: 'picked_up' })` + optional deposit milestone via `createMilestone()`
5. **Active Rentals tab**: shows rented/picked_up dresses; overdue detection: `return_date < today`
6. **Returns tab**: dress return flow → DressReturnModal → inspect condition → `updateDress(id, { status: 'returned', condition })` + optional late fee milestone
7. Late fee: `lateFeeConfirm` modal shows calculated fee (`LATE_FEE_PER_DAY × daysLate`); staff can accept/waive
8. **Cleaning**: status → `cleaning` → `available` via DressLifecycleModal
9. `return_date_confirmed` flag for confirmed return appointments
10. **History tab**: all returned/cleaned dresses; filter by outcome
11. Barcode scanner: `BarcodeScanner` component → scans barcode → looks up dress by SKU
12. QR codes: `QRModal` generates per-dress QR code linking to dress detail

#### Edge cases & error paths
- Dress module disabled → `<Placeholder title="Module Disabled">` shown instead of DressRentals
- Rent a dress already in `rented` status → UI should block; no DB constraint prevents double-rent
- `return_date` in past with status `rented` → `counts.overdue++` and overdue badge in sidebar (via `sidebarBadges.inv_full`)
- `LATE_FEE_PER_DAY` is configurable via module config (`getModuleConfig('dress_rental')?.late_fee_per_day ?? 25`); if config not set, defaults to $25
- `logInventoryAudit()` is fire-and-forget after `updateDress()` success; if it fails, status is still changed but audit log has gap
- Category validation: only `bridal_gown` and `quince_gown` categories appear in DressRentals; other categories (arch, linen) are excluded by filter
- `allGowns` filter also catches legacy `cat` field for backward compatibility
- DamageAssessmentModal: records damage but does not automatically adjust rental fee unless late fee flow triggered

#### Cross-module dependencies
- Requires: events, clients
- Used by: dress_catalog (browse view), alterations (garment from rental), measurements (measurements for rental gown)

#### Test priority
P0 — rental lifecycle involves money (deposits, late fees) and physical asset tracking

---

## 6. Alterations

**Screen file:** `src/pages/Alterations.jsx`
**Hook:** `src/hooks/useAlterations.js`
**DB tables:** `alteration_jobs`, `alteration_work_items`

#### Happy path — Module gate check
- `isEnabled('alterations')` must be true; guard in NovelApp renderScreen

#### Happy path
1. Kanban board: 4 columns — `measurement_needed`, `in_progress`, `fitting_scheduled`, `complete`
2. Create new job: NewJobModal → garment description, client (select or create), event link, seamstress, deadline, price, work items from checklist
3. `createJob()`: inserts `alteration_jobs` row, then inserts `alteration_work_items` for each work item description
4. Drag card between columns → `updateJob(id, { status: newStatus })` (derived fields stripped before DB write)
5. Edit job inline: update price, deadline, seamstress, notes
6. Job timer: start/stop → `logTimeEntry(jobId, minutes, note)` → appends to `time_entries jsonb` array, increments `total_minutes`; displays effective $/hr rate
7. Cancel job: `cancelJob(id)` → sets `status='cancelled'`; card hidden from kanban
8. Delete job: `deleteJob(id)` → deletes `alteration_work_items` first (FK), then job
9. Real-time subscription: `alteration-jobs-rt-{boutique.id}` channel re-fetches on any change
10. EventDetail → AlterationsCard: shows linked jobs for the event; status can be updated inline

#### Edge cases & error paths
- Module disabled → `<Placeholder title="Module Disabled">`
- `updateJob()` strips `work`, `client`, `seamstress`, `daysUntil`, `event`, `work_items` from updates — these are derived/joined fields; if caller accidentally passes DB columns with these names, they are also stripped (risk)
- `deleteJob()` deletes work_items without `boutique_id` filter on `alteration_work_items` — relies on `job_id` uniqueness; should add boutique scoping
- `logTimeEntry()`: reads then writes (non-atomic); concurrent timer sessions on same job could lose entries; race window is small
- Seamstress assigned to job must be in `boutique_members`; if member removed, FK reference becomes stale (no cascade)
- Kanban limited to 300 most recent jobs; older jobs invisible — no "load more" mechanism
- `daysUntil` computed from `deadline || event.event_date`; if neither set, defaults to 999 (never urgent)
- Status `cancelled` hides from kanban by filter; no way to view cancelled jobs without code change
- Work item hints (price suggestions) are UI-only and do not enforce pricing

#### Cross-module dependencies
- Requires: events (event_id FK)
- Used by: measurements (alteration job link), EventDetail (AlterationsCard)

#### Test priority
P1 — core service workflow; job timer and work items drive billing accuracy

---

## 7. Decoration & Inventory

**Screen file:** `src/pages/Inventory.jsx`
**Hook:** `src/hooks/useInventory.js`
**DB tables:** `inventory`, `event_inventory`

#### Happy path — Module gate check
- `isEnabled('decoration')` must be true; guard: `en('decoration') ? <Inventory...> : <Placeholder>`

#### Happy path
1. Three views: grid, list, category-grouped; virtualized list via `@tanstack/react-virtual` for large inventories
2. Add item: AddDressModal → name, SKU (auto-generated by category prefix), category (from INV_CATS), color, size, price, deposit, tracking type
3. Valid categories enforced by DB CHECK constraint: 13 valid values
4. Item tracking types: `individual` (status field), `quantity` (totalQty/availQty/reservedQty), `consumable` (currentStock/minStock/restockPoint)
5. Edit item: DressLifecycleModal → update status, condition, notes
6. Rent item from Inventory: RentDressModal → assigns to client + event; `updateDress()` sets status + client_id
7. QR code generation: QRModal per item → scannable code linking to item detail
8. Import: ImportModal → CSV bulk import
9. Barcode scanner: camera-based scan → look up by SKU
10. Damage report: DamageAssessmentModal → record damage type/severity; stored in `inventory_audit_log`
11. Event decoration assignment: from EventDetail DecorationPlanner → `addDecoItem(inventoryId, qty, notes)` inserts `event_inventory` row
12. Low stock badge: `sidebarBadges.inv_full` counts items where `currentStock <= restockPoint` (consumable) or `availQty <= minStock` (quantity)

#### Edge cases & error paths
- Module disabled → Placeholder shown; `useInventory({ enabled: isEnabled('dress_rental') })` in NovelApp — note it's gated on `dress_rental` not `decoration` in NovelApp call; both modules use the same inventory data
- Adding item with invalid category → DB CHECK constraint violation; error from Supabase returned to `createDress()`
- `cat` column does not exist — sending `cat` in payload causes DB error; must use `category`
- `updateDress()` audit log: `client_name` is always null in the log call (`client_name: updates.client_id ? null : null`) — bug: client name never recorded in audit
- Virtualized list: row height must be consistent; variable content can cause rendering gaps
- Inventory limit: `fetchInventory()` has `.limit(500)`; boutiques with large catalogs lose items
- `createDress()` with duplicate SKU: no application-layer uniqueness check; DB may enforce uniqueness per boutique or not
- CSV import via ImportModal: no validation preview shown before import; malformed CSV could create bad records
- `event_inventory` quantity can be updated after assignment; no stock reservation decrement shown in `availQty` unless explicitly managed

#### Cross-module dependencies
- Requires: events (event_inventory FK), dress_rental (shared inventory table)
- Used by: dress_rental (gown subset), floorplan (linen assignments), purchase_orders (inventory_id FK), event_inventory, reports (inventory ROI)

#### Test priority
P1 — asset management; inventory corruption (wrong status, wrong category) has downstream effects

---

## 8. Payments & Milestones

**Screen file:** `src/pages/Payments.jsx`
**Hook:** `src/hooks/usePayments.js`
**DB tables:** `payment_milestones`, `payment_refunds`, `events` (paid column), `client_interactions`

#### Happy path
1. Navigate to `payments`; shows only unpaid milestones (`neq('status', 'paid')`) sorted by `due_date`
2. Filter by status (overdue vs pending), search by client name
3. Mark milestone paid: `markPaid(id, { paid_date, payment_method })`
   - Optimistic removal from list
   - DB update: `status='paid'`, `paid_date`
   - Recalculates `events.paid` by summing all paid milestones for event
   - Auto-completes event if past date + fully paid + status=active
   - Logs payment interaction to `client_interactions`
4. Send reminder: ReminderModal → copies SMS template to clipboard; `logReminder()` updates `last_reminded_at`, logs to client_interactions, fires `belori/payment.due_soon` Inngest event
5. Create new milestone: NewMilestoneModal → label, amount, due_date → `createMilestone()`
6. Delete milestone: `deleteMilestone(id)` — hard delete (no soft delete)
7. Payment plan generator: `generatePaymentPlan({ totalAmount, depositAmount, installmentCount, startDate, frequencyDays })` → batch create via `createMilestones()`
8. Refund: `logRefund({ event_id, milestone_id, amount, reason, void_milestone })` → inserts `payment_refunds`, optionally resets milestone to pending, recalculates `events.paid`
9. Tip: `logTip({ event_id, amount })` → increments `events.tip` + `events.paid`
10. Stripe payment link: if `stripe_payment_link_url` on milestone, shown in reminder modal

#### Edge cases & error paths
- `markPaid()` optimistic removal followed by DB error → rollback via `fetchPayments()` — list flickers
- Concurrent `markPaid()` from two staff on same milestone → second write wins; `events.paid` recalculated correctly by sum (idempotent)
- `events.paid` can exceed `events.total` if tip is added after full payment — not guarded
- Refund with `void_milestone=true` resets to `pending` but does not restore `paid_date` — that's correct
- Refund amount > amount paid → `events.paid` goes negative unless `Math.max(0, ...)` applied — it is applied (`Math.max(0, totalPaid - totalRefunded)`)
- `payment_milestones` has no `payment_method` column (per CLAUDE.md) — method is logged to `client_interactions` body only; not queryable later
- `logReminder()` fires Inngest event fire-and-forget; if `sendInngestEvent` fails, reminder is still logged but SMS not sent
- `generatePaymentPlan()` rounding: `Math.floor` for base installments, `Math.round` for last — sum may differ from `totalAmount` by pennies
- Deleting milestone on paid event → `events.paid` not recalculated (only recalculated on `markPaid`); could leave paid field stale
- Real-time subscription on `payment_milestones` — if Supabase Realtime drops, list goes stale without error

#### Cross-module dependencies
- Requires: events (event_id FK), clients (for interaction logging)
- Used by: reports (revenue), online_payments (Stripe links), accounting (export), EventDetail (milestones card)

#### Test priority
P0 — money flows; incorrect `events.paid` calculation directly impacts financial reporting

---

## 9. Schedule & Appointments

**Screen file:** `src/pages/ScheduleScreen.jsx`, `src/pages/AppointmentsScreen.jsx`, `src/pages/Calendar.jsx`
**Hook:** `src/hooks/useEvents.js` (useEvent.createAppointment), `src/hooks/useNotes.js` (useAppointmentsToday)
**DB tables:** `appointments`

#### Happy path
1. Navigate to `schedule` (alias for `appointments` and `staff_calendar`); three tabs: Appointments, Calendar, Staff
2. **Appointments tab**: today's appointments via `useAppointmentsToday()` → `.eq('date', today)`
3. **Dashboard NewAppointmentModal**: select event, type, date, time, staff, note → direct Supabase insert with `boutique_id`
4. **EventDetail createAppointment()**: inserts appointment, fires confirmation SMS if client opted in
5. **Calendar tab**: month view with events; drag-reschedule via `rescheduleEvent()` shifts event date + unpaid milestones + appointments by `deltaDays`
6. Appointment types: `measurement`, `try_on`, `final_fitting`, `pickup`, `consultation`, `other`
7. `AppointmentScheduler` component in EventDetail: schedules appointments with rule enforcement (`APPOINTMENT_TYPES`, `formatApptDateTime`, `appointmentRules`)
8. Appointment status: `scheduled` → `confirmed` → `done`/`no_show`/`cancelled`

#### Edge cases & error paths
- `date` column is `DATE`, `time` column is `TIME` — must not use `scheduled_at`; incorrect column name causes silent failure
- `note` is singular — `createAppointment()` accepts both `notes` and `note` parameters but stores only `note`
- Confirmation SMS: fired asynchronously with `.catch(() => {})` — failure is swallowed; no retry
- `rescheduleEvent()` shifts appointments via parallel `Promise.all`; if boutique_id mismatch, rows silently not updated
- `useAppointmentsToday()` uses JS `new Date()` for today — timezone ambiguity if boutique in different timezone
- Calendar drag on mobile: `@dnd-kit` must be configured for touch; if not, drag doesn't work on tablets
- Appointment with no event assigned: Dashboard modal requires event selection (`if (!eventId) return setErr('Select an event')`)
- `canAccess('front_desk', 'schedule')` → true; front desk can see appointments
- Two staff book same time slot: no conflict detection in application layer

#### Cross-module dependencies
- Requires: events, staff (staff_id FK)
- Used by: appt_booking (online booking syncs to appointments), Dashboard (today's appointments)

#### Test priority
P1 — appointment scheduling drives client experience; SMS confirmation is customer-facing

---

## 10. Dashboard

**Screen file:** `src/pages/Dashboard.jsx`
**Hook:** Uses data from `useEvents`, `usePayments`, `useNotes`, `useAppointmentsToday`
**DB tables:** reads from events, payment_milestones, appointments, tasks

#### Happy path
1. Loads eagerly (not lazy); receives all live data as props from NovelApp
2. Stats cards: total events, revenue (sum of paid milestones), active rentals, overdue payments
3. Today's appointments: `useAppointmentsToday()` — rendered with APPT_TYPE_CFG colors
4. New appointment button → NewAppointmentModal (direct Supabase insert — acceptable exception to hook rule per CLAUDE.md)
5. Upcoming events: next 7 days, sorted by `event_date`
6. Onboarding checklist: shown for new boutiques
7. `autoProgressEvents()` called once on mount → marks past-due fully-paid events completed
8. Focus mode toggle: via `useFocusMode()` — collapses sidebar?
9. Alert count badge: `useAlertCount({ events, payments, inventory })` drives notification bell

#### Edge cases & error paths
- `autoProgressEvents()` runs every time Dashboard mounts (navigation away + back); could double-fire if user navigates quickly — the `update` is idempotent (`status='completed'` on already-completed events is a no-op)
- `NewAppointmentModal` bypasses hooks — directly calls `supabase.from('appointments').insert()`; must include `boutique_id` manually (it does)
- Large event list (thousands): stats calculations are client-side `filter/reduce` — could be slow
- Payment stats based on `payments` prop (unpaid milestones only) — total paid revenue not visible on Dashboard without separate fetch

#### Cross-module dependencies
- Requires: events, payments, inventory, clients
- Used by: nothing (consumer only)

#### Test priority
P2 — display layer; stats derived from already-tested hooks

---

## 11. Point of Sale (POS)

**Screen file:** `src/pages/POSPage.jsx`
**Hook:** Direct Supabase calls from component (no dedicated hook); uses `usePackages`
**DB tables:** `pos_sales` (implied), `inventory` (for accessories)

#### Happy path — Module gate check
- `isEnabled('pos')` must be true; guard in NovelApp

#### Happy path
1. Navigate to `pos`; product grid with categories: All, Accessories, Services, Alterations, Custom
2. Accessories pulled from inventory (categories: jewelry, headpiece, veil, accessories)
3. Add items to cart; quantity adjustment
4. Custom item modal: enter name + price → adds to cart
5. Service packages from `usePackages()` available as quick-add
6. Tax rate: `DEFAULT_TAX_RATE = 8.5%`; can toggle tax on/off
7. Select client (optional): lookup by name/phone
8. Select payment method: Cash, Card, Zelle, Venmo, Check
9. Complete sale → ReceiptView shown with total, method, client name
10. Print receipt: `window.print()` with `PRINT_STYLE` injecting print CSS
11. "New sale" resets cart

#### Edge cases & error paths
- Module disabled → Placeholder
- No persistence hook — POS sales appear to write directly to DB from component; no centralized `usePOS` hook; audit trail unclear
- Tax calculation: `DEFAULT_TAX_RATE` is hardcoded; no boutique-configurable tax rate
- Cart with 0-price custom item: `price < 0` check prevents negative, but $0 item is allowed
- Receipt: `window.open()` may be blocked by browser popup blocker
- Client assignment optional: sale can proceed without client; no loyalty point award visible
- Payment with Venmo/Zelle: no external payment confirmation; relies on staff manually verifying
- Empty cart checkout: button should be disabled but guard must be verified
- Daily summary: not clearly shown; no end-of-day report visible in POS screen

#### Cross-module dependencies
- Requires: clients (optional client lookup), inventory (accessories)
- Used by: retail (product sales), accounting (export)

#### Test priority
P0 — money collection; receipt printing is customer-facing

---

## 12. Expense Tracking

**Screen file:** `src/pages/ExpensesPage.jsx`
**Hook:** `src/hooks/useExpenses.js`
**DB tables:** `expenses`

#### Happy path — Module gate check
- `isEnabled('expenses')` must be true

#### Happy path
1. Navigate to `expenses`; list sorted by date desc
2. Date range filter: this month / last 3 months / this year / all time
3. Category filter: supplies, marketing, staff, rent, utilities, flowers, alterations, other
4. Add expense: amount, date, category, description, optional event link
5. `createExpense()` → inserts with `boutique_id`; joins `events` for display
6. Edit expense: `updateExpense(id, updates)` — in-place update
7. Delete expense: `deleteExpense(id)`
8. Summary cards: total by category for selected date range

#### Edge cases & error paths
- Module disabled → Placeholder
- Expense linked to deleted event → orphan FK; `event:events(id, type, event_date)` join returns null; display must handle `null`
- Amount validation: no min/max enforced in hook; negative amounts possible
- No receipt upload implemented (listed as feature in registry but not in `useExpenses()`)
- `fetchExpenses()` has no limit; large expense history could be slow

#### Cross-module dependencies
- Requires: nothing (standalone)
- Used by: accounting (export), reports (profit per event calculation uses `expensesByEvent`)

#### Test priority
P2 — financial tracking; errors here affect P&L reports

---

## 13. Financial Reports

**Screen file:** `src/pages/Reports.jsx`
**Hook:** Direct Supabase queries + `usePayments` (paid milestones fetched separately), `useInventoryROI`, `useCommissions`
**DB tables:** `payment_milestones`, `expenses`, `pipeline_leads`, `events`, `clients`

#### Happy path — Module gate check
- `isEnabled('reports')` must be true

#### Happy path
1. Navigate to `reports`; multiple analytics sections
2. Revenue by period (12-month bar chart) — fetches `payment_milestones` separately including paid ones
3. Profit per event — joins `expensesByEvent`
4. Pipeline leads conversion funnel — fetches `pipeline_leads`
5. NPS overview — reads client ratings
6. Churn risk analysis
7. Heatmap (day-of-week × month booking patterns)
8. YoY comparison
9. Inventory ROI via `useInventoryROI()`
10. Commission overview via `useCommissions()`
11. Dress rental health stats
12. Damage overview
13. Forecast toggle: conservative/moderate/aggressive

#### Edge cases & error paths
- Module disabled → Placeholder
- Reports screen fetches paid milestones directly (`neq('status', 'paid')` excluded from main payments hook — Reports must fetch separately and does so via direct Supabase call)
- `UpgradeGate` wrapper: some advanced analytics sections gated by plan; if boutique on starter plan, sections hidden
- Large dataset: all milestones fetched without limit for revenue chart; could be slow for established boutiques
- Period filter affects display only (client-side); data already loaded
- Damage stats query: `damageStats.tableExists` flag — if `damage_reports` table not yet created, gracefully shows `tableExists: false`

#### Cross-module dependencies
- Requires: payments (milestone data), events, clients, expenses, inventory
- Used by: nothing

#### Test priority
P2 — read-only analytics; correctness matters for business decisions

---

## 14. Vendor Management

**Screen file:** `src/pages/VendorsPage.jsx`
**Hook:** `src/hooks/useVendors.js`, `src/hooks/useEventVendors.js`
**DB tables:** `vendors`, `event_vendors` (implied)

#### Happy path — Module gate check
- `isEnabled('vendors')` must be true

#### Happy path
1. Navigate to `vendors`; vendor list sorted by name
2. Add vendor: name, type, contact info, notes
3. `createVendor()` inserts with `boutique_id`; real-time subscription re-fetches
4. Edit vendor: `updateVendor(id, updates)` → in-place update
5. Delete vendor: `deleteVendor(id)` — hard delete
6. From EventDetail → EventVendorsCard: `useEventVendors(eventId)` — add/remove vendor assignments per event

#### Edge cases & error paths
- Module disabled → Placeholder
- Delete vendor with purchase orders referencing it → FK constraint; `deletePO` dependency
- Vendor deleted but still referenced in `event_vendors` → orphan rows (no cascade visible in hook)
- Real-time subscription: `vendors` table must have `boutique_id` column for filter to work
- `purchase_orders` module depends on `vendors` — disabling vendors should warn about purchase_orders dependency (validated by `validateDisableModule`)

#### Cross-module dependencies
- Requires: events (for event assignment)
- Used by: purchase_orders (vendor_id FK on POs)

#### Test priority
P2 — reference data; becomes P1 when purchase_orders used

---

## 15. Purchase Orders

**Screen file:** `src/pages/PurchaseOrders.jsx`
**Hook:** `src/hooks/usePurchaseOrders.js`
**DB tables:** `purchase_orders`, `purchase_order_items`, `inventory`

#### Happy path — Module gate check
- `isEnabled('purchase_orders')` must be true; depends on `vendors`

#### Happy path
1. Navigate to `purchase_orders`; list with status tabs
2. Create PO: select vendor (or free-text vendor name), auto-generated PO number, expected date, line items (item name, SKU, inventory link, quantity, unit cost)
3. `createPO()`: inserts header + line items; `boutique_id` on both tables
4. Status flow: draft → sent → partial/received → (cancelled)
5. `updatePO()`: change status, notes, expected date
6. Receive PO: `receivePO(poId, receivedItems)` → updates `quantity_received` per item; increments `inventory.currentStock` + `availQty` for linked inventory items
7. Delete PO: `deletePO(id)` — assumes cascade on items or items deleted separately
8. Real-time subscription on both `purchase_orders` and `purchase_order_items`

#### Edge cases & error paths
- Module disabled → Placeholder
- `receivePO()`: reads then writes to inventory (non-atomic); concurrent receives could double-count stock — race window exists between fetch and update
- PO with no vendor selected: `vendor_id: null`, `vendor_name` must be provided as free text; empty vendor name allowed
- Deleting PO with received items: if inventory was already incremented, deleting PO does not decrement inventory — stock corruption
- `quantity_received` update: `delta = quantityReceived - poItem.quantity_received` — relies on stale `po.items` from state; if another staff member receives items simultaneously, delta is wrong
- Empty line items PO: `total_amount: 0` is valid; no minimum line item validation
- PO number collision: `genPONumber()` uses timestamp + random 3-digit suffix; collision probability low but not zero

#### Cross-module dependencies
- Requires: vendors
- Used by: inventory (stock increment on receive)

#### Test priority
P1 — inventory stock changes are irreversible without manual correction; concurrent receive is a concurrency bug

---

## 16. Invoices & Billing Screen

**Screen file:** `src/pages/BillingScreen.jsx`, `src/pages/InvoiceCreateScreen.jsx`, `src/pages/InvoiceDetailScreen.jsx`
**Hook:** `src/hooks/useInvoices.js`
**DB tables:** `invoices`, `invoice_items`, `invoice_payment_schedule`, `invoice_payments`, `invoice_attachments`, `client_cards_on_file`

#### Happy path
1. Navigate to `billing` (alias: `invoices`); tabs for Invoices and Quotes
2. Filter by status: draft/sent/partial/paid/cancelled
3. Create invoice: 6-step wizard (InvoiceCreateScreen)
   - Step 0: find client by phone (ClientPhoneLookup)
   - Step 1: add line items from `INVOICE_ITEMS` catalog; custom amounts; quantity
   - Step 2: payment schedule (installments)
   - Step 3: card on file (for future charges)
   - Step 4: attach PDF form
   - Step 5: review + send
4. `createInvoice()`: generates invoice number via `generate_invoice_number` RPC; inserts invoice, items, payment schedule
5. Tax: optional 3% fee (`CREDIT_CARD_FEE_PCT`); billingual item names (EN/ES)
6. `markInvoiceSent()`: sets `status='sent'`, `sent_at`
7. `recordPayment()`: inserts `invoice_payments`, recalculates `paid_cents`, sets `status='paid'` or `'partially_paid'`
8. `cancelInvoice()`: sets `status='cancelled'`, `cancelled_at`

#### Edge cases & error paths
- `createInvoice()` can throw (not return error): `if (error) throw error` — caller must wrap in try/catch
- Invoice number generation via RPC: if RPC fails, falls back to `INV-{Date.now()}` — could produce non-sequential numbering
- Tax rate hardcoded at 3% (credit card fee, not sales tax): may not match jurisdiction requirements
- `recordPayment()`: `newPaid >= total_cents` check uses `>=` correctly; `status` becomes `'paid'` or `'partially_paid'`; no partial payment creates another milestone automatically
- `getInvoiceDetail()` fetches `card_on_file:client_cards_on_file(*)` — card data stored in DB; PCI compliance concern if storing full card numbers
- Screen route: `case 'invoices': return null` — resolves to `billing` via alias; direct navigation to `invoices` shows nothing until `goScreen` alias kicks in
- `InvoiceDetailScreen` rendered inline within `BillingScreen` (not as separate screen case)

#### Cross-module dependencies
- Requires: clients (client_id FK), events (optional event_id)
- Used by: online_payments (payment links), esign (contract attachments)

#### Test priority
P0 — money collection; invoice data integrity critical

---

## 17. SaaS Billing (Plan & Subscription)

**Screen file:** `src/pages/Settings.jsx` (Billing tab) — owner only
**Hook:** `src/hooks/useBilling.js`
**DB tables:** `boutiques` (plan_tier, subscription_status, stripe_customer_id, trial_ends_at)

#### Happy path
1. Settings → Billing tab (owner only)
2. Trial banner shows `trialDaysLeft` from `trial_ends_at`; urgent styling at ≤3 days
3. Upgrade: `startCheckout(planName)` → POST to `create-checkout-session` Edge Function → redirect to Stripe
4. Manage subscription: `openBillingPortal()` → POST to `billing-portal` Edge Function → redirect to Stripe portal
5. Plan tier determines module access via `planAllows(boutiquePlan, modulePlan)`

#### Edge cases & error paths
- Trial expired (`trialDaysLeft = 0`) → banner blocks with "Upgrade now"; modules still accessible until Stripe webhook updates `subscription_status`
- `past_due` status: banner shows "Payment failed"; "Update payment" button opens billing portal
- `canceled` status: "Your subscription was canceled"; all non-free features should be blocked (module gate)
- Stripe webhook must update `boutiques.subscription_status` — if webhook fails, boutique stays in wrong state
- `hasActiveSubscription = !!boutique?.stripe_customer_id` — this is a weak check; customer can exist in Stripe but subscription can be cancelled
- Non-owner navigates to billing tab: `canAccessSettingsTab('coordinator', 'billing')` returns false — tab hidden

#### Cross-module dependencies
- Requires: settings (plan drives module access)
- Used by: every module (planAllows)

#### Test priority
P0 — billing tier controls access to paid features; Stripe integration is revenue-critical

---

## 18. Expense-to-Accounting Export

**Screen file:** `src/pages/ModuleStubs.jsx` → `AccountingScreen`
**Hook:** No dedicated hook (stub)
**DB tables:** `expenses`, `payment_milestones`

#### Happy path — Module gate check
- `isEnabled('accounting')` must be true; requires `expenses` module

#### Happy path
1. Navigate to `accounting`; AccountingScreen renders with `payments` and `events` props
2. Export financial data as CSV/QuickBooks format
3. P&L summary view

#### Edge cases & error paths
- Module is a stub (`AccountingScreen` from ModuleStubs.jsx) — limited functionality
- Requires `expenses` module enabled as dependency; `validateDisableModule` should block disabling expenses if accounting is on

#### Cross-module dependencies
- Requires: expenses
- Used by: nothing

#### Test priority
P3 — stub implementation; full feature not built

---

## 19. Client Portal

**Screen file:** `src/pages/ClientPortalPage.jsx` (public route)
**Hook:** Direct Supabase calls using `portal_token`
**DB tables:** `events` (portal_token), `payment_milestones`, `invoices`

#### Happy path — Module gate check
- `isEnabled('client_portal')` must be true; depends on events, clients, esign

#### Happy path
1. Client navigates to `/portal/:token`
2. Token validated against `events.portal_token`
3. Client sees event summary, payment milestones, contracts
4. Stripe payment link for milestones (if `online_payments` enabled)
5. E-signature for contracts (if `esign` enabled)

#### Edge cases & error paths
- Public route — no authentication required; boutique_id must be derived from portal_token
- Invalid/expired token → 404 or error state shown
- Portal sends `clientEmail` welcome on event creation (in `useEvents.createEvent()`); if email send fails, portal still accessible
- `portal_token` generated by DB (presumably UUID); direct guessing is infeasible but tokens should not be reusable after event completion

#### Cross-module dependencies
- Requires: events, clients, esign
- Used by: online_payments (payment links)

#### Test priority
P1 — client-facing; token security critical

---

## 20. Data Export

**Screen file:** `src/pages/DataExport.jsx`
**Hook:** None (renders from props)
**DB tables:** reads all tables

#### Happy path — Module gate check
- `isEnabled('data_export')` must be true

#### Happy path
1. Navigate to `data_export`; receives `clients`, `events`, `payments`, `inventory` as props
2. Export each dataset as JSON or CSV
3. GDPR compliance: full data portability

#### Edge cases & error paths
- Props-based: only exports data already in memory (limited to hook fetch limits: 500 items each)
- Large boutiques with > 500 clients/events/items: export is incomplete
- No server-side export endpoint; all in browser memory → large exports could crash tab

#### Cross-module dependencies
- Requires: nothing
- Used by: nothing

#### Test priority
P3 — GDPR compliance important but limited by current implementation

---

## 21. QR Codes

**Screen file:** `src/pages/QRCodesPage.jsx`
**Hook:** None
**DB tables:** inventory (reads SKU/name)

#### Happy path
1. Navigate to `qr_labels`; generates QR codes for inventory items
2. Print or download QR labels

#### Edge cases & error paths
- `canAccess` for qr_labels: not in any role permission set other than owner (no, actually — it's a standalone route not in coordinator/front_desk sets); verify permissions.js
- QR code value: must point to correct URL with boutiqueId scoped path

#### Test priority
P3 — utility feature

---

## 22. Measurements (Module Stub)

**Screen file:** `src/pages/ModuleStubs.jsx` → `MeasurementsScreen`
**Hook:** `src/hooks/useMeasurements.js`
**DB tables:** `measurements` (implied)

#### Happy path — Module gate check
- `isEnabled('measurements')` must be true; requires `alterations`

#### Notes
- MeasurementsScreen is a stub from ModuleStubs.jsx; hook exists (`useMeasurements.js`) but screen is placeholder

#### Test priority
P3 — stub

---

## 23. Reviews & Reputation (Module Stub)

**Screen file:** `src/pages/ModuleStubs.jsx` → `ReviewsScreen`
**Hook:** None
**DB tables:** implied

#### Module gate check
- `isEnabled('reviews')` must be true; Inngest automation fires `reviewRequest` 24h after event completion

#### Test priority
P3 — stub; automation tested separately

---

## 24. Email Marketing (Module Stub)

**Screen file:** `src/pages/ModuleStubs.jsx` → `EmailMarketingScreen`
**Module gate check:** `isEnabled('email_marketing')` — requires `clients`, `sms_compliance`
**Test priority:** P3 — stub

---

## 25. SMS Compliance

**No dedicated screen** (screen: null in registry)
**DB tables:** `clients.comm_prefs jsonb` (opt-in/out per channel)

#### Happy path
- `comm_prefs.sms = false` on client → SMS skipped in `createAppointment()` and Inngest automations
- STOP/UNSTOP handling via Inngest SmsInboxPage (`src/pages/SmsInboxPage.jsx`)

#### Edge cases
- If `comm_prefs` is null (older clients), `comm_prefs?.sms !== false` → truthy → SMS sent (opt-in by default)
- SmsInboxPage: reads inbound messages; must update `comm_prefs.sms = false` on STOP keyword

#### Test priority
P1 — TCPA compliance; sending SMS to opted-out clients is a legal risk

---

## 26. Inngest Automations (9 automations)

**Screen file:** `src/pages/Settings.jsx` (Automations tab) for toggle
**DB tables:** `boutiques.automations jsonb`
**Edge functions:** `supabase/functions/inngest/index.ts`

#### Happy path
1. All 9 automations default ON; owner can toggle off via Settings → Automations
2. `sms24h` / `sms2h`: daily/hourly cron queries appointments, fires SMS via Twilio
3. `paymentReminder`: daily 10am UTC — finds milestones due in 3 days, SMS + email
4. `overdueAlert`: daily 8am UTC — finds overdue milestones at 1/7/14 days past due
5. `returnReminder`: daily 9am UTC — dress return due in 48h
6. `reviewRequest`: daily 11am UTC — 24h after event date; marks event completed via `updateEvent(id, { status: 'completed' })`; fires `belori/event.completed`
7. `winBack`: weekly Sunday noon — clients inactive 60+ days
8. `weeklyDigest`: weekly Monday 7am — email owner upcoming events + overdue payments
9. `belori/boutique.created`: event-driven onboarding sequence (welcome → day 3 → day 7 → day 14)

#### Edge cases
- Automation toggle stored in `boutiques.automations jsonb`; missing key = defaults to ON
- SMS sending requires TWILIO_* secrets set in Supabase; missing secrets = silent failure in Edge Function
- `reviewRequest` mutates event status: if an automation fires and marks event completed but boutique owner disputes it — no undo
- `belori/event.completed` fired both from `updateEvent()` client-side AND from `reviewRequest` automation — double-fire risk
- Inngest signing key required to verify webhook authenticity; if not set, any POST to inngest endpoint executes

#### Test priority
P1 — automated SMS/email is client-facing; incorrect automations cause compliance and UX issues

---

## 27. Consultation Screen

**Screen file:** `src/pages/ConsultationScreen.jsx`
**Hook:** Direct Supabase calls
**DB tables:** `appointments`

#### Happy path
1. Opened from EventDetail or QuickActionFAB with `consultationProps`; also standalone via `consultation` screen case
2. 8-step guided consultation checklist (greet, listen, try-on, record dress, check availability, create invoice, take deposit, record deposit, schedule fitting, sign contract)
3. Steps marked complete; AppointmentScheduler embedded for scheduling fitting
4. `consultationProps` cleared when navigating away from `consultation` screen (useEffect in NovelApp)

#### Edge cases
- Stale props: NovelApp clears `consultationProps` on non-consultation screens; if user navigates back quickly, props may be stale for one render cycle
- No persistence of consultation checklist progress; refresh loses state
- AppointmentScheduler embedded; appointment creation uses standard `createAppointment()` flow

#### Test priority
P2 — guided workflow; no data at risk

---

## 28. Global Search

**Screen file:** `src/components/GlobalSearch.jsx`
**Hook:** Direct Supabase calls
**DB tables:** `events`, `clients`, `inventory`

#### Happy path
1. Triggered by Cmd+K / Ctrl+K or sidebar search button; dispatched via `belori:open-search` event
2. Search across events (client name, type, venue), clients (name, phone, email), inventory (name, SKU)
3. Click result → navigates to relevant screen with `setScreen` + `setSelectedEvent`

#### Edge cases
- Search must scope to `boutique_id` on all three tables; if query missing scope → RLS blocks it anyway
- Empty search string → no results shown (not "all results")
- Real-time results: debounced search recommended; rapid typing could fire many queries

#### Test priority
P2 — UX feature; RLS is the safety net

---

## 29. My Tasks

**Screen file:** `src/pages/MyTasksPage.jsx`
**Hook:** `src/hooks/useNotes.js` (useAlertTaskCount), custom queries
**DB tables:** `tasks`, `client_tasks`

#### Happy path
1. Navigate to `my_tasks`; shows tasks from both `tasks` (event-linked) and `client_tasks`
2. Tasks with `alert=true` (tasks) or `is_alert=true` (client_tasks) surface as priority
3. Mark task done; filter by category
4. `alertTaskCount` drives `sidebarBadges.myTasks`

#### Edge cases
- `tasks` table has `alert` column; `client_tasks` has `is_alert` — different column names; test both
- No `priority` column on tasks; `alert` boolean is the priority flag (per CLAUDE.md)
- `client_tasks` has `done_at` and `done_by_name` for audit; `tasks` does not

#### Test priority
P2 — task management; alert count drives sidebar badge

---

## 30. Activity Feed

**Screen file:** `src/pages/ActivityFeed.jsx`
**Hook:** Direct Supabase queries
**DB tables:** `client_interactions`, `appointments`, `payment_milestones`

#### Happy path
1. Navigate to `activity_feed`; chronological log of all interactions across boutique
2. Filter by type (payment, note, appointment, SMS)

#### Edge cases
- No boutique_id scope verification in component — relies on Supabase RLS
- Large interaction history: no pagination shown; could be slow

#### Test priority
P3 — read-only audit; RLS is safety net

---

## 31. Promo Codes

**Screen file:** `src/pages/PromoCodesPage.jsx`
**Hook:** `src/hooks/usePromoCodes.js`

#### Happy path
1. Create promo code: code string, discount type (% or $), value, expiry, max uses
2. Apply to invoice or POS sale

#### Test priority
P2 — discount codes affect revenue amounts

---

## 32. Commissions

**Screen file:** `src/pages/CommissionsPage.jsx`
**Hook:** `src/hooks/useCommissions.js`

#### Happy path
1. Track staff commissions based on event sales
2. Report commissions by staff member for pay period

#### Test priority
P2 — financial; affects staff pay

---

## 33. Wedding Planner / Event Planning

**Screen file:** `src/pages/WeddingPlanner.jsx`, `src/pages/EventPlanning.jsx`
**Registry:** `event_planning` module, plan: `pro`, comingSoon: true

#### Notes
- Screen case `wedding_planner` → `WeddingPlannerComingSoon` component (not the real module)
- `EventPlanning.jsx` exists but is lazy-loaded from Events.jsx for planning board tab
- Module marked `comingSoon: true` — full test deferred until built

#### Test priority
P3 — coming soon

---

## 34. Multi-Location

**Screen file:** Location switcher in NovelApp topbar
**Hook:** `src/hooks/useLocations.js`
**DB tables:** `boutique_locations` (implied)

#### Happy path
1. If `locations.length > 1`, location switcher shown in main content area
2. `setActiveLocation()` switches context; subsequent queries should filter by location

#### Edge cases
- Module `multi_location` requires `pro` plan; most boutiques won't have this
- `useLocations()` returns empty array for single-location boutiques; switcher hidden

#### Test priority
P3 — advanced feature

---

## Module Gating — Cross-Cutting Concern

Every optional module screen in `renderScreen()` checks `en(moduleId)` before rendering:

```
case 'alterations':  en('alterations')    ? <Alterations...> : <Placeholder>
case 'inventory':    en('dress_rental')   ? <DressRentals...> : <Placeholder>
case 'inv_full':     en('decoration')     ? <Inventory...> : <Placeholder>
case 'vendors':      en('vendors')        ? <VendorsPage...> : <Placeholder>
case 'pos':          en('pos')            ? <POSPage...> : <Placeholder>
...
```

**Gaps identified:**
- `commissions`, `promo_codes`, `funnel`, `quote_builder`, `bulk_import` — NO module gate check in `renderScreen()`; these screens are always accessible regardless of module enablement or plan
- `qr_labels`, `schedule`, `calendar`, `my_tasks`, `help`, `activity_feed`, `client_lookup`, `roadmap` — also no module gate; these are implicitly always-on
- `sms_inbox` — no module gate; always accessible

**RLS gaps:**
- `useAlterations` deleteJob: `supabase.from('alteration_work_items').delete().eq('job_id', id)` — missing `.eq('boutique_id', boutique.id)` filter; RLS on that table must enforce this independently
- Dashboard `NewAppointmentModal`: direct insert includes `boutique_id: boutique.id` — correct
- Reports: some direct Supabase queries use `.eq('boutique_id', boutique.id)` explicitly; others rely on RLS only — verify all

---

## Test Execution Order Table

| Priority | Module | Test type | Reason |
|---|---|---|---|
| 1 | Auth & RLS | API (DB queries) | Security foundation; data isolation; all other tests depend on this |
| 2 | Boutique multi-tenancy | API | `boutique_id` scoping on every table; cross-tenant data leak would be catastrophic |
| 3 | Events — create | API + UI | Core entity; everything hangs off an event row |
| 4 | Clients — create + merge | API + UI | Core entity; merge is highest-risk mutation (7 table reassignment) |
| 5 | Payments — mark paid | API + UI | Money flow; `events.paid` recalculation must be correct |
| 6 | Payments — refund + tip | API | Money flow; negative balance guard; `events.paid` integrity |
| 7 | Invoices — create + record payment | API + UI | Money flow; throws on error (caller must catch) |
| 8 | SaaS Billing — plan upgrade | API + E2E | Revenue-critical; Stripe integration |
| 9 | POS — complete sale + receipt | API + UI | Money collection; print flow |
| 10 | Dress Rental — full lifecycle | API + UI | Asset tracking + late fee money flow |
| 11 | Module gating — all screens | UI | `planAllows()` + `isEnabled()` enforced everywhere |
| 12 | Role permissions — all roles | UI | `canAccess()` correct for all 5 roles; prevent privilege escalation |
| 13 | Staff — invite + accept | API + UI | Access control; invite token security |
| 14 | Alterations — create + kanban | API + UI | Core service; work item FK dependency |
| 15 | Purchase Orders — create + receive | API | Inventory stock mutation; concurrency risk |
| 16 | Inventory — add + status changes | API + UI | Asset tracking; category constraint enforcement |
| 17 | Appointments — create + SMS | API + UI | Client-facing; SMS opt-out compliance |
| 18 | SMS compliance — opt-out enforcement | API | TCPA legal risk |
| 19 | Inngest automations — SMS/email | API (Edge Fn) | Client-facing automated messages |
| 20 | Events — reschedule | API | Cascades to milestones + appointments |
| 21 | Events — duplicate | API | Multi-table copy; orphan risk |
| 22 | Client portal — token validation | API + UI | Public route; token security |
| 23 | Loyalty points — atomic RPC | API | Race condition protection; financial value |
| 24 | Global search — boutique scoping | API + UI | Cross-tenant search leak risk |
| 25 | Expenses — CRUD | API + UI | Financial data; accounting export dependency |
| 26 | Vendors — CRUD | API + UI | Reference data; purchase orders dependency |
| 27 | Financial reports — revenue accuracy | UI | Paid milestones fetched correctly; period filter |
| 28 | Settings — boutique profile save | API + UI | Core configuration |
| 29 | Settings — module toggle + dependency validation | UI | `validateDisableModule()` enforcement |
| 30 | Dashboard — auto-progress events | API | Silent state mutation on mount |
| 31 | Decoration/Inventory — event assignment | API + UI | event_inventory FK; quantity tracking |
| 32 | Consultation screen — step flow | UI | No data risk; workflow only |
| 33 | Data export — completeness | UI | Limited by 500-item hook cap; document gap |
| 34 | Commissions + Promo codes | UI | No module gate; verify financial accuracy |
| 35 | Activity feed, My Tasks, QR Codes | UI | Read-only / utility; low risk |
| 36 | Stubs (Measurements, Reviews, Email marketing, Accounting, Wedding Planner) | UI | Verify Placeholder shown when disabled; stub not broken |

---

## Critical Findings for Wave 2 Agents

**P0 Bugs/Risks found during analysis:**

1. **Alteration work items delete missing boutique_id scope** (`deleteJob`): `alteration_work_items` delete only uses `job_id`; relies entirely on RLS — must verify RLS policy exists on that table.

2. **PO receive race condition**: `receivePO()` reads inventory stock then writes increment; concurrent receives on same PO item will double-count stock. No optimistic locking or RPC.

3. **Client merge non-atomic**: `mergeClients()` uses `Promise.all` across 7 tables; if any reassignment fails after delete begins, data is in inconsistent state. No transaction.

4. **Invoice throws on error**: `createInvoice()` uses `throw error` not `return { error }` — callers must use try/catch; if they use destructuring `{ error }` pattern they will get an unhandled rejection.

5. **`events.paid` can exceed `events.total`**: `logTip()` adds tip to `paid` with no ceiling check; if event is already fully paid, `paid > total` breaks progress bar display.

6. **Inventory audit log `client_name` always null**: bug in `updateDress()` — `client_name: updates.client_id ? null : null` always writes null.

7. **`commissions`, `promo_codes`, `quote_builder`, `bulk_import` screens have no module gate** in `renderScreen()` — accessible to all authenticated users regardless of plan or module enablement.

8. **SMS sent to clients with null `comm_prefs`** (opt-in by default): older clients without `comm_prefs` set will receive SMS — may violate TCPA if they were never explicitly opted in.

9. **Portal welcome email can fail silently**: `supabase.functions.invoke('send-email', ...)` result is not awaited for error handling in `createEvent()`.

10. **Real-time subscription does not have boutique_id filter on `alteration_work_items`**: `usePurchaseOrders` subscribes to `purchase_order_items` with `boutique_id` filter — verify `alteration_work_items` channel also has filter.