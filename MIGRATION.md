# MIGRATION.md — Converting Belori to Multi-Tenant SaaS

> **Your starting point:**
> - Next.js with both Pages Router and App Router (mixed)
> - Supabase Auth (KEEPING — no migration to Clerk)
> - Supabase Postgres with no RLS
> - Events, Clients/CRM, Dress rental, Alterations, POS already built

> **Target:** Fully multi-tenant SaaS where multiple boutiques can sign up,
> each with isolated data, modular features, and Stripe subscription billing.

---

## What stays the same

| Component | Status | Why |
|-----------|--------|-----|
| Supabase Auth | ✅ Keep | Works perfectly for multi-tenant SaaS with boutique_members table |
| Supabase Postgres | ✅ Keep | Just add RLS + boutique_id columns |
| Next.js | ✅ Keep | Finish migrating to App Router fully |
| All existing features | ✅ Keep | Events, clients, rentals, alterations, POS — untouched |
| Tailwind / shadcn | ✅ Keep | No changes needed |
| Your existing schema | ✅ Keep + extend | Add boutique_id column to each table |

## What changes

| Component | Change | Effort |
|-----------|--------|--------|
| Database schema | Add `boutiques` + `boutique_members` tables, `boutique_id` on all tables | 2–3 hrs |
| Auth flow | Add onboarding page (boutique creation), staff invite flow | 4–6 hrs |
| RLS policies | Enable RLS + add policy on every table | 3–4 hrs |
| Pages Router | Complete migration to App Router | 2–4 days |
| Every query | Add `.eq('boutique_id', boutiqueId)` scoping | Half day |
| Billing | Add Stripe subscription, /settings/billing page | 1–2 days |
| Module system | Add boutique_modules table, registry, useModule() hook | 1–2 days |
| Background jobs | Add Inngest for SMS automations and PDF generation | 2–3 days |

**Total: approximately 2–3 weeks for a solo developer.**

---

## Phase 1 — Add the boutique layer (Day 1–2)

This is the foundation. Nothing else can happen until this is in place.

### 1.1 — Create the boutiques table

```sql
-- supabase/migrations/001_add_boutiques.sql

CREATE TABLE boutiques (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  slug                  text UNIQUE NOT NULL,
  owner_id              uuid REFERENCES auth.users(id),

  -- Contact
  email                 text,
  phone                 text,
  address               text,
  city                  text,
  state                 text,
  country               text DEFAULT 'US',
  timezone              text DEFAULT 'America/Chicago',

  -- Branding
  logo_url              text,
  primary_color         text DEFAULT '#C9697A',

  -- Plan & billing
  plan_tier             text NOT NULL DEFAULT 'starter',
  stripe_customer_id    text,
  stripe_subscription_id text,
  subscription_status   text DEFAULT 'trialing',
  trial_ends_at         timestamptz,

  -- Integrations (added per phase)
  twilio_sub_account_sid text,
  twilio_phone_number    text,
  stripe_connect_account_id text,
  stripe_connect_onboarded boolean DEFAULT false,

  -- Settings
  layout_mode           text DEFAULT 'desktop',
  locale                text DEFAULT 'en-US',

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Staff ↔ boutique membership (many-to-many with role)
CREATE TABLE boutique_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id  uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'front_desk',
  -- 'owner' | 'coordinator' | 'front_desk' | 'seamstress' | 'decorator'
  invited_by   uuid REFERENCES auth.users(id),
  joined_at    timestamptz DEFAULT now(),
  UNIQUE(boutique_id, user_id)
);

-- Staff invites (pending)
CREATE TABLE boutique_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id  uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         text NOT NULL DEFAULT 'front_desk',
  token        text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid REFERENCES auth.users(id),
  expires_at   timestamptz DEFAULT now() + interval '7 days',
  accepted_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);
```

### 1.2 — Add boutique_id to all existing tables

