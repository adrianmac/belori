# WEDDING_PLANNER.md — Belori Wedding Planning Module

> **For Claude Code:** This file specifies the complete wedding planning module for the Belori Vite + React SPA.
> Read CLAUDE.md first for stack context, auth patterns, and styling rules.
> All components use inline styles (no Tailwind). All queries scope by boutiqueId via useBoutique().

---

## What to build

A full wedding planning module linked to an existing Belori event record.
When an event is created with type = 'wedding' or 'quinceanera', a planning
workbook is auto-initialized for that event. Staff and clients (via the client
portal module) can access it from the event detail page.

The module covers 11 sections derived from a real wedding planning workbook:
planning checklist, budget, guest list, vendors, day-of overview, run of show,
seating chart, music planning, alcohol calculator, legal checklist, gift tracker.

---

## Entry point

Add a "Wedding planner" button to the event detail page for wedding/quinceanera events:

```jsx
// In EventDetailPage or wherever event actions live
{(event.eventType === 'wedding' || event.eventType === 'quinceanera') && (
  <button onClick={() => navigate(`/events/${event.id}/planner`)}>
    💍 Open wedding planner
  </button>
)}
```

Route: `/events/[eventId]/planner`

---

## Database schema

### `wedding_plans` (one per event)

```sql
CREATE TABLE wedding_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id       uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  event_id          uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,

  -- Basic info
  partner_1_name    text,
  partner_2_name    text,
  wedding_motto     text,
  nuclear_option    text,

  -- Budget
  total_budget      integer DEFAULT 0,  -- cents
  guest_count       integer DEFAULT 0,
  venue_budget_pct  numeric DEFAULT 0.45,

  -- Priorities (jsonb arrays)
  partner_1_priorities  jsonb DEFAULT '[]',
  partner_2_priorities  jsonb DEFAULT '[]',
  partner_1_not_important jsonb DEFAULT '[]',
  partner_2_not_important jsonb DEFAULT '[]',

  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE wedding_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_wedding_plans" ON wedding_plans
  FOR ALL USING (is_boutique_member(boutique_id));
```

### `wedding_checklist_items`

```sql
CREATE TABLE wedding_checklist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id   uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id       uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,
  phase         text NOT NULL,
  -- '12_months' | '11_10_months' | '9_8_months' | '6_5_months'
  -- '3_2_months' | 'month_of' | 'week_of'
  task          text NOT NULL,
  done          boolean DEFAULT false,
  done_at       timestamptz,
  done_by_name  text,
  due_date      date,
  assigned_to   text,
  sort_order    integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE wedding_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_checklist" ON wedding_checklist_items
  FOR ALL USING (is_boutique_member(boutique_id));
```

### `wedding_budget_items`

```sql
CREATE TABLE wedding_budget_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id     uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,
  category        text NOT NULL,
  -- 'paper_signage' | 'venue_ceremony' | 'food_service' | 'beverage'
  -- 'photography' | 'music_entertainment' | 'florals_decor'
  -- 'attire' | 'transportation' | 'honeymoon' | 'other'
  item_name       text NOT NULL,
  budgeted_cents  integer DEFAULT 0,
  vendor_est_cents integer DEFAULT 0,
  actualized_cents integer DEFAULT 0,
  vendor_name     text,
  vendor_contact  text,
  deposit_cents   integer DEFAULT 0,
  payment_due     text,
  contract_url    text,
  notes           text,
  stage           text DEFAULT 'pending',
  -- 'pending' | 'quoted' | 'deposit_paid' | 'paid_in_full'
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE wedding_budget_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_budget" ON wedding_budget_items
  FOR ALL USING (is_boutique_member(boutique_id));
```

### `wedding_guests`

```sql
CREATE TABLE wedding_guests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id     uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text,
  -- 'partner_1_family' | 'partner_2_family' | 'partner_1_friends'
  -- 'partner_2_friends' | 'couple_friends' | 'other'
  address         text,
  rsvp_status     text DEFAULT 'waiting',
  -- 'yes' | 'no' | 'waiting'
  quantity        integer DEFAULT 1,
  tier            text DEFAULT 'nice',
  -- 'must' | 'nice' | 'b_list'
  table_number    text,
  meal_choice     text,
  dietary_prefs   text,
  accommodations  text,
  shuttle         boolean DEFAULT false,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE wedding_guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_guests" ON wedding_guests
  FOR ALL USING (is_boutique_member(boutique_id));
```

### `wedding_vendors`

```sql
CREATE TABLE wedding_vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id     uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,
  vendor_type     text NOT NULL,
  -- 'venue' | 'caterer' | 'photographer' | 'videographer' | 'dj' | 'band'
  -- 'florist' | 'hair_makeup' | 'transportation' | 'officiant'
  -- 'coordinator' | 'other'
  company_name    text,
  contact_name    text,
  phone           text,
  email           text,
  website         text,
  stage           text DEFAULT 'sourcing',
  -- 'sourcing' | 'inquiry_sent' | 'call_scheduled' | 'quote_received'
  -- 'deposit_paid' | 'signed' | 'booked' | 'cut'
  total_cents     integer DEFAULT 0,
  deposit_cents   integer DEFAULT 0,
  deposit_due     text,
  contract_url    text,
  notes           text,
  rating          integer,   -- 1-5
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE wedding_vendor_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  vendor_id   uuid NOT NULL REFERENCES wedding_vendors(id) ON DELETE CASCADE,
  question    text NOT NULL,
  answer      text,
  asked_at    timestamptz,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE wedding_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_vendors" ON wedding_vendors
  FOR ALL USING (is_boutique_member(boutique_id));

ALTER TABLE wedding_vendor_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_vendor_questions" ON wedding_vendor_questions
  FOR ALL USING (is_boutique_member(boutique_id));
```

### `wedding_run_of_show`

```sql
CREATE TABLE wedding_run_of_show (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id         uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id             uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,
  phase               text NOT NULL,
  -- 'morning' | 'ceremony' | 'cocktail' | 'reception' | 'end_of_night'
  scheduled_time      time,
  action              text NOT NULL,
  details             text,
  coordinator_notes   text,
  photographer_notes  text,
  dj_notes            text,
  vendor_notes        text,
  sort_order          integer DEFAULT 0
);

ALTER TABLE wedding_run_of_show ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_ros" ON wedding_run_of_show
  FOR ALL USING (is_boutique_member(boutique_id));
```

### `wedding_music`

```sql
CREATE TABLE wedding_music (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id     uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,
  type        text NOT NULL,
  -- 'special_moment' | 'must_have' | 'would_like' | 'do_not_play' | 'dinner'
  moment_key  text,
  -- for special_moment: 'processional' | 'bridal_processional' | 'recessional'
  -- 'entrance' | 'first_dance' | 'father_daughter' | 'mother_son'
  -- 'party_starter' | 'bouquet_toss' | 'cake_cutting' | 'last_song'
  song_title  text,
  artist      text,
  notes       text,
  sort_order  integer DEFAULT 0
);

ALTER TABLE wedding_music ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_music" ON wedding_music
  FOR ALL USING (is_boutique_member(boutique_id));
```

### `wedding_gifts`

```sql
CREATE TABLE wedding_gifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id     uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,
  guest_name      text NOT NULL,
  gift_type       text,
  -- 'check' | 'cash' | 'registry' | 'other'
  item_description text,
  category        text,
  amount_cents    integer DEFAULT 0,
  received_date   date,
  thank_you_sent  boolean DEFAULT false,
  thank_you_sent_at timestamptz,
  address         text,
  phone           text,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE wedding_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_gifts" ON wedding_gifts
  FOR ALL USING (is_boutique_member(boutique_id));
```

### `wedding_legal_items`

