-- ============================================================================
-- SECURITY: Close the 5 production RLS leaks discovered during E2E testing
--
-- All 5 policies use `USING (true)` (or the equivalent `USING (true) TO anon`),
-- which means RLS evaluates to TRUE for every row regardless of caller. They
-- were originally added to support public-token-based access (client portal,
-- contract signing, anonymous boutique listing for booking pages), but those
-- flows have since been moved to Edge Functions that use the service-role
-- key + token validation — the policies are now pure dead weight that
-- exposes data without serving any current purpose.
--
-- ─── The 5 leaks ───────────────────────────────────────────────────────────
--
--   Table              Policy                                Exposes
--   ─────────────────  ────────────────────────────────────  ───────────────
--   events             public_read_event_by_portal_token     ALL events to
--                                                            ANY authenticated
--                                                            user across ALL
--                                                            tenants
--
--   event_contracts    public_read_event_contracts           ALL signed/draft
--                                                            contracts across
--                                                            tenants
--
--   portal_tokens      public_read_portal_tokens             ALL tokens (which
--                                                            map to boutiques
--                                                            + events)
--
--   contracts          "public read by token"                ALL contracts
--                                                            (HTML body + PII)
--
--   boutiques          anon_boutique_view                    ALL boutique rows
--                                                            (incl. Stripe
--                                                            customer ids,
--                                                            subscription
--                                                            status, contact
--                                                            info) to ANY
--                                                            unauthenticated
--                                                            request
--
-- ─── Why this is safe ──────────────────────────────────────────────────────
--
-- Authenticated boutique members keep their access via the existing scoped
-- policies (none of which we touch):
--   • events                : evt_select / evt_insert / evt_update / evt_delete
--   • event_contracts       : boutique_members_all_event_contracts
--   • portal_tokens         : boutique_members_all_portal_tokens
--   • contracts             : boutique_members_manage_contracts (+ the
--                             targeted anon_contracts_sign_token policy
--                             added in 20260416_security_critical_fixes)
--   • boutiques             : "members read own boutique" / "members update
--                             own boutique"
--
-- Public flows continue to work via their Edge Functions:
--   • Client portal         : supabase/functions/get-portal-data (service-role
--                             + token check) — used by ClientPortalPage.jsx
--   • Contract signing      : supabase/functions/get-contract +
--                             sign-contract (service-role + token check) —
--                             used by SignContractPage.jsx
--   • Booking pages         : supabase/functions/booking-page-data
--                             (service-role + boutique_id check)
--
-- ─── How to apply ──────────────────────────────────────────────────────────
--
-- Option A — Supabase Dashboard SQL Editor (recommended for a one-shot prod
-- patch). Paste this entire file and click Run. Idempotent: safe to re-run.
--
-- Option B — Supabase CLI:
--   supabase db push
--
-- ─── Rollback ──────────────────────────────────────────────────────────────
--
-- If something downstream breaks, restore the leaks by running:
--
--   CREATE POLICY public_read_event_by_portal_token
--     ON public.events FOR SELECT USING (true);
--   CREATE POLICY public_read_event_contracts
--     ON public.event_contracts FOR SELECT USING (true);
--   CREATE POLICY public_read_portal_tokens
--     ON public.portal_tokens FOR SELECT USING (true);
--   CREATE POLICY "public read by token"
--     ON public.contracts FOR SELECT USING (true);
--   CREATE POLICY anon_boutique_view
--     ON public.boutiques FOR SELECT TO anon USING (true);
--
-- — but if you reach for the rollback, file an issue first so we can find a
-- proper fix instead of re-opening the hole.
-- ============================================================================

BEGIN;

-- Pre-flight log: how many of the 5 leaks currently exist on this database
DO $$
DECLARE
  leak_count integer;
BEGIN
  SELECT count(*) INTO leak_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN (
      'public_read_event_by_portal_token',
      'public_read_event_contracts',
      'public_read_portal_tokens',
      'public read by token',
      'anon_boutique_view'
    );
  RAISE NOTICE 'PRE-FLIGHT: % of 5 leaky policies currently exist on this database', leak_count;
END $$;

-- ─── 1. events ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS public_read_event_by_portal_token ON public.events;

-- ─── 2. event_contracts ────────────────────────────────────────────────────
DROP POLICY IF EXISTS public_read_event_contracts ON public.event_contracts;

-- ─── 3. portal_tokens ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS public_read_portal_tokens ON public.portal_tokens;

-- ─── 4. contracts ──────────────────────────────────────────────────────────
-- Two variants exist depending on when the database was provisioned. Drop both.
DROP POLICY IF EXISTS "public read by token" ON public.contracts;

-- ─── 5. boutiques ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_boutique_view ON public.boutiques;

-- ─── Verification: assert all 5 are gone ────────────────────────────────────
DO $$
DECLARE
  remaining integer;
  bad text;
BEGIN
  SELECT count(*), string_agg(policyname, ', ')
    INTO remaining, bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN (
      'public_read_event_by_portal_token',
      'public_read_event_contracts',
      'public_read_portal_tokens',
      'public read by token',
      'anon_boutique_view'
    );
  IF remaining > 0 THEN
    RAISE EXCEPTION 'FAILED: % leaky policies still present after migration: %', remaining, bad;
  END IF;
  RAISE NOTICE 'POST-FLIGHT: 0 of the 5 leaky policies remain. ✓';
END $$;

-- ─── Coverage check: confirm each table still has a *scoped* SELECT policy ──
-- so authenticated boutique members did not lose their access.
DO $$
DECLARE
  rec record;
  missing text := '';
BEGIN
  FOR rec IN
    SELECT t.tbl, count(p.policyname) AS n
    FROM (VALUES ('events'), ('event_contracts'), ('portal_tokens'), ('contracts'), ('boutiques')) AS t(tbl)
    LEFT JOIN pg_policies p
      ON p.schemaname = 'public'
     AND p.tablename  = t.tbl
     AND (p.cmd = 'SELECT' OR p.cmd = 'ALL')
    GROUP BY t.tbl
  LOOP
    IF rec.n = 0 THEN
      missing := missing || rec.tbl || ' ';
    END IF;
  END LOOP;
  IF length(missing) > 0 THEN
    RAISE EXCEPTION 'FAILED: tables left with NO SELECT policy after dropping leaks: %', missing;
  END IF;
  RAISE NOTICE 'COVERAGE: every affected table still has at least one SELECT/ALL policy. ✓';
END $$;

COMMIT;

-- ─── Summary ────────────────────────────────────────────────────────────────
-- After this migration:
--   • Authenticated boutique members: unchanged — they SELECT/INSERT/UPDATE
--     the same rows they always could, via their per-table scoped policies.
--   • Anonymous (browser, no JWT) callers: can no longer SELECT events,
--     event_contracts, portal_tokens, contracts, or boutiques directly.
--     They must go through the corresponding Edge Function (which validates
--     the token before returning data).
--   • Other anon flows that were never affected (booking_requests INSERT,
--     anon_contracts_sign_token SELECT, public_sign_event_contracts UPDATE)
--     continue to work as before.
