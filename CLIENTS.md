# CLIENTS.md — Belori Clients Page & Client Detail Spec

> **Purpose:** This file defines the complete clients module — the clients list page, client detail page, loyalty tier system, lifetime value tracking, editable fields, all tabs, preferences, history, and cross-module connections. Paste alongside PRD.md, TECH_STACK.md, and SERVICE_LINKS.md when building the clients feature.

---

## Overview

The clients module is the relationship layer of Belori. Every booking, rental, payment, alteration, and note ultimately belongs to a client. The clients page gives boutique staff a full picture of who their clients are, how much they've spent, how loyal they are, and what their preferences are — so every interaction feels personal.

Two primary surfaces:
- **Clients list** — sortable, filterable roster of all clients with tier badges, revenue, and quick status
- **Client detail** — full profile with 5 tabs: event history, dress rentals, payments, notes, preferences

---

## Routes

```
/clients                    — Clients list page
/clients/[clientId]         — Client detail page
```

Accessible from:
- Sidebar "Clients" nav item
- Event detail → client name link
- Dashboard → appointment row → client name
- Booking leads → "Convert to event" → creates client record

---

## Database Schema

### `clients` table

```typescript
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),

  // Identity
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  partnerName: text('partner_name'),     // Wedding: partner · Quince: honoree
  email: text('email'),
  phone: text('phone').notNull(),
  preferredLanguage: text('preferred_language').default('en'),
  // 'en' | 'es' | 'both'

  // Acquisition
  howFound: text('how_found'),
  // 'google' | 'instagram' | 'facebook' | 'tiktok' | 'referral' | 'walk_in' | 'expo' | 'returning' | 'other'
  referredById: uuid('referred_by_id').references(() => clients.id),

  // Loyalty
  loyaltyPoints: integer('loyalty_points').default(0),
  loyaltyTier: text('loyalty_tier').default('new'),
  // 'new' | 'regular' | 'loyal' | 'vip' | 'diamond'
  loyaltyTierUpdatedAt: timestamp('loyalty_tier_updated_at'),

  // Preferences
  stylePreferences: text('style_preferences').array().default([]),
  communicationPreferences: text('communication_preferences').array().default([]),
  // ['sms', 'email', 'whatsapp', 'appointment_reminders']
  colorPreferences: text('color_preferences').array().default([]),
  allergyNotes: jsonb('allergy_notes').default([]),
  // [{ note: string, confirmedAt: date }]

  // Computed (denormalized for fast list queries)
  totalSpentCents: integer('total_spent_cents').default(0),
  totalEvents: integer('total_events').default(0),
  lastActivityAt: timestamp('last_activity_at'),

  // Status
  isActive: boolean('is_active').default(true),
  notes: text('notes'),              // Quick notes field on the client record itself
  tags: text('tags').array().default([]),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

### `client_notes` table (staff notes about the client)

```typescript
export const clientNotes = pgTable('client_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  text: text('text').notNull(),
  authorId: uuid('author_id').references(() => staff.id),
  authorName: text('author_name').notNull(),
  authorRole: text('author_role').notNull(),
  category: text('category').default('general'),
  // 'general' | 'measurement' | 'preference' | 'follow_up'
  createdAt: timestamp('created_at').defaultNow(),
})
```

### `client_activity_log` table

```typescript
export const clientActivityLog = pgTable('client_activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  action: text('action').notNull(),
  // 'event_created' | 'payment_received' | 'rental_created' | 'rental_returned'
  // 'note_added' | 'contact_updated' | 'loyalty_tier_changed' | 'referral_made'
  relatedEntityId: uuid('related_entity_id'),
  relatedEntityType: text('related_entity_type'),
  changedByName: text('changed_by_name'),
  notes: text('notes'),
  pointsAwarded: integer('points_awarded').default(0),
  createdAt: timestamp('created_at').defaultNow(),
})
```

---

## Loyalty Tier System

### Tier definitions

| Tier | Points required | Color | Benefits |
|------|----------------|-------|---------|
| New | 0–499 | Gray | Standard service |
| Regular | 500–1,499 | Blue | Priority scheduling |
| Loyal | 1,500–2,999 | Purple | 5% off alterations + free measurements |
| VIP | 3,000–4,999 | Gold/Black | 10% off alterations + priority scheduling |
| Diamond | 5,000+ | Gold shimmer | 15% off all services + dedicated coordinator |

### How points are earned

```typescript
const LOYALTY_POINT_RULES = {
  event_created:          100,    // Any new event booked
  payment_received:       (cents: number) => Math.floor(cents / 100),
  // 1 point per $1 paid
  dress_rental_completed: 50,     // Dress returned in good condition
  review_given:           100,    // After event, if review submitted
  referral_converted:     200,    // When a client they referred books an event
  repeat_event:           150,    // Any event beyond their first
}
```

### Tier upgrade/downgrade logic

```typescript
export async function recalculateClientTier(clientId: string) {
  const client = await getClientById(clientId)
  const newTier = getTierFromPoints(client.loyaltyPoints)

  if (newTier !== client.loyaltyTier) {
    await db.update(clients)
      .set({ loyaltyTier: newTier, loyaltyTierUpdatedAt: new Date() })
      .where(eq(clients.id, clientId))

    // Log tier change
    await db.insert(clientActivityLog).values({
      clientId,
      boutiqueId: client.boutiqueId,
      action: 'loyalty_tier_changed',
      notes: `Tier changed from ${client.loyaltyTier} to ${newTier}`,
    })

    // Notify owner if client reaches VIP or Diamond
    if (['vip', 'diamond'].includes(newTier)) {
      await inngest.send({
        name: 'client.tier_upgraded',
        data: { clientId, newTier, boutiqueId: client.boutiqueId },
      })
    }
  }
}