```sql
-- supabase/migrations/002_add_boutique_id.sql

-- Add column (nullable first so migration doesn't fail on existing data)
ALTER TABLE events             ADD COLUMN boutique_id uuid REFERENCES boutiques(id);
ALTER TABLE clients            ADD COLUMN boutique_id uuid REFERENCES boutiques(id);
ALTER TABLE dress_rentals      ADD COLUMN boutique_id uuid REFERENCES boutiques(id);
ALTER TABLE alteration_jobs    ADD COLUMN boutique_id uuid REFERENCES boutiques(id);
ALTER TABLE inventory_items    ADD COLUMN boutique_id uuid REFERENCES boutiques(id);
ALTER TABLE payment_milestones ADD COLUMN boutique_id uuid REFERENCES boutiques(id);
ALTER TABLE client_interactions ADD COLUMN boutique_id uuid REFERENCES boutiques(id);
ALTER TABLE client_tasks       ADD COLUMN boutique_id uuid REFERENCES boutiques(id);
-- Add to every table in your schema

-- Create a boutique for your existing single-boutique data
INSERT INTO boutiques (id, name, slug, plan_tier)
VALUES ('YOUR-BOUTIQUE-UUID', 'Bella Bridal & Events', 'bella-bridal', 'growth');

-- Backfill all existing rows to point to your boutique
UPDATE events             SET boutique_id = 'YOUR-BOUTIQUE-UUID';
UPDATE clients            SET boutique_id = 'YOUR-BOUTIQUE-UUID';
UPDATE dress_rentals      SET boutique_id = 'YOUR-BOUTIQUE-UUID';
UPDATE alteration_jobs    SET boutique_id = 'YOUR-BOUTIQUE-UUID';
-- ... every table

-- Now make the column NOT NULL (after backfill)
ALTER TABLE events             ALTER COLUMN boutique_id SET NOT NULL;
ALTER TABLE clients            ALTER COLUMN boutique_id SET NOT NULL;
-- ... every table

-- Add your existing staff as boutique_members
INSERT INTO boutique_members (boutique_id, user_id, role)
SELECT 'YOUR-BOUTIQUE-UUID', id, 'owner'
FROM auth.users WHERE email = 'isabel@bellabridalevents.com';
```

### 1.3 — Create getBoutiqueFromUser() utility

```typescript
// lib/auth.ts

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'

export type StaffRole = 'owner' | 'coordinator' | 'front_desk' | 'seamstress' | 'decorator'

export interface BoutiqueContext {
  boutique: {
    id: string
    name: string
    slug: string
    planTier: string
    subscriptionStatus: string
    trialEndsAt: string | null
    logoUrl: string | null
    primaryColor: string
    layoutMode: string
  }
  boutiqueId: string
  role: StaffRole
  userId: string
}

// React cache() deduplicates calls within a single request
export const getBoutiqueFromUser = cache(async (): Promise<BoutiqueContext> => {
  const supabase = createServerComponentClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('UNAUTHENTICATED')
  }

  const { data: member, error } = await supabase
    .from('boutique_members')
    .select(`
      boutique_id,
      role,
      boutiques (
        id, name, slug, plan_tier, subscription_status,
        trial_ends_at, logo_url, primary_color, layout_mode
      )
    `)
    .eq('user_id', user.id)
    .single()

  if (error || !member) {
    throw new Error('NO_BOUTIQUE')
  }

  const boutique = member.boutiques as any
  return {
    boutique: {
      id: boutique.id,
      name: boutique.name,
      slug: boutique.slug,
      planTier: boutique.plan_tier,
      subscriptionStatus: boutique.subscription_status,
      trialEndsAt: boutique.trial_ends_at,
      logoUrl: boutique.logo_url,
      primaryColor: boutique.primary_color,
      layoutMode: boutique.layout_mode,
    },
    boutiqueId: member.boutique_id,
    role: member.role as StaffRole,
    userId: user.id,
  }
})

// Role check helper
export function requireRole(currentRole: StaffRole, minimumRole: StaffRole): void {
  const ROLE_RANK: Record<StaffRole, number> = {
    owner: 4, coordinator: 3, front_desk: 2, seamstress: 1, decorator: 1
  }
  if (ROLE_RANK[currentRole] < ROLE_RANK[minimumRole]) {
    throw new Error('INSUFFICIENT_ROLE')
  }
}
```

