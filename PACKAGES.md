# PACKAGES.md — Belori Wedding Packages Spec

> **Purpose:** This file defines everything about how service packages work in Belori — creating, editing, applying, and pricing packages. A package is a named bundle of services with a preset price that can be applied to any event during creation or afterward. Paste alongside PRD.md and TECH_STACK.md when building the packages feature.

---

## Overview

Packages let boutique owners pre-define common service combinations with pricing, so staff don't have to manually select services and enter a total value every time. Instead of building each event from scratch, staff can say "this is a Full Service Wedding — $6,800" and the system pre-fills everything.

Packages are boutique-specific — each boutique creates their own. There are no global Belori default packages (though onboarding suggests starting templates).

---

## What a Package Contains

```typescript
interface Package {
  id: string
  boutiqueId: string
  name: string                    // "Full Service Wedding"
  description: string             // "Complete wedding management — gown, alterations, planning & decoration"
  eventType: 'wedding' | 'quince' | 'both'
  services: ServiceType[]         // which services are included
  basePrice: number               // cents — the advertised/default price
  isActive: boolean               // soft delete / archive
  displayOrder: number            // controls sort order in dropdowns
  // Optional inclusions detail
  inclusions: PackageInclusion[]  // line-item breakdown shown to client
  // Discount logic
  discountType?: 'none' | 'percentage' | 'flat'
  discountValue?: number          // % or cents off if services booked separately
  // Milestone template
  milestoneTemplate: MilestoneTemplate[]
  createdAt: Date
  updatedAt: Date
}

interface PackageInclusion {
  label: string      // "Bridal gown rental (up to $450 value)"
  included: boolean  // true = included, false = add-on/excluded note
}

interface MilestoneTemplate {
  label: string
  percentage: number    // e.g. 25 = 25% of total
  dueDaysFromToday: number    // for first milestone
  dueDaysBeforeEvent: number  // for subsequent milestones (negative = before)
}
```

---

## Database Schema

```typescript
export const packages = pgTable('packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  eventType: text('event_type').default('both').notNull(), // 'wedding' | 'quince' | 'both'
  services: text('services').array().notNull(),
  basePriceCents: integer('base_price_cents').notNull(),
  discountType: text('discount_type').default('none'),
  discountValueCents: integer('discount_value_cents').default(0),
  discountPercentage: integer('discount_percentage').default(0),
  inclusions: jsonb('inclusions').default([]),
  milestoneTemplate: jsonb('milestone_template').notNull(),
  isActive: boolean('is_active').default(true),
  displayOrder: integer('display_order').default(0),
  usageCount: integer('usage_count').default(0), // how many events use this package
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const eventPackages = pgTable('event_packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').references(() => events.id).notNull(),
  packageId: uuid('package_id').references(() => packages.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  // Snapshot at time of application (package may change later)
  packageNameSnapshot: text('package_name_snapshot').notNull(),
  packagePriceSnapshot: integer('package_price_snapshot').notNull(),
  servicesSnapshot: text('services_snapshot').array().notNull(),
  // Actual agreed price (may differ from package base price)
  agreedPriceCents: integer('agreed_price_cents').notNull(),
  appliedAt: timestamp('applied_at').defaultNow(),
  appliedByName: text('applied_by_name').notNull(),
});
```

---

## Packages Management Screen

### Route
`/settings/packages` — accessible from Settings page, "Packages" section

### Layout
- Topbar: "Packages" title · subtitle: "N packages · used in M events"
- "+ Create package" primary button (top right)
- Filter tabs: `[ All ] [ Weddings ] [ Quinceañeras ] [ Archived ]`
- Package cards list (vertical, not grid — more detail needed than inventory)

### Package Card (in list)

```
┌─────────────────────────────────────────────────────────────┐
│  Full Service Wedding                          $6,800        │
│  Complete management — gown, alterations, planning & deco   │
│                                                             │
│  [Dress rental] [Alterations] [Planning] [Decoration]       │
│                                                             │
│  Used in 8 events · Wedding & Quinceañera · Active         │
│                                          [Edit]  [Archive]  │
└─────────────────────────────────────────────────────────────┘
```

