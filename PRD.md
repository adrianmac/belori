# PRD.md — Belori Product Requirements Document

> **App name:** Belori
> **Tagline:** "Every celebration, beautifully managed."
> **Spanish variant:** "Tu celebración, perfectamente organizada."
> **Domain:** belori.app | Booking: belori.app/book/[slug]
> **Version:** 2.0 | March 2026

---

## 1. Problem Statement

Bridal boutiques that serve weddings and quinceañeras run on a tangle of disconnected tools — spreadsheets for inventory, WhatsApp for clients, paper binders for alteration notes, Square for payments, and a calendar app for appointments. Nothing talks to each other. The owner has no single place to see what is overdue, what is missing, and what needs attention before an event.

The result: missed fittings, forgotten deposits, dresses double-booked, unhappy families, and a stressed owner who cannot scale past what she can hold in her head.

---

## 2. Target Customer

**Primary persona:** Isabel M., owner of Bella Bridal & Events, McAllen TX
- Spanish-speaking boutique owner in a mid-size US border city
- 5–15 staff, 50–150 events per year
- Serves both weddings and quinceañeras, often bundled
- Offers: dress rental + alterations + event planning + decoration
- Primary floor device: iPad (768px portrait)

**Secondary:** Any bridal boutique (1–3 locations) that offers dress rental alongside event services.

**Not building for:** Large multi-location chains, pure dress retail (no rentals), non-bridal event companies.

---

## 3. Core Services Managed

| Service | Description |
|---|---|
| Dress rental | Inventory of bridal and quinceañera gowns. Reservation → pickup → return → cleaning cycle. |
| Alterations | Seamstress job queue. Measurements → in progress → fittings → complete. |
| Event planning | Run-of-show, vendor coordination, timeline, staffing. |
| Decoration | Setup logistics, style packages, vendor coordination. |

Services are sold individually or bundled. Each event may have 1–4 services attached.

---

## 4. Event Types

| Type | Color | Notes |
|---|---|---|
| Wedding | Rosa #C9697A | Higher average value, more services |
| Quinceañera | Purple #7C3AED | Strong in border markets, family-coordinated |

Both types share the same data model, workflow, and screens. Type is a badge, not a separate module.

---

## 5. Core Features — MVP

### 5.1 Dashboard
- Alert banner: surfaces the single most critical issue (event ≤7 days + unresolved blocking item)
- Stat cards: revenue this month, active events, dresses rented, total overdue payments
- Today's appointments: time, client name, service description, staff, appointment type badge
- Upcoming events: next 5–10 sorted by date, service tags, payment status, countdown badge
- Payments due this week: overdue in red, pending in amber, one-tap remind
- Quick actions: new rental, log return, send reviews, create package
- Staff utilization bars for today

### 5.2 Event Management
- Create and edit events: client, venue, guest count, date, event type
- Attach 1–4 services per event
- Event detail page:
  - Hero: client name, venue, coordinator, days until, payment totals + progress bar
  - Blocking issues banner (red) when critical items exist
  - Service cards (one per attached service showing status and quick action)
  - Appointment timeline (vertical, chronological, color-coded by status)
  - Tasks checklist (interactive, toggleable)
  - Staff notes feed (timestamped, author-attributed)
  - Payment milestones sidebar
  - Dress rental card
  - Alteration job card
  - Client info card
- Public booking page at belori.app/book/[boutiqueSlug]

### 5.3 Dress Rental Inventory
- Catalog with: SKU, name, category (bridal/quinceañera), size, color, rental price, deposit amount, photos
- Status lifecycle: available → reserved → picked_up → returned → cleaning → available
- Double-booking conflict detection (overlapping dates blocked)
- Return date tracking with overdue alerts
- Dress record linked to event and client
- Filter by: status, category, size, color
- Per-dress action button changes based on current status

### 5.4 Alterations Queue
- Job creation linked to event + specific garment
- Work items (multi-select): hem, bustle, waist take-in, waist let-out, custom beading, strap adjustment, zipper, custom
- Status lifecycle: measurement_needed → in_progress → fitting_scheduled → complete
- Kanban board view (4 columns) with toggle to list/table view
- Urgency color-coding based on event date proximity
- Seamstress assignment per job
- Price per job

### 5.5 Appointment Scheduling
- Appointment types: consultation, try_on, measurement, venue_walkthrough, fitting_1, fitting_2, final_fitting, pickup, wedding_day, return
- Required types detected per attached service (see Business Logic)
- Staff assignment per appointment
- Status: scheduled, done, missing, cancelled
- Missing appointment flagged with red highlight on timeline

### 5.6 Payment Milestones
- 2–4 milestones per event (booking deposit, mid-point, balance, service deposits)
- Status: pending → overdue → paid
- Progress bar showing % collected
- Overdue = today > due_date and status != paid
- One-tap Send Reminder (SMS + email)
- One-tap Mark Paid

### 5.7 Client Management
- Profile: name, phone, email, emergency contact, referral source, language preference
- Event history with lifetime value
- Bilingual communication toggle (English/Spanish)