---

## Phase 2 — Auth upgrade for multi-tenancy (Day 3)

### 2.1 — Update middleware.ts

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = [
  '/login', '/signup', '/forgot-password',
  '/book',          // Public booking page
  '/portal',        // Client portal
  '/sign',          // E-signature pages
  '/api/webhooks',  // Stripe, Twilio, Clerk webhooks
  '/_next', '/favicon.ico',
]

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const isPublic = PUBLIC_ROUTES.some(route =>
    req.nextUrl.pathname.startsWith(route)
  )

  // Not logged in → login
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Logged in, not on onboarding, but has no boutique → onboarding
  if (session && !req.nextUrl.pathname.startsWith('/onboarding') && !isPublic) {
    const { count } = await supabase
      .from('boutique_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)

    if (count === 0) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### 2.2 — Create onboarding page

```typescript
// app/onboarding/page.tsx
import { OnboardingForm } from '@/components/onboarding/OnboardingForm'

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[#F0EDE9] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-md shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-medium text-[#1C1012]">Set up your boutique</h1>
          <p className="text-sm text-gray-500 mt-1">You're almost there. Tell us about your boutique.</p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  )
}

// app/onboarding/actions.ts
'use server'

import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { seedDefaultModules } from '@/lib/modules/seed'

const onboardingSchema = z.object({
  boutiqueName: z.string().min(2).max(100).trim(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).trim(),
  phone: z.string().min(10).trim(),
  city: z.string().min(2).trim(),
  state: z.string().length(2).trim(),
})

export async function createBoutique(formData: FormData) {
  const supabase = createServerActionClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('UNAUTHENTICATED')

  const data = onboardingSchema.parse({
    boutiqueName: formData.get('boutiqueName'),
    slug: formData.get('slug'),
    phone: formData.get('phone'),
    city: formData.get('city'),
    state: formData.get('state'),
  })

  // Check slug availability
  const { count } = await supabase
    .from('boutiques')
    .select('id', { count: 'exact', head: true })
    .eq('slug', data.slug)

  if (count && count > 0) {
    return { error: 'That URL slug is already taken. Try a different one.' }
  }

  // Create boutique
  const { data: boutique, error: boutiqueError } = await supabase
    .from('boutiques')
    .insert({
      name: data.boutiqueName,
      slug: data.slug,
      phone: data.phone,
      city: data.city,
      state: data.state,
      owner_id: user.id,
      plan_tier: 'starter',
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (boutiqueError || !boutique) {
    return { error: 'Something went wrong. Please try again.' }
  }

  // Add owner as boutique member
  await supabase.from('boutique_members').insert({
    boutique_id: boutique.id,
    user_id: user.id,
    role: 'owner',
  })

  // Seed default modules
  await seedDefaultModules(boutique.id)

  // Fire background onboarding job
  await fetch('/api/inngest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'boutique.created',
      data: {
        boutiqueId: boutique.id,
        ownerEmail: user.email,
        boutiqueName: boutique.name,
      }
    })
  })

  redirect('/dashboard')
}
```

---

## Phase 3 — Add Row Level Security (Day 4–5)

**This is the most critical security step.** Without RLS, any authenticated Supabase user can query any row in any table via the JavaScript client.

### 3.1 — Enable RLS and add policies

```sql
-- supabase/migrations/004_enable_rls.sql

-- ── Step 1: Enable RLS on all tables ──────────────────────────────
ALTER TABLE boutiques          ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutique_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutique_invites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE dress_rentals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE alteration_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;
-- add every table in your schema

-- ── Step 2: Create the reusable membership check function ──────────
CREATE OR REPLACE FUNCTION is_boutique_member(target_boutique_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM boutique_members
    WHERE boutique_id = target_boutique_id
      AND user_id = auth.uid()
  );
$$;

-- ── Step 3: Apply the isolation policy to every table ─────────────
-- This single pattern is repeated for every table.
-- Members can CRUD their own boutique's data. That's it.

CREATE POLICY "members_access_boutique_events" ON events
  FOR ALL USING (is_boutique_member(boutique_id));

CREATE POLICY "members_access_boutique_clients" ON clients
  FOR ALL USING (is_boutique_member(boutique_id));

CREATE POLICY "members_access_boutique_rentals" ON dress_rentals
  FOR ALL USING (is_boutique_member(boutique_id));

CREATE POLICY "members_access_boutique_alterations" ON alteration_jobs
  FOR ALL USING (is_boutique_member(boutique_id));

-- Repeat for every table with boutique_id

-- ── Step 4: Boutiques table — members can see their own boutique ───
CREATE POLICY "members_see_their_boutique" ON boutiques
  FOR SELECT USING (is_boutique_member(id));

-- Only owner can update boutique settings
CREATE POLICY "owner_updates_boutique" ON boutiques
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM boutique_members
      WHERE boutique_id = boutiques.id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- ── Step 5: boutique_members — members see their own membership ───
CREATE POLICY "view_own_boutique_members" ON boutique_members
  FOR SELECT USING (is_boutique_member(boutique_id));

-- Only owners can add/remove members
CREATE POLICY "owner_manages_members" ON boutique_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM boutique_members bm
      WHERE bm.boutique_id = boutique_members.boutique_id
        AND bm.user_id = auth.uid()
        AND bm.role = 'owner'
    )
  );

-- ── Step 6: Public access for booking page (anon key) ─────────────
CREATE POLICY "public_read_boutique_by_slug" ON boutiques
  FOR SELECT TO anon
  USING (true); -- RLS on public-facing data uses service role + manual checks
```

### 3.2 — Two Supabase clients — understand the difference

```typescript
// lib/supabase/server.ts
// For Server Components and Server Actions
// Uses the AUTHENTICATED user's session — respects RLS

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const getServerClient = () =>
  createServerComponentClient({ cookies })

export const getActionClient = () =>
  createServerActionClient({ cookies })

// lib/supabase/service.ts
// For WEBHOOKS and BACKGROUND JOBS only
// Uses the service role key — BYPASSES RLS
// Never use this in page code or server actions

import { createClient } from '@supabase/supabase-js'

export const getServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // never expose to browser
    { auth: { persistSession: false } }
  )
```

### 3.3 — Test RLS with two boutiques

```typescript
// scripts/test-rls.ts
// Run with: npx ts-node scripts/test-rls.ts

import { createClient } from '@supabase/supabase-js'

async function testRLS() {
  // Sign in as User A (boutique A)
  const clientA = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
  await clientA.auth.signInWithPassword({ email: 'userA@test.com', password: 'testpass' })

  // Attempt to read boutique B's events
  const { data, error } = await clientA.from('events').select('*')

  // data should only contain boutique A's events
  const boutiqueIds = [...new Set(data?.map(e => e.boutique_id))]
  if (boutiqueIds.length > 1) {
    console.error('❌ RLS FAILURE: User A can see multiple boutiques data!')
    process.exit(1)
  }

  console.log('✅ RLS passing: User A sees only their boutique data')
  console.log(`   Events returned: ${data?.length}, from boutique: ${boutiqueIds[0]}`)
}

testRLS()
```

---

## Phase 4 — Complete App Router migration (Day 6–9)

### 4.1 — File structure migration map

```
BEFORE                              AFTER
──────────────────────────────      ────────────────────────────────
pages/_app.tsx               →      app/layout.tsx
pages/index.tsx              →      app/page.tsx  (or redirect to /dashboard)
pages/events/index.tsx       →      app/events/page.tsx
pages/events/[id].tsx        →      app/events/[eventId]/page.tsx
pages/clients/index.tsx      →      app/clients/page.tsx
pages/inventory/index.tsx    →      app/inventory/page.tsx
pages/alterations/index.tsx  →      app/alterations/page.tsx
pages/pos/index.tsx          →      app/pos/page.tsx
pages/api/events.ts          →      app/api/events/route.ts
pages/api/webhooks/stripe.ts →      app/api/webhooks/stripe/route.ts
pages/api/auth/callback.ts   →      Keep: this is Supabase Auth callback
```

### 4.2 — Converting a page

```typescript
// BEFORE — pages/events/index.tsx
import { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = createServerSupabaseClient(ctx)
  const { data: events } = await supabase.from('events').select('*')
  return { props: { events: events ?? [] } }
}

export default function EventsPage({ events }) {
  return <div>{/* render events */}</div>
}

// ─────────────────────────────────────────────────────────────────

// AFTER — app/events/page.tsx (Server Component)
import { getBoutiqueFromUser } from '@/lib/auth'
import { getServerClient } from '@/lib/supabase/server'
import { EventsList } from '@/components/events/EventsList'

export default async function EventsPage() {
  const { boutiqueId } = await getBoutiqueFromUser()
  const supabase = getServerClient()

  const { data: events } = await supabase
    .from('events')
    .select('*, clients(name, phone), payment_milestones(*)')
    .eq('boutique_id', boutiqueId)    // explicit scope (RLS also covers this)
    .order('date', { ascending: true })

  return <EventsList events={events ?? []} />
}
```

### 4.3 — Converting an API mutation to a Server Action

```typescript
// BEFORE — pages/api/events.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  // ... create event
  res.status(200).json({ event })
}

// Client component calls: await fetch('/api/events', { method: 'POST', body: ... })

// ─────────────────────────────────────────────────────────────────

// AFTER — app/events/actions.ts (Server Action)
'use server'

import { getBoutiqueFromUser, requireRole } from '@/lib/auth'
import { getActionClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createEventSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200).trim(),
  date: z.string().datetime(),
  eventType: z.enum(['wedding', 'quinceanera']),
  guestCount: z.number().int().min(1).max(10000).optional(),
})

export async function createEvent(formData: FormData) {
  const { boutiqueId, role } = await getBoutiqueFromUser()
  requireRole(role, 'front_desk')  // at minimum front desk

  const data = createEventSchema.parse({
    clientId: formData.get('clientId'),
    name: formData.get('name'),
    date: formData.get('date'),
    eventType: formData.get('eventType'),
    guestCount: formData.get('guestCount')
      ? Number(formData.get('guestCount'))
      : undefined,
  })

  const supabase = getActionClient()
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      ...data,
      boutique_id: boutiqueId,  // always from auth, never from user input
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/events')
  return { event }
}
```

---

## Phase 5 — Stripe billing (Day 10–11)

### 5.1 — Environment variables to add

```bash
# .env.local
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...   # $49/month
STRIPE_PRICE_GROWTH=price_...    # $129/month
STRIPE_PRICE_PRO=price_...       # $299/month
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 5.2 — Billing migration

```sql
-- supabase/migrations/005_add_billing.sql
-- boutiques table already has these columns from phase 1 migration
-- This migration just confirms they exist and adds indexes

CREATE INDEX IF NOT EXISTS idx_boutiques_stripe_customer
  ON boutiques(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_boutiques_subscription
  ON boutiques(stripe_subscription_id);
```

### 5.3 — Stripe webhook handler

```typescript
// app/api/webhooks/stripe/route.ts
import Stripe from 'stripe'
import { getServiceClient } from '@/lib/supabase/service'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function getPlanFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_GROWTH) return 'growth'
  return 'starter'
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  const supabase = getServiceClient() // service role — bypasses RLS for webhooks

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription') {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const planTier = getPlanFromPriceId(sub.items.data[0].price.id)
        await supabase.from('boutiques')
          .update({
            stripe_subscription_id: sub.id,
            plan_tier: planTier,
            subscription_status: sub.status,
            trial_ends_at: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
          })
          .eq('stripe_customer_id', session.customer as string)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const planTier = getPlanFromPriceId(sub.items.data[0].price.id)
      await supabase.from('boutiques')
        .update({
          plan_tier: planTier,
          subscription_status: sub.status,
        })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('boutiques')
        .update({
          subscription_status: 'canceled',
          plan_tier: 'starter', // downgrade on cancel
        })
        .eq('stripe_subscription_id', sub.id)
      break
    }
  }

  return Response.json({ received: true })
}
```

### 5.4 — Create checkout session action

```typescript
// app/settings/billing/actions.ts
'use server'