export function getTierFromPoints(points: number): LoyaltyTier {
  if (points >= 5000) return 'diamond'
  if (points >= 3000) return 'vip'
  if (points >= 1500) return 'loyal'
  if (points >= 500)  return 'regular'
  return 'new'
}

export function getPointsToNextTier(points: number): { next: LoyaltyTier; needed: number } {
  const thresholds = [500, 1500, 3000, 5000]
  const tiers: LoyaltyTier[] = ['regular', 'loyal', 'vip', 'diamond']
  for (let i = 0; i < thresholds.length; i++) {
    if (points < thresholds[i]) {
      return { next: tiers[i], needed: thresholds[i] - points }
    }
  }
  return { next: 'diamond', needed: 0 }
}
```

### Loyalty points — awarding on actions

```typescript
export async function awardLoyaltyPoints(
  clientId: string,
  action: LoyaltyAction,
  relatedAmount?: number
) {
  let points = 0
  if (action === 'payment_received' && relatedAmount) {
    points = Math.floor(relatedAmount / 100) // $1 = 1 point
  } else {
    points = LOYALTY_POINT_RULES[action] as number ?? 0
  }

  if (points <= 0) return

  await db.update(clients)
    .set({ loyaltyPoints: sql`loyalty_points + ${points}` })
    .where(eq(clients.id, clientId))

  await db.insert(clientActivityLog).values({
    clientId,
    action,
    pointsAwarded: points,
    notes: `+${points} pts for ${action}`,
  })

  await recalculateClientTier(clientId)
}
```

---

## Clients List Page

### Route
`/clients`

### Topbar
```
Clients                                    [List ▾] [Grid ▾]  [+ New client]
42 clients · $86,400 total revenue
```

### Stat strip (4 cells)

| Stat | Source |
|------|--------|
| Total clients | `COUNT(*) WHERE isActive = true` |
| VIP clients | `COUNT(*) WHERE tier = 'vip' OR tier = 'diamond'` |
| Lifetime revenue | `SUM(totalSpentCents)` across all clients |
| Returning clients | `COUNT(*) WHERE totalEvents > 1` |

### Filter bar

Search box (full width) + filter pills:

```
[🔍 Search by name, phone, or event...]

[All (42)]  [VIP (5)]  [Loyal (12)]  [New (8)]
[Has overdue (3)]  [Inactive 60+ days (6)]
```

Filter logic:
- `All` — all active clients
- `VIP` — tier = 'vip' OR tier = 'diamond'
- `Loyal` — tier = 'loyal'
- `New` — tier = 'new' AND createdAt > 30 days ago
- `Has overdue` — has at least one payment milestone with status = 'overdue'
- `Inactive 60+ days` — lastActivityAt < 60 days ago AND no upcoming event

### View toggle (List / Grid)

**List view (default):** Full-width cards with all client details.

**Grid view:** Compact 3-column cards showing name, tier, value, last activity.

### Client card (list view)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Avatar]  Sophia Rodriguez  [VIP] [Has overdue]    $6,800       │
│           (956) 214-8830 · sophia.r@gmail.com      1 event      │
│           [Wedding] [Dress rental] [Alterations]  Last: Mar 10  │
└─────────────────────────────────────────────────────────────────┘
```

