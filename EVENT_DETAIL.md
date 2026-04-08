# EVENT_DETAIL.md — Belori Event Detail Page Spec

> **Purpose:** This file defines everything about the event detail page — layout, all sections, every editable field, print/export, inline modals, urgency logic, cross-module connections, and component structure. This is the most-visited screen in Belori. Every staff action during an active event flows through here. Paste alongside PRD.md, TECH_STACK.md, and SERVICE_LINKS.md when building this page.

---

## Overview

The event detail page is the **command center** for a single event. Every service, payment, appointment, task, note, and piece of inventory assigned to an event lives here in one view. Staff should never need to leave this page to understand the full state of an event or take any action on it.

Design philosophy:
- Everything visible is also editable — no "read-only" views that require navigating elsewhere
- Most urgent information appears first — overdue items always surface at the top
- One page, two columns — left column is the action column (payments, services, tasks), right column is the reference column (client, timeline, inspiration)
- Print is a first-class feature — the full event summary should print cleanly as a signed document

---

## Route

```
/events/[eventId]
```

Accessible from:
- Events list → click any event card
- Dashboard → appointment row → event link
- Dashboard → payments due → event link
- Inventory → dress card "Reserved for [client]" → event link
- Alterations kanban card → event link
- QR scan page → "View event →" link
- Topbar search → event name

---

## Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  TOPBAR (sticky)                                                │
│  ← Events  |  Event name  |  [Print] [Share] [+ Add service]  │
├─────────────────────────────────────────────────────────────────┤
│  ALERT BAR (conditional — shows only when blocking issues)     │
├─────────────────────────────────────────────────────────────────┤
│  HERO SECTION                                                   │
│  Event name · Date · Venue · Guests · Services chips           │
│  Payment progress bar                                          │
├─────────────────────────────────────────────────────────────────┤
│  STAT STRIP                                                     │
│  Total paid | Overdue | Tasks done | Blocking issues           │
├─────────────────────────────────────────────────────────────────┤
│  PRINT PANEL (collapsible — hidden by default)                 │
├────────────────────────────────────┬────────────────────────────┤
│  LEFT COLUMN (main actions)        │  RIGHT COLUMN (reference) │
│  · Payment milestones             │  · Client info             │
│  · Dress rental                   │  · Event details           │
│  · Alterations                    │  · Important dates         │
│  · Decoration & inventory         │  · Upcoming appointments   │
│  · Event tasks                    │  · Vision & inspiration    │
│  · Staff notes                    │                            │
└────────────────────────────────────┴────────────────────────────┘
```

**Column widths:** Left = `1fr`, Right = `300px` fixed.
**Mobile:** Both columns stack to single column. Right column moves above left column on mobile so client info and timeline appear near the hero.

---

## Topbar (Sticky)

Height: 52px. Stays visible while scrolling.

```
← Events    Sophia & Rafael Rodriguez    [🖨] [⇧] [+ Add service]
```

**Left:**
- Back arrow + "Events" text — navigates to `/events`
- Tappable, minimum 44px touch target

**Center:**
- Event name (14px, 500 weight)
- Truncated to single line with ellipsis if too long

**Right:**
- Print icon button (32×32px) — toggles the print panel
- Share icon button (32×32px) — future: generates a shareable link
- "+ Add service" primary button — opens service selection modal

---

## Alert Bar

**Condition:** Only renders when `event.blockingIssues.length > 0`.

```
⚠  2 issues need attention — Decoration deposit ($500) is overdue 3 days ·
   Final fitting not yet scheduled (event in 6 days)        View tasks →
```

- Background: `#FFFBEB`
- Border-bottom: `1px solid #FDE68A`
- Text: 11px, `#78350F`
- "View tasks →" scrolls to the tasks card or opens the tasks modal

**What triggers a blocking issue:**
- Payment milestone is overdue (status = 'overdue' AND dueDate < today)
- Required appointment is not scheduled AND event is ≤21 days away
- Linen/inventory item has a shortfall and event is ≤14 days away
- Alteration job is not 'fitting_scheduled' or 'complete' AND event is ≤7 days away
- Dress rental agreement not signed AND pickup is ≤3 days away

**Blocking issues are computed at page load**, not stored. The function runs against live data:

