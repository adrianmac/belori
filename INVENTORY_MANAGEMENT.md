# INVENTORY_MANAGEMENT.md — Belori Full Inventory Management Spec

> **Purpose:** This file defines the complete inventory management system for Belori — covering all item types (dresses, decoration pieces, accessories, planning supplies), category structure, item lifecycle, condition tracking, assignment to events, restocking alerts, and the full UI. This expands beyond dress-only rental to track everything a boutique owns. Paste alongside PRD.md, TECH_STACK.md, and DRESS_RENTAL.md when building inventory.

---

## Overview

A bridal boutique owns far more than gowns. They own centerpiece sets, arches, chair covers, candelabras, lighting rigs, table linens, bridal accessories, and planning tools. These items are rented out per event, shared across events, or consumed (like candles and floral supplies). Without a tracking system, items go missing, get double-booked, or are discovered damaged only when a client arrives.

Belori's inventory system tracks **every physical item the boutique owns**, organized into categories, with status tracking, event assignment, condition logs, quantity management, and restock alerts.

---

## Item Categories

### Top-level categories

| Category ID | Name | Subcategories | Type |
|-------------|------|---------------|------|
| `gowns` | Gowns | Bridal gowns, Quinceañera gowns | Rental |
| `decoration` | Decoration | Centerpieces, Arches, Linens, Lighting, Florals, Chairs, Tables | Rental |
| `accessories` | Accessories | Veils, Tiaras, Jewelry, Shoes, Gloves | Rental |
| `planning` | Planning supplies | Signage, Ceremony items, Reception items | Rental |
| `consumables` | Consumables | Candles, Ribbon, Floral wire, Pins | Consumed |
| `equipment` | Equipment | Sound system, Projector, Fog machine | Rental |
| `cleaning` | Cleaning supplies | Steamer, Lint roller, Spot cleaner | Internal |

### Category hierarchy (full)

```
GOWNS
├── Bridal gowns
│   ├── A-line
│   ├── Ball gown
│   ├── Mermaid / Trumpet
│   ├── Sheath
│   └── Tea-length
└── Quinceañera gowns
    ├── Ball gown
    ├── A-line
    └── Princess

DECORATION
├── Centerpieces
│   ├── Tall centerpiece
│   ├── Low centerpiece
│   ├── Candelabra
│   └── Lantern
├── Arches & Backdrops
│   ├── Floral arch
│   ├── Metal arch
│   ├── Balloon arch frame
│   └── Backdrop stand
├── Linens
│   ├── Tablecloth (round)
│   ├── Tablecloth (rectangular)
│   ├── Table runner
│   ├── Chair cover
│   ├── Chair sash
│   └── Napkin set
├── Lighting
│   ├── String lights (set)
│   ├── Uplighting (unit)
│   ├── Candle votives (set)
│   ├── LED column
│   └── Fairy light curtain
├── Floral supplies
│   ├── Silk flower arrangement
│   ├── Foam flowers (box)
│   └── Greenery garland
├── Chairs & Seating
│   ├── Chiavari chair (gold)
│   ├── Chiavari chair (silver)
│   ├── Ghost chair
│   └── Cross-back chair
├── Tables
│   ├── Cocktail table
│   ├── Farm table (6ft)
│   ├── Sweetheart table
│   └── Display table
└── Signage
    ├── Seating chart frame
    ├── Easel
    ├── Welcome sign frame
    └── Table number holders (set)

ACCESSORIES
├── Veils
│   ├── Cathedral veil
│   ├── Fingertip veil
│   ├── Blusher veil
│   └── Birdcage veil
├── Headpieces
│   ├── Tiara
│   ├── Crown (quinceañera)
│   ├── Floral headband
│   └── Hair comb
├── Jewelry sets
│   ├── Pearl set (necklace + earrings)
│   ├── Crystal set
│   └── Gold set
├── Gloves
│   ├── Elbow-length gloves
│   └── Wrist-length gloves
└── Other accessories
    ├── Bridal garter
    ├── Bridal purse
    └── Ring bearer pillow

PLANNING SUPPLIES
├── Ceremony items
│   ├── Unity candle set
│   ├── Lazo (wedding lasso)
│   ├── Arras (unity coins)
│   ├── Flower girl basket
│   └── Ring bearer box
├── Reception items
│   ├── Cake knife set
│   ├── Toasting flutes
│   ├── Guest book
│   └── Card box
└── Décor props
    ├── Photo booth frame
    ├── Polaroid frame set
    └── Lantern (paper)

CONSUMABLES
├── Candles (box)
├── Ribbon (roll)
├── Floral wire (spool)
├── Straight pins (box)
├── Double-sided tape (roll)
├── Zip ties (bag)
└── Tissue paper (pack)

EQUIPMENT
├── Wireless microphone
├── Bluetooth speaker
├── Projector + screen
├── Fog machine
├── Bubble machine
└── Extension cord (heavy duty)
```

---

## Database Schema

### `inventory_categories` table
```typescript
export const inventoryCategories = pgTable('inventory_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  name: text('name').notNull(),                    // "Bridal gowns"
  slug: text('slug').notNull(),                    // "bridal-gowns"
  parentId: uuid('parent_id'),                     // null = top-level
  icon: text('icon'),                              // emoji or icon key
  color: text('color'),                            // hex color for UI
  itemType: text('item_type').notNull(),           // 'rental' | 'consumable' | 'internal'
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})
```

