# DRESS_RENTAL.md — Belori Dress Rental Spec (v2)

> **Purpose:** This file defines the complete redesigned dress rental experience — the 4-tab page layout, catalog grid, active rentals dashboard, returns-due tracker, rental history, and all modal flows. Paste alongside PRD.md, TECH_STACK.md, and INVENTORY_MANAGEMENT.md when building this feature.

---

## Overview

The dress rental page is reorganized from a single catalog grid into a **4-tab dashboard** that mirrors how staff actually use it throughout the day:

- **Catalog** — browse and reserve available dresses
- **Active rentals** — see everything currently out, reserved, and due for pickup
- **Returns due** — focused view of what needs to come back, urgency-sorted
- **History** — complete rental log with revenue and condition tracking

The old design forced staff to mentally filter one big list. The new design surfaces the most urgent information first — overdue returns are impossible to miss.

---

## Page Structure

### Route
/inventory/rentals — also accessible via sidebar "Dress rentals" nav item

### Topbar
Dress rentals                           [Scan QR]  [Log return]  [+ New rental]
24 gowns · 9 rented · 3 due back this week

- "Scan QR" — opens the QR scan modal (camera or manual SKU entry)
- "Log return" — opens the return modal directly (fastest path for walk-in returns)
- "+ New rental" — opens the new rental modal (4-step flow)

### Stats bar (always visible, all tabs)

Five stats: Available (green) · Reserved (amber) · Rented (red) · Cleaning (blue) · Overdue (red bold)

Each stat is a tap target — tapping navigates to the relevant tab with that filter active.
"Overdue" stat shows red number, tapping opens Returns Due tab.
Stats update in real time as actions are taken.

### Tab bar

[ Catalog ]  [ Active rentals 13 ]  [ Returns due 3 ]  [ History ]

- Counts in badges update live
- "Returns due" badge is red when any overdue items exist
- Active tab: rosa underline + rosa text

---

## Tab 1 — Catalog

### Filter bar

Search input (full width) + two filter groups:
- Group 1 (status): All · Available · Reserved · Rented · Cleaning
- Group 2 (category): Bridal · Quinceañera

Multiple filters active simultaneously (e.g. "Available + Bridal").
Search queries across: name, SKU, color, size, client name.

### Dress card grid

Responsive columns: 4 desktop · 3 tablet · 2 mobile · 1 phone

Card anatomy (top to bottom):
1. Gown silhouette illustration (110px tall, ivory bg) — tinted with dress color
2. SKU badge (monospace, top-left) + Status badge (top-right)
3. Dress name (12px, 500 weight)
4. Color · Size · Category (10px, gray)
5. Rental price / Deposit (12px)
6. Client/status line (changes by status — see below)
7. Contextual action button (changes by status)

Status-dependent client line:
- Available: "Last cleaned Mar 10" (gray)
- Reserved: "Reserved: Sophia R. · Wedding Mar 22" (amber)
- Rented on time: "Rented to Sophia R. · Returns Mar 24" (red light)
- Rented overdue: "⚠ Sophia R. · Due Mar 24 · 3 days late" (red bold)
- Cleaning: "At cleaner · Est. back Mar 20" (blue)

Contextual action button by status:
- Available → "Reserve for event" (rosa outline) → New rental modal
- Reserved → "Mark picked up" (blue outline) → Pickup modal
- Rented (on time) → "Log return" (green outline) → Return modal
- Rented (overdue) → "Log return — OVERDUE" (red outline) → Return modal
- Cleaning → "Mark cleaned" (blue outline) → Cleaned confirmation

Card border:
- Default: 1px solid #E5E7EB
- Overdue rented: 1px solid #FCA5A5
- Hover: 1px solid #C9697A

Gown silhouette: simple SVG path filled with the dress's color (tinted).
Color map: Ivory=#F5F0E0, White=#F0F0F0, Champagne=#D4AF91, Blush=#F9BFCF, Rose quartz=#F4A3B8, Magenta=#E879A0, Royal blue=#4169E1, Gold=#D4AF37, Lavender=#C8A2C8, Coral=#FF7F6B

---

## Tab 2 — Active Rentals

Three sections stacked vertically. Section only renders if it has items.