```typescript
export function getBlockingIssues(
  event: Event,
  milestones: Milestone[],
  appointments: Appointment[],
  alterations: AlterationJob[],
  inventoryAssignments: InventoryAssignment[],
  rental: DressRental | null
): BlockingIssue[] {
  const issues: BlockingIssue[] = []
  const daysUntil = differenceInDays(new Date(event.eventDate), new Date())

  // Overdue payments
  milestones
    .filter(m => m.status === 'overdue' || (m.status === 'pending' && new Date(m.dueDate) < new Date()))
    .forEach(m => issues.push({
      type: 'payment_overdue',
      label: `${m.label} ($${formatCents(m.amountCents)}) is overdue ${getOverdueDays(m.dueDate)} days`,
      severity: 'high',
      deepLink: 'milestones',
    }))

  // Missing required appointments
  const requiredAppts = getRequiredAppointments(event.services, event.type)
  requiredAppts
    .filter(type => !appointments.find(a => a.type === type && ['scheduled','done'].includes(a.status)))
    .filter(() => daysUntil <= 21)
    .forEach(type => issues.push({
      type: 'missing_appointment',
      label: `${formatAppointmentType(type)} not yet scheduled (event in ${daysUntil} days)`,
      severity: daysUntil <= 7 ? 'critical' : 'high',
      deepLink: 'timeline',
    }))

  // Alteration urgency
  alterations
    .filter(a => !['fitting_scheduled','complete'].includes(a.status) && daysUntil <= 7)
    .forEach(a => issues.push({
      type: 'alteration_urgent',
      label: `Alterations not complete — ${a.garmentDescription} (${a.status.replace(/_/g,' ')})`,
      severity: 'critical',
      deepLink: 'alterations',
    }))

  // Inventory shortfalls
  inventoryAssignments
    .filter(a => a.shortfallQuantity > 0 && daysUntil <= 14)
    .forEach(a => issues.push({
      type: 'inventory_shortfall',
      label: `${a.item.name} — ${a.shortfallQuantity} units short`,
      severity: 'medium',
      deepLink: 'decoration',
    }))

  return issues.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
}
```

---

## Hero Section

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  [eyebrow] Wedding · 6 days away                           │
│  [title]   Sophia & Rafael Rodriguez              $6,800   │
│  [meta]    Mar 22, 2026 · Chapel, McAllen · ~180 guests   │
│            Edit details →                                  │
│                                                            │
│  $6,350 paid (93%)                      $450 overdue       │
│  ████████████████████████████████░░░                       │
│                                                            │
│  [Dress] [Alterations] [Planning] [Decoration]            │
│  Coordinator: Maria G.                                     │
└────────────────────────────────────────────────────────────┘
```

### Fields

| Field | Editable via | Notes |
|-------|-------------|-------|
| Event name | Hero "Edit details" modal | Playfair Display, 22px |
| Event type | Hero modal | Wedding / Quinceañera |
| Event date | Hero modal | Shows countdown badge |
| Venue | Hero modal | Truncated if long |
| Guest count | Hero modal | Shows as "~180 guests" |
| Contract value | Hero modal | Shown in top right |
| Coordinator | Hero modal | Staff dropdown |
| Services | "+ Add service" button | Chips shown below |

### Urgency badge (top right)

```typescript
function getUrgencyBadge(daysUntil: number): { label: string; className: string } {
  if (daysUntil <= 0)   return { label: 'Today!',         className: 'ub-critical' }
  if (daysUntil <= 3)   return { label: `${daysUntil}d away`, className: 'ub-critical' }
  if (daysUntil <= 7)   return { label: `${daysUntil} days away`, className: 'ub-near' }
  if (daysUntil <= 14)  return { label: `${daysUntil} days away`, className: 'ub-near' }
  return { label: `${daysUntil} days away`, className: 'ub-ok' }
}
// ub-critical = red bg, ub-near = amber bg, ub-ok = green bg
```

### Payment progress bar

```typescript
const paidCents = milestones.filter(m => m.status === 'paid').reduce((s, m) => s + m.amountCents, 0)
const overdueCents = milestones.filter(m => m.status === 'overdue').reduce((s, m) => s + m.amountCents, 0)
const paidPercent = Math.round((paidCents / event.totalValue) * 100)

// Bar color:
// Green if no overdue milestones
// Amber if overdue but < 30% of total
// Red if overdue > 30% or event < 7 days
```

### Service chips

Rendered from `event.services[]`. Each chip has its category color:

| Service | Chip colors |
|---------|------------|
| dress_rental | bg `#DCFCE7`, text `#15803D` |
| alterations | bg `#DBEAFE`, text `#1D4ED8` |
| event_planning | bg `#EDE9FE`, text `#7C3AED` |
| decoration | bg `#FEF3C7`, text `#B45309` |

---

## Stat Strip

Always visible, 4 cells in a horizontal grid with dividers.

| Stat | Value source | Color |
|------|-------------|-------|
| Total paid | Sum of paid milestones | Green |
| Overdue | Sum of overdue milestone amounts | Red (0 = gray) |
| Tasks done | `done / total` count | Gray |
| Blocking issues | Count of blocking issues | Amber (0 = green) |

Each stat cell is a tap target — tapping scrolls to the relevant section on the page.

---

## Print Panel

Toggled by the printer icon in the topbar. Slides down below the stat strip as an expanded card.

### Print document sections

```
1. Boutique header (dark background)
   - Belori logo mark + boutique name + "Event summary — printed [date]"
   - Print / Close buttons

2. Client & event summary (2-col grid)
   - Left: client name, phone, email
   - Right: event type, date, venue, guest count

3. Services & contract value (line item table)
   - Each service with description and amount
   - Total contract value

4. Payment schedule (table with status)
   - Each milestone: label, amount, due date, status (paid ✓ / overdue ✗ / pending)

5. Important dates (list)
   - All timeline milestones with dates and status

6. Signature block (2-col)
   - Client signature line + date
   - Staff signature line + date
```

