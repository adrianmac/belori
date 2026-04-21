-- ════════════════════════════════════════════════════════════════════════════
-- Belori — Test Seed Data
-- ════════════════════════════════════════════════════════════════════════════
-- Deterministic fixtures for the test Supabase project. Creates 2 boutiques,
-- 4 users, 6 clients, 4 events, 4 dresses, 2 alteration jobs, 8 payment
-- milestones — designed to exercise RLS isolation (any user in Boutique A
-- must NEVER see Boutique B data).
--
-- IDEMPOTENT: Safe to re-run. Deletes existing seed rows (scoped by fixed
-- UUIDs) then inserts fresh copies. Does NOT touch any rows outside the
-- seed scope.
--
-- SAFETY: Contains a hard assertion against production. Will refuse to run
-- if the target project ref is bohdabdgqgfeatpxyvbz (production).
--
-- Usage: supabase db execute --file supabase/seed.test.sql
-- Prereq: all migrations applied first via `supabase db push`.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Safety rail — refuse to seed into production ────────────────────────
DO $$
DECLARE
  project_host text;
BEGIN
  -- Read the JWT issuer from the current connection's GUC if available.
  -- Supabase sets this to the project's hostname.
  SELECT current_setting('request.jwt.claims', true) INTO project_host;

  -- Secondary check: refuse if the database name contains the prod ref.
  IF current_database() LIKE '%bohdabdgqgfeatpxyvbz%' THEN
    RAISE EXCEPTION 'ABORTED — seed.test.sql attempted to run against PRODUCTION database. Link the test project first: supabase link --project-ref <YOUR_TEST_REF>';
  END IF;
END $$;

-- Require pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- ─── Fixed UUIDs ─────────────────────────────────────────────────────────
-- These are compile-time constants. Tests reference them by name.
-- Owner A: 11111111-aaaa-1111-aaaa-111111111111
-- Staff A: 22222222-aaaa-2222-aaaa-222222222222
-- Owner B: 33333333-bbbb-3333-bbbb-333333333333
-- Staff B: 44444444-bbbb-4444-bbbb-444444444444
-- Boutique Alpha (A): aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa
-- Boutique Beta  (B): bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb

-- ─── Delete previous seed state (scoped — never touches non-seed rows) ───
-- Order matters: delete children before parents to respect FKs.

DELETE FROM public.event_services     WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb');
DELETE FROM public.alteration_jobs    WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb');
DELETE FROM public.payment_milestones WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb');
DELETE FROM public.appointments       WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb');
DELETE FROM public.events             WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb');
DELETE FROM public.inventory          WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb');
DELETE FROM public.clients            WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb');
DELETE FROM public.boutique_members   WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb');
DELETE FROM public.boutiques          WHERE id           IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb');

DELETE FROM auth.users WHERE id IN (
  '11111111-aaaa-1111-aaaa-111111111111',
  '22222222-aaaa-2222-aaaa-222222222222',
  '33333333-bbbb-3333-bbbb-333333333333',
  '44444444-bbbb-4444-bbbb-444444444444'
);