```sql
CREATE TABLE wedding_legal_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id     uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,
  phase       text NOT NULL,
  -- 'pre_wedding' | 'name_change'
  task        text NOT NULL,
  type        text,
  location    text,
  cost        text,
  notes       text,
  done        boolean DEFAULT false,
  done_at     timestamptz,
  sort_order  integer DEFAULT 0
);

ALTER TABLE wedding_legal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_legal" ON wedding_legal_items
  FOR ALL USING (is_boutique_member(boutique_id));
```

---

## Seeding default data

When a `wedding_plans` row is created, immediately seed these defaults:

### Default checklist tasks by phase

```javascript
// src/lib/weddingDefaults.js

export const DEFAULT_CHECKLIST = [
  // 12 months
  { phase: '12_months', task: 'Choose wedding motto', sort_order: 1 },
  { phase: '12_months', task: 'Engagement party planning', sort_order: 2 },
  { phase: '12_months', task: 'Establish a budget', sort_order: 3 },
  { phase: '12_months', task: 'First pass at guest list', sort_order: 4 },
  { phase: '12_months', task: 'Choose a time of year', sort_order: 5 },
  { phase: '12_months', task: 'Choose a date', sort_order: 6 },
  { phase: '12_months', task: 'Choose a vibe / aesthetic', sort_order: 7 },
  { phase: '12_months', task: 'Choose a venue', sort_order: 8 },
  { phase: '12_months', task: 'Choose a caterer', sort_order: 9 },
  { phase: '12_months', task: 'Insure the engagement ring', sort_order: 10 },

  // 11-10 months
  { phase: '11_10_months', task: 'Finalize design vision', sort_order: 1 },
  { phase: '11_10_months', task: 'Book DJ', sort_order: 2 },
  { phase: '11_10_months', task: 'Book photographer', sort_order: 3 },
  { phase: '11_10_months', task: 'Book band', sort_order: 4 },
  { phase: '11_10_months', task: 'Book videographer', sort_order: 5 },
  { phase: '11_10_months', task: 'Book florist', sort_order: 6 },
  { phase: '11_10_months', task: 'Book caterer / bartenders', sort_order: 7 },
  { phase: '11_10_months', task: 'Interview coordinators', sort_order: 8 },
  { phase: '11_10_months', task: 'Begin collecting addresses', sort_order: 9 },
  { phase: '11_10_months', task: 'Set up hotel room block', sort_order: 10 },
  { phase: '11_10_months', task: 'Dress shopping', sort_order: 11 },
  { phase: '11_10_months', task: 'Take engagement photos', sort_order: 12 },

  // 9-8 months
  { phase: '9_8_months', task: 'Buy wedding dress', sort_order: 1 },
  { phase: '9_8_months', task: 'Schedule alterations', sort_order: 2 },
  { phase: '9_8_months', task: 'Send save the dates', sort_order: 3 },
  { phase: '9_8_months', task: 'Book / confirm officiant', sort_order: 4 },
  { phase: '9_8_months', task: 'Schedule hair & makeup trials', sort_order: 5 },
  { phase: '9_8_months', task: 'Create registry', sort_order: 6 },
  { phase: '9_8_months', task: 'Begin selecting wedding party outfits', sort_order: 7 },
  { phase: '9_8_months', task: 'Book rehearsal dinner space', sort_order: 8 },
  { phase: '9_8_months', task: 'Hire ceremony musicians', sort_order: 9 },

  // 6-5 months
  { phase: '6_5_months', task: 'Schedule time together (not planning)', sort_order: 1 },
  { phase: '6_5_months', task: 'Finalize decor plan', sort_order: 2 },
  { phase: '6_5_months', task: 'Finalize lighting plan', sort_order: 3 },
  { phase: '6_5_months', task: 'Begin premarital counseling', sort_order: 4 },
  { phase: '6_5_months', task: 'Make DIY plan', sort_order: 5 },
  { phase: '6_5_months', task: 'Take dance lessons', sort_order: 6 },
  { phase: '6_5_months', task: 'Book transportation for guests', sort_order: 7 },
  { phase: '6_5_months', task: 'Book honeymoon', sort_order: 8 },

  // 3-2 months
  { phase: '3_2_months', task: 'Plan food options', sort_order: 1 },
  { phase: '3_2_months', task: 'Begin drafting vows', sort_order: 2 },
  { phase: '3_2_months', task: 'Select readings', sort_order: 3 },
  { phase: '3_2_months', task: 'Send out invites', sort_order: 4 },
  { phase: '3_2_months', task: 'Create rain / crisis plan', sort_order: 5 },
  { phase: '3_2_months', task: 'Get crafty (DIY items)', sort_order: 6 },
  { phase: '3_2_months', task: 'Shot list with photographer', sort_order: 7 },
  { phase: '3_2_months', task: 'Finalize day-of schedule', sort_order: 8 },
  { phase: '3_2_months', task: 'Marriage license (per state guidelines)', sort_order: 9 },
  { phase: '3_2_months', task: 'Wedding party gifts', sort_order: 10 },
  { phase: '3_2_months', task: 'Bridal shower / bachelorette', sort_order: 11 },
  { phase: '3_2_months', task: 'RSVP deadline — 6 weeks before', sort_order: 12 },
  { phase: '3_2_months', task: 'Select wedding undies', sort_order: 13 },

  // Month of
  { phase: 'month_of', task: 'Pay vendors in full', sort_order: 1 },
  { phase: 'month_of', task: 'Create seating chart and signage', sort_order: 2 },
  { phase: 'month_of', task: 'Create escort cards', sort_order: 3 },
  { phase: 'month_of', task: 'Final venue walkthrough', sort_order: 4 },
  { phase: 'month_of', task: 'Put together vendor tips', sort_order: 5 },
  { phase: 'month_of', task: 'Chase down remaining RSVPs', sort_order: 6 },
  { phase: 'month_of', task: 'Get final numbers to vendors', sort_order: 7 },
  { phase: 'month_of', task: 'Collect memorial table photos', sort_order: 8 },
  { phase: 'month_of', task: 'Make playlists (getting ready, transport, cocktail, reception)', sort_order: 9 },
  { phase: 'month_of', task: 'Finalize ceremony with officiant', sort_order: 10 },
  { phase: 'month_of', task: 'Amazon last-minute purchases', sort_order: 11 },
  { phase: 'month_of', task: 'Confirm all vendor arrival times', sort_order: 12 },

  // Week of
  { phase: 'week_of', task: 'Nail appointment', sort_order: 1 },
  { phase: 'week_of', task: 'Rest and self-care (R&R)', sort_order: 2 },
  { phase: 'week_of', task: 'Dress fitting', sort_order: 3 },
  { phase: 'week_of', task: 'Pack for honeymoon', sort_order: 4 },
  { phase: 'week_of', task: 'Ring cleaning', sort_order: 5 },
  { phase: 'week_of', task: 'Practice vows', sort_order: 6 },
  { phase: 'week_of', task: 'Write notes to each other', sort_order: 7 },
  { phase: 'week_of', task: 'Assemble bathroom baskets and finalize decor', sort_order: 8 },
  { phase: 'week_of', task: 'Break in wedding shoes', sort_order: 9 },
]

export const DEFAULT_BUDGET_CATEGORIES = [
  { category: 'paper_signage',        label: 'Paper & Signage',         default_pct: 0.03 },
  { category: 'venue_ceremony',       label: 'Venue & Ceremony',        default_pct: 0.15 },
  { category: 'food_service',         label: 'Food / Service',          default_pct: 0.18 },
  { category: 'beverage',             label: 'Beverage',                default_pct: 0.10 },
  { category: 'photography',          label: 'Photography / Video',     default_pct: 0.10 },
  { category: 'music_entertainment',  label: 'Music / Entertainment',   default_pct: 0.08 },
  { category: 'florals_decor',        label: 'Florals & Decor',         default_pct: 0.08 },
  { category: 'attire',               label: 'Attire',                  default_pct: 0.08 },
  { category: 'transportation',       label: 'Transportation',          default_pct: 0.05 },
  { category: 'honeymoon',            label: 'Honeymoon',               default_pct: 0.08 },
  { category: 'other',                label: 'Other',                   default_pct: 0.07 },
]

export const DEFAULT_BUDGET_ITEMS = [
  // Paper & Signage
  { category: 'paper_signage', item_name: 'Invitations', sort_order: 1 },
  { category: 'paper_signage', item_name: 'Save the Dates', sort_order: 2 },
  { category: 'paper_signage', item_name: 'Escort Cards', sort_order: 3 },
  { category: 'paper_signage', item_name: 'Thank You Cards', sort_order: 4 },
  { category: 'paper_signage', item_name: 'Postage', sort_order: 5 },
  { category: 'paper_signage', item_name: 'Signage', sort_order: 6 },

  // Venue & Ceremony
  { category: 'venue_ceremony', item_name: 'Venue rental fee', sort_order: 1 },
  { category: 'venue_ceremony', item_name: 'Ceremony fees', sort_order: 2 },
  { category: 'venue_ceremony', item_name: 'Setup / breakdown fees', sort_order: 3 },

  // Food / Service
  { category: 'food_service', item_name: 'Caterer', sort_order: 1 },
  { category: 'food_service', item_name: 'Cake / Dessert table', sort_order: 2 },
  { category: 'food_service', item_name: 'Late night snacks', sort_order: 3 },

  // Beverage
  { category: 'beverage', item_name: 'Bar service', sort_order: 1 },
  { category: 'beverage', item_name: 'Toast / champagne', sort_order: 2 },

  // Photography
  { category: 'photography', item_name: 'Photographer', sort_order: 1 },
  { category: 'photography', item_name: 'Videographer', sort_order: 2 },
  { category: 'photography', item_name: 'Photo booth / props', sort_order: 3 },
  { category: 'photography', item_name: 'Wedding album', sort_order: 4 },

  // Music / Entertainment
  { category: 'music_entertainment', item_name: 'Band / DJ', sort_order: 1 },
  { category: 'music_entertainment', item_name: 'Ceremony musicians', sort_order: 2 },

  // Florals / Decor
  { category: 'florals_decor', item_name: 'Bridal bouquet', sort_order: 1 },
  { category: 'florals_decor', item_name: 'Ceremony florals', sort_order: 2 },
  { category: 'florals_decor', item_name: 'Reception centerpieces', sort_order: 3 },
  { category: 'florals_decor', item_name: 'Boutonnières', sort_order: 4 },
  { category: 'florals_decor', item_name: 'Uplighting', sort_order: 5 },

  // Attire
  { category: 'attire', item_name: 'Wedding dress / alterations', sort_order: 1 },
  { category: 'attire', item_name: 'Groom / partner attire', sort_order: 2 },
  { category: 'attire', item_name: 'Bridesmaid dresses', sort_order: 3 },
  { category: 'attire', item_name: 'Groomsmen attire', sort_order: 4 },
  { category: 'attire', item_name: 'Wedding bands', sort_order: 5 },

  // Transportation
  { category: 'transportation', item_name: 'Guest transportation / shuttles', sort_order: 1 },
  { category: 'transportation', item_name: 'Bride & Groom getaway car', sort_order: 2 },
]

export const DEFAULT_RUN_OF_SHOW = [
  // Morning
  { phase: 'morning', action: 'Getting ready — Partner 1', sort_order: 1 },
  { phase: 'morning', action: 'Getting ready — Partner 2', sort_order: 2 },
  { phase: 'morning', action: 'Photographer arrives', sort_order: 3 },
  { phase: 'morning', action: 'Hair & makeup finalizes', sort_order: 4 },
  { phase: 'morning', action: 'Wedding party photos', sort_order: 5 },
  { phase: 'morning', action: 'Guests begin arriving', sort_order: 6 },
  { phase: 'morning', action: 'Guests seated', sort_order: 7 },

  // Ceremony
  { phase: 'ceremony', action: 'Processions', sort_order: 1 },
  { phase: 'ceremony', action: 'Ceremony begins', sort_order: 2 },
  { phase: 'ceremony', action: 'Ceremony ends', sort_order: 3 },
  { phase: 'ceremony', action: 'Recessional', sort_order: 4 },

  // Cocktail
  { phase: 'cocktail', action: 'Cocktail hour begins', sort_order: 1 },
  { phase: 'cocktail', action: 'Couple portraits', sort_order: 2 },
  { phase: 'cocktail', action: 'Transition to reception', sort_order: 3 },

  // Reception
  { phase: 'reception', action: 'Grand entrance', sort_order: 1 },
  { phase: 'reception', action: 'First dance', sort_order: 2 },
  { phase: 'reception', action: 'Dinner service begins', sort_order: 3 },
  { phase: 'reception', action: 'Toasts', sort_order: 4 },
  { phase: 'reception', action: 'Dancing opens', sort_order: 5 },
  { phase: 'reception', action: 'Cake cutting', sort_order: 6 },
  { phase: 'reception', action: 'Bouquet toss', sort_order: 7 },

  // End of night
  { phase: 'end_of_night', action: 'Last call', sort_order: 1 },
  { phase: 'end_of_night', action: 'Final song', sort_order: 2 },
  { phase: 'end_of_night', action: 'Transportation departs', sort_order: 3 },
  { phase: 'end_of_night', action: 'After party (if applicable)', sort_order: 4 },
]

export const DEFAULT_MUSIC_MOMENTS = [
  { type: 'special_moment', moment_key: 'processional',        song_title: '', artist: '' },
  { type: 'special_moment', moment_key: 'bridal_processional', song_title: '', artist: '' },
  { type: 'special_moment', moment_key: 'recessional',         song_title: '', artist: '' },
  { type: 'special_moment', moment_key: 'entrance',            song_title: '', artist: '' },
  { type: 'special_moment', moment_key: 'first_dance',         song_title: '', artist: '' },
  { type: 'special_moment', moment_key: 'father_daughter',     song_title: '', artist: '' },
  { type: 'special_moment', moment_key: 'mother_son',          song_title: '', artist: '' },
  { type: 'special_moment', moment_key: 'party_starter',       song_title: '', artist: '' },
  { type: 'special_moment', moment_key: 'bouquet_toss',        song_title: '', artist: '' },
  { type: 'special_moment', moment_key: 'cake_cutting',        song_title: '', artist: '' },
  { type: 'special_moment', moment_key: 'last_song',           song_title: '', artist: '' },
]

export const DEFAULT_LEGAL_PRE_WEDDING = [
  { phase: 'pre_wedding', task: 'Apply for marriage license', type: 'Wedding', location: 'Local courthouse', cost: '$50–$100', notes: 'Do 30-60 days before, check expiration window', sort_order: 1 },
  { phase: 'pre_wedding', task: 'Prenuptial agreement (if applicable)', type: 'Legal', location: 'Attorney', cost: 'Varies', sort_order: 2 },
  { phase: 'pre_wedding', task: 'Update beneficiary designations', type: 'Financial', location: 'Employer / Insurance', cost: 'Free', sort_order: 3 },
  { phase: 'pre_wedding', task: 'Review joint insurance needs', type: 'Financial', location: 'Insurance provider', cost: 'Varies', sort_order: 4 },
  { phase: 'pre_wedding', task: 'Insure engagement ring', type: 'Insurance', location: 'Jewelry insurer', cost: '~$300/yr', sort_order: 5 },
]

export const DEFAULT_LEGAL_NAME_CHANGE = [
  { phase: 'name_change', task: 'Social Security card', type: 'Government', location: 'ssa.gov', cost: 'Free', notes: 'Do this FIRST — required for all others', sort_order: 1 },
  { phase: 'name_change', task: "Driver's license / State ID", type: 'Government', location: 'DMV', cost: '$10–30', notes: 'Bring SS card + certified marriage certificate', sort_order: 2 },
  { phase: 'name_change', task: 'Passport', type: 'Government', location: 'travel.state.gov', cost: '$130+', notes: '6–8 week processing, expedite for $60 more', sort_order: 3 },
  { phase: 'name_change', task: 'Bank accounts', type: 'Financial', location: 'Your bank branch', cost: 'Free', sort_order: 4 },
  { phase: 'name_change', task: 'Credit cards', type: 'Financial', location: 'Call each card', cost: 'Free', sort_order: 5 },
  { phase: 'name_change', task: 'Employer / payroll / HR', type: 'Work', location: 'HR department', cost: 'Free', sort_order: 6 },
  { phase: 'name_change', task: 'Voter registration', type: 'Government', location: 'vote.gov', cost: 'Free', sort_order: 7 },
  { phase: 'name_change', task: 'Insurance policies (auto, health, life)', type: 'Insurance', location: 'Your agent', cost: 'Free', sort_order: 8 },
  { phase: 'name_change', task: 'Utilities', type: 'Utilities', location: 'Call each provider', cost: 'Free', sort_order: 9 },
  { phase: 'name_change', task: 'Post office / USPS mail forwarding', type: 'Mail', location: 'usps.com', cost: 'Free', sort_order: 10 },
  { phase: 'name_change', task: 'Update will / estate documents', type: 'Legal', location: 'Attorney', cost: 'Varies', sort_order: 11 },
]
```