- Service chips (color-coded, same as rest of app)
- Usage count ("Used in N events") — links to filtered events list
- Edit button → opens edit modal
- Archive button → confirms then sets `isActive = false`
- Archived packages show in "Archived" tab with "Restore" button

---

## Create / Edit Package Modal

Single-step modal. Edit pre-populates all fields.

### Section 1 — Basic Info

```
Package name:       [text field]
                    e.g. "Full Service Wedding"

Description:        [text area — 1-2 sentences]
                    e.g. "Everything included — gown, alterations, full planning & decoration"

Apply to:           [ Wedding ]  [ Quinceañera ]  [ Both ]

Display order:      [number]  ← lower = appears first in dropdowns
                    (drag-to-reorder in the packages list view)
```

### Section 2 — Services Included

Same 2×2 service card grid as event creation. Tap to toggle.

```
[ ✓ Dress rental ]   [ ✓ Alterations ]
[ ✓ Event planning ] [ ✓ Decoration  ]
```

### Section 3 — Pricing

```
Base price:         [$_____]
                    This is the advertised package price shown to clients
                    and pre-filled when applying to an event.

Savings vs separate:
  If booked separately, services would total approximately:
  Dress rental:   $____
  Alterations:    $____
  Planning:       $____
  Decoration:     $____
  Separate total: $____
  Package saves:  $____ (__%)   ← auto-calculated, shown as helper

Discount display:
  ◉ Don't show savings (just show package price)
  ○ Show "Save $X" badge
  ○ Show "X% off" badge
```

### Section 4 — What's Included (client-facing line items)

A dynamic list of inclusion/exclusion notes. Staff add these to be transparent about what the package covers and doesn't cover.

```
Inclusions:
  [+] Add inclusion line

  ✓  Bridal gown rental (up to $450 value)         [×]
  ✓  Alterations — hem, bustle, waist take-in       [×]
  ✓  Full event coordination & run-of-show          [×]
  ✓  Decoration setup & florals (up to 20 tables)   [×]
  ✗  Photographer not included                      [×]
  ✗  Catering not included                          [×]
```

Each line:
- Toggle ✓/✗ (included or excluded/noted)
- Label text field
- Delete (×) button

### Section 5 — Payment Milestone Template

Defines the default milestone structure when this package is applied to an event. Percentages must add to 100%.

```
Milestone structure:

  1.  Booking deposit     25%   Due: 3 days after signing    [×]
  2.  Mid-point payment   50%   Due: 60 days before event    [×]
  3.  Final balance       25%   Due: 14 days before event    [×]

  [+ Add milestone]

  Total: 100% ✓

  Note: Milestone amounts are calculated from the agreed
  price at time of event creation, not this base price.
```

Each milestone row:
- Label (text)
- Percentage (number, 1–100)
- Due rule: select from:
  - "X days after signing" (for first deposit)
  - "X days before event"
  - "On event date"
- Delete button

Validation: percentages must sum to exactly 100% before saving.

### Action buttons
- "Cancel" ghost button
- "Save package" primary button (rosa)

---

## Server Actions

### Create package
```typescript
export async function createPackage(data: CreatePackageData) {
  const { orgId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)

  // Validate percentages sum to 100
  const totalPct = data.milestoneTemplate.reduce((s, m) => s + m.percentage, 0)
  if (totalPct !== 100) throw new Error('Milestone percentages must sum to 100%')

  // Get next display order
  const existing = await db.query.packages.findMany({
    where: eq(packages.boutiqueId, boutique.id),
    orderBy: [desc(packages.displayOrder)],
    limit: 1,
  })
  const nextOrder = (existing[0]?.displayOrder ?? 0) + 1

  const [pkg] = await db.insert(packages).values({
    boutiqueId: boutique.id,
    name: data.name,
    description: data.description,
    eventType: data.eventType,
    services: data.services,
    basePriceCents: data.basePriceCents,
    discountType: data.discountType,
    discountValueCents: data.discountValueCents,
    discountPercentage: data.discountPercentage,
    inclusions: data.inclusions,
    milestoneTemplate: data.milestoneTemplate,
    displayOrder: nextOrder,
    isActive: true,
  }).returning()

  revalidatePath('/settings/packages')
  return pkg
}
```

