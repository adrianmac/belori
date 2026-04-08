# CLIENTS_CRM.md — Belori Client CRM Spec

> **Purpose:** This file defines all CRM functions layered on top of the core clients module — interaction timeline, editable event history, pipeline management, tags & segmentation, task management, loyalty point adjustments, and communication preferences. Paste alongside CLIENTS.md, EVENT_DETAIL.md, and SERVICE_LINKS.md when building the CRM feature set.

---

## Overview

Belori's CRM turns client records from static contact cards into living relationship histories. Every call, note, payment, SMS, and event is logged on a single scrollable timeline. Staff can edit any historical record, adjust loyalty points manually, segment clients with tags, track leads through a sales pipeline, and manage per-client communication preferences — all from one page.

The CRM is built on top of the client detail page (`/clients/[clientId]`) as five tabs:

| Tab | Purpose |
|-----|---------|
| Overview | Contact info, stats, loyalty meter, open tasks, referral source |
| Timeline | Full chronological interaction history — editable, filterable, add new |
| Event history | All booked events with inline editing of every field and milestone |
| Pipeline | Kanban-style lead pipeline for the boutique's active prospects |
| Tags & prefs | CRM tags, communication preferences, style preferences, allergies |

---

## Database Schema — CRM tables

### `client_interactions` (interaction timeline)

```typescript
export const clientInteractions = pgTable('client_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),

  type: text('type').notNull(),
  // 'note' | 'call_outbound' | 'call_inbound' | 'meeting' | 'sms_sent' | 'sms_received'
  // 'email_sent' | 'email_received' | 'payment_received' | 'payment_overdue'
  // 'event_created' | 'booking_confirmed' | 'rental_created' | 'rental_returned'
  // 'alteration_update' | 'follow_up' | 'referral' | 'loyalty_change' | 'system'

  title: text('title').notNull(),              // Short summary shown in timeline header
  body: text('body'),                          // Full note or call summary (editable)
  isEditable: boolean('is_editable').default(true), // system-generated entries = false

  // Who logged it
  authorId: uuid('author_id').references(() => staffMembers.id),
  authorName: text('author_name').notNull(),
  authorRole: text('author_role'),

  // Optional metadata
  durationMinutes: integer('duration_minutes'),    // For calls/meetings
  relatedEventId: uuid('related_event_id').references(() => events.id),
  relatedMilestoneId: uuid('related_milestone_id'),
  relatedRentalId: uuid('related_rental_id'),
  relatedAlterationId: uuid('related_alteration_id'),
  pointsAwarded: integer('points_awarded').default(0),
  metadata: jsonb('metadata').default({}),        // Extra structured data per type

  // Editing
  editedAt: timestamp('edited_at'),
  editedByName: text('edited_by_name'),
  originalBody: text('original_body'),             // Preserved on first edit

  occurredAt: timestamp('occurred_at').defaultNow(), // When it actually happened
  createdAt: timestamp('created_at').defaultNow(),
})
```

### `client_tasks` (per-client task list)

```typescript
export const clientTasks = pgTable('client_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  eventId: uuid('event_id').references(() => events.id),  // optional link

  text: text('text').notNull(),
  category: text('category').default('general'),
  // 'crm' | 'payment' | 'fitting' | 'rental' | 'follow_up' | 'general'
  isAlert: boolean('is_alert').default(false),   // Shows in red, blocks review automation
  done: boolean('done').default(false),
  doneAt: timestamp('done_at'),
  doneByName: text('done_by_name'),

  assignedToId: uuid('assigned_to_id').references(() => staffMembers.id),
  dueDate: date('due_date'),

  createdByName: text('created_by_name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})
```

### `pipeline_leads` (sales pipeline)

