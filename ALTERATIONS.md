# ALTERATIONS.md — Belori Alterations Spec

> **Purpose:** This file defines everything about how alterations work in Belori — the job lifecycle, kanban board, appointment scheduling, seamstress workflow, urgency logic, pricing, and all related UI, logic, database writes, and automations. Paste alongside PRD.md and TECH_STACK.md when building the alterations feature.

---

## Overview

Alterations are tailoring jobs performed on gowns before the event. They are always linked to an event and usually to a specific dress (either from the boutique's inventory or a client's own gown). A single event can have one or more alteration jobs — for example, the bridal gown plus bridesmaid dresses.

The alterations module has two primary views:
- **Kanban board** — 4 columns representing the job lifecycle, designed for the seamstress to manage her queue at a glance
- **List view** — sortable table for the owner/coordinator to see all jobs, filter by urgency, and track pricing

---

## Alteration Job Lifecycle

```
Measurement       In             Fitting          Complete
  Needed       Progress         Scheduled
─────────────────────────────────────────────────────────
     │               │               │               │
  New job         Work has        Fitting         Alterations
  created,        started,        date set,       finished,
  measurements    seamstress      client          job closed
  not yet         actively        confirmed
  taken           working
```

**Status definitions:**

| Status | Meaning | Next action |
|--------|---------|-------------|
| `measurement_needed` | New job — client hasn't come in for measurements yet | Schedule measurements appointment |
| `in_progress` | Measurements taken, seamstress actively working | Work until fitting-ready |
| `fitting_scheduled` | Alteration work done, fitting date set | Client comes in, approves or requests tweaks |
| `complete` | All work done and approved by client | No further action needed |

**Allowed transitions:**
| From | To | Who typically triggers |
|------|----|----------------------|
| measurement_needed | in_progress | Seamstress (after measurements appointment) |
| in_progress | fitting_scheduled | Seamstress (after completing the work) |
| fitting_scheduled | in_progress | Seamstress (if client requests tweaks at fitting) |
| fitting_scheduled | complete | Seamstress or coordinator (after final approval) |
| complete | in_progress | Owner only (rare — if issue discovered post-completion) |

Transitions **backward** (except fitting_scheduled → in_progress) are restricted to Owner role only and require a note explaining the reason.

---

## Database Schema

### `alteration_jobs` table
```typescript
export const alterationJobs = pgTable('alteration_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  eventId: uuid('event_id').references(() => events.id).notNull(),
  dressId: uuid('dress_id').references(() => dresses.id), // null if client's own garment
  // Garment info
  garmentDescription: text('garment_description').notNull(),
  // e.g. "Bridal gown #BB-047" or "Client's own bridesmaid dress (4 pieces)"
  isClientOwnGarment: boolean('is_client_own_garment').default(false),
  // Work
  workItems: text('work_items').array().notNull(),
  // ['hem','bustle','waist_take_in','let_out','sleeves','custom_beading','other']
  workNotes: text('work_notes'), // free-text detail beyond work items
  // Assignment
  seamstressId: uuid('seamstress_id').references(() => staff.id),
  // Lifecycle
  status: text('status').default('measurement_needed').notNull(),
  deadlineDate: date('deadline_date'), // auto: event date - 5 days
  // Appointments (linked appointment IDs)
  measurementsApptId: uuid('measurements_appt_id').references(() => appointments.id),
  fitting1ApptId: uuid('fitting_1_appt_id').references(() => appointments.id),
  fitting2ApptId: uuid('fitting_2_appt_id').references(() => appointments.id),
  fittingFinalApptId: uuid('fitting_final_appt_id').references(() => appointments.id),
  // Pricing
  quotedPriceCents: integer('quoted_price_cents'),
  finalPriceCents: integer('final_price_cents'),
  paidAt: timestamp('paid_at'),
  paidAmountCents: integer('paid_amount_cents'),
  paymentMethod: text('payment_method'), // 'cash' | 'card' | 'zelle' | 'other'
  // Notes & photos
  notes: text('notes'),
  photosBefore: text('photos_before').array().default([]),
  photosAfter: text('photos_after').array().default([]),
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

### `alteration_status_log` table (audit trail)
```typescript
export const alterationStatusLog = pgTable('alteration_status_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => alterationJobs.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  fromStatus: text('from_status').notNull(),
  toStatus: text('to_status').notNull(),
  changedByName: text('changed_by_name').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
})
```

---

## Alterations Screen

### Route
`/alterations` — accessible from sidebar under "Services"

### Topbar
- Title: "Alterations queue"
- Subtitle: "N jobs active · N due this week"
- Toggle button: "Kanban view" ↔ "List view" (ghost button, top right)
- "+ New job" primary button (top right)

---

## Kanban View

### Layout
4 columns in a horizontal grid. On tablet (768–1024px): 2 columns visible, horizontally scrollable. On mobile: 1 column visible, swipeable.

```
Measurement needed  │  In progress  │  Fitting scheduled  │  Complete
────────────────────┼───────────────┼─────────────────────┼──────────
[Card]              │  [Card]       │  [Card]             │  [Card]
[Card]              │  [Card]       │                     │  [Card]
                    │  [Card]       │                     │