### `inventory_items` table (master record for every item)
```typescript
export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  categoryId: uuid('category_id').references(() => inventoryCategories.id).notNull(),

  // Identity
  sku: text('sku').notNull(),                      // "BB-047", "ARCH-001", "LIN-TBL-01"
  name: text('name').notNull(),                    // "Ivory A-line cathedral"
  description: text('description'),
  brand: text('brand'),                            // manufacturer/brand
  color: text('color'),
  size: text('size'),                              // for gowns and linens
  material: text('material'),                      // fabric, metal, wood, etc.
  dimensions: text('dimensions'),                  // "6ft x 30in" for tables

  // Type & behavior
  itemType: text('item_type').notNull(),           // 'rental' | 'consumable' | 'internal'
  trackingMode: text('tracking_mode').notNull(),
  // 'individual'  — tracked as single unit (dress, arch, candelabra)
  // 'quantity'    — tracked as count (chair covers: 50 units)
  // 'set'         — tracked as a set (centerpiece includes vase + flowers)

  // Quantity (for quantity-tracked items)
  totalQuantity: integer('total_quantity').default(1),
  availableQuantity: integer('available_quantity').default(1),
  reservedQuantity: integer('reserved_quantity').default(0),
  damagedQuantity: integer('damaged_quantity').default(0),
  minimumStock: integer('minimum_stock').default(1),  // restock alert threshold

  // Status (for individually-tracked items)
  status: text('status').default('available'),
  // 'available' | 'reserved' | 'rented' | 'returned' | 'cleaning'
  // 'damaged' | 'in_repair' | 'retired'
  currentEventId: uuid('current_event_id').references(() => events.id),

  // Financial
  rentalPriceCents: integer('rental_price_cents'),  // null for internal items
  depositCents: integer('deposit_cents'),
  replacementCostCents: integer('replacement_cost_cents'), // for damage claims
  purchasePriceCents: integer('purchase_price_cents'),
  purchaseDate: date('purchase_date'),
  purchaseVendor: text('purchase_vendor'),

  // Condition
  condition: text('condition').default('excellent'),
  // 'new' | 'excellent' | 'good' | 'fair' | 'needs_repair' | 'retired'
  lastInspectedAt: date('last_inspected_at'),
  lastCleanedAt: date('last_cleaned_at'),

  // Rental dates
  returnDueDate: date('return_due_date'),

  // Media
  photoUrls: text('photo_urls').array().default([]),
  qrCodeUrl: text('qr_code_url'),

  // Consumable tracking
  consumableUnit: text('consumable_unit'),         // "box", "roll", "pack"
  currentStock: integer('current_stock'),          // for consumables
  restockPoint: integer('restock_point'),          // auto-alert below this
  restockQuantity: integer('restock_quantity'),    // how many to order

  // Meta
  notes: text('notes'),
  tags: text('tags').array().default([]),          // custom tags for filtering
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

### `inventory_event_assignments` table
```typescript
// Links inventory items to events (replaces dress_rentals for non-dress items)
export const inventoryAssignments = pgTable('inventory_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').references(() => inventoryItems.id).notNull(),
  eventId: uuid('event_id').references(() => events.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),

  // Quantity (for quantity-tracked items, e.g. 20 chair covers)
  quantityAssigned: integer('quantity_assigned').default(1),
  quantityReturned: integer('quantity_returned').default(0),
  quantityDamaged: integer('quantity_damaged').default(0),

  // Timeline
  reservedAt: timestamp('reserved_at'),
  deliveredAt: timestamp('delivered_at'),
  setupAt: timestamp('setup_at'),
  returnedAt: timestamp('returned_at'),
  returnDueDate: date('return_due_date'),

  // Financials
  rentalPriceCents: integer('rental_price_cents'),  // snapshot at assignment
  depositPaidCents: integer('deposit_paid_cents').default(0),
  depositPaidAt: timestamp('deposit_paid_at'),
  damageFeeCents: integer('damage_fee_cents').default(0),

  // Condition
  conditionOnReturn: text('condition_on_return'),
  returnNotes: text('return_notes'),
  returnPhotoUrls: text('return_photo_urls').array().default([]),

  // Agreements
  agreementSignedAt: timestamp('agreement_signed_at'),

  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

### `inventory_condition_log` table
```typescript
export const inventoryConditionLog = pgTable('inventory_condition_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').references(() => inventoryItems.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  fromCondition: text('from_condition'),
  toCondition: text('to_condition').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  changedByName: text('changed_by_name').notNull(),
  notes: text('notes'),
  photoUrls: text('photo_urls').array().default([]),
  createdAt: timestamp('created_at').defaultNow(),
})
```

### `inventory_restock_alerts` table
```typescript
export const inventoryRestockAlerts = pgTable('inventory_restock_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').references(() => inventoryItems.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  alertType: text('alert_type').notNull(),
  // 'low_stock' | 'out_of_stock' | 'restock_needed' | 'damage_threshold'
  currentStock: integer('current_stock'),
  minimumStock: integer('minimum_stock'),
  isResolved: boolean('is_resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedByName: text('resolved_by_name'),
  createdAt: timestamp('created_at').defaultNow(),
})
```

---

## Item Status System