---

## File structure

```
src/
  screens/
    WeddingPlannerScreen.jsx          # Main container with sidebar + section routing
  components/wedding/
    WeddingOverview.jsx               # Dashboard summary
    WeddingChecklist.jsx              # Phased checklist
    WeddingBudget.jsx                 # Budget tracker + calculator
    WeddingGuests.jsx                 # Guest list + RSVP + catering preferences
    WeddingVendors.jsx                # Vendor tracker + contracts + Q&A
    WeddingDayOf.jsx                  # Day-of info + contact sheet + weekend schedule
    WeddingRunOfShow.jsx              # Minute-by-minute timeline
    WeddingSeating.jsx                # Seating chart
    WeddingMusic.jsx                  # Music planning + special moments
    WeddingAlcohol.jsx                # Alcohol quantity calculator
    WeddingLegal.jsx                  # Legal + name change checklist
    WeddingGifts.jsx                  # Gift tracker + thank you status
  hooks/
    useWeddingPlan.js                 # Fetch + cache the plan for current event
  lib/
    weddingDefaults.js                # DEFAULT_CHECKLIST, DEFAULT_BUDGET_ITEMS, etc.
    weddingCalculators.js             # Budget calc, alcohol calc, guest budget calc
```

---

## WeddingPlannerScreen.jsx — top-level structure