import Stripe from 'stripe'
import { getBoutiqueFromUser, requireRole } from '@/lib/auth'
import { getActionClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function createCheckoutSession(planPriceId: string) {
  const { boutique, boutiqueId, role } = await getBoutiqueFromUser()
  requireRole(role, 'owner')

  const supabase = getActionClient()

  // Get or create Stripe customer
  let stripeCustomerId = boutique.stripeCustomerId as string | undefined

  if (!stripeCustomerId) {
    const { data: full } = await supabase
      .from('boutiques')
      .select('stripe_customer_id, email')
      .eq('id', boutiqueId)
      .single()

    if (!full?.stripe_customer_id) {
      const customer = await stripe.customers.create({
        name: boutique.name,
        email: full?.email ?? undefined,
        metadata: { boutiqueId },
      })
      await supabase.from('boutiques')
        .update({ stripe_customer_id: customer.id })
        .eq('id', boutiqueId)
      stripeCustomerId = customer.id
    } else {
      stripeCustomerId = full.stripe_customer_id
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: planPriceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    subscription_data: {
      trial_period_days: boutique.subscriptionStatus === 'trialing' ? 14 : 0,
      metadata: { boutiqueId },
    },
  })

  redirect(session.url!)
}
```

---

## Phase 6 — Module system (Day 12–13)

### 6.1 — Create boutique_modules table

```sql
-- supabase/migrations/006_boutique_modules.sql

CREATE TABLE boutique_modules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id     uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  module_id       text NOT NULL,
  enabled         boolean NOT NULL DEFAULT false,
  enabled_at      timestamptz,
  enabled_by_name text,
  disabled_at     timestamptz,
  disabled_by_name text,
  config          jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(boutique_id, module_id)
);