### Section 1: Overdue returns
Red section header. Rows: red-tinted background (#FFF8F8), red border.
Each row shows: gown thumbnail + name + client + phone + due date + "X days late" + "Log return" + "Call client" buttons.

### Section 2: Currently rented (on time)
Rows include a rental progress bar showing time elapsed in rental period.

Progress bar calculation:
  total = differenceInDays(returnDueDate, pickedUpAt)
  elapsed = differenceInDays(today, pickedUpAt)
  progress = min(100, round((elapsed / total) * 100))
  
Bar color: green → amber (≤2 days remain) → red (overdue)

Each row shows: gown + name + client + event + pickup date + return date + progress bar + countdown tag + "View event" button

### Section 3: Upcoming pickups
Items reserved but not picked up, sorted by pickup date.
Rows show: gown + name + client + event + scheduled pickup date/time + "Mark picked up" button.

Rental row minimum height: 72px. Full row is tappable (opens rental detail slide-over). Action buttons work without opening slide-over.

---

## Tab 3 — Returns Due

Most action-critical tab. Staff check this every morning.

### Alert banner (when overdue items exist)
Background: #FEF2F2, border: 1px solid #FCA5A5
Lists all overdue dresses with client names.
"Send all reminders" button fires SMS to all overdue clients simultaneously and logs to sms_log.

### Sections (sorted by urgency)
1. OVERDUE — red rows with "Log return" + "Call client" buttons
2. DUE TODAY — amber rows with "Log return" + "Send reminder" buttons
3. DUE THIS WEEK — normal rows
4. LATER — gray rows (low urgency)

Each row shows client phone number so staff can tap to call on mobile.

"Call client" button behavior:
- Mobile: window.location.href = `tel:${phone}` (opens phone dialer)
- Desktop: copies phone number to clipboard + shows toast

---

## Tab 4 — History

### Summary stats strip (3 cards)
- Total rentals (all time) + count this month
- Rental revenue + amount this month
- Damage claims count + total damage collected

### Filter bar
Search + time filters (All time / This month / This quarter) + "Export CSV" button

Export CSV columns: SKU, Dress name, Client, Rented date, Return date, Days out, Condition, Rental fee, Damage fee, Total revenue
Filename: belori-rental-history-[date].csv

### History table columns
Dress (name + SKU monospace) | Client | Rented date | Returned date | Condition badge | Revenue (+ damage if any)

Condition badge colors:
- Perfect: bg #DCFCE7, text #15803D
- Minor soiling: bg #FEF3C7, text #B45309
- Needs repair: bg #FEE2E2, text #B91C1C
- Damaged: bg #FEE2E2, text #B91C1C
- Pending: bg #F3F4F6, text #6B7280

Each row tappable — opens rental detail slide-over.

---

## Rental Detail Slide-over

Opens from any rental row click. 400px desktop, full screen mobile.

### Header
Dress name + SKU, client name, event, status badge.

### Vertical timeline
Shows each stage of the rental lifecycle with dots and connector lines:
- Filled rosa dot = completed step
- Pulsing red dot = overdue step
- Gray dot = pending step

Stages: Reserved → Deposit paid → Picked up → [Return due] → Returned → Cleaning → Available

Each completed stage shows: date, time, staff name, any notes.

### Details section
Key-value pairs: Rental fee, Deposit paid, Balance remaining, Return due (red if overdue), Late fee accruing, Agreement signed, ID on file.

### Actions section
Primary: Log return / Mark picked up (based on status)
Secondary: Send reminder, View event

---

## Modals

### Modal 1 — New Rental (4-step)

Progress dots at top: ● ─ ○ ─ ○ ─ ○

Step 1 — Select dress
- Search available dresses only
- Filter by category and size
- Two-column result grid showing dress details
- Selected dress: rosa 2px border

Step 2 — Link to event
- Event search/select dropdown
- Pickup date (defaults to event date - 1 day)
- Return due date (defaults to event date + 2 days)

Step 3 — Pricing & deposit
- Rental fee (pre-filled from dress, editable)
- Security deposit (pre-filled, editable)
- Notes field

Step 4 — Confirm
- Full summary card
- "Reserve dress" primary button

On confirm: runs reserveDress() Server Action (see database writes below).

### Modal 2 — Mark Picked Up

Pre-populated dress card at top showing name, SKU, client, event, current status.

Fields:
- Pickup date & time
- Return due date (editable — last minute changes)
- Deposit collected amount (editable)
- Checkbox: Client has signed the rental agreement
- Checkbox: Photo ID verified and on file

Both checkboxes are recommended but not required. If unchecked, shows warning:
"We recommend confirming ID and agreement before releasing the dress."

On confirm: dress status → rented, pickedUpAt set, return reminder Inngest job scheduled.

### Modal 3 — Log Return (3-step)

Step 1 — Identify dress
If accessed from a card: pre-selected, skips to Step 2.
If accessed from topbar "Log return": shows search of all currently rented dresses.

Step 2 — Condition inspection
- Return date (defaults to today, editable)
- 4-button condition selector: Perfect (green) | Minor soiling (amber) | Needs repair (red) | Damaged (red bold)
- Notes textarea (required if condition is Needs repair or Damaged)
- Photo upload (strongly recommended for damage)

Step 3 — Financial settlement
- Rental summary: fee, deposit paid, remaining due
- Damage fee field (0 by default, editable, capped at replacement cost)
- Late fee (calculated automatically, staff can waive)
- Payment method: Cash / Card / Zelle / Other
- "Payment collected" checkbox

On confirm: transaction writes returnedAt, conditionOnReturn, returnNotes, damageFeeCents to dressRentals. Dress status → returned. Event task created if damage noted.

After saving, immediate prompt: "Send dress to cleaning?" with Yes / Later options.

### Modal 4 — QR Scan

Shows QR code illustration + "Point camera at dress label" helper text.
Fallback: "Or enter SKU manually" text input.

On mobile with camera access: opens html5-qrcode scanner directly.
On successful scan: navigates to /scan/[dressId] mobile-optimized page.

CDN: https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js

---

## Database Schema

### dresses table (unchanged from original spec)
See INVENTORY_MANAGEMENT.md for full inventory_items schema.
Dress-specific fields used: sku, name, category, size, color, rentalPriceCents, depositCents, replacementCostCents, status, currentEventId, returnDueDate, lastCleanedAt, photoUrls.

### dress_rentals table (updated)
```typescript
export const dressRentals = pgTable('dress_rentals', {
  id: uuid('id').primaryKey().defaultRandom(),
  dressId: uuid('dress_id').references(() => dresses.id).notNull(),
  eventId: uuid('event_id').references(() => events.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  rentalPriceCents: integer('rental_price_cents').notNull(),
  depositCents: integer('deposit_cents').notNull(),
  depositPaidAt: timestamp('deposit_paid_at'),
  depositPaidCents: integer('deposit_paid_cents').default(0),
  reservedAt: timestamp('reserved_at'),
  pickedUpAt: timestamp('picked_up_at'),
  returnDueDate: date('return_due_date').notNull(),
  returnedAt: timestamp('returned_at'),
  conditionOnReturn: text('condition_on_return'),
  returnNotes: text('return_notes'),
  returnPhotoUrls: text('return_photo_urls').array().default([]),
  damageFeeCents: integer('damage_fee_cents').default(0),
  lateFeeAppliedCents: integer('late_fee_applied_cents').default(0),
  lateFeeWaived: boolean('late_fee_waived').default(false),
  cleaningSentAt: timestamp('cleaning_sent_at'),
  cleaningReturnedAt: timestamp('cleaning_returned_at'),
  cleaningCostCents: integer('cleaning_cost_cents'),
  rentalAgreementSignedAt: timestamp('rental_agreement_signed_at'),
  rentalAgreementUrl: text('rental_agreement_url'),
  idVerified: boolean('id_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

### dress_status_log table (unchanged)
Tracks every status transition: fromStatus, toStatus, changedByName, notes, timestamp.

---

## Server Actions

### reserveDress
1. Lock dress row (SELECT FOR UPDATE) to prevent race conditions
2. Verify dress status === 'available'
3. Insert dress_rentals record
4. Update dresses.status → 'reserved', currentEventId, returnDueDate
5. Insert dress_status_log entry
6. revalidatePath('/inventory/rentals') and /events/[eventId]

### markDressPickedUp
1. Update dressRentals: pickedUpAt, depositPaidCents, agreementSigned, idVerified
2. Update dresses.status → 'rented'
3. Insert dress_status_log entry
4. Fire Inngest event 'dress.picked_up' → schedules return reminders

### logDressReturn (3-step transaction)
1. Update dressRentals: returnedAt, conditionOnReturn, returnNotes, damageFeeCents, lateFeeAppliedCents
2. Update dresses.status → 'returned', currentEventId → null, returnDueDate → null
3. Insert dress_status_log entry
4. If damage: create flagged event task "Follow up on dress damage"
5. revalidatePath for inventory and event pages

### sendToClean
1. Update dresses.status → 'cleaning'
2. Update dressRentals: cleaningSentAt, cleaningCostCents
3. Insert dress_status_log entry

### markCleaned
1. Update dresses.status → 'available', lastCleanedAt = today, currentEventId = null
2. Update dressRentals: cleaningReturnedAt
3. Insert dress_status_log entry

---

## Late Fee Logic

Constant: LATE_FEE_PER_DAY = $25 (2500 cents)
Maximum: 30 days × $25 = $750

Calculation:
  if returnedAt exists: 0
  daysLate = max(0, differenceInDays(startOfDay(today), startOfDay(returnDueDate)))
  lateFee = daysLate × LATE_FEE_PER_DAY

Staff can waive late fees (owner and coordinator roles only). Waived fee stored as lateFeeWaived = true.
Applied fee stored as lateFeeAppliedCents (separate from damage fee).

---

## Damage Fee Logic

Default suggestions by condition:
- Perfect: $0
- Minor soiling: $0 (cleaning cost absorbed by boutique)
- Needs repair: $50 suggested (staff edits)
- Damaged: no default — staff assesses against replacement cost

Maximum damage fee = dress replacement cost.
Validation: damageFeeCents <= dress.replacementCostCents

---

## Return Reminder Automation (Inngest)

Runs daily at 9am. Three actions:

1. Send 48h advance reminder SMS to clients with return due tomorrow
2. Send day-of reminder SMS to clients with return due today
3. Escalate overdue returns:
   - Day 1 overdue: SMS to client
   - Day 3 overdue: SMS to client + internal SMS to boutique owner
   - Day 7 overdue: SMS to client + internal SMS to boutique owner

All SMS send only if automation_settings.returnReminder = true.
All SMS logged to sms_log with type = 'return_reminder' or 'overdue_return'.

SMS templates:
- 48h: "Hi [name]! Your [dress] from [boutique] is due back in 2 days — by [date]..."
- Today: "Hi [name]! Your [dress] rental is due back TODAY by 5:00 PM..."
- Overdue: "Hi [name], your [dress] from [boutique] is now [N] days overdue. A $25/day late fee is being applied..."

---

## Availability Calendar (Phase 2)

Mini calendar shown when reserving a dress. Blocked dates (reserved/rented periods) shown in red. Available dates in white. Hovering blocked date shows who has it and which event.

Query: getDressAvailabilityCalendar(dressId, month, year) — returns each day of the month with available: boolean and rental info if blocked.

---

## Query Functions

getActiveDressRentals(boutiqueId): all rentals where returnedAt is null, sorted by returnDueDate ASC
getOverdueRentals(boutiqueId): active rentals where returnDueDate < today AND pickedUpAt is not null
getRentalHistory(boutiqueId, filters?): completed rentals (returnedAt is not null), sorted by returnedAt DESC
getRentalStats(boutiqueId): totalRentals, totalRevenue, damageClaims, damageRevenue, overdueCount

---

## Component Structure

components/rentals/
├── DressRentalPage.tsx
├── StatsBar.tsx
├── tabs/
│   ├── CatalogTab.tsx
│   ├── ActiveRentalsTab.tsx
│   ├── ReturnsDueTab.tsx
│   └── HistoryTab.tsx
├── DressCard.tsx
├── RentalRow.tsx
├── RentalDetailPanel.tsx
├── modals/
│   ├── NewRentalModal.tsx
│   ├── PickupModal.tsx
│   ├── ReturnModal.tsx
│   └── QRScanModal.tsx
└── AvailabilityCalendar.tsx (Phase 2)

---

## Validation Rules

| Action | Rule | Error |
|--------|------|-------|
| New rental | Dress must be available | "This dress is not available" |
| New rental | Event date must be future | "Cannot rent to a past event" |
| New rental | Return date after pickup | "Return date must be after pickup date" |
| Pickup | Dress must be reserved for this event | "Dress is not reserved for this event" |
| Return | Dress must be picked up (not just reserved) | "Dress was never picked up" |
| Return | Return date not before pickup | "Return date cannot be before pickup date" |
| Return | Damage fee ≤ replacement cost | "Damage fee cannot exceed replacement cost ($X)" |
| Return | Condition notes required if damage | "Please describe the damage" |
| Late fee | Max 30 days | "Maximum late fee is $750 (30 days)" |

---

## Walk-in Rentals (No Event Link)

### Overview

Not every dress rental is for a booked event. Staff need to be able to rent to:
- Walk-in clients (prom, photo shoot, themed party, random request)
- Clients who haven't booked a full event yet
- Rentals where the event is managed externally

Walk-in rentals are first-class rentals — same lifecycle, same reminders, same return flow. The only difference is `eventId = null` and client info is stored directly on the rental record instead of pulled from an event.

### Walk-in rental fields (added to dressRentals table)

```typescript
// New columns in dress_rentals table
isWalkIn: boolean('is_walk_in').default(false),
walkInClientName: text('walk_in_client_name'),
walkInClientPhone: text('walk_in_client_phone'),
walkInClientEmail: text('walk_in_client_email'),
walkInPurpose: text('walk_in_purpose'),  // "Prom", "Photo shoot", etc.
```

### How walk-in rentals appear in the UI

- Catalog card: client line shows purple "Walk-in" badge instead of event name
- Active Rentals tab: shows client name from walkInClientName, no event link
- Returns Due tab: shows client phone for direct call — same as event-linked rentals
- History table: client column shows name, event column shows "Walk-in" in purple

### Linking a walk-in to an event later

At any point, staff can open the rental record and add an event link:

From the rental detail panel → "Event link" section → "Change" button → select event from dropdown OR keep as walk-in. If converting a walk-in to event-linked:
1. eventId is set
2. isWalkIn remains true (for history tracking)
3. walkIn client fields remain on record
4. Activity log entry: "Linked to event [name] by [staff]"

### Walk-in SMS reminders

Same automation as event-linked rentals. SMS goes to walkInClientPhone.
Sender: "Belori | [Boutique Name]" (same format).
Return reminder: 48h before returnDueDate.

---

## Editing Rental Details After Creation

### Philosophy

Rental details change after the fact all the time — the client asks to keep the dress one more day, a damage fee needs to be corrected, the wrong condition was logged in a hurry. Belori allows editing at every stage. Every edit is logged to the activity log with who made the change and when.

### What can be edited at each stage

#### Stage: Reserved (not yet picked up)
All fields are freely editable — nothing has been handed over yet.

| Field | Editable | Notes |
|-------|---------|-------|
| Pickup date / time | Yes | No restrictions |
| Return due date / time | Yes | No restrictions |
| Rental fee | Yes | Requires coordinator+ role |
| Deposit amount | Yes | Requires coordinator+ role |
| Event link | Yes | Can switch event or convert to walk-in |
| Client info (walk-in) | Yes | Name, phone, purpose |
| Notes | Yes | Always editable |

#### Stage: Rented / Out (dress has been picked up)
Most fields editable. Return date extension triggers SMS notification option.

| Field | Editable | Notes |
|-------|---------|-------|
| Return due date | Yes | Checkbox: notify client by SMS |
| Rental fee | Yes | Requires coordinator+ role + reason |
| Deposit paid amount | Yes | In case it was logged incorrectly |
| Event link | Yes | Can still change or remove |
| Client info (walk-in) | Yes | Name, phone, purpose |
| Notes | Yes | Always editable |
| Picked up date | Owner only | Audit log entry required |

#### Stage: Returned (dress is back)
Condition and financial details editable. Pickup/return dates owner-only.

| Field | Editable | Notes |
|-------|---------|-------|
| Condition on return | Yes | Updates condition log |
| Return notes | Yes | Free text |
| Damage fee | Yes | Audit log entry required |
| Late fee applied | Yes | Can waive or adjust |
| Deposit refunded amount | Yes | In case refund was partial |
| Return date | Owner only | Requires reason |

#### Stage: Complete (cleaned and back in rotation)
Historical record — limited editing. Owner only.

| Field | Editable | Notes |
|-------|---------|-------|
| Condition notes | Owner only | Corrects a mistake |
| Financial totals | Owner only | Requires written reason |
| Any other field | No | Record is locked |

### Edit UI pattern (inline, not modal)

Editing is done inline in the rental detail panel — NOT via a separate modal. Each section of the rental detail has an "Edit" button that expands an inline edit form below the read-only view. This keeps context visible while editing.

Inline edit form layout:
1. Section header: "Edit [section name]"
2. Warning block (if editing a completed/locked stage): amber notice explaining impact
3. Form fields (grid layout, 2 columns where possible)
4. For rented stage: optional "Notify client by SMS" checkbox when return date changes
5. Two buttons: "Cancel" (ghost) + "Save" (rosa primary)
6. On save: read-only view updates, activity log entry added, green toast notification

### Activity log

Every edit generates an activity log entry stored on the rental record:

```typescript
export const rentalActivityLog = pgTable('rental_activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  rentalId: uuid('rental_id').references(() => dressRentals.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  action: text('action').notNull(),
  // e.g. 'reserved' | 'pickup_confirmed' | 'return_date_extended' |
  //      'fee_updated' | 'condition_updated' | 'event_link_changed' |
  //      'walk_in_linked' | 'deposit_updated' | 'returned' | 'cleaned'
  changedByName: text('changed_by_name').notNull(),
  changedByRole: text('changed_by_role').notNull(),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
})
```

Activity log displays in the rental detail panel: most recent first, showing action, who did it, when, and what changed.

### Server action — updateRentalField

```typescript
export async function updateRentalField(
  rentalId: string,
  field: EditableRentalField,
  newValue: unknown,
  options?: { notifyClient?: boolean; reason?: string }
) {
  const { orgId, userId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)
  const staff = await getStaffByClerkUserId(userId, boutique.id)
  const rental = await getRentalById(rentalId, boutique.id)

  // Permission check per stage and role
  validateEditPermission(rental, field, staff.role)

  // Get old value for activity log
  const oldValue = rental[field]

  // Apply update
  await db.update(dressRentals)
    .set({ [field]: newValue, updatedAt: new Date() })
    .where(eq(dressRentals.id, rentalId))

  // Log the change
  await db.insert(rentalActivityLog).values({
    rentalId,
    boutiqueId: boutique.id,
    action: fieldToAction(field),
    changedByName: staff.name,
    changedByRole: staff.role,
    previousValue: String(oldValue),
    newValue: String(newValue),
    notes: options?.reason,
  })

  // Send SMS if return date changed and option is checked
  if (field === 'returnDueDate' && options?.notifyClient) {
    const clientPhone = rental.walkInClientPhone || rental.event?.client?.phone
    if (clientPhone) {
      await sendSms(
        clientPhone,
        `Hi! Your dress return date has been updated to ${formatDate(newValue as string)}. Questions? Call us at ${boutique.phone}. — ${boutique.name}`,
        boutique.id,
        'return_date_update',
        rentalId
      )
    }
  }

  revalidatePath('/inventory/rentals')
  revalidatePath(`/inventory/rentals/${rentalId}`)
}

