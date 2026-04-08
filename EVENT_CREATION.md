# EVENT_CREATION.md — Belori Event Creation Spec (v2)

> **Purpose:** This file defines everything about how a new event is created in Belori — the UI flow, all form fields, inspiration & mood board capture, venue linen calculator, validation rules, auto-generated data, database writes, and post-creation contract generation. Paste alongside PRD.md, TECH_STACK.md, INVENTORY_MANAGEMENT.md, and SERVICE_LINKS.md when building event creation.

---

## Overview

An **Event** is the central unit of Belori. Creating an event does four things automatically:

1. **Captures the vision** — client inspiration, colors, mood, venue details
2. **Calculates inventory needs** — from guest count + venue answers, calculates exact quantities of linens, chairs, and decoration items needed
3. **Generates all scaffolding** — milestones, tasks, appointment stubs, alteration job, dress reservation
4. **Produces a signed contract** — PDF contract generated immediately on save, ready for client signature

Event creation must work in under 3 minutes for a complete record, be fully usable on an iPad at the front desk, and feel like a consultation — not a data entry form.

---

## Creation Flow — 5 Steps

Updated from 3 steps to 5 to accommodate inspiration capture and inventory calculation.

```
Step 1: Client & event basics
Step 2: Inspiration & vision        ← NEW
Step 3: Services & packages
Step 4: Venue & inventory needs     ← NEW (expands when decoration selected)
Step 5: Review, confirm & contract  ← UPDATED (generates contract on save)
```

Progress shown as 5-dot stepper at the top of the modal. On mobile, step label shown below dots: "Step 2 of 5 — Inspiration."

Modal dimensions:
- Desktop: centered overlay, max-width 640px, max-height 88vh, scrollable
- Tablet: centered overlay, 90vw, 90vh
- Mobile: full-screen bottom sheet, slides up, drag-handle at top

---

## Step 1 — Client & Event Basics

*(Unchanged from v1 — see below for complete spec)*

### Client selector

**If creating from a booking lead:** client fields are pre-filled and locked (read-only with an "Edit" link).

**If creating fresh:**
- Search field: "Search existing clients or add new"
- As user types, shows matching clients from `clients` table (name, phone, avatar initials)
- If no match: "No client found — create [typed name] as a new client"
- Selecting "create new" expands inline mini-form: name, phone, email (minimum required)
- New client written to DB on Step 5 confirm, not before

### Event type toggle
```
[ Wedding ]  [ Quinceañera ]
```
- Large tap-friendly buttons, min h-14 (56px)
- Wedding: rosa bg when selected
- Quinceañera: purple bg when selected
- Default: Wedding
- Affects: milestone defaults, required appointments, task templates, contract language, SMS language

### Event name
- **Label:** Event name
- **Auto-fill:** Wedding → "[Client first name] & [Partner first name] [Last name]" | Quinceañera → "[Client full name]"
- **Placeholder:** "e.g. Sophia & Rafael Rodriguez"
- **Required:** yes, max 80 chars

### Event date
- **Input:** Date picker — native on mobile, custom calendar on desktop
- **Required:** yes
- **Validation:** Cannot be in the past (hard block). Warn (not block) if <30 days away.
- **Warning:** "This event is coming up soon — assign services and schedule appointments right away."

### Venue
- **Label:** Venue / location
- **Placeholder:** "e.g. St. Anthony's Chapel, McAllen TX"
- **Required:** no — helper text: "Add later if not confirmed yet"

### Guest count
- **Label:** Approximate guest count
- **Input:** Number, min 1, max 2000
- **Required:** no
- **Important:** Guest count is used in Step 4 to calculate inventory quantities automatically

### Coordinator assignment
- **Label:** Assigned coordinator
- **Input:** Dropdown of staff with role = owner | coordinator
- **Default:** currently logged-in user
- **Required:** yes

---

## Step 2 — Inspiration & Vision ← NEW

> **Design intent:** This step makes the event creation feel like a real consultation. It captures what the client is dreaming of so staff can reference it throughout the planning process. It also generates the inspiration board visible on the event detail page.

### Section header
```
"Tell us about [Client name]'s vision"
"This helps your team stay aligned on the look and feel of the event."
```

### 2A — Color palette

**Label:** Event color palette
**Description:** "What colors does the client want for their event?"

**Color picker — up to 6 colors:**
```
┌─────────────────────────────────────────────────┐
│  Event colors                                    │
│                                                  │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──────────────────┐ │
│  │  │ │  │ │  │ │  │ │  │ │  + Add color      │ │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──────────────────┘ │
│  Rose  Gold  Ivory  Sage        (tap to add)     │
│                                                  │
│  Quick presets:                                  │
│  [Rose gold]  [Classic white]  [Dusty blue]      │
│  [Emerald]    [Burgundy]       [Lavender]        │
│  [Champagne]  [Terracotta]     [Navy & gold]     │
└─────────────────────────────────────────────────┘
```

**Color swatch interaction:**
- Tapping "Add color" opens a color picker (HEX input + visual wheel)
- Tapping a preset applies 2–3 colors at once (preset defines the combination)
- Each added swatch shows: color circle + color name (editable text below)
- Tap existing swatch to edit or remove