```

### Column Header
```
──── In progress                              3
```
- 3px color bar (left-aligned): measurement_needed=blue, in_progress=amber, fitting_scheduled=purple, complete=green
- Status label (colored text matching bar)
- Job count (muted gray, right-aligned)

### Alteration Job Card (Kanban)

```
┌───────────────────────────────┐
│  Sophia Rodriguez    [6 days] │  ← name + countdown badge
│  Wedding Mar 22               │  ← event description
│  Bridal gown #BB-047          │  ← garment
│                               │
│  [Hem] [Bustle] [Waist]       │  ← work item chips
│                               │
│  AR ·  Ana R.          $280   │  ← seamstress avatar + price
└───────────────────────────────┘
```

**Card border:**
- Default: `#E5E7EB`
- Event ≤14 days away and status ≠ complete: `#FCA5A5` (red-ish)
- Event ≤7 days away and status ≠ complete: `#EF4444` (brighter red, 2px border)
- Hover: rosa `#C9697A`

**Countdown badge colors** (same as global Countdown component):
- >30 days: gray
- 14–30 days: amber
- 7–14 days: orange
- ≤7 days: red
- Today: red pulsing

**Drag and drop:**
- Cards are draggable between columns using `@dnd-kit/core`
- Dragging a card to a new column triggers a status transition
- If the transition is invalid (e.g. measurement_needed → complete), the card snaps back with a toast: "Jobs must move through each stage in order"
- Drop zones highlight when a card is dragged over them
- On drop: optimistic UI update immediately, Server Action fires in background

**Tapping a card** opens the Job Detail slide-over panel (from the right).

### Empty Column State
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  No jobs in this stage
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```
Dashed border, muted text.

---

## List View

A sortable table showing all jobs. Default sort: days until event (ascending — most urgent first).

### Columns
| Column | Content |
|--------|---------|
| Client | Client name (bold) + event subtext |
| Garment | Garment description |
| Work items | Chip list |
| Seamstress | Avatar + name |
| Status | Status badge |
| Event date | Date + countdown badge |
| Price | Quoted price |
| Action | "View →" link |

### Filter bar (above table)
```
[ All ]  [ Measurement needed ]  [ In progress ]  [ Fitting scheduled ]  [ Complete ]
```
Plus: "Due this week" quick filter chip (amber)

### Sortable columns
Click column header to sort: client name, event date (default), status, price.

---

## Job Detail Slide-over Panel

Clicking any job card (kanban or list) opens a slide-over from the right. Width: 400px on desktop, full screen on mobile.

### Header
```
Sophia Rodriguez — Wedding Mar 22        [×]
Bridal gown #BB-047 · In progress
```

### Tabs: Details | Appointments | Notes | Photos

**Details tab:**
```
EVENT
  Sophia & Rafael Rodriguez
  Wedding · Mar 22, 2026 · 6 days away