### Individually-tracked items (gowns, arches, candelabras)

```
Available ──► Reserved ──► Rented/Out ──► Returned ──► Cleaning ──► Available
                │                                            │
                ▼                                            ▼
            Cancelled                                   In repair
                │                                            │
                ▼                                            ▼
            Available                                   Available / Retired
```

### Quantity-tracked items (chair covers, votives, linens)

For these, status isn't a single state — instead, quantities are tracked across states:

```typescript
interface QuantityBreakdown {
  total: number        // e.g. 200 chair covers owned
  available: number    // e.g. 140 in stock
  reserved: number     // e.g. 40 assigned to upcoming events
  out: number          // e.g. 15 currently at an event
  damaged: number      // e.g. 5 damaged
  // available + reserved + out + damaged = total
}
```

**When assigning to an event:** `available -= quantity`, `reserved += quantity`
**When marking delivered:** `reserved -= quantity`, `out += quantity`
**When marking returned:** `out -= quantity`, `available += quantity` (or `damaged += X`)
**When marking damaged:** `available -= X`, `damaged += X`

### Consumable items (candles, ribbon, pins)

Consumables aren't returned — they're used up. Tracking is simpler:

```typescript
interface ConsumableState {
  currentStock: number     // e.g. 12 boxes of candles
  restockPoint: number     // e.g. alert when below 3
  restockQuantity: number  // e.g. order 10 boxes at a time
  lastRestockedAt: Date
  lastUsedAt: Date
}
```

**When assigned to event:** `currentStock -= quantityUsed`
**When restocked:** `currentStock += quantityAdded`
**If `currentStock <= restockPoint`:** fire `inventory.restock_needed` alert

---

## Inventory Screen

### Route
`/inventory` — replaces the previous dress-only inventory screen

### Topbar
- Title: "Inventory"
- Subtitle: dynamic — e.g. "248 items · 12 categories · 3 items need attention"
- Action buttons: "Import items" · "Add item" (primary)

### Attention banner
Appears above filters when any alerts exist:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  3 items need attention:                                     │
│  · 2 chair covers damaged · Candles low stock (4 boxes left)    │
│  · Fog machine in repair (needed for Santos wedding Apr 26)     │
│                                             [View all alerts →] │
└─────────────────────────────────────────────────────────────────┘
```

### Filter & Search Bar

```
[🔍 Search items by name, SKU, or tag...]

[All categories ▾]  [All statuses ▾]  [All events ▾]  [More filters ▾]

Quick filters: [ Needs attention ] [ Overdue returns ] [ Low stock ] [ Available now ]
```

**Category dropdown** shows nested hierarchy:
```
All categories
──────────────
Gowns
  · Bridal gowns (24)
  · Quinceañera gowns (8)
Decoration
  · Centerpieces (12 sets)
  · Arches & backdrops (5)
  · Linens (180 units)
  · Lighting (28 units)
  · Chairs (85 units)
  · Tables (14)
  · Signage (8)
Accessories
  ...
```

### View toggles

```
[ Grid ]  [ List ]  [ By category ]  [ By event ]
```

- **Grid** — card grid, best for visual items (gowns, decoration)
- **List** — dense table, best for quantities (linens, chairs)
- **By category** — grouped sections with collapsible headers
- **By event** — shows items organized by which event they're assigned to

---

## Grid View

3 columns desktop, 2 tablet, 1 mobile. Each card:

```
┌───────────────────────────────────┐
│  [Photo or category icon]         │  ← 100px tall, ivory bg
│  #ARCH-001          [Available]   │  ← SKU + status badge
├───────────────────────────────────┤
│  Gold metal arch                  │  ← name, 13px 500
│  Decoration · Arches              │  ← category breadcrumb
│                                   │
│  $150/event    Replacement: $800  │  ← price + replacement cost
│  Last used: Mar 8, 2026           │  ← usage history
│                                   │
│  [ Reserve for event ]            │  ← contextual action
└───────────────────────────────────┘
```

For quantity-tracked items:

```
┌───────────────────────────────────┐
│  [Photo / icon]                   │
│  #CHAIR-GLD         [Available]   │
├───────────────────────────────────┤
│  Chiavari chair (gold)            │
│  Decoration · Chairs              │
│                                   │
│  85 total                         │
│  ████████████▓░░░  68 available   │  ← visual quantity bar
│  12 reserved   5 out   0 damaged  │
│                                   │
│  $8/chair/event                   │
│                                   │
│  [ Assign to event ]              │
└───────────────────────────────────┘
```

---

## List View

Compact table, sortable by any column.

### Gowns / individual items table

| # | SKU | Name | Category | Size/Color | Status | Assigned to | Return due | Price | Action |
|---|-----|------|----------|-----------|--------|-------------|-----------|-------|--------|
| ☐ | BB-047 | Ivory A-line | Bridal | 8 / Ivory | ● Reserved | Sophia R. · Mar 22 | Mar 24 | $450 | View |
| ☐ | ARCH-001 | Gold metal arch | Arch | — / Gold | ● Available | — | — | $150 | Reserve |
| ☐ | LIN-CC-GLD | Chair cover (gold) | Linens | — / Gold | ● Available | — | — | $4/ea | Assign |

### Quantity items table

| # | SKU | Name | Category | Total | Avail | Reserved | Out | Damaged | Price | Action |
|---|-----|------|----------|-------|-------|---------|-----|---------|-------|--------|
| ☐ | CHAIR-GLD | Chiavari chair (gold) | Chairs | 85 | 68 | 12 | 5 | 0 | $8/ea | Assign |
| ☐ | LIN-TBL-RND | Round tablecloth (white) | Linens | 50 | 32 | 12 | 6 | 0 | $15/ea | Assign |

### Consumables table

| # | SKU | Name | Category | In stock | Restock at | Unit | Last restocked | Action |
|---|-----|------|----------|---------|-----------|------|----------------|--------|
| ☐ | CON-CNDL | Candles (ivory taper) | Consumables | 4 boxes ⚠ | 5 boxes | box | Feb 28 | Restock |
| ☐ | CON-RBN-WHT | White ribbon | Consumables | 8 rolls | 3 rolls | roll | Mar 10 | View |

---

## By Category View

```
GOWNS (32 items)                                    [Collapse ▲]
────────────────────────────────────────────────────────────────
  Bridal gowns (24)
  [BB-047 card] [BB-031 card] [BB-012 card] [BB-022 card] ...

  Quinceañera gowns (8)
  [QG-008 card] [QG-014 card] ...