-- ─── 4 users in auth.users ──────────────────────────────────────────────
-- Password for every test user: TestPassword123!
-- Email-confirmed immediately so Playwright can log in without the
-- confirmation redirect.

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('11111111-aaaa-1111-aaaa-111111111111', '00000000-0000-0000-0000-000000000000',
   'owner-a@belori-test.local',        crypt('TestPassword123!', gen_salt('bf')),
   now(), now(), now(), 'authenticated', 'authenticated',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Alpha Owner"}'::jsonb),
  ('22222222-aaaa-2222-aaaa-222222222222', '00000000-0000-0000-0000-000000000000',
   'coordinator-a@belori-test.local',  crypt('TestPassword123!', gen_salt('bf')),
   now(), now(), now(), 'authenticated', 'authenticated',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Alpha Coordinator"}'::jsonb),
  ('33333333-bbbb-3333-bbbb-333333333333', '00000000-0000-0000-0000-000000000000',
   'owner-b@belori-test.local',        crypt('TestPassword123!', gen_salt('bf')),
   now(), now(), now(), 'authenticated', 'authenticated',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Beta Owner"}'::jsonb),
  ('44444444-bbbb-4444-bbbb-444444444444', '00000000-0000-0000-0000-000000000000',
   'seamstress-b@belori-test.local',   crypt('TestPassword123!', gen_salt('bf')),
   now(), now(), now(), 'authenticated', 'authenticated',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Beta Seamstress"}'::jsonb);

-- Also insert auth.identities rows (Supabase requires these for email login)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), '11111111-aaaa-1111-aaaa-111111111111', '11111111-aaaa-1111-aaaa-111111111111',
   '{"sub":"11111111-aaaa-1111-aaaa-111111111111","email":"owner-a@belori-test.local"}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-aaaa-2222-aaaa-222222222222', '22222222-aaaa-2222-aaaa-222222222222',
   '{"sub":"22222222-aaaa-2222-aaaa-222222222222","email":"coordinator-a@belori-test.local"}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(), '33333333-bbbb-3333-bbbb-333333333333', '33333333-bbbb-3333-bbbb-333333333333',
   '{"sub":"33333333-bbbb-3333-bbbb-333333333333","email":"owner-b@belori-test.local"}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(), '44444444-bbbb-4444-bbbb-444444444444', '44444444-bbbb-4444-bbbb-444444444444',
   '{"sub":"44444444-bbbb-4444-bbbb-444444444444","email":"seamstress-b@belori-test.local"}'::jsonb,
   'email', now(), now(), now());

-- ─── 2 boutiques ────────────────────────────────────────────────────────

INSERT INTO public.boutiques (id, name, plan, email, phone, subscription_status, trial_ends_at, created_at)
VALUES
  ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   'Maison Alpha', 'pro',
   'hello@maison-alpha.test',  '+15005550006',
   'active', now() + interval '365 days', now()),
  ('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
   'Atelier Beta', 'starter',
   'hello@atelier-beta.test',  '+15005550006',
   'trialing', now() + interval '14 days', now());

-- ─── Boutique members (RLS ties back through my_boutique_id()) ──────────

INSERT INTO public.boutique_members (boutique_id, user_id, role, name, initials, color)
VALUES
  ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', '11111111-aaaa-1111-aaaa-111111111111',
   'owner',       'Alpha Owner',       'AO', '#B08A4E'),
  ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', '22222222-aaaa-2222-aaaa-222222222222',
   'coordinator', 'Alpha Coordinator', 'AC', '#C06070'),
  ('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', '33333333-bbbb-3333-bbbb-333333333333',
   'owner',       'Beta Owner',        'BO', '#B08A4E'),
  ('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', '44444444-bbbb-4444-bbbb-444444444444',
   'seamstress',  'Beta Seamstress',   'BS', '#5C8A6E');

-- ─── 3 clients per boutique ─────────────────────────────────────────────