### Update package
```typescript
export async function updatePackage(packageId: string, data: UpdatePackageData) {
  const { orgId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)

  // Verify ownership
  const pkg = await db.query.packages.findFirst({
    where: and(eq(packages.id, packageId), eq(packages.boutiqueId, boutique.id))
  })
  if (!pkg) throw new Error('Package not found')

  const totalPct = data.milestoneTemplate.reduce((s, m) => s + m.percentage, 0)
  if (totalPct !== 100) throw new Error('Milestone percentages must sum to 100%')

  await db.update(packages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(packages.id, packageId))

  revalidatePath('/settings/packages')
}
```

### Archive / restore package
```typescript
export async function setPackageActive(packageId: string, isActive: boolean) {
  const { orgId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)

  await db.update(packages)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(packages.id, packageId), eq(packages.boutiqueId, boutique.id)))

  revalidatePath('/settings/packages')
}
```

### Apply package to event
```typescript
export async function applyPackageToEvent(
  packageId: string,
  eventId: string,
  agreedPriceCents: number
) {
  const { orgId, userId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)
  const staff = await getStaffByClerkUserId(userId, boutique.id)

  const [pkg, event] = await Promise.all([
    db.query.packages.findFirst({ where: eq(packages.id, packageId) }),
    db.query.events.findFirst({ where: eq(events.id, eventId) }),
  ])
  if (!pkg || !event) throw new Error('Package or event not found')

  await db.transaction(async (tx) => {
    // 1. Record the package application (snapshot)
    await tx.insert(eventPackages).values({
      eventId,
      packageId,
      boutiqueId: boutique.id,
      packageNameSnapshot: pkg.name,
      packagePriceSnapshot: pkg.basePriceCents,
      servicesSnapshot: pkg.services,
      agreedPriceCents,
      appliedByName: staff.name,
    })

    // 2. Update event services and total value
    await tx.update(events).set({
      services: pkg.services,
      totalValue: agreedPriceCents,
    }).where(eq(events.id, eventId))

    // 3. Delete existing pending milestones (if any)
    await tx.delete(paymentMilestones).where(
      and(
        eq(paymentMilestones.eventId, eventId),
        eq(paymentMilestones.status, 'pending')
      )
    )

    // 4. Generate new milestones from template
    const eventDate = new Date(event.eventDate)
    const today = new Date()
    for (const template of pkg.milestoneTemplate) {
      const amountCents = Math.round(agreedPriceCents * (template.percentage / 100))
      let dueDate: Date
      if (template.dueDaysFromToday) {
        dueDate = addDays(today, template.dueDaysFromToday)
      } else {
        dueDate = addDays(eventDate, template.dueDaysBeforeEvent) // negative = before
      }
      await tx.insert(paymentMilestones).values({
        eventId,
        boutiqueId: boutique.id,
        label: template.label,
        amountCents,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        status: 'pending',
      })
    }

    // 5. Increment usage count
    await tx.update(packages)
      .set({ usageCount: sql`${packages.usageCount} + 1` })
      .where(eq(packages.id, packageId))
  })

  revalidatePath(`/events/${eventId}`)
}
```

---

## Applying a Package to an Event

### During event creation (Step 2 — Services)

The "Apply a package" section in Step 2 of event creation shows active packages filtered by event type:

```
Apply a package (optional):

  ◉ Full Service Wedding              $6,800
    Gown · Alterations · Planning · Decoration

  ○ Dress + Alterations Only          $2,800
    Gown rental + full alteration service

  ○ Planning + Decoration             $3,200
    Event coordination and venue styling

  ○ Build custom (select services above)

  Agreed price:  [$_____]  ← pre-filled with package base price, editable
                              "Client negotiated a different amount? Change it here."
```