**Avatar:** 44px circle with initials (2 letters), colored by tier:
| Tier | Background | Text |
|------|-----------|------|
| Diamond | `#D4AF37` | `#1C1012` |
| VIP | `#FDF5F6` | `#C9697A` |
| Loyal | `#EDE9FE` | `#7C3AED` |
| Regular | `#DBEAFE` | `#1D4ED8` |
| New | `#F3F4F6` | `#6B7280` |

**VIP border accent:** `border-left: 3px solid #D4AF37`

**Tags:** Event type chips (rosa pale) showing what services the client has used.

**Overdue badge:** Red "Has overdue" badge if client has outstanding payments.

**Entire card is tappable** — navigates to client detail.

### Sorting

Clicking column headers (in list view, a sort bar appears above cards):
- Name A–Z / Z–A
- Lifetime value high/low
- Last activity (most recent first)
- Loyalty points (highest first)
- Events (most first)

Default sort: Lifetime value descending.

### New client modal fields

| Field | Type | Required | Notes |
|-------|------|---------|-------|
| First name | Text | Yes | |
| Last name | Text | Yes | |
| Phone | Tel | Yes | Unique within boutique |
| Email | Email | No | |
| Partner / honoree | Text | No | Wedding: partner · Quince: honoree |
| Preferred language | Select | No | EN / ES / Both |
| How found us | Select | No | Acquisition tracking |

Validation:
- Phone must be unique within the boutique — show warning "A client with this phone number already exists: [name]" with option to view existing client instead.

---

## Client Detail Page

### Route
`/clients/[clientId]`

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  TOPBAR (sticky)                                           │
│  ← All clients  |  Sophia Rodriguez                        │
├────────────────────┬───────────────────────────────────────┤
│  LEFT SIDEBAR      │  RIGHT CONTENT (tabbed)               │
│  · Avatar + name   │  [History] [Dresses] [Payments]       │
│  · Tier badge      │  [Notes]   [Preferences]              │
│  · Loyalty meter   │                                       │
│  · Contact info    │  Tab content (scrollable)             │
│  · Lifetime stats  │                                       │
│  · Source/referral │                                       │
└────────────────────┴───────────────────────────────────────┘
```

Left sidebar: 300px fixed.
Right content: `1fr`, scrollable.
Mobile: Stacks vertically (sidebar above, tabs below).

---

## Left Sidebar — Client Profile

### Avatar + name block

```
[SR]  ← 56px circle, tier color
Sophia Rodriguez  ← 16px, Georgia serif
Client since March 2026

★ VIP Client  ← tier badge
```

**Tier badge styles:**
| Tier | Badge |
|------|-------|
| Diamond | `background: #D4AF37, color: #1C1012, border: 1px solid #92400E` |
| VIP | `background: #1C1012, color: #D4AF37, border: 1px solid #D4AF37` |
| Loyal | `background: #EDE9FE, color: #7C3AED` |
| Regular | `background: #DBEAFE, color: #1D4ED8` |
| New | `background: #F3F4F6, color: #6B7280` |

### Loyalty progress meter

```
4,200 pts
800 pts to Diamond tier

New ── Regular ── Loyal ── VIP ── Diamond
████████████████████████████████░░░░░  84%

✓  10% off next alteration
✓  Free measurements consultation
○  Priority scheduling (Diamond)
```

- Progress bar fills from 0 to 100% within the current tier's range
- Color: linear gradient `#C9697A → #D4AF37` (rosa to gold)
- Active perks: green checkmarks
- Locked perks: gray circles

### Contact section (editable)

Inline edit pattern — "Edit" link in section header toggles between read-only KV rows and an inline edit form.

Fields:
- Phone (tel)
- Email (email)
- Preferred language (select)
- Partner / honoree name (text)

### Lifetime value section (read-only)