**Color presets (with their hex values):**
```typescript
const COLOR_PRESETS = [
  { name: 'Rose gold',      colors: [{ hex: '#B76E79', label: 'Rose' }, { hex: '#D4AF7A', label: 'Gold' }, { hex: '#FAF0E6', label: 'Ivory' }] },
  { name: 'Classic white',  colors: [{ hex: '#FFFFFF', label: 'White' }, { hex: '#C9A96E', label: 'Gold' }] },
  { name: 'Dusty blue',     colors: [{ hex: '#7BA7BC', label: 'Dusty blue' }, { hex: '#F5F0EB', label: 'Cream' }, { hex: '#FFFFFF', label: 'White' }] },
  { name: 'Emerald',        colors: [{ hex: '#2E8B57', label: 'Emerald' }, { hex: '#FFFFFF', label: 'White' }, { hex: '#D4AF7A', label: 'Gold' }] },
  { name: 'Burgundy',       colors: [{ hex: '#800020', label: 'Burgundy' }, { hex: '#D4AF7A', label: 'Gold' }, { hex: '#FFFFF0', label: 'Ivory' }] },
  { name: 'Lavender',       colors: [{ hex: '#9B7EC8', label: 'Lavender' }, { hex: '#FFFFFF', label: 'White' }, { hex: '#E8D5B7', label: 'Cream' }] },
  { name: 'Champagne',      colors: [{ hex: '#F7E7CE', label: 'Champagne' }, { hex: '#C9A96E', label: 'Gold' }, { hex: '#FFFFFF', label: 'White' }] },
  { name: 'Terracotta',     colors: [{ hex: '#E07052', label: 'Terracotta' }, { hex: '#D4C5B0', label: 'Sand' }, { hex: '#F5F0EB', label: 'Cream' }] },
  { name: 'Navy & gold',    colors: [{ hex: '#1B2A4A', label: 'Navy' }, { hex: '#D4AF7A', label: 'Gold' }, { hex: '#FFFFFF', label: 'White' }] },
]
```

### 2B — Style / theme

**Label:** Event style
**Type:** Multi-select chips (tap to toggle, up to 3)

```
[ Romantic ]      [ Modern / minimal ]   [ Rustic / boho ]
[ Glamorous ]     [ Garden / outdoor ]   [ Traditional ]
[ Vintage ]       [ Fiesta / colorful ]  [ Elegant / classic ]
[ Tropical ]      [ Industrial chic ]    [ Fairytale ]
```

Selected chips: rosa background + rosa border
Unselected: white background + gray border

### 2C — Inspiration photos

**Label:** Inspiration photos
**Description:** "Upload photos the client shared — Pinterest screenshots, magazine clippings, reference images"

```
┌─────────────────────────────────────────────────┐
│  ┌────────────────┐  ┌───────────┐  ┌─────────┐ │
│  │                │  │           │  │         │ │
│  │   Drop photos  │  │  Photo 1  │  │ Photo 2 │ │
│  │   or tap to    │  │     ×     │  │    ×    │ │
│  │   upload       │  │           │  │         │ │
│  └────────────────┘  └───────────┘  └─────────┘ │
│                                                  │
│  Up to 12 photos · JPG, PNG, HEIC · Max 10MB ea  │
└─────────────────────────────────────────────────┘
```

- Files uploaded to Supabase Storage at: `boutique/{boutiqueId}/events/{eventId}/inspiration/`
- On mobile: opens camera roll or camera directly
- Photos displayed in a 3-column grid with × to remove
- Tap any photo to view full-size
- Photos appear in the "Inspiration" section of the event detail page after creation

### 2D — Additional vision notes

**Label:** Vision notes (optional)
**Type:** Textarea
**Placeholder:** "Anything else about the client's vision — specific flowers, must-have moments, things to avoid, special cultural traditions..."
**Max:** 500 characters

### 2E — Quinceañera-specific fields

*Only shown when event type = Quinceañera*

**Theme name:**
- Label: Theme name
- Placeholder: "e.g. 'Under the stars', 'Enchanted garden', 'Masquerade'"

**Court size:**
- Label: How many chambelanes / damas?
- Two number inputs: `[___] chambelanes` `[___] damas`
- Used later to calculate boutonnieres, corsages if boutique offers them

**Waltz song preference:**
- Label: Waltz song (optional)
- Placeholder: "e.g. 'A Thousand Years' by Christina Perri"

---

## Step 3 — Services & Packages

*(Updated from v1 Step 2 — adds connection to inspiration colors)*

### Services multi-select (same 2×2 grid)

```
[ ✓ Dress rental ]   [ ✓ Alterations ]
[ ✓ Event planning ] [ ✓ Decoration  ]
```

### Decoration service → Step 4 link

When "Decoration" is toggled on, a subtle callout appears below the service grid:
```
💡 You'll be asked about venue and linen details in the next step
   so we can calculate exactly what you'll need from inventory.
```

### Package presets — updated with color hints

When a package is selected, the system checks the event's saved colors (from Step 2) and shows a soft note:
```
"Full Service Wedding" selected
Rose gold palette detected — we'll suggest rose and gold linens in Step 4.
```

This is visual only — the actual linen suggestions happen in Step 4.

### Total value & milestone structure

*(Same as v1 — see original EVENT_CREATION.md Step 2 spec)*

### Dress reservation section

*(Same as v1 — expands when dress_rental selected)*

### Alteration details section

*(Same as v1 — expands when alterations selected)*

---

## Step 4 — Venue & Inventory Needs ← NEW (Decoration only)

> **This step only appears when "Decoration" service is selected.**
> If decoration is not selected, this step is skipped automatically and the stepper shows 4 dots instead of 5.

### Section header
```
"Let's figure out what you'll need"
"Answer a few questions about the venue and we'll calculate
 exactly how many items to pull from inventory."
```

### 4A — Table setup

**Question:** How many tables will there be?
```
Number of tables:    [____]    ← number input

Table shapes:
  ◉ All round                  → uses round tablecloths
  ○ All rectangular            → uses rectangular tablecloths
  ○ Mix (round + rectangular)
      Round: [____]  Rectangular: [____]

Sweetheart / head table:
  [ ] Yes, include 1 sweetheart table
      Style: [ Small (2-seater) ] [ Extended (6-seater) ]
```