### Print-specific CSS

```css
@media print {
  .topbar, .alert-bar, .stat-strip, .print-panel-controls,
  .btn, .edit-pen, .add-note, .modal-wrap { display: none !important; }
  .body { grid-template-columns: 1fr; padding: 0; }
  .card { break-inside: avoid; margin-bottom: 14px; }
  body { background: white; font-size: 11px; }
}
```

### Download PDF action

```typescript
export async function downloadEventSummaryPDF(eventId: string): Promise<string> {
  const data = await getEventFullDetails(eventId)
  const html = renderToString(EventSummaryTemplate({ data }))

  // Server-side via Puppeteer
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdf = await page.pdf({
    format: 'Letter',
    margin: { top: '0.75in', right: '0.75in', bottom: '0.75in', left: '0.75in' },
    printBackground: true,
  })
  await browser.close()

  // Upload to Supabase Storage
  const path = `boutiques/${data.boutique.id}/events/${eventId}/summary-${Date.now()}.pdf`
  await supabase.storage.from('event-exports').upload(path, pdf, { contentType: 'application/pdf' })
  const { data: { signedUrl } } = await supabase.storage
    .from('event-exports').createSignedUrl(path, 3600)

  return signedUrl
}
```

---

## Section: Payment Milestones

### Card header

```
💳 Payment milestones
   $6,350 of $6,800 collected                [+ Add]
```

### Milestone row anatomy

```
[dot]  Booking deposit          $1,700 ✓
       Paid Mar 10, 2026 · Zelle

[dot]  Decoration deposit       $500 overdue
       Due Feb 20 — 3 days overdue    [Mark paid] [Remind]
```

**Dot colors:**
- Paid: green `#15803D`
- Pending: amber `#B45309`
- Overdue: red `#B91C1C`
- Future (>30 days): gray `#D1D5DB`

**Row actions:**
- Pending/overdue rows: "Mark paid" (rosa link) + "Remind" (gray link)
- Paid rows: "Edit" link (gray, small)
- All rows: hover shows a pencil edit icon

### Payment total block

```
Total contract value          $6,800
4 milestones · 2 paid         $450 still due  (green total, red due)
```

### Add/Edit milestone modal fields

| Field | Type | Notes |
|-------|------|-------|
| Label | Text | e.g. "Decoration deposit" |
| Amount | Number (dollars) | Converted to cents on save |
| Due date | Date picker | Required |
| Status | Select | Pending / Paid / Overdue |
| Payment method | Select | Cash / Zelle / Card / Other |
| Notes | Textarea | Optional |

### Mark paid modal fields

| Field | Type | Notes |
|-------|------|-------|
| Amount collected | Number | Pre-filled with milestone amount |
| Date received | Date | Defaults to today |
| Payment method | Select | Cash / Zelle / Card / Other |
| Notes | Textarea | Optional |

### Send reminder modal

Shows the pre-built SMS body for review before sending. Staff can edit before sending.

**Default SMS body:**
```
Hi [Client name]! This is a reminder that your [milestone label] of $[amount]
with [Boutique name] is now [N days] past due. Please call us at [phone] or
Zelle to [zelle]. Thank you! — [Boutique name]
```

**Server action:**
```typescript
export async function sendPaymentReminder(milestoneId: string, customMessage?: string) {
  const milestone = await getMilestoneWithEvent(milestoneId)
  const settings = await getAutomationSettings(milestone.boutiqueId)
  if (!settings.paymentReminder) throw new Error('Payment reminders are disabled in settings')

  const body = customMessage || buildPaymentReminderSms(milestone)
  await sendSms(milestone.event.client.phone, body, milestone.boutiqueId, 'payment_reminder', milestoneId)

  // Log to activity
  await db.insert(rentalActivityLog).values({
    eventId: milestone.eventId,
    action: 'payment_reminder_sent',
    changedByName: getStaffName(),
    notes: `Reminder sent for ${milestone.label}`,
  })

  revalidatePath(`/events/${milestone.eventId}`)
}
```

---

## Section: Dress Rental

### Card header

```
👗 Dress rental
   #BB-047 · Reserved          [Edit]  [Mark picked up]
```

**Primary action button** changes by dress status:
| Status | Button |
|--------|--------|
| Reserved | "Mark picked up" (primary) |
| Rented | "Log return" (primary) |
| Returned | "Send to cleaning" (ghost) |
| No dress | "Reserve dress" (primary) |

### Dress card

Shows:
- Gown SVG silhouette (tinted with dress color)
- Dress name (13px, 500)
- SKU + size + color + category (monospace, 11px gray)
- Rental fee + deposit status (green if paid, amber if not)
- Status badge (top right)

### Pickup / Return date tiles

Two tiles side by side:

