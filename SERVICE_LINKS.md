# SERVICE_LINKS.md — Belori Service Integration Map

> **Purpose:** This file is the authoritative reference for how every module in Belori connects to every other module. It defines data relationships, event-driven triggers, UI navigation links, and dependency rules. When Claude Code builds any feature, this file must be consulted to ensure all cross-module connections are wired correctly. Paste alongside PRD.md and TECH_STACK.md at the start of every build session.

---

## The Golden Rule

**The Event is the central hub of everything.**

Every other module — inventory, alterations, payments, appointments, clients, packages, automations — exists in relation to an Event. Nothing in Belori is truly standalone. When you build any screen or feature, ask: "How does this connect back to its event?"

```
                        ┌─────────────────┐
                        │                 │
         ┌──────────────►     EVENT       ◄──────────────┐
         │              │   (hub of all)  │              │
         │              │                 │              │
         │              └────────┬────────┘              │
         │                       │                       │
    CLIENT                       │                    PACKAGE
         │              ┌────────┼────────┐              │
         │              │        │        │              │
         ▼              ▼        ▼        ▼              ▼
   PAYMENTS      INVENTORY  ALTERATIONS  APPOINTMENTS  AUTOMATIONS
         │              │        │        │
         ▼              ▼        ▼        ▼
    SMS LOG        QR CODES   STAFF    BOOKING LEADS
```

---

## Module Dependency Map

### What each module depends on (reads from)

| Module | Depends on |
|--------|-----------|
| **Event** | Client, Package (optional), Staff (coordinator) |
| **Payment milestones** | Event |
| **Appointments** | Event, Staff |
| **Alterations** | Event, Inventory item (dress), Staff (seamstress) |
| **Inventory items** | Category, Event (when assigned/reserved) |
| **Inventory assignments** | Inventory item, Event |
| **Dress rentals** | Inventory item (gown), Event |
| **Event tasks** | Event |
| **Event notes** | Event, Staff (author) |
| **Automation jobs** | Event, Client, Payment milestones, Appointments, Inventory |
| **SMS log** | Boutique, Client, related entity (event/payment/appointment) |
| **QR scan** | Inventory item, Boutique |
| **Booking leads** | Boutique (converts to Client + Event) |

### What each module triggers (writes to / notifies)

| Action | Triggers |
|--------|---------|
| Event created | Tasks generated, Appointments created (stubs), Automations enrolled, Dress reserved (if selected), Alteration job created (if selected), Milestones created |
| Payment marked paid | Event urgency recalculated, Task marked done, SMS log entry, Dashboard refreshed |
| Payment overdue | Inngest overdue alert scheduled, Event marked critical, Dashboard alert banner updated |
| Appointment scheduled | Inngest reminder jobs scheduled (24h + 2h SMS), Timeline updated on event detail |
| Appointment marked done | Task auto-completed (if matching), Event timeline updated |
| Dress reserved | Inventory status → reserved, Event dress rental card updated |
| Dress picked up | Inventory status → rented, Inngest return reminder scheduled |
| Dress returned | Inventory status → returned, Event rental card updated, Cleaning prompt shown |
| Dress cleaned | Inventory status → available, Event history logged |
| Alteration moved to complete | Payment task created, Event service card status updated |
| Booking lead submitted | Owner SMS notification, Lead record created |
| Booking lead converted | Event + Client created, Lead status → converted |
| Package applied to event | Services updated, Milestones regenerated, Event total updated |
| QR code scanned | Scan log entry, /scan/[id] page rendered with live item data |

---

## Full Connection Map — By Module

---

### 1. CLIENT ↔ Everything

**A Client is the person. An Event is their celebration.**

```
CLIENT
  ├── has many → EVENTS (one client can have multiple events over the years)
  ├── has many → BOOKING LEADS (before being converted)
  └── is referenced by → SMS LOG (all SMS sent to their phone)
```

**Creating a client:**
- From event creation Step 1 (inline mini-form if new client)
- From `/clients` → "+ New client"
- From booking lead conversion (auto-creates client record)

**Client lifetime value:**
- Calculated by summing all `payment_milestones.paidAmountCents` across all events where `clientId` matches
- Displayed on client detail page and clients table

**Deleting a client:**
- Soft delete only (`isActive = false`)
- Events remain — historical data preserved
- SMS log entries preserved

**Navigation links:**
- Client row → navigates to Client detail page
- Client detail page → lists all Events
- Event detail page → Client info card → links back to Client detail
- Event creation → Client selector → "Create new" link

---

### 2. EVENT ↔ PAYMENT MILESTONES

**Payments live inside events. An event's financial status is the sum of its milestones.**

```
EVENT (1)
  └── has many → PAYMENT MILESTONES (2–6 per event)
```

**On event create:**
```typescript
// Auto-generate milestones based on package OR event type
if (packageSelected) {
  milestones = generateFromPackageTemplate(package.milestoneTemplate, agreedPrice)
} else {
  milestones = generateDefaultMilestones(eventType, services, totalValue, eventDate)
}
// Insert all milestones with eventId
```