GARMENT
  Bridal gown #BB-047 · Ivory A-line cathedral · Size 8
  Client's gown: No (boutique inventory)

WORK ITEMS
  [Hem] [Bustle] [Waist take-in]
  Notes: Take in waist 1.5 inches. Hem to floor with 1" clearance in heels.

SEAMSTRESS
  Ana Reyes · ana@bellabridal.com

DEADLINE
  By Mar 19, 2026 (3 days before event)

PRICING
  Quoted:  $280
  Final:   —
  Paid:    No
```

**Status control (at bottom of details tab):**
- Large pill buttons for each next valid status
- E.g. if status = in_progress: shows "Mark fitting scheduled →" button
- Tapping triggers status transition (with optional notes modal)

**Appointments tab:**
- Timeline of linked appointments (measurements, fitting 1, fitting 2, final fitting)
- Each shows: type, date/time, assigned seamstress, status (done/scheduled/missing)
- "Schedule appointment" button → opens appointment creation linked to this job

**Notes tab:**
- Chronological notes feed
- Text input to add new note
- Notes are saved to event_notes with category = 'alteration'

**Photos tab:**
- Before photos (uploaded at measurement/start)
- After photos (uploaded at completion)
- Upload buttons for each category
- Tap any photo to view full size

---

## New Alteration Job Flow

### Trigger points
1. Alterations screen → "+ New job" button
2. Event creation modal Step 2 (when alterations service selected)
3. Event detail page → Alterations card → "+ Add alteration job"

### New Job Modal

**Single-step form** (not multi-step — alteration creation is simpler than event creation):

```
EVENT
  [Search / select event]    ← required
  Shows: client name, event type, date, countdown

GARMENT
  Type:
    ◉ Boutique dress (from inventory)
    ○ Client's own garment (BYOG)

  If boutique dress:
    [Search / select dress]   ← filtered to dresses linked to this event
                                or any available dress

  If BYOG:
    Description:  [text field]
                  e.g. "Wedding gown — Vera Wang, ivory, size 8"

WORK ITEMS  (multi-select chips — tap to toggle)
  [Hem] [Bustle] [Waist take-in] [Let out waist]
  [Sleeves] [Straps] [Custom beading] [Lining]
  [Neckline] [Train] [Zipper] [Buttons] [Other]

  Work notes:  [text area]
               e.g. "Take in waist 1.5 inches. Hem to floor."

SEAMSTRESS
  [Dropdown — staff with role = seamstress]
  Default: first active seamstress

DEADLINE
  Auto-calculated: event date − 5 days
  [Editable date field]
  Warning if deadline is < 7 days from today

QUOTED PRICE
  [$___]
  (Reference: Hem $60–80 · Bustle $80–120 · Waist $60–100 · Beading from $150)

NOTES
  [text area — optional]

