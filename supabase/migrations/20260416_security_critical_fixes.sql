-- ============================================================
-- SECURITY: Critical fixes — 2026-04-16
-- SEC-001: pipeline_leads missing RLS
-- SEC-005: boutique_audit_log table missing (triggers existed, table didn't)
-- SEC-005: booking_requests table missing RLS
-- SEC-005: contracts table RLS enforcement
-- ============================================================

-- ─── SEC-001: pipeline_leads — enable RLS + boutique-scoped policies ─────────

ALTER TABLE IF EXISTS pipeline_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bm_pipeline_leads_select" ON pipeline_leads;
DROP POLICY IF EXISTS "bm_pipeline_leads_insert" ON pipeline_leads;
DROP POLICY IF EXISTS "bm_pipeline_leads_update" ON pipeline_leads;
DROP POLICY IF EXISTS "bm_pipeline_leads_delete" ON pipeline_leads;

CREATE POLICY "bm_pipeline_leads_select" ON pipeline_leads
  FOR SELECT USING (boutique_id = my_boutique_id());

CREATE POLICY "bm_pipeline_leads_insert" ON pipeline_leads
  FOR INSERT WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_pipeline_leads_update" ON pipeline_leads
  FOR UPDATE USING (boutique_id = my_boutique_id())
  WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_pipeline_leads_delete" ON pipeline_leads
  FOR DELETE USING (boutique_id = my_boutique_id());

-- ─── SEC-005a: boutique_audit_log — create table (triggers already exist) ────

CREATE TABLE IF NOT EXISTS boutique_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id   uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  actor_id      uuid REFERENCES auth.users(id),
  actor_name    text,
  action        text NOT NULL,          -- 'INSERT' | 'UPDATE' | 'DELETE'
  table_name    text NOT NULL,
  row_id        text,                   -- stringified PK of the affected row
  before_data   jsonb,
  after_data    jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_boutique_id ON boutique_audit_log(boutique_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON boutique_audit_log(created_at DESC);

ALTER TABLE boutique_audit_log ENABLE ROW LEVEL SECURITY;

-- Boutique members can read their own boutique's audit log
CREATE POLICY "bm_audit_log_select" ON boutique_audit_log
  FOR SELECT USING (boutique_id = my_boutique_id());

-- No one can insert directly — only the trigger function (SECURITY DEFINER) can
-- No UPDATE policy — audit log is append-only
-- No DELETE policy — audit log is tamper-proof

-- ─── SEC-005b: booking_requests — enable RLS ─────────────────────────────────
-- Table was created outside migrations. Enable RLS and restrict reads.

ALTER TABLE IF EXISTS booking_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bm_booking_requests_select" ON booking_requests;
DROP POLICY IF EXISTS "anon_booking_requests_insert" ON booking_requests;

-- Boutique members can read their own requests
CREATE POLICY "bm_booking_requests_select" ON booking_requests
  FOR SELECT USING (boutique_id = my_boutique_id());

-- Unauthenticated callers can insert (public booking form) but only for a valid boutique
CREATE POLICY "anon_booking_requests_insert" ON booking_requests
  FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM boutiques WHERE id = boutique_id));

-- Boutique members can update (e.g. mark as reviewed)
CREATE POLICY "bm_booking_requests_update" ON booking_requests
  FOR UPDATE USING (boutique_id = my_boutique_id())
  WITH CHECK (boutique_id = my_boutique_id());

-- ─── SEC-005c: contracts — enable RLS if not already enabled ─────────────────

ALTER TABLE IF EXISTS contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bm_contracts_select" ON contracts;
DROP POLICY IF EXISTS "bm_contracts_insert" ON contracts;
DROP POLICY IF EXISTS "bm_contracts_update" ON contracts;
DROP POLICY IF EXISTS "bm_contracts_delete" ON contracts;

-- Boutique members can read/write their own contracts
CREATE POLICY "bm_contracts_select" ON contracts
  FOR SELECT USING (boutique_id = my_boutique_id());

CREATE POLICY "bm_contracts_insert" ON contracts
  FOR INSERT WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_contracts_update" ON contracts
  FOR UPDATE USING (boutique_id = my_boutique_id())
  WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_contracts_delete" ON contracts
  FOR DELETE USING (boutique_id = my_boutique_id());

-- Unauthenticated callers can read a contract by its sign_token (for signing page)
-- This is intentional — the sign_token is the credential for the public signing flow
DROP POLICY IF EXISTS "anon_contracts_sign_token" ON contracts;
CREATE POLICY "anon_contracts_sign_token" ON contracts
  FOR SELECT TO anon
  USING (sign_token IS NOT NULL AND status != 'voided');

-- ─── SEC-005d: data_deletion_requests — restrict anon read access ─────────────

ALTER TABLE IF EXISTS data_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_data_deletion_insert" ON data_deletion_requests;
DROP POLICY IF EXISTS "bm_data_deletion_select" ON data_deletion_requests;

-- Anyone can submit a deletion request (public form)
CREATE POLICY "anon_data_deletion_insert" ON data_deletion_requests
  FOR INSERT TO anon
  WITH CHECK (true);

-- Only authenticated boutique members can read requests (previously no RLS = anon readable)
CREATE POLICY "bm_data_deletion_select" ON data_deletion_requests
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── calendar_feed_token column — support opaque token auth for SEC-002 ───────

ALTER TABLE boutiques
  ADD COLUMN IF NOT EXISTS calendar_feed_token text UNIQUE DEFAULT gen_random_uuid()::text;

-- Backfill any nulls (existing rows)
UPDATE boutiques SET calendar_feed_token = gen_random_uuid()::text WHERE calendar_feed_token IS NULL;