**When a milestone is marked paid:**
```typescript
// 1. Update milestone status → paid
// 2. Recalculate event.totalPaid (sum of all paid milestones)
// 3. Recalculate event urgency — may remove from critical list
// 4. Mark task done: "Collect [milestone label]" if exists
// 5. Update dashboard overdue total
// 6. Log to sms_log if reminder was pending
```

**When a milestone becomes overdue:**
```typescript
// Detected by daily Inngest cron (dueDate < today AND status = 'pending')
// 1. Create/update inventory_restock_alerts equivalent for payments
// 2. Add to event.blockingIssues array
// 3. Trigger dashboard alert banner if event is within 30 days
// 4. Schedule overdue reminder SMS (day 1, 7, 14)
// 5. Block post-event review request from firing
```

**Payment milestone → Event urgency formula:**
```typescript
function getEventUrgency(event: Event, milestones: Milestone[], appointments: Appointment[]): Urgency {
  const daysUntil = differenceInDays(new Date(event.eventDate), new Date())
  const hasOverdueMilestone = milestones.some(m => m.status === 'overdue')
  const hasMissingAppointment = appointments.some(a => a.status === 'not_scheduled' && isRequired(a.type, event.services))

  if (daysUntil <= 7 && (hasOverdueMilestone || hasMissingAppointment)) return 'critical'
  if (daysUntil <= 7) return 'near'
  if (daysUntil <= 14 && (hasOverdueMilestone || hasMissingAppointment)) return 'near'
  if (daysUntil <= 14) return 'normal'
  return 'normal'
}
```

**UI connections:**
- Event detail → right panel → Payment milestones card
- Payments screen → each row links to its Event
- Dashboard → "Payments due this week" → links to Payments screen filtered by event
- Event detail → Payment milestone "Remind →" → triggers SMS + logs to sms_log

---

### 3. EVENT ↔ APPOINTMENTS

**Appointments are time-stamped steps in an event's journey.**

```
EVENT (1)
  └── has many → APPOINTMENTS (5–12 per event, based on services)
```

**On event create — auto-generate appointment stubs:**
```typescript
const required = generateRequiredAppointments(services, eventType)
// Each is created with status = 'not_scheduled'
// They appear on the event timeline as gray placeholders
// They surface as "missing" warnings when event is ≤21 days away
```

**Appointment → Alteration connection:**
```typescript
// Alteration jobs have specific appointment IDs linked:
alterationJob.measurementsApptId = appointment.id  // when measurements scheduled
alterationJob.fitting1ApptId     = appointment.id  // when 1st fitting scheduled
alterationJob.fittingFinalApptId = appointment.id  // when final fitting scheduled

// When fitting appointment is marked done:
// → Check if alteration job should advance status
// → If final fitting done + seamstress approved → suggest moving to 'fitting_scheduled'
```

**Appointment → Automation connection:**
```typescript
// When appointment is SCHEDULED (scheduledAt is set):
await inngest.send({
  name: 'appointment.scheduled',
  data: { appointmentId, scheduledAt, clientPhone, boutiqueName }
})
// Inngest schedules:
//   - SMS to client 24h before (if automation_settings.sms_24h = true)
//   - SMS to client 2h before  (if automation_settings.sms_2h = true)

// When appointment is marked DONE:
// → Check if any event tasks should be auto-completed
// → Check if next required appointment should be surfaced as a task
```

**Missing appointment → blocking issue:**
```typescript
// Checked whenever event detail page loads:
const missingAppts = appointments
  .filter(a => a.status === 'not_scheduled')
  .filter(a => isRequired(a.type, event.services))
  .filter(a => differenceInDays(new Date(event.eventDate), new Date()) <= 21)

// Each missing appointment:
// → Appears in blocking issues banner (red strip on event detail)
// → Creates/updates a flagged task: "Schedule [type] appointment — URGENT"
// → Counts toward event urgency calculation
```

**UI connections:**
- Event detail → Timeline tab → all appointments in chronological order
- Event detail → Alteration service card → links to alteration job → Appointments tab
- Dashboard → "Today's appointments" card → links to Event detail
- Settings → Automation toggles → controls whether reminders fire

---

### 4. EVENT ↔ INVENTORY (DRESS RENTAL)

**One event can have one dress rental. One dress can only be in one event at a time.**

```
EVENT (1)
  └── has one → DRESS RENTAL RECORD
                    └── links to → INVENTORY ITEM (gown)
```

**On event create (if dress_rental service selected and dress chosen):**
```typescript
// 1. Check dress status === 'available' (with FOR UPDATE lock)
// 2. Create dress_rentals record
// 3. Update inventory_items.status → 'reserved'
// 4. Update inventory_items.currentEventId → event.id
// 5. Update inventory_items.returnDueDate → eventDate + 2 days
```

**Dress status changes → event effects:**
```typescript
// Dress reserved → Event detail: dress rental card shows dress name, pickup date, return date
// Dress picked up → Event: "Dress pickup" appointment auto-marked done (if date matches)
// Dress returned → Event: rental card shows return logged, condition
// Dress damaged on return → Event: flagged task created: "Follow up on dress damage"
// Dress cleaning complete → No event effect (event already complete)
```