```
┌──────────────────┐  ┌──────────────────┐
│ PICKUP DATE      │  │ RETURN DUE        │
│ Mar 21, 2026     │  │ Mar 24, 2026      │
│ 1:00 PM          │  │ by 5:00 PM        │
│                  │  │ $25/day late fee  │
└──────────────────┘  └──────────────────┘
```

Tiles background: ivory `#F8F4F0`. If return is overdue, return tile turns red.

### Edit dress rental modal fields

| Field | Type | Notes |
|-------|------|-------|
| Dress | Select (search) | Only available dresses shown |
| Pickup date | Date | Required |
| Pickup time | Time | Defaults to 1:00 PM |
| Return due date | Date | Required, must be after pickup |
| Return by time | Time | Defaults to 5:00 PM |
| Rental fee | Number | Pre-filled from dress record |
| Deposit | Number | Pre-filled from dress record |
| Notes | Textarea | Special instructions |

---

## Section: Alterations

### Card header

```
✂ Alterations
  1 active job · Ana Reyes           [+ Add job]
```

### Mini kanban board

A 4-column miniature view of the alterations kanban, scoped to jobs for this event only:

```
Measure    In progress   Fitting    Complete
─────────  ────────────  ─────────  ─────────
[card]     [card]
```

Each mini card shows: client name, work items (comma list), countdown badge.

Card is tappable — navigates to `/alterations` with the job detail panel open.

### Alteration summary line

```
Seamstress: Ana Reyes  ·  Quoted: $280  ·  Deadline: Mar 19         [Edit job]
```

Deadline in red if within 5 days and job is not complete.

### Add / Edit alteration job modal

See ALTERATIONS.md for full field spec. The modal here is a simplified version:

| Field | Type | Notes |
|-------|------|-------|
| Garment description | Text | Pre-filled with linked dress if exists |
| Work items | Chip multi-select | With price estimates |
| Seamstress | Staff dropdown | Filtered to seamstress role |
| Deadline | Date | Auto: event date − 5 days |
| Quoted price | Number | Staff sets from estimate |
| Work notes | Textarea | Instructions |
| Status | Select | Current stage |

---

## Section: Decoration & Inventory

### Card header

```
⭐ Decoration & inventory
   424 items assigned · 1 shortfall          [+ Assign item]
```

### Item list

Each assigned item shown as a row:

```
Tablecloths (white round)  #LIN-TBL-RND-WHT    ×22   [Available]
Chair sashes (gold satin)  #LIN-CS-GLD          ×180  [Available]
Chair covers (white fitted)  #LIN-CC-WHT        ×145 of 180  [35 short]
Tall centerpiece sets  #CTR-TALL-01             ×22   [Available]
```

**Availability badge colors:**
- Available: green
- Partially available: amber (shows "X of Y")
- Unavailable: red

### Shortfall banner

Shown at bottom of card when any item has a shortfall:

```
35 chair covers short — source externally before Mar 20    Resolve →
```

Background: `#FEF3C7`, text: `#78350F`. "Resolve →" opens a task creation modal.

### Assign item modal fields

| Field | Type | Notes |
|-------|------|-------|
| Search items | Search input | Searches inventory by name/SKU |
| Category | Dropdown | Filter by category |
| Quantity | Number | Required for quantity items |
| Return due | Date | Auto: event date + 1 day |
| Notes | Textarea | Setup instructions |

---

## Section: Event Tasks

### Card header

```
☰ Event tasks
  7 of 10 done · 2 urgent              [+ Add task]
```

### Task row anatomy

```
[checkbox] Task description text                    [Category pill]
```

**Checkbox states:**
- Unchecked: empty `1.5px solid #E5E7EB` border
- Alert/urgent: red background, white border (shows even when unchecked)
- Checked/done: green fill with white checkmark

**Text states:**
- Alert text: red color
- Done text: line-through + gray color
- Normal: dark ink

**Category pill colors:**
| Category | Badge style |
|----------|------------|
| Payment | red-bg / red text |
| Fitting | blue-bg / blue text |
| Rental | rosa-bg / rosa text |
| Deco | amber-bg / amber text |
| Planning | purple-bg / purple text |
| General | gray-bg / gray text |

### Task toggling

Clicking anywhere on a task row toggles done/undone. No confirmation needed (low-stakes, undoable immediately).

```typescript
export async function toggleTask(taskId: string, done: boolean) {
  await db.update(eventTasks)
    .set({ done, doneAt: done ? new Date() : null })
    .where(eq(eventTasks.id, taskId))

  revalidatePath(`/events/${eventId}`)
}
```

### Add task modal fields

| Field | Type | Notes |
|-------|------|-------|
| Task description | Textarea | Required |
| Category | Select | See categories above |
| Priority | Select | Normal / Alert (urgent) |

---

## Section: Staff Notes

### Card header

```
📋 Staff notes
   3 notes
```

### Note row anatomy

```
[Avatar]  Isabel M.  Mar 14 · 4:12pm
          Client called — venue chair covers fell through.
          Need to source 35 more externally.
```