```typescript
export const pipelineLeads = pgTable('pipeline_leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  clientId: uuid('client_id').references(() => clients.id),  // null = anonymous lead

  // Lead identity (when client record doesn't exist yet)
  leadName: text('lead_name'),
  leadPhone: text('lead_phone'),
  leadEmail: text('lead_email'),

  stage: text('stage').notNull().default('inquiry'),
  // 'inquiry' | 'consult_booked' | 'proposal_sent' | 'contract_signed' | 'won' | 'lost'

  eventType: text('event_type'),     // 'wedding' | 'quinceanera'
  estimatedEventDate: date('estimated_event_date'),
  estimatedValue: integer('estimated_value_cents').default(0),
  proposalSentAt: timestamp('proposal_sent_at'),

  source: text('source'),            // 'instagram' | 'google' | 'referral' | 'walk_in' | etc.
  notes: text('notes'),
  lostReason: text('lost_reason'),

  assignedToId: uuid('assigned_to_id').references(() => staffMembers.id),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  convertedAt: timestamp('converted_at'),         // When moved to 'won' or linked to an event
  convertedEventId: uuid('converted_event_id').references(() => events.id),
})
```

### `client_tags` (CRM tag system)

```typescript
export const clientTagDefinitions = pgTable('client_tag_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  name: text('name').notNull(),
  category: text('category').default('general'),
  // 'status' | 'source' | 'service' | 'internal' | 'alert'
  color: text('color').default('gray'),
  // 'gray' | 'rosa' | 'blue' | 'green' | 'amber' | 'red' | 'purple'
  createdAt: timestamp('created_at').defaultNow(),
})

export const clientTagAssignments = pgTable('client_tag_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  tagId: uuid('tag_id').references(() => clientTagDefinitions.id).notNull(),
  assignedByName: text('assigned_by_name'),
  assignedAt: timestamp('assigned_at').defaultNow(),
})
```

---

## Tab 1: Overview

### Contact information card (inline editable)

Every field has a hover pencil icon that expands an inline edit form. The form replaces the KV rows with a 2-column grid of inputs, then collapses back to read-only on save.

**Editable fields:**

| Field | Input type | Notes |
|-------|-----------|-------|
| Phone | Tel | Duplicate check on save |
| Email | Email | |
| Partner / honoree | Text | |
| Birthday | Date | Used for birthday automation |
| Language preference | Select | EN / ES / Both |
| City / location | Text | For geographical segmentation |

**Birthday automation:** When a birthday is saved, an Inngest cron job runs each morning and sends a birthday SMS on the client's birthday if `automation_settings.birthday_sms = true`:

```typescript
// SMS: "Hi [name]! 🎂 Wishing you a beautiful birthday from all of us at [boutique]!"
```

### Lifetime stats strip (4 cells, read-only)

| Stat | Source |
|------|--------|
| Total spent | `SUM(paid milestones)` across all events |
| Events booked | `COUNT(events WHERE clientId = x)` |
| Loyalty points | `clients.loyaltyPoints` |
| Referrals sent | `COUNT(clients WHERE referredById = x)` |

### Loyalty meter (editable by owner)

The loyalty meter shows the fill bar, point total, progress to next tier, and the list of unlocked vs locked perks. An "Adjust points" button (owner-only) opens a modal for manual adjustments.

**Manual adjustment modal fields:**

| Field | Notes |
|-------|-------|
| Adjustment type | Add / Subtract / Set exact total |
| Points | Number input |
| Reason | Required text — logged to `clientActivityLog` |

Manual adjustments are logged as `action: 'manual_loyalty_adjustment'` and show in the timeline with a "★ Manual adjustment" label and the reason.

```typescript
export async function adjustLoyaltyPoints(
  clientId: string,
  type: 'add' | 'subtract' | 'set',
  points: number,
  reason: string
) {
  const staff = await getStaff()
  if (staff.role !== 'owner') throw new Error('PERMISSION_DENIED')

  const client = await getClientById(clientId)
  let newPoints: number
  if (type === 'add')      newPoints = client.loyaltyPoints + points
  else if (type === 'subtract') newPoints = Math.max(0, client.loyaltyPoints - points)
  else                    newPoints = points

  await db.update(clients)
    .set({ loyaltyPoints: newPoints })
    .where(eq(clients.id, clientId))

  // Log to timeline
  await createInteraction({
    clientId,
    type: 'loyalty_change',
    title: `Loyalty points ${type === 'add' ? 'added' : type === 'subtract' ? 'deducted' : 'adjusted'}`,
    body: `${type === 'add' ? '+' : type === 'subtract' ? '-' : '→'}${points} pts. Reason: ${reason}`,
    authorName: staff.name,
  })

  await recalculateClientTier(clientId)
  revalidatePath(`/clients/${clientId}`)
}
```