[ Create alteration job ]
```

**Validation:**
| Field | Rule | Error |
|-------|------|-------|
| Event | Required | "Please select an event" |
| Garment | Required | "Please describe the garment or select a dress" |
| Work items | At least 1 | "Select at least one work item" |
| Seamstress | Required | "Please assign a seamstress" |
| Quoted price | Required, >0 | "Please enter a price estimate" |
| Deadline | Before event date | "Deadline must be before the event" |

**On confirm** → Server Action:
```typescript
export async function createAlterationJob(data: CreateAlterationJobData) {
  const { orgId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)

  const [job] = await db.insert(alterationJobs).values({
    boutiqueId: boutique.id,
    eventId: data.eventId,
    dressId: data.dressId || null,
    garmentDescription: data.garmentDescription,
    isClientOwnGarment: data.isClientOwnGarment,
    workItems: data.workItems,
    workNotes: data.workNotes,
    seamstressId: data.seamstressId,
    status: 'measurement_needed',
    deadlineDate: data.deadlineDate,
    quotedPriceCents: data.quotedPriceCents,
    notes: data.notes,
  }).returning()

  // Auto-create appointment placeholders
  const apptTypes = ['measurements', 'fitting_1', 'fitting_final']
  for (const type of apptTypes) {
    await db.insert(appointments).values({
      eventId: data.eventId,
      boutiqueId: boutique.id,
      type,
      staffId: data.seamstressId,
      status: 'not_scheduled',
    })
  }

  // Log initial status
  await db.insert(alterationStatusLog).values({
    jobId: job.id,
    boutiqueId: boutique.id,
    fromStatus: 'created',
    toStatus: 'measurement_needed',
    changedByName: data.staffName,
  })

  // Add task to event: "Schedule measurements appointment"
  await db.insert(eventTasks).values({
    eventId: data.eventId,
    boutiqueId: boutique.id,
    text: `Schedule measurements appointment — ${data.garmentDescription}`,
    category: 'Fitting',
    isAlert: false,
    done: false,
  })

  revalidatePath('/alterations')
  revalidatePath(`/events/${data.eventId}`)

  return job
}
```

---

## Status Transition Flow

### How transitions are triggered

**From kanban:** drag card to new column.

**From job detail panel:** tap the status button at the bottom.

**Status transition modal** (appears for all transitions except drag-to-complete):

```
Move to: [New status]

[Optional notes field — required for backward transitions]

[ Cancel ]  [ Confirm ]
```

### Server Action — update status
```typescript
export async function updateAlterationStatus(
  jobId: string,
  newStatus: AlterationStatus,
  notes?: string
) {
  const { orgId, userId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)
  const staff = await getStaffByClerkUserId(userId, boutique.id)

  const job = await db.query.alterationJobs.findFirst({
    where: and(eq(alterationJobs.id, jobId), eq(alterationJobs.boutiqueId, boutique.id))
  })
  if (!job) throw new Error('Job not found')

  // Validate transition
  const validTransitions: Record<AlterationStatus, AlterationStatus[]> = {
    measurement_needed: ['in_progress'],
    in_progress: ['fitting_scheduled'],
    fitting_scheduled: ['in_progress', 'complete'],
    complete: staff.role === 'owner' ? ['in_progress'] : [],
  }
  if (!validTransitions[job.status].includes(newStatus)) {
    throw new Error(`Cannot move from ${job.status} to ${newStatus}`)
  }

  await db.transaction(async (tx) => {
    await tx.update(alterationJobs)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(alterationJobs.id, jobId))

    await tx.insert(alterationStatusLog).values({
      jobId,
      boutiqueId: boutique.id,
      fromStatus: job.status,
      toStatus: newStatus,
      changedByName: staff.name,
      notes: notes || null,
    })

    // When moving to complete — set final price if not set
    if (newStatus === 'complete') {
      await tx.update(alterationJobs)
        .set({ finalPriceCents: job.finalPriceCents || job.quotedPriceCents })
        .where(eq(alterationJobs.id, jobId))

      // Add task: "Collect alteration payment from client"
      if (!job.paidAt) {
        await tx.insert(eventTasks).values({
          eventId: job.eventId,
          boutiqueId: boutique.id,
          text: `Collect alteration payment — ${formatCents(job.finalPriceCents || job.quotedPriceCents)}`,
          category: 'Payment',
          isAlert: true,
          done: false,
        })
      }
    }
  })

  revalidatePath('/alterations')
  revalidatePath(`/events/${job.eventId}`)
}
```

---

## Urgency Logic

Alteration jobs are flagged with urgency based on the event date and current status:

```typescript
export type AlterationUrgency = 'critical' | 'high' | 'normal' | 'complete'