- Avatar: initials circle, colored by staff role
- Author name: 11px, 500
- Timestamp: 10px, gray
- Note text: 12px, gray, line-height 1.5

### Add note input

An always-visible single-line input at the bottom of the notes card:

```
[Add a note visible to all staff...]     [Save]
```

On Enter key or "Save" tap → note appears immediately at top of feed (optimistic UI update), then fires server action.

```typescript
export async function addEventNote(eventId: string, text: string) {
  const { userId } = auth()
  const staff = await getStaffByClerkUserId(userId)

  await db.insert(eventNotes).values({
    eventId,
    boutiqueId: staff.boutiqueId,
    text,
    authorId: staff.id,
    authorName: staff.name,
    authorRole: staff.role,
    category: 'general',
  })

  revalidatePath(`/events/${eventId}`)
}
```

Notes are visible to all staff in the boutique. No delete — notes are permanent. Staff can add a correction note if something was entered incorrectly.

---

## Section: Client Info (Right Column)

### Card header

```
👤 Client                                          [Edit]
```

### Content

```
[SR avatar]  Sophia Rodriguez
             Partner: Rafael Rodriguez

Phone         (956) 214-8830
Email         sophia.r@gmail.com
Language      English / EN
Lifetime value  $6,800
```

- Avatar: 44px circle, rosa-pale background, rosa initials
- "Lifetime value" = sum of all paid milestones across all events for this client

### Edit client modal fields

| Field | Type | Notes |
|-------|------|-------|
| First name | Text | Required |
| Last name | Text | Required |
| Phone | Tel input | Required — for SMS |
| Email | Email input | Optional |
| Partner / honoree | Text | Wedding: partner, Quince: honoree |
| Preferred language | Select | EN / ES / Both |

---

## Section: Event Details (Right Column)

### Card header

```
📅 Event details                                   [Edit]
```

### Fields shown (key-value rows)

| Field | Value |
|-------|-------|
| Date | Sat, Mar 22, 2026 |
| Venue | St. Anthony's Chapel, McAllen |
| Guest count | ~180 |
| Tables | 22 dinner + 1 head |
| Coordinator | Maria G. |
| Package | Full Service Wedding |
| Contract value | $6,800 |

All rows editable via the shared "Edit event details" modal (same as hero "Edit details").

### Edit event details modal fields

| Field | Type | Notes |
|-------|------|-------|
| Event name | Text | Required, max 80 chars |
| Event type | Toggle | Wedding / Quinceañera |
| Event date | Date | Required, must be future |
| Venue | Text | Optional |
| Guest count | Number | Min 1 |
| Dinner tables | Number | Auto-suggested from guest count ÷ 8 |
| Head tables | Number | Default 1 |
| Coordinator | Staff select | Required |
| Package | Package select | Optional |
| Contract value | Number (dollars) | Required |

---

## Section: Important Dates (Right Column)

### Card header

```
⏰ Important dates                                 [+ Add]
```

### Timeline component

Vertical timeline with dots and connector lines:

```
● done      Mar 10  Booking confirmed
│           Contract signed · Lead converted
│
● done      Mar 5   Measurements taken
│           Sophia · Ana Reyes
│
● done      Mar 12  1st fitting
│           Approved — minor waist adjustment
│
● ERROR     Mar 19  Final fitting ← NOT SCHEDULED
│           Must be done by this date
│           [Schedule →] button
│
○ pending   Mar 21  Dress pickup
│           Sophia picks up #BB-047 · 1:00 PM
│
◉ active    Mar 22  EVENT DAY
│           St. Anthony's Chapel · Ceremony 4pm
│
○ pending   Mar 24  Dress return due
            Return #BB-047 by 5:00 PM
```

**Dot styles:**
| State | Style |
|-------|-------|
| done | Filled rosa `#C9697A` |
| active (event day) | Filled rosa + outer ring (pulse) |
| error / overdue | Filled red `#B91C1C` |
| warning | Filled amber `#B45309` |
| pending | Empty gray `#E5E7EB` |

**Auto-generated timeline entries** (created when event is saved or services are added):

| Entry | Condition |
|-------|---------|
| Booking confirmed | Always |
| Measurements | alterations service selected |
| 1st fitting | alterations, if bustle/waist work items exist |
| Final fitting | alterations service selected |
| Dress pickup | dress_rental service selected |
| Event day | Always (the event date itself) |
| Dress return due | dress_rental service selected |
| Decoration setup | decoration service selected |

**Custom dates** can be added by staff (venue walkthrough, final payment deadline, etc.).

### Add date modal fields

| Field | Type | Notes |
|-------|------|-------|
| Label | Text | e.g. "Venue walkthrough" |
| Date | Date picker | Required |
| Time | Time | Optional |
| Notes | Text | Additional context |

---

## Section: Upcoming Appointments (Right Column)

### Card header

```
🕐 Upcoming appointments                           [+ Schedule]
```

### Appointment rows