**Dress rental → Payment milestone connection:**
```typescript
// Dress deposit is NOT a separate payment milestone
// It's recorded on dress_rentals.depositPaidCents
// But if deposit is not paid at pickup, a task is flagged:
// "Collect dress deposit ($300) — not yet paid"
```

**Conflict prevention between events:**
```typescript
// If two events try to reserve same dress:
// Second reservation will fail with: "Dress #BB-047 is reserved for Sophia Rodriguez (Wedding Mar 22)"
// Staff must either:
// a) Choose a different dress
// b) Wait for the dress to be returned
// c) Owner overrides (creates note explaining why)
```

**UI connections:**
- Event detail → right panel → Dress rental card → "View in inventory →" → inventory item detail
- Inventory card → "Reserved for: Sophia R." → links to Event detail
- Dashboard → "Log dress return" quick action → inventory return modal
- QR scan page → "Log return" button → return modal → updates both dress + event

---

### 5. EVENT ↔ INVENTORY (DECORATION & ALL OTHER ITEMS)

**An event can have many inventory items assigned to it. Items are returned post-event.**

```
EVENT (1)
  └── has many → INVENTORY ASSIGNMENTS
                      └── links to → INVENTORY ITEMS (decoration, accessories, etc.)
```

**On event create (or when decoration service is added):**
```typescript
// Items are NOT auto-assigned at event creation
// Instead, a task is created: "Assign decoration items for [event name]"
// Staff manually assigns items (or applies a decoration set)
```

**Decoration set applied to event:**
```typescript
// 1. For each item in the decoration set:
//    a. Check availability for event date
//    b. If available → create inventory_assignment record
//    c. Update item quantities (available - quantity, reserved + quantity)
// 2. If any item is unavailable → warn: "Gold metal arch is not available on Mar 22"
// 3. Add task: "Confirm all decoration items have been assigned"
```

**Event date approaching → decoration check:**
```typescript
// 7 days before event: check all assigned decoration items
// If any item is still 'reserved' (not delivered/set up):
// Create urgent task: "Confirm decoration items are loaded and ready for [event]"
```

**Post-event return:**
```typescript
// After event date passes:
// Inngest fires 'event.completed' (next day)
// → Creates task: "Log return of decoration items for [event]"
// → Lists all assigned items that have no returnedAt date
// Bulk return modal shows all items for the event
```

**UI connections:**
- Event detail → Decoration service card → "View items →" → filtered inventory by event
- Inventory → "By event" view → groups all items per event
- Inventory item → Assignments tab → shows all events this item has been used in
- Event creation → Package selector → decoration sets auto-assign items

---

### 6. EVENT ↔ ALTERATIONS

**An alteration job belongs to an event and (optionally) to a specific dress.**

```
EVENT (1)
  └── has many → ALTERATION JOBS (typically 1–3 per event)
                      └── optionally links to → INVENTORY ITEM (dress)
                      └── links to → STAFF (seamstress)
                      └── links to → APPOINTMENTS (fittings)
```

**On event create (if alterations service selected):**
```typescript
// 1. Create alteration job with status = 'measurement_needed'
// 2. Link to dress if dress was also reserved
// 3. Set deadline = eventDate - 5 days
// 4. Create appointment stubs: measurements, fitting_1, fitting_final
// 5. Create tasks:
//    - "Schedule measurements appointment"
//    - "Schedule 1st fitting"
//    - "Schedule final fitting (must be done by [deadline])"
```

**Alteration status → Event service card:**
```typescript
// Event detail → Alterations service card shows:
const alterationStatus = {
  'measurement_needed': { label: 'Measurements needed', color: 'amber' },
  'in_progress':        { label: 'Work in progress', color: 'blue' },
  'fitting_scheduled':  { label: 'Fitting scheduled', color: 'purple' },
  'complete':           { label: 'Complete', color: 'green' },
}
// If deadline is ≤7 days and not complete → 'Urgent: final fitting needed', red
```

**Alteration job → Urgency → Dashboard alert:**
```typescript
// If alteration job is critical (event ≤7d, not fitting_scheduled or complete)
// AND final fitting has no scheduledAt date:
// → Event marked critical
// → Dashboard alert banner includes: "Final fitting not yet scheduled"
// → Blocking issues banner on event detail shows the specific job
```

**Alteration complete → Payment task:**
```typescript
// When job marked complete:
// → If job.paidAt is null:
//   Create flagged event task: "Collect alteration payment — $[price]"
// → Update event detail alteration card to show: "Complete · Payment pending"
```

**Dress link — alteration + rental sharing the same dress:**
```typescript
// Both alterationJob.dressId and dressRental.dressId point to same inventory item
// This means on the event detail:
// - Dress rental card shows: "#BB-047 · Reserved · Pickup Mar 21"
// - Alterations card shows: "Hem, bustle, waist · Gown #BB-047 · Ana R."
// The dress SKU creates a visual connection between both service cards
```