export function getAlterationUrgency(job: AlterationJob): AlterationUrgency {
  if (job.status === 'complete') return 'complete'

  const daysUntilEvent = differenceInDays(new Date(job.eventId_date), new Date())
  const daysUntilDeadline = differenceInDays(new Date(job.deadlineDate), new Date())

  // Critical: deadline passed or ≤2 days and not fitting_scheduled or complete
  if (daysUntilDeadline <= 2 && job.status !== 'fitting_scheduled') return 'critical'

  // Critical: event ≤7 days and not fitting_scheduled or complete
  if (daysUntilEvent <= 7 && !['fitting_scheduled','complete'].includes(job.status)) return 'critical'

  // High: deadline ≤7 days and still in measurement_needed
  if (daysUntilDeadline <= 7 && job.status === 'measurement_needed') return 'high'

  // High: event ≤14 days and not complete
  if (daysUntilEvent <= 14 && job.status !== 'complete') return 'high'

  return 'normal'
}
```

**Visual treatment by urgency:**
| Urgency | Card border | Countdown | Extra |
|---------|-------------|-----------|-------|
| critical | 2px `#EF4444` | Red pulsing | "URGENT" label above client name |
| high | 1px `#FCA5A5` | Red badge | Red countdown |
| normal | 1px `#E5E7EB` | Color by days | — |
| complete | 1px `#E5E7EB` | Gray | Checkmark icon |

---

## Missing Appointment Detection

The alterations module cross-references appointment records and flags missing ones as blocking issues on the event.

### Required appointments per job:

**Minimum requirements:**
- Measurements / alteration consult (always required)
- Final fitting (always required — must be ≥5 days before event)

**Additional based on complexity:**
- 1st fitting: required if work items include any of: bustle, waist_take_in, let_out, sleeves, custom_beading
- 2nd fitting: required if 1st fitting had tweaks noted (staff marks "needs follow-up")

### Missing appointment detection function:
```typescript
export function getMissingAlterationAppointments(
  job: AlterationJob,
  appointments: Appointment[],
  eventDate: Date
): MissingAppointment[] {
  const missing: MissingAppointment[] = []
  const daysUntilEvent = differenceInDays(eventDate, new Date())

  const hasMeasurements = appointments.some(a =>
    a.type === 'measurements' && ['scheduled','done'].includes(a.status)
  )
  const hasFinalFitting = appointments.some(a =>
    a.type === 'fitting_final' && ['scheduled','done'].includes(a.status)
  )

  if (!hasMeasurements && job.status === 'measurement_needed') {
    missing.push({
      type: 'measurements',
      label: 'Measurements appointment not scheduled',
      urgency: daysUntilEvent <= 21 ? 'high' : 'normal',
    })
  }

  if (!hasFinalFitting && daysUntilEvent <= 21 && job.status !== 'complete') {
    missing.push({
      type: 'fitting_final',
      label: `Final fitting not scheduled (must be done by ${format(subDays(eventDate, 5), 'MMM d')})`,
      urgency: daysUntilEvent <= 10 ? 'critical' : 'high',
    })
  }

  return missing
}
```

Missing appointments from this function:
- Surface as blocking issues on the Event Detail page
- Add to the dashboard alert banner if event is ≤7 days away
- Generate a flagged task on the event: "Schedule final fitting — URGENT"

---

## Work Items Reference

Complete list of alteration work items with typical price ranges (shown as helper text in the new job form):

| Work item | Key | Typical range |
|-----------|-----|--------------|
| Hem | `hem` | $60–$100 |
| Bustle | `bustle` | $80–$150 |
| Waist take-in | `waist_take_in` | $60–$100 |
| Let out waist | `let_out` | $60–$120 |
| Sleeves | `sleeves` | $40–$80 |
| Straps | `straps` | $30–$60 |
| Custom beading | `custom_beading` | $150–$400+ |
| Lining | `lining` | $80–$150 |
| Neckline | `neckline` | $60–$120 |
| Train | `train` | $60–$100 |
| Zipper replacement | `zipper` | $40–$80 |
| Button work | `buttons` | $30–$60 |
| Other | `other` | Quote on request |

These ranges are display-only hints — the actual quoted price is entered by staff.

---

## Pricing & Payment

### Quoted vs Final price
- **Quoted price** — set at job creation, shown to client as estimate
- **Final price** — set when job is marked Complete, may differ if scope changed
- If final price > quoted price, a task is auto-created: "Discuss price adjustment with [client name]"