| Field | Value |
|-------|-------|
| Total spent | Sum of all paid milestones |
| Events | Count of events |
| Dress rentals | Count of completed dress rentals |
| Avg event value | totalSpentCents / totalEvents |
| Last activity | Most recent event creation, payment, or rental date |

### Source & referral section (editable)

| Field | Type |
|-------|------|
| How found us | Select (same options as new client) |
| Referred by | Client search (links to another client record) |
| Referral count | Read-only — how many clients this client has referred |

---

## Right Content — 5 Tabs

### Tab 1: Event history

**Lifetime summary strip** (3 cards):
- Total spent (green)
- Total events (count)
- Services used (count of unique service types)

**Events grouped by year** (year label with line divider)

**Event history card:**
```
Sophia & Rafael Rodriguez — Wedding        [Active]
Saturday, March 22, 2026 · St. Anthony's Chapel

[Dress rental] [Alterations] [Planning] [Decoration]

~180 guests · Maria G. coordinator         $6,350 / $6,800 paid
```

Card is tappable → navigates to `/events/[eventId]`

Event status badges: Active (amber) · Complete (green) · Cancelled (gray) · Upcoming (blue)

If client has no events, show an empty state:
```
No events yet
When you create an event for [Client name], it will appear here.
[+ Create event →]
```

### Tab 2: Dress rentals

**Two sections:**

**Current rentals** (if any active):
- Dress name, SKU, size, color
- Event link
- Pickup / return dates
- Fee + deposit status
- Status badge

**Rental history** (all completed):
```
[gown icon]  Ivory A-line cathedral
             #BB-047 · Size 8 · Wedding Mar 22
             Rental fee: $450 · Condition on return: —
```

Each history row shows: dress name, SKU, event date, rental fee, return condition badge.

If no history: "This is [Client]'s first rental with us."

### Tab 3: Payments

**Payment summary strip** (3 cards):
- Total paid (green)
- Outstanding (red, 0 = not shown)
- Milestone count (total)

**Payment history list:**
```
● Mar 10  Booking deposit        $1,700  ✓  Zelle
● Feb 14  Mid-point payment      $3,400  ✓  Cash
● —       Decoration deposit     $500    ✗  OVERDUE  [Remind]
● —       Final balance          $1,200  ⋯  Due Mar 8
```

Each row:
- Colored dot (green = paid, red = overdue, amber = upcoming, gray = far future)
- Milestone label
- Amount
- Date (paid date if paid, due date otherwise)
- Status indicator
- "Remind" link for overdue items

**All payments across all events** — grouped by event if client has multiple events.

### Tab 4: Notes

Staff notes about the client (not event-specific). These are observations about the person:
- Communication preferences
- Measurement notes
- Personality/relationship notes
- Follow-up reminders

```
[IM]  Isabel M.  Mar 14 · 4:12pm
      Client is very detail-oriented — always confirm twice before appointments.
      Prefers morning slots (before 11am).

[AR]  Ana R.  Mar 5 · 2:00pm
      Measurements: Bust 36, Waist 28, Hips 38. Waist -1.5". Likes bustle tight.
```

Add note input: always-visible single-line field at bottom. Enter key or "Save" button saves immediately.

Note categories (shown as small tag on each note):
- General (default)
- Measurement
- Preference
- Follow-up

### Tab 5: Preferences

**Communication preferences** (chip multi-select — tap to toggle):
- SMS reminders
- Email invoices
- WhatsApp
- Appointment reminders

**Style preferences** (chip multi-select):
- Romantic, Classic & elegant, Modern & minimal, Rustic & boho
- Glamorous & bold, Garden & floral, Traditional, Cultural (Mexican)
- Fairy tale, Beach & tropical

**Preferred colors:**
- Swatch display (same color picker as event creation)
- Inline edit: tap swatches to add/remove

**Allergies & restrictions:**
- Red alert banner for each allergy: "No lilies — allergy (confirmed Mar 5, 2026)"
- "+ Add note" button → opens allergy modal

**Allergy modal fields:**

| Field | Type | Notes |
|-------|------|-------|
| Restriction | Text | Required |
| Date confirmed | Date | Required |
| Notes | Textarea | Optional detail |

Allergies are shown as red alert banners on:
- The client detail page (preferences tab)
- Event creation Step 2 (inspiration section)
- Alteration job detail (work notes area)