**UI connections:**
- Event detail → Alterations service card → "View job →" → alteration job detail panel
- Alterations screen → kanban card → links to Event detail
- Event detail → Timeline tab → fitting appointments show alteration context
- Event detail → Tasks tab → fitting tasks link to Alterations module

---

### 7. EVENT ↔ PACKAGES

**A package is a template. When applied, it writes directly to the event.**

```
PACKAGE (template)
  └── applied to → EVENT (1) via event_packages snapshot
                        → writes services array
                        → generates payment milestones
                        → sets totalValue
```

**Package application — what changes on the event:**
```typescript
// Applying a package to an event:
// 1. Record snapshot in event_packages (name, price, services at time of apply)
// 2. Update event.services = package.services
// 3. Update event.totalValue = agreedPrice
// 4. Delete existing PENDING milestones (keep any already-paid milestones)
// 5. Generate new milestones from package.milestoneTemplate
// 6. Increment package.usageCount
// 7. Revalidate event detail page

// What does NOT change:
// - Existing paid milestones stay as-is
// - Existing appointments stay as-is
// - Existing tasks stay as-is
```

**Package change warning:**
```typescript
// If event already has paid milestones and staff tries to change package:
// Show warning: "You have $X already paid. Changing packages will regenerate 
// remaining milestones. Paid milestones will not be affected."
```

**Event type → Package filter:**
```typescript
// Packages filtered to matching event type during creation and apply modal:
const matchingPackages = packages.filter(p =>
  p.eventType === 'both' ||
  p.eventType === event.type
)
```

**UI connections:**
- Event creation Step 2 → "Apply a package" section → package selector
- Event detail → Package badge at top → "Change package →" link
- Settings → Packages → "Used in N events →" → filtered events list
- Dashboard → "Create package" quick action → Settings/Packages

---

### 8. EVENT ↔ CLIENTS ↔ BOOKING LEADS

**The journey: Lead → Client → Event**

```
BOOKING LEAD (form submission)
  └── converted to → CLIENT (new record created)
                         └── then → EVENT (linked to client)
```

**Lead conversion flow:**
```typescript
// Staff reviews lead at /leads or via SMS notification
// Taps "Convert to event →"
// Opens event creation modal with:
//   - Client fields pre-filled from lead data (name, phone, email, event type, date)
//   - Fields marked "From booking request" label
//   - Staff edits if needed, then confirms

// On confirm:
// 1. Create client record (if doesn't already exist — check by phone number)
// 2. Create event record
// 3. Update booking_lead.status → 'converted'
// 4. Update booking_lead.convertedEventId → event.id
// 5. Send welcome SMS to client (if automation on)
```

**Client → multiple events:**
```typescript
// A client (e.g. Elena Rodriguez) may:
// - Come in 2025 for her daughter Sophia's wedding
// - Come back 2026 for daughter Maria's quinceañera
// Both events link to the same client record
// Client lifetime value sums across ALL their events
```

**UI connections:**
- Booking leads list → "Convert →" button → event creation modal (pre-filled)
- Client detail page → "Events" tab → all events for this client
- Event detail → Client info card → "View full profile →" → client detail
- Clients table → "View →" button → navigates to most recent event (or client detail)

---

### 9. EVENT ↔ AUTOMATIONS (INNGEST)

**Events enroll in automations. Automations reference events, clients, and related records.**

```
EVENT (created/updated)
  └── triggers → INNGEST EVENTS
                      └── schedules → AUTOMATION JOBS
                                          └── fires → SMS LOG entries
                                                           └── reaches → CLIENT (SMS)
```

**Inngest events fired and what triggers them:**

| Inngest event | Fired when | Schedules |
|--------------|-----------|-----------|
| `event.created` | New event created | Payment reminders, return reminder, review request |
| `appointment.scheduled` | Appointment gets a scheduledAt date | 24h SMS, 2h SMS |
| `dress.picked_up` | Dress rental marked picked up | Return reminder SMS (48h before return) |
| `payment.overdue` | Daily cron detects overdue milestone | Day 1, 7, 14 overdue SMS |
| `event.date.passed` | Daily cron, event date is yesterday | Review request SMS (24h delay, if gate passes) |
| `client.inactive` | Weekly cron, 60+ days no activity | Win-back SMS |

**Automation gate checks (before sending any SMS):**
```typescript
async function shouldSendAutomation(type: AutomationType, boutiqueId: string): Promise<boolean> {
  const settings = await getAutomationSettings(boutiqueId)
  const gateMap = {
    'sms_24h':            settings.sms24h,
    'sms_2h':             settings.sms2h,
    'payment_reminder':   settings.paymentReminder,
    'overdue_alert':      settings.overdueAlert,
    'return_reminder':    settings.returnReminder,
    'review_request':     settings.reviewRequest,
    'win_back':           settings.winBack,
    'weekly_digest':      settings.weeklyDigest,
  }
  return gateMap[type] ?? false
}
```