### 4B — Chairs

**Question:** How many chairs total?
```
Total chairs:   [____]    ← pre-filled with guest count from Step 1 if entered

Source of chairs:
  ◉ Venue is providing the chairs
  ○ We are providing / renting chairs

  If "We are providing chairs":
    Chair style preference:
    [ ] Chiavari (gold)     — $8/chair — [85 available]
    [ ] Chiavari (silver)   — $8/chair — [24 available]
    [ ] Ghost chair         — $10/chair — [0 available ✗]
    [ ] Cross-back          — $6/chair — [40 available]
    [ ] No preference
```

**Live inventory check:**
```typescript
// When chair style is selected AND quantity entered:
// Check inventory for that chair type on the event date
// Show real-time availability from inventory
const chairAvailability = await checkItemAvailability(itemId, eventDate, quantity)
// Display: "[85 available ✓]" in green or "[12 available — not enough ✗]" in red
```

### 4C — Table coverings

**Question:** Is the venue providing tablecloths?

```
Tablecloths:
  ◉ Venue is providing tablecloths — we don't need to supply them
  ○ We are providing tablecloths — pull from our inventory
  ○ Client is bringing their own tablecloths

  If "We are providing":
    Color:     [Dropdown — filtered to event's saved colors from Step 2]
               Options include: White / Ivory / Blush / Navy / Burgundy / Custom...

    Style:     ◉ Plain / solid color
               ○ Lace overlay (adds lace overlay on top of solid)
               ○ Sequin / glitter

    We'll need:
    ┌────────────────────────────────────────────────────┐
    │  Auto-calculated from table count above:           │
    │                                                    │
    │  Round tablecloths:     20  [85" diameter]         │
    │  Rectangular cloths:    0                          │
    │  Sweetheart table:      1   [specialty size]       │
    │                                                    │
    │  In inventory (white):  50 available ✓             │
    │  In inventory (ivory):  22 available ✓             │
    │                                                    │
    │  Quantity to reserve:   21  [editable]             │
    └────────────────────────────────────────────────────┘
```

### 4D — Chair coverings

**Question:** Is the venue providing chair covers?

```
Chair covers:
  ◉ Venue is providing chair covers — we don't need to supply them
  ○ Chairs don't need covers (Chiavari chairs already selected)
  ○ We are providing chair covers — pull from our inventory
  ○ Client is bringing their own chair covers

  If "We are providing":
    Color:     [Dropdown — filtered to event's saved colors]

    We'll need:
    ┌──────────────────────────────────────────────┐
    │  Auto-calculated:                            │
    │  Chair covers needed:  180                   │
    │  (based on 180 chairs from guest count)      │
    │                                              │
    │  In inventory (white):   200 available ✓     │
    │  In inventory (ivory):   180 available ✓     │
    │                                              │
    │  Quantity to reserve:    180  [editable]     │
    └──────────────────────────────────────────────┘
```

### 4E — Chair sashes / bows

```
Chair sashes:
  [ ] Add chair sashes / bows
      Color:     [Dropdown — filtered to event colors]
      Style:     [ Satin bow ] [ Organza sash ] [ Burlap tie ]

      We'll need:
      ┌──────────────────────────────────────────────┐
      │  180 sashes needed                           │
      │  Gold satin sashes: 180 available ✓          │
      │  Quantity to reserve: 180  [editable]        │
      └──────────────────────────────────────────────┘
```

### 4F — Table runners

```
Table runners:
  [ ] Add table runners
      Color/style: [text or dropdown]
      Per table: ◉ 1 runner per table  ○ 2 runners
      We'll need: [auto-calculated: tables × runners per table]
```

### 4G — Centerpieces

```
Centerpieces:
  [ ] Include centerpieces from our inventory

      Style:
      ◉ Tall centerpiece                 [12 sets available]
      ○ Low / garden centerpiece         [8 sets available]
      ○ Candelabra                       [6 available]
      ○ Lantern                          [14 available]
      ○ Mix of tall + low
          Tall: [____]  Low: [____]

      Quantity: [auto-filled = number of tables]  [editable]

      Each centerpiece set includes: [pulled from decoration set description]
```

### 4H — Arch / backdrop

```
Ceremony/Reception arch:
  [ ] Include arch or backdrop from our inventory

      Type:
      ○ Floral arch (gold frame)        [2 available ✓]
      ○ Metal arch (geometric)          [1 available ✓]
      ○ Balloon arch frame              [0 available ✗ — not available]
      ○ Backdrop stand + curtain        [3 available ✓]

      Placement: [text — "Ceremony altar" or "Photo backdrop at reception"]
```

### 4I — Additional decoration notes

```
Other decoration needs:
[textarea — "Anything specific: fairy lights on ceiling, 
 specific floral arrangements, photo booth props..."]
```

### 4J — Live inventory summary

At the bottom of Step 4, a running summary updates as staff fills in the form:

```
┌─────────────────────────────────────────────────────┐
│  ITEMS TO RESERVE FROM INVENTORY                    │
│                                                     │
│  ✓  Round tablecloths (white) × 21    50 avail ✓   │
│  ✓  Chair covers (white) × 180       200 avail ✓   │
│  ✓  Gold satin chair sashes × 180    200 avail ✓   │
│  ✓  Tall centerpiece sets × 20        12 avail ✓   │
│  ✓  Gold Chiavari chairs × 180        85 avail ✗   │
│     ⚠ Only 85 available — 95 short                 │
│                                                     │
│  ⚠  1 item has a shortage                          │
│  All other items will be reserved on save           │
│                                                     │
│  Estimated rental total for decoration:  $2,840     │
└─────────────────────────────────────────────────────┘
```