```jsx
// src/screens/WeddingPlannerScreen.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useBoutique } from '../hooks/useBoutique'
import { useWeddingPlan } from '../hooks/useWeddingPlan'

// Import all section components
import WeddingOverview from '../components/wedding/WeddingOverview'
// ... etc

const SECTIONS = [
  { id: 'overview',    label: 'Overview',          icon: '📊', group: 'Planning' },
  { id: 'checklist',   label: 'Planning checklist', icon: '✅', group: 'Planning' },
  { id: 'budget',      label: 'Budget',             icon: '💰', group: 'Planning' },
  { id: 'guests',      label: 'Guest list',         icon: '👥', group: 'Planning' },
  { id: 'vendors',     label: 'Vendors',            icon: '🤝', group: 'Planning' },
  { id: 'dayof',       label: 'Day-of overview',    icon: '📅', group: 'Day of' },
  { id: 'runofshow',   label: 'Run of show',        icon: '📋', group: 'Day of' },
  { id: 'seating',     label: 'Seating chart',      icon: '🪑', group: 'Day of' },
  { id: 'music',       label: 'Music planning',     icon: '🎵', group: 'Details' },
  { id: 'alcohol',     label: 'Alcohol calculator', icon: '🍾', group: 'Details' },
  { id: 'legal',       label: 'Legal checklist',    icon: '📜', group: 'Details' },
  { id: 'gifts',       label: 'Gift tracker',       icon: '🎁', group: 'Details' },
]

export default function WeddingPlannerScreen({ eventId }) {
  const { boutiqueId } = useBoutique()
  const { plan, loading, refetch } = useWeddingPlan(eventId, boutiqueId)
  const [activeSection, setActiveSection] = useState('overview')

  // Auto-create plan if it doesn't exist yet
  useEffect(() => {
    if (!loading && !plan && eventId) {
      createWeddingPlan(eventId, boutiqueId).then(refetch)
    }
  }, [loading, plan, eventId, boutiqueId])

  if (loading) return <LoadingSpinner />

  const SECTION_COMPONENTS = {
    overview:   <WeddingOverview plan={plan} eventId={eventId} onUpdate={refetch} />,
    checklist:  <WeddingChecklist planId={plan?.id} boutiqueId={boutiqueId} />,
    budget:     <WeddingBudget planId={plan?.id} boutiqueId={boutiqueId} plan={plan} />,
    guests:     <WeddingGuests planId={plan?.id} boutiqueId={boutiqueId} plan={plan} />,
    vendors:    <WeddingVendors planId={plan?.id} boutiqueId={boutiqueId} />,
    dayof:      <WeddingDayOf plan={plan} eventId={eventId} />,
    runofshow:  <WeddingRunOfShow planId={plan?.id} boutiqueId={boutiqueId} />,
    seating:    <WeddingSeating planId={plan?.id} boutiqueId={boutiqueId} />,
    music:      <WeddingMusic planId={plan?.id} boutiqueId={boutiqueId} />,
    alcohol:    <WeddingAlcohol plan={plan} />,
    legal:      <WeddingLegal planId={plan?.id} boutiqueId={boutiqueId} />,
    gifts:      <WeddingGifts planId={plan?.id} boutiqueId={boutiqueId} />,
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' }}>
      {/* Sidebar */}
      <WeddingPlannerSidebar
        plan={plan}
        sections={SECTIONS}
        active={activeSection}
        onSelect={setActiveSection}
      />
      {/* Main content */}
      <div style={{ padding: '20px', background: '#F0EDE9', overflow: 'auto' }}>
        {SECTION_COMPONENTS[activeSection]}
      </div>
    </div>
  )
}
```

---

## useWeddingPlan hook

```javascript
// src/hooks/useWeddingPlan.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useWeddingPlan(eventId, boutiqueId) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetch() {
    if (!eventId || !boutiqueId) return
    const { data } = await supabase
      .from('wedding_plans')
      .select('*')
      .eq('event_id', eventId)
      .eq('boutique_id', boutiqueId)
      .single()
    setPlan(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [eventId, boutiqueId])
  return { plan, loading, refetch: fetch }
}
```

---

## createWeddingPlan — auto-seed on first open