**Review request gate — cross-module checks:**
```typescript
async function passesReviewGate(eventId: string): Promise<boolean> {
  const [event, milestones, notes] = await Promise.all([
    getEvent(eventId),
    getMilestones(eventId),
    getAlertNotes(eventId),
  ])

  // Gate 1: No overdue payments at event time
  const hadOverdueAtEventTime = milestones.some(m =>
    m.status === 'overdue' && new Date(m.dueDate) <= new Date(event.eventDate)
  )
  if (hadOverdueAtEventTime) return false

  // Gate 2: No alert notes on event
  if (notes.length > 0) return false

  // Gate 3: Client hasn't already received a review request
  const alreadySent = await checkSmsLog(event.clientId, 'review_request')
  if (alreadySent) return false

  return true
}
```

**SMS log → Event connection:**
```typescript
// Every SMS sent includes relatedEntityId (event, milestone, appointment, or dress rental)
// This allows the event detail to show: "Sent payment reminder to Sophia Rodriguez on Mar 12"
// And the payments screen to show: "Last reminder sent 3 days ago"
```

**UI connections:**
- Settings → Automation toggles → controls all automation behavior globally
- Event detail → Notes feed → shows automated SMS entries alongside staff notes (future)
- Payments screen → "Send reminder" button → triggers overdue SMS + logs it
- SMS log audit → viewable in Settings → "Message history" (future screen)

---

### 10. INVENTORY ↔ QR CODES ↔ SCAN PAGE

**Every inventory item has a QR code. Scanning it links back to the live item record.**

```
INVENTORY ITEM (1)
  └── has one → QR CODE URL (belori.app/scan/[itemId])
                    └── scan navigates to → SCAN PAGE
                                                └── shows live item data
                                                └── triggers → STATUS CHANGES
                                                └── logs to → QR_SCAN_LOG
```

**QR code → inventory item link:**
```typescript
// QR code encodes: https://belori.app/scan/{item.id}
// ALWAYS uses item.id (UUID), never SKU
// Reason: SKU is editable, UUID is permanent
// Item renamed or re-SKU'd → QR code still works

// /scan/[itemId] page:
// 1. Fetch inventory_items by id (with currentEvent + client)
// 2. Show item details + current status
// 3. Show contextual actions based on status
// 4. Log scan to qr_scan_log

// Actions from scan page write back to inventory:
// "Mark picked up" → calls markDressPickedUp()  → updates dress + rental record + event
// "Log return"     → calls logDressReturn()      → updates dress + rental + creates event task if damaged
// "Reserve"        → calls reserveDress()        → updates dress + creates rental record
```

**QR → Event chain on scan:**
```typescript
// If item is reserved/rented:
// Scan page shows → "Reserved for: Sophia Rodriguez · Wedding Mar 22"
// "View event →" link navigates to event detail
// This allows floor staff to instantly see the event context from just scanning the dress
```

**UI connections:**
- Inventory grid → each card → "Print QR" button → single dress QR modal
- Inventory → QR Codes tab → bulk print page
- Post-import completion screen → "Generate QR codes →" → QR codes page
- Dress detail panel → QR Code section → live QR preview + print button
- /scan/[id] → "View in inventory →" → inventory item detail
- /scan/[id] → "View event →" → event detail (if item is assigned)

---

### 11. STAFF ↔ EVERYTHING

**Staff are assigned to events (coordinator), alterations (seamstress), and appointments.**

```
STAFF MEMBER
  ├── assigned as coordinator → EVENT (events.coordinatorId)
  ├── assigned as seamstress  → ALTERATION JOB (alterationJobs.seamstressId)
  ├── assigned to perform     → APPOINTMENT (appointments.staffId)
  └── authored               → EVENT NOTES (eventNotes.authorId)
                              → CONDITION LOG entries
                              → STATUS LOG entries
```

**Staff role permissions:**
```typescript
const ROLE_PERMISSIONS = {
  owner: {
    canViewAllEvents: true,
    canEditPricing: true,
    canDeleteItems: true,
    canViewPayments: true,
    canManageStaff: true,
    canReverseAlterationStatus: true,
    canOverrideAvailability: true,
  },
  coordinator: {
    canViewAllEvents: true,
    canEditPricing: false,
    canDeleteItems: false,
    canViewPayments: true,
    canManageStaff: false,
    canReverseAlterationStatus: false,
    canOverrideAvailability: false,
  },
  seamstress: {
    canViewAssignedAlterations: true,
    canViewEventBasics: true, // name, date, venue — not financials
    canViewPayments: false,
    canManageInventory: false,
    canUpdateAlterationStatus: true,
    canAddNotes: true,
    canUploadPhotos: true,
  },
  front_desk: {
    canViewAllEvents: true,
    canManageInventory: true,
    canLogReturns: true,
    canViewPayments: false,
    canManageStaff: false,
  },
  decorator: {
    canViewAssignedEvents: true, // only events assigned to them
    canViewDecorationItems: true,
    canViewPayments: false,
    canManageStaff: false,
  },
}
```