### Payment collection
When a job is marked complete:
- If `paidAt` is null, a flagged task appears: "Collect alteration payment — $[amount]"
- Staff can mark payment collected directly from the job detail panel:

```
Payment:
  Amount due:    $280
  Payment method: [ Cash ] [ Card ] [ Zelle ] [ Other ]
  [ Mark as paid ]
```

Server Action:
```typescript
export async function markAlterationPaid(jobId: string, data: PaymentData) {
  await db.update(alterationJobs).set({
    paidAt: new Date(),
    paidAmountCents: data.amountCents,
    finalPriceCents: data.amountCents,
    paymentMethod: data.method,
  }).where(eq(alterationJobs.id, jobId))

  // Mark the payment task done
  await db.update(eventTasks)
    .set({ done: true, doneAt: new Date() })
    .where(and(
      eq(eventTasks.eventId, data.eventId),
      like(eventTasks.text, 'Collect alteration payment%')
    ))

  revalidatePath('/alterations')
  revalidatePath(`/events/${data.eventId}`)
}
```

---

## Seamstress View (Role-based)

Staff with role = `seamstress` see a focused version of the alterations screen:

- **Default view:** Kanban filtered to their assigned jobs only
- **"All jobs" toggle:** available but secondary
- No access to pricing or financial data (quotedPrice, paidAt hidden)
- Can advance status, add notes, add photos
- Cannot delete jobs or change seamstress assignment
- Mobile-optimized — single column kanban, large tap targets for status updates

---

## Automations — Alterations

There are no direct client-facing SMS automations for alterations — reminders go through the appointments system (the fitting appointment SMS automation handles this). Internal automations:

### Urgency escalation alert (internal)
- **Trigger:** Daily 9am cron
- **Logic:** Finds jobs where urgency = 'critical' that were not flagged yesterday
- **Action:** Sends SMS to boutique owner: "Urgent: [N] alteration jobs need attention before upcoming events. Review at belori.app/alterations"
- Only fires if there are new critical jobs (not if already flagged)

### Deadline approaching notification (internal)
- **Trigger:** Daily 9am cron, 7 days before alteration deadline
- **Action:** Creates an alert task on the event if final fitting is not yet scheduled
- **Task text:** "Final fitting not yet scheduled — deadline is [date] ([N] days away)"

---

## Component Structure

```
components/alterations/
├── AlterationsPage.tsx           # Main page — view toggle, stats
├── KanbanBoard.tsx               # 4-column drag-drop board
├── KanbanColumn.tsx              # Single column with header + cards
├── AlterationCard.tsx            # Job card (kanban and list)
├── AlterationsTable.tsx          # List view table
├── JobDetailPanel.tsx            # Slide-over detail view
├── tabs/
│   ├── JobDetailsTab.tsx         # Status, garment, work items, pricing
│   ├── AppointmentsTab.tsx       # Linked fitting appointments
│   ├── NotesTab.tsx              # Notes feed + add note
│   └── PhotosTab.tsx             # Before/after photo gallery
├── modals/
│   ├── NewJobModal.tsx           # Create new alteration job
│   ├── StatusTransitionModal.tsx # Confirm status change + notes
│   └── PaymentModal.tsx          # Mark alteration paid
└── UrgencyBadge.tsx              # critical / high / normal badge
```

---

## TypeScript Types