DECORATION (143 items / units)                      [Collapse ▲]
────────────────────────────────────────────────────────────────
  Arches & backdrops (5)
  [ARCH-001 card] [ARCH-002 card] ...

  Linens (180 units across 12 styles)
  [LIN-TBL-RND card showing 50 total] ...

  Chairs (85 units)
  [CHAIR-GLD card showing 85 total] ...
```

---

## By Event View

Shows inventory organized by what's assigned to each event. Most useful for setup day prep.

```
SOPHIA & RAFAEL RODRIGUEZ — Wedding Mar 22          [Critical]
─────────────────────────────────────────────────────────────
  Gown:          #BB-047 Ivory A-line ✓ Reserved
  Arch:          #ARCH-001 Gold metal arch ✓ Reserved
  Centerpieces:  #CTR-TALL-01 × 20 sets ✓ Reserved
  Chair covers:  #LIN-CC-WHT × 180 ✓ Reserved
  Chair sashes:  #LIN-CS-GOLD × 180 ✓ Reserved
  Uplighting:    #LIGHT-UP × 12 units ✓ Reserved

VALENTINA CRUZ — Quinceañera Mar 29                 [Near]
─────────────────────────────────────────────────────────────
  Gown:          #BB-031 Rose quartz ball gown ✓ Reserved
  Backdrop:      #ARCH-002 Balloon arch frame — NOT ASSIGNED ⚠
  ...
```

Items not yet assigned to an event show as "NOT ASSIGNED" with a warning. These surface as tasks on the event detail.

---

## Item Detail Page (Slide-over Panel)

Clicking any item opens a slide-over from the right (400px desktop, full screen mobile).

### Tabs: Details | Assignments | Condition log | Photos

**Details tab:**

```
IDENTITY
  SKU:          #ARCH-001
  Name:         Gold metal arch
  Category:     Decoration › Arches & backdrops
  Description:  Geometric gold metal arch, 8ft tall × 6ft wide.
                Assembles in 15 minutes with included hardware.
  Brand:        Event Décor Wholesale
  Color:        Gold
  Dimensions:   8ft H × 6ft W

FINANCIAL
  Rental price:       $150 per event
  Deposit:            $100
  Replacement cost:   $800
  Purchase price:     $620
  Purchase date:      Jan 15, 2025
  Vendor:             Event Décor Wholesale

CONDITION
  Current condition:  Excellent
  Last inspected:     Mar 1, 2026
  Last cleaned:       Mar 5, 2026

STATUS
  Current status:  Available
  Last used:       Valentina Cruz quinceañera (Mar 29 — upcoming)

NOTES
  [text area — editable]
  "Right leg has minor scratch from previous setup — not visible when dressed."
```

**Assignments tab:**
- List of all events this item has been/is assigned to
- Each row: event name, event date, quantity (if applicable), condition on return, rental income
- "Assign to event" button at top

**Condition log tab:**
- Chronological log of all condition and status changes
- Each entry: from → to, who changed it, date, notes, photos (if any)

**Photos tab:**
- Product photos (before any use)
- Condition photos (after returns, if damage noted)
- Upload button

---

## Add / Edit Item Form

Accessible from "+ Add item" button. Single-step modal with scrollable sections.

### Section 1 — Category & identity

```
Category:        [Select category ▾]          ← nested dropdown
                 Shows full hierarchy

Item name:       [text]
SKU:             [text]    Auto-suggest: [GEN SKU]
Description:     [textarea — optional]
Brand/Maker:     [text — optional]
Color:           [text]
Size/Dimensions: [text — optional]
Material:        [text — optional]
Tags:            [multi-input chips — e.g. "gold", "arch", "outdoor"]
```

### Section 2 — Tracking mode

```
How is this item tracked?

  ◉ Single item — I have 1 of this (e.g. one arch, one gown)
    Track as one unit with its own status

  ○ Quantity — I have multiple units (e.g. 85 chairs, 50 tablecloths)
    Total quantity:    [___]
    Minimum stock:     [___]   (alert when available drops below this)

  ○ Consumable — item is used up, not returned (e.g. candles, ribbon)
    Current stock:     [___]
    Restock point:     [___]   (alert when stock drops below this)
    Restock quantity:  [___]   (suggested order amount)
    Unit:              [___]   (box / roll / pack / piece)