function validateEditPermission(rental: DressRental, field: string, role: StaffRole): void {
  const stage = getRentalStage(rental)

  // Completed rentals: owner only for any edit
  if (stage === 'complete' && role !== 'owner') {
    throw new Error('PERMISSION_DENIED: Only owners can edit completed rental records')
  }

  // Financial fields: coordinator+ only
  const financialFields = ['rentalPriceCents','depositCents','damageFeeCents','lateFeeAppliedCents']
  if (financialFields.includes(field) && !['owner','coordinator'].includes(role)) {
    throw new Error('PERMISSION_DENIED: Only coordinators and owners can edit financial details')
  }

  // Audit-required fields when rented
  const auditFields = ['pickedUpAt','returnedAt']
  if (auditFields.includes(field) && stage !== 'reserved') {
    if (role !== 'owner') {
      throw new Error('PERMISSION_DENIED: Only owners can edit pickup/return dates after the fact')
    }
  }
}
```

---

## Updated dressRentals Table Schema

```typescript
export const dressRentals = pgTable('dress_rentals', {
  id: uuid('id').primaryKey().defaultRandom(),
  dressId: uuid('dress_id').references(() => dresses.id).notNull(),
  eventId: uuid('event_id').references(() => events.id),  // NULL for walk-ins
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),

  // Walk-in fields (populated when eventId is null OR as override)
  isWalkIn: boolean('is_walk_in').default(false),
  walkInClientName: text('walk_in_client_name'),
  walkInClientPhone: text('walk_in_client_phone'),
  walkInClientEmail: text('walk_in_client_email'),
  walkInPurpose: text('walk_in_purpose'),

  // Financial
  rentalPriceCents: integer('rental_price_cents').notNull(),
  depositCents: integer('deposit_cents').notNull(),
  depositPaidAt: timestamp('deposit_paid_at'),
  depositPaidCents: integer('deposit_paid_cents').default(0),
  depositRefundedCents: integer('deposit_refunded_cents').default(0),
  depositRefundedAt: timestamp('deposit_refunded_at'),

  // Timeline
  reservedAt: timestamp('reserved_at'),
  pickedUpAt: timestamp('picked_up_at'),
  returnDueDate: date('return_due_date').notNull(),
  returnedAt: timestamp('returned_at'),

  // Return inspection
  conditionOnReturn: text('condition_on_return'),
  returnNotes: text('return_notes'),
  returnPhotoUrls: text('return_photo_urls').array().default([]),
  damageFeeCents: integer('damage_fee_cents').default(0),
  lateFeeAppliedCents: integer('late_fee_applied_cents').default(0),
  lateFeeWaived: boolean('late_fee_waived').default(false),

  // Cleaning
  cleaningSentAt: timestamp('cleaning_sent_at'),
  cleaningReturnedAt: timestamp('cleaning_returned_at'),
  cleaningCostCents: integer('cleaning_cost_cents'),

  // Agreements & verification
  rentalAgreementSignedAt: timestamp('rental_agreement_signed_at'),
  rentalAgreementUrl: text('rental_agreement_url'),
  idVerified: boolean('id_verified').default(false),

  // Notes
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

---

## Component Updates

### New components needed

```
components/rentals/
├── modals/
│   └── NewRentalModal.tsx     — Step 2 now has event/walk-in toggle
├── WalkInRentalBadge.tsx      — Purple "Walk-in" badge for list/card display
├── RentalDetailPanel.tsx      — Full redesign: inline edit sections per stage
├── EditRentalSection.tsx      — Reusable: read-only view + inline edit form
├── ActivityLog.tsx            — Chronological log of all rental changes
└── LinkEventModal.tsx         — Standalone: link a walk-in to an existing event
```

### EditRentalSection component

```tsx
// components/rentals/EditRentalSection.tsx
interface EditRentalSectionProps {
  title: string
  rental: DressRental
  stage: RentalStage
  staffRole: StaffRole
  fields: EditableField[]
  onSave: (updates: Partial<DressRental>) => Promise<void>
}

// Renders:
// - Section header with "Edit" button
// - Read-only key-value grid (visible by default)
// - Inline edit form (hidden by default, shown on "Edit" click)
// - Cancel / Save buttons
// - Stage-appropriate warning if needed
// - Activity log entry on save
```


---

## Post-Rental Creation — Action Screen

### Overview

The moment a rental is successfully saved, instead of silently returning to the catalog, Belori shows a **post-rental action screen** with three clear next steps. Staff can take any action immediately or skip and go directly to the rental record.

### Success screen layout

```
✓  Rental reserved successfully
   Dress #BB-047 is now reserved for Sophia Rodriguez.
   Pickup: Mar 21 · Return due: Mar 24

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  📄 Create      │  │  🖨 Print        │  │  ✂ Add          │
│     invoice     │  │    receipt      │  │   alterations   │
│  Email to client│  │  For client to  │  │  Hem, bustle,   │
│                 │  │  sign           │  │  waist, etc.    │
└─────────────────┘  └─────────────────┘  └─────────────────┘

                 [ Done — go to rental record ]
```

Each action card navigates to its respective flow. Tapping "Done" closes the success screen and opens the rental detail panel.

### Triggered by

`reserveDress()` Server Action completes → client-side redirect to success screen.
Route: `/inventory/rentals/[rentalId]/success`
This route is only accessible immediately after creation — visiting it again after navigating away redirects to the rental detail.

---

## Invoice Creation

### What an invoice contains

An invoice is a formatted PDF or on-screen document showing all financial details of the rental. It can include:

- **Dress rental line item** — SKU, name, size, rental fee
- **Security deposit** — shown as a separate line, marked refundable
- **Alterations** — if an alteration job is linked to the rental, shown as a line item with seamstress name and work description
- **Subtotals** per service
- **Total due**
- **Payment schedule** — if the rental is linked to an event with milestones
- **Terms** — return date, late fee policy, deposit refund policy
- **Boutique header** — logo, name, address, phone
- **Client details** — name, phone, email, event date

### Invoice options

Before generating, staff see a strip of checkboxes:
- Include alteration details (checked by default if alteration job exists)
- Include payment schedule (checked by default if event-linked)
- Include terms & conditions
- Bilingual EN/ES

### Invoice number format

```typescript
// Auto-generated on invoice creation
function generateInvoiceNumber(boutiqueId: string, sequence: number): string {
  return `INV-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`
  // e.g. INV-2026-0089
}
```

### Invoice status lifecycle

```
created → sent → viewed → paid (partial) → paid (full)
```

Stored on `invoices` table. Multiple invoices can exist for one rental (e.g. original + revised after alteration price change).

### Database schema — invoices table

```typescript
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  rentalId: uuid('rental_id').references(() => dressRentals.id).notNull(),
  eventId: uuid('event_id').references(() => events.id),
  invoiceNumber: text('invoice_number').notNull(),
  status: text('status').default('created'),
  // 'created' | 'sent' | 'paid_partial' | 'paid_full' | 'void'

  // Line items (snapshot at creation time)
  lineItems: jsonb('line_items').notNull(),
  // [{ label, description, amountCents, type: 'rental'|'deposit'|'alteration'|'fee' }]

  subtotalCents: integer('subtotal_cents').notNull(),
  depositCents: integer('deposit_cents').default(0),
  totalCents: integer('total_cents').notNull(),

  // Send details
  sentTo: text('sent_to'),         // email address
  sentAt: timestamp('sent_at'),
  pdfUrl: text('pdf_url'),

  // Options used at generation
  includeAlterations: boolean('include_alterations').default(true),
  includePaymentSchedule: boolean('include_payment_schedule').default(true),
  includeTerms: boolean('include_terms').default(false),
  bilingual: boolean('bilingual').default(false),

  issuedAt: timestamp('issued_at').defaultNow(),
  dueDate: date('due_date'),
  voidedAt: timestamp('voided_at'),
  voidedReason: text('voided_reason'),

  createdAt: timestamp('created_at').defaultNow(),
})
```

### Server action — createInvoice

```typescript
export async function createInvoice(
  rentalId: string,
  options: InvoiceOptions
): Promise<Invoice> {
  const boutique = await getBoutiqueByOrgId(auth().orgId)

  // Fetch all required data
  const rental = await db.query.dressRentals.findFirst({
    where: eq(dressRentals.id, rentalId),
    with: { dress: true, event: { with: { client: true } } }
  })
  const alterations = options.includeAlterations
    ? await getAlterationsByRental(rentalId, boutique.id)
    : []
  const milestones = options.includePaymentSchedule && rental.eventId
    ? await getMilestonesByEvent(rental.eventId)
    : []

  // Build line items
  const lineItems: InvoiceLineItem[] = [
    {
      label: 'Dress rental',
      description: `${rental.dress.name} (#${rental.dress.sku}) · Size ${rental.dress.size} · Pickup ${formatDate(rental.pickedUpAt || rental.reservedAt)} · Return ${formatDate(rental.returnDueDate)}`,
      amountCents: rental.rentalPriceCents,
      type: 'rental',
    },
    {
      label: 'Security deposit',
      description: 'Refundable upon return in good condition',
      amountCents: rental.depositCents,
      type: 'deposit',
    },
    ...alterations.map(a => ({
      label: 'Alterations',
      description: `${a.workItems.join(' · ')} · ${a.seamstress?.name || 'TBD'}`,
      amountCents: a.quotedPriceCents || 0,
      type: 'alteration' as const,
    }))
  ]

  const subtotalCents = lineItems
    .filter(i => i.type !== 'deposit')
    .reduce((s, i) => s + i.amountCents, 0)
  const totalCents = lineItems.reduce((s, i) => s + i.amountCents, 0)

  // Get next invoice sequence
  const seq = await getNextInvoiceSequence(boutique.id)
  const invoiceNumber = generateInvoiceNumber(boutique.id, seq)

  const [invoice] = await db.insert(invoices).values({
    boutiqueId: boutique.id,
    rentalId,
    eventId: rental.eventId || null,
    invoiceNumber,
    lineItems,
    subtotalCents,
    depositCents: rental.depositCents,
    totalCents,
    dueDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    ...options,
  }).returning()

  // Generate PDF
  await inngest.send({
    name: 'invoice.created',
    data: { invoiceId: invoice.id, boutiqueId: boutique.id }
  })

  return invoice
}
```

### Sending the invoice

```typescript
// When staff taps "Send to [email]":
export async function sendInvoice(invoiceId: string, email: string) {
  const invoice = await getInvoiceWithPdf(invoiceId)

  await resend.emails.send({
    from: `${boutique.name} <invoices@belori.app>`,
    to: email,
    subject: `Your rental invoice — ${invoice.invoiceNumber}`,
    react: InvoiceEmailTemplate({ invoice, downloadUrl: invoice.pdfUrl }),
  })

  await db.update(invoices)
    .set({ status: 'sent', sentTo: email, sentAt: new Date() })
    .where(eq(invoices.id, invoiceId))
}
```

### Invoice on the rental detail panel

After creation, the rental detail panel shows a new "Invoice" section:

```
INVOICE
  INV-2026-0089    [Sent to sophia.r@gmail.com]
  Issued: Mar 10 · Due: Mar 13 · Total: $1,030

  [ View PDF ]  [ Resend ]  [ Void & reissue ]