**Shortage handling:**
- Red row + warning icon on the short item
- Options shown: "Reserve 85 only" | "Find alternative" | "Note the shortage"
- Staff can proceed — shortage is logged as a task: "Source 95 additional Chiavari chairs for [event] — shortage in inventory"

---

## Step 5 — Review, Confirm & Contract ← UPDATED

### Review summary

Full read-only summary organized into sections. Updated to include new sections:

```
CLIENT
  Sophia Rodriguez — (956) 214-8830 — sophia.r@gmail.com

EVENT
  Sophia & Rafael Rodriguez
  Wedding · Mar 22, 2026 · St. Anthony's Chapel · ~180 guests
  Coordinator: Maria G.

INSPIRATION
  Colors: Rose ● Gold ● Ivory
  Style: Romantic, Elegant / classic
  Photos: 4 uploaded
  Notes: "Wants peonies if possible. No carnations."

SERVICES
  ✓ Dress rental   ✓ Alterations   ✓ Planning   ✓ Decoration

VENUE & LINEN PLAN
  Tablecloths:   Boutique providing — 21 white round (reserved)
  Chair covers:  Boutique providing — 180 white (reserved)
  Chair sashes:  Boutique providing — 180 gold satin (reserved)
  Centerpieces:  12 tall sets (reserved)
  Chairs:        Venue providing — no rental needed
  ⚠ Chiavari chair shortage logged as task

CONTRACT VALUE
  $6,800 total

PAYMENT MILESTONES
  Booking deposit    $1,700    Due Mar 14
  Mid-point          $3,400    Due Feb 14
  Decoration deposit $500      Due Feb 20
  Final balance      $1,200    Due Mar 8

DRESS RESERVATION
  #BB-047 · Ivory A-line cathedral · Size 8

ALTERATIONS
  Ana R. · Bridal gown #BB-047 · Hem, Bustle, Waist take-in · $280

AUTOMATIONS ENROLLING
  ✓ Appointment reminders (SMS 24h + 2h)
  ✓ Payment milestone reminders
  ✓ Dress return reminder
  ✓ Post-event review request

CONTRACT
  A PDF contract will be generated and sent to sophia.r@gmail.com
  [ ] Also print a paper copy
  [ ] Require digital signature via email link
```

### Confirm button

```
[ Back ]          [ Create event & generate contract → ]
```

---

## On Confirm — Complete Transaction

When staff taps "Create event & generate contract," a single Server Action runs:

```typescript
export async function createEventWithContract(formData: CreateEventFormData) {
  const { orgId, userId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)
  const staff = await getStaffByClerkUserId(userId, boutique.id)

  const result = await db.transaction(async (tx) => {
    // 1. Create or fetch client
    const client = formData.isNewClient
      ? await tx.insert(clients).values(formData.clientData).returning().then(r => r[0])
      : await tx.query.clients.findFirst({ where: eq(clients.id, formData.clientId) })

    // 2. Create event
    const [event] = await tx.insert(events).values({
      boutiqueId: boutique.id,
      clientId: client.id,
      ...formData.eventData,
      // Store inspiration data
      inspirationColors: formData.inspiration.colors,       // JSON
      inspirationStyles: formData.inspiration.styles,       // JSON array
      inspirationNotes: formData.inspiration.notes,
      inspirationPhotoUrls: formData.inspiration.photoUrls, // uploaded already
      // Quinceañera specific
      quinceCortSize: formData.quinceData?.cortSize,
      quinceWaltzSong: formData.quinceData?.waltzSong,
      quincetheme: formData.quinceData?.theme,
    }).returning()

    // 3. Payment milestones
    await tx.insert(paymentMilestones).values(
      formData.milestones.map(m => ({ ...m, eventId: event.id, boutiqueId: boutique.id }))
    )

    // 4. Auto-generate tasks (service-based + venue-based)
    const tasks = [
      ...generateDefaultTasks(formData.services, client.name),
      ...generateVenueTasks(formData.venuePlan, event.name),
    ]
    await tx.insert(eventTasks).values(
      tasks.map(t => ({ ...t, eventId: event.id, boutiqueId: boutique.id }))
    )

    // 5. Auto-generate appointment stubs
    const appts = generateRequiredAppointments(formData.services, formData.eventData.type)
    await tx.insert(appointments).values(
      appts.map(a => ({ ...a, eventId: event.id, boutiqueId: boutique.id, status: 'not_scheduled' }))
    )

    // 6. Dress reservation
    if (formData.dressId) {
      const dress = await tx.execute(
        sql`SELECT * FROM inventory_items WHERE id = ${formData.dressId} AND status = 'available' FOR UPDATE NOWAIT`
      )
      if (!dress.rows.length) throw new Error('DRESS_UNAVAILABLE')

      await tx.insert(dressRentals).values({
        itemId: formData.dressId, eventId: event.id, boutiqueId: boutique.id,
        returnDueDate: addDays(new Date(formData.eventData.eventDate), 2),
        rentalPriceCents: formData.dressPriceCents,
        depositCents: formData.dressDepositCents,
      })
      await tx.update(inventoryItems)
        .set({ status: 'reserved', currentEventId: event.id })
        .where(eq(inventoryItems.id, formData.dressId))
    }

    // 7. Alteration job
    if (formData.alterationData && formData.services.includes('alterations')) {
      await tx.insert(alterationJobs).values({
        ...formData.alterationData, eventId: event.id, boutiqueId: boutique.id,
        status: 'measurement_needed',
        deadlineDate: subDays(new Date(formData.eventData.eventDate), 5),
      })
    }

    // 8. Reserve decoration inventory items (from Step 4)
    for (const res of formData.inventoryReservations) {
      await tx.insert(inventoryAssignments).values({
        itemId: res.itemId, eventId: event.id, boutiqueId: boutique.id,
        quantityAssigned: res.quantity,
        rentalPriceCents: res.rentalPriceCents,
        returnDueDate: addDays(new Date(formData.eventData.eventDate), 1),
        reservedAt: new Date(),
        notes: res.notes,
      })
      // Update inventory quantities
      await tx.update(inventoryItems).set({
        availableQuantity: sql`available_quantity - ${res.quantity}`,
        reservedQuantity: sql`reserved_quantity + ${res.quantity}`,
      }).where(eq(inventoryItems.id, res.itemId))
    }

    // 9. Convert booking lead if applicable
    if (formData.leadId) {
      await tx.update(bookingLeads)
        .set({ status: 'converted' })
        .where(eq(bookingLeads.id, formData.leadId))
    }

    return { event, client }
  })

  // 10. Upload inspiration photos (already uploaded to temp, move to permanent path)
  await moveInspirationPhotos(result.event.id, formData.inspiration.photoUrls, boutique.id)

  // 11. Generate contract PDF
  const contractPdf = await generateEventContract({
    event: result.event,
    client: result.client,
    boutique,
    milestones: formData.milestones,
    services: formData.services,
    venuePlan: formData.venuePlan,
    inspiration: formData.inspiration,
    alterationData: formData.alterationData,
    dressData: formData.dressId ? await getDressById(formData.dressId) : null,
  })

  // 12. Store contract
  const contractUrl = await storeContract(contractPdf, result.event.id, boutique.id)
  await db.update(events)
    .set({ contractUrl, contractGeneratedAt: new Date() })
    .where(eq(events.id, result.event.id))

  // 13. Send contract email (if email provided)
  if (result.client.email && formData.sendContractByEmail) {
    await sendContractEmail({
      to: result.client.email,
      clientName: result.client.name,
      boutiqueName: boutique.name,
      eventName: result.event.name,
      contractUrl,
      requireSignature: formData.requireDigitalSignature,
    })
  }

  // 14. Enroll in automations
  await inngest.send({
    name: 'event.created',
    data: { eventId: result.event.id, boutiqueId: boutique.id, clientPhone: result.client.phone }
  })

  return { eventId: result.event.id, contractUrl }
}
```