---

## Inline Edit Pattern (Client Detail)

Every editable section uses inline editing — no navigation away.

### Contact info (inline)

Read-only view:
```
Contact                                    [Edit]
Phone      (956) 214-8830
Email      sophia.r@gmail.com
Language   English
Partner    Rafael Rodriguez
```

Edit state (replaces the KV rows):
```
[rosa-pale background form]
Phone  [___________]   Email  [___________]
Partner / honoree [___________]
[Cancel]  [Save]
```

### Other sections with inline edit:
- Source & referral (how found + referred by)
- Loyalty points (owner only — manual adjustment with reason)
- Tags (chip multi-select inline)
- Client notes (tab — always has add input at bottom)
- Communication preferences (chip toggles, auto-save on each tap)
- Style preferences (chip toggles, auto-save on each tap)
- Color preferences (swatch picker, auto-save)

---

## Server Actions

### Create client

```typescript
export async function createClient(data: CreateClientData) {
  const { orgId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)

  // Check for duplicate phone
  const existing = await db.query.clients.findFirst({
    where: and(eq(clients.boutiqueId, boutique.id), eq(clients.phone, data.phone))
  })
  if (existing) throw new Error(`DUPLICATE_PHONE:${existing.id}:${existing.firstName} ${existing.lastName}`)

  const [client] = await db.insert(clients).values({
    boutiqueId: boutique.id,
    firstName: data.firstName,
    lastName: data.lastName,
    partnerName: data.partnerName,
    email: data.email,
    phone: data.phone,
    preferredLanguage: data.preferredLanguage || 'en',
    howFound: data.howFound,
    loyaltyTier: 'new',
    loyaltyPoints: 0,
  }).returning()

  // Award new client points
  await awardLoyaltyPoints(client.id, 'event_created')

  revalidatePath('/clients')
  return client
}
```

### Update client contact

```typescript
export async function updateClientContact(clientId: string, data: UpdateContactData) {
  const boutique = await getBoutiqueByOrgId(auth().orgId)

  // Check for phone duplicate (excluding self)
  if (data.phone) {
    const existing = await db.query.clients.findFirst({
      where: and(
        eq(clients.boutiqueId, boutique.id),
        eq(clients.phone, data.phone),
        ne(clients.id, clientId)
      )
    })
    if (existing) throw new Error(`Phone already belongs to ${existing.firstName} ${existing.lastName}`)
  }

  await db.update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.boutiqueId, boutique.id)))

  await db.insert(clientActivityLog).values({
    clientId,
    boutiqueId: boutique.id,
    action: 'contact_updated',
    changedByName: getStaffName(),
  })

  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/clients')
}
```

### Add client note

```typescript
export async function addClientNote(clientId: string, text: string, category = 'general') {
  const { userId } = auth()
  const staff = await getStaffByClerkUserId(userId)

  await db.insert(clientNotes).values({
    clientId,
    boutiqueId: staff.boutiqueId,
    text,
    authorId: staff.id,
    authorName: staff.name,
    authorRole: staff.role,
    category,
  })

  // Update lastActivityAt
  await db.update(clients)
    .set({ lastActivityAt: new Date() })
    .where(eq(clients.id, clientId))

  revalidatePath(`/clients/${clientId}`)
}
```

### Update preferences (auto-save on toggle)

```typescript
export async function updateClientPreferences(
  clientId: string,
  type: 'communication' | 'style',
  preferences: string[]
) {
  const field = type === 'communication' ? 'communicationPreferences' : 'stylePreferences'
  await db.update(clients)
    .set({ [field]: preferences, updatedAt: new Date() })
    .where(eq(clients.id, clientId))
  // No revalidation needed — optimistic UI update handles it
}
```

### Recalculate lifetime value (called after any payment)

```typescript
export async function recalculateClientLifetimeValue(clientId: string) {
  const events = await db.query.events.findMany({
    where: eq(events.clientId, clientId),
    with: {
      milestones: {
        where: eq(paymentMilestones.status, 'paid')
      }
    }
  })

  const totalSpentCents = events
    .flatMap(e => e.milestones)
    .reduce((s, m) => s + m.amountCents, 0)

  await db.update(clients)
    .set({
      totalSpentCents,
      totalEvents: events.length,
      lastActivityAt: new Date(),
    })
    .where(eq(clients.id, clientId))

  await recalculateClientTier(clientId)
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/clients')
}
```