ALTER TABLE boutique_modules ENABLE ROW LEVEL SECURITY;

-- Members can read module state
CREATE POLICY "members_read_modules" ON boutique_modules
  FOR SELECT USING (is_boutique_member(boutique_id));

-- Only owners can toggle modules
CREATE POLICY "owner_manages_modules" ON boutique_modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM boutique_members
      WHERE boutique_id = boutique_modules.boutique_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );
```

### 6.2 — Seed default modules

```typescript
// scripts/seed-modules.ts
import { getServiceClient } from '@/lib/supabase/service'

const DEFAULT_MODULES = [
  // Core — always on
  'events', 'clients', 'staff', 'settings',
  // Default services
  'dress_rental', 'alterations', 'decoration', 'event_planning',
  // Default operations
  'pos',
]

export async function seedDefaultModules(boutiqueId: string) {
  const supabase = getServiceClient()

  const rows = DEFAULT_MODULES.map(moduleId => ({
    boutique_id: boutiqueId,
    module_id: moduleId,
    enabled: true,
    enabled_at: new Date().toISOString(),
    enabled_by_name: 'System (onboarding)',
  }))

  await supabase
    .from('boutique_modules')
    .upsert(rows, { onConflict: 'boutique_id,module_id', ignoreDuplicates: true })
}