```javascript
// src/lib/weddingSetup.js
import { supabase } from './supabase'
import {
  DEFAULT_CHECKLIST,
  DEFAULT_BUDGET_ITEMS,
  DEFAULT_RUN_OF_SHOW,
  DEFAULT_MUSIC_MOMENTS,
  DEFAULT_LEGAL_PRE_WEDDING,
  DEFAULT_LEGAL_NAME_CHANGE,
} from './weddingDefaults'

export async function createWeddingPlan(eventId, boutiqueId) {
  // 1. Fetch event to get partner names
  const { data: event } = await supabase
    .from('events')
    .select('name, client_id, clients(name)')
    .eq('id', eventId)
    .single()

  // 2. Create plan
  const { data: plan, error } = await supabase
    .from('wedding_plans')
    .insert({
      boutique_id: boutiqueId,
      event_id: eventId,
      partner_1_name: event?.clients?.name || '',
      wedding_motto: '',
      total_budget: 0,
      guest_count: 100,
    })
    .select()
    .single()

  if (error || !plan) return null

  const planId = plan.id

  // 3. Seed checklist
  await supabase.from('wedding_checklist_items').insert(
    DEFAULT_CHECKLIST.map(item => ({ ...item, plan_id: planId, boutique_id: boutiqueId }))
  )

  // 4. Seed budget items
  await supabase.from('wedding_budget_items').insert(
    DEFAULT_BUDGET_ITEMS.map(item => ({ ...item, plan_id: planId, boutique_id: boutiqueId }))
  )

  // 5. Seed run of show
  await supabase.from('wedding_run_of_show').insert(
    DEFAULT_RUN_OF_SHOW.map(item => ({ ...item, plan_id: planId, boutique_id: boutiqueId }))
  )

  // 6. Seed music special moments
  await supabase.from('wedding_music').insert(
    DEFAULT_MUSIC_MOMENTS.map(item => ({ ...item, plan_id: planId, boutique_id: boutiqueId }))
  )

  // 7. Seed legal items
  await supabase.from('wedding_legal_items').insert(
    [...DEFAULT_LEGAL_PRE_WEDDING, ...DEFAULT_LEGAL_NAME_CHANGE]
      .map(item => ({ ...item, plan_id: planId, boutique_id: boutiqueId }))
  )

  return plan
}
```

---

## Section component specs

### WeddingChecklist.jsx

Data: `wedding_checklist_items` WHERE `plan_id = planId`

Group items by `phase`. Display phases in order:
`12_months → 11_10_months → 9_8_months → 6_5_months → 3_2_months → month_of → week_of`

Phase display labels:
```javascript
const PHASE_LABELS = {
  '12_months':     '12 Months Out',
  '11_10_months':  '11–10 Months Out',
  '9_8_months':    '9–8 Months Out',
  '6_5_months':    '6–5 Months Out',
  '3_2_months':    '3–2 Months Out',
  'month_of':      'Month Of',
  'week_of':       'Week Of',
}
```

Display in a 2-column grid. Each phase is a white card with:
- Phase label + completion badge (X / Y done)
- List of tasks as clickable checkboxes
- On toggle: update `done`, `done_at`, `done_by_name` in DB

On toggle:
```javascript
async function toggleTask(item) {
  const now = new Date().toISOString()
  await supabase
    .from('wedding_checklist_items')
    .update({
      done: !item.done,
      done_at: !item.done ? now : null,
    })
    .eq('id', item.id)
}
```

Add task: "+ Add task" per phase, opens inline text input.

---

### WeddingBudget.jsx

Two sections:

**1. Budget calculator card** (top)
- Inputs: total budget, venue %, guest count
- Outputs: available for F&B, max cost per plate
- Formula: `maxPerPlate = (totalBudget * (1 - venuePct)) / guestCount`
- Update `wedding_plans` on input change (debounced 800ms)

**2. Budget table**
- Fetch `wedding_budget_items` WHERE `plan_id = planId`
- Group by `category`, show category totals row
- Columns: Item | Budgeted | Vendor Est | Actualized | Remaining | Vendor | Stage
- Remaining = budgeted - actualized, shown red if negative
- Click any row to expand an inline edit form
- "+Add item" button per category

**Summary bar** at top:
- Total budget | Committed (sum of actualized_cents > 0) | Remaining | % used
- Update `wedding_plans.total_budget` when user edits total

---

### WeddingGuests.jsx

Four stat cells: total invited, RSVP yes, waiting, no

Two tabs: **Guest list** | **Catering / dietary**

Guest list tab:
- Filter by category, RSVP status
- Add guest button → inline form: name, category, quantity, tier (Must/Nice/B-list), address
- Each row: avatar initials, name, tier badge, category, RSVP badge, quantity, edit/delete

Catering tab:
- Only shows guests with rsvp_status = 'yes'
- Columns: Guest name | Table # | Meal choice | Dietary preference | Notes
- Inline editable cells
- Meal choices: Chicken, Steak, Fish, Veggie, Vegan (editable list)
- Dietary: Vegan, Vegetarian, Halal, Kosher, Gluten Free, Lactose Free, Low Sodium

Budget calculator sub-card:
- Uses plan.total_budget, plan.guest_count, plan.venue_budget_pct
- Shows: Max per plate, ideal total budget based on $150/plate assumption

---

### WeddingVendors.jsx

Four sub-tabs: All | Contracts & payments | Q&A log | Venue comparison

**All vendors tab:**
- Fetch `wedding_vendors` WHERE `plan_id = planId`
- One card per vendor: icon, type, name, contact, stage badge, total/deposit
- Stage color coding: sourcing=gray, inquiry=amber, booked=green, signed=purple, cut=red
- "+ Add vendor" button → modal with all fields

**Contracts & payments tab:**
- Table: Vendor | Company | Total due | Deposit paid | Remaining | Due date | Contract

**Q&A log tab:**
- Grouped by vendor
- Add question per vendor: question text → answer field → date asked
- Status: answered (green) / pending (amber)

**Venue comparison tab:**
- Comparison table: Venue name | Type | Capacity | Cost | F&B min | Lodging | Rating | Status

---

### WeddingRunOfShow.jsx

Fetch `wedding_run_of_show` WHERE `plan_id = planId`, ordered by phase then sort_order.

Two-panel layout: **Morning schedule** | **Reception timeline**

Morning = phases: `morning`
Reception = phases: `ceremony`, `cocktail`, `reception`, `end_of_night`

Each item row:
- Time field (input type="time", editable)
- Action text (editable on click)
- Details text (smaller, editable)
- Coordinator / photographer / DJ notes (expandable)
- Drag handle for reordering (update sort_order)

"+ Add item" button per phase section.

Export button → renders print-friendly version of full ROS.

---

### WeddingSeating.jsx

Guest data from `wedding_guests`. Tables are free-text labels on each guest.

Three views:
1. **Table view** — cards per table, guests listed inside. Drag-and-drop guests between tables.
2. **Guest view** — alphabetical list with table assignment, search by name.
3. **Unassigned** — guests with no table_number.

Table list is derived from unique `table_number` values across all guests.

Special tables: "Sweetheart Table", "King's Table 1", "King's Table 2" pre-populated.

"+Add table" — creates a virtual table (no DB table needed, just a new table_number string).

Update table assignment: `supabase.from('wedding_guests').update({ table_number: newTable }).eq('id', guestId)`

---

### WeddingMusic.jsx

Three sections:

**1. Special moments** (from `wedding_music` WHERE type='special_moment')
- One row per moment_key (11 total from DEFAULT_MUSIC_MOMENTS)
- Label | Song title input | Artist input | Notes
- Moment key display labels:
  ```javascript
  const MOMENT_LABELS = {
    processional:        'Ceremony entrance',
    bridal_processional: 'Bridal processional',
    recessional:         'Recessional',
    entrance:            'Grand entrance (reception)',
    first_dance:         'First dance',
    father_daughter:     'Father-daughter',
    mother_son:          'Mother-son',
    party_starter:       'Party starter',
    bouquet_toss:        'Bouquet toss',
    cake_cutting:        'Cake cutting',
    last_song:           'Last song of the night',
  }
  ```