**Staff utilization — dashboard widget:**
```typescript
// Dashboard "Staff today" widget reads:
// 1. Today's appointments (appointments.staffId = staff.id, date = today)
// 2. Active alteration jobs (alterationJobs.seamstressId = staff.id, status != complete)
// 3. Calculates utilization % = assignedTasks / maxCapacity
```

---

### 12. PACKAGES ↔ INVENTORY (DECORATION SETS)

**Packages define service bundles. Decoration sets define item bundles. Both apply to events.**

```
PACKAGE
  └── includes service: 'decoration'
         └── can reference → DECORATION SET (optional)
                                  └── auto-assigns → INVENTORY ITEMS

DECORATION SET
  └── contains → INVENTORY ITEMS (with default quantities)
  └── applied to → EVENT via inventory_assignments
```

**Connection:**
```typescript
// A package can optionally have a decorationSetId
// When package is applied to event AND decorationSetId exists:
// 1. Apply package (services, milestones, totalValue)
// 2. ALSO apply decoration set (assign all items to event)
// Staff can edit/remove items before confirming

// This is optional — packages can exist without a decoration set
// And decoration sets can be applied independently of packages
```

---

### 13. EVENT ↔ TASKS ↔ ALL MODULES

**Tasks are the to-do list for an event. They're auto-generated by every module and checked off as work proceeds.**

```
MODULE ACTION
  └── creates → EVENT TASK
                    └── lives on → EVENT (tasks checklist tab)
                    └── can be manually checked → by any staff member
```

**Auto-task generation map:**

| Trigger | Task created | Category | Alert? |
|---------|-------------|---------|--------|
| Event created | "Send welcome message to client" | Client | No |
| Event created + dress_rental | "Reserve dress for [client]" | Rental | No |
| Event created + alterations | "Schedule measurements appointment" | Fitting | No |
| Event created + alterations | "Schedule final fitting (5+ days before event)" | Fitting | Yes |
| Event created + decoration | "Assign decoration items for event" | Deco | No |
| Event created + decoration | "Collect decoration deposit" | Payment | Yes |
| Payment overdue | "Collect [label] — X days overdue" | Payment | Yes |
| Alteration complete + unpaid | "Collect alteration payment — $X" | Payment | Yes |
| Final fitting not scheduled ≤14d | "URGENT: Schedule final fitting" | Fitting | Yes |
| Dress returned with damage | "Follow up on dress damage" | Rental | Yes |
| Missing required appointment ≤21d | "Schedule [appointment type]" | Fitting | Yes |
| Post-event | "Log return of decoration items" | Deco | No |

**Task → module navigation:**
```typescript
// Each task can have an optional deepLinkScreen and deepLinkId
// Tapping task label navigates to the relevant module screen:
const taskDeepLinks = {
  'Reserve dress':        { screen: '/inventory', filter: 'available' },
  'Schedule fitting':     { screen: '/alterations', id: alterationJobId },
  'Collect payment':      { screen: '/payments', id: milestoneId },
  'Assign decoration':    { screen: '/inventory', filter: 'by-event' },
  'Log return':           { screen: '/inventory/return', eventId },
}
```

---

### 14. BOOKING PAGE ↔ EVERYTHING

**The public booking page is the entry point. Its output feeds the entire system.**

```
PUBLIC /book/[slug]
  └── form submission → BOOKING LEAD record
                              └── owner SMS notification
                              └── client confirmation SMS
                              └── staff converts lead to → CLIENT + EVENT
                                                                └── all event machinery starts
```

**Boutique identification:**
```typescript
// /book/[slug] fetches boutique by slug field
// Displays boutique name, logo, contact info, services offered
// Form submission creates booking_lead with boutique_id

// Slug is set in Settings → "Public booking URL"
// e.g. "bella-bridal" → belori.app/book/bella-bridal
```

**Language toggle:**
```typescript
// Booking page supports EN/ES toggle
// All labels, placeholders, error messages, confirmation text in both languages
// Client's selected language saved to client.preferredLanguage
// Future SMS to this client will use their preferred language
```

---

## Data Flow Diagrams

### New client books → full event lifecycle