---

## Contract Generation

### What the contract contains

The PDF contract is generated immediately after event creation. It is the official agreement between the boutique and the client.

### Contract sections

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BELLA BRIDAL & EVENTS
1420 N 10th St, McAllen, TX 78501
(956) 555-0100  ·  info@bellabridal.com

     EVENT SERVICE AGREEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTRACT #    BB-2026-0047
DATE          March 17, 2026
COORDINATOR   Maria G.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLIENT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Client name:    Sophia Rodriguez
Phone:          (956) 214-8830
Email:          sophia.r@gmail.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Event:          Sophia & Rafael Rodriguez Wedding
Date:           Saturday, March 22, 2026
Venue:          St. Anthony's Chapel, McAllen TX
Guest count:    Approximately 180 guests
Event type:     Wedding

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SERVICES CONTRACTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ DRESS RENTAL
  Gown #BB-047 — Ivory A-line cathedral
  Size 8 (to be altered)
  Rental fee:   $450.00
  Deposit:      $300.00
  Pickup date:  March 21, 2026
  Return due:   March 24, 2026 by 5:00 PM

✓ ALTERATIONS
  Garment:      Bridal gown #BB-047
  Work items:   Hem, Bustle, Waist take-in
  Seamstress:   Ana Reyes
  Quoted price: $280.00
  Must complete by: March 19, 2026

✓ EVENT PLANNING
  Coordinator:  Maria G.
  Includes:     Full event coordination, run-of-show,
                vendor management, day-of coordination