**2. Must-haves / Would like** (type='must_have' or 'would_like')
- Two columns, max 15 each
- Each: artist - song title
- Progress indicator: "6 of 15 filled"

**3. Do not play** (type='do_not_play')
- List with remove button
- "+ Add" button at top

All changes: upsert to `wedding_music` on blur.

---

### WeddingAlcohol.jsx

Pure client-side calculator — no DB table needed. State-only.

Inputs (state):
- totalGuests (from plan.guest_count, editable)
- receptionHours (default 6)
- winePct (default 0.5)
- beerPct (default 0.3)
- liquorPct (default 0.2)

Derived:
```javascript
const drinksPerHourTable = { 1:2, 2:3, 3:4, 4:6, 5:7, 6:8, 7:10, 8:11, 9:12 }
const drinksPerPerson = drinksPerHourTable[receptionHours] || 8
const totalDrinks = totalGuests * drinksPerPerson
const wineServings = totalDrinks * winePct
const beerServings = totalDrinks * beerPct
const liquorServings = totalDrinks * liquorPct

// Bottles
const whiteWineBottles = Math.ceil(wineServings * 0.5 / 4)   // 4 servings/750ml
const redWineBottles   = Math.ceil(wineServings * 0.5 / 4)
const beerSixPacks     = Math.ceil(beerServings * 0.6 / 6)
const beerCases        = Math.ceil(beerServings * 0.4 / 12)
const vodkaHandles     = Math.ceil(liquorServings * 0.25 / 24)
const ginHandles       = Math.ceil(liquorServings * 0.2 / 24)
const tequilaBottles   = Math.ceil(liquorServings * 0.25 / 12)
const whiskeyBottles   = Math.ceil(liquorServings * 0.3 / 12)
const toastBottles     = Math.ceil(totalGuests / 8)           // magnum 1.5L = 8 servings
```

Display:
- Input controls card (left)
- Results table card (right): type, ABV, bottle size, servings/bottle, bottles needed

---

### WeddingLegal.jsx

Two sections: **Pre-wedding** | **Name change**

Fetch `wedding_legal_items` WHERE `plan_id = planId`.
Group by `phase`, sort by `sort_order`.

Each item: checkbox, task name, type/location/cost metadata, notes.
Toggle done: `update({ done: !item.done, done_at: now })`

"+ Add task" per section for custom items.

---

### WeddingGifts.jsx

4 stat cells: total gifts, cash received (sum of amount_cents WHERE type='check' or 'cash'), thank you sent count, thank you pending count.

Table columns: Guest | Type | Item | Category | Received date | Thank you sent | Address

"Mark sent" button: `update({ thank_you_sent: true, thank_you_sent_at: now })`

Filter by: Thank you pending | Cash only | Registry only

"+ Add gift" → modal: guest name, gift type, description, category, amount (if cash), received date.

---

### WeddingOverview.jsx

Dashboard pulling from all sub-tables. Show:

1. **Countdown** — days until event.date
2. **Stats strip** (4 cells): Days to go, Budget used, RSVPs confirmed, Vendors pending
3. **Priorities card** — partner_1_priorities, partner_2_priorities from plan, wedding_motto, nuclear_option (all editable inline)
4. **Next tasks** — first 5 uncompleted items from checklist (ordered by phase then sort_order)
5. **Budget snapshot** — category totals as horizontal bar chart (CSS, not a chart library)
6. **Vendor status** — quick list of all vendors with stage badge

---

### WeddingDayOf.jsx

Pulls from: plan (basic info) + event record + vendors + guests (for contacts).

Layout two columns:

**Left:**
- Key info card: wedding date, venue address, hotel, sunrise/sunset (calculate based on date), guest count, ceremony/cocktail/reception times
- Party people card: wedding party roles + vendor contacts list (phone numbers)

**Right:**
- Weekend schedule (derived from run_of_show or editable standalone)
- Morning schedule: 15-minute block grid showing what each group is doing (partner 1 / partner 2 / bridal party / coordinator / photographer)

---

## Styling rules

Follow CLAUDE.md strictly:
- Inline styles throughout, matching NovelApp.jsx
- Brand colors: rosa #C9697A, ink #1C1012, ivory #F8F4F0, canvas #F0EDE9
- Card style: white bg, 1px border #E5E7EB, border-radius 12px, box-shadow 0 1px 4px rgba(0,0,0,.06)
- Button primary: background #C9697A, white text, border-radius 8px, box-shadow 0 2px 8px rgba(201,105,122,0.35)
- Active nav: background #FDF5F6, left border 3px #C9697A, text #C9697A
- Status badges: pill shape (border-radius 99px), color-coded per status type
- Progress bars: height 6px, background #E5E7EB track, gradient #C9697A → #D4AF37 fill
- Dense but readable — staff use this on desktop, so pack information efficiently

---

## Mutations pattern for this module

Since there is no server, all writes go directly through supabase-js.
Always scope by boutique_id AND plan_id for defence in depth.

```javascript
// Example: toggle checklist item
async function toggleChecklistItem(item, boutiqueId) {
  const { boutiqueId: ctxId } = useBoutique() // always from context
  const { error } = await supabase
    .from('wedding_checklist_items')
    .update({
      done: !item.done,
      done_at: !item.done ? new Date().toISOString() : null,
    })
    .eq('id', item.id)
    .eq('plan_id', item.plan_id)
    .eq('boutique_id', ctxId)   // always scope — defence in depth
  if (error) console.error('Toggle failed:', error)
}
```

---

## Module registration

Add to `src/lib/moduleRegistry.js`:

```javascript
{
  id: 'wedding_planner',
  name: 'Wedding planner',
  category: 'services',
  plan: 'all',
  defaultEnabled: true,
  isCore: false,
  dependencies: ['events', 'clients'],
  features: [
    '12-phase planning checklist',
    'Budget tracker with category breakdown',
    'Guest list with RSVP and catering preferences',
    'Vendor sourcing, contracts, and Q&A log',
    'Run of show and day-of timeline',
    'Seating chart with drag-and-drop',
    'Music planning and special moments',
    'Alcohol quantity calculator',
    'Legal and name change checklist',
    'Gift tracker with thank-you status',
  ],
  description: 'Complete wedding planning workbook attached to any wedding or quinceañera event.',
}
```

Add `useModule('wedding_planner')` gate in the event detail page before showing the "Open wedding planner" button.

---

## Build order for Claude Code

Run these phases in order:

1. **Migrations** — run all 8 SQL migration files against Supabase
2. **weddingDefaults.js + weddingSetup.js** — seed data constants and createWeddingPlan()
3. **useWeddingPlan hook** — data fetching
4. **WeddingPlannerScreen + sidebar** — shell and navigation
5. **WeddingOverview** — dashboard (reads from multiple tables)
6. **WeddingChecklist** — simplest CRUD, good first feature to build
7. **WeddingBudget** — table with inline editing
8. **WeddingGuests** — list + catering tab
9. **WeddingVendors** — 4 sub-tabs
10. **WeddingRunOfShow** — editable timeline rows
11. **WeddingSeating** — table card layout
12. **WeddingMusic** — special moments + list sections
13. **WeddingAlcohol** — pure calculator, no DB
14. **WeddingLegal** — simple checklist
15. **WeddingGifts** — table with thank-you tracking
16. **WeddingDayOf** — aggregate view
17. **Wire into NovelApp.jsx** — add route and nav entry
18. **Add to moduleRegistry.js** — enable/disable via module manager

---

## APPENDIX — Hotel & accommodation tracking