---

## Data Fetching

```typescript
// app/clients/page.tsx
export default async function ClientsPage() {
  const boutique = await getBoutiqueByOrgId(auth().orgId)
  const clients = await db.query.clients.findMany({
    where: and(eq(clients.boutiqueId, boutique.id), eq(clients.isActive, true)),
    orderBy: [desc(clients.totalSpentCents)],
  })
  return <ClientsListPage clients={clients} />
}

// app/clients/[clientId]/page.tsx
export default async function ClientDetailPage({ params }) {
  const boutique = await getBoutiqueByOrgId(auth().orgId)
  const [client, events, rentals, notes, activityLog] = await Promise.all([
    getClientById(params.clientId, boutique.id),
    getEventsByClient(params.clientId),
    getDressRentalsByClient(params.clientId),
    getClientNotes(params.clientId),
    getClientActivityLog(params.clientId, { limit: 20 }),
  ])
  if (!client) notFound()
  return <ClientDetailPage client={client} events={events} rentals={rentals} notes={notes} />
}
```

---

## Automations — Client Module

### Win-back campaign

Triggered when a client has been inactive for 60+ days and has no upcoming events.

```typescript
export const winBackJob = inngest.createFunction(
  { id: 'client-win-back', retries: 2 },
  { cron: '0 10 * * 1' }, // Every Monday at 10am
  async ({ step }) => {
    const boutiques = await step.run('get-boutiques', () => getAllActiveBoutiques())
    for (const boutique of boutiques) {
      const settings = await getAutomationSettings(boutique.id)
      if (!settings.winBack) continue

      const cutoff = subDays(new Date(), 60)
      const inactiveClients = await db.query.clients.findMany({
        where: and(
          eq(clients.boutiqueId, boutique.id),
          lt(clients.lastActivityAt, cutoff),
          eq(clients.isActive, true),
        )
      })

      for (const client of inactiveClients) {
        // Only send once every 90 days
        const recentLog = await db.query.clientActivityLog.findFirst({
          where: and(
            eq(clientActivityLog.clientId, client.id),
            eq(clientActivityLog.action, 'win_back_sent'),
            gte(clientActivityLog.createdAt, subDays(new Date(), 90))
          )
        })
        if (recentLog) continue

        await step.run(`win-back-${client.id}`, () =>
          sendSms(
            client.phone,
            buildWinBackSms(client, boutique),
            boutique.id,
            'win_back',
            client.id
          )
        )

        await db.insert(clientActivityLog).values({
          clientId: client.id,
          boutiqueId: boutique.id,
          action: 'win_back_sent',
        })
      }
    }
  }
)
```

### Tier upgrade notification