### Open tasks card

Shows uncompleted tasks sorted by: alert → due date → creation date. Each task row is a tap target that toggles done/undone. Completing a task logs to the interaction timeline: `"Task completed: [text]"`.

"+ Add task" opens the task modal.

### Source & referral card (inline editable)

| Field | Editable | Notes |
|-------|---------|-------|
| How found us | Yes | Dropdown select |
| Referred by | Yes | Client name autocomplete |
| Clients referred | Read-only | Count of referral conversions |

---

## Tab 2: Timeline

### Timeline entry types and dot colors

| Type | Dot color | Icon background |
|------|-----------|----------------|
| note | Blue `#1D4ED8` | Blue-50 |
| call_outbound / call_inbound | Green `#15803D` | Green-50 |
| sms_sent / sms_received | Amber `#B45309` | Amber-50 |
| meeting | Purple `#7C3AED` | Purple-50 |
| email_sent / email_received | Blue `#1D4ED8` | Blue-50 |
| payment_received | Green `#15803D` | Green-50 |
| payment_overdue | Red `#B91C1C` | Red-50 |
| event_created / booking_confirmed | Rosa `#C9697A` | Rosa-50 |
| alteration_update | Blue `#1D4ED8` | Blue-50 |
| loyalty_change | Gold `#D97706` | Gold-50 |
| system (automated) | Gray `#9CA3AF` | Gray-50 |
| warn (alert) | Red `#B91C1C` | Red-50 |

### Timeline entry anatomy

```
[dot]  Staff note — Ana Reyes                                    [Edit] [Delete]
[line] Dress is ready — bustle complete. Waist taken in 1.5
       inches exactly as requested. Waiting on final fitting.
       Mar 14, 2:30 PM · Ana R.                                  [Alteration]
```

- **Title:** Bold 12px summary. Editable notes show author name. System entries do not.
- **Body:** 11px, gray, line-height 1.5. Editable notes show the full text.
- **Meta:** Date + time + author + duration (if call). 10px, gray.
- **Badge:** Category badge. Clickable → filters timeline to that category.
- **Edit button:** Only appears on `isEditable = true` entries. Expands inline textarea.
- **Delete button:** Owner only. Shows soft-delete confirmation: "Remove this entry from the timeline?" Entry is marked `isDeleted = true`, not hard-deleted.

### Inline note editing

Clicking "Edit" on any editable timeline entry:
1. Replaces the body text with a `<textarea>` pre-filled with current content
2. Shows Cancel + Save buttons
3. On Save: `body` is updated, `editedAt` = now, `editedByName` = current staff, `originalBody` is preserved on first edit
4. Timeline entry shows a small "(edited)" label after the timestamp

```typescript
export async function updateInteraction(
  interactionId: string,
  newBody: string
) {
  const staff = await getStaff()
  const interaction = await getInteractionById(interactionId)

  if (!interaction.isEditable) throw new Error('This entry cannot be edited')

  // Preserve original on first edit
  const originalBody = interaction.editedAt ? interaction.originalBody : interaction.body

  await db.update(clientInteractions).set({
    body: newBody,
    editedAt: new Date(),
    editedByName: staff.name,
    originalBody,
  }).where(eq(clientInteractions.id, interactionId))

  revalidatePath(`/clients/${interaction.clientId}`)
}
```

### Filter bar

```
[All]  [Notes]  [Calls]  [SMS]  [Payments]  [Events]
```

Filter chips above the timeline. Active filter highlights in rosa. Multiple filters can be active (OR logic — shows any entry matching any selected type).

### Adding a new interaction

A persistent "Log new interaction" panel at the bottom of the timeline tab:

**Interaction type selector** (chip buttons — tap to select one):
- Note
- Call
- SMS
- Meeting
- Email
- Follow-up

**Optional fields shown by type:**

| Type | Extra fields |
|------|-------------|
| Call | Duration (minutes), Direction (outbound/inbound) |
| Meeting | Duration, Location |
| Follow-up | Due date (creates a task automatically) |
| SMS / Email | Direction (sent/received) |