// Seed existing boutiques (run once)
async function seedAllExistingBoutiques() {
  const supabase = getServiceClient()
  const { data: boutiques } = await supabase.from('boutiques').select('id')
  for (const b of boutiques ?? []) {
    await seedDefaultModules(b.id)
    console.log(`Seeded modules for boutique ${b.id}`)
  }
}
```

### 6.3 — Server module helpers (Supabase version)

```typescript
// lib/modules/server.ts
import { getServerClient } from '@/lib/supabase/server'
import { MODULE_REGISTRY, type ModuleId } from './registry'
import { notFound } from 'next/navigation'
import { cache } from 'react'

// Cache per request to avoid N+1 module checks
export const getEnabledModules = cache(async (boutiqueId: string): Promise<Set<ModuleId>> => {
  const supabase = getServerClient()

  const { data } = await supabase
    .from('boutique_modules')
    .select('module_id')
    .eq('boutique_id', boutiqueId)
    .eq('enabled', true)

  const coreIds = MODULE_REGISTRY
    .filter(m => m.isCore)
    .map(m => m.id as ModuleId)

  return new Set([
    ...coreIds,
    ...(data?.map(r => r.module_id as ModuleId) ?? []),
  ])
})

export async function requireModule(boutiqueId: string, moduleId: ModuleId): Promise<void> {
  const enabled = await getEnabledModules(boutiqueId)
  if (!enabled.has(moduleId)) {
    notFound() // 404 — not a redirect, to prevent info leakage
  }
}