> Adds to the wedding planning module. Builds as `WeddingHotels.jsx` and
> related sub-components. Add `hotels` to the SECTIONS array in WeddingPlannerScreen.jsx.

---

### Why this section exists

Wedding guests — especially family — need to book hotels. The couple negotiates
room blocks at 1–2 hotels, then family and friends must book before a cutoff date
or lose the group rate. This module tracks:

- Which hotels have room blocks (size, rate, cutoff, booking link)
- Which guests are assigned to which hotel and room
- Who has booked vs who still needs a reminder
- Shuttle runs between hotel and venue
- Check-in/check-out status day-of

---

### Database tables

#### `wedding_hotels`

```sql
CREATE TABLE wedding_hotels (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id       uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id           uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,

  hotel_name        text NOT NULL,
  hotel_brand       text,           -- 'Hilton' | 'Marriott' | 'IHG' | 'Independent' etc.
  address           text,
  distance_to_venue text,           -- freetext e.g. "0.8 miles"
  website           text,
  booking_link      text,           -- the group booking URL shared with guests

  role              text DEFAULT 'primary',
  -- 'primary' | 'secondary' | 'overflow'

  -- Rates & block
  rate_per_night_cents  integer DEFAULT 0,
  block_size            integer DEFAULT 0,  -- rooms blocked
  rooms_booked          integer DEFAULT 0,  -- confirmed bookings (updated manually or via webhook)
  block_cutoff_date     date,
  attrition_pct         numeric DEFAULT 0.80,  -- % of block must be used
  attrition_penalty_cents integer DEFAULT 0,   -- per unused room

  -- Check-in/out
  check_in_time     time DEFAULT '15:00',
  check_out_time    time DEFAULT '11:00',

  -- Amenities (boolean flags)
  has_shuttle       boolean DEFAULT false,
  has_pool          boolean DEFAULT false,
  has_breakfast     boolean DEFAULT false,
  has_after_party   boolean DEFAULT false,  -- hotel bar / event space after reception
  is_ada_accessible boolean DEFAULT true,

  -- Contract & contact
  contact_name      text,
  contact_phone     text,
  contact_email     text,
  contract_url      text,
  contract_signed   boolean DEFAULT false,
  contract_signed_at timestamptz,

  -- Perks
  complimentary_rooms_per_n integer DEFAULT 0,  -- e.g. 1 free per 10 booked
  bridal_suite_included     boolean DEFAULT false,
  notes                     text,

  rating            integer,   -- 1-5 from evaluation
  status            text DEFAULT 'active',
  -- 'evaluating' | 'active' | 'cut'
  cut_reason        text,

  sort_order        integer DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE wedding_hotels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_hotels" ON wedding_hotels
  FOR ALL USING (is_boutique_member(boutique_id));
```

#### `wedding_hotel_room_types`

```sql
CREATE TABLE wedding_hotel_room_types (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id         uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  hotel_id            uuid NOT NULL REFERENCES wedding_hotels(id) ON DELETE CASCADE,

  room_type           text NOT NULL,  -- 'Standard King' | 'Double Queen' | 'Suite' | 'ADA King'
  rate_per_night_cents integer DEFAULT 0,
  rooms_in_block      integer DEFAULT 0,
  rooms_booked        integer DEFAULT 0,
  notes               text,           -- e.g. "Breakfast included for this room type"
  sort_order          integer DEFAULT 0
);

ALTER TABLE wedding_hotel_room_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_room_types" ON wedding_hotel_room_types
  FOR ALL USING (is_boutique_member(boutique_id));
```

#### `wedding_guest_hotel_assignments`

Links a guest record to a hotel + room.

```sql
CREATE TABLE wedding_guest_hotel_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id     uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,
  guest_id        uuid REFERENCES wedding_guests(id) ON DELETE SET NULL,

  -- Denormalized guest name for guests not in the wedding_guests table yet
  guest_name      text NOT NULL,
  guest_category  text,

  hotel_id        uuid NOT NULL REFERENCES wedding_hotels(id) ON DELETE CASCADE,
  room_type_id    uuid REFERENCES wedding_hotel_room_types(id) ON DELETE SET NULL,

  room_number     text,           -- actual room number once assigned by hotel
  rooms_needed    integer DEFAULT 1,

  check_in_date   date,
  check_out_date  date,

  booking_status  text DEFAULT 'unbooked',
  -- 'unbooked' | 'pending' | 'booked' | 'checked_in' | 'checked_out' | 'cancelled'

  booked_at       timestamptz,
  checked_in_at   timestamptz,
  checked_out_at  timestamptz,

  confirmation_number text,
  needs_shuttle   boolean DEFAULT false,
  needs_ada       boolean DEFAULT false,
  special_requests text,
  notes           text,

  reminder_sent_at timestamptz,     -- last time a booking reminder was sent

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE wedding_guest_hotel_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_assignments" ON wedding_guest_hotel_assignments
  FOR ALL USING (is_boutique_member(boutique_id));
```

#### `wedding_shuttle_runs`

```sql
CREATE TABLE wedding_shuttle_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id     uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES wedding_plans(id) ON DELETE CASCADE,
  hotel_id        uuid REFERENCES wedding_hotels(id) ON DELETE SET NULL,

  direction       text NOT NULL,
  -- 'hotel_to_venue' | 'venue_to_hotel' | 'airport_to_hotel' | 'hotel_to_airport'

  departs_at      time NOT NULL,
  arrives_at      time,
  capacity        integer DEFAULT 20,

  driver_name     text,
  driver_phone    text,
  vehicle         text,           -- 'Mercedes Sprinter 20-pass'
  confirmation    text,
  is_ada_accessible boolean DEFAULT false,

  notes           text,
  sort_order      integer DEFAULT 0
);

ALTER TABLE wedding_shuttle_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_access_shuttle" ON wedding_shuttle_runs
  FOR ALL USING (is_boutique_member(boutique_id));
```

---

### File: `WeddingHotels.jsx`

Route: included in `WeddingPlannerScreen.jsx` as section `id: 'hotels'`

Six sub-views via internal tab state:

| Tab | Component | What it shows |
|-----|-----------|---------------|
| Overview | `HotelOverview` | Stats, block fill progress, alerts, key dates timeline |
| Hotels | `HotelList` | Hotel cards with block progress, rate, amenities |
| Guest assignments | `GuestAssignments` | Who is staying where, booking status, reminders |
| Room blocks | `RoomBlockDetail` | Room type breakdown per hotel, contract terms |
| Shuttle schedule | `ShuttleSchedule` | Runs table, driver contacts, guest shuttle list |
| Hotel comparison | `HotelComparison` | Comparison table for all evaluated hotels |
| Check-in tracker | `CheckInTracker` | Day-of check-in status per guest |

#### Section entry in SECTIONS array

```javascript
// Add to SECTIONS in WeddingPlannerScreen.jsx
{ id: 'hotels', label: 'Hotel booking', icon: '🏨', group: 'Planning' },
```

---

### Sub-component specs

#### HotelOverview

```
Stats strip (4 cells):
  Hotels in block | Total rooms blocked | Rooms booked | Guests unassigned

Alert banner:
  Show if any hotel has block_cutoff_date within 14 days AND rooms_booked < block_size
  Red for within 7 days, amber for 8-14 days
  "Send reminder to unbooked guests" button

Two-column layout:
  Left:
    Hotel summary cards — one per hotel, mini progress bar
    Family booking status — guest list with status badges

  Right:
    Key dates timeline — block confirmed, save the dates sent, cutoffs, check-in, check-out
    Quick actions — SMS unbooked, copy booking link, export PDF, add hotel
```

#### HotelList