```typescript
export const tierUpgradeNotification = inngest.createFunction(
  { id: 'tier-upgrade-notify' },
  { event: 'client.tier_upgraded' },
  async ({ event: { data } }) => {
    const { clientId, newTier, boutiqueId } = data
    const client = await getClientById(clientId, boutiqueId)
    const boutique = await getBoutiqueById(boutiqueId)

    const tierLabels = { vip: 'VIP', diamond: 'Diamond' }
    const perksMap = {
      vip: '10% off your next alteration and free measurements consultation',
      diamond: '15% off all services and a dedicated coordinator',
    }

    // Notify client
    await sendSms(
      client.phone,
      `Hi ${client.firstName}! Great news — you've been upgraded to ${tierLabels[newTier]} status at ${boutique.name}! 🎉 You now enjoy ${perksMap[newTier]}. We appreciate your loyalty. — ${boutique.name}`,
      boutiqueId,
      'tier_upgrade',
      clientId
    )

    // Notify boutique owner
    await sendSms(
      boutique.ownerPhone,
      `${client.firstName} ${client.lastName} just reached ${tierLabels[newTier]} tier! They've spent $${formatCents(client.totalSpentCents)} with Bella Bridal.`,
      boutiqueId,
      'tier_upgrade_internal',
      clientId
    )
  }
)
```

---

## Cross-Module Connections

### Events → Client

When event is created:
```typescript
// 1. Link event.clientId
// 2. Award loyalty points: event_created (+100 pts)
// 3. Update client.totalEvents + 1
// 4. Update client.lastActivityAt = now
// 5. Recalculate lifetime value and tier
```

### Payments → Client

When milestone is marked paid:
```typescript
// 1. Award loyalty points: payment_received (1pt per $1)
// 2. Update client.totalSpentCents
// 3. Recalculate tier
// 4. Add to client payment history (via event.milestones)
```

### Dress return → Client

When dress returned in good condition:
```typescript
// 1. Award loyalty points: dress_rental_completed (+50 pts)
// 2. Log to client activity log
```

### Referral conversion → Client

When a referred lead converts to a booked event:
```typescript
// 1. Fetch the referring client (referredById on the new client)
// 2. Award to referring client: referral_converted (+200 pts)
// 3. Log to referring client activity log: "Referred [new client name] — event booked"
```

---

## Role-Based Visibility

| Section | Owner | Coordinator | Front desk | Seamstress |
|---------|-------|-------------|------------|------------|
| Client list — view all | ✓ | ✓ | ✓ | ✗ |
| Client detail — view | ✓ | ✓ | ✓ | Basic only |
| Contact info — edit | ✓ | ✓ | ✓ | ✗ |
| Lifetime value — view | ✓ | ✓ | ✗ | ✗ |
| Payment history — view | ✓ | ✓ | ✗ | ✗ |
| Notes — view | ✓ | ✓ | ✓ | ✓ |
| Notes — add | ✓ | ✓ | ✓ | ✓ |
| Preferences — edit | ✓ | ✓ | ✓ | ✗ |
| Loyalty points — manual adjust | ✓ | ✗ | ✗ | ✗ |
| Allergy notes — add | ✓ | ✓ | ✓ | ✓ |
| Delete / archive client | ✓ | ✗ | ✗ | ✗ |

"Basic only" for seamstress = name and event date only. No contact info, no financials.

---

## Query Functions

```typescript
// lib/db/queries/clients.ts

export async function getClients(boutiqueId: string, filters?: ClientFilters) {
  return db.query.clients.findMany({
    where: and(
      eq(clients.boutiqueId, boutiqueId),
      eq(clients.isActive, true),
      filters?.tier ? eq(clients.loyaltyTier, filters.tier) : undefined,
      filters?.hasOverdue ? /* subquery for overdue milestones */ undefined : undefined,
      filters?.search ? or(
        ilike(clients.firstName, `%${filters.search}%`),
        ilike(clients.lastName, `%${filters.search}%`),
        eq(clients.phone, filters.search),
      ) : undefined,
    ),
    orderBy: [desc(clients.totalSpentCents)],
  })
}

export async function getClientById(clientId: string, boutiqueId: string) {
  return db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.boutiqueId, boutiqueId)),
    with: { referredBy: true },
  })
}

export async function getEventsByClient(clientId: string) {
  return db.query.events.findMany({
    where: eq(events.clientId, clientId),
    with: { milestones: true, coordinator: true },
    orderBy: [desc(events.eventDate)],
  })
}

export async function getDressRentalsByClient(clientId: string) {
  return db.query.dressRentals.findMany({
    where: sql`event_id IN (SELECT id FROM events WHERE client_id = ${clientId})`,
    with: { dress: true, event: true },
    orderBy: [desc(dressRentals.reservedAt)],
  })
}

export async function getClientNotes(clientId: string) {
  return db.query.clientNotes.findMany({
    where: eq(clientNotes.clientId, clientId),
    orderBy: [desc(clientNotes.createdAt)],
  })
}

export async function getClientStats(boutiqueId: string) {
  const all = await getClients(boutiqueId)
  return {
    total: all.length,
    vip: all.filter(c => ['vip','diamond'].includes(c.loyaltyTier)).length,
    returning: all.filter(c => c.totalEvents > 1).length,
    lifetimeRevenue: all.reduce((s, c) => s + c.totalSpentCents, 0),
    inactive: all.filter(c =>
      c.lastActivityAt && differenceInDays(new Date(), new Date(c.lastActivityAt)) > 60
    ).length,
  }
}
```

---

## TypeScript Types

```typescript
export type LoyaltyTier = 'new' | 'regular' | 'loyal' | 'vip' | 'diamond'
export type HowFound =
  | 'google' | 'instagram' | 'facebook' | 'tiktok'
  | 'referral' | 'walk_in' | 'expo' | 'returning' | 'other'