```

If alteration price changes after invoice was sent, a banner appears:
> "Alteration price changed from $280 to $310. Reissue invoice?"
> [ Void & reissue ]

---

## Print Receipt

Three print formats accessible from the rental detail or post-rental action screen:

### Format 1 — Thermal receipt (80mm)

Narrow monospace layout designed for thermal receipt printers (the kind used at boutique front desks). Includes:
- Boutique name + address
- Client name + event
- Each line item (dress, alterations, deposit) with amounts
- Total
- Pickup / return dates + late fee notice
- Signature line for client
- belori.app footer

### Format 2 — Full letter (8.5"×11")

A formal rental agreement / receipt with:
- Boutique letterhead
- Client + event details (two columns)
- Full line-item table
- Rental terms paragraph
- **Dual signature block** — client + staff, with date lines
- Bilingual (EN above / ES below) if client preferred language = Spanish

This is the version the client signs and keeps a copy of.

### Format 3 — Hanger label (2"×2")

A small label printed and attached to the dress hanger or garment bag:
- Boutique name (small)
- Dress SKU (monospace, prominent)
- Dress name
- Client name (rosa text)
- Event date
- Return due date (red)
- BELORI mark (bottom)

### Print implementation

```typescript
// lib/print/printReceipt.ts

export type PrintFormat = 'thermal' | 'letter' | 'label'