**Common fields:**
- Body / notes textarea (required)
- Staff member (dropdown, defaults to current user)
- Date/time (defaults to now, overridable for logging past interactions)

**On save:**
```typescript
export async function createInteraction(data: CreateInteractionData) {
  const staff = await getStaff()

  const [interaction] = await db.insert(clientInteractions).values({
    clientId: data.clientId,
    boutiqueId: staff.boutiqueId,
    type: data.type,
    title: buildInteractionTitle(data.type, data.authorName),
    body: data.body,
    isEditable: true,
    authorId: staff.id,
    authorName: data.authorName || staff.name,
    authorRole: staff.role,
    durationMinutes: data.durationMinutes,
    relatedEventId: data.relatedEventId,
    occurredAt: data.occurredAt || new Date(),
  }).returning()

  // If follow-up type, auto-create a task
  if (data.type === 'follow_up' && data.dueDate) {
    await db.insert(clientTasks).values({
      clientId: data.clientId,
      boutiqueId: staff.boutiqueId,
      text: `Follow up: ${data.body.slice(0, 80)}`,
      category: 'follow_up',
      dueDate: data.dueDate,
      createdByName: staff.name,
    })
  }

  // Update lastActivityAt
  await db.update(clients)
    .set({ lastActivityAt: new Date() })
    .where(eq(clients.id, data.clientId))

  revalidatePath(`/clients/${data.clientId}`)
  return interaction
}
```

### Auto-generated timeline entries

The following actions automatically create `clientInteractions` entries with `isEditable = false`:

| Trigger | Entry type | Title |
|---------|-----------|-------|
| Event created | `event_created` | "Event created — [name]" |
| Milestone marked paid | `payment_received` | "Payment received — [label] $[amount]" |
| Milestone overdue | `payment_overdue` | "[label] overdue — [N] days late" |
| SMS automation sent | `sms_sent` | "SMS sent — [automation name]" |
| Dress rental created | `rental_created` | "Dress rental reserved — #[SKU]" |
| Dress returned | `rental_returned` | "Dress returned — [condition]" |
| Alteration status changed | `alteration_update` | "Alteration [status] — [job]" |
| Loyalty tier changed | `loyalty_change` | "Tier upgraded to [tier]" |
| Review request sent | `system` | "Review request SMS sent" |
| Birthday SMS sent | `system` | "Birthday SMS sent" |
| Win-back SMS sent | `system` | "Win-back SMS sent (inactive 60d)" |

---

## Tab 3: Event History (Editable)

### Event history card

Each event the client has booked shows as a full card with:

**Header:**
- Event name (editable)
- Date and venue (editable)
- Status badge (Active / Complete / Upcoming / Cancelled)
- Days-until badge (red ≤7, amber ≤14, gray otherwise)
- "Edit event" button → expands inline edit form

**Editable fields on event history card (inline form):**

| Field | Input | Notes |
|-------|-------|-------|
| Event name | Text | |
| Event date | Date | Cannot be set to past |
| Venue | Text | |
| Guest count | Number | |
| Coordinator | Staff select | |
| Contract value | Number (dollars) | Coordinator+ only |

On save, fires `revalidatePath('/events/[eventId]')` and `revalidatePath('/clients/[clientId]')` and logs an interaction entry: `"Event details updated — [field] changed from [old] to [new]"`.

**Payment milestones section (within event card):**

Shows all milestones with status. Each milestone row has:
- Colored dot (green=paid, amber=pending, red=overdue)
- Label and due date / paid date
- Amount with status indicator
- "Edit" button (coordinator+) → inline edit form
- "Mark paid" button on overdue/pending rows

**Mark paid modal fields:**

| Field | Notes |
|-------|-------|
| Amount collected | Pre-filled, editable (partial payment support) |
| Date received | Defaults to today |
| Payment method | Cash / Zelle / Card / Other |
| Notes | Optional |

On mark paid:
1. Updates milestone status to `'paid'`
2. Records `paidAt`, `paidCents`, `paymentMethod`
3. Awards loyalty points: `1 pt per $1 paid`
4. Logs to interaction timeline: `"Payment received — [label] $[amount] via [method]"`
5. If `paidCents < amountCents`: status = `'paid_partial'`, remaining balance shown
6. `revalidatePath` for event, client, payments, dashboard