✓ DECORATION & SETUP
  Setup crew:   4 staff members
  Setup time:   March 22, 2026 at 7:00 AM
  Included items:
    · Round tablecloths (white) ×21
    · Chair covers (white) ×180
    · Chair sashes (gold satin) ×180
    · Tall centerpiece sets ×20
  Venue is providing: Chairs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSPIRATION & VISION (FOR REFERENCE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Event colors:   Rose · Gold · Ivory
Style:          Romantic, Elegant / classic
Special notes:  "Wants peonies if possible. No carnations."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYMENT SCHEDULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Total contract value:           $6,800.00

  Booking deposit (25%)   $1,700   Due March 14, 2026
  Mid-point payment (50%) $3,400   Due February 14, 2026
  Decoration deposit       $500    Due February 20, 2026
  Final balance (18%)     $1,200   Due March 8, 2026

  Accepted payment methods: Cash, Zelle, Credit card
  Late fee: $50 per week after due date

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TERMS & CONDITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CANCELLATION POLICY
  · 90+ days before event: booking deposit forfeited
  · 30–89 days before event: 50% of total value forfeited
  · Less than 30 days: 100% of total value due
  · Rescheduling: one-time reschedule with 60+ days notice,
    subject to availability, $150 rebooking fee

DRESS RENTAL TERMS
  · Client is responsible for dress during rental period
  · Dress must be returned by the agreed return date
  · Normal cleaning fee included in rental price
  · Damage beyond normal wear: billed at replacement cost
  · Lost dress: client liable for full replacement cost ($[replacementCost])

ALTERATION TERMS
  · Quoted price is an estimate; final price confirmed after
    measurements are taken
  · Additional work requested after initial quote billed separately
  · Client must attend all scheduled fitting appointments

DECORATION TERMS
  · Reserved items subject to inventory availability at time of booking
  · Client responsible for any items damaged during event
  · All items must remain on venue premises until pickup by our staff
  · Setup times are estimates and may vary

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIGNATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I have read and agree to all terms and conditions above.

Client signature:    _______________________  Date: ________

Print name:         _______________________

Boutique representative: _______________  Date: ________

Bella Bridal & Events · belori.app/book/bella-bridal
Contract #BB-2026-0047
```

### Contract number format
```typescript
// BB = boutique initials (first 2 letters of boutique name)
// 2026 = year
// 0047 = sequential counter per boutique per year
async function generateContractNumber(boutiqueId: string): Promise<string> {
  const boutique = await getBoutiqueById(boutiqueId)
  const initials = boutique.name
    .split(' ')
    .filter(w => w.length > 2) // skip "and", "the", "&"
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  const year = new Date().getFullYear()

  const count = await db.query.events.findMany({
    where: and(
      eq(events.boutiqueId, boutiqueId),
      gte(events.createdAt, new Date(`${year}-01-01`))
    )
  })

  const seq = String(count.length + 1).padStart(4, '0')
  return `${initials}-${year}-${seq}` // "BB-2026-0047"
}
```

### PDF generation — React PDF

```typescript
// lib/contract/generateEventContract.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { EventContractPDF } from './EventContractPDF'

export async function generateEventContract(data: ContractData): Promise<Buffer> {
  const contractNumber = await generateContractNumber(data.boutique.id)

  const pdfBuffer = await renderToBuffer(
    <EventContractPDF
      contractNumber={contractNumber}
      date={new Date()}
      boutique={data.boutique}
      client={data.client}
      event={data.event}
      milestones={data.milestones}
      services={data.services}
      venuePlan={data.venuePlan}
      inspiration={data.inspiration}
      alterationData={data.alterationData}
      dressData={data.dressData}
    />
  )

  return pdfBuffer
}
```

```typescript
// lib/contract/EventContractPDF.tsx
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

Font.register({ family: 'Playfair', src: '/fonts/PlayfairDisplay-Regular.ttf' })
Font.register({ family: 'Inter', src: '/fonts/Inter-Regular.ttf' })
Font.register({ family: 'Inter-Bold', src: '/fonts/Inter-Bold.ttf', fontWeight: 700 })

const styles = StyleSheet.create({
  page:        { padding: 40, fontFamily: 'Inter', fontSize: 10, color: '#1C1012' },
  header:      { marginBottom: 24, borderBottom: '2px solid #C9697A', paddingBottom: 12 },
  boutiqueName:{ fontFamily: 'Playfair', fontSize: 18, color: '#C9697A' },
  title:       { fontFamily: 'Playfair', fontSize: 14, textAlign: 'center', marginVertical: 12 },
  sectionHead: { backgroundColor: '#1C1012', color: 'white', padding: '6 10', fontSize: 9,
                  fontFamily: 'Inter-Bold', letterSpacing: 1, marginTop: 16, marginBottom: 6 },
  row:         { flexDirection: 'row', marginBottom: 4 },
  label:       { width: 130, color: '#6B7280', fontSize: 9 },
  value:       { flex: 1, fontSize: 10 },
  divider:     { borderBottom: '0.5px solid #E5E7EB', marginVertical: 8 },
  milestoneRow:{ flexDirection: 'row', marginBottom: 3 },
  bullet:      { color: '#C9697A', marginRight: 6 },
  terms:       { fontSize: 8.5, color: '#374151', lineHeight: 1.5, marginBottom: 6 },
  sigLine:     { borderBottom: '0.5px solid #1C1012', width: 200, marginTop: 20 },
  sigLabel:    { fontSize: 8, color: '#9CA3AF', marginTop: 3 },
  contractNum: { fontSize: 8, color: '#9CA3AF', textAlign: 'center', marginTop: 20 },
  colorSwatch: { width: 12, height: 12, borderRadius: 6, marginRight: 4 },
})

export function EventContractPDF({ contractNumber, date, boutique, client, event,
  milestones, services, venuePlan, inspiration, alterationData, dressData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.boutiqueName}>{boutique.name}</Text>
          <Text style={{ fontSize: 8, color: '#9CA3AF', marginTop: 2 }}>
            {boutique.address}  ·  {boutique.phone}  ·  {boutique.email}
          </Text>
        </View>
        <Text style={styles.title}>EVENT SERVICE AGREEMENT</Text>

        {/* Contract meta */}
        <View style={styles.row}>
          <Text style={styles.label}>Contract #</Text>
          <Text style={styles.value}>{contractNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{formatDate(date)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Coordinator</Text>
          <Text style={styles.value}>{event.coordinatorName}</Text>
        </View>

        {/* Client info */}
        <Text style={styles.sectionHead}>CLIENT INFORMATION</Text>
        <View style={styles.row}><Text style={styles.label}>Client name</Text><Text style={styles.value}>{client.name}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{client.phone}</Text></View>
        {client.email && <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{client.email}</Text></View>}

        {/* Event details */}
        <Text style={styles.sectionHead}>EVENT DETAILS</Text>
        <View style={styles.row}><Text style={styles.label}>Event</Text><Text style={styles.value}>{event.name}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Date</Text><Text style={styles.value}>{formatEventDate(event.eventDate)}</Text></View>
        {event.venue && <View style={styles.row}><Text style={styles.label}>Venue</Text><Text style={styles.value}>{event.venue}</Text></View>}
        {event.guestCount && <View style={styles.row}><Text style={styles.label}>Guest count</Text><Text style={styles.value}>Approximately {event.guestCount} guests</Text></View>}

        {/* Services — rendered per included service */}
        <Text style={styles.sectionHead}>SERVICES CONTRACTED</Text>
        {services.includes('dress_rental') && dressData && (
          <DressRentalSection dress={dressData} styles={styles} />
        )}
        {services.includes('alterations') && alterationData && (
          <AlterationsSection data={alterationData} styles={styles} />
        )}
        {services.includes('planning') && (
          <PlanningSection coordinator={event.coordinatorName} styles={styles} />
        )}
        {services.includes('decoration') && venuePlan && (
          <DecorationSection venuePlan={venuePlan} styles={styles} />
        )}

        {/* Inspiration */}
        {inspiration && (inspiration.colors?.length > 0 || inspiration.notes) && (
          <>
            <Text style={styles.sectionHead}>INSPIRATION & VISION</Text>
            {inspiration.colors?.length > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Event colors</Text>
                <Text style={styles.value}>{inspiration.colors.map(c => c.label).join(' · ')}</Text>
              </View>
            )}
            {inspiration.styles?.length > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Style</Text>
                <Text style={styles.value}>{inspiration.styles.join(', ')}</Text>
              </View>
            )}
            {inspiration.notes && (
              <View style={styles.row}>
                <Text style={styles.label}>Client notes</Text>
                <Text style={styles.value}>"{inspiration.notes}"</Text>
              </View>
            )}
          </>
        )}

        {/* Payment schedule */}
        <Text style={styles.sectionHead}>PAYMENT SCHEDULE</Text>
        <View style={{ ...styles.row, marginBottom: 8 }}>
          <Text style={styles.label}>Total value</Text>
          <Text style={{ ...styles.value, fontFamily: 'Inter-Bold' }}>{formatCents(event.totalValue)}</Text>
        </View>
        {milestones.map((m, i) => (
          <View key={i} style={styles.milestoneRow}>
            <Text style={styles.bullet}>·</Text>
            <Text style={{ ...styles.label, width: 160 }}>{m.label} ({pct(m.amountCents, event.totalValue)}%)</Text>
            <Text style={{ width: 80, fontFamily: 'Inter-Bold' }}>{formatCents(m.amountCents)}</Text>
            <Text style={{ color: '#6B7280', fontSize: 9 }}>Due {formatDate(m.dueDate)}</Text>
          </View>
        ))}
        <View style={{ ...styles.row, marginTop: 6 }}>
          <Text style={{ fontSize: 8, color: '#6B7280' }}>
            Accepted payment methods: Cash, Zelle, Credit card
            {boutique.lateFeePolicy && `  ·  Late fee: ${boutique.lateFeePolicy}`}
          </Text>
        </View>

        {/* Terms */}
        <Text style={styles.sectionHead}>TERMS & CONDITIONS</Text>
        <TermsSection boutique={boutique} services={services} styles={styles} />

        {/* Signatures */}
        <Text style={styles.sectionHead}>SIGNATURES</Text>
        <Text style={{ fontSize: 9, color: '#374151', marginBottom: 12 }}>
          I have read and agree to all terms and conditions above.
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <View>
            <View style={styles.sigLine}/>
            <Text style={styles.sigLabel}>Client signature</Text>
            <View style={{ ...styles.sigLine, marginTop: 16 }}/>
            <Text style={styles.sigLabel}>Print name</Text>
            <View style={{ ...styles.sigLine, marginTop: 16 }}/>
            <Text style={styles.sigLabel}>Date</Text>
          </View>
          <View>
            <View style={styles.sigLine}/>
            <Text style={styles.sigLabel}>Boutique representative</Text>
            <View style={{ ...styles.sigLine, marginTop: 16 }}/>
            <Text style={styles.sigLabel}>Date</Text>
          </View>
        </View>

        <Text style={styles.contractNum}>{boutique.name}  ·  {boutique.website || `belori.app/book/${boutique.slug}`}  ·  Contract #{contractNumber}</Text>
      </Page>
    </Document>
  )
}
```

---

## Contract Storage & Access

```typescript
// Contracts stored in Supabase Storage:
// boutique/{boutiqueId}/contracts/{eventId}/{contractNumber}.pdf