export async function generateReceiptPDF(
  rentalId: string,
  format: PrintFormat,
  options: { bilingual?: boolean } = {}
): Promise<Blob> {
  const rental = await getRentalWithDetails(rentalId)

  const html = renderReceiptHTML(rental, format, options)

  if (typeof window !== 'undefined') {
    // Client-side: use jsPDF for smaller formats
    return generateClientSidePDF(html, format)
  } else {
    // Server-side: use Puppeteer for full letter
    return generateServerSidePDF(html, format)
  }
}

// Page sizes per format
const PAGE_SIZES: Record<PrintFormat, { width: string; height: string }> = {
  thermal: { width: '80mm',   height: 'auto' },
  letter:  { width: '8.5in',  height: '11in'  },
  label:   { width: '2in',    height: '2in'   },
}
```

### "Print now" button

Opens the browser's native print dialog with the receipt pre-formatted and print-optimized CSS applied:

```css
@media print {
  body { font-family: monospace; font-size: 11px; }
  .no-print { display: none !important; }
  .page-break { page-break-after: always; }
}
```

---

## Rental-Linked Alterations

### Overview

When a dress is rented and alterations are needed, the alteration job is created directly from the rental record and automatically linked to both the dress and the event. This is the most common path for boutique alterations — the staff takes measurements at dress pickup or at a separate appointment, then the seamstress works on the gown before the event.

### Trigger points

Alterations can be added to a rental from three places:
1. Post-rental action screen → "Add alterations" card
2. Rental detail panel → "Alterations" section → "+ Add alteration job"
3. Alterations screen → "+ New job" → select rental (backward link)

### Add alterations form (from rental)

Since the rental already knows the dress and event, the alteration form is pre-filled and simplified:

```
Dress:        #BB-047 · Ivory A-line cathedral (pre-filled, read-only)
Event:        Sophia Rodriguez · Wedding Mar 22 (pre-filled, read-only)