**Edit milestone modal fields:**

| Field | Input | Notes |
|-------|-------|-------|
| Label | Text | |
| Amount | Number | |
| Due date | Date | |
| Status | Select | Pending / Paid / Overdue |
| Payment method | Select | |
| Notes | Textarea | |

**"+ Add milestone" button** opens modal with blank fields. Validates that total milestones do not exceed contract value (warning, not hard block — sometimes deposits exceed line items temporarily).

**"+ Book another event" button** (shown after all events):

Opens a simplified event creation form pre-filled with the client's info. Skips the client selection step. The new event is immediately linked to this client and appears at the top of the event history.

---

## Tab 4: Pipeline

### Overview

The pipeline shows where all boutique leads are in the sales funnel. It's boutique-wide (not client-specific), but it's accessible from the client detail so staff can see where a specific client sits.

### Pipeline stages

```
Inquiry → Consult booked → Proposal sent → Contract signed → Won / Complete
```

Each stage is a kanban column. Cards are draggable on desktop (via `@dnd-kit`), tap → action sheet on tablet.

**Pipeline card fields:**
- Client name or lead name
- Event type + estimated date
- Estimated value (shown on proposal+ stages)
- Source badge
- Last touched date (gray if >7 days, red if >14 days — needs follow-up)

**Stage rules:**

| Stage | Triggered by | Next action |
|-------|-------------|------------|
| Inquiry | Booking form submission or manual | Schedule consult |
| Consult booked | Staff sets appointment | Come in, then send proposal |
| Proposal sent | Staff clicks "Send proposal" | Follow up in 3–5 days |
| Contract signed | Contract marked signed | Event created automatically |
| Won | Event marked complete | Archive after 90 days |
| Lost | Staff marks lost | Logs reason, fires win-back in 30 days |

**Moving a card:**

On desktop: drag card to new column. On tablet: tap card → "Move to…" action sheet with valid next stages listed as buttons.

On move:
```typescript
export async function movePipelineLead(
  leadId: string,
  newStage: PipelineStage,
  options?: { lostReason?: string }
) {
  const staff = await getStaff()

  await db.update(pipelineLeads)
    .set({ stage: newStage, updatedAt: new Date(), lostReason: options?.lostReason })
    .where(eq(pipelineLeads.id, leadId))

  // When moved to 'won', create event if not already linked
  if (newStage === 'won') {
    await inngest.send({ name: 'pipeline.lead_won', data: { leadId } })
  }

  // When moved to 'lost', schedule win-back
  if (newStage === 'lost') {
    await inngest.send({ name: 'pipeline.lead_lost', data: { leadId, daysDelay: 30 } })
  }

  // Log interaction if client exists
  const lead = await getPipelineLead(leadId)
  if (lead.clientId) {
    await createInteraction({
      clientId: lead.clientId,
      type: 'system',
      title: `Pipeline stage updated → ${STAGE_LABELS[newStage]}`,
      body: options?.lostReason ? `Lost reason: ${options.lostReason}` : undefined,
      authorName: staff.name,
      isEditable: false,
    })
  }

  revalidatePath('/clients')
}
```

### Pipeline stats bar (below kanban)

| Stat | Calculation |
|------|------------|
| Active leads | COUNT where stage NOT IN ('won','lost') |
| Pipeline value | SUM(estimatedValue) where stage NOT IN ('won','lost') |
| Conversion rate | COUNT('won') / COUNT(all leads) — last 12 months |

### Adding a lead to the pipeline

"+ Add" button at the bottom of each column opens a quick-add form:

| Field | Notes |
|-------|-------|
| Name | Client name or "Anonymous" |
| Phone | Optional |
| Event type | Wedding / Quinceañera |
| Estimated date | Month/year picker |
| Estimated value | Pre-fills from average if blank |
| Source | How they found us |
| Notes | First contact notes |

If a matching client record exists (by phone), the lead is linked to that client automatically.

---

## Tab 5: Tags & Preferences

### CRM tags system

Tags are boutique-defined labels attached to clients for segmentation, filtering, and automation targeting.

**Tag categories:**