INSERT INTO public.clients (id, boutique_id, name, phone, email, loyalty_points)
VALUES
  -- Alpha
  ('11111111-c111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'Alice Anderson', '+15005550006', 'alice@alpha.test', 0),
  ('11111111-c222-2222-2222-222222222222', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'Bob Bennett',    '+15005550006', 'bob@alpha.test',   0),
  ('11111111-c333-3333-3333-333333333333', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'Cara Chen',      '+15005550006', 'cara@alpha.test',  0),
  -- Beta
  ('22222222-c444-4444-4444-444444444444', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'Xavier Xu',      '+15005550006', 'xavier@beta.test', 0),
  ('22222222-c555-5555-5555-555555555555', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'Yara Yoon',      '+15005550006', 'yara@beta.test',   0),
  ('22222222-c666-6666-6666-666666666666', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'Zoe Zimmerman',  '+15005550006', 'zoe@beta.test',    0);

-- ─── 2 events per boutique (wedding + quinceañera) ──────────────────────

INSERT INTO public.events (id, boutique_id, client_id, coordinator_id, type, event_date, venue, guests, status, total, paid)
VALUES
  -- Alpha: wedding in 90d, quinceañera in 30d
  ('11111111-e111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   '11111111-c111-1111-1111-111111111111', '22222222-aaaa-2222-aaaa-222222222222',
   'wedding',   (current_date + interval '90 days')::date, 'The Grand Ballroom',    120, 'active', 15000, 5000),
  ('11111111-e222-2222-2222-222222222222', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   '11111111-c222-2222-2222-222222222222', '22222222-aaaa-2222-aaaa-222222222222',
   'quince',    (current_date + interval '30 days')::date, 'Rosa Hall',              80, 'active',  8500, 2000),
  -- Beta: wedding in 60d, baptism in 45d
  ('22222222-e333-3333-3333-333333333333', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
   '22222222-c444-4444-4444-444444444444', '33333333-bbbb-3333-bbbb-333333333333',
   'wedding',   (current_date + interval '60 days')::date, 'Vineyard Estate',       150, 'active', 22000, 11000),
  ('22222222-e444-4444-4444-444444444444', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
   '22222222-c555-5555-5555-555555555555', '33333333-bbbb-3333-bbbb-333333333333',
   'baptism',   (current_date + interval '45 days')::date, 'St. Mary Church',        60, 'active',  3500,  500);

-- ─── Event services (wedding gets dress_rental + alterations + decoration) ─
INSERT INTO public.event_services (event_id, boutique_id, service_type) VALUES
  ('11111111-e111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'dress_rental'),
  ('11111111-e111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'alterations'),
  ('11111111-e111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'decoration'),
  ('22222222-e333-3333-3333-333333333333', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'dress_rental'),
  ('22222222-e333-3333-3333-333333333333', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'alterations');

-- ─── Payment milestones (2 per event: deposit + final) ───────────────────
INSERT INTO public.payment_milestones (id, boutique_id, event_id, label, amount, due_date, status, paid_date)
VALUES
  -- Alpha wedding
  ('11111111-m111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', '11111111-e111-1111-1111-111111111111', 'Deposit', 5000, current_date - interval '30 days', 'paid',    current_date - interval '25 days'),
  ('11111111-m222-2222-2222-222222222222', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', '11111111-e111-1111-1111-111111111111', 'Final',  10000, current_date + interval '60 days', 'pending', NULL),
  -- Alpha quince
  ('11111111-m333-3333-3333-333333333333', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', '11111111-e222-2222-2222-222222222222', 'Deposit', 2000, current_date - interval '14 days', 'paid',    current_date - interval '10 days'),
  ('11111111-m444-4444-4444-444444444444', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', '11111111-e222-2222-2222-222222222222', 'Final',   6500, current_date + interval '20 days', 'pending', NULL),
  -- Beta wedding
  ('22222222-m555-5555-5555-555555555555', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', '22222222-e333-3333-3333-333333333333', 'Deposit',11000, current_date - interval '20 days', 'paid',    current_date - interval '18 days'),
  ('22222222-m666-6666-6666-666666666666', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', '22222222-e333-3333-3333-333333333333', 'Final',  11000, current_date + interval '40 days', 'pending', NULL),
  -- Beta baptism
  ('22222222-m777-7777-7777-777777777777', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', '22222222-e444-4444-4444-444444444444', 'Deposit',  500, current_date - interval '7 days',  'paid',    current_date - interval '5 days'),
  ('22222222-m888-8888-8888-888888888888', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', '22222222-e444-4444-4444-444444444444', 'Final',   3000, current_date + interval '30 days', 'pending', NULL);

-- ─── Inventory (2 dresses per boutique) ──────────────────────────────────
INSERT INTO public.inventory (id, boutique_id, sku, name, category, color, size, price, deposit, status)
VALUES
  ('11111111-i111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'ALPHA-BG-001', 'Couture Lace Mermaid',    'bridal_gown', 'Ivory',       '8',  450, 200, 'available'),
  ('11111111-i222-2222-2222-222222222222', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'ALPHA-QG-001', 'Quince Ballgown Blush',   'quince_gown', 'Blush',      '12', 350, 150, 'available'),
  ('22222222-i333-3333-3333-333333333333', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'BETA-BG-001',  'Silk Slip A-line',        'bridal_gown', 'Champagne',  '10', 500, 250, 'available'),
  ('22222222-i444-4444-4444-444444444444', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'BETA-BG-002',  'Cathedral Train Gown',    'bridal_gown', 'White',      '6',  600, 300, 'rented');

-- ─── Alteration jobs (1 per boutique, tied to the wedding) ──────────────
INSERT INTO public.alteration_jobs (id, boutique_id, client_id, event_id, garment, status, deadline, price)
VALUES
  ('11111111-a111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   '11111111-c111-1111-1111-111111111111', '11111111-e111-1111-1111-111111111111',
   'Wedding Gown', 'in_progress', current_date + interval '60 days', 250),
  ('22222222-a222-2222-2222-222222222222', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
   '22222222-c444-4444-4444-444444444444', '22222222-e333-3333-3333-333333333333',
   'Bridesmaid Dress', 'pending',  current_date + interval '45 days', 120);

-- ─── Appointments (1 per event, 1 week out) ─────────────────────────────
INSERT INTO public.appointments (id, boutique_id, event_id, type, date, time, note, status)
VALUES
  ('11111111-p111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   '11111111-e111-1111-1111-111111111111',
   'measurement', (current_date + interval '7 days')::date, '10:00:00'::time, 'First fitting', 'scheduled'),
  ('22222222-p222-2222-2222-222222222222', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
   '22222222-e333-3333-3333-333333333333',
   'consultation', (current_date + interval '5 days')::date, '14:00:00'::time, 'Final details', 'scheduled');

COMMIT;

-- ─── Confirmation ────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM public.boutiques          WHERE id           IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa','bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb')) AS seed_boutiques,
  (SELECT count(*) FROM auth.users                WHERE email LIKE '%@belori-test.local')                                                                  AS seed_users,
  (SELECT count(*) FROM public.clients            WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa','bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb')) AS seed_clients,
  (SELECT count(*) FROM public.events             WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa','bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb')) AS seed_events,
  (SELECT count(*) FROM public.payment_milestones WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa','bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb')) AS seed_milestones,
  (SELECT count(*) FROM public.inventory          WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa','bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb')) AS seed_dresses,
  (SELECT count(*) FROM public.alteration_jobs    WHERE boutique_id IN ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa','bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb')) AS seed_jobs;
-- Expected: 2 boutiques · 4 users · 6 clients · 4 events · 8 milestones · 4 dresses · 2 jobs