```typescript
export type AlterationStatus =
  | 'measurement_needed'
  | 'in_progress'
  | 'fitting_scheduled'
  | 'complete'

export type AlterationUrgency = 'critical' | 'high' | 'normal' | 'complete'

export type WorkItem =
  | 'hem' | 'bustle' | 'waist_take_in' | 'let_out'
  | 'sleeves' | 'straps' | 'custom_beading' | 'lining'
  | 'neckline' | 'train' | 'zipper' | 'buttons' | 'other'

export interface AlterationJob {
  id: string
  boutiqueId: string
  eventId: string
  dressId?: string
  garmentDescription: string
  isClientOwnGarment: boolean
  workItems: WorkItem[]
  workNotes?: string
  seamstressId?: string
  status: AlterationStatus
  deadlineDate?: string
  quotedPriceCents?: number
  finalPriceCents?: number
  paidAt?: Date
  paidAmountCents?: number
  paymentMethod?: string
  notes?: string
  photosBefore: string[]
  photosAfter: string[]
  createdAt: Date
  updatedAt: Date
  // Joined
  event?: Event
  dress?: Dress
  seamstress?: Staff
}

export interface CreateAlterationJobData {
  eventId: string
  dressId?: string
  garmentDescription: string
  isClientOwnGarment: boolean
  workItems: WorkItem[]
  workNotes?: string
  seamstressId: string
  deadlineDate: string
  quotedPriceCents: number
  notes?: string
  staffName: string
}

export interface MissingAppointment {
  type: string
  label: string
  urgency: 'critical' | 'high' | 'normal'
}
```

---

## Validation Rules Summary

| Action | Rule | Error |
|--------|------|-------|
| Create job | Event required | "Please select an event" |
| Create job | At least 1 work item | "Select at least one work item" |
| Create job | Seamstress required | "Please assign a seamstress" |
| Create job | Quoted price > 0 | "Please enter a price estimate" |
| Create job | Deadline before event date | "Deadline must be before the event" |
| Status transition | Must follow valid path | "Jobs must move through each stage in order" |
| Backward transition | Owner role only + notes | "Only owners can reverse a job status. Please add a note." |
| Mark paid | Amount > 0 | "Please enter the amount collected" |
| Upload photo | Max 10MB per photo | "Photo must be under 10MB" |
| Upload photo | Max 10 photos per category | "Maximum 10 photos per category" |

---

## Query Functions

```typescript
// lib/db/queries/alterations.ts

export async function getAlterationJobs(
  boutiqueId: string,
  filters?: { status?: AlterationStatus; seamstressId?: string }
) {
  return db.query.alterationJobs.findMany({
    where: and(
      eq(alterationJobs.boutiqueId, boutiqueId),
      filters?.status ? eq(alterationJobs.status, filters.status) : undefined,
      filters?.seamstressId ? eq(alterationJobs.seamstressId, filters.seamstressId) : undefined,
    ),
    with: { event: { with: { client: true } }, dress: true, seamstress: true },
    orderBy: [asc(alterationJobs.deadlineDate)],
  })
}

export async function getUrgentAlterationJobs(boutiqueId: string) {
  const allJobs = await getAlterationJobs(boutiqueId)
  return allJobs
    .filter(j => j.status !== 'complete')
    .map(j => ({ ...j, urgency: getAlterationUrgency(j) }))
    .filter(j => ['critical','high'].includes(j.urgency))
    .sort((a, b) => {
      const order = { critical: 0, high: 1, normal: 2, complete: 3 }
      return order[a.urgency] - order[b.urgency]
    })
}

export async function getAlterationsByEvent(eventId: string, boutiqueId: string) {
  return db.query.alterationJobs.findMany({
    where: and(eq(alterationJobs.eventId, eventId), eq(alterationJobs.boutiqueId, boutiqueId)),
    with: { seamstress: true, dress: true },
  })
}

export async function getAlterationStats(boutiqueId: string) {
  const jobs = await getAlterationJobs(boutiqueId)
  return {
    total: jobs.length,
    active: jobs.filter(j => j.status !== 'complete').length,
    measurementNeeded: jobs.filter(j => j.status === 'measurement_needed').length,
    inProgress: jobs.filter(j => j.status === 'in_progress').length,
    fittingScheduled: jobs.filter(j => j.status === 'fitting_scheduled').length,
    complete: jobs.filter(j => j.status === 'complete').length,
    dueThisWeek: jobs.filter(j =>
      j.deadlineDate && differenceInDays(new Date(j.deadlineDate), new Date()) <= 7
      && j.status !== 'complete'
    ).length,
    critical: jobs.filter(j => getAlterationUrgency(j) === 'critical').length,
  }
}
```