| Category | Examples |
|----------|---------|
| Status | VIP, Active, Inactive, At-risk |
| Source | Instagram lead, Referral, Walk-in, Expo |
| Service | Full service, Dress only, Planning only |
| Internal | Decision maker: mom, Price sensitive, Needs follow-up |
| Alert | Lily allergy ⚠, No contact before 10am, Check ID required |

**UI — Tags card:**
- All boutique-defined tags shown as chip buttons
- Active tags highlighted in rosa
- Click to toggle on/off (optimistic update, auto-saved)
- "+ Add tag" button → creates a new tag definition for the boutique and assigns it

```typescript
export async function toggleClientTag(clientId: string, tagId: string) {
  const existing = await db.query.clientTagAssignments.findFirst({
    where: and(eq(clientTagAssignments.clientId, clientId), eq(clientTagAssignments.tagId, tagId))
  })

  if (existing) {
    await db.delete(clientTagAssignments).where(eq(clientTagAssignments.id, existing.id))
  } else {
    const staff = await getStaff()
    await db.insert(clientTagAssignments).values({
      clientId, tagId, assignedByName: staff.name
    })
  }
  // No revalidatePath needed — optimistic UI update handles it
}
```

**Alert tags** (category = 'alert') render as red banners on:
- The client detail page (all tabs)
- The event detail page (as a sticky header warning)
- The alteration job detail (in the work notes area)
- The dress rental detail (in the notes section)

### Communication preferences (inline editable)

| Preference | Type | Default |
|-----------|------|---------|
| SMS reminders | Toggle | On |
| Email invoices | Toggle | On |
| Appointment reminders | Toggle | On |
| Marketing messages | Toggle | Off (opt-in required) |
| Birthday SMS | Toggle | On |
| Review request SMS | Toggle | On |
| Language for comms | Select | EN |
| Preferred contact time | Text | Free text, staff reference only |

These directly control which Inngest automations fire for the client. If `smsReminders = false`, the automation gate skips the client entirely.

### Style preferences (inline editable)

- **Themes:** Multi-select chip list (Romantic, Classic, Boho, Glamorous, etc.)
- **Colors:** Swatch picker — same as event creation Step 2
- **Flower preferences:** Text input
- **Allergies:** Each allergy shown as a red alert pill. "+ Add" button opens allergy modal.

**Allergy alert propagation:**

When an allergy is saved, it triggers an Inngest function that adds an alert tag (`[Allergy name] ⚠`) to the client record and posts a note to the active event(s):

```typescript
export const allergyAddedJob = inngest.createFunction(
  { id: 'allergy-added' },
  { event: 'client.allergy_added' },
  async ({ event: { data } }) => {
    const { clientId, allergyNote } = data
    const client = await getClientWithActiveEvents(clientId)

    // Add alert tag
    const alertTag = await getOrCreateTag(client.boutiqueId, `${allergyNote} ⚠`, 'alert')
    await toggleClientTag(clientId, alertTag.id)

    // Post to all active events
    for (const event of client.activeEvents) {
      await db.insert(eventNotes).values({
        eventId: event.id,
        boutiqueId: client.boutiqueId,
        text: `⚠ ALLERGY ALERT: ${allergyNote} — confirmed ${format(new Date(), 'MMM d, yyyy')}`,
        authorName: 'System',
        authorRole: 'system',
        category: 'alert',
      })
    }
  }
)
```

---

## Task Management

### Task list (Overview tab)

Tasks are shown in priority order: alert (red, !) → due today → due this week → no due date.

Each task row:
- Checkbox (tap to toggle done/undone)
- Task text
- Category badge
- Due date (red if overdue, amber if today)
- Assigned staff initial circle

Completing a task:
1. Checks the box (green fill)
2. Strikes through the text
3. Logs to interaction timeline: `"Task completed: [text]"` with `authorName = current staff`
4. Does NOT delete the task — it stays visible with done styling until archived (after 7 days)

### Add task modal fields

| Field | Input | Required |
|-------|-------|---------|
| Task description | Text | Yes |
| Category | Select | No (defaults to 'general') |
| Priority | Toggle | No (default: normal) |
| Due date | Date | No |
| Assigned to | Staff select | No (defaults to current user) |