```
[time]  [avatar]  Sophia Rodriguez              [badge]
                  Final fitting — today
```

- Shows next 3 upcoming appointments for this event
- If no appointments: "No appointments scheduled" with "+ Schedule" button prominent
- "Today" appointments shown with red badge
- Past appointments shown with green "Done" badge

### Schedule appointment modal fields

| Field | Type | Notes |
|-------|------|-------|
| Appointment type | Select | Measurements / Fitting 1 / Final fitting / Pickup / Planning consult / Other |
| Date | Date picker | Required |
| Time | Time picker | Required |
| Assigned staff | Staff select | Filtered by appointment type |
| Notes | Textarea | Optional |

Warning block shown when scheduling final fitting within 7 days of event:
```
⚠ Final fitting must be completed at least 5 days before the event.
  You are scheduling 4 days before — this is very tight. Please confirm.
```

---

## Section: Vision & Inspiration (Right Column)

### Card header

```
✨ Vision & inspiration                            [Edit]
```

### Content

**Color palette swatches:**
- Row of 5 filled circles (28px) with color names below

**Style tags:**
- Badge chips (rosa pale): "Romantic & soft" · "Classic & elegant" · "Garden & floral"

**Vision quote:**
- Italic, 12px, gray, line-height 1.5
- In quotation marks

**Florals:**
- 12px, gray, one line

**Inspiration photos:**
- Row of up to 5 thumbnail boxes (52×52px)
- Shows count if more than 5 ("+ 3 more")
- Tap any thumbnail to open full lightbox

### Edit inspiration modal fields

| Field | Type | Notes |
|-------|------|-------|
| Colors | Text (comma list) | e.g. "Ivory, Champagne, Gold" |
| Style themes | Multi-select chips | 10 preset themes |
| Vision statement | Textarea | Client's own words |
| Flower preferences | Text | Including allergy notes |
| Cultural / religious notes | Text | Traditions, ceremony elements |
| Inspiration photos | File upload | Up to 10 photos, max 10MB each |

---

## Inline Edit Pattern

Every editable section uses this pattern — NOT navigation to a new page.

### Pattern

1. Each section card has an "Edit" button in the card header
2. Clicking "Edit" opens a modal (centered overlay on desktop, bottom sheet on mobile)
3. Modal is pre-filled with current values
4. Save fires a Server Action, closes the modal, and revalidates the page
5. A toast notification confirms: "Changes saved" (green, top-center, 2.2s)

### Modal anatomy

```
┌──────────────────────────────────────┐
│  Modal title                    [×]  │  ← header, 14px, border-bottom
│                                      │
│  Form fields (scrollable)            │  ← 14px padding
│                                      │
│──────────────────────────────────────│
│  [Cancel]          [Save changes]    │  ← sticky footer
└──────────────────────────────────────┘
```

Mobile: Bottom sheet with drag handle, slides up from bottom, 90vh max height.
Desktop: Centered overlay, max-width 440px, max-height 85vh.

### Shared Server Action pattern

```typescript
export async function updateEventSection(
  eventId: string,
  section: EventSection,
  data: Partial<Event>
) {
  const { orgId, userId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)
  const staff = await getStaffByClerkUserId(userId, boutique.id)

  // Role check for financial fields
  const financialFields = ['totalValue', 'services']
  const isFinancialEdit = Object.keys(data).some(k => financialFields.includes(k))
  if (isFinancialEdit && !['owner', 'coordinator'].includes(staff.role)) {
    throw new Error('PERMISSION_DENIED: Only coordinators and owners can edit financial details')
  }

  await db.update(events)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(events.id, eventId), eq(events.boutiqueId, boutique.id)))

  // Log the change
  await db.insert(eventActivityLog).values({
    eventId,
    boutiqueId: boutique.id,
    action: `${section}_updated`,
    changedByName: staff.name,
    changedByRole: staff.role,
  })

  revalidatePath(`/events/${eventId}`)
}
```

---

## Role-Based Visibility & Editing

| Section | Owner | Coordinator | Front desk | Seamstress | Decorator |
|---------|-------|-------------|------------|------------|-----------|
| Hero — view | ✓ | ✓ | ✓ | Basic only | Basic only |
| Hero — edit | ✓ | ✓ | ✗ | ✗ | ✗ |
| Payment milestones — view | ✓ | ✓ | ✗ | ✗ | ✗ |
| Payment milestones — mark paid | ✓ | ✓ | ✗ | ✗ | ✗ |
| Dress rental — view | ✓ | ✓ | ✓ | ✓ | ✗ |
| Dress rental — edit | ✓ | ✓ | ✓ (limited) | ✗ | ✗ |
| Alterations — view | ✓ | ✓ | ✓ | ✓ (own jobs) | ✗ |
| Alterations — edit | ✓ | ✓ | ✗ | ✓ (status only) | ✗ |
| Decoration — view | ✓ | ✓ | ✓ | ✗ | ✓ |
| Decoration — edit | ✓ | ✓ | ✓ | ✗ | ✓ |
| Tasks — check off | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tasks — add/delete | ✓ | ✓ | ✓ | ✗ | ✗ |
| Notes — view | ✓ | ✓ | ✓ | ✓ | ✓ |
| Notes — add | ✓ | ✓ | ✓ | ✓ | ✓ |
| Client info — edit | ✓ | ✓ | ✗ | ✗ | ✗ |
| Inspiration — edit | ✓ | ✓ | ✓ | ✗ | ✓ |
| Print — access | ✓ | ✓ | ✓ | ✗ | ✗ |