export type CommunicationPref = 'sms' | 'email' | 'whatsapp' | 'appointment_reminders'
export type NoteCategory = 'general' | 'measurement' | 'preference' | 'follow_up'

export interface Client {
  id: string
  boutiqueId: string
  firstName: string
  lastName: string
  fullName: string // computed: firstName + ' ' + lastName
  partnerName?: string
  email?: string
  phone: string
  preferredLanguage: 'en' | 'es' | 'both'
  howFound?: HowFound
  referredById?: string
  loyaltyPoints: number
  loyaltyTier: LoyaltyTier
  loyaltyTierUpdatedAt?: Date
  stylePreferences: string[]
  communicationPreferences: CommunicationPref[]
  colorPreferences: string[]
  allergyNotes: { note: string; confirmedAt: string }[]
  totalSpentCents: number
  totalEvents: number
  lastActivityAt?: Date
  isActive: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
  // Joined
  referredBy?: Client
}

export interface ClientNote {
  id: string
  clientId: string
  boutiqueId: string
  text: string
  authorId?: string
  authorName: string
  authorRole: string
  category: NoteCategory
  createdAt: Date
}

export interface ClientFilters {
  tier?: LoyaltyTier
  hasOverdue?: boolean
  inactive?: boolean
  search?: string
}
```

---

## Component Structure

```
app/clients/
├── page.tsx                        # Server component — fetches all clients
└── [clientId]/
    └── page.tsx                    # Server component — fetches client detail

components/clients/
├── ClientsListPage.tsx             # Full list page with stat strip + filter
├── ClientStatStrip.tsx             # 4-cell stat bar
├── ClientFilterBar.tsx             # Search + filter pills
├── ClientCard.tsx                  # Single client row (list) / card (grid)
├── NewClientModal.tsx              # Create new client form
├── detail/
│   ├── ClientDetailPage.tsx        # Left sidebar + right tabs
│   ├── ClientSidebar.tsx           # Avatar, tier, loyalty, contact, stats
│   ├── LoyaltyMeter.tsx            # Progress bar + perks list
│   ├── ContactSection.tsx          # Inline editable contact info
│   ├── LifetimeStatsSection.tsx    # Read-only stats
│   └── ReferralSection.tsx         # Source + referral links
├── tabs/
│   ├── EventHistoryTab.tsx         # All events grouped by year
│   ├── DressRentalsTab.tsx         # Current + rental history
│   ├── PaymentsTab.tsx             # All payments across all events
│   ├── ClientNotesTab.tsx          # Notes feed + add input
│   └── PreferencesTab.tsx          # Communication, style, colors, allergies
└── shared/
    ├── TierBadge.tsx               # Tier badge component
    ├── LoyaltyPointsPill.tsx       # Points display pill
    └── AllergyBanner.tsx           # Red allergy alert banner
```

---

## Validation Rules

| Action | Rule | Error |
|--------|------|-------|
| Create client | Phone must be unique within boutique | "A client with this phone number already exists: [Name]" |
| Create client | First name required | "First name is required" |
| Create client | Last name required | "Last name is required" |
| Create client | Phone required | "Phone number is required" |
| Update phone | Must be unique (excluding self) | "This phone belongs to another client" |
| Update email | Valid email format | "Please enter a valid email" |
| Add allergy | Note required | "Please describe the restriction" |
| Add allergy | Date required | "Please enter the date this was confirmed" |
| Add note | Minimum 3 characters | "Note must be at least 3 characters" |
| Manual loyalty adjust | Owner only + reason required | "Please explain the reason for this adjustment" |
| Delete client | Owner only | "Only owners can archive clients" |
| Delete client | Cannot delete if active event exists | "This client has an active event. Complete or cancel the event first." |

---

## Revalidation Map

```typescript
// After client created:
revalidatePath('/clients')

// After client updated:
revalidatePath('/clients')
revalidatePath(`/clients/${clientId}`)

// After payment marked paid (updates LTV):
revalidatePath(`/clients/${clientId}`)
revalidatePath('/clients')

// After note added:
revalidatePath(`/clients/${clientId}`)

// After tier changes:
revalidatePath(`/clients/${clientId}`)
revalidatePath('/clients') // tier badge updates in list
```