### Auto-created CRM tasks

When the following happen, tasks are auto-created on the client record:

| Trigger | Task text | Category |
|---------|-----------|---------|
| Client inactive 30 days | "Check in with [name] — 30 days since last activity" | follow_up |
| Payment overdue 7+ days | "Escalate payment collection — [name] [label]" | payment |
| Referral lead books event | "Thank [name] for the referral — [referred client] booked!" | crm |
| Birthday in 7 days | "Wish [name] a happy birthday on [date]" | crm |
| Event complete, no review | "Request review from [name]" | crm |
| Win-back SMS bounced | "Call [name] directly — SMS delivery failed" | follow_up |

---

## Server Actions Summary

```typescript
// client_interactions
createInteraction(data: CreateInteractionData): Promise<ClientInteraction>
updateInteraction(id: string, newBody: string): Promise<void>
deleteInteraction(id: string): Promise<void>                    // soft-delete, owner only
getInteractions(clientId: string, filters?: InteractionFilters): Promise<ClientInteraction[]>

// client_tasks
createClientTask(data: CreateTaskData): Promise<ClientTask>
toggleClientTask(taskId: string): Promise<void>
updateClientTask(taskId: string, data: UpdateTaskData): Promise<void>
deleteClientTask(taskId: string): Promise<void>

// pipeline
createPipelineLead(data: CreateLeadData): Promise<PipelineLead>
movePipelineLead(leadId: string, stage: PipelineStage, opts?): Promise<void>
updatePipelineLead(leadId: string, data: Partial<PipelineLead>): Promise<void>
convertLeadToEvent(leadId: string, eventData: CreateEventData): Promise<Event>

// tags
createTag(boutiqueId: string, name: string, category: TagCategory): Promise<Tag>
toggleClientTag(clientId: string, tagId: string): Promise<void>
getClientsByTag(boutiqueId: string, tagId: string): Promise<Client[]>

// loyalty
adjustLoyaltyPoints(clientId: string, type, points, reason): Promise<void>

// event history editing
updateEventFromClientDetail(eventId: string, data: UpdateEventData): Promise<void>
addMilestone(eventId: string, data: MilestoneData): Promise<Milestone>
updateMilestone(milestoneId: string, data: UpdateMilestoneData): Promise<void>
markMilestonePaid(milestoneId: string, data: MarkPaidData): Promise<void>
```

---

## Role Permissions

| Feature | Owner | Coordinator | Front desk | Seamstress |
|---------|-------|-------------|------------|------------|
| View timeline | ✓ | ✓ | ✓ | Own notes |
| Add interaction (any type) | ✓ | ✓ | ✓ | Note only |
| Edit own interactions | ✓ | ✓ | ✓ | ✓ |
| Edit other staff interactions | ✓ | ✗ | ✗ | ✗ |
| Delete interactions | ✓ | ✗ | ✗ | ✗ |
| View event history | ✓ | ✓ | ✓ | ✗ |
| Edit event fields | ✓ | ✓ | ✗ | ✗ |
| Edit milestones | ✓ | ✓ | ✗ | ✗ |
| Mark milestone paid | ✓ | ✓ | ✗ | ✗ |
| Add milestone | ✓ | ✓ | ✗ | ✗ |
| View pipeline | ✓ | ✓ | ✓ | ✗ |
| Move pipeline cards | ✓ | ✓ | ✓ | ✗ |
| Add pipeline leads | ✓ | ✓ | ✓ | ✗ |
| Manage tags | ✓ | ✓ | ✓ | ✗ |
| Edit communication prefs | ✓ | ✓ | ✓ | ✗ |
| Adjust loyalty points | ✓ | ✗ | ✗ | ✗ |
| Add/edit allergies | ✓ | ✓ | ✓ | ✓ |
| Delete client | ✓ | ✗ | ✗ | ✗ |

---

## Revalidation Map