export async function storeContract(pdfBuffer: Buffer, eventId: string, boutiqueId: string): Promise<string> {
  const contractNumber = await getEventContractNumber(eventId)
  const path = `${boutiqueId}/contracts/${eventId}/${contractNumber}.pdf`

  const { error } = await supabase.storage
    .from('contracts')
    .upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (error) throw error

  // Create signed URL (permanent — contracts don't expire)
  const { data } = await supabase.storage
    .from('contracts')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10) // 10 years

  return data.signedUrl
}
```

**Contract access points:**
- Event detail page → right panel → "Contract" card → "Download PDF" button
- Event detail page → right panel → "Contract" card → "Send to client" button (re-sends email)
- Client detail page → event row → "View contract" link
- Settings → Event history → contract download per event

**Re-generating a contract:**
If the event is edited (price changes, service added/removed), a "Regenerate contract" button appears on the event detail with a warning: "This will create a new version of the contract. The client will need to re-sign."

---

## Database Schema Additions

New columns added to `events` table to support Step 2 data:

```typescript
// New columns on events table:
inspirationColors:    jsonb('inspiration_colors').default([]),
// [{ hex: '#B76E79', label: 'Rose' }, { hex: '#D4AF7A', label: 'Gold' }]

inspirationStyles:    text('inspiration_styles').array().default([]),
// ['romantic', 'elegant']

inspirationNotes:     text('inspiration_notes'),
inspirationPhotoUrls: text('inspiration_photo_urls').array().default([]),

quincetheme:          text('quince_theme'),
quinceWaltzSong:      text('quince_waltz_song'),
quinceCortSizeDamas:  integer('quince_cort_size_damas'),
quinceCortSizeChamb:  integer('quince_cort_size_chambelanes'),