```

### Section 3 — Rental pricing

```
Item type:
  ◉ Available for rental   ○ Internal use only

If rental:
  Rental price:       [$___] per event
  Deposit amount:     [$___]
  Replacement cost:   [$___]    (shown on damage claim)

Purchase info (optional — for ROI tracking):
  Purchase price:     [$___]
  Purchase date:      [date]
  Vendor/Supplier:    [text]
```

### Section 4 — Initial condition

```
Condition on arrival:
  ◉ New         ○ Excellent    ○ Good
  ○ Fair        ○ Needs repair

Notes about condition:   [text — optional]

Photos:   [upload — up to 10]
```

### Confirm button → Server Action:

```typescript
export async function addInventoryItem(data: AddInventoryItemData) {
  const { orgId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)

  // Auto-generate SKU if not provided
  const sku = data.sku || await generateSKU(boutique.id, data.categoryId)

  // Upload photos
  const photoUrls = await Promise.all(
    data.photos.map(p => uploadItemPhoto(p, boutique.id))
  )

  const [item] = await db.insert(inventoryItems).values({
    boutiqueId: boutique.id,
    categoryId: data.categoryId,
    sku,
    name: data.name,
    description: data.description,
    brand: data.brand,
    color: data.color,
    size: data.size,
    material: data.material,
    dimensions: data.dimensions,
    itemType: data.itemType,
    trackingMode: data.trackingMode,
    totalQuantity: data.totalQuantity || 1,
    availableQuantity: data.totalQuantity || 1,
    minimumStock: data.minimumStock || 1,
    rentalPriceCents: data.rentalPriceCents,
    depositCents: data.depositCents,
    replacementCostCents: data.replacementCostCents,
    purchasePriceCents: data.purchasePriceCents,
    purchaseDate: data.purchaseDate,
    purchaseVendor: data.purchaseVendor,
    condition: data.condition || 'excellent',
    currentStock: data.currentStock,
    restockPoint: data.restockPoint,
    restockQuantity: data.restockQuantity,
    consumableUnit: data.consumableUnit,
    photoUrls,
    tags: data.tags || [],
    notes: data.notes,
    status: 'available',
  }).returning()

  // Log initial condition
  await db.insert(inventoryConditionLog).values({
    itemId: item.id,
    boutiqueId: boutique.id,
    toCondition: data.condition || 'excellent',
    toStatus: 'available',
    changedByName: data.staffName,
    notes: 'Item added to inventory',
  })

  revalidatePath('/inventory')
  return item
}
```

---

## Item Assignment to Events

### Assigning an item to an event

When a decoration item or accessory is needed for an event, it's assigned from the inventory. This is different from a dress rental — decorations may be "delivered and set up" rather than "picked up."

**Trigger points:**
- From inventory item → "Assign to event" button
- From event detail → "Decoration" service card → "+ Add items"
- From event creation (future: decoration package selector)

**Assignment modal:**

```
Assign to event