Selecting a package:
- Auto-selects the matching service checkboxes
- Pre-fills the "Total contract value" field with the base price
- Pre-fills milestone structure from the package template
- Shows the inclusions list below the selection

Staff can still edit the agreed price — the package is a starting point, not a hard contract.

### From an existing event (event detail page)

On the event detail page, if no package has been applied:
- A subtle card shows: "No package applied — apply a package to auto-fill services and milestones"
- "Apply package →" link opens a simplified modal

If a package has already been applied, show a read-only badge:
```
Package: Full Service Wedding  ·  Applied Mar 10 by Maria G.
[Change package]
```

Changing the package shows a warning: "This will replace the existing milestone structure. Any milestones already paid will not be affected."

---

## Onboarding — Starter Templates

When a new boutique signs up and has no packages, the packages screen shows starter templates they can import with one tap:

```
Get started with these common packages:

┌──────────────────────────────────────┐
│ Full Service Wedding          $6,800  │
│ Add all 4 services            [Add]   │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ Dress + Alterations           $2,500  │
│ Gown rental + seamstress work [Add]   │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ Planning + Decoration         $3,000  │
│ Coordination & venue styling  [Add]   │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ Full Quinceañera Service      $5,400  │
│ All 4 services, quince focus  [Add]   │
└──────────────────────────────────────┘

Or create your own from scratch →
```

"Add" copies the template into the boutique's packages with their boutique ID (not a shared record — each boutique owns their own copy).

---

## Validation Rules

| Field | Rule | Error |
|-------|------|-------|
| Name | Required, max 60 chars | "Package name is required" |
| Services | At least 1 selected | "Select at least one service" |
| Base price | Required, >0 | "Please enter a package price" |
| Milestones | Must sum to exactly 100% | "Milestone percentages must add up to 100%" |
| Milestones | At least 1 milestone | "Add at least one payment milestone" |
| Apply to event | Agreed price > 0 | "Please enter the agreed price" |

---

## Component Structure

```
components/packages/
├── PackagesPage.tsx              # Settings sub-page
├── PackageCard.tsx               # Card in list view
├── PackageModal.tsx              # Create / edit modal
├── sections/
│   ├── PackageBasicInfo.tsx      # Name, description, event type
│   ├── PackageServices.tsx       # 2x2 service selector
│   ├── PackagePricing.tsx        # Price + discount display
│   ├── PackageInclusions.tsx     # Dynamic inclusion list
│   └── MilestoneTemplateEditor.tsx # Percentage milestone builder
├── ApplyPackageModal.tsx         # Apply package to event
├── PackageSelectInline.tsx       # Inline selector in event creation
└── StarterTemplates.tsx          # Onboarding templates grid
```

---

## TypeScript Types

```typescript
export type PackageEventType = 'wedding' | 'quince' | 'both'
export type DiscountType = 'none' | 'percentage' | 'flat'

export interface PackageInclusion {
  label: string
  included: boolean
}

export interface MilestoneTemplate {
  label: string
  percentage: number
  dueDaysFromToday?: number      // for booking deposit
  dueDaysBeforeEvent?: number    // negative number for days before event
}

export interface Package {
  id: string
  boutiqueId: string
  name: string
  description?: string
  eventType: PackageEventType
  services: ServiceType[]
  basePriceCents: number
  discountType: DiscountType
  discountValueCents: number
  discountPercentage: number
  inclusions: PackageInclusion[]
  milestoneTemplate: MilestoneTemplate[]
  isActive: boolean
  displayOrder: number
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

export interface CreatePackageData {
  name: string
  description?: string
  eventType: PackageEventType
  services: ServiceType[]
  basePriceCents: number
  discountType: DiscountType
  discountValueCents: number
  discountPercentage: number
  inclusions: PackageInclusion[]
  milestoneTemplate: MilestoneTemplate[]
}
```