venuePlan:            jsonb('venue_plan').default({}),
// { tablesProvided: false, tableCount: 20, chairsProvided: true, ... }

contractUrl:          text('contract_url'),
contractNumber:       text('contract_number'),
contractGeneratedAt:  timestamp('contract_generated_at'),
contractSignedAt:     timestamp('contract_signed_at'),
contractSignedBy:     text('contract_signed_by'),
```

---

## Auto-generated Venue Tasks

In addition to the service-based tasks from v1, Step 4 generates venue-specific tasks:

```typescript
export function generateVenueTasks(venuePlan: VenuePlan, eventName: string): Task[] {
  const tasks: Task[] = []

  if (venuePlan.tableclothsProvided === 'boutique') {
    tasks.push({ text: `Prepare ${venuePlan.tableclothsCount} tablecloths for ${eventName}`, category: 'Deco', isAlert: false })
  }
  if (venuePlan.chairCoversProvided === 'boutique') {
    tasks.push({ text: `Prepare ${venuePlan.chairCoversCount} chair covers for ${eventName}`, category: 'Deco', isAlert: false })
    tasks.push({ text: `Prepare ${venuePlan.chairSashesCount} chair sashes for ${eventName}`, category: 'Deco', isAlert: false })
  }
  if (venuePlan.chairsProvided === 'boutique') {
    tasks.push({ text: `Arrange delivery of ${venuePlan.chairsCount} chairs to ${venuePlan.venue}`, category: 'Deco', isAlert: true })
  }
  if (venuePlan.hasShortage) {
    for (const shortage of venuePlan.shortages) {
      tasks.push({
        text: `Source ${shortage.shortBy} additional ${shortage.itemName} — inventory shortage`,
        category: 'Deco', isAlert: true
      })
    }
  }
  tasks.push({ text: `Confirm all decoration items loaded for ${eventName} (day before)`, category: 'Deco', isAlert: false })

  return tasks
}
```

---

## Inspiration Board (Event Detail)

After creation, the event detail page shows an "Inspiration" section (between the hero and services grid):

```
┌──────────────────────────────────────────────────────────────┐
│  INSPIRATION                                                 │
│                                                              │
│  Colors:   ● Rose  ● Gold  ● Ivory                          │
│  Style:    Romantic · Elegant / classic                      │
│  Notes:    "Wants peonies if possible. No carnations."       │
│                                                              │
│  [Photo 1]  [Photo 2]  [Photo 3]  [Photo 4]  [+ Add more]  │
└──────────────────────────────────────────────────────────────┘
```

- Color swatches shown as small filled circles with label below
- Style chips shown as gray badges
- Photos in a horizontal scrollable row (4-per-row desktop, 2 mobile)
- "Add more" button opens photo upload directly
- Entire section is collapsible if staff wants a cleaner event view

---

## npm Packages Required

```bash
# Contract PDF generation
npm install @react-pdf/renderer

# Image handling (for inspiration photo uploads)
npm install sharp          # resize before storage
npm install browser-image-compression  # client-side compression before upload

# Color picker
npm install react-colorful  # lightweight color picker component
```

---

## Validation Rules — Updated

| Field | Rule | Error |
|-------|------|-------|
| Client | Required | "Please select or create a client" |
| Event name | Required, max 80 chars | "Event name is required" |
| Event date | Required, not in past | "Please select a future date" |
| Event type | Required (auto-selected) | — |
| Colors | Optional, max 6 | — |
| Inspiration photos | Optional, max 12 | "Maximum 12 photos" |
| Inspiration photos | Max 10MB each | "Each photo must be under 10MB" |
| Services | Minimum 1 | "Select at least one service" |
| Total value | Required, >0 | "Please enter the contract amount" |
| Milestones | Sum = total value | "Milestones don't add up to total" |
| Milestone dates | All ≤ event date | "Due date must be before the event" |
| Dress | Available if reserving | "This dress is not available" |
| Inventory reservation | Quantity ≤ available | "Only X units available on [date]" |
| Table count (Step 4) | Required if decoration | "Please enter the number of tables" |
| Chair count (Step 4) | Required if chair covers selected | "Please enter the number of chairs" |

---

## Component Structure — Updated

```
components/events/
├── CreateEventModal.tsx            # Modal wrapper, 5-step state machine
├── steps/
│   ├── Step1ClientEvent.tsx        # Client + basics (unchanged)
│   ├── Step2Inspiration.tsx        # Colors, styles, photos, notes ← NEW
│   ├── Step3Services.tsx           # Services + packages + dress/alt
│   ├── Step4VenueInventory.tsx     # Venue Q&A + inventory calculator ← NEW
│   └── Step5Review.tsx             # Review summary + contract options ← UPDATED
├── inspiration/
│   ├── ColorPaletteBuilder.tsx     # Color swatches + preset selector
│   ├── StyleSelector.tsx           # Multi-select style chips
│   ├── InspirationPhotoUpload.tsx  # Photo upload grid
│   └── InspirationBoard.tsx        # Display on event detail ← NEW
├── venue/
│   ├── VenueInventoryForm.tsx      # Full Step 4 form
│   ├── LinenCalculator.tsx         # Auto-calculation logic + summary
│   ├── InventoryAvailability.tsx   # Live availability check component
│   └── InventorySummaryPanel.tsx   # Running total panel at bottom
├── contract/
│   ├── ContractPreview.tsx         # Read-only contract preview in modal
│   ├── ContractCard.tsx            # Event detail right panel card
│   └── ContractDownloadButton.tsx  # Download / resend buttons
└── [existing form-parts unchanged]
```