```
1. CLIENT submits booking form at belori.app/book/bella-bridal
   └── BOOKING LEAD created (status: new)
   └── SMS → Owner: "New booking request from Sophia R. for Wedding Mar 22"

2. STAFF converts lead
   └── CLIENT record created (Sophia Rodriguez, phone, email)
   └── EVENT created (Wedding Mar 22, all services selected)
   └── PACKAGE applied → MILESTONES generated (4 milestones)
   └── APPOINTMENT stubs created (10 required appointments)
   └── TASKS generated (12 tasks across all services)
   └── ALTERATION JOB created (status: measurement_needed)
   └── DRESS reserved (#BB-047)
   └── INNGEST event.created fires → automations enrolled
   └── Welcome SMS → Sophia

3. EVENT progresses through services
   └── APPOINTMENTS scheduled one by one
       └── Each → Inngest schedules 24h + 2h SMS reminders
   └── MEASUREMENTS taken → Alteration status: in_progress
   └── MILESTONE 1 paid ($1,700 deposit)
       └── Event urgency recalculates
       └── Task "Collect booking deposit" auto-checked
   └── 1ST FITTING done → appointment marked done
   └── 2ND FITTING done → appointment marked done
   └── FINAL FITTING scheduled
       └── Appointment stub → becomes scheduled
       └── Event urgency: "near" (fitting now scheduled)

4. EVENT approaches (≤7 days)
   └── Inngest daily cron checks all events
   └── If DECORATION DEPOSIT still pending → overdue alert fires
   └── Dashboard alert banner shows Sophia as critical
   └── Blocking issues banner on event detail

5. EVENT DAY
   └── DRESS picked up Mar 21
       └── Dress status: rented
       └── Inngest: return reminder scheduled for Mar 23 (48h before Mar 24)
   └── DECORATION setup done
   └── Event happens

6. POST EVENT
   └── Daily cron: event date has passed
   └── DRESS RETURN logged (Mar 24)
       └── Dress: returned → cleaning → available
       └── Rental record complete
   └── DECORATION ITEMS returned
       └── Inventory assignments closed
   └── FINAL PAYMENTS collected
   └── Inngest: review gate checked → SMS sent to Sophia
   └── EVENT status → complete
```

---

### Urgency propagation chain

```
MILESTONE becomes overdue
  │
  ├── event.urgency recalculated → potentially 'critical'
  │
  ├── dashboard alert banner → shows if event ≤30 days
  │
  ├── event card border → red
  │
  ├── event detail → blocking issues banner → shows specific milestone
  │
  ├── tasks checklist → "Collect [milestone] — X days overdue" (alert=true)
  │
  └── Inngest overdue alert → SMS to client (day 1, 7, 14)
```

```
FINAL FITTING not scheduled within 21 days of event
  │
  ├── alteration job urgency → 'high' or 'critical'
  │
  ├── event.blockingIssues → "Final fitting not scheduled (due [date])"
  │
  ├── event detail → blocking issues banner
  │
  ├── tasks checklist → "Schedule final fitting — URGENT" (alert=true, red)
  │
  ├── alteration kanban card → red border
  │
  └── dashboard alert banner → if event ≤7 days
```

---

## Shared Utility Functions

These functions are used across multiple modules. Define them in `lib/utils/` and import everywhere:

```typescript
// lib/utils/urgency.ts
export function getEventUrgency(event, milestones, appointments): EventUrgency
export function getAlterationUrgency(job, eventDate): AlterationUrgency
export function isReturnOverdue(rental): boolean
export function getReturnOverdueDays(rental): number

// lib/utils/autoTasks.ts
export function generateDefaultTasks(services, clientName): Task[]
export function generateRequiredAppointments(services, eventType): Appointment[]
export function generateDefaultMilestones(type, services, total, eventDate): Milestone[]

// lib/utils/permissions.ts
export function canStaffPerformAction(staff, action): boolean
export function filterEventsByRole(events, staff): Event[]

// lib/utils/formatters.ts
export function formatCents(cents): string          // "$1,700"
export function formatDate(date): string            // "Mar 22, 2026"
export function formatPhone(phone): string          // "(956) 214-8830"
export function getDaysUntil(date): number
export function getCountdownLabel(days): string     // "6 days" | "Today!" | "2 weeks"

// lib/utils/sms.ts
export function buildPaymentReminderSms(milestone, client, boutique): string
export function buildReturnReminderSms(rental, dress, client, boutique): string
export function buildAppointmentReminderSms(appointment, event, client, boutique): string
export function buildWelcomeSms(client, boutique): string
export function buildReviewRequestSms(event, client, boutique): string

// lib/utils/inventory.ts
export function checkItemAvailability(itemId, eventDate, quantity): AvailabilityResult
export function generateSKU(boutiqueId, categorySlug): string
export function getCategoryPrefix(categorySlug): string
```

---

## Navigation Link Reference

Every screen must implement these cross-module navigation links:

### From Dashboard
| Click target | Navigates to |
|-------------|-------------|
| Alert banner "Act now →" | Event detail (critical event) |
| Appointment row | Event detail |
| Event row | Event detail |
| Payment row | Payments screen (filtered to event) |
| "Log dress return" quick action | Inventory — return modal |
| "New dress rental" quick action | Inventory — reserve modal |

### From Events List
| Click target | Navigates to |
|-------------|-------------|
| Event card | Event detail |
| Service tag chip | Module screen for that service |

### From Event Detail
| Click target | Navigates to |
|-------------|-------------|
| "← Events" breadcrumb | Events list |
| Client name in hero | Client detail page |
| Dress rental card "View rental →" | Inventory item detail |
| Alterations card "View job →" | Alteration job detail |
| Payment milestone "Remind →" | Triggers SMS (no navigation) |
| Payment milestone row | Payments screen |
| Timeline appointment | Appointment edit modal |
| Task row (with deep link) | Relevant module screen |

### From Inventory
| Click target | Navigates to |
|-------------|-------------|
| Dress card "Reserved for: [name]" | Event detail |
| Item card → assign to event | Event creation / event selector |
| QR code button | QR code print modal |
| Import button | Import modal |