```typescript
// After any interaction added/edited/deleted:
revalidatePath(`/clients/${clientId}`)

// After event detail edited from client page:
revalidatePath(`/clients/${clientId}`)
revalidatePath(`/events/${eventId}`)
revalidatePath('/events')

// After milestone marked paid:
revalidatePath(`/clients/${clientId}`)
revalidatePath(`/events/${eventId}`)
revalidatePath('/payments')
revalidatePath('/dashboard')

// After tag toggle (optimistic — no revalidation needed unless filtering)
// On hard refresh: revalidatePath(`/clients/${clientId}`)

// After pipeline card moved:
revalidatePath('/clients')  // Pipeline is boutique-wide

// After loyalty adjustment:
revalidatePath(`/clients/${clientId}`)
revalidatePath('/clients')  // Tier badge updates in list
```

---

## Component Structure

```
components/clients/crm/
├── TimelineTab.tsx                   # Full interaction history + add form
│   ├── TimelineEntry.tsx             # Single entry (dot, title, body, edit)
│   ├── TimelineFilter.tsx            # Type filter chips
│   └── AddInteractionForm.tsx        # Type selector + textarea + submit
├── EventHistoryTab.tsx               # All booked events (editable)
│   ├── EventHistoryCard.tsx          # One event — fields + milestones
│   ├── MilestoneRow.tsx              # One milestone — edit / mark paid
│   ├── EditEventForm.tsx             # Inline edit form for event fields
│   ├── AddMilestoneModal.tsx
│   ├── EditMilestoneModal.tsx
│   └── MarkPaidModal.tsx
├── PipelineTab.tsx                   # Kanban pipeline (boutique-wide)
│   ├── PipelineColumn.tsx            # One stage column
│   ├── PipelineCard.tsx              # One lead card
│   ├── AddLeadModal.tsx
│   └── MoveLeadSheet.tsx             # Tablet: action sheet for stage move
├── TagsPrefsTab.tsx                  # Tags + communication + style prefs
│   ├── TagChipList.tsx               # All tags with toggle
│   ├── AddTagModal.tsx
│   ├── CommunicationPrefsForm.tsx    # Inline editable prefs
│   ├── StylePrefsChips.tsx
│   └── AllergyBannerList.tsx         # Red alert pills
└── shared/
    ├── TaskRow.tsx                   # Checkbox + text + toggle
    ├── AddTaskModal.tsx
    └── InlineEditForm.tsx            # Reusable: read-only → edit on demand
```

---

## TypeScript Types

```typescript
export type InteractionType =
  | 'note' | 'call_outbound' | 'call_inbound' | 'meeting'
  | 'sms_sent' | 'sms_received' | 'email_sent' | 'email_received'
  | 'payment_received' | 'payment_overdue' | 'event_created' | 'booking_confirmed'
  | 'rental_created' | 'rental_returned' | 'alteration_update'
  | 'follow_up' | 'referral' | 'loyalty_change' | 'system' | 'warn'

export type PipelineStage =
  | 'inquiry' | 'consult_booked' | 'proposal_sent' | 'contract_signed' | 'won' | 'lost'

export type TaskCategory =
  | 'crm' | 'payment' | 'fitting' | 'rental' | 'follow_up' | 'general'

export type TagCategory =
  | 'status' | 'source' | 'service' | 'internal' | 'alert'

export interface ClientInteraction {
  id: string
  clientId: string
  boutiqueId: string
  type: InteractionType
  title: string
  body?: string
  isEditable: boolean
  authorName: string
  authorRole?: string
  durationMinutes?: number
  relatedEventId?: string
  pointsAwarded: number
  editedAt?: Date
  editedByName?: string
  originalBody?: string
  occurredAt: Date
  createdAt: Date
}

export interface PipelineLead {
  id: string
  boutiqueId: string
  clientId?: string
  leadName?: string
  leadPhone?: string
  stage: PipelineStage
  eventType?: 'wedding' | 'quinceanera'
  estimatedEventDate?: string
  estimatedValueCents: number
  source?: string
  notes?: string
  lostReason?: string
  assignedToId?: string
  createdAt: Date
  updatedAt: Date
  convertedAt?: Date
  convertedEventId?: string
}

export interface ClientTask {
  id: string
  clientId: string
  eventId?: string
  text: string
  category: TaskCategory
  isAlert: boolean
  done: boolean
  doneAt?: Date
  doneByName?: string
  assignedToId?: string
  dueDate?: string
  createdByName: string
  createdAt: Date
}
```