// Usage in any page:
// await requireModule(boutiqueId, 'dress_rental')
```

---

## Phase 7 — Inngest background jobs (Day 14–16)

### 7.1 — Install and configure Inngest

```bash
npm install inngest
```

```typescript
// inngest/client.ts
import { Inngest } from 'inngest'

export const inngest = new Inngest({ id: 'belori' })

// app/api/inngest/route.ts
import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { returnReminderFn } from '@/inngest/functions/return-reminder'
import { paymentReminderFn } from '@/inngest/functions/payment-reminder'
import { onboardingFn } from '@/inngest/functions/onboarding'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [returnReminderFn, paymentReminderFn, onboardingFn],
})
```

### 7.2 — Move your existing SMS calls inside Inngest functions

If you're currently sending SMS directly in server actions, move them:

```typescript
// BEFORE — server action sends SMS directly
export async function markRentalRented(rentalId: string) {
  // ... update rental status
  await twilioClient.messages.create({
    to: client.phone,
    from: process.env.TWILIO_PHONE_NUMBER,
    body: `Your dress rental is confirmed! Return by ${returnDate}.`
  })
}

// ─────────────────────────────────────────────────────────────────

// AFTER — server action fires event, Inngest handles SMS
export async function markRentalRented(rentalId: string) {
  // ... update rental status
  await inngest.send({
    name: 'rental.status_changed',
    data: { rentalId, newStatus: 'rented', boutiqueId }
  })
  // Inngest function handles the SMS with retries
}