### 5.8 Automations
| Automation | Trigger | Channel |
|---|---|---|
| 24h appointment reminder | 24h before appointment | SMS |
| 2h appointment reminder | 2h before appointment | SMS |
| Payment due reminder | 3 days before due date | SMS + Email |
| Overdue payment alert | 1, 7, 14 days after due date | SMS + Email |
| Dress return reminder | 48h before return date | SMS |
| Post-event review request | 24h after event date | SMS (5-star gated) |
| Win-back campaign | 60+ days no activity | SMS |
| Weekly event digest | Every Monday 8am | Email to owner |

### 5.9 Settings
- Boutique profile: name, address, phone, Instagram, email, booking slug
- Staff: invite, roles (owner/coordinator/seamstress/front_desk/decorator), permissions
- Automation on/off toggles per automation type
- Package builder: bundle services at a discount
- Subscription management

---

## 6. Business Logic

### 6.1 Urgency Engine
```
CRITICAL = event.daysUntil <= 7
           AND (has overdue payment OR has missing required appointment)

NEAR     = event.daysUntil <= 14

NORMAL   = event.daysUntil > 14
```

### 6.2 Countdown Badge Colors
```
> 30 days   → gray
14–30 days  → amber
7–14 days   → dark amber
< 7 days    → red
= today     → red + pulse animation
past        → dark red "Overdue"
```

### 6.3 Dress Conflict Detection
```
A dress cannot be reserved if:
  ANY existing active reservation overlaps where:
    existing.pickup_date <= requested.return_date
    AND existing.return_date >= requested.pickup_date
    AND existing.status IN [reserved, picked_up]

Show conflict warning with the client name and dates of the conflict.
```

### 6.4 Payment Overdue Escalation
```
Day 0  (due date passed, unpaid) → status = overdue, amber flag on dashboard
Day 1  → auto SMS to client: "Your payment of $X for [event] is past due"
Day 7  → SMS + Email to client, push alert to owner
Day 14 → SMS + Email + event promoted to CRITICAL urgency
```

### 6.5 Missing Appointment Detection
```
Required appointments by service:
  dress_rental:  [try_on, pickup, return]
  alterations:   [measurement, final_fitting]
  planning:      [consultation, venue_walkthrough]
  decoration:    [venue_walkthrough]

Mark as MISSING if:
  required appointment type not found in event.appointments
  AND event.date - today < warning_threshold

Warning thresholds:
  final_fitting → 7 days before event
  pickup        → 2 days before event
  measurement   → 21 days before event
  consultation  → 30 days before event
```

### 6.6 5-Star Review Gate
```
After event date + 24h:
  IF client.last_rating >= 4 OR client.last_rating IS NULL:
    send SMS with public review link (Google / Yelp)
  ELSE:
    send SMS with private feedback form link
    do NOT send public review link
```

### 6.7 Dress Status State Machine
```
available
  → reserved      (when reservation created)
    → picked_up   (staff marks pickup done)
      → returned  (staff logs dress return)
        → cleaning (cleaning intake logged)
          → available (marked cleaned and inspected)
    → available   (if reservation cancelled)
```

### 6.8 Alteration Job State Machine
```
measurement_needed
  → in_progress       (measurements taken, work started)
    → fitting_scheduled (1st or 2nd fitting booked)
      → in_progress   (additional work after fitting)
      → complete      (final fitting passed, no more work needed)
```

### 6.9 Alert Banner Priority
```
Show at most ONE alert banner on dashboard. Priority order:
  1. Event ≤ 3 days + CRITICAL (missing final fitting or overdue payment)
  2. Event ≤ 7 days + CRITICAL
  3. Event ≤ 7 days + any overdue payment
  4. Event ≤ 14 days + missing required appointment
```

---

## 7. Pricing Tiers

| Tier | Price | Events/mo | Staff seats | SMS/mo |
|---|---|---|---|---|
| Starter | $49/mo | Up to 10 | 2 | 100 |
| Growth | $99/mo | Up to 30 | 5 | 500 |
| Pro | $199/mo | Unlimited | Unlimited | 2,000 |

---

## 8. Non-Functional Requirements

- **Touchscreen-first:** 48×48px minimum tap targets; 52px buttons and inputs; no hover-only states
- **Tablet layout:** full sidebar on desktop (>1024px), icon rail on tablet (768–1024px), bottom nav on mobile (<768px)
- **Bilingual:** all client-facing text (SMS, booking page, confirmations) supports English/Spanish
- **Performance:** dashboard loads in under 2 seconds on LTE
- **SMS sender:** "Belori | [Boutique Name]" via Twilio
- **Font:** inputs must be 16px minimum to prevent iOS auto-zoom

---

## 9. Success Metrics (6-month targets)

- Owner saves 2+ hours per week on admin tasks
- Zero missed deposit reminders for any paying boutique
- Zero double-booked dresses
- Review request open rate above 60%
- $10,000 MRR (approximately 100 boutiques on Growth plan)