```
One card per hotel (from wedding_hotels where status != 'cut'):
  Hotel icon/emoji | Name | Brand | Role badge (Primary / Secondary)
  Address | Distance | Rating stars
  Amenity row: Shuttle / Pool / Breakfast / After party (green=yes, red=no)
  Block fill progress bar: X/Y rooms booked (% filled)
  Rate per night | Block cutoff date (red if within 14 days)
  Edit button | Copy booking link button

"+ Add hotel to block" dashed button at bottom

On click hotel card → navigate to Room blocks tab filtered to that hotel
```

#### GuestAssignments

```
Stats: booked count | unbooked count

Two panels:
  Left: All guests list
    Filter: All | Booked | Unbooked | By hotel
    Each row: avatar, name, category, rooms needed, hotel assignment, status badge
    Unbooked rows: "Send reminder" button inline

  Right: Add / update booking form
    Guest select → hotel select → room type → room number → check-in/out dates
    Special requests: ADA, shuttle needed, adjacent rooms, etc.
    "Save booking" → upsert wedding_guest_hotel_assignments

Bulk action: "SMS all unbooked guests" → Inngest/Edge Function fires reminder SMS to each
```

#### RoomBlockDetail

```
One section per hotel:
  Room type breakdown cards:
    Type name | Rate | Rooms in block | Rooms booked | Progress bar

  Contract terms KV card:
    Contract signed | Attrition clause | Penalty | Complimentary rooms | Bridal suite

  "View contract PDF" button if contract_url is set
```

#### ShuttleSchedule

```
Shuttle runs table:
  Direction | Departs | Arrives | Capacity | Guests assigned | Notes
  Inline status: how many of capacity are filled

Guests needing shuttle:
  Pulled from wedding_guest_hotel_assignments WHERE needs_shuttle = true
  Shows name + assigned run + any special needs (ADA, family with kids)

Driver contact card:
  Name | Phone | Vehicle | Confirmation number | ADA accessible
  "Save to day-of contacts" button
```

#### HotelComparison

```
Full-width comparison table:
  One row per hotel (ALL hotels including cut ones — show cut reason)
  Columns: Name | Brand | Rate/night | Distance | Block | Shuttle | Pool | Breakfast |
           After party | ADA | Rating | Status

Evaluated-but-not-selected hotels shown with reduced opacity + cut reason
```

#### CheckInTracker

```
Stats: checked in | expected today | arriving tomorrow | checking out

Guest rows:
  Status dot (green=checked in, amber=expected, red=not booked)
  Name | Hotel + Room | Status | Time

"+ Log check-in" button → modal: guest, hotel, room, date/time
"Log check-out" button per row

On check-out: update checked_out_at timestamp
```

---

### Mutations

All follow CLAUDE.md pattern — boutiqueId from useBoutique(), never from props.

```javascript
// Add a hotel to the block
async function addHotel(hotelData) {
  const { boutiqueId } = useBoutique()
  await supabase.from('wedding_hotels').insert({
    ...hotelData,
    boutique_id: boutiqueId,
    plan_id: planId,
  })
}

// Update guest booking status
async function updateGuestBooking(assignmentId, updates) {
  const { boutiqueId } = useBoutique()
  await supabase
    .from('wedding_guest_hotel_assignments')
    .update(updates)
    .eq('id', assignmentId)
    .eq('boutique_id', boutiqueId)
}

// Mark guest checked in
async function checkInGuest(assignmentId) {
  const { boutiqueId } = useBoutique()
  await supabase
    .from('wedding_guest_hotel_assignments')
    .update({
      booking_status: 'checked_in',
      checked_in_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .eq('boutique_id', boutiqueId)
}

// Send booking reminder to unbooked guests
// In a Vite SPA, fire via Edge Function:
async function sendBookingReminders(planId, boutiqueId) {
  const { data: { session } } = await supabase.auth.getSession()
  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hotel-reminder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ planId, boutiqueId }),
  })
}
```

---

### Edge Function: `hotel-reminder`

```typescript
// supabase/functions/hotel-reminder/index.ts
// Sends SMS to all guests with booking_status = 'unbooked' in a given plan

import { createClient } from '@supabase/supabase-js'
import Twilio from 'twilio'

Deno.serve(async (req) => {
  const { planId, boutiqueId } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get unbooked guests with phone numbers
  const { data: unbooked } = await supabase
    .from('wedding_guest_hotel_assignments')
    .select(`
      guest_name,
      wedding_guests(name, phone),
      wedding_hotels(hotel_name, booking_link, block_cutoff_date, rate_per_night_cents),
      wedding_plans(
        partner_1_name, partner_2_name,
        boutiques(twilio_phone_number, twilio_sub_account_sid, name)
      )
    `)
    .eq('plan_id', planId)
    .eq('boutique_id', boutiqueId)
    .eq('booking_status', 'unbooked')

  if (!unbooked?.length) return Response.json({ sent: 0 })

  const boutique = unbooked[0].wedding_plans?.boutiques
  if (!boutique?.twilio_phone_number) {
    return Response.json({ error: 'Twilio not configured for this boutique' }, { status: 400 })
  }

  const twilio = new Twilio.Twilio(
    Deno.env.get('TWILIO_ACCOUNT_SID'),
    Deno.env.get('TWILIO_AUTH_TOKEN')
  )

  let sent = 0
  for (const assignment of unbooked) {
    const phone = assignment.wedding_guests?.phone
    if (!phone) continue

    const hotel = assignment.wedding_hotels
    const cutoff = hotel?.block_cutoff_date
      ? new Date(hotel.block_cutoff_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      : 'soon'
    const rate = hotel?.rate_per_night_cents
      ? `$${(hotel.rate_per_night_cents / 100).toFixed(0)}/night`
      : ''

    const msg = `Hi! You're invited to the wedding of ${unbooked[0].wedding_plans?.partner_1_name} & ${unbooked[0].wedding_plans?.partner_2_name}. Please book your hotel room by ${cutoff} to get the group rate ${rate}. Book here: ${hotel?.booking_link || 'contact the bride/groom'}. Reply STOP to opt out.`

    try {
      await twilio.messages.create({
        to: phone,
        from: boutique.twilio_phone_number,
        body: msg,
      })
      await supabase
        .from('wedding_guest_hotel_assignments')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', assignment.id)
      sent++
    } catch (err) {
      console.error(`SMS failed for ${assignment.guest_name}:`, err)
    }
  }

  return Response.json({ sent })
})
```

---

### Seeding default hotel data

When `createWeddingPlan()` runs, also seed two placeholder hotel slots:

```javascript
// Add to createWeddingPlan() in weddingSetup.js

await supabase.from('wedding_hotels').insert([
  {
    boutique_id: boutiqueId,
    plan_id: planId,
    hotel_name: 'Primary hotel (add details)',
    role: 'primary',
    block_size: 20,
    status: 'evaluating',
    sort_order: 1,
  },
])
```

---

### Module registry addition

No changes to module registry needed — hotel tracking is part of the `wedding_planner` module.
It appears as a new tab inside `WeddingPlannerScreen` automatically.

---

### Build order for this feature

Add to Phase 1 of the wedding planner build:
1. Run the 4 SQL migrations: `wedding_hotels`, `wedding_hotel_room_types`, `wedding_guest_hotel_assignments`, `wedding_shuttle_runs`
2. Create `WeddingHotels.jsx` with 7 internal tab states
3. Create sub-components: `HotelOverview`, `HotelList`, `GuestAssignments`, `RoomBlockDetail`, `ShuttleSchedule`, `HotelComparison`, `CheckInTracker`
4. Add `hotels` entry to SECTIONS in `WeddingPlannerScreen.jsx`
5. Create `supabase/functions/hotel-reminder/index.ts`
6. Deploy: `npx supabase functions deploy hotel-reminder`