// inngest/functions/return-reminder.ts
export const returnReminderFn = inngest.createFunction(
  { id: 'dress-return-reminder', retries: 3 },
  { event: 'rental.status_changed' },
  async ({ event, step }) => {
    if (event.data.newStatus !== 'rented') return

    const rental = await step.run('get-rental', async () => {
      const supabase = getServiceClient()
      const { data } = await supabase
        .from('dress_rentals')
        .select('*, clients(name, phone), boutiques(twilio_phone_number, name)')
        .eq('id', event.data.rentalId)
        .single()
      return data
    })

    if (!rental) return

    // Wait until 48h before return date
    const notifyAt = new Date(rental.return_date)
    notifyAt.setHours(notifyAt.getHours() - 48)
    await step.sleepUntil('wait-48h-before', notifyAt)

    // Re-check automation settings
    const settings = await step.run('check-settings', async () => {
      const supabase = getServiceClient()
      const { data } = await supabase
        .from('automation_settings')
        .select('return_reminders')
        .eq('boutique_id', event.data.boutiqueId)
        .single()
      return data
    })

    if (!settings?.return_reminders) return { skipped: 'automation disabled' }

    await step.run('send-48h-sms', async () => {
      const twilio = new Twilio(/* boutique sub-account */)
      await twilio.messages.create({
        to: rental.clients.phone,
        from: rental.boutiques.twilio_phone_number,
        body: `Hi ${rental.clients.name}! Reminder: your dress from ${rental.boutiques.name} is due back in 2 days. Questions? Call us!`
      })
    })
  }
)
```

---

## Migration checklist — track your progress

### Phase 1 — Boutique layer
- [ ] Run migration 001_add_boutiques.sql
- [ ] Run migration 002_add_boutique_id.sql
- [ ] Backfill existing data with boutique UUID
- [ ] Verify all rows have boutique_id NOT NULL
- [ ] Create getBoutiqueFromUser() in lib/auth.ts
- [ ] Test: call getBoutiqueFromUser() from a server action, confirm boutique resolves

### Phase 2 — Auth upgrade
- [ ] Update middleware.ts with boutique check
- [ ] Create /onboarding page and createBoutique() action
- [ ] Create boutique_invites table + invite flow
- [ ] Test: new user signs up → lands on /onboarding → creates boutique → lands on dashboard

### Phase 3 — RLS
- [ ] Run migration 004_enable_rls.sql
- [ ] Create is_boutique_member() helper function
- [ ] Apply policy to every table
- [ ] Run test-rls.ts with two test boutiques
- [ ] Confirm: User A cannot see User B's events/clients/rentals
- [ ] Split Supabase client into server vs service versions
- [ ] Replace any service-role usage in page code with auth-helpers client

### Phase 4 — App Router
- [ ] Split lib/supabaseClient.ts into server/client/service
- [ ] Move pages/events/* → app/events/*
- [ ] Move pages/clients/* → app/clients/*
- [ ] Move pages/inventory/* → app/inventory/*
- [ ] Move pages/alterations/* → app/alterations/*
- [ ] Move pages/pos/* → app/pos/*
- [ ] Convert API mutations to Server Actions
- [ ] Add boutique_id scoping to every Supabase query
- [ ] Delete pages/ directory when empty

### Phase 5 — Stripe billing
- [ ] Create Stripe products + price IDs
- [ ] Add env vars for Stripe
- [ ] Run migration 005_add_billing.sql
- [ ] Create /settings/billing page
- [ ] Create createCheckoutSession() action
- [ ] Create /api/webhooks/stripe/route.ts
- [ ] Test: checkout → webhook fires → plan_tier updates in DB
- [ ] Add trial banner to dashboard

### Phase 6 — Modules
- [ ] Run migration 006_boutique_modules.sql
- [ ] Copy MODULE_REGISTRY from MODULES.md
- [ ] Create lib/modules/server.ts (Supabase version)
- [ ] Create lib/modules/client.ts (useModule hook)
- [ ] Run seed-modules.ts for all existing boutiques
- [ ] Add requireModule() gate to each feature route
- [ ] Create /settings/modules page (use widget mockup from MODULES.md)
- [ ] Test: disable dress_rental → /inventory/rentals returns 404

### Phase 7 — Inngest
- [ ] npm install inngest
- [ ] Create inngest/client.ts
- [ ] Create /api/inngest/route.ts
- [ ] Move SMS sends inside Inngest functions
- [ ] Add return-reminder function (rental.status_changed event)
- [ ] Add payment-reminder cron (9am daily)
- [ ] Add onboarding function (boutique.created event)
- [ ] Test: create rental → verify Inngest dashboard shows job queued

---

## Quick wins to do TODAY (order matters)

1. **Run migration 001 and 002** — takes 20 minutes, blocks everything else
2. **Backfill your existing data** — 5 minutes
3. **Create getBoutiqueFromUser()** — 30 minutes, then paste it into every server action
4. **Add `.eq('boutique_id', boutiqueId)` to every query** — 2–3 hours, makes your app multi-tenant-ready even before RLS
5. **Enable RLS** — 1 hour, run test-rls.ts to confirm it's working

The rest (Stripe, modules, Inngest) can be added incrementally without breaking anything already in production.