"Basic only" for seamstress and decorator = sees event name, date, venue only. No payments, no client contact info.

---

## Data Fetching Strategy

The event detail page uses a single server-side data fetch that loads all related records in parallel:

```typescript
// app/events/[eventId]/page.tsx

export default async function EventDetailPage({ params }: { params: { eventId: string } }) {
  const { orgId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)

  const [
    event,
    milestones,
    appointments,
    alterations,
    rental,
    inventoryAssignments,
    tasks,
    notes,
    staff,
  ] = await Promise.all([
    getEventById(params.eventId, boutique.id),
    getMilestonesByEvent(params.eventId),
    getAppointmentsByEvent(params.eventId),
    getAlterationsByEvent(params.eventId),
    getDressRentalByEvent(params.eventId),
    getInventoryAssignmentsByEvent(params.eventId),
    getTasksByEvent(params.eventId),
    getNotesByEvent(params.eventId),
    getAllStaff(boutique.id),
  ])

  if (!event) notFound()

  const blockingIssues = getBlockingIssues(
    event, milestones, appointments, alterations, inventoryAssignments, rental
  )

  return (
    <EventDetailPage
      event={event}
      milestones={milestones}
      appointments={appointments}
      alterations={alterations}
      rental={rental}
      inventoryAssignments={inventoryAssignments}
      tasks={tasks}
      notes={notes}
      staff={staff}
      blockingIssues={blockingIssues}
    />
  )
}
```

All mutations revalidate `revalidatePath(`/events/${eventId}`)` which triggers a fresh server-side fetch.

---

## Responsive Layout

### Desktop (≥1024px)
Two-column layout: `1fr 300px`. All cards visible, no collapsing.

### Tablet (768–1023px)
Two-column layout: `1fr 240px`. Right column narrows slightly. Cards remain side by side.

### Mobile (<768px)
Single column. Order of sections:
1. Hero
2. Stat strip
3. Alert bar (if any)
4. Client info (moved up from right column)
5. Event details
6. Important dates
7. Upcoming appointments
8. Payment milestones
9. Dress rental
10. Alterations
11. Decoration & inventory
12. Tasks
13. Staff notes
14. Inspiration

Bottom padding: 80px to clear the bottom nav bar.

---

## Database Query Functions

```typescript
// lib/db/queries/eventDetail.ts

export async function getEventById(eventId: string, boutiqueId: string) {
  return db.query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.boutiqueId, boutiqueId)),
    with: {
      client: true,
      coordinator: true,
      package: true,
      bookingLead: true,
    }
  })
}

export async function getMilestonesByEvent(eventId: string) {
  return db.query.paymentMilestones.findMany({
    where: eq(paymentMilestones.eventId, eventId),
    orderBy: [asc(paymentMilestones.dueDate)],
  })
}

export async function getAppointmentsByEvent(eventId: string) {
  return db.query.appointments.findMany({
    where: eq(appointments.eventId, eventId),
    with: { staff: true },
    orderBy: [asc(appointments.scheduledAt)],
  })
}

export async function getAlterationsByEvent(eventId: string) {
  return db.query.alterationJobs.findMany({
    where: eq(alterationJobs.eventId, eventId),
    with: { seamstress: true, dress: true },
  })
}

export async function getDressRentalByEvent(eventId: string) {
  return db.query.dressRentals.findFirst({
    where: and(eq(dressRentals.eventId, eventId), isNull(dressRentals.returnedAt)),
    with: { dress: true },
  })
}

export async function getInventoryAssignmentsByEvent(eventId: string) {
  return db.query.inventoryAssignments.findMany({
    where: and(
      eq(inventoryAssignments.eventId, eventId),
      isNull(inventoryAssignments.returnedAt),
    ),
    with: { item: { with: { category: true } } },
    orderBy: [asc(inventoryAssignments.createdAt)],
  })
}

export async function getTasksByEvent(eventId: string) {
  return db.query.eventTasks.findMany({
    where: eq(eventTasks.eventId, eventId),
    orderBy: [desc(eventTasks.isAlert), asc(eventTasks.done), asc(eventTasks.createdAt)],
  })
}

export async function getNotesByEvent(eventId: string) {
  return db.query.eventNotes.findMany({
    where: eq(eventNotes.eventId, eventId),
    orderBy: [desc(eventNotes.createdAt)],
    limit: 20,
  })
}
```

---

## Component Structure