Work needed:  [chip selector — tap to toggle]
  [✓ Hem $70]  [✓ Bustle $100]  [✓ Waist take-in $80]
  [Let out waist $80]  [Sleeves $60]  [Straps $40]
  [Custom beading from $150]  [Lining $90]  [Neckline $80]
  [Train $80]  [Zipper $50]  [+ Other]

  Estimated total: $250

Seamstress:   [Ana Reyes ▾]
Must be done by: [Mar 19, 2026]  ← auto: event date − 5 days
Work notes:   [text area]
              "e.g. Take in waist 1.5 inches. Hem to floor."

Quoted price: [$280.00]  ← staff edits from auto-estimate
```

Price estimates per work item (reference only — staff sets the quoted price):

| Work item | Estimate range |
|-----------|---------------|
| Hem | $60–$100 |
| Bustle | $80–$130 |
| Waist take-in | $60–$100 |
| Let out waist | $60–$120 |
| Sleeves | $50–$80 |
| Straps | $30–$60 |
| Custom beading | $150–$400+ |
| Lining | $80–$120 |
| Neckline | $60–$100 |
| Train | $60–$100 |
| Zipper | $40–$70 |

Chip selection auto-calculates a running estimate total shown below the chips.
Staff then sets the actual quoted price independently.

### What gets created on save

```typescript
export async function createAlterationFromRental(
  rentalId: string,
  data: CreateAlterationFromRentalData
) {
  const boutique = await getBoutiqueByOrgId(auth().orgId)
  const rental = await db.query.dressRentals.findFirst({
    where: eq(dressRentals.id, rentalId),
    with: { dress: true, event: { with: { client: true } } }
  })

  // 1. Create the alteration job
  const [job] = await db.insert(alterationJobs).values({
    boutiqueId: boutique.id,
    eventId: rental.eventId,
    dressId: rental.dressId,
    garmentDescription: `${rental.dress.name} (#${rental.dress.sku})`,
    isClientOwnGarment: false,
    workItems: data.workItems,
    workNotes: data.workNotes,
    seamstressId: data.seamstressId,
    status: 'measurement_needed',
    deadlineDate: data.deadlineDate,
    quotedPriceCents: data.quotedPriceCents,
  }).returning()

  // 2. Auto-create appointment stubs
  await db.insert(appointments).values([
    { eventId: rental.eventId, boutiqueId: boutique.id, type: 'measurements', status: 'not_scheduled', alterationJobId: job.id },
    { eventId: rental.eventId, boutiqueId: boutique.id, type: 'fitting_final', status: 'not_scheduled', alterationJobId: job.id },
  ])

  // 3. Auto-create tasks on the event
  const tasks = [
    { text: `Schedule measurements appointment — ${rental.dress.name}`, category: 'Fitting', isAlert: false },
    { text: `Schedule final fitting — must be done by ${formatDate(data.deadlineDate)}`, category: 'Fitting', isAlert: true },
    { text: `Collect alteration payment — $${formatCents(data.quotedPriceCents)}`, category: 'Payment', isAlert: false },
  ]
  for (const t of tasks) {
    await db.insert(eventTasks).values({ eventId: rental.eventId, boutiqueId: boutique.id, ...t, done: false })
  }

  // 4. Link rental to alteration job
  await db.update(dressRentals)
    .set({ alterationJobId: job.id })
    .where(eq(dressRentals.id, rentalId))

  revalidatePath('/inventory/rentals')
  revalidatePath('/alterations')
  revalidatePath(`/events/${rental.eventId}`)

  return job
}
```

### Rental ↔ Alteration link

A new column on `dressRentals`:

```typescript
alterationJobId: uuid('alteration_job_id').references(() => alterationJobs.id),
```

This allows:
- Rental detail panel to show alteration status inline
- Alteration kanban card to link back to the rental
- Invoice creation to auto-include alteration line item
- Return flow to check if alterations are complete before dress is picked up

### Alteration status on rental detail panel

After an alteration job is linked, the rental detail shows a live status card:

```
ALTERATIONS
  #BB-047 · Ivory A-line cathedral
  Work: Hem · Bustle · Waist take-in
  Seamstress: Ana Reyes
  Status:  [In progress]
  Deadline: Mar 19 (3 days before event)

  [ View alteration job → ]