Item:     Gold metal arch (#ARCH-001)
Status:   Available ✓

Select event:    [Search events ▾]
                 Shows upcoming events with dates

Quantity:        [1]   (for quantity-tracked items)

Rental price:    [$150]   (pre-filled, editable)
Deposit:         [$100]

Delivery date:   [date]    ← when item will be at the venue
Return due:      [date]    ← auto: event date + 1 day (editable)

Notes:           [text — e.g. "Setup at 7am, right side of altar"]

[ Assign ]
```

**Server Action:**

```typescript
export async function assignItemToEvent(data: AssignItemData) {
  const boutique = await getBoutiqueByOrgId(auth().orgId)

  // Check availability
  const item = await db.query.inventoryItems.findFirst({
    where: and(eq(inventoryItems.id, data.itemId), eq(inventoryItems.boutiqueId, boutique.id))
  })

  if (item.trackingMode === 'individual') {
    if (item.status !== 'available') throw new Error('Item is not available')
  } else if (item.trackingMode === 'quantity') {
    if (item.availableQuantity < data.quantity) {
      throw new Error(`Only ${item.availableQuantity} units available`)
    }
  }

  await db.transaction(async (tx) => {
    // Create assignment record
    await tx.insert(inventoryAssignments).values({
      itemId: data.itemId,
      eventId: data.eventId,
      boutiqueId: boutique.id,
      quantityAssigned: data.quantity,
      rentalPriceCents: data.rentalPriceCents,
      returnDueDate: data.returnDueDate,
      reservedAt: new Date(),
      notes: data.notes,
    })

    // Update item status/quantities
    if (item.trackingMode === 'individual') {
      await tx.update(inventoryItems)
        .set({ status: 'reserved', currentEventId: data.eventId, returnDueDate: data.returnDueDate })
        .where(eq(inventoryItems.id, data.itemId))
    } else {
      await tx.update(inventoryItems)
        .set({
          availableQuantity: item.availableQuantity - data.quantity,
          reservedQuantity: item.reservedQuantity + data.quantity,
        })
        .where(eq(inventoryItems.id, data.itemId))
    }
  })

  revalidatePath('/inventory')
  revalidatePath(`/events/${data.eventId}`)
}
```

---

## Decoration Package Sets

A **decoration set** is a group of items that are always assigned together. For example:

```
"Full reception setup — 20 tables":
  · 20 × tall centerpiece sets
  · 20 × round tablecloth (white)
  · 20 × table runner (gold)
  · 180 × chair cover (white)
  · 180 × chair sash (gold)
  · 12 × uplighting units

"Quinceañera ceremony arch setup":
  · 1 × balloon arch frame
  · 2 × pedestal stands
  · 1 × backdrop curtain
  · 4 × LED columns
```

Applying a decoration set to an event assigns all included items at once. Staff can edit quantities before confirming.

```typescript
export const decorationSets = pgTable('decoration_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  eventType: text('event_type').default('both'), // 'wedding' | 'quince' | 'both'
  basePriceCents: integer('base_price_cents'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

export const decorationSetItems = pgTable('decoration_set_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  setId: uuid('set_id').references(() => decorationSets.id).notNull(),
  itemId: uuid('item_id').references(() => inventoryItems.id).notNull(),
  defaultQuantity: integer('default_quantity').default(1),
})
```

---

## Availability Conflict Detection

Before any assignment, the system checks for conflicts:

```typescript
export async function checkItemAvailability(
  itemId: string,
  eventDate: string,
  quantity: number,
  boutiqueId: string
): Promise<AvailabilityResult> {
  const item = await getItemById(itemId, boutiqueId)

  if (item.trackingMode === 'individual') {
    // Check if any assignment overlaps the event date
    const conflicting = await db.query.inventoryAssignments.findFirst({
      where: and(
        eq(inventoryAssignments.itemId, itemId),
        isNull(inventoryAssignments.returnedAt),
        // Return due date of existing assignment is after our event date
        gte(inventoryAssignments.returnDueDate, eventDate)
      ),
      with: { event: { with: { client: true } } }
    })
    if (conflicting) {
      return {
        available: false,
        conflictingEvent: conflicting.event,
        message: `Already assigned to ${conflicting.event.name} (returns ${conflicting.returnDueDate})`
      }
    }
    return { available: true }
  }

  if (item.trackingMode === 'quantity') {
    // Count how many are already reserved/out on the event date
    const assignedOnDate = await getTotalAssignedOnDate(itemId, eventDate, boutiqueId)
    const availableOnDate = item.totalQuantity - item.damagedQuantity - assignedOnDate
    if (availableOnDate < quantity) {
      return {
        available: false,
        availableQuantity: availableOnDate,
        message: `Only ${availableOnDate} available on that date (${quantity} requested)`
      }
    }
    return { available: true, availableQuantity: availableOnDate }
  }

  return { available: true }
}
```

---

## Return & Condition Logging

### Return flow for decoration items

After an event, decoration items need to be logged as returned and inspected:

```
Decoration return — Santos Wedding (Apr 26)

  ✓  Gold metal arch              → [Returned ▾]  Condition: [Excellent ▾]
  ✓  Tall centerpiece ×20         → [Returned ▾]  Qty returned: [20]  Damaged: [0]
  ✓  Round tablecloth ×20         → [Returned ▾]  Qty returned: [18]  Damaged: [2]  ⚠
  ?  Chair covers ×180            → [Pending ▾]
  ?  Chair sashes ×180            → [Pending ▾]

  Notes on damaged items:
  "2 tablecloths have red wine stains — sent to cleaners"

  [Save & close]  [Mark all returned]
```

Staff can do a quick bulk-return ("Mark all returned, all excellent") or go item by item.

---

## Restock Alert System

### Triggers

1. **Low stock** — `currentStock <= restockPoint` (consumables)
2. **Quantity minimum** — `availableQuantity <= minimumStock` (quantity items)
3. **Damage threshold** — `damagedQuantity >= 10% of totalQuantity`
4. **All units assigned** — `availableQuantity === 0` with upcoming events needing the item

### Alert card (shown in inventory attention banner and dashboard)

```
⚠ Ivory taper candles — LOW STOCK
  4 boxes remaining · Restock point: 5 boxes
  Next use: Santos wedding (Apr 26)
  Suggested order: 10 boxes from Candles Wholesale

  [Mark restocked]  [Dismiss]
```

### Inngest function — daily restock check

```typescript
export const restockCheckJob = inngest.createFunction(
  { id: 'restock-check', retries: 2 },
  { cron: '0 8 * * *' },
  async ({ step }) => {
    const boutiques = await step.run('get-boutiques', () =>
      db.query.boutiques.findMany({ where: eq(boutiques.plan, 'growth') })
    )

    for (const boutique of boutiques) {
      // Check consumables
      const lowConsumables = await step.run(`check-consumables-${boutique.id}`, () =>
        db.query.inventoryItems.findMany({
          where: and(
            eq(inventoryItems.boutiqueId, boutique.id),
            eq(inventoryItems.trackingMode, 'consumable'),
            lte(inventoryItems.currentStock, inventoryItems.restockPoint),
            eq(inventoryItems.isActive, true)
          )
        })
      )

      for (const item of lowConsumables) {
        // Check if alert already exists and unresolved
        const existing = await db.query.inventoryRestockAlerts.findFirst({
          where: and(
            eq(inventoryRestockAlerts.itemId, item.id),
            eq(inventoryRestockAlerts.isResolved, false)
          )
        })
        if (!existing) {
          await db.insert(inventoryRestockAlerts).values({
            itemId: item.id,
            boutiqueId: boutique.id,
            alertType: item.currentStock === 0 ? 'out_of_stock' : 'low_stock',
            currentStock: item.currentStock,
            minimumStock: item.restockPoint,
          })
        }
      }
    }
  }
)
```

---

## SKU Auto-Generation

When staff don't enter a SKU, the system generates one based on category:

```typescript
export async function generateSKU(boutiqueId: string, categoryId: string): Promise<string> {
  const category = await getCategoryById(categoryId)
  const prefix = getCategoryPrefix(category.slug)

  // Find highest existing number for this prefix
  const existing = await db.query.inventoryItems.findMany({
    where: and(
      eq(inventoryItems.boutiqueId, boutiqueId),
      like(inventoryItems.sku, `${prefix}-%`)
    ),
    orderBy: [desc(inventoryItems.createdAt)],
    limit: 1,
  })

  const nextNum = existing.length > 0
    ? parseInt(existing[0].sku.split('-')[1]) + 1
    : 1

  return `${prefix}-${String(nextNum).padStart(3, '0')}`
}

const CATEGORY_PREFIXES: Record<string, string> = {
  'bridal-gowns':         'BB',
  'quinceanera-gowns':    'QG',
  'arches-backdrops':     'ARCH',
  'centerpieces':         'CTR',
  'linens':               'LIN',
  'lighting':             'LIGHT',
  'chairs':               'CHAIR',
  'tables':               'TBL',
  'signage':              'SIGN',
  'veils':                'VL',
  'headpieces':           'HP',
  'jewelry':              'JWL',
  'accessories':          'ACC',
  'ceremony-items':       'CER',
  'reception-items':      'REC',
  'consumables':          'CON',
  'equipment':            'EQP',
}
```

---

## Inventory Stats Dashboard

Shown at the top of the inventory page (collapsible):

```typescript
export async function getInventoryStats(boutiqueId: string) {
  const items = await getAllActiveItems(boutiqueId)
  const today = new Date()

  return {
    // Totals
    totalItems: items.length,
    totalCategories: new Set(items.map(i => i.categoryId)).size,
    totalRentalValue: items.reduce((s, i) => s + (i.rentalPriceCents || 0), 0),
    totalInventoryValue: items.reduce((s, i) => s + (i.purchasePriceCents || 0), 0),

    // Status summary
    available: items.filter(i => i.status === 'available').length,
    reserved: items.filter(i => i.status === 'reserved').length,
    rented: items.filter(i => i.status === 'rented').length,
    damaged: items.filter(i => i.condition === 'needs_repair' || i.damagedQuantity > 0).length,

    // Alerts
    overdueReturns: items.filter(i =>
      i.status === 'rented' && i.returnDueDate && new Date(i.returnDueDate) < today
    ).length,
    lowStock: items.filter(i =>
      i.trackingMode === 'consumable' && i.currentStock <= i.restockPoint
    ).length,
    needsAttention: 0, // sum of above two + damage alerts

    // Gowns specifically
    bridalGowns: { total: 0, available: 0, reserved: 0 },
    quinceGowns: { total: 0, available: 0, reserved: 0 },
  }
}
```

---

## Condition Reference

| Condition | Definition | Action |
|-----------|-----------|--------|
| `new` | Never used, original packaging/state | Ready to rent |
| `excellent` | Like new, no visible wear | Ready to rent |
| `good` | Minor normal wear, fully functional | Ready to rent |
| `fair` | Noticeable wear, may need minor cleaning | Inspect before renting |
| `needs_repair` | Requires repair before next use | Take out of rotation |
| `in_repair` | Currently being repaired | Out of rotation |
| `retired` | No longer rentable, kept for parts/display | Cannot be assigned |

---

## Query Functions

```typescript
// lib/db/queries/inventory.ts

export async function getInventoryItems(
  boutiqueId: string,
  filters?: {
    categoryId?: string
    status?: ItemStatus
    trackingMode?: TrackingMode
    needsAttention?: boolean
    search?: string
  }
) {
  return db.query.inventoryItems.findMany({
    where: and(
      eq(inventoryItems.boutiqueId, boutiqueId),
      eq(inventoryItems.isActive, true),
      filters?.categoryId ? eq(inventoryItems.categoryId, filters.categoryId) : undefined,
      filters?.status ? eq(inventoryItems.status, filters.status) : undefined,
      filters?.trackingMode ? eq(inventoryItems.trackingMode, filters.trackingMode) : undefined,
      filters?.search ? or(
        ilike(inventoryItems.name, `%${filters.search}%`),
        ilike(inventoryItems.sku, `%${filters.search}%`),
      ) : undefined,
    ),
    with: {
      category: true,
      currentEvent: { with: { client: true } },
    },
    orderBy: [asc(inventoryItems.categoryId), asc(inventoryItems.name)],
  })
}

export async function getItemsByEvent(eventId: string, boutiqueId: string) {
  return db.query.inventoryAssignments.findMany({
    where: and(
      eq(inventoryAssignments.eventId, eventId),
      eq(inventoryAssignments.boutiqueId, boutiqueId),
      isNull(inventoryAssignments.returnedAt),
    ),
    with: {
      item: { with: { category: true } },
    },
  })
}

export async function getItemsNeedingAttention(boutiqueId: string) {
  const today = new Date()
  const items = await getAllActiveItems(boutiqueId)
  return {
    overdueReturns: items.filter(i =>
      i.status === 'rented' && i.returnDueDate && new Date(i.returnDueDate) < today
    ),
    lowStock: items.filter(i =>
      i.trackingMode === 'consumable' && i.currentStock !== null && i.currentStock <= (i.restockPoint || 0)
    ),
    damaged: items.filter(i =>
      i.condition === 'needs_repair' || (i.damagedQuantity || 0) > 0
    ),
  }
}
```

---

## TypeScript Types

```typescript
export type ItemStatus =
  | 'available' | 'reserved' | 'rented' | 'returned'
  | 'cleaning' | 'damaged' | 'in_repair' | 'retired'

export type TrackingMode = 'individual' | 'quantity' | 'consumable'

export type ItemCondition =
  | 'new' | 'excellent' | 'good' | 'fair'
  | 'needs_repair' | 'in_repair' | 'retired'

export type ItemType = 'rental' | 'consumable' | 'internal'

export interface InventoryItem {
  id: string
  boutiqueId: string
  categoryId: string
  sku: string
  name: string
  description?: string
  brand?: string
  color?: string
  size?: string
  material?: string
  dimensions?: string
  itemType: ItemType
  trackingMode: TrackingMode
  // Quantity fields
  totalQuantity: number
  availableQuantity: number
  reservedQuantity: number
  damagedQuantity: number
  minimumStock: number
  // Status (individual items)
  status: ItemStatus
  currentEventId?: string
  returnDueDate?: string
  // Financials
  rentalPriceCents?: number
  depositCents?: number
  replacementCostCents?: number
  purchasePriceCents?: number
  purchaseDate?: string
  purchaseVendor?: string
  // Condition
  condition: ItemCondition
  lastInspectedAt?: string
  lastCleanedAt?: string
  // Consumable
  consumableUnit?: string
  currentStock?: number
  restockPoint?: number
  restockQuantity?: number
  // Media
  photoUrls: string[]
  tags: string[]
  notes?: string
  isActive: boolean
  // Joined
  category?: InventoryCategory
  currentEvent?: Event
}

export interface InventoryCategory {
  id: string
  boutiqueId: string
  name: string
  slug: string
  parentId?: string
  icon?: string
  color?: string
  itemType: ItemType
  displayOrder: number
  isActive: boolean
}
```

---

## Component Structure

```
components/inventory/
├── InventoryPage.tsx               # Main page — view toggles, filters, stats
├── InventoryStats.tsx              # Collapsible stats header
├── AttentionBanner.tsx             # Alerts: overdue, low stock, damaged
├── FilterBar.tsx                   # Search + category + status + quick filters
├── views/
│   ├── GridView.tsx                # Card grid (3/2/1 col responsive)
│   ├── ListView.tsx                # Dense table view
│   ├── ByCategoryView.tsx          # Grouped collapsible sections
│   └── ByEventView.tsx             # Organized by event assignment
├── cards/
│   ├── InventoryCard.tsx           # Universal card (adapts to item type)
│   ├── GownCard.tsx                # Dress-specific card with silhouette
│   ├── QuantityCard.tsx            # Shows quantity bar breakdown
│   └── ConsumableCard.tsx          # Shows stock level bar
├── detail/
│   ├── ItemDetailPanel.tsx         # Slide-over wrapper
│   ├── ItemDetailsTab.tsx          # Identity, financial, condition
│   ├── AssignmentsTab.tsx          # Event assignment history
│   ├── ConditionLogTab.tsx         # Status and condition audit trail
│   └── PhotosTab.tsx               # Photo gallery + upload
├── modals/
│   ├── AddItemModal.tsx            # Create new item
│   ├── EditItemModal.tsx           # Edit existing item
│   ├── AssignItemModal.tsx         # Assign to event
│   ├── ReturnItemModal.tsx         # Log return + condition
│   ├── BulkReturnModal.tsx         # Return all items from one event
│   ├── ConditionUpdateModal.tsx    # Update condition/status
│   └── RestockModal.tsx            # Log consumable restock
├── categories/
│   ├── CategoryManager.tsx         # Settings page — manage categories
│   └── CategoryTreeItem.tsx        # Nested category row
└── DecorationSetManager.tsx        # Create/edit decoration package sets
```

---

## Validation Rules Summary

| Action | Rule | Error |
|--------|------|-------|
| Add item | SKU unique within boutique | "A SKU with this name already exists" |
| Add item | Category required | "Please select a category" |
| Add item | Name required | "Item name is required" |
| Add item | Rental price > 0 if rental type | "Please enter a rental price" |
| Assign | Item must be available | "This item is not available" |
| Assign | Quantity ≤ available quantity | "Only X units available on that date" |
| Assign | Event date must be future | "Cannot assign to a past event" |
| Return | Quantity returned ≤ quantity assigned | "Cannot return more than was assigned" |
| Return | Damaged quantity ≤ quantity assigned | "Damaged count exceeds assigned quantity" |
| Update condition | Notes required for 'needs_repair' | "Please describe the damage" |
| Restock | Quantity > 0 | "Restock quantity must be greater than 0" |
| Retire | Confirmation required | "Type RETIRE to confirm removing this item" |