```
app/events/[eventId]/
├── page.tsx                          # Server component — data fetch + layout
├── loading.tsx                       # Skeleton loading state
└── not-found.tsx                     # 404 if event not found

components/events/detail/
├── EventDetailPage.tsx               # Client wrapper — manages modal state
├── EventTopbar.tsx                   # Sticky topbar
├── EventAlertBar.tsx                 # Blocking issues banner
├── EventHero.tsx                     # Hero section
├── EventStatStrip.tsx                # 4-stat horizontal strip
├── EventPrintPanel.tsx               # Collapsible print/export document
├── sections/
│   ├── PaymentMilestonesCard.tsx     # Milestones with mark paid / remind
│   ├── DressRentalCard.tsx           # Dress + pickup/return tiles
│   ├── AlterationsCard.tsx           # Mini kanban + alteration summary
│   ├── DecorationCard.tsx            # Inventory items + shortfall banner
│   ├── EventTasksCard.tsx            # Checklist with tap-to-toggle
│   ├── StaffNotesCard.tsx            # Notes feed + add note input
│   ├── ClientInfoCard.tsx            # Client details (right col)
│   ├── EventDetailsCard.tsx          # Event fields (right col)
│   ├── ImportantDatesCard.tsx        # Visual timeline (right col)
│   ├── UpcomingAppointmentsCard.tsx  # Next 3 appointments (right col)
│   └── InspirationCard.tsx           # Colors, themes, vision (right col)
├── modals/
│   ├── EditEventModal.tsx            # Hero + event details edit
│   ├── EditClientModal.tsx           # Client info edit
│   ├── AddMilestoneModal.tsx         # New milestone
│   ├── EditMilestoneModal.tsx        # Edit existing milestone
│   ├── MarkPaidModal.tsx             # Record payment
│   ├── SendReminderModal.tsx         # SMS preview + send
│   ├── EditDressRentalModal.tsx      # Dress rental edit
│   ├── AddAlterationModal.tsx        # New alteration job
│   ├── EditAlterationModal.tsx       # Edit existing alteration
│   ├── AssignInventoryModal.tsx      # Assign decoration items
│   ├── AddTaskModal.tsx              # New task
│   ├── ScheduleAppointmentModal.tsx  # Schedule appointment
│   ├── AddDateModal.tsx              # Add custom timeline date
│   └── EditInspirationModal.tsx      # Colors, themes, photos
└── shared/
    ├── SectionCard.tsx               # Reusable card shell
    ├── KvRow.tsx                     # Key-value row with hover edit pen
    └── EditableSectionWrapper.tsx    # Read-only view + inline edit toggle
```

---

## TypeScript Types

```typescript
export interface BlockingIssue {
  type: 'payment_overdue' | 'missing_appointment' | 'alteration_urgent' | 'inventory_shortfall'
  label: string
  severity: 'critical' | 'high' | 'medium'
  deepLink: 'milestones' | 'timeline' | 'alterations' | 'decoration'
}

export interface EventDetailData {
  event: Event
  milestones: PaymentMilestone[]
  appointments: Appointment[]
  alterations: AlterationJob[]
  rental: DressRental | null
  inventoryAssignments: InventoryAssignment[]
  tasks: EventTask[]
  notes: EventNote[]
  staff: Staff[]
  blockingIssues: BlockingIssue[]
}

export interface EventTimelineEntry {
  id: string
  label: string
  date: Date | null
  status: 'done' | 'active' | 'warning' | 'error' | 'pending'
  subtitle?: string
  actionLabel?: string
  actionModal?: ModalKey
  isEventDay?: boolean
  isCustom?: boolean
}
```

---

## Validation Rules

| Action | Rule | Error |
|--------|------|-------|
| Edit event date | Cannot be in the past | "Event date must be in the future" |
| Edit contract value | Must be > 0 | "Contract value must be greater than 0" |
| Add milestone | Amount + existing milestones ≤ contract value | "Total milestones cannot exceed contract value" |
| Mark paid | Amount ≤ milestone amount | "Amount cannot exceed the milestone amount" |
| Edit client phone | Must be valid phone format | "Please enter a valid phone number" |
| Edit client email | Must be valid email format | "Please enter a valid email address" |
| Schedule appointment | Date must be before event date | "Appointment must be before the event" |
| Add custom date | Required: label and date | "Label and date are required" |
| Add note | Min 3 characters | "Note must be at least 3 characters" |
| Upload inspiration photo | Max 10MB | "Photo must be under 10MB" |

---

## Revalidation Map

Every mutation on the event detail page must revalidate:
- `revalidatePath(`/events/${eventId}`)` — the detail page
- `revalidatePath('/events')` — the events list (urgency badges update)
- `revalidatePath('/dashboard')` — dashboard stats update
- Module-specific paths when cross-module data changes:
  - Milestone paid → `revalidatePath('/payments')`
  - Dress status changed → `revalidatePath('/inventory/rentals')`
  - Alteration status changed → `revalidatePath('/alterations')`
  - Inventory assigned → `revalidatePath('/inventory')`