```

Status badge updates in real time as the seamstress advances the job through the kanban.

If the alteration job is NOT complete when pickup date arrives:
```
⚠ Alterations not yet complete — dress pickup is scheduled for tomorrow.
  [ View alteration job ] [ Contact seamstress ]
```

### Walk-in rental alterations

Walk-in rentals (no event link) can also have alteration jobs created from them. For walk-in rentals, the alteration job will have `eventId = null` and tracks only against the dress and the return due date as the implicit deadline.

---

## Invoice + Alterations Combined

When both an invoice is created AND an alteration job exists, the invoice automatically includes the alteration as a line item. No manual entry needed.

Example invoice line items for a full rental:

```
Item                              Details                       Amount
──────────────────────────────────────────────────────────────────────
Dress rental                      #BB-047 · Pickup Mar 21       $450.00
                                  Return due Mar 24
Security deposit                  Refundable on return          $300.00
Alterations                       Hem · Bustle · Waist take-in  $280.00
                                  Ana Reyes · Est. done Mar 19
──────────────────────────────────────────────────────────────────────
Subtotal (services)                                             $730.00
Security deposit                                               +$300.00
TOTAL DUE                                                    $1,030.00
```

If alteration price changes after invoice is sent, the invoice shows a stale-data warning in the rental detail and offers a "Void & reissue" option.

---

## Updated dressRentals Schema (additions)

```typescript
// New columns added to dress_rentals
alterationJobId: uuid('alteration_job_id').references(() => alterationJobs.id),
latestInvoiceId: uuid('latest_invoice_id').references(() => invoices.id),
```

---

## Component Additions

```
components/rentals/
├── PostRentalSuccessScreen.tsx     # 3-card action screen after creation
├── invoice/
│   ├── CreateInvoicePanel.tsx      # Options + preview before generating
│   ├── InvoicePreview.tsx          # Rendered invoice (screen view)
│   └── InvoiceStatusBadge.tsx      # created / sent / paid badge
├── print/
│   ├── PrintReceiptModal.tsx       # Tab switcher: thermal / letter / label
│   ├── ThermalReceipt.tsx          # 80mm narrow format
│   ├── LetterReceipt.tsx           # 8.5×11 with signature block
│   └── HangerLabel.tsx             # 2×2 label
└── alterations/
    ├── AddAlterationFromRental.tsx # Simplified alteration form (rental context)
    ├── AlterationStatusCard.tsx    # Inline status on rental detail
    └── AlterationWarningBanner.tsx # Pickup warning if not complete
```

---

## Validation Rules (additions)

| Action | Rule | Error |
|--------|------|-------|
| Create invoice | At least rental record must exist | Auto-satisfied |
| Create invoice | Rental fee > 0 | "Rental fee must be set before creating invoice" |
| Send invoice | Valid email required | "Please enter a valid email address" |
| Create alteration | At least 1 work item selected | "Select at least one work item" |
| Create alteration | Quoted price > 0 | "Please enter a price estimate" |
| Create alteration | Deadline before event date | "Deadline must be before the event date" |
| Print receipt | None — always available | — |
| Void invoice | Reason required | "Please explain why this invoice is being voided" |