### From Alterations
| Click target | Navigates to |
|-------------|-------------|
| Kanban card client name | Event detail |
| Kanban card event text | Event detail |

### From Payments
| Click target | Navigates to |
|-------------|-------------|
| Payment row client name | Event detail |
| Payment row event text | Event detail |
| "Send reminder" | Triggers SMS (toast confirmation) |

### From Clients
| Click target | Navigates to |
|-------------|-------------|
| Client row "View →" | Most recent active event detail |
| Client detail → event row | Event detail |

### From QR Scan page (/scan/[id])
| Click target | Navigates to |
|-------------|-------------|
| "View event →" | Event detail |
| "View in inventory →" | Inventory item detail |
| Action buttons | Action modal (return, pickup, etc.) |

---

## Revalidation Map

When any Server Action writes data, these Next.js paths must be revalidated:

```typescript
// After event created/updated:
revalidatePath('/dashboard')
revalidatePath('/events')
revalidatePath(`/events/${eventId}`)

// After milestone paid/overdue:
revalidatePath('/dashboard')
revalidatePath('/payments')
revalidatePath(`/events/${eventId}`)

// After appointment scheduled/done:
revalidatePath(`/events/${eventId}`)
revalidatePath('/dashboard') // updates "Today's appointments"

// After dress status change:
revalidatePath('/inventory')
revalidatePath(`/events/${eventId}`) // updates dress rental card
revalidatePath('/dashboard') // updates stats

// After alteration status change:
revalidatePath('/alterations')
revalidatePath(`/events/${eventId}`) // updates alterations service card

// After inventory item assigned:
revalidatePath('/inventory')
revalidatePath(`/events/${eventId}`)

// After package applied:
revalidatePath(`/events/${eventId}`)
revalidatePath('/payments') // milestones regenerated

// After client created/updated:
revalidatePath('/clients')
revalidatePath(`/clients/${clientId}`)
revalidatePath(`/events/${eventId}`)

// After automation settings changed:
revalidatePath('/settings')
// Note: does NOT revalidate events — automation settings
// are checked at send-time, not stored on events
```

---

## Error Propagation Rules

When a cross-module operation fails, the error must be specific about which module failed:

```typescript
// Bad ❌
throw new Error('Operation failed')

// Good ✅
throw new Error('DRESS_UNAVAILABLE: Dress #BB-047 is reserved for Sophia R. (Wedding Mar 22)')
throw new Error('MILESTONE_LOCKED: Cannot delete a milestone that has already been paid')
throw new Error('APPOINTMENT_CONFLICT: Staff member Ana R. already has an appointment at 2:30pm on Mar 19')
throw new Error('QUANTITY_EXCEEDED: Only 68 gold Chiavari chairs available on Mar 22 (120 requested)')
throw new Error('EVENT_PAST: Cannot assign inventory to an event whose date has already passed')

// Error codes for client handling:
const ERROR_CODES = {
  DRESS_UNAVAILABLE:    'This dress is no longer available — choose another',
  MILESTONE_LOCKED:     'Paid milestones cannot be deleted',
  APPOINTMENT_CONFLICT: 'Staff member is already booked at that time',
  QUANTITY_EXCEEDED:    'Not enough units available on that date',
  EVENT_PAST:           'Cannot modify a completed event',
  PERMISSION_DENIED:    'Your role does not allow this action',
  SKU_DUPLICATE:        'A dress or item with this SKU already exists',
  PHONE_DUPLICATE:      'A client with this phone number already exists',
}
```

---

## Integration Test Checklist

Before shipping any feature, verify these cross-module connections work end-to-end:

### Event creation → all modules
- [ ] Creating an event with all 4 services generates correct tasks, appointments, milestones
- [ ] Selecting a dress at creation correctly reserves it and links rental record
- [ ] Applying a package overwrites milestones and services correctly
- [ ] New client created inline saves to clients table and links to event

### Payment → event urgency
- [ ] Marking milestone overdue updates event card border to red
- [ ] Marking milestone paid removes it from overdue count on dashboard
- [ ] Overdue milestone blocks review request automation
- [ ] Paying final milestone marks event as fully paid

### Appointment → alteration → fitting
- [ ] Scheduling final fitting appointment links to alteration job
- [ ] Marking final fitting done prompts alteration status advance
- [ ] Missing final fitting ≤14 days creates urgent task on event

### Dress → inventory → event
- [ ] Reserving dress from inventory updates event detail dress card
- [ ] Logging return from QR scan updates both dress status and event
- [ ] Dress damage on return creates task on event

### Package → milestones
- [ ] Applying package generates correct milestone amounts and due dates
- [ ] Changing package preserves already-paid milestones
- [ ] Removing package leaves milestones as manual entries

### Automation → SMS log
- [ ] Payment reminder SMS appears in SMS log with correct event ID
- [ ] Appointment reminder SMS fires 24h before scheduled time
- [ ] Review request SMS only fires when all gate conditions pass
